import type { Address } from "viem";
import type { BidEntry } from "@/lib/auction-client";
import { formatEth, labelBids, shortAddress, type BidLabel } from "@/lib/auction-state";

const LABEL_TEXT: Record<BidLabel, string> = {
  highest: "Más alta",
  winner: "Ganadora",
  outbid: "Superada",
};

const LABEL_STYLE: Record<BidLabel, string> = {
  highest: "bg-emerald-100 text-emerald-900",
  winner: "bg-amber-100 text-amber-900",
  outbid: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

type Props = {
  bids: BidEntry[] | null;
  highestBidder: Address;
  highestBid: bigint;
  ended: boolean;
  account: Address | undefined;
  /** Cuentas de anvil, para mostrar su número (#0, #1…) junto a la dirección. */
  accounts: Address[];
};

/** Registro de todas las pujas aceptadas, de la más reciente a la más antigua. */
export function BidHistory({ bids, highestBidder, highestBid, ended, account, accounts }: Props) {
  const labeled = bids ? labelBids(bids, { highestBidder, highestBid, ended, account }) : [];
  const accountIndex = (address: Address) =>
    accounts.findIndex((a) => a.toLowerCase() === address.toLowerCase());

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-2 text-lg font-semibold">
        Historial de pujas{bids && bids.length > 0 && <span className="font-normal text-neutral-500"> ({bids.length})</span>}
      </h2>

      {bids === null && <p className="text-sm">Cargando pujas…</p>}
      {bids?.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400">Aún no hay pujas.</p>}

      {labeled.length > 0 && (
        <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {labeled.map((bid, i) => {
            const index = accountIndex(bid.bidder);
            return (
              <li
                key={`${bid.transactionHash}-${bid.logIndex}`}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm ${
                  bid.mine ? "-mx-2 rounded bg-blue-50 px-2 dark:bg-blue-950" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-neutral-500 tabular-nums">{labeled.length - i}.</span>
                  <span className="font-mono" title={bid.bidder}>
                    {index >= 0 && <span className="text-neutral-500">#{index} </span>}
                    {shortAddress(bid.bidder)}
                  </span>
                  {bid.mine && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-900">tú</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-600 tabular-nums dark:text-neutral-400">
                    {new Date(Number(bid.timestamp) * 1000).toLocaleString("es")}
                  </span>
                  <span className="font-medium tabular-nums">{formatEth(bid.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_STYLE[bid.label]}`}>
                    {LABEL_TEXT[bid.label]}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
