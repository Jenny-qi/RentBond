// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockUSD} from "../src/MockUSD.sol";
import {TestActor} from "./TestHelpers.sol";

contract MockUSDTest {
    uint256 private constant ONE_HUNDRED = 100e6;

    function testMetadataAndMintingAreRestrictedToOperator() public {
        MockUSD token = new MockUSD(address(this));
        TestActor stranger = new TestActor();

        require(keccak256(bytes(token.name())) == keccak256("RentBond Mock USD"), "wrong name");
        require(keccak256(bytes(token.symbol())) == keccak256("MockUSD"), "wrong symbol");
        require(token.decimals() == 6, "wrong decimals");
        require(token.mintOperator() == address(this), "wrong operator");
        require(
            !stranger.tryExecute(address(token), abi.encodeCall(token.mint, (address(stranger), ONE_HUNDRED))),
            "non-operator minted"
        );

        token.mint(address(stranger), ONE_HUNDRED);
        require(token.totalSupply() == ONE_HUNDRED, "supply mismatch");
        require(token.balanceOf(address(stranger)) == ONE_HUNDRED, "mint balance mismatch");
    }

    function testZeroOperatorSpenderAndRecipientAreRejected() public {
        bool zeroOperatorAccepted;
        try new MockUSD(address(0)) returns (MockUSD) {
            zeroOperatorAccepted = true;
        } catch {}
        require(!zeroOperatorAccepted, "zero operator accepted");

        MockUSD token = new MockUSD(address(this));
        TestActor holder = new TestActor();
        token.mint(address(holder), ONE_HUNDRED);

        require(
            !holder.tryExecute(address(token), abi.encodeCall(token.approve, (address(0), 1))), "zero spender approved"
        );
        require(
            !holder.tryExecute(address(token), abi.encodeCall(token.transfer, (address(0), 1))),
            "zero recipient received transfer"
        );
        bool zeroMintAccepted;
        try token.mint(address(0), 1) {
            zeroMintAccepted = true;
        } catch {}
        require(!zeroMintAccepted, "zero recipient received mint");
    }

    function testFiniteAllowanceDecrementsAndCannotBeExceeded() public {
        MockUSD token = new MockUSD(address(this));
        TestActor holder = new TestActor();
        TestActor spender = new TestActor();
        TestActor recipient = new TestActor();
        token.mint(address(holder), ONE_HUNDRED);

        holder.execute(address(token), abi.encodeCall(token.approve, (address(spender), 60e6)));
        spender.execute(address(token), abi.encodeCall(token.transferFrom, (address(holder), address(recipient), 40e6)));

        require(token.allowance(address(holder), address(spender)) == 20e6, "allowance not decremented");
        require(token.balanceOf(address(holder)) == 60e6, "holder balance mismatch");
        require(token.balanceOf(address(recipient)) == 40e6, "recipient balance mismatch");
        require(
            !spender.tryExecute(
                address(token), abi.encodeCall(token.transferFrom, (address(holder), address(recipient), 20e6 + 1))
            ),
            "spender exceeded allowance"
        );
    }

    function testInfiniteAllowanceAndTransfersPreserveSupply() public {
        MockUSD token = new MockUSD(address(this));
        TestActor holder = new TestActor();
        TestActor spender = new TestActor();
        TestActor recipient = new TestActor();
        token.mint(address(holder), ONE_HUNDRED);

        holder.execute(address(token), abi.encodeCall(token.approve, (address(spender), type(uint256).max)));
        spender.execute(address(token), abi.encodeCall(token.transferFrom, (address(holder), address(recipient), 25e6)));
        recipient.execute(address(token), abi.encodeCall(token.transfer, (address(holder), 5e6)));

        require(token.allowance(address(holder), address(spender)) == type(uint256).max, "max allowance changed");
        require(token.balanceOf(address(holder)) == 80e6, "holder balance mismatch");
        require(token.balanceOf(address(recipient)) == 20e6, "recipient balance mismatch");
        require(token.totalSupply() == ONE_HUNDRED, "transfers changed supply");
    }
}
