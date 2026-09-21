// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../DepositEscrow.sol";

interface IDepositEscrowDeployer {
    function deploy(DepositEscrow.Terms calldata terms) external returns (address escrow);
}
