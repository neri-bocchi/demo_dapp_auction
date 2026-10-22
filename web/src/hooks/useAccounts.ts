"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { listAccounts, type AccountInfo } from "@/lib/auction-client";
import { clients } from "@/lib/clients";

const STORAGE_KEY = "auction.account";

function loadStored(): Address | null {
  try {
    return localStorage.getItem(STORAGE_KEY) as Address | null;
  } catch {
    return null;
  }
}

function store(address: Address) {
  try {
    localStorage.setItem(STORAGE_KEY, address);
  } catch {
    // almacenamiento no disponible (modo privado, etc.): la elección no persiste
  }
}

/**
 * Cuentas desbloqueadas de anvil con su saldo y la cuenta activa, que se guarda
 * en localStorage. Si la guardada no existe en el nodo, se usa la primera.
 */
export function useAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [active, setActiveState] = useState<Address | undefined>();

  const apply = useCallback((list: AccountInfo[]) => {
    setAccounts(list);
    setActiveState((current) => {
      const preferred = current ?? loadStored();
      const match = list.find((a) => a.address.toLowerCase() === preferred?.toLowerCase());
      return match?.address ?? list[0]?.address;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await listAccounts(clients));
    } catch {
      // el aviso de red lo muestra NetworkGuard
    }
  }, [apply]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listAccounts(clients).then(
      (list) => {
        if (!cancelled) apply(list);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, apply]);

  const setActive = useCallback((address: Address) => {
    setActiveState(address);
    store(address);
  }, []);

  return { accounts, active, setActive, refresh };
}
