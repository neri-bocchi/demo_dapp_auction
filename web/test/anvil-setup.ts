import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    rpcUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForRpc(url: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      // todavía arrancando
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`anvil no respondió en ${url}`);
}

let anvil: ChildProcess | undefined;

/** Arranca un anvil propio en un puerto libre para los tests de integración. */
export default async function setup(project: TestProject) {
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  anvil = spawn(process.env.ANVIL_BIN ?? "anvil", ["--port", String(port), "--silent"], { stdio: "ignore" });
  anvil.once("error", (err) => {
    throw new Error(`No se pudo ejecutar anvil (¿está Foundry instalado?): ${err.message}`);
  });
  await waitForRpc(rpcUrl);
  project.provide("rpcUrl", rpcUrl);

  return () => {
    anvil?.kill();
  };
}
