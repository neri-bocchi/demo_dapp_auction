"use client";

import { useEffect, useState } from "react";
import { getChainStatus, type ChainStatus } from "@/lib/auction-client";
import { clients } from "@/lib/clients";

/** Comprueba periódicamente que el nodo responde y es anvil. `null` mientras se comprueba. */
export function useChainStatus(intervalMs = 2_000): ChainStatus | null {
  const [status, setStatus] = useState<ChainStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await getChainStatus(clients);
      if (!cancelled) setStatus(next);
    };
    void check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return status;
}
