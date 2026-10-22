# Proposal

## Why

El contrato `Auction` ya está desplegable en anvil, pero hoy solo se puede usar con `cast` desde la terminal. Para la demo necesitamos una interfaz web que permita ver el estado de una subasta y pujar, retirar y cerrar con unos clics.

## What Changes

- Nueva app web **Next.js (App Router, TypeScript)** en el directorio `web/`, usando **viem** para leer y escribir en la cadena, sin wagmi ni librerías de wallet.
- **Solo red local anvil** (chain id 31337, `http://127.0.0.1:8545`).
- **Cuentas de anvil como "wallet"**: un selector lista las cuentas desbloqueadas de anvil y las transacciones se envían en nombre de la cuenta elegida. No se usan MetaMask ni claves privadas en el navegador.
- **Una subasta por dirección**: ruta `/auction/[address]`. La página de inicio redirige a la subasta configurada en `NEXT_PUBLIC_AUCTION_ADDRESS` o, si no hay, pide una dirección.
- La página de subasta muestra vendedor, precio mínimo, puja más alta y su autor, tiempo restante según el reloj de la cadena, estado (abierta, lista para cerrar, cerrada), ganador y precio final, y el saldo retirable de la cuenta seleccionada. Se actualiza sola con cada bloque nuevo.
- Acciones: **pujar** (monto en ETH), **retirar** y **cerrar**, con validación previa en la interfaz, estado pendiente y errores del contrato traducidos a mensajes claros.
- El ABI de `Auction` se exporta desde Foundry a un módulo TypeScript tipado.

## Capabilities

### New Capabilities
- `auction-web`: interfaz web para consultar una subasta desplegada e interactuar con ella (seleccionar cuenta, pujar, retirar, cerrar) en una red local anvil.

### Modified Capabilities
<!-- Ninguna: el comportamiento del contrato (`auction`) no cambia. -->

## Impact

- **Código nuevo**: `web/` (app Next.js, módulo del ABI, helpers de viem y tests). Nuevo job de CI para la web. El README se amplía.
- **Dependencias**: `next`, `react`, `viem`, Tailwind CSS (el estándar de `create-next-app`) y `vitest` para tests. Node ≥ 22 (hay 24 instalado).
- **Contrato**: sin cambios. La web depende de la interfaz pública definida en la spec `auction`.
- **Fuera de alcance**: MetaMask y otras wallets reales, testnets o mainnet, desplegar subastas desde la web, listado o índice de subastas, despliegue en Vercel u otro hosting.
