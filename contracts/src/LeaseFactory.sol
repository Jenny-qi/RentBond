// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "./DepositEscrow.sol";
import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";

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
        uint256 hardEndAt;
        bytes32 timeoutPolicy;
        bytes32 termsHash;
        uint256 ruleVersion;
        bytes32 timingProfileId;
        bytes32 serviceTermsHash;
        uint256 acceptDeadline;
        uint256 claimDeadline;
        uint256 responseDeadline;
        uint256 evidenceDeadline;
        uint256 primaryDeadline;
        uint256 challengeDeadline;
        uint256 fallbackDeadline;
        uint256 exitNoticeDeadline;
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
        bytes32 termsHash
    );

    address private immutable owner;
    IResolverRegistry immutable registry;
    bool public newLeasesPaused;

    uint256 private _leaseNonce;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(IResolverRegistry registry_) {
        if (address(registry_) == address(0)) revert InvalidAddress();
        owner = msg.sender;
        registry = registry_;
    }

    function createLease(
        CreateLeaseParams calldata params
    ) external returns (bytes32 leaseId, address escrowAddress) {
        if (newLeasesPaused) revert FactoryPaused();
        if (params.landlord != msg.sender) revert Unauthorized();
        if (params.tenant == address(0) || params.landlord == address(0)) {
            revert InvalidAddress();
        }
        if (params.tenant == params.landlord) revert InvalidTerms();
        if (params.serviceProfileId == bytes32(0)) revert InvalidTerms();
        if (params.termsHash == bytes32(0)) revert InvalidTerms();
        if (params.serviceTermsHash == bytes32(0)) revert InvalidTerms();
        if (params.timeoutPolicy == bytes32(0)) revert InvalidTerms();
        if (params.timingProfileId == bytes32(0)) revert InvalidTerms();
        if (params.hardEndAt < params.leaseEndAt) revert InvalidTerms();
        if (params.acceptDeadline <= block.timestamp) revert InvalidTerms();
        if (params.leaseEndAt <= block.timestamp) revert InvalidTerms();
        if (
            params.acceptDeadline >= params.leaseEndAt ||
            params.claimDeadline <= params.leaseEndAt ||
            params.responseDeadline <= params.claimDeadline ||
            params.evidenceDeadline <= params.responseDeadline ||
            params.primaryDeadline <= params.evidenceDeadline ||
            params.challengeDeadline <= params.primaryDeadline ||
            params.fallbackDeadline <= params.challengeDeadline ||
            params.exitNoticeDeadline <= params.fallbackDeadline ||
            params.exitNoticeDeadline > params.hardEndAt
        ) revert InvalidTerms();

        (IResolverRegistry.ServiceProfile memory profile, ) = registry
            .getProfile(params.serviceProfileId);
        if (params.acceptDeadline > profile.acceptUntil) {
            revert InvalidTerms();
        }

        IResolverRegistry.EligibilityTerms memory eligibility = IResolverRegistry
            .EligibilityTerms({
                token: profile.token,
                depositAmount: params.depositAmount,
                leaseEndAt: params.leaseEndAt,
                ruleVersion: params.ruleVersion,
                timingProfileId: params.timingProfileId,
                serviceTermsHash: params.serviceTermsHash
            });
        if (!registry.isEligible(params.serviceProfileId, eligibility)) {
            revert ServiceNotEligible();
        }

        leaseId = _newLeaseId(params);

        DepositEscrow.Terms memory terms = DepositEscrow.Terms({
            leaseId: leaseId,
            tenant: params.tenant,
            landlord: params.landlord,
            primaryResolver: profile.primaryResolver,
            fallbackResolver: profile.fallbackResolver,
            token: profile.token,
            depositAmount: params.depositAmount,
            leaseEndAt: params.leaseEndAt,
            hardEndAt: params.hardEndAt,
            timeoutPolicy: params.timeoutPolicy,
            termsHash: params.termsHash,
            ruleVersion: profile.ruleVersion,
            timingProfileId: profile.timingProfileId,
            serviceProfileId: profile.profileId,
            serviceTermsHash: profile.serviceTermsHash,
            registryAddress: address(registry),
            acceptDeadline: params.acceptDeadline,
            claimDeadline: params.claimDeadline,
            responseDeadline: params.responseDeadline,
            evidenceDeadline: params.evidenceDeadline,
            primaryDeadline: params.primaryDeadline,
            challengeDeadline: params.challengeDeadline,
            fallbackDeadline: params.fallbackDeadline,
            exitNoticeDeadline: params.exitNoticeDeadline
        });

        DepositEscrow escrow = new DepositEscrow(terms);
        escrowAddress = address(escrow);

        emit LeaseCreated(
            leaseId,
            escrowAddress,
            params.landlord,
            params.tenant,
            params.serviceProfileId,
            params.termsHash
        );
    }

    function pauseNewLeases() external onlyOwner {
        newLeasesPaused = true;
    }

    function _newLeaseId(
        CreateLeaseParams calldata params
    ) private returns (bytes32 leaseId) {
        _leaseNonce += 1;
        leaseId = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                _leaseNonce,
                params.tenant,
                params.landlord,
                params.termsHash
            )
        );
    }
}
