import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  HttpRequestError,
} from "viem";
import { describe, expect, it } from "vitest";
import { auctionAbi } from "./auction-abi";
import { CONNECTION_ERROR_MESSAGE, CONTRACT_ERROR_MESSAGES, toUserMessage } from "./errors";

const ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

/** Reproduce el error que lanza viem al simular una llamada que revierte. */
function revertError(errorName: string) {
  const data = encodeErrorResult({ abi: auctionAbi, errorName: errorName as "BidTooLow" });
  const reverted = new ContractFunctionRevertedError({ abi: auctionAbi, data, functionName: "bid" });
  return new ContractFunctionExecutionError(reverted, {
    abi: auctionAbi,
    functionName: "bid",
    contractAddress: ADDRESS,
  });
}

describe("toUserMessage", () => {
  it.each(Object.entries(CONTRACT_ERROR_MESSAGES))("traduce %s", (errorName, message) => {
    expect(toUserMessage(revertError(errorName))).toBe(message);
  });

  it("cubre todos los errores del ABI salvo ZeroDuration (solo constructor)", () => {
    const abiErrors = auctionAbi.filter((item) => item.type === "error").map((item) => item.name);
    expect(new Set([...Object.keys(CONTRACT_ERROR_MESSAGES), "ZeroDuration"])).toEqual(new Set(abiErrors));
  });

  it("traduce un error de conexión HTTP", () => {
    const http = new HttpRequestError({ url: "http://127.0.0.1:8545", details: "fetch failed" });
    expect(toUserMessage(http)).toBe(CONNECTION_ERROR_MESSAGE);
    expect(toUserMessage(new BaseError("fallo", { cause: http }))).toBe(CONNECTION_ERROR_MESSAGE);
  });

  it("usa el shortMessage para otros errores de viem", () => {
    expect(toUserMessage(new BaseError("Algo raro pasó"))).toBe("Error: Algo raro pasó");
  });

  it("maneja errores desconocidos", () => {
    expect(toUserMessage(new Error("boom"))).toBe("Error: boom");
    expect(toUserMessage("texto")).toBe("Error desconocido.");
  });
});
