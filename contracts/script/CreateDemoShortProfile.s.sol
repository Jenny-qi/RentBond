// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondScript} from "./RentBondScript.sol";

/// @notice Separate, visibly labelled test profile for short-lived Demo leases.
///         R and F still accept its profileId in separate transactions.
///         Do not reuse its address/profileId for a NORMAL_TEST lease.
contract CreateDemoShortProfile is RentBondScript {
    bytes32 private constant TIMEOUT_POLICY = keccak256("TIMEOUT_RETURN_UNAWARDED_TO_TENANT");

    function run() external returns (bytes32 profileId) {
        _requireExpectedChain();
        ResolverRegistry registry = ResolverRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        IResolverRegistry.TimingConfig memory timing = IResolverRegistry.TimingConfig({
            checkoutResponse: 5 minutes,
            claim: 10 minutes,
            response: 10 minutes,
            evidence: 5 minutes,
            primary: 10 minutes,
            challenge: 5 minutes,
            fallbackEvidence: 5 minutes,
            fallbackResolver: 15 minutes,
            exitNotice: 5 minutes
        });
        bytes32 timingProfileId = registry.computeTimingProfileId(timing, TIMEOUT_POLICY);
        IResolverRegistry.ServiceProfile memory profile = IResolverRegistry.ServiceProfile({
            profileId: bytes32(0),
            serviceTermsHash: vm.envBytes32("DEMO_SHORT_SERVICE_TERMS_HASH"),
            ruleVersion: 1,
            primaryResolver: vm.envAddress("PRIMARY_RESOLVER"),
            fallbackResolver: vm.envAddress("FALLBACK_RESOLVER"),
            token: vm.envAddress("MOCK_USD_ADDRESS"),
            maxDeposit: vm.envUint("MAX_DEPOSIT_BASE_UNITS"),
            maxLeaseEnd: vm.envUint("MAX_LEASE_END_TIMESTAMP"),
            acceptUntil: vm.envUint("PROFILE_ACCEPT_UNTIL_TIMESTAMP"),
            timingProfileId: timingProfileId,
            timeoutPolicy: TIMEOUT_POLICY,
            timing: timing
        });
        profileId = registry.computeProfileId(profile);
        profile.profileId = profileId;

        vm.startBroadcast();
        registry.createProfile(profile);
        vm.stopBroadcast();
    }
}
