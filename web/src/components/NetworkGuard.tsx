import type { ChainStatus } from "@/lib/auction-client";
import { chain, RPC_URL } from "@/lib/config";

/** Aviso cuando el nodo no responde o no es anvil. No muestra nada si la red está bien. */
export function NetworkGuard({ status }: { status: ChainStatus | null }) {
  if (status === null || status === "ok") return null;

  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      {status === "down" ? (
        <>
          <p className="font-medium">No hay conexión con el nodo en {RPC_URL}.</p>
          <p>
            Inicia <code className="font-mono">anvil</code> en otra terminal. Las acciones están deshabilitadas
            hasta que vuelva la conexión.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Red no soportada.</p>
          <p>
            El nodo en {RPC_URL} no es anvil (chain id {chain.id}). Las acciones están deshabilitadas.
          </p>
        </>
      )}
    </div>
  );
}
