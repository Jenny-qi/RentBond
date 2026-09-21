// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IResolverRegistry} from "./interfaces/IResolverRegistry.sol";
import {RentBondRules} from "./RentBondRules.sol";
import {ReentrancyGuard} from "../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title DepositEscrow
/// @notice Per-lease escrow for acceptance, exact funding and deterministic
///         claims/dispute settlement.
contract DepositEscrow is ReentrancyGuard {
    enum Phase {
        AwaitingAcceptance,
        AwaitingFunding,
        Active,
        CheckoutRequested,
        CheckoutCase,
        ClaimsOpen,
        ClaimsReview,
        ClaimCase,
        ExitPending,
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

    enum CaseType {
        None,
        Checkout,
        Claims
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
        IResolverRegistry.TimingConfig timing;
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
        CaseType caseType;
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
        bytes32 challengeCommitment;
        bytes32 decisionHash;
        CasePhase phase;
        bool exists;
        bool checkoutApproved;
    }

    struct SettlementSchedule {
        uint256 startedAt;
        uint256 claimDeadline;
        uint256 responseDeadline;
        uint256 evidenceDeadline;
        uint256 primaryDeadline;
        bool started;
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
        bool resolved;
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
    error WrongCaseType();

    event TermsAccepted(bytes32 indexed leaseId, address indexed tenant, bytes32 termsHash);

    event LeaseCancelled(bytes32 indexed leaseId, address indexed caller, bytes32 reason);

    event Funded(bytes32 indexed leaseId, address indexed tenant, uint256 amount, bytes32 indexed serviceProfileId);

    event CreditAllocated(bytes32 indexed leaseId, address indexed beneficiary, uint256 amount, bytes32 source);

    event Withdrawn(bytes32 indexed leaseId, address indexed beneficiary, address indexed caller, uint256 amount);

    event ClaimsOpened(bytes32 indexed leaseId, uint256 claimDeadline);

    event ClaimsSubmitted(bytes32 indexed leaseId, address indexed landlord, uint256 claimCount, uint256 totalAmount);

    event ClaimResponded(bytes32 indexed leaseId, uint256 indexed claimId, bool accepted, bytes32 responseCommitment);

    event ClaimWaived(bytes32 indexed leaseId, uint256 indexed claimId);

    event ClaimsClosed(
        bytes32 indexed leaseId, uint256 unclaimedAmount, uint256 acceptedAmount, uint256 disputedAmount
    );

    event CaseOpened(
        bytes32 indexed leaseId, uint256 indexed caseId, CaseType indexed caseType, uint256 disputedAmount
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
        bytes32 challengeCommitment,
        uint256 fallbackDeadline
    );

    event DecisionFinalized(bytes32 indexed leaseId, uint256 indexed caseId, bytes32 decisionHash);

    event ServiceTimedOut(bytes32 indexed leaseId, uint256 indexed caseId, uint256 timeoutAt);

    event TimeoutAllocated(bytes32 indexed leaseId, uint256 indexed caseId, uint256 amount);

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
        bytes32 indexed leaseId, uint256 indexed proposalId, uint256 tenantShare, uint256 landlordShare
    );

    event EvidenceCommitted(
        bytes32 indexed leaseId,
        address indexed submitter,
        uint256 indexed version,
        bytes32 bundleId,
        bytes32 commitment
    );

    event EvidenceAcknowledged(
        bytes32 indexed leaseId, address indexed submitter, uint256 indexed version, address acknowledger, bool agree
    );

    event CheckoutRequested(
        bytes32 indexed leaseId, address indexed requester, bytes32 evidenceHash, uint256 responseDeadline
    );

    event CheckoutResponded(bytes32 indexed leaseId, address indexed responder, bool agree, bytes32 evidenceHash);

    event CheckoutCaseOpened(bytes32 indexed leaseId, address indexed requester);

    event CheckoutCaseResolved(bytes32 indexed leaseId, uint256 indexed caseId, bool approved);

    address public immutable factory;
    Terms private _terms;
    Phase public phase;
    bool public tenantAccepted;

    Accounting private _accounting;
    Claim[] private _claims;
    ActiveCase private _activeCase;
    SettlementSchedule private _schedule;
    DecisionInput[] private _decisions;
    SettlementProposal private _settlementProposal;
    mapping(address submitter => mapping(bytes32 bundleId => mapping(uint256 version => EvidenceRecord record))) private
        _evidence;
    mapping(address submitter => mapping(bytes32 bundleId => uint256 version)) private _latestEvidenceVersion;
    CheckoutRequest private _checkout;
    bool public claimsSubmitted;
    bool public claimsClosed;
    uint256 public totalClaimAmount;
    uint256 private _caseNonce;
    uint256 private _proposalNonce;

    constructor(Terms memory terms_, address factory_) {
        if (factory_ == address(0)) revert InvalidAddress();
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
        if (
            terms_.tenant == terms_.primaryResolver || terms_.tenant == terms_.fallbackResolver
                || terms_.landlord == terms_.primaryResolver || terms_.landlord == terms_.fallbackResolver
        ) revert InvalidTerms();
        if (terms_.token == address(0) || terms_.registryAddress == address(0)) {
            revert InvalidAddress();
        }
        if (!RentBondRules.validDeposit(terms_.depositAmount)) {
            revert InvalidTerms();
        }
        if (terms_.termsHash == bytes32(0)) revert InvalidTerms();
        if (terms_.serviceProfileId == bytes32(0)) revert InvalidTerms();
        if (terms_.serviceTermsHash == bytes32(0)) revert InvalidTerms();
        if (terms_.timingProfileId == bytes32(0)) revert InvalidTerms();
        if (!RentBondRules.validTiming(terms_.timing)) revert InvalidTerms();
        if (terms_.timeoutPolicy != RentBondRules.TIMEOUT_RETURN_UNAWARDED_TO_TENANT) revert InvalidTerms();
        if (terms_.timingProfileId != RentBondRules.timingProfileId(terms_.timing, terms_.timeoutPolicy)) {
            revert InvalidTerms();
        }
        if (terms_.acceptDeadline <= block.timestamp) revert InvalidTerms();
        if (terms_.leaseEndAt <= block.timestamp) revert InvalidTerms();
        if (terms_.acceptDeadline >= terms_.leaseEndAt) revert InvalidTerms();
        if (terms_.hardEndAt != RentBondRules.hardEndAt(terms_.leaseEndAt, terms_.timing)) revert InvalidTerms();

        factory = factory_;
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
        if (phase != Phase.AwaitingAcceptance && phase != Phase.AwaitingFunding) revert InvalidState();

        phase = Phase.Cancelled;
        emit LeaseCancelled(_terms.leaseId, msg.sender, keccak256("cancelled"));
    }

    function expireUnfunded() external {
        if (phase != Phase.AwaitingAcceptance && phase != Phase.AwaitingFunding) revert InvalidState();
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

        IResolverRegistry.EligibilityTerms memory eligibility = IResolverRegistry.EligibilityTerms({
            token: _terms.token,
            depositAmount: _terms.depositAmount,
            leaseEndAt: _terms.leaseEndAt,
            ruleVersion: _terms.ruleVersion,
            timingProfileId: _terms.timingProfileId,
            serviceTermsHash: _terms.serviceTermsHash
        });

        (IResolverRegistry.ServiceProfile memory profile, IResolverRegistry.ProfileStatus memory status) =
            IResolverRegistry(_terms.registryAddress).getProfile(_terms.serviceProfileId);
        if (!status.primaryAccepted || !status.fallbackAccepted) {
            revert ServiceNotAccepted();
        }
        if (status.closedForNewFunding) revert ServiceRevoked();
        if (
            profile.primaryResolver != _terms.primaryResolver || profile.fallbackResolver != _terms.fallbackResolver
                || profile.token != _terms.token || profile.ruleVersion != _terms.ruleVersion
                || profile.timingProfileId != _terms.timingProfileId || profile.timeoutPolicy != _terms.timeoutPolicy
                || profile.serviceTermsHash != _terms.serviceTermsHash
        ) revert OutsideServiceScope();

        if (!IResolverRegistry(_terms.registryAddress).isEligible(_terms.serviceProfileId, eligibility)) {
            revert ServiceNotEligible();
        }

        IERC20Minimal token = IERC20Minimal(_terms.token);
        uint256 beforeBalance = token.balanceOf(address(this));
        _safeTokenCall(abi.encodeCall(IERC20Minimal.transferFrom, (msg.sender, address(this), amount)));
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
            revert BalanceDeltaMismatch();
        }

        _accounting.fundedAmount = amount;
        _accounting.unallocated = amount;
        phase = Phase.Active;
        emit Funded(_terms.leaseId, _terms.tenant, amount, _terms.serviceProfileId);
    }

    function recordEvidence(bytes32 bundleId, uint256 version, bytes32 commitment) external onlyParticipant {
        if (_accounting.fundedAmount == 0 || block.timestamp >= _terms.hardEndAt) {
            revert InvalidState();
        }
        if (bundleId == bytes32(0) || commitment == bytes32(0)) {
            revert InvalidCommitment();
        }
        if (phase == Phase.Cancelled || phase == Phase.Allocated || phase == Phase.Closed) {
            revert InvalidState();
        }
        uint256 previousVersion = _latestEvidenceVersion[msg.sender][bundleId];
        if (version != previousVersion + 1) revert InvalidTerms();
        _evidence[msg.sender][bundleId][version] = EvidenceRecord({
            submitter: msg.sender,
            version: version,
            bundleId: bundleId,
            commitment: commitment,
            exists: true,
            acknowledged: false,
            agreed: false
        });
        _latestEvidenceVersion[msg.sender][bundleId] = version;
        emit EvidenceCommitted(_terms.leaseId, msg.sender, version, bundleId, commitment);
    }

    function acknowledgeEvidence(address submitter, uint256 version, bytes32 bundleId, bytes32 commitment, bool agree)
        external
        onlyParticipant
    {
        if (submitter == msg.sender) revert Unauthorized();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        EvidenceRecord storage record = _evidence[submitter][bundleId][version];
        if (
            !record.exists || record.version != version || record.bundleId != bundleId
                || record.commitment != commitment || record.acknowledged
        ) revert InvalidTerms();
        record.acknowledged = true;
        record.agreed = agree;
        emit EvidenceAcknowledged(_terms.leaseId, submitter, version, msg.sender, agree);
    }

    function requestCheckout(bytes32 evidenceHash) external onlyParticipant {
        if (_accounting.fundedAmount == 0 || phase != Phase.Active) {
            revert InvalidState();
        }
        if (block.timestamp >= _terms.leaseEndAt) revert DeadlinePassed();
        if (evidenceHash == bytes32(0)) {
            revert InvalidTerms();
        }
        if (_checkout.exists) {
            if (!_checkout.resolved) revert InvalidState();
            if (
                block.timestamp < _checkout.requestedAt + RentBondRules.CHECKOUT_RETRY_DELAY
                    || evidenceHash == _checkout.evidenceHash
            ) revert InvalidTerms();
        }

        uint256 responseDeadline = block.timestamp + uint256(_terms.timing.checkoutResponse);
        if (responseDeadline > _terms.leaseEndAt) {
            responseDeadline = _terms.leaseEndAt;
        }
        _invalidateSettlement();
        _checkout = CheckoutRequest({
            requester: msg.sender,
            evidenceHash: evidenceHash,
            requestedAt: block.timestamp,
            responseDeadline: responseDeadline,
            exists: true,
            responded: false,
            agreed: false,
            caseOpened: false,
            resolved: false
        });
        phase = Phase.CheckoutRequested;
        emit CheckoutRequested(_terms.leaseId, msg.sender, evidenceHash, responseDeadline);
    }

    function respondCheckout(bool agree, bytes32 evidenceHash) external {
        if (msg.sender != _terms.tenant && msg.sender != _terms.landlord) {
            revert Unauthorized();
        }
        if (!_checkout.exists || msg.sender == _checkout.requester) {
            revert InvalidState();
        }
        if (phase != Phase.CheckoutRequested) revert InvalidState();
        if (_checkout.responded) revert InvalidState();
        if (block.timestamp >= _checkout.responseDeadline) revert DeadlinePassed();
        if (evidenceHash != _checkout.evidenceHash) revert HashMismatch();
        _checkout.responded = true;
        _checkout.agreed = agree;
        _invalidateSettlement();
        if (agree) {
            _checkout.resolved = true;
            _startClaims(block.timestamp);
        }
        emit CheckoutResponded(_terms.leaseId, msg.sender, agree, evidenceHash);
    }

    function openCheckoutCase() external {
        if (!_checkout.exists || _checkout.resolved || _checkout.caseOpened || phase != Phase.CheckoutRequested) {
            revert InvalidState();
        }
        if (!_checkout.responded && block.timestamp < _checkout.responseDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.leaseEndAt) revert DeadlinePassed();

        _caseNonce += 1;
        uint256 evidenceDeadline = block.timestamp + uint256(_terms.timing.evidence);
        if (evidenceDeadline > _terms.leaseEndAt) {
            evidenceDeadline = _terms.leaseEndAt;
        }
        uint256 primaryDeadline = evidenceDeadline + uint256(_terms.timing.primary);
        if (primaryDeadline > _terms.leaseEndAt) {
            primaryDeadline = _terms.leaseEndAt;
        }

        _invalidateSettlement();
        _checkout.caseOpened = true;
        _activeCase = ActiveCase({
            caseId: _caseNonce,
            caseType: CaseType.Checkout,
            openedAt: block.timestamp,
            disputedAmount: 0,
            evidenceDeadline: evidenceDeadline,
            primaryDeadline: primaryDeadline,
            challengeDeadline: 0,
            fallbackStartAt: 0,
            fallbackDeadline: 0,
            timeoutAt: 0,
            proposalAt: 0,
            proposalHash: bytes32(0),
            challengeCommitment: bytes32(0),
            decisionHash: bytes32(0),
            phase: CasePhase.Primary,
            exists: true,
            checkoutApproved: false
        });
        phase = Phase.CheckoutCase;
        emit CheckoutCaseOpened(_terms.leaseId, _checkout.requester);
        emit CaseOpened(_terms.leaseId, _caseNonce, CaseType.Checkout, 0);
    }

    function startScheduledSettlement() external {
        if (_schedule.started) return;
        if (phase != Phase.Active && phase != Phase.CheckoutRequested && phase != Phase.CheckoutCase) {
            revert InvalidState();
        }
        if (block.timestamp < _terms.leaseEndAt) revert DeadlineNotReached();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();

        _invalidateSettlement();
        _invalidateCheckoutCase();
        _startClaims(_terms.leaseEndAt);
    }

    function submitClaims(ClaimInput[] calldata inputs) external {
        if (msg.sender != _terms.landlord) revert Unauthorized();
        if (phase != Phase.ClaimsOpen) revert InvalidState();
        if (claimsSubmitted) revert ClaimsAlreadySubmitted();
        if (block.timestamp >= _schedule.claimDeadline) revert DeadlinePassed();
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (inputs.length == 0 || inputs.length > 10) revert TooManyClaims();

        uint256 total;
        for (uint256 i = 0; i < inputs.length; i++) {
            ClaimInput calldata input = inputs[i];
            if (!RentBondRules.isBusinessAmount(input.amount, false) || input.commitment == bytes32(0)) {
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
        _invalidateSettlement();
        emit ClaimsSubmitted(_terms.leaseId, _terms.landlord, inputs.length, total);
    }

    function respondClaim(uint256 claimId, bool accept, bytes32 responseCommitment) external {
        if (msg.sender != _terms.tenant) revert Unauthorized();
        if (phase != Phase.ClaimsOpen && phase != Phase.ClaimsReview) {
            revert InvalidState();
        }
        if (!claimsSubmitted) revert InvalidState();
        if (block.timestamp >= _schedule.responseDeadline) {
            revert ClaimResponseClosed();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (responseCommitment == bytes32(0)) revert InvalidCommitment();

        Claim storage claim = _claim(claimId);
        if (
            claim.status == ClaimStatus.Accepted || claim.status == ClaimStatus.Waived
                || claim.status == ClaimStatus.Allocated
        ) revert ClaimAlreadyFinalized();

        if (accept) {
            claim.status = ClaimStatus.Accepted;
        } else {
            claim.status = ClaimStatus.Disputed;
        }
        claim.responseCommitment = responseCommitment;

        if (claimsClosed && accept) {
            _allocateClaimToLandlord(claim);
        } else {
            _invalidateSettlement();
        }
        _refreshAllocationPhase();

        emit ClaimResponded(_terms.leaseId, claimId, accept, responseCommitment);
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
        if (claim.status == ClaimStatus.Waived || claim.status == ClaimStatus.Allocated) {
            revert ClaimAlreadyFinalized();
        }

        claim.status = ClaimStatus.Waived;
        if (claimsClosed) {
            _allocateClaimToTenant(claim);
        } else {
            _invalidateSettlement();
        }
        _refreshAllocationPhase();
        emit ClaimWaived(_terms.leaseId, claimId);
    }

    function closeClaims() external {
        if (claimsClosed) return;
        if (phase != Phase.ClaimsOpen) revert InvalidState();
        if (block.timestamp < _schedule.claimDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        _closeClaimsInternal();
    }

    function openClaimCase() external {
        if (!claimsClosed) revert ClaimsNotClosed();
        if (phase != Phase.ClaimsReview) revert InvalidState();
        if (block.timestamp < _schedule.responseDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (_activeCase.exists && _activeCase.phase != CasePhase.Finalized) revert CaseAlreadyOpened();
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

        _invalidateSettlement();
        _activeCase = ActiveCase({
            caseId: _caseNonce,
            caseType: CaseType.Claims,
            openedAt: _schedule.responseDeadline,
            disputedAmount: disputedAmount,
            evidenceDeadline: _schedule.evidenceDeadline,
            primaryDeadline: _schedule.primaryDeadline,
            challengeDeadline: 0,
            fallbackStartAt: 0,
            fallbackDeadline: 0,
            timeoutAt: 0,
            proposalAt: 0,
            proposalHash: bytes32(0),
            challengeCommitment: bytes32(0),
            decisionHash: bytes32(0),
            phase: CasePhase.Primary,
            exists: true,
            checkoutApproved: false
        });
        phase = Phase.ClaimCase;
        emit CaseOpened(_terms.leaseId, _caseNonce, CaseType.Claims, disputedAmount);
    }

    function proposeDecision(uint256 caseId, DecisionInput[] calldata result, bytes32 reasonsCommitment) external {
        if (msg.sender != _terms.primaryResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.caseType != CaseType.Claims) revert WrongCaseType();
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
        bytes32 decisionHash = keccak256(abi.encode(caseId, reasonsCommitment, result));
        _recordPrimaryProposal(activeCase, reasonsCommitment, decisionHash, false);
    }

    function proposeCheckoutDecision(uint256 caseId, bool approved, bytes32 reasonsCommitment) external {
        if (msg.sender != _terms.primaryResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.caseType != CaseType.Checkout) revert WrongCaseType();
        if (activeCase.phase != CasePhase.Primary) revert WrongCasePhase();
        if (block.timestamp < activeCase.evidenceDeadline) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= activeCase.primaryDeadline) {
            revert DeadlinePassed();
        }
        if (reasonsCommitment == bytes32(0)) revert InvalidCommitment();
        bytes32 decisionHash = keccak256(abi.encode(caseId, approved, reasonsCommitment));
        _recordPrimaryProposal(activeCase, reasonsCommitment, decisionHash, approved);
    }

    function challenge(uint256 caseId, bytes32 commitment) external onlyParticipant {
        if (commitment == bytes32(0)) revert InvalidCommitment();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Proposed) revert WrongCasePhase();
        if (block.timestamp >= activeCase.challengeDeadline) {
            revert DeadlinePassed();
        }

        _invalidateSettlement();
        activeCase.fallbackStartAt = block.timestamp;
        activeCase.fallbackDeadline = block.timestamp + uint256(_terms.timing.fallbackResolver);
        uint256 caseLimit = _caseLimit(activeCase.caseType);
        if (activeCase.fallbackDeadline > caseLimit) {
            activeCase.fallbackDeadline = caseLimit;
        }
        activeCase.phase = CasePhase.Fallback;
        delete _decisions;
        activeCase.proposalHash = bytes32(0);
        activeCase.challengeCommitment = commitment;
        activeCase.decisionHash = bytes32(0);
        emit CaseEscalated(_terms.leaseId, caseId, msg.sender, commitment, activeCase.fallbackDeadline);
    }

    function escalateTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase != CasePhase.Primary) revert WrongCasePhase();
        if (block.timestamp < activeCase.primaryDeadline) {
            revert DeadlineNotReached();
        }
        _invalidateSettlement();
        activeCase.fallbackStartAt = activeCase.primaryDeadline;
        activeCase.fallbackDeadline = activeCase.primaryDeadline + uint256(_terms.timing.fallbackResolver);
        uint256 caseLimit = _caseLimit(activeCase.caseType);
        if (activeCase.fallbackDeadline > caseLimit) {
            activeCase.fallbackDeadline = caseLimit;
        }
        activeCase.phase = CasePhase.Fallback;
        emit CaseEscalated(_terms.leaseId, caseId, msg.sender, bytes32(0), activeCase.fallbackDeadline);
    }

    function finalizePrimary(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase == CasePhase.Finalized) return;
        if (activeCase.phase != CasePhase.Proposed) revert WrongCasePhase();
        if (block.timestamp < activeCase.challengeDeadline) {
            revert DeadlineNotReached();
        }
        bytes32 decisionHash = activeCase.decisionHash;
        _applyActiveDecision(activeCase);
        emit DecisionFinalized(_terms.leaseId, caseId, decisionHash);
    }

    function resolveFallback(uint256 caseId, DecisionInput[] calldata result, bytes32 reasonsCommitment) external {
        if (msg.sender != _terms.fallbackResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.caseType != CaseType.Claims) revert WrongCaseType();
        if (activeCase.phase != CasePhase.Fallback) revert WrongCasePhase();
        if (block.timestamp < activeCase.fallbackStartAt + uint256(_terms.timing.fallbackEvidence)) {
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
        bytes32 decisionHash = keccak256(abi.encode(caseId, reasonsCommitment, result));
        _applyDecision();
        activeCase.proposalHash = reasonsCommitment;
        activeCase.decisionHash = decisionHash;
        activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        _invalidateSettlement();
        emit DecisionFinalized(_terms.leaseId, caseId, decisionHash);
    }

    function resolveFallbackCheckout(uint256 caseId, bool approved, bytes32 reasonsCommitment) external {
        if (msg.sender != _terms.fallbackResolver) revert Unauthorized();
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.caseType != CaseType.Checkout) revert WrongCaseType();
        if (activeCase.phase != CasePhase.Fallback) revert WrongCasePhase();
        if (block.timestamp < activeCase.fallbackStartAt + uint256(_terms.timing.fallbackEvidence)) {
            revert DeadlineNotReached();
        }
        if (block.timestamp >= activeCase.fallbackDeadline) {
            revert DeadlinePassed();
        }
        if (reasonsCommitment == bytes32(0)) revert InvalidCommitment();
        bytes32 decisionHash = keccak256(abi.encode(caseId, approved, reasonsCommitment));
        activeCase.proposalHash = reasonsCommitment;
        activeCase.decisionHash = decisionHash;
        activeCase.checkoutApproved = approved;
        _applyActiveDecision(activeCase);
        emit DecisionFinalized(_terms.leaseId, caseId, decisionHash);
    }

    function markServiceTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase == CasePhase.Finalized) return;
        if (activeCase.phase != CasePhase.Fallback) revert WrongCasePhase();
        if (block.timestamp < activeCase.fallbackDeadline) {
            revert DeadlineNotReached();
        }
        if (activeCase.caseType == CaseType.Checkout) {
            activeCase.timeoutAt = activeCase.fallbackDeadline;
            emit ServiceTimedOut(_terms.leaseId, caseId, activeCase.timeoutAt);
            _finishCheckoutCase(activeCase, false);
            return;
        }

        activeCase.timeoutAt = activeCase.fallbackDeadline + uint256(_terms.timing.exitNotice);
        if (activeCase.timeoutAt > _terms.hardEndAt) revert InvalidTerms();
        activeCase.phase = CasePhase.ExitPending;
        phase = Phase.ExitPending;
        _invalidateSettlement();
        emit ServiceTimedOut(_terms.leaseId, caseId, activeCase.timeoutAt);
    }

    function finalizeTimeout(uint256 caseId) external {
        ActiveCase storage activeCase = _requireActiveCase(caseId);
        if (activeCase.phase == CasePhase.Finalized) return;
        if (activeCase.caseType != CaseType.Claims) revert WrongCaseType();
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
        if (_accounting.unallocated == 0 && (phase == Phase.Allocated || phase == Phase.Closed)) return;
        if (!_schedule.started) {
            _invalidateCheckoutCase();
            _startClaims(_terms.leaseEndAt);
        }
        if (!claimsClosed) _closeClaimsInternal();
        if (
            _activeCase.exists && _activeCase.caseType == CaseType.Claims && _activeCase.phase == CasePhase.Proposed
                && block.timestamp >= _activeCase.challengeDeadline
        ) {
            _applyDecision();
            _activeCase.phase = CasePhase.Finalized;
        }
        uint256 amount = _accounting.unallocated;
        if (_accounting.unallocated == 0) {
            phase = Phase.Allocated;
        } else {
            _allocateCredit(_terms.tenant, amount, keccak256("HardEnd"));
            phase = Phase.Allocated;
        }
        if (_activeCase.exists) _activeCase.phase = CasePhase.Finalized;
        delete _decisions;
        delete _settlementProposal;
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
        if (phase == Phase.Cancelled || phase == Phase.Allocated || phase == Phase.Closed) {
            revert InvalidState();
        }
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        uint256 effectiveDeadline = _terms.hardEndAt;
        if (
            _activeCase.exists && _activeCase.phase == CasePhase.ExitPending
                && _activeCase.timeoutAt < effectiveDeadline
        ) effectiveDeadline = _activeCase.timeoutAt;
        if (block.timestamp >= effectiveDeadline) revert DeadlinePassed();
        if (_settlementProposal.proposalId != 0 && block.timestamp < _settlementProposal.validUntil) {
            revert ProposalAlreadyExists();
        }
        if (snapshotRevision != _accounting.revision) revert StaleProposal();
        if (tenantShare + landlordShare != _accounting.unallocated) {
            revert InvalidSettlement();
        }
        if (!RentBondRules.isBusinessAmount(tenantShare, true) || !RentBondRules.isBusinessAmount(landlordShare, true))
        {
            revert InvalidSettlement();
        }
        if (validUntil <= block.timestamp || validUntil > effectiveDeadline) {
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
        if (block.timestamp >= _terms.hardEndAt) revert DeadlinePassed();
        if (
            _activeCase.exists && _activeCase.phase == CasePhase.ExitPending && block.timestamp >= _activeCase.timeoutAt
        ) revert DeadlinePassed();
        if (
            proposal.snapshotRevision != _accounting.revision
                || proposal.tenantShare + proposal.landlordShare != _accounting.unallocated
        ) revert StaleProposal();

        delete _settlementProposal;
        if (proposal.tenantShare > 0) {
            _allocateCredit(_terms.tenant, proposal.tenantShare, keccak256("SettlementTenant"));
        }
        if (proposal.landlordShare > 0) {
            _allocateCredit(_terms.landlord, proposal.landlordShare, keccak256("SettlementLandlord"));
        }
        if (_activeCase.exists) _activeCase.phase = CasePhase.Finalized;
        phase = Phase.Allocated;
        delete _decisions;
        emit SettlementConfirmed(_terms.leaseId, proposalId, proposal.tenantShare, proposal.landlordShare);
    }

    function withdraw() external nonReentrant {
        _withdrawTo(msg.sender, false);
    }

    function withdrawFor(address beneficiary) external nonReentrant {
        if (beneficiary != _terms.tenant && beneficiary != _terms.landlord) {
            revert Unauthorized();
        }
        _withdrawTo(beneficiary, true);
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

    function getSettlementSchedule() external view returns (SettlementSchedule memory) {
        return _schedule;
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

    function getSettlementProposal() external view returns (SettlementProposal memory) {
        return _settlementProposal;
    }

    function getEvidence(address submitter, bytes32 bundleId, uint256 version)
        external
        view
        returns (EvidenceRecord memory)
    {
        return _evidence[submitter][bundleId][version];
    }

    function getLatestEvidenceVersion(address submitter, bytes32 bundleId) external view returns (uint256) {
        return _latestEvidenceVersion[submitter][bundleId];
    }

    function getCheckout() external view returns (CheckoutRequest memory) {
        return _checkout;
    }

    function tenant() external view returns (address) {
        return _terms.tenant;
    }

    function landlord() external view returns (address) {
        return _terms.landlord;
    }

    function _requireActiveCase(uint256 caseId) internal view returns (ActiveCase storage activeCase) {
        if (!_activeCase.exists || _activeCase.caseId != caseId) {
            revert CaseNotFound();
        }
        return _activeCase;
    }

    function _recordPrimaryProposal(
        ActiveCase storage activeCase,
        bytes32 reasonsCommitment,
        bytes32 decisionHash,
        bool checkoutApproved
    ) internal {
        _invalidateSettlement();
        activeCase.proposalAt = block.timestamp;
        activeCase.proposalHash = reasonsCommitment;
        activeCase.decisionHash = decisionHash;
        activeCase.checkoutApproved = checkoutApproved;
        activeCase.challengeDeadline = block.timestamp + uint256(_terms.timing.challenge);
        uint256 caseLimit = _caseLimit(activeCase.caseType);
        if (activeCase.challengeDeadline > caseLimit) {
            activeCase.challengeDeadline = caseLimit;
        }
        if (activeCase.challengeDeadline <= block.timestamp) {
            revert DeadlinePassed();
        }
        activeCase.phase = CasePhase.Proposed;
        emit DecisionProposed(_terms.leaseId, activeCase.caseId, msg.sender, decisionHash, activeCase.challengeDeadline);
    }

    function _applyActiveDecision(ActiveCase storage activeCase) internal {
        if (activeCase.caseType == CaseType.Claims) {
            _applyDecision();
            activeCase.phase = CasePhase.Finalized;
            phase = Phase.Allocated;
            return;
        }
        if (activeCase.caseType == CaseType.Checkout) {
            _finishCheckoutCase(activeCase, activeCase.checkoutApproved);
            return;
        }
        revert WrongCaseType();
    }

    function _finishCheckoutCase(ActiveCase storage activeCase, bool approved) internal {
        uint256 caseId = activeCase.caseId;
        activeCase.phase = CasePhase.Finalized;
        _checkout.resolved = true;
        _checkout.agreed = approved;
        delete _decisions;
        _invalidateSettlement();
        emit CheckoutCaseResolved(_terms.leaseId, caseId, approved);

        if (approved) {
            uint256 startAt = block.timestamp < _terms.leaseEndAt ? block.timestamp : _terms.leaseEndAt;
            _startClaims(startAt);
        } else if (block.timestamp >= _terms.leaseEndAt) {
            _startClaims(_terms.leaseEndAt);
        } else {
            phase = Phase.Active;
        }
    }

    function _invalidateCheckoutCase() internal {
        if (_activeCase.exists && _activeCase.caseType == CaseType.Checkout && _activeCase.phase != CasePhase.Finalized)
        {
            uint256 caseId = _activeCase.caseId;
            _activeCase.phase = CasePhase.Finalized;
            emit CheckoutCaseResolved(_terms.leaseId, caseId, false);
        }
        if (_checkout.exists && !_checkout.resolved) {
            _checkout.resolved = true;
            _checkout.agreed = false;
        }
        delete _decisions;
    }

    function _startClaims(uint256 startedAt) internal {
        if (_schedule.started) return;
        uint256 effectiveStart = startedAt < _terms.leaseEndAt ? startedAt : _terms.leaseEndAt;
        uint256 claimDeadline = effectiveStart + uint256(_terms.timing.claim);
        uint256 responseDeadline = claimDeadline + uint256(_terms.timing.response);
        uint256 evidenceDeadline = responseDeadline + uint256(_terms.timing.evidence);
        uint256 primaryDeadline = evidenceDeadline + uint256(_terms.timing.primary);
        uint256 latestExit = primaryDeadline + uint256(_terms.timing.challenge)
            + uint256(_terms.timing.fallbackResolver) + uint256(_terms.timing.exitNotice);
        if (latestExit > _terms.hardEndAt) revert InvalidTerms();

        _schedule = SettlementSchedule({
            startedAt: effectiveStart,
            claimDeadline: claimDeadline,
            responseDeadline: responseDeadline,
            evidenceDeadline: evidenceDeadline,
            primaryDeadline: primaryDeadline,
            started: true
        });
        phase = Phase.ClaimsOpen;
        emit ClaimsOpened(_terms.leaseId, claimDeadline);
    }

    function _caseLimit(CaseType caseType) internal view returns (uint256) {
        if (caseType == CaseType.Checkout) return _terms.leaseEndAt;
        if (caseType == CaseType.Claims) return _terms.hardEndAt;
        revert WrongCaseType();
    }

    function _invalidateSettlement() internal {
        _accounting.revision += 1;
        if (_settlementProposal.proposalId != 0) {
            delete _settlementProposal;
        }
    }

    function _closeClaimsInternal() internal {
        if (claimsClosed) return;
        _invalidateSettlement();
        claimsClosed = true;
        uint256 unclaimedAmount = _accounting.fundedAmount - totalClaimAmount;
        if (unclaimedAmount > 0) {
            _allocateCredit(_terms.tenant, unclaimedAmount, keccak256("Unclaimed"));
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
        emit ClaimsClosed(_terms.leaseId, unclaimedAmount, acceptedAmount, disputedAmount);
    }

    function _validateDecisionVector(DecisionInput[] calldata result) internal view {
        if (result.length == 0) revert InvalidDecisionVector();
        uint256 disputedCount;
        for (uint256 i = 0; i < _claims.length; i++) {
            if (_claims[i].status == ClaimStatus.Disputed) disputedCount += 1;
        }
        if (result.length != disputedCount) revert InvalidDecisionVector();

        uint256 resultIndex;
        for (uint256 i = 0; i < _claims.length; i++) {
            Claim storage claim = _claims[i];
            if (claim.status != ClaimStatus.Disputed) continue;
            DecisionInput calldata decision = result[resultIndex];
            if (
                decision.claimId != claim.id || decision.landlordAmount > claim.amount
                    || !RentBondRules.isBusinessAmount(decision.landlordAmount, true)
            ) {
                revert InvalidDecisionVector();
            }
            resultIndex += 1;
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
                _allocateCredit(_terms.landlord, decision.landlordAmount, keccak256("DecisionLandlord"));
            }
            if (tenantAmount > 0) {
                _allocateCredit(_terms.tenant, tenantAmount, keccak256("DecisionTenant"));
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

    function _withdrawTo(address beneficiary, bool allowZero) internal {
        uint256 amount;
        if (beneficiary == _terms.tenant) {
            amount = _accounting.tenantCredit;
            if (amount == 0) {
                if (allowZero) return;
                revert NothingToWithdraw();
            }
            _accounting.tenantCredit = 0;
            _accounting.tenantWithdrawn += amount;
        } else if (beneficiary == _terms.landlord) {
            amount = _accounting.landlordCredit;
            if (amount == 0) {
                if (allowZero) return;
                revert NothingToWithdraw();
            }
            _accounting.landlordCredit = 0;
            _accounting.landlordWithdrawn += amount;
        } else {
            revert Unauthorized();
        }

        _safeTokenCall(abi.encodeCall(IERC20Minimal.transfer, (beneficiary, amount)));

        if (phase == Phase.Allocated && _accounting.tenantCredit == 0 && _accounting.landlordCredit == 0) {
            phase = Phase.Closed;
        }

        emit Withdrawn(_terms.leaseId, beneficiary, msg.sender, amount);
    }

    /// @dev Internal-only accounting transition; no caller can select another
    ///      beneficiary or withdraw unallocated funds.
    function _allocateCredit(address beneficiary, uint256 amount, bytes32 source) internal {
        if (beneficiary != _terms.tenant && beneficiary != _terms.landlord) {
            revert Unauthorized();
        }
        if (amount == 0) return;
        if (amount > _accounting.unallocated) revert AmountMismatch();

        _accounting.unallocated -= amount;
        if (beneficiary == _terms.tenant) {
            _accounting.tenantCredit += amount;
        } else {
            _accounting.landlordCredit += amount;
        }
        _accounting.revision += 1;
        if (_settlementProposal.proposalId != 0) {
            delete _settlementProposal;
        }
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

    /// @dev Accepts standard ERC-20 boolean returns and legacy no-return
    ///      tokens, while rejecting explicit false and malformed return data.
    function _safeTokenCall(bytes memory callData) internal {
        (bool success, bytes memory returnData) = _terms.token.call(callData);
        if (!success) revert TransferFailed();
        if (returnData.length == 0) return;
        if (returnData.length != 32 || !abi.decode(returnData, (bool))) {
            revert TransferFailed();
        }
    }
}
