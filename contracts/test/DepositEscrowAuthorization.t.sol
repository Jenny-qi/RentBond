// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {RentBondTestBase, TestActor} from "./TestHelpers.sol";

contract DepositEscrowAuthorizationTest is RentBondTestBase {
    function testOnlyTenantCanAcceptAndFund() public {
        EscrowFixture memory fixture = _newEscrow();
        TestActor stranger = new TestActor();

        require(
            !fixture.landlord
                .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH))),
            "landlord accepted tenant terms"
        );
        require(
            !stranger.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH))),
            "stranger accepted terms"
        );

        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH)));
        fixture.tenant
            .execute(address(fixture.token), abi.encodeCall(fixture.token.approve, (address(fixture.escrow), DEPOSIT)));
        require(
            !fixture.landlord.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT))),
            "landlord funded tenant escrow"
        );
        require(
            !stranger.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT))),
            "stranger funded tenant escrow"
        );

        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT)));
        require(uint256(fixture.escrow.phase()) == uint256(DepositEscrow.Phase.Active), "tenant funding failed");
    }

    function testClaimsResponsesAndWaiversUseFixedParticipants() public {
        EscrowFixture memory fixture = _newEscrow();
        TestActor stranger = new TestActor();
        _fund(fixture);
        _startScheduledSettlement(fixture);

        DepositEscrow.ClaimInput[] memory claims = _claims();
        require(
            !fixture.tenant.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (claims))),
            "tenant submitted landlord claims"
        );
        require(
            !stranger.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (claims))),
            "stranger submitted claims"
        );
        fixture.landlord.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (claims)));

        require(
            !fixture.landlord
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(fixture.escrow.respondClaim, (1, true, keccak256("invalid-landlord-response")))
                ),
            "landlord responded as tenant"
        );
        require(
            !stranger.tryExecute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.respondClaim, (1, true, keccak256("invalid-stranger-response")))
            ),
            "stranger responded to claim"
        );
        fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.respondClaim, (1, false, keccak256("tenant-disputes")))
            );

        require(
            !fixture.tenant.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.waiveClaim, (2))),
            "tenant waived landlord claim"
        );
        require(
            !stranger.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.waiveClaim, (2))),
            "stranger waived claim"
        );
        fixture.landlord.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.waiveClaim, (2)));
    }

    function testOnlyConfiguredResolversCanDecideAndStrangerCannotChallenge() public {
        (EscrowFixture memory fixture, DepositEscrow.ActiveCase memory activeCase) = _openClaimCase();
        TestActor stranger = new TestActor();
        vm.warp(activeCase.evidenceDeadline);

        DepositEscrow.DecisionInput[] memory result = new DepositEscrow.DecisionInput[](1);
        result[0] = DepositEscrow.DecisionInput({claimId: 2, landlordAmount: 50e6});
        require(
            !fixture.fallbackResolver
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(
                        fixture.escrow.proposeDecision, (activeCase.caseId, result, keccak256("wrong-resolver"))
                    )
                ),
            "fallback acted as primary"
        );
        require(
            !stranger.tryExecute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.proposeDecision, (activeCase.caseId, result, keccak256("stranger")))
            ),
            "stranger proposed decision"
        );
        fixture.primary
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.proposeDecision, (activeCase.caseId, result, keccak256("primary")))
            );

        require(
            !stranger.tryExecute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.challenge, (activeCase.caseId, keccak256("stranger-challenge")))
            ),
            "stranger challenged decision"
        );
        fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.challenge, (activeCase.caseId, keccak256("tenant-challenge")))
            );

        activeCase = fixture.escrow.getActiveCase();
        require(
            !fixture.primary
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(
                        fixture.escrow.resolveFallback, (activeCase.caseId, result, keccak256("wrong-fallback"))
                    )
                ),
            "primary acted as fallback"
        );
        vm.warp(activeCase.fallbackStartAt + uint256(fixture.escrow.getTerms().timing.fallbackEvidence));
        fixture.fallbackResolver
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.resolveFallback, (activeCase.caseId, result, keccak256("fallback")))
            );
    }

    function testStrangerCannotConfirmParticipantSettlement() public {
        EscrowFixture memory fixture = _newEscrow();
        TestActor stranger = new TestActor();
        _fund(fixture);
        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();

        bytes memory encodedProposalId = fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeSettlement,
                    (800e6, 200e6, accounting.revision, block.timestamp + 1 days, keccak256("participant-only"))
                )
            );
        uint256 proposalId = abi.decode(encodedProposalId, (uint256));
        require(
            !stranger.tryExecute(
                address(fixture.escrow), abi.encodeCall(fixture.escrow.confirmSettlement, (proposalId))
            ),
            "stranger confirmed settlement"
        );

        fixture.landlord
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.confirmSettlement, (proposalId)));
        accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 800e6, "tenant settlement missing");
        require(accounting.landlordCredit == 200e6, "landlord settlement missing");
        require(accounting.unallocated == 0, "settlement left funds unallocated");
    }

    function _claims() private pure returns (DepositEscrow.ClaimInput[] memory claims) {
        claims = new DepositEscrow.ClaimInput[](2);
        claims[0] = DepositEscrow.ClaimInput({amount: 100e6, commitment: keccak256("cleaning")});
        claims[1] = DepositEscrow.ClaimInput({amount: 200e6, commitment: keccak256("desk")});
    }

    function _openClaimCase()
        private
        returns (EscrowFixture memory fixture, DepositEscrow.ActiveCase memory activeCase)
    {
        fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.SettlementSchedule memory schedule = _startScheduledSettlement(fixture);
        _submitDemoClaims(fixture);
        _closeDemoClaims(fixture, schedule);
        _respondClaim(fixture, 1, true, keccak256("accepted-cleaning"));
        vm.warp(schedule.responseDeadline);
        fixture.escrow.openClaimCase();
        activeCase = fixture.escrow.getActiveCase();
    }
}
