// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "./DepositEscrow.sol";
import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";
import {RentBondRules} from "./RentBondRules.sol";
import {IDepositEscrowDeployer} from "./interfaces/IDepositEscrowDeployer.sol";

/// @title LeaseFactory
/// @notice Validates a Registry service profile and deploys one independent
///         DepositEscrow per lease.
contract LeaseFactory {
    struct CreateLeaseParams {
        bytes32 serviceProfileId;
        address tenant;
        address landlord;
        uint256 depositAmount;
        uint256 leaseEndAt;
        bytes32 termsHash;
        uint256 acceptDeadline;
    }

    error Unauthorized();
    error FactoryPaused();
    error InvalidAddress();
    error InvalidTerms();
    error ServiceNotEligible();
    error ServiceNotAccepted();
    error ServiceRevoked();
    error OutsideServiceScope();

    event LeaseCreated(
        bytes32 indexed leaseId,
        address indexed escrow,
        address indexed landlord,
        address tenant,
        bytes32 serviceProfileId,
        bytes32 termsHash,
        uint256 hardEndAt
    );

    event NewLeasesPaused(address indexed owner);

    address public immutable owner;
    IResolverRegistry public immutable registry;
    IDepositEscrowDeployer public immutable escrowDeployer;
    bool public newLeasesPaused;

    uint256 private _leaseNonce;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(IResolverRegistry registry_, IDepositEscrowDeployer escrowDeployer_) {
        if (address(registry_) == address(0) || address(escrowDeployer_) == address(0)) revert InvalidAddress();
        owner = msg.sender;
        registry = registry_;
        escrowDeployer = escrowDeployer_;
    }

    function createLease(CreateLeaseParams calldata params) external returns (bytes32 leaseId, address escrowAddress) {
        if (newLeasesPaused) revert FactoryPaused();
        if (params.landlord != msg.sender) revert Unauthorized();
        if (params.tenant == address(0) || params.landlord == address(0)) {
            revert InvalidAddress();
        }
        if (params.tenant == params.landlord) revert InvalidTerms();
        if (params.serviceProfileId == bytes32(0)) revert InvalidTerms();
        if (params.termsHash == bytes32(0)) revert InvalidTerms();
        if (!RentBondRules.validDeposit(params.depositAmount)) {
            revert InvalidTerms();
        }
        if (params.acceptDeadline <= block.timestamp) revert InvalidTerms();
        if (params.leaseEndAt <= block.timestamp) revert InvalidTerms();
        if (params.acceptDeadline >= params.leaseEndAt) revert InvalidTerms();

        (IResolverRegistry.ServiceProfile memory profile, IResolverRegistry.ProfileStatus memory status) =
            registry.getProfile(params.serviceProfileId);
        if (!status.primaryAccepted || !status.fallbackAccepted) {
            revert ServiceNotAccepted();
        }
        if (status.closedForNewFunding) revert ServiceRevoked();
        if (params.acceptDeadline > profile.acceptUntil) {
            revert InvalidTerms();
        }
        if (
            params.tenant == profile.primaryResolver || params.tenant == profile.fallbackResolver
                || params.landlord == profile.primaryResolver || params.landlord == profile.fallbackResolver
        ) revert InvalidTerms();

        IResolverRegistry.EligibilityTerms memory eligibility = IResolverRegistry.EligibilityTerms({
            token: profile.token,
            depositAmount: params.depositAmount,
            leaseEndAt: params.leaseEndAt,
            ruleVersion: profile.ruleVersion,
            timingProfileId: profile.timingProfileId,
            serviceTermsHash: profile.serviceTermsHash
        });
        if (!registry.isEligible(params.serviceProfileId, eligibility)) {
            revert ServiceNotEligible();
        }

        leaseId = _newLeaseId(params);
        uint256 hardEndAt = RentBondRules.hardEndAt(params.leaseEndAt, profile.timing);

        DepositEscrow.Terms memory terms = DepositEscrow.Terms({
            leaseId: leaseId,
            tenant: params.tenant,
            landlord: params.landlord,
            primaryResolver: profile.primaryResolver,
            fallbackResolver: profile.fallbackResolver,
            token: profile.token,
            depositAmount: params.depositAmount,
            leaseEndAt: params.leaseEndAt,
            hardEndAt: hardEndAt,
            timeoutPolicy: profile.timeoutPolicy,
            termsHash: params.termsHash,
            ruleVersion: profile.ruleVersion,
            timingProfileId: profile.timingProfileId,
            serviceProfileId: profile.profileId,
            serviceTermsHash: profile.serviceTermsHash,
            registryAddress: address(registry),
            acceptDeadline: params.acceptDeadline,
            timing: profile.timing
        });

        escrowAddress = escrowDeployer.deploy(terms);
        if (DepositEscrow(escrowAddress).factory() != address(this)) {
            revert InvalidTerms();
        }

        emit LeaseCreated(
            leaseId, escrowAddress, params.landlord, params.tenant, params.serviceProfileId, params.termsHash, hardEndAt
        );
    }

    function pauseNewLeases() external onlyOwner {
        newLeasesPaused = true;
        emit NewLeasesPaused(msg.sender);
    }

    function _newLeaseId(CreateLeaseParams calldata params) private returns (bytes32 leaseId) {
        _leaseNonce += 1;
        leaseId = keccak256(
            abi.encodePacked(
                block.chainid, address(this), _leaseNonce, params.tenant, params.landlord, params.termsHash
            )
        );
    }
}
