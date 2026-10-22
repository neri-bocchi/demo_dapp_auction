import { zeroAddress, type Address } from "viem";
import type { AuctionData } from "@/lib/auction-client";
import { formatEth, formatRemaining, type AuctionStatus as Status } from "@/lib/auction-state";

const STATUS_LABEL: Record<Status, string> = {
  open: "Abierta",
  ready: "Lista para cerrar",
  closed: "Cerrada",
};

const STATUS_STYLE: Record<Status, string> = {
  open: "bg-emerald-100 text-emerald-900",
  ready: "bg-amber-100 text-amber-900",
  closed: "bg-neutral-200 text-neutral-900",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className="text-sm font-medium sm:text-right">{children}</dd>
    </div>
  );
}

function AddressText({ address }: { address: Address }) {
  return <span className="font-mono break-all">{address}</span>;
}

type Props = { data: AuctionData; status: Status; now: bigint };

/** Datos de la subasta: precio, pujas, plazo, estado y resultado. */
export function AuctionStatus({ data, status, now }: Props) {
  const hasBids = data.highestBidder !== zeroAddress;
  const endDate = new Date(Number(data.endTime) * 1000);

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Estado</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
        <Row label="Vendedor">
          <AddressText address={data.seller} />
        </Row>
        <Row label="Precio mínimo">{formatEth(data.minPrice)}</Row>
        <Row label="Puja más alta">{hasBids ? formatEth(data.highestBid) : "Aún no hay pujas"}</Row>
        {hasBids && status !== "closed" && (
          <Row label="Mejor postor">
            <AddressText address={data.highestBidder} />
          </Row>
        )}
        <Row label="Cierre programado">{endDate.toLocaleString("es")}</Row>
        {status === "open" && <Row label="Tiempo restante">{formatRemaining(data.endTime - now)}</Row>}
        {status === "closed" &&
          (hasBids ? (
            <>
              <Row label="Ganador">
                <AddressText address={data.highestBidder} />
              </Row>
              <Row label="Precio final">{formatEth(data.highestBid)}</Row>
            </>
          ) : (
            <Row label="Resultado">Sin ganador: nadie pujó</Row>
          ))}
      </dl>
    </section>
  );
}
