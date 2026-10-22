import { formatEther, parseEther } from "viem";

export type AuctionStatus = "open" | "ready" | "closed";

/**
 * Estimación del reloj de la cadena (segundos): timestamp del último bloque más el
 * tiempo transcurrido desde que se leyó. Se reajusta con cada bloque nuevo.
 */
export function chainNow(blockTimestamp: bigint, fetchedAt: number, now: number = Date.now()): bigint {
  return blockTimestamp + BigInt(Math.max(0, Math.floor((now - fetchedAt) / 1000)));
}

/** Misma regla que el contrato: desde `endTime` ya no se aceptan pujas. */
export function deriveStatus({ ended, endTime, now }: { ended: boolean; endTime: bigint; now: bigint }): AuctionStatus {
  if (ended) return "closed";
  return now >= endTime ? "ready" : "open";
}

export type BidValidation = { ok: true; value: bigint } | { ok: false; error: string };

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

/** Valida un monto en ETH escrito por el usuario (acepta coma o punto decimal). */
export function validateBid(input: string, minPrice: bigint, highestBid: bigint): BidValidation {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return { ok: false, error: "Introduce un monto en ETH." };
  if (!AMOUNT_PATTERN.test(normalized)) return { ok: false, error: "El monto no es válido." };

  let value: bigint;
  try {
    value = parseEther(normalized);
  } catch {
    return { ok: false, error: "El monto no es válido." };
  }
  if (normalized.split(".")[1]?.length > 18) return { ok: false, error: "El monto tiene demasiados decimales." };

  if (value === 0n) return { ok: false, error: "La puja debe ser mayor que cero." };
  if (value < minPrice) return { ok: false, error: `La puja debe ser de al menos ${formatEth(minPrice)}.` };
  if (value <= highestBid) return { ok: false, error: `La puja debe superar ${formatEth(highestBid)}.` };
  return { ok: true, value };
}

/** Formatea wei como ETH legible, p. ej. `1.5 ETH`. */
export function formatEth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

/** Formatea un saldo redondeado a `decimals` decimales, p. ej. `9998.4999 ETH`. */
export function formatEthRounded(wei: bigint, decimals = 4): string {
  const unit = 10n ** BigInt(18 - decimals);
  const rounded = ((wei + unit / 2n) / unit) * unit;
  return formatEth(rounded);
}

/** Texto de ayuda para el formulario de puja: el umbral que hay que alcanzar o superar. */
export function bidRequirement(minPrice: bigint, highestBid: bigint): string {
  if (highestBid > 0n && highestBid >= minPrice) return `Debe superar ${formatEth(highestBid)}`;
  return `Mínimo: ${formatEth(minPrice > 0n ? minPrice : 1n)}`;
}

/** Formatea segundos restantes como `1 d 02 h 03 min 04 s`; 0 o negativo → `0 s`. */
export function formatRemaining(seconds: bigint): string {
  if (seconds <= 0n) return "0 s";
  const days = seconds / 86_400n;
  const hours = (seconds % 86_400n) / 3_600n;
  const minutes = (seconds % 3_600n) / 60n;
  const secs = seconds % 60n;
  const pad = (n: bigint) => n.toString().padStart(2, "0");

  if (days > 0n) return `${days} d ${pad(hours)} h ${pad(minutes)} min ${pad(secs)} s`;
  if (hours > 0n) return `${hours} h ${pad(minutes)} min ${pad(secs)} s`;
  if (minutes > 0n) return `${minutes} min ${pad(secs)} s`;
  return `${secs} s`;
}

export type BidLabel = "highest" | "winner" | "outbid";

type BidLike = { bidder: string; amount: bigint };

/**
 * Prepara el historial para mostrarlo: de la más reciente a la más antigua, con la
 * puja vigente marcada como "más alta" (o "ganadora" si la subasta está cerrada),
 * el resto como "superada", y `mine` en las pujas de la cuenta activa.
 */
export function labelBids<T extends BidLike>(
  bids: readonly T[],
  { highestBidder, highestBid, ended, account }: {
    highestBidder: string;
    highestBid: bigint;
    ended: boolean;
    account?: string;
  },
): (T & { label: BidLabel; mine: boolean })[] {
  const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  return [...bids].reverse().map((bid) => {
    const isHighest = same(bid.bidder, highestBidder) && bid.amount === highestBid;
    return {
      ...bid,
      label: isHighest ? (ended ? "winner" : "highest") : "outbid",
      mine: same(bid.bidder, account),
    };
  });
}

/** Acorta una dirección para mostrarla: `0xf39F…2266`. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
