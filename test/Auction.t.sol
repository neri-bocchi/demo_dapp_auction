// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Auction} from "../src/Auction.sol";

/// Vendedor que rechaza cualquier ETH entrante.
contract RejectingSeller {
    function createAuction(uint256 minPrice, uint256 duration) external returns (Auction) {
        return new Auction(minPrice, duration);
    }
}

/// Postor que rechaza cualquier ETH entrante.
contract RejectingBidder {
    function bid(Auction auction) external payable {
        auction.bid{value: msg.value}();
    }

    function withdraw(Auction auction) external {
        auction.withdraw();
    }
}

/// Postor que intenta volver a retirar al recibir ETH.
contract ReentrantBidder {
    Auction public immutable auction;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(Auction auction_) {
        auction = auction_;
    }

    function bid() external payable {
        auction.bid{value: msg.value}();
    }

    function withdraw() external {
        auction.withdraw();
    }

    receive() external payable {
        if (reentryAttempts == 0) {
            reentryAttempts++;
            try auction.withdraw() {
                reentrySucceeded = true;
            } catch {}
        }
    }
}

contract AuctionTest is Test {
    uint256 constant MIN_PRICE = 1 ether;
    uint256 constant DURATION = 1 hours;

    Auction auction;
    address seller = makeAddr("seller");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.prank(seller);
        auction = new Auction(MIN_PRICE, DURATION);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // --- Configuración ---

    function test_Constructor_SetsParameters() public view {
        assertEq(auction.seller(), seller);
        assertEq(auction.minPrice(), MIN_PRICE);
        assertEq(auction.endTime(), block.timestamp + DURATION);
    }

    function test_Constructor_RevertsOnZeroDuration() public {
        vm.expectRevert(Auction.ZeroDuration.selector);
        new Auction(MIN_PRICE, 0);
    }

    function test_Constructor_AllowsZeroMinPrice() public {
        Auction free = new Auction(0, DURATION);
        assertEq(free.minPrice(), 0);
    }

    function test_DirectTransfer_Reverts() public {
        vm.prank(alice);
        (bool ok,) = address(auction).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(auction).balance, 0);
    }

    // --- Pujas ---

    function _bid(address bidder, uint256 amount) internal {
        vm.prank(bidder);
        auction.bid{value: amount}();
    }

    function test_Bid_FirstValidBid() public {
        _bid(alice, 1 ether);
        assertEq(auction.highestBidder(), alice);
        assertEq(auction.highestBid(), 1 ether);
        assertEq(auction.pendingReturns(alice), 0);
    }

    function test_Bid_EmitsEvent() public {
        vm.expectEmit(true, false, false, true, address(auction));
        emit Auction.BidPlaced(alice, 1 ether);
        _bid(alice, 1 ether);
    }

    function test_Bid_RevertsBelowMinPrice() public {
        vm.prank(alice);
        vm.expectRevert(Auction.BidTooLow.selector);
        auction.bid{value: 0.5 ether}();
    }

    function test_Bid_RevertsIfNotHigherThanHighest() public {
        _bid(alice, 2 ether);
        vm.prank(bob);
        vm.expectRevert(Auction.BidTooLow.selector);
        auction.bid{value: 2 ether}();
        assertEq(auction.highestBidder(), alice);
        assertEq(auction.highestBid(), 2 ether);
    }

    function test_Bid_RevertsAtEndTime() public {
        vm.warp(auction.endTime());
        vm.prank(alice);
        vm.expectRevert(Auction.AuctionEnded.selector);
        auction.bid{value: 1 ether}();
    }

    function test_Bid_RevertsAfterEndTime() public {
        vm.warp(auction.endTime() + 1);
        vm.prank(alice);
        vm.expectRevert(Auction.AuctionEnded.selector);
        auction.bid{value: 1 ether}();
    }

    function test_Bid_RevertsForSeller() public {
        vm.deal(seller, 10 ether);
        vm.prank(seller);
        vm.expectRevert(Auction.SellerCannotBid.selector);
        auction.bid{value: 1 ether}();
    }

    function test_Bid_ZeroMinPriceAcceptsAnyPositiveBid() public {
        Auction free = new Auction(0, DURATION);
        vm.prank(alice);
        free.bid{value: 1 wei}();
        assertEq(free.highestBid(), 1 wei);
    }

    function test_Bid_ZeroMinPriceRejectsZeroBid() public {
        Auction free = new Auction(0, DURATION);
        vm.prank(alice);
        vm.expectRevert(Auction.BidTooLow.selector);
        free.bid{value: 0}();
    }

    function test_Bid_HighestBidderRaisesOwnBid() public {
        _bid(alice, 1 ether);
        _bid(alice, 2 ether);
        assertEq(auction.highestBidder(), alice);
        assertEq(auction.highestBid(), 2 ether);
        assertEq(auction.pendingReturns(alice), 1 ether);
    }

    function test_Bid_OutbidCreditsPreviousBidder() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        assertEq(auction.pendingReturns(alice), 1 ether);
        assertEq(auction.pendingReturns(bob), 0);
    }

    function test_Bid_OutbidMultipleTimesAccumulates() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        _bid(alice, 3 ether);
        _bid(bob, 4 ether);
        assertEq(auction.pendingReturns(alice), 4 ether);
        assertEq(auction.pendingReturns(bob), 2 ether);
        assertEq(auction.highestBidder(), bob);
        assertEq(auction.highestBid(), 4 ether);
    }

    /// El balance del contrato siempre cubre exactamente la puja más alta más
    /// todos los saldos retirables, para cualquier secuencia de pujas.
    function testFuzz_Bid_BalanceMatchesAccounting(uint8[16] calldata bidders, uint64[16] calldata amounts) public {
        address[3] memory pool = [alice, bob, makeAddr("carol")];
        for (uint256 i = 0; i < pool.length; i++) {
            vm.deal(pool[i], 1_000 ether);
        }

        for (uint256 i = 0; i < bidders.length; i++) {
            address bidder = pool[bidders[i] % pool.length];
            vm.prank(bidder);
            try auction.bid{value: amounts[i]}() {} catch {}
        }

        uint256 pending;
        for (uint256 i = 0; i < pool.length; i++) {
            pending += auction.pendingReturns(pool[i]);
        }
        assertEq(address(auction).balance, auction.highestBid() + pending);
    }

    // --- Retiros ---

    function test_Withdraw_Succeeds() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        uint256 before = alice.balance;

        vm.expectEmit(true, false, false, true, address(auction));
        emit Auction.Withdrawn(alice, 1 ether);
        vm.prank(alice);
        auction.withdraw();

        assertEq(alice.balance, before + 1 ether);
        assertEq(auction.pendingReturns(alice), 0);
        assertEq(address(auction).balance, 2 ether);
    }

    function test_Withdraw_RevertsWithoutBalance() public {
        vm.prank(alice);
        vm.expectRevert(Auction.NothingToWithdraw.selector);
        auction.withdraw();
    }

    function test_Withdraw_HighestBidderCannotWithdrawCurrentBid() public {
        _bid(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(Auction.NothingToWithdraw.selector);
        auction.withdraw();
    }

    function test_Withdraw_SecondWithdrawReverts() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        vm.startPrank(alice);
        auction.withdraw();
        uint256 afterFirst = alice.balance;
        vm.expectRevert(Auction.NothingToWithdraw.selector);
        auction.withdraw();
        vm.stopPrank();
        assertEq(alice.balance, afterFirst);
    }

    function test_Withdraw_AfterEndTime() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        vm.warp(auction.endTime() + 1 days);
        uint256 before = alice.balance;
        vm.prank(alice);
        auction.withdraw();
        assertEq(alice.balance, before + 1 ether);
    }

    function test_Withdraw_FailedTransferKeepsBalance() public {
        RejectingBidder rejecting = new RejectingBidder();
        rejecting.bid{value: 1 ether}(auction);
        _bid(bob, 2 ether);

        vm.expectRevert(Auction.TransferFailed.selector);
        rejecting.withdraw(auction);
        assertEq(auction.pendingReturns(address(rejecting)), 1 ether);
        assertEq(address(auction).balance, 3 ether);
    }

    function test_Withdraw_ReentrancyGetsNothingExtra() public {
        ReentrantBidder attacker = new ReentrantBidder(auction);
        attacker.bid{value: 1 ether}();
        _bid(bob, 2 ether);

        attacker.withdraw();

        assertEq(attacker.reentryAttempts(), 1);
        assertFalse(attacker.reentrySucceeded());
        assertEq(address(attacker).balance, 1 ether);
        assertEq(auction.pendingReturns(address(attacker)), 0);
        assertEq(address(auction).balance, 2 ether);
    }

    // --- Cierre y pago al vendedor ---

    function test_EndAuction_WithWinner() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        vm.warp(auction.endTime());
        uint256 sellerBefore = seller.balance;

        vm.expectEmit(true, false, false, true, address(auction));
        emit Auction.AuctionClosed(bob, 2 ether);
        vm.prank(alice);
        auction.endAuction();

        assertTrue(auction.ended());
        assertEq(auction.winner(), bob);
        assertEq(auction.finalPrice(), 2 ether);
        assertEq(seller.balance, sellerBefore + 2 ether);
        assertEq(address(auction).balance, 1 ether);
    }

    function test_EndAuction_WinnerUnsetBeforeClose() public {
        _bid(alice, 1 ether);
        assertEq(auction.winner(), address(0));
        assertEq(auction.finalPrice(), 0);
    }

    function test_EndAuction_RevertsBeforeEndTime() public {
        _bid(alice, 1 ether);
        vm.warp(auction.endTime() - 1);
        vm.expectRevert(Auction.AuctionNotYetEnded.selector);
        auction.endAuction();
        assertFalse(auction.ended());
    }

    function test_EndAuction_RevertsWhenAlreadyEnded() public {
        _bid(alice, 1 ether);
        vm.warp(auction.endTime());
        auction.endAuction();
        uint256 sellerAfter = seller.balance;

        vm.expectRevert(Auction.AuctionAlreadyEnded.selector);
        auction.endAuction();
        assertEq(seller.balance, sellerAfter);
    }

    function test_EndAuction_WithoutBids() public {
        vm.warp(auction.endTime());
        uint256 sellerBefore = seller.balance;

        vm.expectEmit(true, false, false, true, address(auction));
        emit Auction.AuctionClosed(address(0), 0);
        auction.endAuction();

        assertTrue(auction.ended());
        assertEq(auction.winner(), address(0));
        assertEq(auction.finalPrice(), 0);
        assertEq(seller.balance, sellerBefore);
    }

    function test_EndAuction_OutbidBidderCanStillWithdraw() public {
        _bid(alice, 1 ether);
        _bid(bob, 2 ether);
        vm.warp(auction.endTime());
        auction.endAuction();

        uint256 before = alice.balance;
        vm.prank(alice);
        auction.withdraw();
        assertEq(alice.balance, before + 1 ether);
        assertEq(address(auction).balance, 0);
    }

    function test_EndAuction_RevertsWhenSellerRejectsEth() public {
        RejectingSeller rejectingSeller = new RejectingSeller();
        Auction a = rejectingSeller.createAuction(MIN_PRICE, DURATION);
        vm.prank(alice);
        a.bid{value: 1 ether}();
        vm.warp(a.endTime());

        vm.expectRevert(Auction.TransferFailed.selector);
        a.endAuction();
        assertFalse(a.ended());
        assertEq(address(a).balance, 1 ether);
    }
}
