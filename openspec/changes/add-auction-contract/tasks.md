# Tasks

## 1. Setup del proyecto Foundry

- [x] 1.1 Ejecutar `forge init --force` en la raíz (conservando `openspec/` y `.claude/`), borrar el ejemplo `Counter` (src, test y script) y verificar que `forge build` compila sin errores
- [x] 1.2 Fijar en `foundry.toml` la versión de `solc` (última 0.8.x estable) y `optimizer = true`; verificar con `forge build` que se usa esa versión
- [x] 1.3 Añadir al `.gitignore` `out/`, `cache/`, `broadcast/` y `.env`, y verificar con `git status` que no aparecen artefactos de compilación

## 2. Configuración y pujas

- [x] 2.1 Crear `src/Auction.sol` con constructor (`minPrice`, `duration`), inmutables `seller`/`minPrice`/`endTime`, error `ZeroDuration` y sin `receive`/`fallback`; tests en `test/Auction.t.sol` para creación válida, duración cero, precio mínimo cero y transferencia directa rechazada; verificar con `forge test`
- [x] 2.2 Implementar `bid()` con los errores `AuctionEnded`, `SellerCannotBid`, `BidTooLow`, el acreditado del postor anterior en `pendingReturns` y el evento `BidPlaced`; tests para primera puja, puja bajo el mínimo, puja no superior, puja en/después de `endTime`, puja del vendedor, mejor postor que sube su puja, superado varias veces y emisión del evento; verificar con `forge test`
- [x] 2.3 Añadir un test fuzz de secuencias de pujas que compruebe el invariante `address(auction).balance == highestBid + suma(pendingReturns)`; verificar con `forge test` (256+ runs)

## 3. Retiros

- [x] 3.1 Implementar `withdraw()` con CEI, errores `NothingToWithdraw`/`TransferFailed` y evento `Withdrawn`; tests para retiro exitoso, sin saldo, doble retiro, retiro tras el cierre y receptor que rechaza ETH (saldo conservado); verificar con `forge test`
- [x] 3.2 Añadir un contrato atacante en los tests que reentra en `withdraw()` al recibir ETH y verificar con `forge test` que no obtiene más que su saldo

## 4. Cierre y pago al vendedor

- [x] 4.1 Implementar `endAuction()` (errores `AuctionNotYetEnded`/`AuctionAlreadyEnded`, `ended = true`, pago al vendedor vía `call`, evento `AuctionClosed`) y getters `winner()`/`finalPrice()`; tests para cierre con ganador, cierre anticipado, cierre repetido, cierre sin pujas, vendedor recibe el pago, saldos de postores intactos y emisión del evento; verificar con `forge test`
- [x] 4.2 Test de vendedor contrato que rechaza ETH: `endAuction()` revierte con `TransferFailed` y `ended` sigue en `false`; verificar con `forge test`
- [x] 4.3 Añadir NatSpec a las funciones públicas de `Auction.sol` y verificar con `forge doc` (Foundry 1.8 ya no tiene `--build`) que se genera sin errores

## 5. Despliegue local y documentación

- [x] 5.1 Crear `script/DeployAuction.s.sol` que lee `MIN_PRICE` y `DURATION` del entorno y despliega `Auction`; verificar desplegando contra `anvil` con `forge script ... --broadcast` y consultando `endTime` con `cast call`
- [x] 5.2 Escribir `README.md` con requisitos, comandos de build/test/despliegue local y un ejemplo con `cast` (pujar, retirar, cerrar); verificar ejecutando los comandos del README contra `anvil`

## 6. Verificación final

- [x] 6.1 Ejecutar `forge fmt --check`, `forge build` y `forge test -vv`, y verificar que todo pasa
- [x] 6.2 Ejecutar `forge coverage` y verificar 100 % de líneas y ramas en `src/Auction.sol`
- [x] 6.3 Ejecutar `openspec validate add-auction-contract --strict` y verificar que pasa

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` tras revisar la implementación.
