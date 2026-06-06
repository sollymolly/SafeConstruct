import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

// ethers.id(x) = keccak256(utf8(x)) -> a bytes32 hex, perfect for test ids/hashes.
const CRED_ID = ethers.id("cred-1");
const DATA_HASH = ethers.id("payload-1");
const TYPE = "OSHA-30";

describe("CredentialRegistry", () => {
  async function deploy() {
    const [admin, issuer, worker, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Factory.deploy();
    await registry.waitForDeployment();
    return { registry, admin, issuer, worker, outsider };
  }

  it("grants admin and issuer roles to the deployer", async () => {
    const { registry, admin } = await loadFixture(deploy);
    expect(await registry.isIssuer(admin.address)).to.equal(true);
  });

  it("lets admin add/remove issuers and blocks non-admins", async () => {
    const { registry, issuer, outsider } = await loadFixture(deploy);
    await expect(registry.connect(outsider).addIssuer(outsider.address)).to.be.reverted;

    await registry.addIssuer(issuer.address);
    expect(await registry.isIssuer(issuer.address)).to.equal(true);

    await registry.removeIssuer(issuer.address);
    expect(await registry.isIssuer(issuer.address)).to.equal(false);
  });

  it("issues a credential and verifies its hash", async () => {
    const { registry, issuer, worker } = await loadFixture(deploy);
    await registry.addIssuer(issuer.address);
    await registry.connect(issuer).issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, 0);

    const cred = await registry.getCredential(CRED_ID);
    expect(cred.worker).to.equal(worker.address);
    expect(cred.issuer).to.equal(issuer.address);
    expect(cred.dataHash).to.equal(DATA_HASH);
    expect(cred.credentialType).to.equal(TYPE);

    const [valid, matches] = await registry.verify(CRED_ID, DATA_HASH);
    expect(valid).to.equal(true);
    expect(matches).to.equal(true);

    // A tampered record produces a different hash -> no match.
    const [, tampered] = await registry.verify(CRED_ID, ethers.id("tampered"));
    expect(tampered).to.equal(false);
  });

  it("rejects issuing the same credentialId twice", async () => {
    const { registry, issuer, worker } = await loadFixture(deploy);
    await registry.addIssuer(issuer.address);
    await registry.connect(issuer).issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, 0);
    await expect(
      registry.connect(issuer).issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, 0)
    ).to.be.revertedWith("credential already exists");
  });

  it("blocks non-issuers from issuing", async () => {
    const { registry, outsider, worker } = await loadFixture(deploy);
    await expect(
      registry.connect(outsider).issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, 0)
    ).to.be.reverted;
  });

  it("blocks an issuer from issuing a credential to themselves", async () => {
    const { registry, issuer } = await loadFixture(deploy);
    await registry.addIssuer(issuer.address);
    await expect(
      registry.connect(issuer).issueCredential(CRED_ID, issuer.address, DATA_HASH, TYPE, 0)
    ).to.be.revertedWith("cannot issue to self");
  });

  it("lets the issuer revoke, blocks others, and marks the credential invalid", async () => {
    const { registry, issuer, worker, outsider } = await loadFixture(deploy);
    await registry.addIssuer(issuer.address);
    await registry.connect(issuer).issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, 0);

    await expect(registry.connect(outsider).revokeCredential(CRED_ID)).to.be.revertedWith(
      "only issuer or admin can revoke"
    );

    await registry.connect(issuer).revokeCredential(CRED_ID);
    expect(await registry.isValid(CRED_ID)).to.equal(false);
  });

  it("treats expired credentials as invalid", async () => {
    const { registry, issuer, worker } = await loadFixture(deploy);
    await registry.addIssuer(issuer.address);

    const expiresAt = (await time.latest()) + 3600;
    await registry
      .connect(issuer)
      .issueCredential(CRED_ID, worker.address, DATA_HASH, TYPE, expiresAt);
    expect(await registry.isValid(CRED_ID)).to.equal(true);

    await time.increaseTo(expiresAt + 1);
    expect(await registry.isValid(CRED_ID)).to.equal(false);
  });

  describe("accreditation", () => {
    it("grants the deployer the accreditor role", async () => {
      const { registry, admin } = await loadFixture(deploy);
      expect(await registry.isAccreditor(admin.address)).to.equal(true);
    });

    it("lets admin appoint/remove accreditors and blocks non-admins", async () => {
      const { registry, outsider } = await loadFixture(deploy);
      await expect(registry.connect(outsider).addAccreditor(outsider.address)).to.be.reverted;

      await registry.addAccreditor(outsider.address);
      expect(await registry.isAccreditor(outsider.address)).to.equal(true);

      await registry.removeAccreditor(outsider.address);
      expect(await registry.isAccreditor(outsider.address)).to.equal(false);
    });

    it("lets an accreditor accredit an issuer and records the body name", async () => {
      const { registry, issuer } = await loadFixture(deploy);
      await registry.accreditIssuer(issuer.address, "OSHA Training Institute");

      expect(await registry.isAccredited(issuer.address)).to.equal(true);
      const a = await registry.getAccreditation(issuer.address);
      expect(a.accreditorName).to.equal("OSHA Training Institute");
      expect(a.revoked).to.equal(false);
      expect(a.exists).to.equal(true);
    });

    it("blocks non-accreditors from accrediting", async () => {
      const { registry, issuer, outsider } = await loadFixture(deploy);
      await expect(
        registry.connect(outsider).accreditIssuer(issuer.address, "Fake Body")
      ).to.be.reverted;
    });

    it("reports unaccredited issuers as not accredited", async () => {
      const { registry, issuer } = await loadFixture(deploy);
      expect(await registry.isAccredited(issuer.address)).to.equal(false);
    });

    it("lets the accreditor revoke accreditation and blocks outsiders", async () => {
      const { registry, issuer, outsider } = await loadFixture(deploy);
      await registry.accreditIssuer(issuer.address, "OSHA Training Institute");

      await expect(
        registry.connect(outsider).revokeAccreditation(issuer.address)
      ).to.be.revertedWith("only accreditor or admin can revoke");

      await registry.revokeAccreditation(issuer.address);
      expect(await registry.isAccredited(issuer.address)).to.equal(false);
    });

    it("allows re-accreditation after revocation", async () => {
      const { registry, issuer } = await loadFixture(deploy);
      await registry.accreditIssuer(issuer.address, "OSHA Training Institute");
      await registry.revokeAccreditation(issuer.address);
      await registry.accreditIssuer(issuer.address, "State Safety Board");

      expect(await registry.isAccredited(issuer.address)).to.equal(true);
      expect((await registry.getAccreditation(issuer.address)).accreditorName).to.equal(
        "State Safety Board"
      );
    });
  });
});
