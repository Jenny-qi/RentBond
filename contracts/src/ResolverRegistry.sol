// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";

/// @title ResolverRegistry
/// @notice Stores immutable resolver service profiles and controls their use for
///         new leases and new funding.
/// @dev A profile has no owner. Either resolver can close the profile for new
///      leases/funding; already-funded escrows must use their local snapshot.
contract ResolverRegistry is IResolverRegistry {
    mapping(bytes32 profileId => ServiceProfile profile) private _profiles;
    mapping(bytes32 profileId => ProfileStatus status) private _statuses;

    /// @notice Creates an immutable service profile draft.
    /// @dev Anyone may submit a profile. It is not eligible until both listed
    ///      resolvers accept the exact profile.
    function createProfile(
        ServiceProfile calldata profile
    ) external override {
        if (profile.profileId == bytes32(0)) revert InvalidProfileId();
        if (_statuses[profile.profileId].exists) {
            revert ProfileAlreadyExists(profile.profileId);
        }
        if (profile.serviceTermsHash == bytes32(0)) {
            revert InvalidServiceTermsHash();
        }
        if (profile.ruleVersion == 0) revert InvalidRuleVersion();
        if (profile.primaryResolver == address(0)) revert InvalidResolver();
        if (profile.fallbackResolver == address(0)) revert InvalidResolver();
        if (profile.primaryResolver == profile.fallbackResolver) {
            revert ResolversMustDiffer();
        }
        if (profile.token == address(0)) revert InvalidToken();
        if (profile.maxDeposit == 0) revert InvalidDepositLimit();
        if (profile.maxLeaseEnd <= block.timestamp) revert InvalidLeaseEnd();
        if (profile.acceptUntil <= block.timestamp) {
            revert InvalidAcceptanceDeadline();
        }
        if (profile.timingProfileId == bytes32(0)) {
            revert InvalidTimingProfile();
        }

        _profiles[profile.profileId] = profile;
        _statuses[profile.profileId] = ProfileStatus({
            exists: true,
            primaryAccepted: false,
            fallbackAccepted: false,
            closedForNewFunding: false
        });

        emit ProfileCreated(
            profile.profileId,
            profile.primaryResolver,
            profile.fallbackResolver,
            profile.token,
            profile.serviceTermsHash,
            profile.ruleVersion,
            profile.maxDeposit,
            profile.maxLeaseEnd,
            profile.acceptUntil,
            profile.timingProfileId
        );
    }

    /// @notice Records acceptance by the resolver named in the profile.
    function acceptProfile(bytes32 profileId) external override {
        ServiceProfile storage profile = _requireProfile(profileId);
        ProfileStatus storage status = _statuses[profileId];

        if (status.closedForNewFunding) revert ProfileClosed(profileId);
        if (block.timestamp >= profile.acceptUntil) {
            revert ServiceExpired(profileId);
        }

        if (msg.sender == profile.primaryResolver) {
            if (status.primaryAccepted) revert AlreadyAccepted();
            status.primaryAccepted = true;
        } else if (msg.sender == profile.fallbackResolver) {
            if (status.fallbackAccepted) revert AlreadyAccepted();
            status.fallbackAccepted = true;
        } else {
            revert NotResolver();
        }

        emit ProfileAccepted(profileId, msg.sender);
    }

    /// @notice Closes this profile for future lease creation and funding.
    /// @dev Either listed resolver may close the whole profile. This does not
    ///      alter any already-funded escrow's copied service snapshot.
    function revokeForNewFunding(bytes32 profileId) external override {
        ServiceProfile storage profile = _requireProfile(profileId);
        ProfileStatus storage status = _statuses[profileId];

        if (
            msg.sender != profile.primaryResolver &&
            msg.sender != profile.fallbackResolver
        ) {
            revert NotResolver();
        }
        if (status.closedForNewFunding) revert ProfileClosed(profileId);

        status.closedForNewFunding = true;
        emit ProfileClosedToNewFunding(profileId, msg.sender);
    }

    /// @notice Checks whether a lease's service terms are currently eligible.
    /// @dev This view returns false instead of reverting so Factory/Escrow can
    ///      use it as a precondition query. Mutating callers should still
    ///      enforce their own custom errors for user-facing failure reasons.
    function isEligible(
        bytes32 profileId,
        EligibilityTerms calldata terms
    ) external view override returns (bool) {
        ServiceProfile storage profile = _profiles[profileId];
        ProfileStatus storage status = _statuses[profileId];

        if (!status.exists || status.closedForNewFunding) return false;
        if (!status.primaryAccepted || !status.fallbackAccepted) return false;
        if (block.timestamp >= profile.acceptUntil) return false;
        if (terms.token != profile.token) return false;
        if (terms.serviceTermsHash != profile.serviceTermsHash) return false;
        if (terms.ruleVersion != profile.ruleVersion) return false;
        if (terms.timingProfileId != profile.timingProfileId) return false;
        if (terms.depositAmount == 0 || terms.depositAmount > profile.maxDeposit) {
            return false;
        }
        if (
            terms.leaseEndAt <= block.timestamp ||
            terms.leaseEndAt > profile.maxLeaseEnd
        ) {
            return false;
        }

        return true;
    }

    function getProfile(
        bytes32 profileId
    )
        external
        view
        override
        returns (ServiceProfile memory profile, ProfileStatus memory status)
    {
        profile = _profiles[profileId];
        status = _statuses[profileId];
        if (!status.exists) revert ProfileNotFound(profileId);
    }

    function isProfileAccepted(
        bytes32 profileId
    ) external view override returns (bool) {
        ProfileStatus storage status = _statuses[profileId];
        if (!status.exists) return false;
        return status.primaryAccepted && status.fallbackAccepted;
    }

    function _requireProfile(
        bytes32 profileId
    ) internal view returns (ServiceProfile storage profile) {
        if (!_statuses[profileId].exists) revert ProfileNotFound(profileId);
        return _profiles[profileId];
    }
}
