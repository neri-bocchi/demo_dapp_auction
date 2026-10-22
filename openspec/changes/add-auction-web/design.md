# Design

## Context

- El repo es un proyecto Foundry: `src/Auction.sol`, `test/`, `script/Subasta.s.sol`, `foundry.toml` en la raíz. El CI (`.github/workflows/test.yml`) ejecuta `fmt`, `build` y `test` de Foundry.
- La interfaz pública del contrato está fijada por la spec `auction`: `bid()`, `withdraw()`, `endAuction()`, los getters `seller`, `minPrice`, `endTime`, `highestBidder`, `highestBid`, `ended`, `pendingReturns(address)`, `winner()` y `finalPrice()`, y los errores personalizados (`BidTooLow`, `AuctionEnded`, …).
- anvil expone 10 cuentas desbloqueadas (`eth_accounts`), acepta `eth_sendTransaction` sin firma del cliente y responde con CORS abierto por defecto. No trae Multicall3 desplegado.
- Node 24 y npm están disponibles. Versiones actuales: `next` 16.x y `viem` 2.x.

## Goals / Non-Goals

**Goals:**
- App mínima y legible que sirva de ejemplo de viem puro (sin wagmi) contra el contrato.
- Toda la lógica de negocio de la interfaz (estado derivado, validación de pujas, traducción de errores) en funciones puras con tests unitarios.
- Un test de integración real contra anvil para la capa de viem.

**Non-Goals:**
- Renderizado en servidor de datos de la cadena: el RPC es local y se consulta desde el navegador.
- Diseño visual elaborado: Tailwind con una sola página limpia y responsive.
- Tests end-to-end en navegador (Playwright): la interfaz se verifica manualmente con un guion definido en las tareas.

## Decisions

### App en `web/` independiente de Foundry
`create-next-app` con App Router, TypeScript, Tailwind, ESLint, `src/` y npm. Tiene su propio `package.json`; la raíz sigue siendo un proyecto Foundry.
*Alternativa*: monorepo con workspaces. Es innecesario para una sola app.

### viem puro con cuentas JSON-RPC de anvil
- `publicClient = createPublicClient({ chain: anvil, transport: http(RPC_URL) })` para lecturas y para observar bloques.
- `walletClient = createWalletClient({ chain: anvil, transport: http(RPC_URL) })`. `walletClient.getAddresses()` lista las cuentas (`eth_accounts`) y cada escritura pasa `account: <dirección>` (una cuenta JSON-RPC), así que firma anvil y no el navegador.
*Alternativa*: `privateKeyToAccount` con las claves conocidas de anvil. Obligaría a meter claves en el bundle, cosa que la spec prohíbe.
*Alternativa*: wagmi. Añade una capa y dependencias que no hacen falta para una demo local y ocultan viem.

### Configuración por variables de entorno públicas
`NEXT_PUBLIC_RPC_URL` (por defecto `http://127.0.0.1:8545`) y `NEXT_PUBLIC_AUCTION_ADDRESS` (opcional), documentadas en `web/.env.example`. La chain se fija a `anvil` (id 31337) de `viem/chains`. Al cargar se comprueba `getChainId()`: si falla, se avisa de "nodo caído"; si devuelve otro id, de "red no soportada".

### Rutas
- `src/app/page.tsx` (server component): si existe `NEXT_PUBLIC_AUCTION_ADDRESS`, llama a `redirect('/auction/<addr>')`; si no, muestra un formulario cliente que valida con `isAddress` y navega.
- `src/app/auction/[address]/page.tsx`: valida la dirección con `isAddress` y renderiza el componente cliente `AuctionView`.

### Capas del código
```
src/lib/
  config.ts          RPC_URL, AUCTION_ADDRESS, chain
  clients.ts         publicClient, walletClient (singletons)
  auction-abi.ts     ABI generado (as const)
  auction-state.ts   PURO: deriveStatus, validateBid, bidRequirement, formatRemaining
  errors.ts          PURO: toUserMessage(error) → string en español
  auction-client.ts  readAuction, readBidHistory, placeBid, withdraw, endAuction (viem)
src/hooks/
  useAccounts.ts     lista de cuentas + cuenta activa en localStorage
  useAuction.ts      lee el estado y lo refresca con cada bloque
  useBidHistory.ts   historial de pujas, refrescado con cada bloque
src/components/
  AccountSelector, AuctionStatus, AuctionActions (BidForm), BidHistory, NetworkGuard
```
Las funciones puras no importan viem salvo utilidades como `parseEther` y `formatEther`, lo que permite testearlas sin nodo.

### Lecturas y refresco
`readAuction(address, account)` hace en paralelo (`Promise.all`) `getCode`, los 6 getters, `pendingReturns(account)`, `getBalance(account)` y `getBlock()` para obtener el timestamp. Sin Multicall3, porque anvil no lo trae y son pocas llamadas a un nodo local. Si `getCode` está vacío, devuelve "sin contrato"; si hay código pero un getter falla, devuelve "no es una subasta".
`useAuction` se suscribe a `publicClient.watchBlockNumber({ pollingInterval: 1000 })` y vuelve a leer en cada bloque nuevo y tras cada transacción confirmada.

### Reloj de la cadena
`chainNow = block.timestamp + (Date.now() - fetchedAt) / 1000`, recalculado cada segundo en el cliente para la cuenta atrás. Al minarse un bloque se reajusta, lo que cubre `evm_increaseTime` + `evm_mine`. `deriveStatus({ended, endTime, chainNow})` devuelve `open | ready | closed` con la misma regla que el contrato (`chainNow >= endTime` ⇒ ya no se aceptan pujas).
*Trade-off*: si anvil lleva rato sin minar, `chainNow` es una estimación. El contrato tiene la última palabra y un revert se muestra como error traducido.

### Historial de pujas desde eventos
El registro se reconstruye con los eventos `BidPlaced` del contrato: `getContractEvents({ eventName: "BidPlaced", fromBlock: 0n })`, sin indexador ni almacenamiento propio. La fecha de cada puja es el timestamp de su bloque (`getBlock` por cada bloque distinto). Se relee con cada bloque nuevo, igual que el estado. La puja más alta es siempre el último evento, porque el contrato solo acepta pujas mayores que la anterior; aun así se marca comparando con `highestBidder`/`highestBid` para no depender del orden.
*Alternativa*: guardar el historial en el contrato (un array de pujas). Cambiaría la spec `auction` y encarece el gas; los eventos existen precisamente para esto.
*Trade-off*: leer desde el bloque 0 en cada bloque nuevo escala mal en una cadena larga. En anvil local son unos pocos bloques; si hiciera falta, se leería solo desde el último bloque visto.

### Escrituras
Flujo: `simulateContract` (detecta reverts antes de enviar y decodifica el error), luego `writeContract(request)` y después `waitForTransactionReceipt`. `placeBid` usa `value: parseEther(input)` ya validado. Un único estado `pending` por página bloquea todas las acciones.

### Traducción de errores
`toUserMessage` recorre el error con `BaseError.walk` buscando `ContractFunctionRevertedError` y mapea `data.errorName`:

| errorName | Mensaje |
|---|---|
| `BidTooLow` | La puja es demasiado baja: debe superar la puja actual y el precio mínimo. |
| `AuctionEnded` | La subasta ya no acepta pujas. |
| `SellerCannotBid` | El vendedor no puede pujar en su propia subasta. |
| `NothingToWithdraw` | No tienes saldo para retirar. |
| `AuctionNotYetEnded` | La subasta todavía no ha terminado. |
| `AuctionAlreadyEnded` | La subasta ya está cerrada. |
| `TransferFailed` | La transferencia de ETH falló. |

`HttpRequestError` se traduce a "No se pudo conectar con el nodo (¿está anvil en marcha?)". Cualquier otro error, a un mensaje genérico con `shortMessage`.

### ABI generado desde Foundry
`web/scripts/export-abi.mjs` ejecuta `forge inspect Auction abi --json` en la raíz y escribe `src/lib/auction-abi.ts` como `export const auctionAbi = [...] as const`. Se versiona el archivo generado para que la web compile sin Foundry. En CI se regenera y se comprueba `git diff --exit-code`, lo que avisa si el contrato cambió.
*Alternativa*: importar `out/Auction.sol/Auction.json`. `out/` está en `.gitignore` y además se pierde el tipado literal que viem necesita.

### Cuenta activa persistente
`localStorage['auction.account']`, con acceso protegido por try/catch. Si la cuenta guardada no está en `eth_accounts`, se usa la primera de la lista.

### Tests
- **Unitarios (vitest)**: `auction-state.ts` y `errors.ts`.
- **Integración (vitest)**: `auction-client.test.ts` arranca `anvil` en un puerto libre (globalSetup con `child_process`), despliega `Auction` con `walletClient.deployContract` usando el bytecode de `../out/Auction.sol/Auction.json` (tras `forge build`) y ejercita leer, pujar, retirar y cerrar, incluido avanzar el tiempo con `evm_increaseTime` y `evm_mine`. Se ejecuta con `npm run test:integration`, separado de los unitarios porque requiere Foundry.

### CI
Nuevo job `web` en el mismo workflow: instala Foundry y Node 24, ejecuta `forge build`, y dentro de `web/` `npm ci`, la comprobación del ABI, `npm run lint`, `npm test`, `npm run test:integration` y `npm run build`.

## Risks / Trade-offs

- [El polling cada segundo genera tráfico constante al nodo] → Es local y barato; el intervalo es configurable.
- [`chainNow` es aproximado si no se minan bloques] → El estado "lista para cerrar" puede aparecer un poco antes o después. El contrato valida y el error se traduce.
- [CORS: si anvil se lanza con `--allow-origin` restringido, el navegador no puede llamar al RPC] → Documentar que se use `anvil` sin opciones. El aviso de "nodo caído" cubre el síntoma.
- [Next.js 16 cambia APIs respecto a versiones anteriores (por ejemplo, `params` asíncronos y ESLint sin `next lint`)] → Seguir las plantillas que genera `create-next-app` 16 y no copiar patrones antiguos.
- [El ABI versionado puede quedar desfasado] → La comprobación en CI lo detecta.

## Migration Plan

No aplica (app nueva). Uso local: `anvil`; desplegar con `script/Subasta.s.sol`; copiar la dirección en `web/.env.local`; `cd web && npm run dev`.
