// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";
import {ReentrancyGuard} from "../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title DepositEscrow
/// @notice Per-lease escrow for acceptance, exact funding and deterministic
///         claims/dispute settlement.
contract DepositEscrow is ReentrancyGuard {
    enum Phase {
        AwaitingAcceptance,
        AwaitingFunding,
        Active,
        ClaimsOpen,
        ClaimsReview,
        ClaimCase,
        Cancelled,
        Allocated,
        Closed
    }

    enum ClaimStatus {
        Pending,
        Accepted,
        Disputed,
        Waived,
        Allocated
    }

    enum CasePhase {
        None,
        Primary,
        Proposed,
        Fallback,
        ExitPending,
        Finalized
    }

    struct Terms {
        bytes32 leaseId;
        address tenant;
        address landlord;
        address primaryResolver;
        address fallbackResolver;
        address token;
        uint256 depositAmount;
        uint256 leaseEndAt;
        uint256 hardEndAt;
        bytes32 timeoutPolicy;
        bytes32 termsHash;
        uint256 ruleVersion;
        bytes32 timingProfileId;
        bytes32 serviceProfileId;
        bytes32 serviceTermsHash;
        address registryAddress;
        uint256 acceptDeadline;
        uint256 claimDeadline;
        uint256 responseDeadline;
        uint256 evidenceDeadline;
        uint256 primaryDeadline;
        uint256 challengeDeadline;
        uint256 fallbackDeadline;
        uint256 exitNoticeDeadline;
    }

    struct Accounting {
        uint256 fundedAmount;
        uint256 unallocated;
        uint256 tenantCredit;
        uint256 landlordCredit;
        uint256 tenantWithdrawn;
        uint256 landlordWithdrawn;
        uint256 revision;
    }

    struct ClaimInput {
        uint256 amount;
        bytes32 commitment;
    }

    struct Claim {
        uint256 id;
        uint256 amount;
        bytes32 commitment;
        bytes32 responseCommitment;
        ClaimStatus status;
        uint256 landlordAllocated;
        uint256 tenantAllocated;
    }

    struct ActiveCase {
        uint256 caseId;
        uint256 openedAt;
        uint256 disputedAmount;
        uint256 evidenceDeadline;
        uint256 primaryDeadline;
        uint256 challengeDeadline;
        uint256 fallbackStartAt;
        uint256 fallbackDeadline;
        uint256 timeoutAt;
        uint256 proposalAt;
        bytes32 proposalHash;
        bytes32 decisionHash;
        CasePhase phase;
        bool exists;
    }

    struct DecisionInput {
        uint256 claimId;
        uint256 landlordAmount;
    }

    struct SettlementProposal {
        uint256 proposalId;
        address proposer;
        uint256 tenantShare;
        uint256 landlordShare;
        uint256 snapshotRevision;
        uint256 validUntil;
        bytes32 detailsHash;
    }

    struct EvidenceRecord {
        address submitter;
        uint256 version;
        bytes32 bundleId;
        bytes32 commitment;
        bool exists;
        bool acknowledged;
        bool agreed;
    }

    struct CheckoutRequest {
        address requester;
        bytes32 evidenceHash;
        uint256 requestedAt;
        uint256 responseDeadline;
        bool exists;
        bool responded;
        bool agreed;
        bool caseOpened;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidTerms();
    error InvalidState();
    error DeadlinePassed();
    error DeadlineNotReached();
    error HashMismatch();
    error AlreadyFunded();
    error AmountMismatch();
    error ServiceNotEligible();
    error ServiceNotAccepted();
    error ServiceRevoked();
    error OutsideServiceScope();
    error TransferFailed();
    error BalanceDeltaMismatch();
    error NothingToWithdraw();
    error TooManyClaims();
    error ClaimsExceedDeposit();
    error ClaimsAlreadySubmitted();
    error ClaimNotFound();
    error ClaimAlreadyFinalized();
    error ClaimResponseClosed();
    error ClaimsNotClosed();
    error CaseAlreadyOpened();
    error NoDisputedBalance();
    error InvalidCommitment();
    error InvalidDecisionVector();
    error ProposalAlreadyExists();
    error ProposalNotFound();
    error StaleProposal();
    error ProposalExpired();
    error InvalidSettlement();
    error CaseNotFound();
    error WrongCasePhase();

    event TermsAccepted(
        bytes32 indexed leaseId,
        address indexed tenant,
        bytes32 termsHash
    );

    event LeaseCancelled(
        bytes32 indexed leaseId,
        address indexed caller,
        bytes32 reason
    );

    event Funded(
        bytes32 indexed leaseId,
        address indexed tenant,
        uint256 amount
    );

    event CreditAllocated(
        bytes32 indexed leaseId,
        address indexed beneficiary,
        uint256 amount,
        bytes32 source
    );

    event Withdrawn(
        bytes32 indexed leaseId,
        address indexed beneficiary,
        address indexed caller,
        uint256 amount
    );

    event ClaimsOpened(bytes32 indexed leaseId, uint256 claimDeadline);

    event ClaimsSubmitted(
        bytes32 indexed leaseId,
        address indexed landlord,
        uint256 claimCount,
        uint256 totalAmount
    );

    event ClaimResponded(
        bytes32 indexed leaseId,
        uint256 indexed claimId,
        bool accepted,
        bytes32 responseCommitment
    );

    event ClaimWaived(bytes32 indexed leaseId, uint256 indexed claimId);

    event ClaimsClosed(
        bytes32 indexed leaseId,
        uint256 unclaimedAmount,
        uint256 acceptedAmount,
        uint256 disputedAmount
    );

    event CaseOpened(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        uint256 disputedAmount
    );

    event DecisionProposed(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        address indexed resolver,
        bytes32 decisionHash,
        uint256 challengeDeadline
    );

    event CaseEscalated(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        address indexed challenger,
        uint256 fallbackDeadline
    );

    event DecisionFinalized(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        bytes32 decisionHash
    );

    event ServiceTimedOut(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        uint256 timeoutAt
    );

    event TimeoutAllocated(
        bytes32 indexed leaseId,
        uint256 indexed caseId,
        uint256 amount
    );

    event EscrowExpired(bytes32 indexed leaseId, uint256 amount);

    event SettlementProposed(
        bytes32 indexed leaseId,
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 tenantShare,
        uint256 landlordShare,
        uint256 snapshotRevision,
        uint256 validUntil,
        bytes32 detailsHash
    );

    event SettlementConfirmed(
        bytes32 indexed leaseId,
        uint256 indexed proposalId,
        uint256 tenantShare,
        uint256 landlordShare
    );

    event EvidenceCommitted(
        bytes32 indexed leaseId,
        address indexed submitter,
        uint256 indexed version,
        bytes32 bundleId,
        bytes32 commitment
    );

    event EvidenceAcknowledged(
        bytes32 indexed leaseId,
        address indexed submitter,
        uint256 indexed version,
        address acknowledger,
        bool agree
    );

    event CheckoutRequested(
        bytes32 indexed leaseId,
        address indexed requester,
        bytes32 evidenceHash,
        uint256 responseDeadline
    );

    event CheckoutResponded(
        bytes32 indexed leaseId,
        address indexed responder,
        bool agree,
        bytes32 evidenceHash
    );

    event CheckoutCaseOpened(bytes32 indexed leaseId, address indexed requester);

    address public immutable factory;
    Terms private _terms;
    Phase public phase;
    bool public tenantAccepted;

    Accounting private _accounting;
    Claim[] private _claims;
    ActiveCase private _activeCase;
    DecisionInput[] private _decisions;
    SettlementProposal private _settlementProposal;
    mapping(address submitter => EvidenceRecord record) private _evidence;
    CheckoutRequest private _checkout;
    bool public claimsSubmitted;
    bool public claimsClosed;
    uint256 public totalClaimAmount;
    uint256 private _caseNonce;
    uint256 private _proposalNonce;

    constructor(Terms memory terms_) {
        if (terms_.leaseId == bytes32(0)) revert InvalidTerms();
        if (terms_.tenant == address(0) || terms_.landlord == address(0)) {
            revert InvalidAddress();
        }
        if (terms_.tenant == terms_.landlord) revert InvalidTerms();
        if (terms_.primaryResolver == address(0)) revert InvalidAddress();
        if (terms_.fallbackResolver == address(0)) revert InvalidAddress();
        if (terms_.primaryResolver == terms_.fallbackResolver) {
            revert InvalidTerms();
        }
        if (terms_.token == address(0) || terms_.registryAddress == address(0)) {
            revert InvalidAddress();
        }
        if (terms_.depositAmount == 0) revert InvalidTerms();
        if (terms_.termsHash == bytes32(0)) revert InvalidTerms();
        if (terms_.serviceProfileId == bytes32(0)) revert InvalidTerms();
        if (terms_.serviceTermsHash == bytes32(0)) revert InvalidTerms();
        if (terms_.acceptDeadline <= block.timestamp) revert InvalidTerms();
        if (terms_.leaseEndAt <= block.timestamp) revert InvalidTerms();
        if (terms_.hardEndAt < terms_.leaseEndAt) revert InvalidTerms();
        if (
            terms_.acceptDeadline >= terms_.leaseEndAt ||
            terms_.claimDeadline <= terms_.leaseEndAt ||
            terms_.responseDeadline <= terms_.claimDeadline ||
            terms_.evidenceDeadline <= terms_.responseDeadline ||
            terms_.primaryDeadline <= terms_.evidenceDeadline ||
            terms_.challengeDeadline <= terms_.primaryDeadline ||
            terms_.fallbackDeadline <= terms_.challengeDeadline ||
            terms_.exitNoticeDeadline <= terms_.fallbackDeadline ||
            terms_.exitNoticeDeadline > terms_.hardEndAt
        ) revert InvalidTerms();

        factory = msg.sender;
        _terms = terms_;
        phase = Phase.AwaitingAcceptance;
    }

    modifier onlyParticipant() {
        if (msg.sender != _terms.tenant && msg.sender != _terms.landlord) {
            revert Unauthorized();
        }
        _;
    }

    function acceptTerms(bytes32 termsHash) external {
        if (msg.sender != _terms.tenant) revert Unauthorized();
        if (phase != Phase.AwaitingAcceptance) revert InvalidState();
        if (block.timestamp >= _terms.acceptDeadline) revert DeadlinePassed();
        if (termsHash != _terms.termsHash) revert HashMismatch();

        tenantAccepted = true;
        phase = Phase.AwaitingFunding;
        emit TermsAccepted(_terms.leaseId, _terms.tenant, termsHash);
    }

    function cancelUnfunded() external onlyParticipant {
        if (
            phase != Phase.AwaitingAcceptance &&
            phase != Phase.AwaitingFunding
        ) revert InvalidState();

        phase = Phase.Cancelled;
        emit LeaseCancelled(_terms.leaseId, msg.sender, keccak256("cancelled"));
    }

    function expireUnfunded() external {
        if (
            phase != Phase.AwaitingAcceptance &&
            phase != Phase.AwaitingFunding
        ) revert InvalidState();
        if (block.timestamp < _terms.acceptDeadline) {
            revert DeadlineNotReached();
        }

        phase = Phase.Cancelled;
        emit LeaseCancelled(_terms.leaseId, msg.sender, keccak256("expired"));
    }

    function fund(uint256 amount) external nonReentrant {
        if (msg.sender != _terms.tenant) revert Unauthorized();
        if (phase == Phase.Active || _accounting.fundedAmount != 0) {
            revert AlreadyFunded();
        }
        if (phase != Phase.AwaitingFunding || !tenantAccepted) {
            revert InvalidState();
        }
        if (block.timestamp >= _terms.acceptDeadline) revert DeadlinePassed();
        if (amount != _terms.depositAmount) revert AmountMismatch();

        IResolverRegistry.EligibilityTerms memory eligibility = IResolverRegistry
            .EligibilityTerms({
                token: _terms.token,
                depositAmount: _terms.depositAmount,
                leaseEndAt: _terms.leaseEndAt,
                ruleVersion: _terms.ruleVersion,
                timingProfileId: _terms.timingProfileId,
                serviceTermsHash: _terms.serviceTermsHash
            });

        (
            IResolverRegistry.ServiceProfile memory profile,
            IResolverRegistry.ProfileStatus memory status
        ) = IResolverRegistry(_terms.registryAddress).getProfile(
                _terms.serviceProfileId
            );
        if (!status.primaryAccepted || !status.fallbackAccepted) {
            revert ServiceNotAccepted();
        }
        if (status.closedForNewFunding) revert ServiceRevoked();
        if (
            profile.token != _terms.token ||
            profile.ruleVersion != _terms.ruleVersion ||
            profile.timingProfileId != _terms.timingProfileId ||
            profile.serviceTermsHash != _terms.serviceTermsHash
        ) revert OutsideServiceScope();

        if (
            !IResolverRegistry(_terms.registryAddress).isEligible(
                _terms.serviceProfileId,
                eligibility
            )
        ) revert ServiceNotEligible();

        IERC20Minimal token = IERC20Minimal(_terms.token);
        uint256 beforeBalance = token.balanceOf(address(this));
        if (!token.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
            revert BalanceDeltaMismatch();
        }

        _accounting.fundedAmount = amount;
        _accounting.unallocated = amount;
        phase = Phase.Active;
        emit Funded(_terms.leaseId, _terms.tenant, amount);
    }

    function recordEvidence(
        bytes32 bundleId,
        uint256 version,
        bytes32 commitment
    ) external onlyParticipant {
        if (_accounting.fundedAmount == 0 || block.timestamp >= _terms.hardEndAt) {
            revert InvalidState();
        }
        if (bundleId == bytes32(0) || commitment == bytes32(0)) {
            revert InvalidCommitment();
        }
        EvidenceRecord storage previous = _evidence[msg.sender];
        if (version != previous.version + 1) revert InvalidTerms();
        _evidence[msg.sender] = EvidenceRecord({
            submitter: msg.sender,
            version: version,
            bundleId: bundleId,
            commitment: commitment,
            exists: true,
            acknowledged: false,
            agreed: false
        });
        emit EvidenceCommitted(
            _terms.leaseId,
            msg.sender,
            version,
            bundleId,
            commitment
        );
    }

    function acknowledgeEvidence(
        address submitter,
        uint256 version,
        bytes32 bundleId,
        bytes32 commitment,
        bool agree
    ) external onlyParticipant {
        if (submitter == msg.sender) revert Unauthorized();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        EvidenceRecord storage record = _evidence[submitter];
        if (
            !record.exists || record.version != version ||
            record.bundleId != bundleId || record.commitment != commitment ||
            record.acknowledged
        ) revert InvalidTerms();
        record.acknowledged = true;
        record.agreed = agree;
        emit EvidenceAcknowledged(
            _terms.leaseId,
            submitter,
            version,
            msg.sender,
            agree
        );
    }

    function requestCheckout(bytes32 evidenceHash) external onlyParticipant {
        if (_accounting.fundedAmount == 0 || phase != Phase.Active) {
            revert InvalidState();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (evidenceHash == bytes32(0) || _checkout.exists) {
            revert InvalidTerms();
        }
        uint256 responseDeadline = block.timestamp + 7 days;
        if (responseDeadline > _terms.hardEndAt) {
            responseDeadline = _terms.hardEndAt;
        }
        _checkout = CheckoutRequest({
            requester: msg.sender,
            evidenceHash: evidenceHash,
            requestedAt: block.timestamp,
            responseDeadline: responseDeadline,
            exists: true,
            responded: false,
            agreed: false,
            caseOpened: false
        });
        emit CheckoutRequested(
            _terms.leaseId,
            msg.sender,
            evidenceHash,
            responseDeadline
        );
    }

    function respondCheckout(bool agree, bytes32 evidenceHash) external {
        if (msg.sender != _terms.tenant && msg.sender != _terms.landlord) {
            revert Unauthorized();
        }
        if (!_checkout.exists || msg.sender == _checkout.requester) {
            revert InvalidState();
        }
        if (_checkout.responded) revert InvalidState();
        if (block.timestamp >= _checkout.responseDeadline) revert DeadlinePassed();
        if (evidenceHash != _checkout.evidenceHash) revert HashMismatch();
        _checkout.responded = true;
        _checkout.agreed = agree;
        if (agree) {
            phase = Phase.ClaimsOpen;
            emit ClaimsOpened(_terms.leaseId, _terms.claimDeadline);
        }
        emit CheckoutResponded(
            _terms.leaseId,
            msg.sender,
            agree,
            evidenceHash
        );
    }

    function openCheckoutCase() external {
        if (!_checkout.exists || _checkout.responded) revert InvalidState();
        if (block.timestamp < _checkout.responseDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        _checkout.caseOpened = true;
        emit CheckoutCaseOpened(_terms.leaseId, _checkout.requester);
    }

    function startScheduledSettlement() external {
        if (phase != Phase.Active) revert InvalidState();
        if (block.timestamp < _terms.leaseEndAt) revert DeadlineNotReached();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();

        phase = Phase.ClaimsOpen;
        emit ClaimsOpened(_terms.leaseId, _terms.claimDeadline);
    }

    function submitClaims(ClaimInput[] calldata inputs) external {
        if (msg.sender != _terms.landlord) revert Unauthorized();
        if (phase != Phase.ClaimsOpen) revert InvalidState();
        if (claimsSubmitted) revert ClaimsAlreadySubmitted();
        if (block.timestamp >= _terms.claimDeadline) revert DeadlinePassed();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (inputs.length > 10) revert TooManyClaims();

        uint256 total;
        for (uint256 i = 0; i < inputs.length; i++) {
            ClaimInput calldata input = inputs[i];
            if (input.amount == 0 || input.commitment == bytes32(0)) {
                revert InvalidCommitment();
            }
            total += input.amount;
            if (total > _accounting.fundedAmount) revert ClaimsExceedDeposit();

            _claims.push(
                Claim({
                    id: i + 1,
                    amount: input.amount,
                    commitment: input.commitment,
                    responseCommitment: bytes32(0),
                    status: ClaimStatus.Pending,
                    landlordAllocated: 0,
                    tenantAllocated: 0
                })
            );
        }

        claimsSubmitted = true;
        totalClaimAmount = total;
        emit ClaimsSubmitted(
            _terms.leaseId,
            _terms.landlord,
            inputs.length,
            total
        );
    }

    function respondClaim(
        uint256 claimId,
        bool accept,
        bytes32 responseCommitment
    ) external {
        if (msg.sender != _terms.tenant) revert Unauthorized();
        if (phase != Phase.ClaimsOpen && phase != Phase.ClaimsReview) {
            revert InvalidState();
        }
        if (!claimsSubmitted) revert InvalidState();
        if (block.timestamp >= _terms.responseDeadline) {
            revert ClaimResponseClosed();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (responseCommitment == bytes32(0)) revert InvalidCommitment();

        Claim storage claim = _claim(claimId);
        if (
            claim.status == ClaimStatus.Accepted ||
            claim.status == ClaimStatus.Waived ||
            claim.status == ClaimStatus.Allocated
        ) revert ClaimAlreadyFinalized();

        if (accept) {
            claim.status = ClaimStatus.Accepted;
        } else {
            claim.status = ClaimStatus.Disputed;
        }
        claim.responseCommitment = responseCommitment;

        if (claimsClosed && accept) {
            _allocateClaimToLandlord(claim);
        }
        _refreshAllocationPhase();

        emit ClaimResponded(
            _terms.leaseId,
            claimId,
            accept,
            responseCommitment
        );
    }

    function waiveClaim(uint256 claimId) external {
        if (msg.sender != _terms.landlord) revert Unauthorized();
        if (phase != Phase.ClaimsOpen && phase != Phase.ClaimsReview) {
            revert InvalidState();
        }
        if (!claimsSubmitted) revert InvalidState();
        if (claimsClosed && _activeCase.exists) revert InvalidState();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();

        Claim storage claim = _claim(claimId);
        if (
            claim.status == ClaimStatus.Waived ||
            claim.status == ClaimStatus.Allocated
        ) revert ClaimAlreadyFinalized();

        claim.status = ClaimStatus.Waived;
        if (claimsClosed) {
            _allocateClaimToTenant(claim);
        }
        _refreshAllocationPhase();
        emit ClaimWaived(_terms.leaseId, claimId);
    }

    function closeClaims() external {
        if (phase != Phase.ClaimsOpen) revert InvalidState();
        if (block.timestamp < _terms.claimDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        _closeClaimsInternal();
    }

    function openClaimCase() external {
        if (!claimsClosed) revert ClaimsNotClosed();
        if (phase != Phase.ClaimsReview) revert InvalidState();
        if (block.timestamp < _terms.responseDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (_activeCase.exists) revert CaseAlreadyOpened();
        if (_accounting.unallocated == 0) revert NoDisputedBalance();

        _caseNonce += 1;
        uint256 disputedAmount;
        for (uint256 i = 0; i < _claims.length; i++) {
            Claim storage claim = _claims[i];
            if (claim.status == ClaimStatus.Pending) {
                claim.status = ClaimStatus.Disputed;
            }
            if (claim.status == ClaimStatus.Disputed) {
                disputedAmount += claim.amount;
            }
        }
        if (disputedAmount == 0) revert NoDisputedBalance();

        _activeCase = ActiveCase({
            caseId: _caseNonce,
            openedAt: block.timestamp,
            disputedAmount: disputedAmount,
            evidenceDeadline: _terms.evidenceDeadline,
            primaryDeadline: _terms.primaryDeadline,
            challengeDeadline: _terms.challengeDeadline,
            fallbackStartAt: 0,
            fallbackDeadline: _terms.fallbackDeadline,
            timeoutAt: 0,
            proposalAt: 0,
            proposalHash: bytes32(0),
            decisionHash: bytes32(0),
            phase: CasePhase.Primary,
            exists: true
        });
        phase = Phase.ClaimCase;
        emit CaseOpened(_terms.leaseId, _caseNonce, disputedAmount);
    }

    function proposeDecision(
        uint256 caseId,
        DecisionInput[] calldata result,
        bytes32 reasonsCommitment
    ) external {
        if (msg.sender != _terms.primaryResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Primary) revert WrongCasePhase();
        if (block.timestamp < activeCase.evidenceDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= activeCase.primaryDeadline) {
            revert DeadlinePassed();
        }
        if (reasonsCommitment == bytes32(0)) revert InvalidCommitment();
        _validateDecisionVector(result);

        delete _decisions;
        for (uint256 i = 0; i < result.length; i++) {
            _decisions.push(result[i]);
        }
        bytes32 decisionHash = keccak256(
            abi.encode(caseId, reasonsCommitment, result)
        );
        activeCase.proposalAt = block.timestamp;
        activeCase.proposalHash = reasonsCommitment;
        activeCase.decisionHash = decisionHash;
        activeCase.challengeDeadline = _terms.challengeDeadline;
        activeCase.phase = CasePhase.Proposed;
        emit DecisionProposed(
            _terms.leaseId,
            caseId,
            msg.sender,
            decisionHash,
            activeCase.challengeDeadline
        );
    }

    function challenge(uint256 caseId, bytes32 commitment) external onlyParticipant {
        if (commitment == bytes32(0)) revert InvalidCommitment();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Proposed) revert WrongCasePhase();
        if (block.timestamp >= activeCase.challengeDeadline) {
            revert DeadlinePassed();
        }

        uint256 fallbackDuration = _terms.fallbackDeadline -
            _terms.primaryDeadline;
        activeCase.fallbackStartAt = block.timestamp;
        activeCase.fallbackDeadline = block.timestamp + fallbackDuration;
        if (activeCase.fallbackDeadline > _terms.hardEndAt) {
            revert InvalidTerms();
        }
        activeCase.phase = CasePhase.Fallback;
        delete _decisions;
        emit CaseEscalated(
            _terms.leaseId,
            caseId,
            msg.sender,
            activeCase.fallbackDeadline
        );
    }

    function escalateTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Primary) revert WrongCasePhase();
        if (block.timestamp < activeCase.primaryDeadline) {
            revert DeadlineNotReached();
        }
        activeCase.fallbackStartAt = activeCase.primaryDeadline;
        activeCase.fallbackDeadline = _terms.fallbackDeadline;
        activeCase.phase = CasePhase.Fallback;
        emit CaseEscalated(
            _terms.leaseId,
            caseId,
            msg.sender,
            activeCase.fallbackDeadline
        );
    }

    function finalizePrimary(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Proposed) revert WrongCasePhase();
        if (block.timestamp < activeCase.challengeDeadline) {
            revert DeadlineNotReached();
        }
        bytes32 decisionHash = activeCase.decisionHash;
        _applyDecision();
        activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        emit DecisionFinalized(_terms.leaseId, caseId, decisionHash);
    }

    function resolveFallback(
        uint256 caseId,
        DecisionInput[] calldata result,
        bytes32 reasonsCommitment
    ) external {
        if (msg.sender != _terms.fallbackResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Fallback) revert WrongCasePhase();
        if (block.timestamp < activeCase.fallbackStartAt + 2 days) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= activeCase.fallbackDeadline) {
            revert DeadlinePassed();
        }
        if (reasonsCommitment == bytes32(0)) revert InvalidCommitment();
        _validateDecisionVector(result);
        delete _decisions;
        for (uint256 i = 0; i < result.length; i++) {
            _decisions.push(result[i]);
        }
        bytes32 decisionHash = keccak256(
            abi.encode(caseId, reasonsCommitment, result)
        );
        _applyDecision();
        activeCase.decisionHash = decisionHash;
        activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        emit DecisionFinalized(_terms.leaseId, caseId, decisionHash);
    }

    function markServiceTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Fallback) revert WrongCasePhase();
        if (block.timestamp < activeCase.fallbackDeadline) {
            revert DeadlineNotReached();
        }
        uint256 exitDuration = _terms.exitNoticeDeadline -
            _terms.fallbackDeadline;
        activeCase.timeoutAt = activeCase.fallbackDeadline + exitDuration;
        if (activeCase.timeoutAt > _terms.hardEndAt) revert InvalidTerms();
        activeCase.phase = CasePhase.ExitPending;
        emit ServiceTimedOut(_terms.leaseId, caseId, activeCase.timeoutAt);
    }

    function finalizeTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.ExitPending) revert WrongCasePhase();
        if (block.timestamp < activeCase.timeoutAt) {
            revert DeadlineNotReached();
        }
        uint256 amount = _accounting.unallocated;
        if (amount > 0) {
            _allocateCredit(_terms.tenant, amount, keccak256("Timeout"));
        }
        activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        emit TimeoutAllocated(_terms.leaseId, caseId, amount);
    }

    function expireEscrow() external {
        if (_accounting.fundedAmount == 0) revert InvalidState();
        if (block.timestamp < _terms.hardEndAt) revert DeadlineNotReached();
        if (!claimsClosed) _closeClaimsInternal();
        if (
            _activeCase.exists &&
            _activeCase.phase == CasePhase.Proposed &&
            block.timestamp >= _activeCase.challengeDeadline
        ) {
            _applyDecision();
            _activeCase.phase = CasePhase.Finalized;
        }
        if (_accounting.unallocated == 0) {
            phase = Phase.Allocated;
            return;
        }
        uint256 amount = _accounting.unallocated;
        _allocateCredit(_terms.tenant, amount, keccak256("HardEnd"));
        if (_activeCase.exists) _activeCase.phase = CasePhase.Finalized;
        delete _decisions;
        delete _settlementProposal;
        phase = Phase.Allocated;
        emit EscrowExpired(_terms.leaseId, amount);
    }

    function proposeSettlement(
        uint256 tenantShare,
        uint256 landlordShare,
        uint256 snapshotRevision,
        uint256 validUntil,
        bytes32 detailsHash
    ) external onlyParticipant returns (uint256 proposalId) {
        if (_accounting.fundedAmount == 0 || _accounting.unallocated == 0) {
            revert InvalidSettlement();
        }
        if (phase == Phase.Cancelled || phase == Phase.Allocated) {
            revert InvalidState();
        }
        if (snapshotRevision != _accounting.revision) revert StaleProposal();
        if (tenantShare + landlordShare != _accounting.unallocated) {
            revert InvalidSettlement();
        }
        if (validUntil <= block.timestamp || validUntil > _terms.hardEndAt) {
            revert InvalidSettlement();
        }
        if (detailsHash == bytes32(0)) revert InvalidCommitment();

        _proposalNonce += 1;
        proposalId = _proposalNonce;
        _settlementProposal = SettlementProposal({
            proposalId: proposalId,
            proposer: msg.sender,
            tenantShare: tenantShare,
            landlordShare: landlordShare,
            snapshotRevision: snapshotRevision,
            validUntil: validUntil,
            detailsHash: detailsHash
        });
        emit SettlementProposed(
            _terms.leaseId,
            proposalId,
            msg.sender,
            tenantShare,
            landlordShare,
            snapshotRevision,
            validUntil,
            detailsHash
        );
    }

    function confirmSettlement(uint256 proposalId) external nonReentrant {
        SettlementProposal memory proposal = _settlementProposal;
        if (proposal.proposalId != proposalId || proposalId == 0) {
            revert ProposalNotFound();
        }
        if (msg.sender != _terms.tenant && msg.sender != _terms.landlord) {
            revert Unauthorized();
        }
        if (msg.sender == proposal.proposer) revert Unauthorized();
        if (block.timestamp >= proposal.validUntil) revert ProposalExpired();
        if (
            proposal.snapshotRevision != _accounting.revision ||
            proposal.tenantShare + proposal.landlordShare !=
            _accounting.unallocated
        ) revert StaleProposal();

        _allocateCredit(
            _terms.tenant,
            proposal.tenantShare,
            keccak256("SettlementTenant")
        );
        _allocateCredit(
            _terms.landlord,
            proposal.landlordShare,
            keccak256("SettlementLandlord")
        );
        if (_activeCase.exists) _activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        delete _settlementProposal;
        delete _decisions;
        emit SettlementConfirmed(
            _terms.leaseId,
            proposalId,
            proposal.tenantShare,
            proposal.landlordShare
        );
    }

    function withdraw() external nonReentrant {
        _withdrawTo(msg.sender);
    }

    function withdrawFor(address beneficiary) external nonReentrant {
        if (beneficiary != _terms.tenant && beneficiary != _terms.landlord) {
            revert Unauthorized();
        }
        _withdrawTo(beneficiary);
    }

    function getTerms() external view returns (Terms memory) {
        return _terms;
    }

    function getLeasePhase() external view returns (Phase) {
        return phase;
    }

    function getAccounting() external view returns (Accounting memory) {
        return _accounting;
    }

    function getClaimCount() external view returns (uint256) {
        return _claims.length;
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _claim(claimId);
    }

    function getActiveCase() external view returns (ActiveCase memory) {
        return _activeCase;
    }

    function getDecisionCount() external view returns (uint256) {
        return _decisions.length;
    }

    function getDecision(uint256 index) external view returns (DecisionInput memory) {
        if (index >= _decisions.length) revert ClaimNotFound();
        return _decisions[index];
    }

    function getSettlementProposal()
        external
        view
        returns (SettlementProposal memory)
    {
        return _settlementProposal;
    }

    function getEvidence(address submitter)
        external
        view
        returns (EvidenceRecord memory)
    {
        return _evidence[submitter];
    }

    function getCheckout()
        external
        view
        returns (CheckoutRequest memory)
    {
        return _checkout;
    }

    function tenant() external view returns (address) {
        return _terms.tenant;
    }

    function landlord() external view returns (address) {
        return _terms.landlord;
    }

    function _requireActiveCase(
        uint256 caseId
    ) internal view returns (ActiveCase storage activeCase) {
        if (!_activeCase.exists || _activeCase.caseId != caseId) {
            revert CaseNotFound();
        }
        return _activeCase;
    }

    function _closeClaimsInternal() internal {
        if (claimsClosed) revert ClaimsAlreadySubmitted();
        claimsClosed = true;
        uint256 unclaimedAmount = _accounting.fundedAmount - totalClaimAmount;
        if (unclaimedAmount > 0) {
            _allocateCredit(
                _terms.tenant,
                unclaimedAmount,
                keccak256("Unclaimed")
            );
        }

        uint256 acceptedAmount;
        uint256 disputedAmount;
        for (uint256 i = 0; i < _claims.length; i++) {
            Claim storage claim = _claims[i];
            if (claim.status == ClaimStatus.Accepted) {
                acceptedAmount += claim.amount;
                _allocateClaimToLandlord(claim);
            } else if (claim.status == ClaimStatus.Waived) {
                _allocateClaimToTenant(claim);
            } else {
                if (claim.status == ClaimStatus.Pending) {
                    claim.status = ClaimStatus.Disputed;
                }
                disputedAmount += claim.amount;
            }
        }

        phase = disputedAmount == 0 ? Phase.Allocated : Phase.ClaimsReview;
        emit ClaimsClosed(
            _terms.leaseId,
            unclaimedAmount,
            acceptedAmount,
            disputedAmount
        );
    }

    function _validateDecisionVector(
        DecisionInput[] calldata result
    ) internal view {
        if (result.length == 0) revert InvalidDecisionVector();
        uint256 disputedCount;
        for (uint256 i = 0; i < _claims.length; i++) {
            if (_claims[i].status == ClaimStatus.Disputed) disputedCount += 1;
        }
        if (result.length != disputedCount) revert InvalidDecisionVector();

        for (uint256 i = 0; i < result.length; i++) {
            if (result[i].claimId == 0 || result[i].landlordAmount > _claim(result[i].claimId).amount) {
                revert InvalidDecisionVector();
            }
            if (_claim(result[i].claimId).status != ClaimStatus.Disputed) {
                revert InvalidDecisionVector();
            }
            for (uint256 j = 0; j < i; j++) {
                if (result[j].claimId == result[i].claimId) {
                    revert InvalidDecisionVector();
                }
            }
        }
    }

    function _applyDecision() internal {
        uint256 allocated;
        for (uint256 i = 0; i < _decisions.length; i++) {
            DecisionInput memory decision = _decisions[i];
            Claim storage claim = _claim(decision.claimId);
            if (claim.status != ClaimStatus.Disputed) {
                revert InvalidDecisionVector();
            }
            uint256 tenantAmount = claim.amount - decision.landlordAmount;
            if (decision.landlordAmount > 0) {
                _allocateCredit(
                    _terms.landlord,
                    decision.landlordAmount,
                    keccak256("DecisionLandlord")
                );
            }
            if (tenantAmount > 0) {
                _allocateCredit(
                    _terms.tenant,
                    tenantAmount,
                    keccak256("DecisionTenant")
                );
            }
            claim.landlordAllocated = decision.landlordAmount;
            claim.tenantAllocated = tenantAmount;
            claim.status = ClaimStatus.Allocated;
            allocated += claim.amount;
        }
        if (allocated != _activeCase.disputedAmount) {
            revert InvalidDecisionVector();
        }
    }

    function _withdrawTo(address beneficiary) internal {
        uint256 amount;
        if (beneficiary == _terms.tenant) {
            amount = _accounting.tenantCredit;
            if (amount == 0) revert NothingToWithdraw();
            _accounting.tenantCredit = 0;
            _accounting.tenantWithdrawn += amount;
        } else if (beneficiary == _terms.landlord) {
            amount = _accounting.landlordCredit;
            if (amount == 0) revert NothingToWithdraw();
            _accounting.landlordCredit = 0;
            _accounting.landlordWithdrawn += amount;
        } else {
            revert Unauthorized();
        }

        if (!IERC20Minimal(_terms.token).transfer(beneficiary, amount)) {
            revert TransferFailed();
        }

        if (
            phase == Phase.Allocated &&
            _accounting.tenantCredit == 0 &&
            _accounting.landlordCredit == 0
        ) {
            phase = Phase.Closed;
        }

        emit Withdrawn(_terms.leaseId, beneficiary, msg.sender, amount);
    }

    /// @dev Reserved for the claim/settlement implementation in the next
    ///      phase. It is internal so no caller can arbitrarily allocate funds.
    function _allocateCredit(
        address beneficiary,
        uint256 amount,
        bytes32 source
    ) internal {
        if (beneficiary != _terms.tenant && beneficiary != _terms.landlord) {
            revert Unauthorized();
        }
        if (amount > _accounting.unallocated) revert AmountMismatch();

        _accounting.unallocated -= amount;
        if (beneficiary == _terms.tenant) {
            _accounting.tenantCredit += amount;
        } else {
            _accounting.landlordCredit += amount;
        }
        _accounting.revision += 1;
        emit CreditAllocated(_terms.leaseId, beneficiary, amount, source);
    }

    function _claim(uint256 claimId) internal view returns (Claim storage claim) {
        if (claimId == 0 || claimId > _claims.length) revert ClaimNotFound();
        return _claims[claimId - 1];
    }

    function _allocateClaimToLandlord(Claim storage claim) internal {
        if (claim.status == ClaimStatus.Allocated) {
            revert ClaimAlreadyFinalized();
        }
        _allocateCredit(_terms.landlord, claim.amount, keccak256("AcceptedClaim"));
        claim.landlordAllocated = claim.amount;
        claim.status = ClaimStatus.Allocated;
    }

    function _allocateClaimToTenant(Claim storage claim) internal {
        if (claim.status == ClaimStatus.Allocated) {
            revert ClaimAlreadyFinalized();
        }
        _allocateCredit(_terms.tenant, claim.amount, keccak256("WaivedClaim"));
        claim.tenantAllocated = claim.amount;
        claim.status = ClaimStatus.Allocated;
    }

    function _refreshAllocationPhase() internal {
        if (!claimsClosed) return;
        if (_accounting.unallocated == 0) {
            phase = Phase.Allocated;
            return;
        }
        bool hasDisputed;
        for (uint256 i = 0; i < _claims.length; i++) {
            ClaimStatus status = _claims[i].status;
            if (status == ClaimStatus.Disputed || status == ClaimStatus.Pending) {
                hasDisputed = true;
                break;
            }
        }
        if (!hasDisputed) phase = Phase.Allocated;
    }
}
