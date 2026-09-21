// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DepositEscrow} from "../src/DepositEscrow.sol";
import {IResolverRegistry} from "../src/interfaces/IResolverRegistry.sol";
import {ResolverRegistry} from "../src/ResolverRegistry.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

contract EscrowTestToken {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount))
        public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) {
            return false;
        }
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract EscrowTestActor {
    function acceptProfile(
        ResolverRegistry registry,
        bytes32 profileId
    ) external {
        registry.acceptProfile(profileId);
    }

    function revokeProfile(
        ResolverRegistry registry,
        bytes32 profileId
    ) external {
        registry.revokeForNewFunding(profileId);
    }

    function approveToken(
        EscrowTestToken token,
        address spender,
        uint256 amount
    ) external {
        token.approve(spender, amount);
    }

    function acceptTerms(DepositEscrow escrow, bytes32 termsHash) external {
        escrow.acceptTerms(termsHash);
    }

    function fund(DepositEscrow escrow, uint256 amount) external {
        escrow.fund(amount);
    }

    function startSettlement(DepositEscrow escrow) external {
        escrow.startScheduledSettlement();
    }

    function submitClaims(
        DepositEscrow escrow,
        DepositEscrow.ClaimInput[] calldata claims
    ) external {
        escrow.submitClaims(claims);
    }

    function respondClaim(
        DepositEscrow escrow,
        uint256 claimId,
        bool accept,
        bytes32 responseCommitment
    ) external {
        escrow.respondClaim(claimId, accept, responseCommitment);
    }

    function closeClaims(DepositEscrow escrow) external {
        escrow.closeClaims();
    }

    function openClaimCase(DepositEscrow escrow) external {
        escrow.openClaimCase();
    }

    function proposeDecision(
        DepositEscrow escrow,
        uint256 caseId,
        DepositEscrow.DecisionInput[] calldata result,
        bytes32 reasonsCommitment
    ) external {
        escrow.proposeDecision(caseId, result, reasonsCommitment);
    }

    function challenge(
        DepositEscrow escrow,
        uint256 caseId,
        bytes32 commitment
    ) external {
        escrow.challenge(caseId, commitment);
    }

    function finalizePrimary(DepositEscrow escrow, uint256 caseId) external {
        escrow.finalizePrimary(caseId);
    }

    function proposeSettlement(
        DepositEscrow escrow,
        uint256 tenantShare,
        uint256 landlordShare,
        uint256 revision,
        uint256 validUntil,
        bytes32 detailsHash
    ) external returns (uint256) {
        return escrow.proposeSettlement(
            tenantShare,
            landlordShare,
            revision,
            validUntil,
            detailsHash
        );
    }

    function confirmSettlement(DepositEscrow escrow, uint256 proposalId) external {
        escrow.confirmSettlement(proposalId);
    }

    function tryFund(
        DepositEscrow escrow,
        uint256 amount
    ) external returns (bool) {
        try escrow.fund(amount) {
            return true;
        } catch {
            return false;
        }
    }
}

contract DepositEscrowTest {
    Vm private constant vm = Vm(
        address(uint160(uint256(keccak256("hevm cheat code"))))
    );
    bytes32 private constant PROFILE_ID = keccak256("escrow-profile");
    bytes32 private constant SERVICE_HASH = keccak256("escrow-service");
    bytes32 private constant TERMS_HASH = keccak256("lease-terms");
    bytes32 private constant TIMING_ID = keccak256("normal");
    bytes32 private constant TIMEOUT_POLICY = keccak256("tenant-return");
    uint256 private constant DEPOSIT = 1000e6;

    function testExactFundingCreatesActiveEscrow() public {
        (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        ) = _newEscrow();

        tenant.acceptTerms(escrow, TERMS_HASH);
        tenant.approveToken(token, address(escrow), DEPOSIT);
        tenant.fund(escrow, DEPOSIT);

        require(
            uint256(escrow.phase()) == uint256(DepositEscrow.Phase.Active),
            "not active"
        );
        DepositEscrow.Accounting memory accounting = escrow.getAccounting();
        require(accounting.fundedAmount == DEPOSIT, "funded mismatch");
        require(accounting.unallocated == DEPOSIT, "unallocated mismatch");
        require(token.balanceOf(address(escrow)) == DEPOSIT, "token mismatch");
        registry;
    }

    function testWrongAmountAndWrongCallerFail() public {
        (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        ) = _newEscrow();

        tenant.acceptTerms(escrow, TERMS_HASH);
        tenant.approveToken(token, address(escrow), DEPOSIT);
        require(!tenant.tryFund(escrow, DEPOSIT - 1), "wrong amount funded");

        EscrowTestActor stranger = new EscrowTestActor();
        require(!stranger.tryFund(escrow, DEPOSIT), "stranger funded");
        registry;
    }

    function testRevokedBeforeFundingFailsWithoutTransfer() public {
        (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        ) = _newEscrow();

        tenant.acceptTerms(escrow, TERMS_HASH);
        tenant.approveToken(token, address(escrow), DEPOSIT);

        EscrowTestActor primary = _primary;
        primary.revokeProfile(registry, PROFILE_ID);

        require(!tenant.tryFund(escrow, DEPOSIT), "revoked service funded");
        require(token.balanceOf(address(escrow)) == 0, "fund transferred");
    }

    function testClaimsCloseTo700100200() public {
        (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        ) = _newEscrow();

        tenant.acceptTerms(escrow, TERMS_HASH);
        tenant.approveToken(token, address(escrow), DEPOSIT);
        tenant.fund(escrow, DEPOSIT);

        DepositEscrow.Terms memory terms = escrow.getTerms();
        vm.warp(terms.leaseEndAt + 1);
        EscrowTestActor landlord = EscrowTestActor(terms.landlord);
        landlord.startSettlement(escrow);

        DepositEscrow.ClaimInput[] memory claims = new DepositEscrow.ClaimInput[](2);
        claims[0] = DepositEscrow.ClaimInput(100e6, keccak256("cleaning"));
        claims[1] = DepositEscrow.ClaimInput(200e6, keccak256("damage"));
        landlord.submitClaims(escrow, claims);

        vm.warp(terms.claimDeadline + 1);
        landlord.closeClaims(escrow);
        DepositEscrow.Accounting memory afterClose = escrow.getAccounting();
        require(afterClose.tenantCredit == 700e6, "tenant 700 missing");
        require(afterClose.landlordCredit == 0, "landlord allocated early");
        require(afterClose.unallocated == 300e6, "unallocated mismatch");

        tenant.respondClaim(escrow, 1, true, keccak256("accepted-cleaning"));
        DepositEscrow.Accounting memory afterResponse = escrow.getAccounting();
        require(afterResponse.tenantCredit == 700e6, "tenant changed");
        require(afterResponse.landlordCredit == 100e6, "landlord 100 missing");
        require(afterResponse.unallocated == 200e6, "disputed 200 missing");

        vm.warp(terms.responseDeadline + 1);
        landlord.openClaimCase(escrow);
        DepositEscrow.ActiveCase memory activeCase = escrow.getActiveCase();
        require(activeCase.exists, "case missing");
        require(activeCase.disputedAmount == 200e6, "case amount mismatch");
        require(
            uint256(escrow.phase()) == uint256(DepositEscrow.Phase.ClaimCase),
            "wrong claim case phase"
        );
        registry;
    }

    function testPrimaryDecisionSplitsRemainingDispute() public {
        (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        ) = _newEscrow();
        tenant.acceptTerms(escrow, TERMS_HASH);
        tenant.approveToken(token, address(escrow), DEPOSIT);
        tenant.fund(escrow, DEPOSIT);

        DepositEscrow.Terms memory terms = escrow.getTerms();
        EscrowTestActor landlord = EscrowTestActor(terms.landlord);
        vm.warp(terms.leaseEndAt + 1);
        landlord.startSettlement(escrow);
        DepositEscrow.ClaimInput[] memory claims = new DepositEscrow.ClaimInput[](2);
        claims[0] = DepositEscrow.ClaimInput(100e6, keccak256("cleaning"));
        claims[1] = DepositEscrow.ClaimInput(200e6, keccak256("damage"));
        landlord.submitClaims(escrow, claims);
        vm.warp(terms.claimDeadline + 1);
        landlord.closeClaims(escrow);
        tenant.respondClaim(escrow, 1, true, keccak256("accepted-cleaning"));
        vm.warp(terms.responseDeadline + 1);
        landlord.openClaimCase(escrow);
        vm.warp(terms.evidenceDeadline + 1);

        DepositEscrow.DecisionInput[] memory result = new DepositEscrow.DecisionInput[](1);
        result[0] = DepositEscrow.DecisionInput(2, 50e6);
        _primary.proposeDecision(
            escrow,
            1,
            result,
            keccak256("primary-reasons")
        );
        vm.warp(terms.challengeDeadline + 1);
        landlord.finalizePrimary(escrow, 1);

        DepositEscrow.Accounting memory accounting = escrow.getAccounting();
        require(accounting.tenantCredit == 850e6, "tenant split mismatch");
        require(accounting.landlordCredit == 150e6, "landlord split mismatch");
        require(accounting.unallocated == 0, "unallocated remains");
        registry;
    }

    EscrowTestActor private _primary;

    function _newEscrow()
        private
        returns (
            ResolverRegistry registry,
            EscrowTestToken token,
            EscrowTestActor tenant,
            DepositEscrow escrow
        )
    {
        registry = new ResolverRegistry();
        token = new EscrowTestToken();
        tenant = new EscrowTestActor();
        EscrowTestActor landlord = new EscrowTestActor();
        _primary = new EscrowTestActor();
        EscrowTestActor fallbackResolver = new EscrowTestActor();

        registry.createProfile(
            IResolverRegistry.ServiceProfile({
                profileId: PROFILE_ID,
                serviceTermsHash: SERVICE_HASH,
                ruleVersion: 1,
                primaryResolver: address(_primary),
                fallbackResolver: address(fallbackResolver),
                token: address(token),
                maxDeposit: DEPOSIT,
                maxLeaseEnd: type(uint256).max,
                acceptUntil: type(uint256).max,
                timingProfileId: TIMING_ID
            })
        );
        _primary.acceptProfile(registry, PROFILE_ID);
        fallbackResolver.acceptProfile(registry, PROFILE_ID);

        uint256 nowAtSetup = block.timestamp;
        DepositEscrow.Terms memory terms = DepositEscrow.Terms({
            leaseId: keccak256(abi.encode(address(tenant), block.number)),
            tenant: address(tenant),
            landlord: address(landlord),
            primaryResolver: address(_primary),
            fallbackResolver: address(fallbackResolver),
            token: address(token),
            depositAmount: DEPOSIT,
            leaseEndAt: nowAtSetup + 2 days,
            hardEndAt: nowAtSetup + 19 days,
            timeoutPolicy: TIMEOUT_POLICY,
            termsHash: TERMS_HASH,
            ruleVersion: 1,
            timingProfileId: TIMING_ID,
            serviceProfileId: PROFILE_ID,
            serviceTermsHash: SERVICE_HASH,
            registryAddress: address(registry),
            acceptDeadline: nowAtSetup + 1 days,
            claimDeadline: nowAtSetup + 3 days,
            responseDeadline: nowAtSetup + 4 days,
            evidenceDeadline: nowAtSetup + 5 days,
            primaryDeadline: nowAtSetup + 6 days,
            challengeDeadline: nowAtSetup + 9 days,
            fallbackDeadline: nowAtSetup + 16 days,
            exitNoticeDeadline: nowAtSetup + 19 days
        });
        escrow = new DepositEscrow(terms);
        token.mint(address(tenant), DEPOSIT);
    }
}
