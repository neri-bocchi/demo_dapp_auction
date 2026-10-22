# Proposal

## Why

El proyecto `demo_dapp_auction` está vacío: no existe todavía ningún contrato que permita subastar un bien a cambio de ETH. Necesitamos un contrato de subasta inglesa simple, seguro y verificable que sirva como base de la dApp.

## What Changes

- Nuevo proyecto Foundry (`forge`) en la raíz del repo con `src/`, `test/` y `script/`.
- Nuevo contrato `Auction.sol` (una subasta por despliegue):
  - El vendedor (quien despliega) fija un **precio mínimo** (en wei) y una **duración** (en segundos) en el constructor.
  - Cualquier cuenta distinta del vendedor puede pujar enviando ETH mientras la subasta esté abierta; la puja debe ser ≥ precio mínimo y estrictamente mayor que la puja más alta actual.
  - Cuando una puja es superada, el ETH del postor anterior queda como saldo pendiente y este lo **retira** él mismo (patrón *pull payment*), sin reembolsos automáticos.
  - Una vez vencido el plazo, cualquiera puede **cerrar** la subasta: se registra el ganador y el monto, y se transfiere la puja ganadora al vendedor. Si nadie pujó, la subasta cierra sin ganador.
  - Eventos para pujas, retiros y cierre.
- Tests de Foundry que cubren el flujo completo y los casos de error.
- Script de despliegue para una red local (`anvil`).

## Capabilities

### New Capabilities
- `auction`: ciclo de vida de una subasta en cadena — configuración (precio mínimo y duración), pujas, retiro de fondos de postores superados, cierre, registro del ganador y pago al vendedor.

### Modified Capabilities
<!-- Ninguna: no hay specs existentes. -->

## Impact

- **Código nuevo**: `foundry.toml`, `src/Auction.sol`, `test/Auction.t.sol`, `script/Subasta.s.sol`.
- **Dependencias**: Foundry ≥ 1.8 (ya instalado) y `forge-std` como submódulo/librería de tests. Sin dependencias en tiempo de ejecución (no se usa OpenZeppelin).
- **Fuera de alcance**: frontend, entrega de un NFT/bien en cadena, múltiples subastas en un contrato (factory), extensión automática del plazo (*anti-sniping*), cancelación por el vendedor, y despliegue a testnets/mainnet.
