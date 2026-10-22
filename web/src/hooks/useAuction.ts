"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readAuction, type AuctionRead } from "@/lib/auction-client";
import { chainNow } from "@/lib/auction-state";
import { clients } from "@/lib/clients";

/**
 * Estado de la subasta (y saldos de `account`), releído con cada bloque nuevo.
 * `refresh` permite forzar una lectura tras una transacción.
 */
export function useAuction(address: Address, account: Address | undefined, enabled: boolean) {
  const [read, setRead] = useState<AuctionRead | null>(null);

  const load = useCallback(() => readAuction(clients, address, account), [address, account]);

  const refresh = useCallback(async () => {
    try {
      setRead(await load());
    } catch {
      // nodo caído: se conserva la última lectura y NetworkGuard muestra el aviso
    }
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const update = () =>
      load().then(
        (next) => {
          if (!cancelled) setRead(next);
        },
        () => {},
      );
    void update();
    const unwatch = clients.publicClient.watchBlockNumber({ onBlockNumber: update, onError: () => {} });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [enabled, load]);

  return { read, refresh };
}

/** Reloj de la cadena estimado que avanza cada segundo (ver `chainNow`). */
export function useChainClock(blockTimestamp: bigint | undefined, fetchedAt: number | undefined): bigint | undefined {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (blockTimestamp === undefined || fetchedAt === undefined) return undefined;
  return chainNow(blockTimestamp, fetchedAt, Math.max(now, fetchedAt));
}
