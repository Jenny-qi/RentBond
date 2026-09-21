// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {LeaseFactory} from "../src/LeaseFactory.sol";
import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";

contract FactoryActor {
    function acceptProfile(
        ResolverRegistry registry,
        bytes32 profileId
    ) external {
        registry.acceptProfile(profileId);
    }

    function createLease(
        LeaseFactory factory,
        LeaseFactory.CreateLeaseParams calldata params
    ) external returns (bytes32 leaseId, address escrow) {
        return factory.createLease(params);
    }

    function tryCreateLease(
        LeaseFactory factory,
        LeaseFactory.CreateLeaseParams calldata params
    ) external returns (bool) {
        try factory.createLease(params) {
            return true;
        } catch {
            return false;
        }
    }
}

contract LeaseFactoryTest {
    bytes32 private constant PROFILE_ID = keccak256("factory-profile");
    bytes32 private constant SERVICE_HASH = keccak256("factory-service");
    bytes32 private constant TERMS_HASH = keccak256("factory-terms");
    bytes32 private constant TIMING_ID = keccak256("normal");
    bytes32 private constant TIMEOUT_POLICY = keccak256("tenant-return");
    address private constant TOKEN = address(0x1234);

    function testFactoryCopiesRegistrySnapshot() public {
        (
            ResolverRegistry registry,
            LeaseFactory factory,
            FactoryActor primary,
            FactoryActor fallbackResolver,
            FactoryActor tenant,
            FactoryActor landlord
        ) = _setup();

        primary.acceptProfile(registry, PROFILE_ID);
        fallbackResolver.acceptProfile(registry, PROFILE_ID);

        (bytes32 leaseId, address escrowAddress) = landlord.createLease(
            factory,
            _params(address(tenant), address(landlord))
        );

        require(leaseId != bytes32(0), "missing lease id");
        require(escrowAddress != address(0), "missing escrow");

        DepositEscrow.Terms memory terms = DepositEscrow(escrowAddress)
            .getTerms();
        require(terms.serviceProfileId == PROFILE_ID, "profile mismatch");
        require(terms.serviceTermsHash == SERVICE_HASH, "service hash mismatch");
        require(terms.primaryResolver == address(primary), "primary mismatch");
        require(
            terms.fallbackResolver == address(fallbackResolver),
            "fallback mismatch"
        );
        require(terms.tenant == address(tenant), "tenant mismatch");
        require(terms.landlord == address(landlord), "landlord mismatch");
        require(terms.token == TOKEN, "token mismatch");
    }

    function testPauseOnlyBlocksNewCreation() public {
        (
            ResolverRegistry registry,
            LeaseFactory factory,
            FactoryActor primary,
            FactoryActor fallbackResolver,
            FactoryActor tenant,
            FactoryActor landlord
        ) = _setup();

        primary.acceptProfile(registry, PROFILE_ID);
        fallbackResolver.acceptProfile(registry, PROFILE_ID);
        landlord.createLease(factory, _params(address(tenant), address(landlord)));

        factory.pauseNewLeases();
        require(
            !landlord.tryCreateLease(
                factory,
                _params(address(tenant), address(landlord))
            ),
            "paused factory created lease"
        );
    }

    function testOnlyLandlordCanCreate() public {
        (
            ResolverRegistry registry,
            LeaseFactory factory,
            FactoryActor primary,
            FactoryActor fallbackResolver,
            FactoryActor tenant,
            FactoryActor landlord
        ) = _setup();

        primary.acceptProfile(registry, PROFILE_ID);
        fallbackResolver.acceptProfile(registry, PROFILE_ID);
        require(
            !tenant.tryCreateLease(
                factory,
                _params(address(tenant), address(landlord))
            ),
            "tenant created lease"
        );
    }

    function _setup()
        private
        returns (
            ResolverRegistry registry,
            LeaseFactory factory,
            FactoryActor primary,
            FactoryActor fallbackResolver,
            FactoryActor tenant,
            FactoryActor landlord
        )
    {
        registry = new ResolverRegistry();
        factory = new LeaseFactory(registry);
        primary = new FactoryActor();
        fallbackResolver = new FactoryActor();
        tenant = new FactoryActor();
        landlord = new FactoryActor();

        registry.createProfile(
            IResolverRegistry.ServiceProfile({
                profileId: PROFILE_ID,
                serviceTermsHash: SERVICE_HASH,
                ruleVersion: 1,
                primaryResolver: address(primary),
                fallbackResolver: address(fallbackResolver),
                token: TOKEN,
                maxDeposit: 1000e6,
                maxLeaseEnd: type(uint256).max,
                acceptUntil: type(uint256).max,
                timingProfileId: TIMING_ID
            })
        );
    }

    function _params(
        address tenant,
        address landlord
    ) private view returns (LeaseFactory.CreateLeaseParams memory params) {
        uint256 nowAtSetup = block.timestamp;
        params = LeaseFactory.CreateLeaseParams({
            serviceProfileId: PROFILE_ID,
            tenant: tenant,
            landlord: landlord,
            depositAmount: 1000e6,
            leaseEndAt: nowAtSetup + 2 days,
            hardEndAt: nowAtSetup + 19 days,
            timeoutPolicy: TIMEOUT_POLICY,
            termsHash: TERMS_HASH,
            ruleVersion: 1,
            timingProfileId: TIMING_ID,
            serviceTermsHash: SERVICE_HASH,
            acceptDeadline: nowAtSetup + 1 days,
            claimDeadline: nowAtSetup + 3 days,
            responseDeadline: nowAtSetup + 4 days,
            evidenceDeadline: nowAtSetup + 5 days,
            primaryDeadline: nowAtSetup + 6 days,
            challengeDeadline: nowAtSetup + 9 days,
            fallbackDeadline: nowAtSetup + 16 days,
            exitNoticeDeadline: nowAtSetup + 19 days
        });
    }
}
