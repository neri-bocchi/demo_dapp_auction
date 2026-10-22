import { isAddress, type Address } from "viem";
import { anvil } from "viem/chains";

/** Red soportada: solo anvil local (chain id 31337). */
export const chain = anvil;

/** URL del nodo JSON-RPC. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

const configuredAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;

/** Subasta por defecto para la página de inicio, si hay una configurada y es válida. */
export const AUCTION_ADDRESS: Address | undefined =
  configuredAddress && isAddress(configuredAddress) ? configuredAddress : undefined;
