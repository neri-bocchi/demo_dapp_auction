// Genera src/lib/auction-abi.ts a partir del contrato Auction compilado con Foundry.
// Uso: npm run abi   (requiere `forge` en el PATH)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = fileURLToPath(new URL("../src/lib/auction-abi.ts", import.meta.url));

const abi = JSON.parse(
  execFileSync("forge", ["inspect", "Auction", "abi", "--json"], { cwd: root, encoding: "utf8" }),
);

writeFileSync(
  output,
  `// Generado por scripts/export-abi.mjs a partir de src/Auction.sol. No editar a mano.\n` +
    `export const auctionAbi = ${JSON.stringify(abi, null, 2)} as const;\n`,
);
console.log(`ABI de Auction escrito en ${output}`);
