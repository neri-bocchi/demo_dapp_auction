# Design

## Context

Repositorio vacío (solo `openspec/` y `.claude/`). Foundry 1.8.6 está instalado localmente. Motivación y alcance en `proposal.md`; requisitos en `specs/auction/spec.md`.

## Goals / Non-Goals

**Goals:**
- Un único contrato pequeño, legible y sin dependencias de runtime, apto como demo.
- Seguridad frente a reentrada y frente a postores/vendedores que rechazan ETH.
- Cobertura de tests de todos los escenarios del spec, incluyendo fuzz de la secuencia de pujas.

**Non-Goals:**
- Optimización agresiva de gas o upgradeability (proxy).
- Soporte para tokens ERC-20 como medio de pago.

## Decisions

### Layout Foundry estándar
`forge init` en la raíz: `src/Auction.sol`, `test/Auction.t.sol`, `script/Subasta.s.sol`, `forge-std` en `lib/`. Se fija `solc = "0.8.30"` (o la última 0.8.x estable disponible en Foundry) en `foundry.toml` para builds reproducibles.
*Alternativa*: Hardhat — descartado; Foundry ya está instalado y los tests en Solidity con fuzzing son más directos.

### Un contrato = una subasta
El constructor recibe `minPrice` y `duration`; `seller = msg.sender`, `endTime = block.timestamp + duration`. Ambos `immutable`.
*Alternativa*: factory con muchas subastas por `id` — más estado y complejidad; fuera de alcance. Un factory puede añadirse después desplegando instancias de este mismo contrato.

### Pull payments para postores superados
Mapping `pendingReturns[address]`. Al aceptar una nueva puja, el monto del mejor postor anterior se suma a su saldo. `withdraw()` aplica *checks-effects-interactions*: lee el saldo, lo pone a 0 y luego hace `call{value: amount}("")`; si falla, `revert` (restaura el saldo).
*Alternativa*: reembolso inmediato en `bid()` — un postor contrato que rechace ETH bloquearía todas las pujas futuras (DoS). Descartado.

### Pago al vendedor con push en `endAuction()`
Al cerrar se marca `ended = true`, se registran `winner`/`finalPrice` y luego se transfiere al vendedor con `call`. Si falla, revierte todo (spec: el cierre completo se revierte).
*Trade-off*: si el vendedor es un contrato que rechaza ETH, la subasta no podrá cerrarse nunca. Es aceptable porque el vendedor eligió su propia dirección; los postores superados siguen pudiendo retirar. *Alternativa*: acreditar al vendedor en `pendingReturns` — más robusto pero contradice el requisito "se le paga al vendedor al cerrar".

### Protección contra reentrada
CEI en `withdraw()` y `endAuction()` es suficiente: el estado se actualiza antes de cualquier llamada externa, y `bid()` no hace llamadas externas. No se añade un `ReentrancyGuard` para evitar dependencias; el test de reentrada lo verifica.

### Errores personalizados y eventos
`error` personalizados (`AuctionEnded`, `AuctionNotYetEnded`, `AuctionAlreadyEnded`, `BidTooLow`, `SellerCannotBid`, `NothingToWithdraw`, `TransferFailed`, `ZeroDuration`) en vez de `require` con strings: más baratos y fáciles de comprobar con `vm.expectRevert(selector)`.
Eventos: `BidPlaced(bidder, amount)`, `Withdrawn(account, amount)`, `AuctionClosed(winner, amount)`, con las direcciones `indexed`.

### Rechazo de ETH directo
Sin `receive()` ni `fallback()` payable: Solidity revierte las transferencias directas por defecto.

### Interfaz pública

| Función / getter | Notas |
|---|---|
| `constructor(uint256 minPrice, uint256 duration)` | revierte `ZeroDuration` |
| `bid() payable` | |
| `withdraw()` | |
| `endAuction()` | callable por cualquiera |
| `seller`, `minPrice`, `endTime` | immutables |
| `highestBidder`, `highestBid`, `ended` | estado |
| `pendingReturns(address)` | saldo retirable |
| `winner()`, `finalPrice()` | tras el cierre; antes del cierre devuelven 0 |

`winner`/`finalPrice` se implementan como getters que devuelven `highestBidder`/`highestBid` solo si `ended`, evitando duplicar estado.

## Risks / Trade-offs

- [El vendedor rechaza ETH → la subasta no puede cerrarse] → Documentado; los fondos de postores superados siguen siendo retirables. El ETH ganador queda bloqueado; aceptable para la demo.
- [Manipulación de `block.timestamp` por validadores (~segundos)] → Irrelevante para duraciones de minutos u horas.
- [*Sniping* de último segundo] → Fuera de alcance; posible extensión futura (extender `endTime`).
- [Selfdestruct/forzar ETH al contrato] → El ETH forzado no afecta la contabilidad porque nunca se usa `address(this).balance` para decidir pagos.

## Migration Plan

No aplica (proyecto nuevo). Despliegue local: `anvil` + `forge script script/Subasta.s.sol --rpc-url http://localhost:8545 --broadcast`, con `MIN_PRICE` y `DURATION` por variables de entorno.
