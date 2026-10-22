"use client";

import { useState } from "react";
import { bidRequirement, formatEth, validateBid, type AuctionStatus } from "@/lib/auction-state";

const BUTTON =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";

type BidFormProps = {
  minPrice: bigint;
  highestBid: bigint;
  disabled: boolean;
  onBid: (value: bigint) => Promise<boolean>;
};

/** Formulario de puja con validación previa al envío. */
export function BidForm({ minPrice, highestBid, disabled, onBid }: BidFormProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateBid(amount, minPrice, highestBid);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (await onBid(result.value)) setAmount("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="bid" className="text-sm font-medium">
        Tu puja (ETH)
      </label>
      <div className="flex gap-2">
        <input
          id="bid"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          value={amount}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby="bid-help"
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={BUTTON} disabled={disabled}>
          Pujar
        </button>
      </div>
      <p id="bid-help" className={`text-sm ${error ? "text-red-700" : "text-neutral-600 dark:text-neutral-400"}`}>
        {error ?? bidRequirement(minPrice, highestBid)}
      </p>
    </form>
  );
}

type ActionsProps = {
  status: AuctionStatus;
  isSeller: boolean;
  minPrice: bigint;
  highestBid: bigint;
  pendingReturns: bigint;
  /** Acción en curso; deshabilita todas las acciones. */
  pending: string | null;
  /** Red no disponible o sin cuenta activa. */
  disabled: boolean;
  onBid: (value: bigint) => Promise<boolean>;
  onWithdraw: () => void;
  onClose: () => void;
};

/** Pujar, retirar y cerrar, mostradas según el estado de la subasta y la cuenta activa. */
export function AuctionActions(props: ActionsProps) {
  const { status, isSeller, pendingReturns, pending } = props;
  const locked = props.disabled || pending !== null;
  const canBid = status === "open" && !isSeller;
  const canWithdraw = pendingReturns > 0n;
  const canClose = status === "ready";

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Acciones</h2>

      {canBid && (
        <BidForm minPrice={props.minPrice} highestBid={props.highestBid} disabled={locked} onBid={props.onBid} />
      )}
      {status === "open" && isSeller && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Esta cuenta es el vendedor: no puede pujar en su propia subasta.
        </p>
      )}

      {canWithdraw && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            Saldo retirable: <strong>{formatEth(pendingReturns)}</strong>
          </p>
          <button type="button" className={BUTTON} disabled={locked} onClick={props.onWithdraw}>
            Retirar
          </button>
        </div>
      )}

      {canClose && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">El plazo terminó. Cualquier cuenta puede cerrar la subasta.</p>
          <button type="button" className={BUTTON} disabled={locked} onClick={props.onClose}>
            Cerrar subasta
          </button>
        </div>
      )}

      {!canBid && !canWithdraw && !canClose && !(status === "open" && isSeller) && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">No hay acciones disponibles para esta cuenta.</p>
      )}

      {pending && (
        <p role="status" className="text-sm text-blue-800 dark:text-blue-300">
          {pending}… esperando confirmación.
        </p>
      )}
    </section>
  );
}
