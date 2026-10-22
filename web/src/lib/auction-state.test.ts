import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import {
  bidRequirement,
  chainNow,
  deriveStatus,
  formatEthRounded,
  formatRemaining,
  labelBids,
  shortAddress,
  validateBid,
} from "./auction-state";

describe("chainNow", () => {
  it("suma los segundos transcurridos desde la lectura", () => {
    expect(chainNow(1_000n, 10_000, 13_500)).toBe(1_003n);
  });

  it("no retrocede si el reloj local va por detrás", () => {
    expect(chainNow(1_000n, 10_000, 9_000)).toBe(1_000n);
  });

  it("usa el reloj de la cadena aunque esté adelantado respecto al navegador", () => {
    // anvil adelantado 1 h con evm_increaseTime: el bloque manda, no Date.now()
    const browserNow = 1_700_000_000_000;
    const blockTs = BigInt(browserNow / 1000 + 3_600);
    const now = chainNow(blockTs, browserNow, browserNow);
    expect(deriveStatus({ ended: false, endTime: blockTs - 1n, now })).toBe("ready");
  });
});

describe("deriveStatus", () => {
  it("abierta antes del cierre programado", () => {
    expect(deriveStatus({ ended: false, endTime: 100n, now: 99n })).toBe("open");
  });

  it("lista para cerrar justo en el cierre programado", () => {
    expect(deriveStatus({ ended: false, endTime: 100n, now: 100n })).toBe("ready");
  });

  it("lista para cerrar después del cierre programado", () => {
    expect(deriveStatus({ ended: false, endTime: 100n, now: 500n })).toBe("ready");
  });

  it("cerrada si ended, con o sin ganador, sea cual sea el reloj", () => {
    expect(deriveStatus({ ended: true, endTime: 100n, now: 50n })).toBe("closed");
    expect(deriveStatus({ ended: true, endTime: 100n, now: 500n })).toBe("closed");
  });
});

describe("validateBid", () => {
  const min = parseEther("1");

  it("rechaza un monto vacío", () => {
    expect(validateBid("  ", min, 0n)).toEqual({ ok: false, error: "Introduce un monto en ETH." });
  });

  it("rechaza un monto no numérico", () => {
    expect(validateBid("abc", min, 0n)).toEqual({ ok: false, error: "El monto no es válido." });
    expect(validateBid("-1", min, 0n)).toEqual({ ok: false, error: "El monto no es válido." });
    expect(validateBid("1.2.3", min, 0n)).toEqual({ ok: false, error: "El monto no es válido." });
  });

  it("rechaza más de 18 decimales", () => {
    expect(validateBid("1.0000000000000000001", min, 0n)).toEqual({
      ok: false,
      error: "El monto tiene demasiados decimales.",
    });
  });

  it("rechaza cero", () => {
    expect(validateBid("0", 0n, 0n)).toEqual({ ok: false, error: "La puja debe ser mayor que cero." });
  });

  it("rechaza un monto bajo el precio mínimo", () => {
    expect(validateBid("0.5", min, 0n)).toEqual({ ok: false, error: "La puja debe ser de al menos 1 ETH." });
  });

  it("rechaza un monto igual a la puja más alta", () => {
    expect(validateBid("2", min, parseEther("2"))).toEqual({ ok: false, error: "La puja debe superar 2 ETH." });
  });

  it("acepta un monto válido con punto o coma decimal", () => {
    expect(validateBid("1.5", min, 0n)).toEqual({ ok: true, value: parseEther("1.5") });
    expect(validateBid("1,5", min, 0n)).toEqual({ ok: true, value: parseEther("1.5") });
  });
});

describe("formatRemaining", () => {
  it("formatea cada magnitud", () => {
    expect(formatRemaining(0n)).toBe("0 s");
    expect(formatRemaining(-5n)).toBe("0 s");
    expect(formatRemaining(42n)).toBe("42 s");
    expect(formatRemaining(125n)).toBe("2 min 05 s");
    expect(formatRemaining(3_723n)).toBe("1 h 02 min 03 s");
    expect(formatRemaining(90_061n)).toBe("1 d 01 h 01 min 01 s");
  });
});

describe("shortAddress", () => {
  it("conserva el prefijo y los últimos 4 caracteres", () => {
    expect(shortAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe("0xf39F…2266");
  });
});

describe("formatEthRounded", () => {
  it("redondea a 4 decimales", () => {
    expect(formatEthRounded(9998499873776420760872n)).toBe("9998.4999 ETH");
    expect(formatEthRounded(parseEther("1.23456"))).toBe("1.2346 ETH");
    expect(formatEthRounded(parseEther("2"))).toBe("2 ETH");
  });
});

describe("bidRequirement", () => {
  it("indica el precio mínimo si no hay pujas", () => {
    expect(bidRequirement(parseEther("1"), 0n)).toBe("Mínimo: 1 ETH");
  });

  it("indica la puja a superar si ya hay una", () => {
    expect(bidRequirement(parseEther("1"), parseEther("2"))).toBe("Debe superar 2 ETH");
  });

  it("con precio mínimo cero pide más de 0", () => {
    expect(bidRequirement(0n, 0n)).toBe("Mínimo: 0.000000000000000001 ETH");
  });
});

describe("labelBids", () => {
  const A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const B = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const bids = [
    { bidder: A, amount: parseEther("1") },
    { bidder: B, amount: parseEther("2") },
  ];

  it("devuelve una lista vacía sin pujas", () => {
    expect(labelBids([], { highestBidder: "0x0000000000000000000000000000000000000000", highestBid: 0n, ended: false })).toEqual([]);
  });

  it("ordena de la más reciente a la más antigua y marca la más alta", () => {
    const labeled = labelBids(bids, { highestBidder: B, highestBid: parseEther("2"), ended: false });
    expect(labeled.map((b) => [b.bidder, b.label])).toEqual([
      [B, "highest"],
      [A, "outbid"],
    ]);
  });

  it("marca la ganadora si la subasta está cerrada", () => {
    const labeled = labelBids(bids, { highestBidder: B, highestBid: parseEther("2"), ended: true });
    expect(labeled[0].label).toBe("winner");
    expect(labeled[1].label).toBe("outbid");
  });

  it("solo marca como más alta la puja vigente aunque el postor tenga pujas anteriores", () => {
    const raised = [...bids, { bidder: A, amount: parseEther("3") }];
    const labeled = labelBids(raised, { highestBidder: A, highestBid: parseEther("3"), ended: false });
    expect(labeled.map((b) => b.label)).toEqual(["highest", "outbid", "outbid"]);
  });

  it("distingue las pujas de la cuenta activa sin importar mayúsculas", () => {
    const labeled = labelBids(bids, {
      highestBidder: B,
      highestBid: parseEther("2"),
      ended: false,
      account: A.toLowerCase(),
    });
    expect(labeled.map((b) => b.mine)).toEqual([false, true]);
  });
});
