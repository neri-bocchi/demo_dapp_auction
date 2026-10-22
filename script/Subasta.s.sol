// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Auction} from "../src/Auction.sol";

/// @notice Despliega una subasta. Lee `MIN_PRICE` (wei) y `DURATION` (segundos) del entorno.
/// @dev La cuenta que firma el broadcast queda como vendedor.
contract DeployAuction is Script {
    function run() external returns (Auction auction) {
        uint256 minPrice = vm.envUint("MIN_PRICE");
        uint256 duration = vm.envUint("DURATION");

        vm.startBroadcast();
        auction = new Auction(minPrice, duration);
        vm.stopBroadcast();

        console.log("Auction:", address(auction));
        console.log("Seller:", auction.seller());
        console.log("End time:", auction.endTime());
    }
}
