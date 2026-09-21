// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondScript} from "./RentBondScript.sol";

/// @notice Run once from R and once from F. The Registry rejects every other
///         sender, so the script cannot silently substitute a platform signer.
contract AcceptServiceProfile is RentBondScript {
    function run() external {
        _requireExpectedChain();
        ResolverRegistry registry = ResolverRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        bytes32 profileId = vm.envBytes32("SERVICE_PROFILE_ID");

        vm.startBroadcast();
        registry.acceptProfile(profileId);
        vm.stopBroadcast();
    }
}
