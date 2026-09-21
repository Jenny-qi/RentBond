// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "./DepositEscrow.sol";
import {IDepositEscrowDeployer} from "./interfaces/IDepositEscrowDeployer.sol";

/// @title DepositEscrowDeployer
/// @notice Stateless deployer that keeps DepositEscrow creation bytecode out of
///         LeaseFactory runtime bytecode. It has no owner or escrow authority.
contract DepositEscrowDeployer is IDepositEscrowDeployer {
    event EscrowDeployed(bytes32 indexed leaseId, address indexed factory, address indexed escrow);

    function deploy(DepositEscrow.Terms calldata terms) external returns (address escrowAddress) {
        DepositEscrow escrow = new DepositEscrow(terms, msg.sender);
        escrowAddress = address(escrow);
        emit EscrowDeployed(terms.leaseId, msg.sender, escrowAddress);
    }
}
