// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondScript} from "./RentBondScript.sol";

/// @notice Creates the default 37-day resolver profile draft. The two named
///         resolvers must each accept it in separate transactions afterward.
contract CreateServiceProfile is RentBondScript {
    bytes32 private constant TIMEOUT_POLICY = keccak256("TIMEOUT_RETURN_UNAWARDED_TO_TENANT");

    function run() external returns (bytes32 profileId) {
        _requireExpectedChain();
        ResolverRegistry registry = ResolverRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        IResolverRegistry.TimingConfig memory timing = IResolverRegistry.TimingConfig({
            checkoutResponse: 7 days,
            claim: 7 days,
            response: 7 days,
            evidence: 3 days,
            primary: 7 days,
            challenge: 3 days,
            fallbackEvidence: 2 days,
            fallbackResolver: 7 days,
            exitNotice: 3 days
        });
        bytes32 timingProfileId = registry.computeTimingProfileId(timing, TIMEOUT_POLICY);
        IResolverRegistry.ServiceProfile memory profile = IResolverRegistry.ServiceProfile({
            profileId: bytes32(0),
            serviceTermsHash: vm.envBytes32("SERVICE_TERMS_HASH"),
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
