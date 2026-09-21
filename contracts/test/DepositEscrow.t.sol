// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {RentBondTestBase, TestActor} from "./TestHelpers.sol";

contract DepositEscrowTest is RentBondTestBase {
    function testExactFundingCreatesActiveEscrow() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);

        require(uint256(fixture.escrow.phase()) == uint256(DepositEscrow.Phase.Active), "not active");
        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.fundedAmount == DEPOSIT, "funded mismatch");
        require(accounting.unallocated == DEPOSIT, "unallocated mismatch");
        require(fixture.token.balanceOf(address(fixture.escrow)) == DEPOSIT, "token mismatch");
        require(
            !fixture.tenant.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT))),
            "second funding succeeded"
        );
        require(fixture.token.balanceOf(address(fixture.escrow)) == DEPOSIT, "second funding changed balance");
    }

    function testWrongAmountAndWrongCallerCannotFund() public {
        EscrowFixture memory fixture = _newEscrow();
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH)));
        fixture.tenant
            .execute(address(fixture.token), abi.encodeCall(fixture.token.approve, (address(fixture.escrow), DEPOSIT)));

        require(
            !fixture.tenant.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT - 1))),
            "wrong amount funded"
        );
        TestActor stranger = new TestActor();
        require(
            !stranger.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT))),
            "stranger funded"
        );
    }

    function testRevokedServiceCannotTakeTenantFunds() public {
        EscrowFixture memory fixture = _newEscrow();
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.acceptTerms, (TERMS_HASH)));
        fixture.tenant
            .execute(address(fixture.token), abi.encodeCall(fixture.token.approve, (address(fixture.escrow), DEPOSIT)));
        fixture.primary
            .execute(
                address(fixture.registry), abi.encodeCall(fixture.registry.revokeForNewFunding, (fixture.profileId))
            );

        require(
            !fixture.tenant.tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.fund, (DEPOSIT))),
            "revoked service funded"
        );
        require(fixture.token.balanceOf(address(fixture.escrow)) == 0, "funds moved before eligibility check");
    }

    function testFundingRejectsTamperedResolverSnapshot() public {
        EscrowFixture memory fixture = _newEscrow();
        DepositEscrow.Terms memory terms = fixture.escrow.getTerms();
        terms.leaseId = keccak256("tampered-resolver-lease");
        terms.primaryResolver = address(new TestActor());
        DepositEscrow tamperedEscrow = new DepositEscrow(terms, address(this));

        fixture.tenant.execute(address(tamperedEscrow), abi.encodeCall(tamperedEscrow.acceptTerms, (TERMS_HASH)));
        fixture.tenant
            .execute(address(fixture.token), abi.encodeCall(fixture.token.approve, (address(tamperedEscrow), DEPOSIT)));
        require(
            !fixture.tenant.tryExecute(address(tamperedEscrow), abi.encodeCall(tamperedEscrow.fund, (DEPOSIT))),
            "tampered resolver snapshot funded"
        );
        require(fixture.token.balanceOf(address(tamperedEscrow)) == 0, "tampered escrow moved funds");
    }

    function testClaimsCloseTo700100200() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.SettlementSchedule memory schedule = _startScheduledSettlement(fixture);
        _submitDemoClaims(fixture);
        _closeDemoClaims(fixture, schedule);

        DepositEscrow.Accounting memory afterClose = fixture.escrow.getAccounting();
        require(afterClose.tenantCredit == 700e6, "tenant 700 missing");
        require(afterClose.landlordCredit == 0, "landlord allocated early");
        require(afterClose.unallocated == 300e6, "claim balance mismatch");

        _respondClaim(fixture, 1, true, keccak256("accepted-cleaning"));
        DepositEscrow.Accounting memory afterResponse = fixture.escrow.getAccounting();
        require(afterResponse.tenantCredit == 700e6, "tenant changed");
        require(afterResponse.landlordCredit == 100e6, "landlord 100 missing");
        require(afterResponse.unallocated == 200e6, "dispute not isolated");

        vm.warp(schedule.responseDeadline);
        fixture.escrow.openClaimCase();
        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        require(activeCase.exists, "case missing");
        require(activeCase.caseType == DepositEscrow.CaseType.Claims, "wrong case type");
        require(activeCase.disputedAmount == 200e6, "case amount mismatch");
    }

    function testPrimaryDecisionSplitsOnlyRemainingDispute() public {
        (EscrowFixture memory fixture, DepositEscrow.SettlementSchedule memory schedule) = _openDemoClaimCase();
        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        vm.warp(schedule.evidenceDeadline);

        DepositEscrow.DecisionInput[] memory result = new DepositEscrow.DecisionInput[](1);
        result[0] = DepositEscrow.DecisionInput({claimId: 2, landlordAmount: 50e6});
        fixture.primary
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeDecision, (activeCase.caseId, result, keccak256("primary-reasons"))
                )
            );

        activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.challengeDeadline);
        fixture.escrow.finalizePrimary(activeCase.caseId);

        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 850e6, "tenant split mismatch");
        require(accounting.landlordCredit == 150e6, "landlord split mismatch");
        require(accounting.unallocated == 0, "funds remain locked");
    }

    function testDecisionVectorRequiresCanonicalClaimsAndCentStep() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.SettlementSchedule memory schedule = _startScheduledSettlement(fixture);
        _submitDemoClaims(fixture);
        _closeDemoClaims(fixture, schedule);
        vm.warp(schedule.responseDeadline);
        fixture.escrow.openClaimCase();
        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.evidenceDeadline);

        DepositEscrow.DecisionInput[] memory reversed = new DepositEscrow.DecisionInput[](2);
        reversed[0] = DepositEscrow.DecisionInput(2, 50e6);
        reversed[1] = DepositEscrow.DecisionInput(1, 50e6);
        require(
            !fixture.primary
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(fixture.escrow.proposeDecision, (activeCase.caseId, reversed, keccak256("reversed")))
                ),
            "reordered claims accepted"
        );

        DepositEscrow.DecisionInput[] memory fractional = new DepositEscrow.DecisionInput[](2);
        fractional[0] = DepositEscrow.DecisionInput(1, 50e6 + 1);
        fractional[1] = DepositEscrow.DecisionInput(2, 50e6);
        require(
            !fixture.primary
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(
                        fixture.escrow.proposeDecision, (activeCase.caseId, fractional, keccak256("fractional"))
                    )
                ),
            "fractional result accepted"
        );
    }

    function testCheckoutDisagreementCreatesResolvableCase() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        bytes32 evidenceHash = keccak256("checkout-condition");
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.requestCheckout, (evidenceHash)));
        fixture.landlord
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.respondCheckout, (false, evidenceHash)));
        fixture.escrow.openCheckoutCase();

        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        require(activeCase.caseType == DepositEscrow.CaseType.Checkout, "checkout case missing");
        vm.warp(activeCase.evidenceDeadline);
        fixture.primary
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeCheckoutDecision, (activeCase.caseId, true, keccak256("handover-valid"))
                )
            );
        activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.challengeDeadline);
        fixture.escrow.finalizePrimary(activeCase.caseId);

        DepositEscrow.SettlementSchedule memory schedule = fixture.escrow.getSettlementSchedule();
        require(schedule.started, "early settlement not started");
        require(schedule.startedAt < fixture.escrow.getTerms().leaseEndAt, "early checkout did not rebase deadlines");
        require(uint256(fixture.escrow.phase()) == uint256(DepositEscrow.Phase.ClaimsOpen), "claims did not open");
    }

    function testMutualCheckoutStartsClaimsAtConfirmationTime() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        bytes32 evidenceHash = keccak256("agreed-checkout");
        fixture.tenant.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.requestCheckout, (evidenceHash)));
        uint256 confirmedAt = block.timestamp;
        fixture.landlord
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.respondCheckout, (true, evidenceHash)));

        DepositEscrow.SettlementSchedule memory schedule = fixture.escrow.getSettlementSchedule();
        require(schedule.startedAt == confirmedAt, "wrong early start");
        require(
            schedule.claimDeadline == confirmedAt + uint256(fixture.escrow.getTerms().timing.claim),
            "claim window not rebased"
        );
    }

    function testCheckoutPrimaryTimeoutUsesFallbackResolver() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        fixture.tenant
            .execute(
                address(fixture.escrow), abi.encodeCall(fixture.escrow.requestCheckout, (keccak256("checkout-timeout")))
            );
        DepositEscrow.CheckoutRequest memory checkout = fixture.escrow.getCheckout();
        vm.warp(checkout.responseDeadline);
        fixture.escrow.openCheckoutCase();

        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.primaryDeadline);
        fixture.escrow.escalateTimeout(activeCase.caseId);
        activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.fallbackStartAt + uint256(fixture.escrow.getTerms().timing.fallbackEvidence));
        fixture.fallbackResolver
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.resolveFallbackCheckout, (activeCase.caseId, false, keccak256("not-ended"))
                )
            );

        checkout = fixture.escrow.getCheckout();
        require(checkout.resolved && !checkout.agreed, "fallback not applied");
        require(uint256(fixture.escrow.phase()) == uint256(DepositEscrow.Phase.Active), "lease did not resume");
    }

    function testServiceTimeoutReturnsUnawardedDisputeToTenant() public {
        (EscrowFixture memory fixture, DepositEscrow.SettlementSchedule memory schedule) = _openDemoClaimCase();
        schedule;
        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();

        fixture.escrow.withdrawFor(address(fixture.tenant));
        fixture.escrow.withdrawFor(address(fixture.landlord));
        require(fixture.token.balanceOf(address(fixture.tenant)) == 700e6, "undisputed tenant funds unavailable");
        require(fixture.token.balanceOf(address(fixture.landlord)) == 100e6, "accepted landlord funds unavailable");

        vm.warp(activeCase.primaryDeadline);
        fixture.escrow.escalateTimeout(activeCase.caseId);

        activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.fallbackDeadline);
        fixture.escrow.markServiceTimeout(activeCase.caseId);
        activeCase = fixture.escrow.getActiveCase();
        require(activeCase.phase == DepositEscrow.CasePhase.ExitPending, "exit notice missing");
        vm.warp(activeCase.timeoutAt);
        fixture.escrow.finalizeTimeout(activeCase.caseId);

        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 200e6, "tenant timeout mismatch");
        require(accounting.landlordCredit == 0, "landlord paid twice");
        require(accounting.tenantWithdrawn == 700e6, "tenant history lost");
        require(accounting.landlordWithdrawn == 100e6, "landlord history lost");
        require(accounting.unallocated == 0, "timeout left funds locked");
    }

    function testChallengeIrrevocablyMovesCaseToFallback() public {
        (EscrowFixture memory fixture, DepositEscrow.SettlementSchedule memory schedule) = _openDemoClaimCase();
        schedule;
        DepositEscrow.ActiveCase memory activeCase = fixture.escrow.getActiveCase();
        vm.warp(activeCase.evidenceDeadline);
        DepositEscrow.DecisionInput[] memory primaryResult = new DepositEscrow.DecisionInput[](1);
        primaryResult[0] = DepositEscrow.DecisionInput(2, 50e6);
        fixture.primary
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeDecision, (activeCase.caseId, primaryResult, keccak256("challenged-primary"))
                )
            );
        fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.challenge, (activeCase.caseId, keccak256("challenge-reason")))
            );
        require(fixture.escrow.getActiveCase().decisionHash == bytes32(0), "challenged decision remained active");
        require(
            fixture.escrow.getActiveCase().challengeCommitment == keccak256("challenge-reason"),
            "challenge reason was not recorded"
        );
        require(
            !fixture.landlord
                .tryExecute(
                    address(fixture.escrow), abi.encodeCall(fixture.escrow.finalizePrimary, (activeCase.caseId))
                ),
            "challenged primary finalized"
        );

        activeCase = fixture.escrow.getActiveCase();
        DepositEscrow.DecisionInput[] memory fallbackResult = new DepositEscrow.DecisionInput[](1);
        fallbackResult[0] = DepositEscrow.DecisionInput(2, 0);
        require(
            !fixture.fallbackResolver
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(
                        fixture.escrow.resolveFallback, (activeCase.caseId, fallbackResult, keccak256("too-early"))
                    )
                ),
            "fallback skipped evidence window"
        );
        vm.warp(activeCase.fallbackStartAt + uint256(fixture.escrow.getTerms().timing.fallbackEvidence));
        fixture.fallbackResolver
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.resolveFallback, (activeCase.caseId, fallbackResult, keccak256("fallback-final"))
                )
            );
        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 900e6, "fallback tenant mismatch");
        require(accounting.landlordCredit == 100e6, "primary result revived");
    }

    function testLandlordCanWaiveUnallocatedClaimAfterClose() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.SettlementSchedule memory schedule = _startScheduledSettlement(fixture);
        _submitDemoClaims(fixture);
        _closeDemoClaims(fixture, schedule);
        fixture.landlord.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.waiveClaim, (2)));
        _respondClaim(fixture, 1, true, keccak256("accepted-cleaning"));

        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 900e6, "waiver not returned");
        require(accounting.landlordCredit == 100e6, "accepted claim missing");
        require(accounting.unallocated == 0, "waiver remains locked");
    }

    function testEvidenceVersionsCannotOverwriteHistory() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        bytes32 bundleId = keccak256("inspection-bundle");
        bytes32 first = keccak256("version-one");
        bytes32 second = keccak256("version-two");
        fixture.tenant
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.recordEvidence, (bundleId, 1, first)));
        fixture.tenant
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.recordEvidence, (bundleId, 2, second)));
        fixture.landlord
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.acknowledgeEvidence, (address(fixture.tenant), 1, bundleId, first, true))
            );
        require(
            !fixture.tenant
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(fixture.escrow.recordEvidence, (bundleId, 2, keccak256("overwrite")))
                ),
            "same evidence version overwritten"
        );
        require(
            !fixture.landlord
                .tryExecute(
                    address(fixture.escrow),
                    abi.encodeCall(
                        fixture.escrow.acknowledgeEvidence, (address(fixture.tenant), 3, bundleId, second, false)
                    )
                ),
            "nonexistent evidence acknowledged"
        );

        DepositEscrow.EvidenceRecord memory v1 = fixture.escrow.getEvidence(address(fixture.tenant), bundleId, 1);
        DepositEscrow.EvidenceRecord memory v2 = fixture.escrow.getEvidence(address(fixture.tenant), bundleId, 2);
        require(v1.commitment == first && v1.acknowledged, "v1 overwritten");
        require(v2.commitment == second && !v2.acknowledged, "v2 corrupted");
        require(
            fixture.escrow.getLatestEvidenceVersion(address(fixture.tenant), bundleId) == 2, "latest version mismatch"
        );
    }

    function testStateChangeInvalidatesPendingSettlement() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        bytes memory result = fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeSettlement,
                    (800e6, 200e6, accounting.revision, block.timestamp + 1 days, keccak256("mutual-split"))
                )
            );
        uint256 proposalId = abi.decode(result, (uint256));
        require(proposalId != 0, "proposal missing");

        fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(fixture.escrow.requestCheckout, (keccak256("new-checkout-state")))
            );
        require(fixture.escrow.getSettlementProposal().proposalId == 0, "stale proposal survived");
        require(
            !fixture.landlord
                .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.confirmSettlement, (proposalId))),
            "stale proposal confirmed"
        );
    }

    function testMutualSettlementNeedsOtherParticipantConfirmation() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        bytes memory result = fixture.tenant
            .execute(
                address(fixture.escrow),
                abi.encodeCall(
                    fixture.escrow.proposeSettlement,
                    (800e6, 200e6, accounting.revision, block.timestamp + 1 days, keccak256("settlement"))
                )
            );
        uint256 proposalId = abi.decode(result, (uint256));
        require(
            !fixture.tenant
                .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.confirmSettlement, (proposalId))),
            "proposer self-confirmed"
        );
        fixture.landlord
            .execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.confirmSettlement, (proposalId)));

        accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == 800e6, "tenant settlement mismatch");
        require(accounting.landlordCredit == 200e6, "landlord settlement mismatch");
    }

    function testHardEndAndPublicWithdrawalCannotRedirectFunds() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        DepositEscrow.Terms memory terms = fixture.escrow.getTerms();
        vm.warp(terms.hardEndAt);
        fixture.escrow.expireEscrow();
        fixture.escrow.expireEscrow();

        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.tenantCredit == DEPOSIT, "hard-end return missing");
        require(accounting.unallocated == 0, "hard-end funds locked");

        TestActor stranger = new TestActor();
        require(
            !stranger.tryExecute(
                address(fixture.escrow), abi.encodeCall(fixture.escrow.withdrawFor, (address(stranger)))
            ),
            "stranger became beneficiary"
        );
        stranger.execute(address(fixture.escrow), abi.encodeCall(fixture.escrow.withdrawFor, (address(fixture.tenant))));
        require(fixture.token.balanceOf(address(fixture.tenant)) == DEPOSIT, "public executor redirected payout");
        fixture.escrow.withdrawFor(address(fixture.tenant));
    }

    function testDirectExtraTokenTransferNeverChangesRegisteredDeposit() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        fixture.token.mint(address(this), 1e6);
        fixture.token.transfer(address(fixture.escrow), 1e6);

        DepositEscrow.Accounting memory accounting = fixture.escrow.getAccounting();
        require(accounting.fundedAmount == DEPOSIT, "funded amount inflated");
        require(accounting.unallocated == DEPOSIT, "accounting inflated");

        vm.warp(fixture.escrow.getTerms().hardEndAt);
        fixture.escrow.expireEscrow();
        fixture.escrow.withdrawFor(address(fixture.tenant));
        require(fixture.token.balanceOf(address(fixture.escrow)) == 1e6, "extra token became withdrawable deposit");
    }

    function testFundedEscrowKeepsSnapshotAfterProfileRevocation() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        fixture.primary
            .execute(
                address(fixture.registry), abi.encodeCall(fixture.registry.revokeForNewFunding, (fixture.profileId))
            );

        DepositEscrow.SettlementSchedule memory schedule = _startScheduledSettlement(fixture);
        vm.warp(schedule.claimDeadline);
        fixture.escrow.closeClaims();
        require(fixture.escrow.getAccounting().tenantCredit == DEPOSIT, "funded lease changed after revocation");
    }

    function testClaimCountAndAmountsAreBounded() public {
        EscrowFixture memory fixture = _newEscrow();
        _fund(fixture);
        _startScheduledSettlement(fixture);

        DepositEscrow.ClaimInput[] memory tooMany = new DepositEscrow.ClaimInput[](11);
        for (uint256 i = 0; i < tooMany.length; i++) {
            tooMany[i] = DepositEscrow.ClaimInput({amount: 1e6, commitment: keccak256(abi.encode(i))});
        }
        require(
            !fixture.landlord
            .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (tooMany))),
            "more than ten claims accepted"
        );

        DepositEscrow.ClaimInput[] memory fractional = new DepositEscrow.ClaimInput[](1);
        fractional[0] = DepositEscrow.ClaimInput({amount: 1e6 + 1, commitment: keccak256("fractional-claim")});
        require(
            !fixture.landlord
                .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (fractional))),
            "fractional claim accepted"
        );

        DepositEscrow.ClaimInput[] memory overDeposit = new DepositEscrow.ClaimInput[](2);
        overDeposit[0] = DepositEscrow.ClaimInput({amount: 600e6, commitment: keccak256("over-one")});
        overDeposit[1] = DepositEscrow.ClaimInput({amount: 500e6, commitment: keccak256("over-two")});
        require(
            !fixture.landlord
                .tryExecute(address(fixture.escrow), abi.encodeCall(fixture.escrow.submitClaims, (overDeposit))),
            "claims over deposit accepted"
        );
        require(fixture.escrow.getClaimCount() == 0, "partial claim list saved");
    }

    function _openDemoClaimCase()
        private
        returns (EscrowFixture memory fixture, DepositEscrow.SettlementSchedule memory schedule)
    {
        fixture = _newEscrow();
        _fund(fixture);
        schedule = _startScheduledSettlement(fixture);
        _submitDemoClaims(fixture);
        _closeDemoClaims(fixture, schedule);
        _respondClaim(fixture, 1, true, keccak256("accepted-cleaning"));
        vm.warp(schedule.responseDeadline);
        fixture.escrow.openClaimCase();
    }
}
