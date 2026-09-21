// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IResolverRegistry {
    struct TimingConfig {
        uint64 checkoutResponse;
        uint64 claim;
        uint64 response;
        uint64 evidence;
        uint64 primary;
        uint64 challenge;
        uint64 fallbackEvidence;
        uint64 fallbackResolver;
        uint64 exitNotice;
    }

    struct ServiceProfile {
        bytes32 profileId;
        bytes32 serviceTermsHash;
        uint256 ruleVersion;
        address primaryResolver;
        address fallbackResolver;
        address token;
        uint256 maxDeposit;
        uint256 maxLeaseEnd;
        uint256 acceptUntil;
        bytes32 timingProfileId;
        bytes32 timeoutPolicy;
        TimingConfig timing;
    }

    struct ProfileStatus {
        bool exists;
        bool primaryAccepted;
        bool fallbackAccepted;
        bool closedForNewFunding;
    }

    struct EligibilityTerms {
        address token;
        uint256 depositAmount;
        uint256 leaseEndAt;
        uint256 ruleVersion;
        bytes32 timingProfileId;
        bytes32 serviceTermsHash;
    }

    error InvalidProfileId();
    error ProfileAlreadyExists(bytes32 profileId);
    error ProfileNotFound(bytes32 profileId);
    error InvalidServiceTermsHash();
    error InvalidRuleVersion();
    error InvalidResolver();
    error ResolversMustDiffer();
    error InvalidToken();
    error InvalidDepositLimit();
    error InvalidLeaseEnd();
    error InvalidAcceptanceDeadline();
    error InvalidTimingProfile();
    error InvalidTimingConfig();
    error InvalidTimeoutPolicy();
    error NotResolver();
    error AlreadyAccepted();
    error ProfileClosed(bytes32 profileId);
    error ServiceExpired(bytes32 profileId);

    event ProfileCreated(
        bytes32 indexed profileId,
        address indexed primaryResolver,
        address indexed fallbackResolver,
        address token,
        bytes32 serviceTermsHash,
        uint256 ruleVersion,
        uint256 maxDeposit,
        uint256 maxLeaseEnd,
        uint256 acceptUntil,
        bytes32 timingProfileId,
        bytes32 timeoutPolicy
    );

    event ProfileAccepted(bytes32 indexed profileId, address indexed resolver);

    event ProfileClosedToNewFunding(bytes32 indexed profileId, address indexed resolver);

    function createProfile(ServiceProfile calldata profile) external;

    function computeProfileId(ServiceProfile calldata profile) external pure returns (bytes32);

    function computeTimingProfileId(TimingConfig calldata timing, bytes32 timeoutPolicy) external pure returns (bytes32);

    function acceptProfile(bytes32 profileId) external;

    function revokeForNewFunding(bytes32 profileId) external;

    function isEligible(bytes32 profileId, EligibilityTerms calldata terms) external view returns (bool);

    function getProfile(bytes32 profileId)
        external
        view
        returns (ServiceProfile memory profile, ProfileStatus memory status);

    function isProfileAccepted(bytes32 profileId) external view returns (bool);
}
