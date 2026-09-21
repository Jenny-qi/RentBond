// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

/// @dev Gives each protocol role an independent msg.sender without depending
///      on forge-std impersonation helpers.
contract TestActor {
    function execute(address target, bytes calldata callData) external returns (bytes memory returnData) {
        (bool success, bytes memory result) = target.call(callData);
        require(success, "actor call failed");
        return result;
    }

    function tryExecute(address target, bytes calldata callData) external returns (bool success) {
        (success,) = target.call(callData);
    }
}

abstract contract RentBondTestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant DEPOSIT = 1_000e6;
    bytes32 internal constant SERVICE_HASH = keccak256("service-v1");
    bytes32 internal constant TERMS_HASH = keccak256("lease-v1");
    bytes32 internal constant TIMEOUT_POLICY = keccak256("TIMEOUT_RETURN_UNAWARDED_TO_TENANT");

    struct EscrowFixture {
        ResolverRegistry registry;
        MockUSD token;
        TestActor tenant;
        TestActor landlord;
        TestActor primary;
        TestActor fallbackResolver;
        DepositEscrow escrow;
        bytes32 profileId;
    }

    function _timing() internal pure returns (IResolverRegistry.TimingConfig memory timing) {
        timing = IResolverRegistry.TimingConfig({
            checkoutResponse: 1 days,
            claim: 1 days,
            response: 1 days,
            evidence: 1 days,
            primary: 1 days,
            challenge: 1 days,
            fallbackEvidence: 1 days,
            fallbackResolver: 3 days,
            exitNotice: 1 days
        });
    }

    function _hardEndAt(uint256 leaseEndAt, IResolverRegistry.TimingConfig memory timing)
        internal
        pure
        returns (uint256)
    {
        return leaseEndAt + uint256(timing.claim) + uint256(timing.response) + uint256(timing.evidence)
            + uint256(timing.primary) + uint256(timing.challenge) + uint256(timing.fallbackResolver)
            + uint256(timing.exitNotice);
    }

    function _profile(
        ResolverRegistry registry,
        address primary,
        address fallbackResolver,
        address token,
        uint256 maxDeposit
    ) internal view returns (IResolverRegistry.ServiceProfile memory profile) {
        IResolverRegistry.TimingConfig memory timing = _timing();
        bytes32 timingProfileId = registry.computeTimingProfileId(timing, TIMEOUT_POLICY);
        profile = IResolverRegistry.ServiceProfile({
            profileId: bytes32(0),
            serviceTermsHash: SERVICE_HASH,
            ruleVersion: 1,
            primaryResolver: primary,
            fallbackResolver: fallbackResolver,
            token: token,
            maxDeposit: maxDeposit,
            maxLeaseEnd: block.timestamp + 365 days,
            acceptUntil: block.timestamp + 180 days,
            timingProfileId: timingProfileId,
            timeoutPolicy: TIMEOUT_POLICY,
            timing: timing
        });
        profile.profileId = registry.computeProfileId(profile);
    }

    function _acceptProfile(ResolverRegistry registry, bytes32 profileId, TestActor primary, TestActor fallbackResolver)
        internal
    {
        primary.execute(address(registry), abi.encodeCall(registry.acceptProfile, (profileId)));
        fallbackResolver.execute(address(registry), abi.encodeCall(registry.acceptProfile, (profileId)));
    }

    function _newEscrow() internal returns (EscrowFixture memory fixture) {
        fixture.registry = new ResolverRegistry();
        fixture.token = new MockUSD(address(this));
        fixture.tenant = new TestActor();
        fixture.landlord = new TestActor();
        fixture.primary = new TestActor();
        fixture.fallbackResolver = new TestActor();

        IResolverRegistry.ServiceProfile memory profile = _profile(
            fixture.registry,
            address(fixture.primary),
            address(fixture.fallbackResolver),
            address(fixture.token),
            DEPOSIT
        );
        fixture.profileId = profile.profileId;
        fixture.registry.createProfile(profile);
        _acceptProfile(fixture.registry, fixture.profileId, fixture.primary, fixture.fallbackResolver);

        uint256 leaseEndAt = block.timestamp + 30 days;
        DepositEscrow.Terms memory terms = DepositEscrow.Terms({
            leaseId: keccak256(abi.encode(address(fixture.tenant), block.number)),
            tenant: address(fixture.tenant),
            landlord: address(fixture.landlord),
            primaryResolver: address(fixture.primary),
            fallbackResolver: address(fixture.fallbackResolver),
            token: address(fixture.token),
            depositAmount: DEPOSIT,
            leaseEndAt: leaseEndAt,
            hardEndAt: _hardEndAt(leaseEndAt, profile.timing),
            timeoutPolicy: profile.timeoutPolicy,
            termsHash: TERMS_HASH,
            ruleVersion: profile.ruleVersion,
            timingProfileId: profile.timingProfileId,
            serviceProfileId: profile.profileId,
            serviceTermsHash: profile.serviceTermsHash,
            registryAddress: address(fixture.registry),
            acceptDeadline: block.timestamp + 1 days,
            timing: profile.timing
        });
        fixture.escrow = new DepositEscrow(terms, address(this));
        fixture.token.mint(address(fixture.tenant), DEPOSIT);
    }

    function _fund(EscrowFixture memory fixture) internal {
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH)));
        fixture.tenant
            .execute(address(fixture.token), abi.encodeCall(fixture.token.approve, (address(fixture.escrow), DEPOSIT)));
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT)));
    }

    function _startScheduledSettlement(EscrowFixture memory fixture)
        internal
        returns (DepositEscrow.SettlementSchedule memory schedule)
    {
        DepositEscrow.Terms memory terms = fixture.escrow.getTerms();
        vm.warp(terms.leaseEndAt);
        fixture.escrow.startScheduledSettlement();
        return fixture.escrow.getSettlementSchedule();
    }

    function _submitDemoClaims(EscrowFixture memory fixture) internal {
        DepositEscrow.ClaimInput[] memory claims = new DepositEscrow.ClaimInput[](2);
        claims[0] = DepositEscrow.ClaimInput({amount: 100e6, commitment: keccak256("cleaning")});
        claims[1] = DepositEscrow.ClaimInput({amount: 200e6, commitment: keccak256("desk")});
        fixture.landlord.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (claims)));
    }

    function _closeDemoClaims(EscrowFixture memory fixture, DepositEscrow.SettlementSchedule memory schedule) internal {
        vm.warp(schedule.claimDeadline);
        fixture.escrow.closeClaims();
    }

    function _respondClaim(EscrowFixture memory fixture, uint256 claimId, bool accept, bytes32 commitment) internal {
        fixture.tenant
            .execute(
                address(fixture.escrow), abi.encodeCall(fixture.escrow.respondClaim, (claimId, accept, commitment))
            );
    }
}
