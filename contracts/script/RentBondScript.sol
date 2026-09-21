// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ScriptVm {
    function envAddress(string calldata name) external returns (address value);

    function envBytes32(string calldata name) external returns (bytes32 value);

    function envUint(string calldata name) external returns (uint256 value);

    function startBroadcast() external;

    function stopBroadcast() external;
}

abstract contract RentBondScript {
    error UnexpectedChain(uint256 expected, uint256 actual);

    ScriptVm internal constant vm = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _requireExpectedChain() internal {
        uint256 expected = vm.envUint("CHAIN_ID");
        if (block.chainid != expected) {
            revert UnexpectedChain(expected, block.chainid);
        }
    }
}
