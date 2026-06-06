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
});
