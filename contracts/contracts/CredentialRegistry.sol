// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CredentialRegistry
/// @notice On-chain anchor for SafeConstruct safety credentials. The chain stores
///         only a tamper-proof hash of each credential plus its status/metadata;
///         the full record (worker name, course details, document) lives off-chain.
///         Verifying = re-hashing the off-chain record and comparing it here.
contract CredentialRegistry is AccessControl {
    /// @dev Accounts with this role may issue and revoke credentials.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        bytes32 dataHash;       // keccak256 of the canonical off-chain record (integrity anchor)
        address worker;         // custodial wallet the credential is bound to
        address issuer;         // the account that issued it (msg.sender at issue time)
        uint64  issuedAt;       // unix seconds
        uint64  expiresAt;      // unix seconds; 0 = never expires
        bool    revoked;
        bool    exists;
        string  credentialType; // human-readable code, e.g. "OSHA-30"
    }

    /// @dev credentialId (a bytes32, typically keccak256 of an off-chain UUID) => record.
    mapping(bytes32 => Credential) private _credentials;

    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed worker,
        address indexed issuer,
        bytes32 dataHash,
        string credentialType,
        uint64 expiresAt
    );
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer);
    event IssuerAdded(address indexed account, address indexed admin);
    event IssuerRemoved(address indexed account, address indexed admin);

    constructor() {
        // The deployer is the admin and can also issue (useful for the platform relayer).
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    // ----------------------------------------------------------------------
    // Issuer management — only the admin can change who is allowed to issue.
    // ----------------------------------------------------------------------

    function addIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ISSUER_ROLE, account);
        emit IssuerAdded(account, msg.sender);
    }

    function removeIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, account);
        emit IssuerRemoved(account, msg.sender);
    }

    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    // ----------------------------------------------------------------------
    // Credential lifecycle.
    // ----------------------------------------------------------------------

    /// @notice Issue a new credential. Reverts if the id already exists.
    function issueCredential(
        bytes32 credentialId,
        address worker,
        bytes32 dataHash,
        string calldata credentialType,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) {
        require(worker != address(0), "worker is zero address");
        require(dataHash != bytes32(0), "dataHash is empty");
        require(!_credentials[credentialId].exists, "credential already exists");

        _credentials[credentialId] = Credential({
            dataHash: dataHash,
            worker: worker,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            exists: true,
            credentialType: credentialType
        });

        emit CredentialIssued(credentialId, worker, msg.sender, dataHash, credentialType, expiresAt);
    }

    /// @notice Revoke a credential. Only the original issuer or an admin may do so.
    function revokeCredential(bytes32 credentialId) external {
        Credential storage cred = _credentials[credentialId];
        require(cred.exists, "credential does not exist");
        require(
            cred.issuer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "only issuer or admin can revoke"
        );
        require(!cred.revoked, "already revoked");
        cred.revoked = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }

    // ----------------------------------------------------------------------
    // Views.
    // ----------------------------------------------------------------------

    function getCredential(bytes32 credentialId) external view returns (Credential memory) {
        return _credentials[credentialId];
    }

    /// @notice True only if the credential exists, is not revoked, and is not expired.
    function isValid(bytes32 credentialId) public view returns (bool) {
        Credential storage cred = _credentials[credentialId];
        if (!cred.exists || cred.revoked) return false;
        if (cred.expiresAt != 0 && block.timestamp > cred.expiresAt) return false;
        return true;
    }

    /// @notice The core verification call: is the credential valid, and does the
    ///         provided hash match what was committed on-chain (i.e. untampered)?
    function verify(bytes32 credentialId, bytes32 dataHash)
        external
        view
        returns (bool valid, bool hashMatches)
    {
        Credential storage cred = _credentials[credentialId];
        valid = isValid(credentialId);
        hashMatches = cred.exists && cred.dataHash == dataHash;
    }
}
