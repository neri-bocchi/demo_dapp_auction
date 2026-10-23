"use client";

import Link from "next/link";
import { useState } from "react";
import type { Address } from "viem";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuction, useChainClock } from "@/hooks/useAuction";
import { useBidHistory } from "@/hooks/useBidHistory";
import { useChainStatus } from "@/hooks/useChainStatus";
import { endAuction, placeBid, withdraw } from "@/lib/auction-client";
import { deriveStatus, formatEth } from "@/lib/auction-state";
import { clients } from "@/lib/clients";
import { toUserMessage } from "@/lib/errors";
import { AccountSelector } from "./AccountSelector";
import { AuctionActions } from "./AuctionActions";
import { AuctionStatus } from "./AuctionStatus";
import { BidHistory } from "./BidHistory";
import { NetworkGuard } from "./NetworkGuard";

type Feedback = { kind: "success" | "error"; text: string };

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      {children}{" "}
      <Link href="/" className="underline">
        Elegir otra dirección
      </Link>
    </div>
  );
}

/** Página de una subasta: estado en vivo, cuenta activa y acciones. */
export function AuctionView({ address }: { address: Address }) {
  const chainStatus = useChainStatus();
  const online = chainStatus === "ok";
  const { accounts, active, setActive, refresh: refreshAccounts } = useAccounts(online);
  const { read, refresh } = useAuction(address, active, online);
  const { log: bidLog, refresh: refreshBids } = useBidHistory(address, online);
  const data = read?.kind === "ok" ? read.data : undefined;
  const now = useChainClock(data?.blockTimestamp, data?.fetchedAt);

  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /** Ejecuta una transacción: un único estado pendiente y errores traducidos. */
  async function run(label: string, success: string, action: (account: Address) => Promise<unknown>) {
    if (!active || pending) return false;
    setPending(label);
    setFeedback(null);
    try {
      await action(active);
      setFeedback({ kind: "success", text: success });
      return true;
    } catch (error) {
      setFeedback({ kind: "error", text: toUserMessage(error) });
      return false;
    } finally {
      setPending(null);
      await Promise.all([refresh(), refreshAccounts(), refreshBids()]);
    }
  }

  const status = data && now !== undefined ? deriveStatus({ ended: data.ended, endTime: data.endTime, now }) : null;
  const isSeller = !!data && !!active && data.seller.toLowerCase() === active.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Subasta</h1>
        <p className="font-mono text-sm break-all text-neutral-600 dark:text-neutral-400">{address}</p>
      </header>

      <NetworkGuard status={chainStatus} />

      {chainStatus === null && <p className="text-sm">Conectando con el nodo…</p>}
      {online && read === null && <p className="text-sm">Cargando subasta…</p>}
      {read?.kind === "no-contract" && <Notice>No hay ninguna subasta desplegada en esta dirección.</Notice>}
      {read?.kind === "not-auction" && <Notice>El contrato en esta dirección no es una subasta.</Notice>}

      {data && status && now !== undefined && (
        <>
          <AccountSelector
            accounts={accounts}
            active={active}
            seller={data.seller}
            onChange={setActive}
            disabled={pending !== null}
          />
          <AuctionStatus data={data} status={status} now={now} />
          <AuctionActions
            status={status}
            isSeller={isSeller}
            minPrice={data.minPrice}
            highestBid={data.highestBid}
            pendingReturns={data.pendingReturns}
            pending={pending}
            disabled={!online || !active}
            onBid={(value) =>
              run("Enviando puja", `Puja de ${formatEth(value)} confirmada.`, (account) =>
                placeBid(clients, address, account, value),
              )
            }
            onWithdraw={() =>
              void run("Retirando", "Retiro confirmado.", (account) => withdraw(clients, address, account))
            }
            onClose={() =>
              void run("Cerrando la subasta", "Subasta cerrada.", (account) => endAuction(clients, address, account))
            }
          />
          {feedback && (
            <p
              role={feedback.kind === "error" ? "alert" : "status"}
              className={`rounded-lg p-3 text-sm ${
                feedback.kind === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"
              }`}
            >
              {feedback.text}
            </p>
          )}
          <BidHistory
            log={bidLog}
            account={active}
            accounts={accounts.map((a) => a.address)}
          />
        </>
      )}
    </div>
  );
}
