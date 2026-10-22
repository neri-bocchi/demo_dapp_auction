# Tasks

## 1. Scaffold de la app

- [x] 1.1 Crear `web/` con `npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --use-npm --yes`, eliminar el contenido de ejemplo de la página inicial y verificar que `npm run build` y `npm run lint` pasan dentro de `web/`
- [x] 1.2 Instalar `viem` y `vitest`, añadir los scripts `test` y `test:integration` a `web/package.json` y verificar con `npm ls viem vitest` que quedan instalados
- [x] 1.3 Crear `src/lib/config.ts` (`RPC_URL`, `AUCTION_ADDRESS`, chain `anvil`) y `web/.env.example` con `NEXT_PUBLIC_RPC_URL` y `NEXT_PUBLIC_AUCTION_ADDRESS`; verificar que `.env.local` queda ignorado por git con `git check-ignore web/.env.local`

## 2. ABI y capa de viem

- [x] 2.1 Crear `web/scripts/export-abi.mjs` y el script `npm run abi`, generar `src/lib/auction-abi.ts` (`as const`) y verificar que contiene `bid`, `withdraw`, `endAuction` y los 8 errores, y que `npx tsc --noEmit` pasa
- [x] 2.2 Crear `src/lib/clients.ts` y `src/lib/auction-client.ts` (`getChainStatus`, `listAccounts`, `readAuction`, `placeBid`, `withdraw`, `endAuction`, con simulate → write → wait); verificar con `npx tsc --noEmit`
- [x] 2.3 Escribir `src/lib/auction-client.integration.test.ts` con un globalSetup de vitest que arranca anvil en un puerto libre y despliega `Auction` desde `../out`; cubrir chain id correcto, sin contrato en la dirección, lectura inicial, puja, puja superada con saldo retirable, retiro, cierre tras `evm_increaseTime` + `evm_mine`, y revert decodificado como `BidTooLow`; verificar con `forge build && npm run test:integration`

## 3. Lógica pura de la interfaz

- [x] 3.1 Implementar `src/lib/auction-state.ts` (`deriveStatus`, `bidRequirement`, `validateBid`, `formatRemaining`, `chainNow`) con tests unitarios para abierta, lista para cerrar (incluido el reloj de la cadena adelantado respecto al navegador), cerrada con y sin ganador, y montos vacío, no numérico, cero, bajo el mínimo, igual a la puja más alta y válido; verificar con `npm test`
- [x] 3.2 Implementar `src/lib/errors.ts` (`toUserMessage`) con tests unitarios para cada error del contrato de la tabla de `design.md`, `HttpRequestError` y un error desconocido; verificar con `npm test`

## 4. Hooks y componentes

- [x] 4.1 Implementar `useAccounts` (lista de cuentas con saldo, cuenta activa persistida en `localStorage` con try/catch y vuelta a la primera cuenta si la guardada no existe) y `AccountSelector`; verificar con `npx tsc --noEmit` y `npm run lint`
- [x] 4.2 Implementar `useAuction` (lectura inicial, refresco con `watchBlockNumber` y tras cada transacción, reloj de la cadena que avanza cada segundo) y `NetworkGuard` (avisos de nodo caído y red equivocada, acciones deshabilitadas); verificar con `npx tsc --noEmit` y `npm run lint`
- [x] 4.3 Implementar `AuctionStatus` (vendedor, precio mínimo, puja más alta y autor, cierre programado, cuenta atrás, estado, ganador y precio final, aviso de "sin pujas" o "sin ganador"); verificar con `npx tsc --noEmit` y `npm run lint`
- [x] 4.4 Implementar `BidForm` y `AuctionActions` (pujar, retirar y cerrar; los errores se muestran en `AuctionView`) con visibilidad según el estado y la cuenta activa (el vendedor no puja, retirar solo con saldo > 0, cerrar solo en "lista para cerrar"), validación previa con `validateBid`, estado pendiente único que deshabilita todas las acciones y errores con `toUserMessage`; verificar con `npx tsc --noEmit` y `npm run lint`

## 5. Rutas

- [x] 5.1 Implementar `src/app/auction/[address]/page.tsx` (dirección inválida → error; si no, `NetworkGuard` + `AccountSelector` + `AuctionView` con estados "sin contrato" y "no es una subasta") y verificar con `npm run build`
- [x] 5.2 Implementar `src/app/page.tsx` (redirección a `NEXT_PUBLIC_AUCTION_ADDRESS` o formulario con validación `isAddress`), título y metadatos en `layout.tsx`, y verificar con `npm run build`

## 6. Documentación y CI

- [x] 6.1 Ampliar `README.md` con una sección "Frontend web" (requisitos, `.env.local`, `npm run dev`, regenerar el ABI, ejecutar los tests) y verificar siguiendo los pasos desde cero contra un anvil nuevo
- [x] 6.2 Añadir el job `web` a `.github/workflows/test.yml` (Foundry, Node 24, `forge build`, `npm ci`, comprobación del ABI con `git diff --exit-code`, lint, tests unitarios y de integración, build) y verificar ejecutando localmente esa misma secuencia de comandos

## 7. Verificación end-to-end

- [x] 7.1 Con anvil y una subasta recién desplegada, recorrer en el navegador: elegir cuenta y recargar (se conserva), el vendedor no ve "pujar", puja inválida bloqueada con mensaje, puja válida con indicador pendiente, puja desde `cast` reflejada sin recargar, retiro de la cuenta superada, `evm_increaseTime` + `evm_mine` → "lista para cerrar", cierre → ganador y precio final; verificar que todos los pasos se comportan como en la spec
- [x] 7.2 Detener anvil con la página abierta y verificar que aparece el aviso de nodo caído y las acciones se deshabilitan; abrir `/auction/hola` y una dirección sin contrato y verificar sus mensajes
- [x] 7.3 Ejecutar `npm run lint`, `npm test`, `npm run test:integration`, `npm run build` en `web/`, y `forge test` y `openspec validate add-auction-web --strict` en la raíz; verificar que todo pasa

## 8. Historial de pujas

- [x] 8.1 Añadir `readBidHistory` a `src/lib/auction-client.ts` (eventos `BidPlaced` desde el bloque 0 con el timestamp de su bloque) y cubrirlo en el test de integración (sin pujas → lista vacía; dos pujas → orden, postores, montos y timestamps); verificar con `npm run test:integration`
- [x] 8.2 Añadir a `src/lib/auction-state.ts` la función pura `labelBids` (más reciente primero; "más alta", "ganadora" o "superada"; marca de cuenta activa) con tests unitarios para sin pujas, abierta, cerrada y pujas propias; verificar con `npm test`
- [x] 8.3 Implementar `useBidHistory` (relectura con cada bloque y tras cada transacción) y el componente `BidHistory` en la página de la subasta; verificar con `npx tsc --noEmit`, `npm run lint` y `npm run build`
- [ ] 8.4 Verificar en el navegador contra anvil: el registro lista las pujas existentes en orden con sus etiquetas, una puja hecha con `cast` aparece arriba sin recargar, y las pujas de la cuenta activa se distinguen

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` tras revisar la implementación.
