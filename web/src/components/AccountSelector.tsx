"use client";

import type { Address } from "viem";
import type { AccountInfo } from "@/lib/auction-client";
import { formatEthRounded, shortAddress } from "@/lib/auction-state";

type Props = {
  accounts: AccountInfo[];
  active: Address | undefined;
  seller: Address | undefined;
  onChange: (address: Address) => void;
  disabled?: boolean;
};

/** Selector de la cuenta de anvil en cuyo nombre se envían las transacciones. */
export function AccountSelector({ accounts, active, seller, onChange, disabled }: Props) {
  const current = accounts.find((a) => a.address === active);
  const isSeller = !!active && !!seller && active.toLowerCase() === seller.toLowerCase();

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <label htmlFor="account" className="mb-2 block text-sm font-medium">
        Cuenta activa (anvil)
      </label>
      <select
        id="account"
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-neutral-700"
        value={active ?? ""}
        disabled={disabled || accounts.length === 0}
        onChange={(e) => onChange(e.target.value as Address)}
      >
        {accounts.length === 0 && <option value="">Cargando cuentas…</option>}
        {accounts.map((account, i) => (
          <option key={account.address} value={account.address}>
            #{i} {shortAddress(account.address)}
            {seller && account.address.toLowerCase() === seller.toLowerCase() ? " (vendedor)" : ""}
          </option>
        ))}
      </select>
      {current && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-mono break-all">{current.address}</span>
          <br />
          Saldo: {formatEthRounded(current.balance)}
          {isSeller && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">vendedor</span>}
        </p>
      )}
    </section>
  );
}
