// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {DepositEscrowDeployer} from "../src/DepositEscrowDeployer.sol";
import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {LeaseFactory} from "../src/LeaseFactory.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondTestBase, TestActor} from "./TestHelpers.sol";

contract LeaseFactoryTest is RentBondTestBase {
    ResolverRegistry private registry;
    DepositEscrowDeployer private escrowDeployer;
    LeaseFactory private factory;
    MockUSD private token;
    TestActor private primary;
    TestActor private fallbackResolver;
    TestActor private tenant;
    TestActor private landlord;
    IResolverRegistry.ServiceProfile private profile;

    function setUp() public {
        registry = new ResolverRegistry();
        escrowDeployer = new DepositEscrowDeployer();
        factory = new LeaseFactory(registry, escrowDeployer);
        token = new MockUSD(address(this));
        primary = new TestActor();
        fallbackResolver = new TestActor();
        tenant = new TestActor();
        landlord = new TestActor();
        profile = _profile(registry, address(primary), address(fallbackResolver), address(token), DEPOSIT);
        registry.createProfile(profile);
        _acceptProfile(registry, profile.profileId, primary, fallbackResolver);
    }

    function testFactoryCopiesImmutableRegistrySnapshot() public {
        (bytes32 leaseId, address escrowAddress) = _create(_params());

        require(leaseId != bytes32(0), "missing lease id");
        require(escrowAddress != address(0), "missing escrow");

        DepositEscrow escrow = DepositEscrow(escrowAddress);
        DepositEscrow.Terms memory terms = escrow.getTerms();
        require(escrow.factory() == address(factory), "factory not authenticated");
        require(terms.serviceProfileId == profile.profileId, "profile mismatch");
        require(terms.serviceTermsHash == SERVICE_HASH, "service mismatch");
        require(terms.primaryResolver == address(primary), "primary mismatch");
        require(terms.fallbackResolver == address(fallbackResolver), "fallback mismatch");
        require(terms.tenant == address(tenant), "tenant mismatch");
        require(terms.landlord == address(landlord), "landlord mismatch");
        require(terms.token == address(token), "token mismatch");
        require(terms.hardEndAt == _hardEndAt(terms.leaseEndAt, profile.timing), "hard end not derived");
    }

    function testPauseOnlyBlocksNewLeases() public {
        (, address existingEscrow) = _create(_params());
        factory.pauseNewLeases();

        require(
            !landlord.tryExecute(address(factory), abi.encodeCall(factory.createLease, (_params()))),
            "paused factory created lease"
        );
        require(
            uint256(DepositEscrow(existingEscrow).phase()) == uint256(DepositEscrow.Phase.AwaitingAcceptance),
            "existing lease changed"
        );
    }

    function testOnlyDeclaredLandlordCanCreate() public {
        require(
            !tenant.tryExecute(address(factory), abi.encodeCall(factory.createLease, (_params()))),
            "tenant impersonated landlord"
        );
    }

    function testRoleCollisionAndFractionalAmountAreRejected() public {
        LeaseFactory.CreateLeaseParams memory params = _params();
        params.tenant = address(primary);
        require(
            !landlord.tryExecute(address(factory), abi.encodeCall(factory.createLease, (params))),
            "tenant also resolver"
        );

        params = _params();
        params.depositAmount = DEPOSIT - 1;
        require(
            !landlord.tryExecute(address(factory), abi.encodeCall(factory.createLease, (params))),
            "fractional business amount accepted"
        );
    }

    function testRevokedProfileCannotCreateLease() public {
        primary.execute(address(registry), abi.encodeCall(registry.revokeForNewFunding, (profile.profileId)));
        require(
            !landlord.tryExecute(address(factory), abi.encodeCall(factory.createLease, (_params()))),
            "revoked service created lease"
        );
    }

    function _params() private view returns (LeaseFactory.CreateLeaseParams memory params) {
        params = LeaseFactory.CreateLeaseParams({
            serviceProfileId: profile.profileId,
            tenant: address(tenant),
            landlord: address(landlord),
            depositAmount: DEPOSIT,
            leaseEndAt: block.timestamp + 30 days,
            termsHash: TERMS_HASH,
            acceptDeadline: block.timestamp + 1 days
        });
    }

    function _create(LeaseFactory.CreateLeaseParams memory params)
        private
        returns (bytes32 leaseId, address escrowAddress)
    {
        bytes memory result = landlord.execute(address(factory), abi.encodeCall(factory.createLease, (params)));
        return abi.decode(result, (bytes32, address));
    }
}
