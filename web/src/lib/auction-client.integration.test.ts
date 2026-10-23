import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BaseError,
  ContractFunctionRevertedError,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { auctionAbi } from "./auction-abi";
import {
  endAuction,
  getChainStatus,
  listAccounts,
  placeBid,
  readAuction,
  readBidHistory,
  withdraw,
} from "./auction-client";
import { createClients, type Clients } from "./clients";

// Requiere `forge build` en la raíz del repo.
const artifact = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../out/Auction.sol/Auction.json", import.meta.url)), "utf8"),
) as { bytecode: { object: Hex } };

const MIN_PRICE = parseEther("1");
const DURATION = 3_600n;

let clients: Clients;
let seller: Address;
let alice: Address;
let bob: Address;
let auction: Address;

async function deployAuction(): Promise<Address> {
  const hash = await clients.walletClient.deployContract({
    abi: auctionAbi,
    bytecode: artifact.bytecode.object,
    args: [MIN_PRICE, DURATION],
    account: seller,
  });
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  return receipt.contractAddress!;
}

async function read(account?: Address) {
  const result = await readAuction(clients, auction, account);
  if (result.kind !== "ok") throw new Error(`lectura inesperada: ${result.kind}`);
  return result.data;
}

async function advanceTime(seconds: bigint) {
  await clients.publicClient.request({ method: "evm_increaseTime" as never, params: [Number(seconds)] as never });
  await clients.publicClient.request({ method: "evm_mine" as never, params: [] as never });
}

beforeAll(async () => {
  clients = createClients(inject("rpcUrl"), 50);
  [seller, alice, bob] = await clients.walletClient.getAddresses();
});

beforeEach(async () => {
  auction = await deployAuction();
});

describe("auction-client contra anvil", () => {
  it("detecta la red anvil", async () => {
    expect(await getChainStatus(clients)).toBe("ok");
  });

  it("detecta un nodo caído", async () => {
    expect(await getChainStatus(createClients("http://127.0.0.1:1"))).toBe("down");
  });

  it("lista las cuentas de anvil con saldo", async () => {
    const accounts = await listAccounts(clients);
    expect(accounts).toHaveLength(10);
    expect(accounts[0].address).toBe(seller);
    expect(accounts[1].balance).toBeGreaterThan(0n);
  });

  it("indica que no hay contrato en una dirección vacía", async () => {
    const result = await readAuction(clients, "0x000000000000000000000000000000000000dEaD");
    expect(result.kind).toBe("no-contract");
  });

  it("lee el estado inicial", async () => {
    const data = await read(alice);
    expect(data.seller).toBe(seller);
    expect(data.minPrice).toBe(MIN_PRICE);
    expect(data.endTime - data.blockTimestamp).toBe(DURATION);
    expect(data.highestBidder).toBe(zeroAddress);
    expect(data.highestBid).toBe(0n);
    expect(data.ended).toBe(false);
    expect(data.pendingReturns).toBe(0n);
    expect(data.accountBalance).toBeGreaterThan(0n);
  });

  it("puja, acredita al superado y le deja retirar", async () => {
    await placeBid(clients, auction, alice, parseEther("1"));
    expect((await read()).highestBidder).toBe(alice);

    await placeBid(clients, auction, bob, parseEther("2"));
    const afterOutbid = await read(alice);
    expect(afterOutbid.highestBidder).toBe(bob);
    expect(afterOutbid.highestBid).toBe(parseEther("2"));
    expect(afterOutbid.pendingReturns).toBe(parseEther("1"));

    const balanceBefore = afterOutbid.accountBalance;
    await withdraw(clients, auction, alice);
    const afterWithdraw = await read(alice);
    expect(afterWithdraw.pendingReturns).toBe(0n);
    expect(afterWithdraw.accountBalance).toBeGreaterThan(balanceBefore + parseEther("0.99"));
  });

  it("cierra tras adelantar el reloj y paga al vendedor", async () => {
    await placeBid(clients, auction, alice, parseEther("1.5"));
    const sellerBefore = await clients.publicClient.getBalance({ address: seller });

    await advanceTime(DURATION);
    const beforeClose = await read();
    expect(beforeClose.blockTimestamp).toBeGreaterThanOrEqual(beforeClose.endTime);

    await endAuction(clients, auction, bob);
    const closed = await read();
    expect(closed.ended).toBe(true);
    expect(closed.highestBidder).toBe(alice);
    expect(await clients.publicClient.getBalance({ address: seller })).toBe(sellerBefore + parseEther("1.5"));
  });

  it("decodifica el revert BidTooLow", async () => {
    await placeBid(clients, auction, alice, parseEther("2"));
    const error = await placeBid(clients, auction, bob, parseEther("2")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BaseError);
    const reverted = (error as BaseError).walk((e) => e instanceof ContractFunctionRevertedError);
    expect(reverted).toBeInstanceOf(ContractFunctionRevertedError);
    expect((reverted as ContractFunctionRevertedError).data?.errorName).toBe("BidTooLow");
  });

  it("devuelve un historial vacío sin pujas", async () => {
    expect(await readBidHistory(clients, auction)).toEqual({ bids: [], closed: false });
  });

  it("devuelve el historial de pujas en orden con su timestamp", async () => {
    const first = await placeBid(clients, auction, alice, parseEther("1"));
    await advanceTime(60n);
    const second = await placeBid(clients, auction, bob, parseEther("2"));

    const { bids: history, closed } = await readBidHistory(clients, auction);
    expect(closed).toBe(false);
    expect(history.map((b) => [b.bidder, b.amount])).toEqual([
      [alice, parseEther("1")],
      [bob, parseEther("2")],
    ]);
    expect(history[0].transactionHash).toBe(first.transactionHash);
    expect(history[1].transactionHash).toBe(second.transactionHash);

    const firstBlock = await clients.publicClient.getBlock({ blockNumber: first.blockNumber });
    expect(history[0].timestamp).toBe(firstBlock.timestamp);
    expect(history[1].timestamp).toBeGreaterThanOrEqual(history[0].timestamp + 60n);
  });

  it("marca el historial como cerrado tras AuctionClosed", async () => {
    await placeBid(clients, auction, alice, parseEther("1"));
    await advanceTime(DURATION);
    await endAuction(clients, auction, bob);
    const { bids, closed } = await readBidHistory(clients, auction);
    expect(closed).toBe(true);
    expect(bids).toHaveLength(1);
  });
});
