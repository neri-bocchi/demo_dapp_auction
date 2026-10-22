"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readBidHistory, type BidEntry } from "@/lib/auction-client";
import { clients } from "@/lib/clients";

/** Historial de pujas (eventos `BidPlaced`), releído con cada bloque nuevo. `null` hasta la primera lectura. */
export function useBidHistory(address: Address, enabled: boolean) {
  const [bids, setBids] = useState<BidEntry[] | null>(null);

  const load = useCallback(() => readBidHistory(clients, address), [address]);

  const refresh = useCallback(async () => {
    try {
      setBids(await load());
    } catch {
      // nodo caído: se conserva la última lectura
    }
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const update = () =>
      load().then(
        (next) => {
          if (!cancelled) setBids(next);
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

  return { bids, refresh };
}
