import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { chain, RPC_URL } from "./config";

export type Clients = {
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain>;
};

/**
 * Crea los clientes de viem para un nodo anvil. Las escrituras usan las cuentas
 * desbloqueadas del nodo (cuentas JSON-RPC): firma anvil, no el navegador.
 */
export function createClients(rpcUrl: string, pollingInterval = 1_000): Clients {
  const transport = http(rpcUrl);
  return {
    publicClient: createPublicClient({ chain, transport, pollingInterval }),
    walletClient: createWalletClient({ chain, transport, pollingInterval }),
  };
}

/** Clientes de la aplicación, conectados a `NEXT_PUBLIC_RPC_URL`. */
export const clients = createClients(RPC_URL);
