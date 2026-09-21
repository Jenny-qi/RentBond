// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";
import {RentBondTestBase, TestActor} from "./TestHelpers.sol";

contract ResolverRegistryTest is RentBondTestBase {
    ResolverRegistry private registry;
    MockUSD private token;
    TestActor private primary;
    TestActor private fallbackResolver;
    TestActor private stranger;
    IResolverRegistry.ServiceProfile private profile;

    function setUp() public {
        registry = new ResolverRegistry();
        token = new MockUSD(address(this));
        primary = new TestActor();
        fallbackResolver = new TestActor();
        stranger = new TestActor();
        profile = _profile(registry, address(primary), address(fallbackResolver), address(token), DEPOSIT);
    }

    function testDeterministicProfileNeedsBothResolverAcceptances() public {
        registry.createProfile(profile);

        require(!registry.isProfileAccepted(profile.profileId), "accepted before signatures");
        require(!_eligible(DEPOSIT), "eligible before signatures");

        primary.execute(address(registry), abi.encodeCall(registry.acceptProfile, (profile.profileId)));
        require(!_eligible(DEPOSIT), "one signature was enough");

        fallbackResolver.execute(address(registry), abi.encodeCall(registry.acceptProfile, (profile.profileId)));
        require(registry.isProfileAccepted(profile.profileId), "both signatures missing");
        require(_eligible(DEPOSIT), "accepted profile not eligible");
    }

    function testTamperedProfileIdIsRejected() public {
        profile.maxDeposit = DEPOSIT - 1e6;
        require(!_tryCreate(profile), "profile content changed without changing id");
    }

    function testTimingHashBindsDurationsAndTimeoutPolicy() public {
        profile.timing.claim = 2 days;
        profile.profileId = registry.computeProfileId(profile);
        require(!_tryCreate(profile), "unbound timing accepted");

        profile = _profile(registry, address(primary), address(fallbackResolver), address(token), DEPOSIT);
        profile.timeoutPolicy = keccak256("landlord-wins-on-timeout");
        profile.timingProfileId = registry.computeTimingProfileId(profile.timing, profile.timeoutPolicy);
        profile.profileId = registry.computeProfileId(profile);
        require(!_tryCreate(profile), "unsafe timeout policy accepted");
    }

    function testOnlyNamedResolversCanAcceptOrRevoke() public {
        registry.createProfile(profile);
        require(
            !stranger.tryExecute(address(registry), abi.encodeCall(registry.acceptProfile, (profile.profileId))),
            "stranger accepted"
        );
        require(
            !stranger.tryExecute(address(registry), abi.encodeCall(registry.revokeForNewFunding, (profile.profileId))),
            "stranger revoked"
        );
    }

    function testEitherResolverCanCloseNewFunding() public {
        registry.createProfile(profile);
        _acceptProfile(registry, profile.profileId, primary, fallbackResolver);
        require(_eligible(DEPOSIT), "profile should be eligible");

        fallbackResolver.execute(address(registry), abi.encodeCall(registry.revokeForNewFunding, (profile.profileId)));
        require(!_eligible(DEPOSIT), "closed profile remains eligible");
    }

    function testEligibilityEnforcesBoundsAndBusinessStep() public {
        registry.createProfile(profile);
        _acceptProfile(registry, profile.profileId, primary, fallbackResolver);

        require(!_eligible(DEPOSIT + 1e6), "over-limit deposit accepted");
        require(!_eligible(DEPOSIT - 1), "sub-cent amount accepted");

        IResolverRegistry.EligibilityTerms memory terms = _terms(DEPOSIT);
        terms.token = address(0x9999);
        require(!registry.isEligible(profile.profileId, terms), "wrong token accepted");

        terms = _terms(DEPOSIT);
        terms.serviceTermsHash = keccak256("other-service");
        require(!registry.isEligible(profile.profileId, terms), "wrong service accepted");
    }

    function testResolversAndTimingMustBeValid() public {
        profile.fallbackResolver = profile.primaryResolver;
        profile.profileId = registry.computeProfileId(profile);
        require(!_tryCreate(profile), "same resolver accepted twice");

        profile = _profile(registry, address(primary), address(fallbackResolver), address(token), DEPOSIT);
        profile.timing.fallbackEvidence = profile.timing.fallbackResolver;
        profile.timingProfileId = registry.computeTimingProfileId(profile.timing, profile.timeoutPolicy);
        profile.profileId = registry.computeProfileId(profile);
        require(!_tryCreate(profile), "invalid fallback window accepted");
    }

    function _terms(uint256 amount) private view returns (IResolverRegistry.EligibilityTerms memory terms) {
        terms = IResolverRegistry.EligibilityTerms({
            token: address(token),
            depositAmount: amount,
            leaseEndAt: block.timestamp + 30 days,
            ruleVersion: profile.ruleVersion,
            timingProfileId: profile.timingProfileId,
            serviceTermsHash: profile.serviceTermsHash
        });
    }

    function _eligible(uint256 amount) private view returns (bool) {
        return registry.isEligible(profile.profileId, _terms(amount));
    }

    function _tryCreate(IResolverRegistry.ServiceProfile memory candidate) private returns (bool success) {
        try registry.createProfile(candidate) {
            return true;
        } catch {
            return false;
        }
    }
}
