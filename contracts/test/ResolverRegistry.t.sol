// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";

contract ResolverCaller {
    ResolverRegistry internal immutable registry;

    constructor(ResolverRegistry registry_) {
        registry = registry_;
    }

    function accept(bytes32 profileId) external {
        registry.acceptProfile(profileId);
    }

    function revoke(bytes32 profileId) external {
        registry.revokeForNewFunding(profileId);
    }

    function tryAccept(bytes32 profileId) external returns (bool) {
        try registry.acceptProfile(profileId) {
            return true;
        } catch {
            return false;
        }
    }

    function tryRevoke(bytes32 profileId) external returns (bool) {
        try registry.revokeForNewFunding(profileId) {
            return true;
        } catch {
            return false;
        }
    }
}

contract ResolverRegistryTest {
    ResolverRegistry private registry;
    ResolverCaller private primary;
    ResolverCaller private fallbackResolver;
    ResolverCaller private stranger;

    bytes32 private constant PROFILE_ID = keccak256("rentbond-profile-1");
    bytes32 private constant SERVICE_HASH = keccak256("rentbond-service-v1");
    bytes32 private constant TIMING_ID = keccak256("normal");
    address private constant TOKEN = address(0x1234);

    function setUp() public {
        registry = new ResolverRegistry();
        primary = new ResolverCaller(registry);
        fallbackResolver = new ResolverCaller(registry);
        stranger = new ResolverCaller(registry);
    }

    function testCreateAndAcceptMakesProfileEligible() public {
        setUp();
        registry.createProfile(_profile());

        require(!registry.isProfileAccepted(PROFILE_ID), "accepted too early");
        require(!_eligible(), "eligible before both accepts");

        primary.accept(PROFILE_ID);
        require(!_eligible(), "eligible after one accept");

        fallbackResolver.accept(PROFILE_ID);
        require(registry.isProfileAccepted(PROFILE_ID), "not accepted");
        require(_eligible(), "eligible after both accepts");
    }

    function testOnlyListedResolversCanAcceptOrRevoke() public {
        setUp();
        registry.createProfile(_profile());

        require(!stranger.tryAccept(PROFILE_ID), "stranger accepted");
        require(!stranger.tryRevoke(PROFILE_ID), "stranger revoked");
    }

    function testEitherResolverCanCloseTheWholeProfile() public {
        setUp();
        registry.createProfile(_profile());
        primary.accept(PROFILE_ID);
        fallbackResolver.accept(PROFILE_ID);
        require(_eligible(), "profile should be eligible");

        fallbackResolver.revoke(PROFILE_ID);
        require(!_eligible(), "revoked profile remains eligible");
    }

    function testEligibilityRejectsWrongScope() public {
        setUp();
        registry.createProfile(_profile());
        primary.accept(PROFILE_ID);
        fallbackResolver.accept(PROFILE_ID);

        IResolverRegistry.EligibilityTerms memory terms = _terms();

        terms.token = address(0x9999);
        require(!registry.isEligible(PROFILE_ID, terms), "wrong token accepted");

        terms = _terms();
        terms.depositAmount = 1001e6;
        require(!registry.isEligible(PROFILE_ID, terms), "excess deposit accepted");

        terms = _terms();
        terms.serviceTermsHash = keccak256("wrong-service");
        require(!registry.isEligible(PROFILE_ID, terms), "wrong service accepted");

        terms = _terms();
        terms.ruleVersion = 2;
        require(!registry.isEligible(PROFILE_ID, terms), "wrong rule accepted");

        terms = _terms();
        terms.timingProfileId = keccak256("short-demo");
        require(!registry.isEligible(PROFILE_ID, terms), "wrong timing accepted");
    }

    function testRepeatedAcceptIsRejected() public {
        setUp();
        registry.createProfile(_profile());
        primary.accept(PROFILE_ID);
        require(!primary.tryAccept(PROFILE_ID), "duplicate accepted");
    }

    function _eligible() private view returns (bool) {
        return registry.isEligible(PROFILE_ID, _terms());
    }

    function _terms()
        private
        pure
        returns (IResolverRegistry.EligibilityTerms memory terms)
    {
        terms = IResolverRegistry.EligibilityTerms({
            token: TOKEN,
            depositAmount: 100e6,
            leaseEndAt: type(uint256).max,
            ruleVersion: 1,
            timingProfileId: TIMING_ID,
            serviceTermsHash: SERVICE_HASH
        });
    }

    function _profile()
        private
        view
        returns (IResolverRegistry.ServiceProfile memory profile)
    {
        profile = IResolverRegistry.ServiceProfile({
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
        });
    }
}
