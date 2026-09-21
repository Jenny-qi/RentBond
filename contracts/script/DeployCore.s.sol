// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrowDeployer} from "../src/DepositEscrowDeployer.sol";
import {LeaseFactory} from "../src/LeaseFactory.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondScript} from "./RentBondScript.sol";

/// @notice Deploys the immutable RentBond core on the explicitly selected
///         network. Forge supplies the broadcaster; no key is stored here.
contract DeployCore is RentBondScript {
    function run()
        external
        returns (MockUSD token, ResolverRegistry registry, DepositEscrowDeployer escrowDeployer, LeaseFactory factory)
    {
        _requireExpectedChain();
        address mintOperator = vm.envAddress("MOCK_USD_MINT_OPERATOR");

        vm.startBroadcast();
        token = new MockUSD(mintOperator);
        registry = new ResolverRegistry();
        escrowDeployer = new DepositEscrowDeployer();
        factory = new LeaseFactory(registry, escrowDeployer);
        vm.stopBroadcast();
    }
}
