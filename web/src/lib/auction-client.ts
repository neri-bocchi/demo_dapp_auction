import type { Address, Hash, TransactionReceipt } from "viem";
import { auctionAbi } from "./auction-abi";
import type { Clients } from "./clients";
import { chain } from "./config";

export type ChainStatus = "ok" | "down" | "wrong-chain";

export type AccountInfo = { address: Address; balance: bigint };

export type AuctionData = {
  seller: Address;
  minPrice: bigint;
  endTime: bigint;
  highestBidder: Address;
  highestBid: bigint;
  ended: boolean;
  /** Saldo retirable de la cuenta consultada (0 si no se indicó cuenta). */
  pendingReturns: bigint;
  /** Saldo en ETH de la cuenta consultada (0 si no se indicó cuenta). */
  accountBalance: bigint;
  /** Timestamp del último bloque, en segundos. */
  blockTimestamp: bigint;
  /** Instante local (ms) en que se leyó `blockTimestamp`. */
  fetchedAt: number;
};

export type AuctionRead =
  | { kind: "ok"; data: AuctionData }
  | { kind: "no-contract" }
  | { kind: "not-auction" };

/** Comprueba que el nodo responde y que es la red anvil. */
export async function getChainStatus({ publicClient }: Clients): Promise<ChainStatus> {
  try {
    const id = await publicClient.getChainId();
    return id === chain.id ? "ok" : "wrong-chain";
  } catch {
    return "down";
  }
}

/** Cuentas desbloqueadas del nodo con su saldo. */
export async function listAccounts({ publicClient, walletClient }: Clients): Promise<AccountInfo[]> {
  const addresses = await walletClient.getAddresses();
  const balances = await Promise.all(addresses.map((address) => publicClient.getBalance({ address })));
  return addresses.map((address, i) => ({ address, balance: balances[i] }));
}

/** Lee el estado de la subasta y, si se indica, los saldos de `account`. */
export async function readAuction(
  { publicClient }: Clients,
  address: Address,
  account?: Address,
): Promise<AuctionRead> {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") return { kind: "no-contract" };

  const contract = { address, abi: auctionAbi } as const;
  const [block, getters, accountBalance] = await Promise.all([
    publicClient.getBlock(),
    Promise.all([
      publicClient.readContract({ ...contract, functionName: "seller" }),
      publicClient.readContract({ ...contract, functionName: "minPrice" }),
      publicClient.readContract({ ...contract, functionName: "endTime" }),
      publicClient.readContract({ ...contract, functionName: "highestBidder" }),
      publicClient.readContract({ ...contract, functionName: "highestBid" }),
      publicClient.readContract({ ...contract, functionName: "ended" }),
      account
        ? publicClient.readContract({ ...contract, functionName: "pendingReturns", args: [account] })
        : Promise.resolve(0n),
    ]).catch(() => null),
    account ? publicClient.getBalance({ address: account }) : Promise.resolve(0n),
  ]);
  if (!getters) return { kind: "not-auction" };

  const [seller, minPrice, endTime, highestBidder, highestBid, ended, pendingReturns] = getters;
  return {
    kind: "ok",
    data: {
      seller,
      minPrice,
      endTime,
      highestBidder,
      highestBid,
      ended,
      pendingReturns,
      accountBalance,
      blockTimestamp: block.timestamp,
      fetchedAt: Date.now(),
    },
  };
}

/** Espera la confirmación de `hash` y falla si la transacción revirtió. */
async function confirm({ publicClient }: Clients, hash: Hash): Promise<TransactionReceipt> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`La transacción ${hash} fue revertida`);
  return receipt;
}

// Cada escritura simula primero para detectar reverts (y decodificar el error)
// antes de enviar la transacción.

export async function placeBid(clients: Clients, address: Address, account: Address, value: bigint) {
  const { request } = await clients.publicClient.simulateContract({
    address,
    abi: auctionAbi,
    functionName: "bid",
    account,
    value,
  });
  return confirm(clients, await clients.walletClient.writeContract(request));
}

export async function withdraw(clients: Clients, address: Address, account: Address) {
  const { request } = await clients.publicClient.simulateContract({
    address,
    abi: auctionAbi,
    functionName: "withdraw",
    account,
  });
  return confirm(clients, await clients.walletClient.writeContract(request));
}

export async function endAuction(clients: Clients, address: Address, account: Address) {
  const { request } = await clients.publicClient.simulateContract({
    address,
    abi: auctionAbi,
    functionName: "endAuction",
    account,
  });
  return confirm(clients, await clients.walletClient.writeContract(request));
}
