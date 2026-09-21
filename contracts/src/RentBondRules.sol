// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";

library RentBondRules {
    uint256 internal constant BUSINESS_UNIT = 10_000;
    uint256 internal constant MIN_DEPOSIT = 1_000_000;
    uint256 internal constant MAX_DEPOSIT = 10_000_000_000;
    uint256 internal constant CHECKOUT_RETRY_DELAY = 1 days;

    bytes32 internal constant TIMEOUT_RETURN_UNAWARDED_TO_TENANT = keccak256("TIMEOUT_RETURN_UNAWARDED_TO_TENANT");

    function isBusinessAmount(uint256 amount, bool allowZero) internal pure returns (bool) {
        if (!allowZero && amount == 0) return false;
        return amount % BUSINESS_UNIT == 0;
    }

    function validDeposit(uint256 amount) internal pure returns (bool) {
        return amount >= MIN_DEPOSIT && amount <= MAX_DEPOSIT && isBusinessAmount(amount, false);
    }

    function validTiming(IResolverRegistry.TimingConfig memory timing) internal pure returns (bool) {
        return timing.checkoutResponse > 0 && timing.claim > 0 && timing.response > 0 && timing.evidence > 0
            && timing.primary > 0 && timing.challenge > 0 && timing.fallbackEvidence > 0
            && timing.fallbackEvidence < timing.fallbackResolver && timing.fallbackResolver > 0 && timing.exitNotice > 0;
    }

    function timingProfileId(IResolverRegistry.TimingConfig memory timing, bytes32 timeoutPolicy)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(timing, timeoutPolicy));
    }

    function hardEndAt(uint256 leaseEndAt, IResolverRegistry.TimingConfig memory timing)
        internal
        pure
        returns (uint256)
    {
        return leaseEndAt + uint256(timing.claim) + uint256(timing.response) + uint256(timing.evidence)
            + uint256(timing.primary) + uint256(timing.challenge) + uint256(timing.fallbackResolver)
            + uint256(timing.exitNotice);
    }
}
