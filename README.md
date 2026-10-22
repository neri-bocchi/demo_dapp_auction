# demo_dapp_auction

Contrato de subasta inglesa en Solidity (`src/Auction.sol`):

- El vendedor (quien despliega) fija un **precio mínimo** (wei) y una **duración** (segundos).
- Cualquier cuenta excepto el vendedor puja con `bid()` enviando ETH. La puja debe ser ≥ precio mínimo y mayor que la más alta.
- Los postores superados recuperan su ETH con `withdraw()` cuando quieran.
- Al vencer el plazo, cualquiera llama a `endAuction()`: queda registrado el ganador (`winner()`, `finalPrice()`) y el vendedor cobra la puja ganadora.

La especificación completa está en `openspec/`.

## Requisitos

- [Foundry](https://getfoundry.sh) ≥ 1.8 (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)

```sh
git clone --recurse-submodules git@github.com:neri-bocchi/demo_dapp_auction.git
# o, si ya clonaste sin submódulos:
git submodule update --init --recursive
```

## Build y tests

```sh
forge build
forge test -vv
forge coverage
```

## Despliegue local con anvil

En una terminal:

```sh
anvil
```

En otra, despliega con la cuenta #0 de anvil como vendedor (precio mínimo 1 ETH, duración 1 h):

```sh
export RPC=http://localhost:8545
export SELLER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export ALICE_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export BOB_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

MIN_PRICE=1000000000000000000 DURATION=3600 \
  forge script script/Subasta.s.sol --rpc-url $RPC --broadcast --private-key $SELLER_PK
```

El script imprime la dirección del contrato (`Auction: 0x...`). Guárdala:

```sh
export AUCTION=0x5FbDB2315678afecb367f032d93F642f64180aa3  # la dirección impresa
```

> Estas claves privadas son las cuentas de prueba públicas de anvil. No las uses nunca en una red real.

## Ejemplo con `cast`

```sh
# Alice puja 1 ETH, Bob la supera con 2 ETH
cast send $AUCTION "bid()" --value 1ether --private-key $ALICE_PK --rpc-url $RPC
cast send $AUCTION "bid()" --value 2ether --private-key $BOB_PK --rpc-url $RPC

cast call $AUCTION "highestBidder()(address)" --rpc-url $RPC
cast call $AUCTION "pendingReturns(address)(uint256)" $(cast wallet address $ALICE_PK) --rpc-url $RPC

# Alice retira su 1 ETH
cast send $AUCTION "withdraw()" --private-key $ALICE_PK --rpc-url $RPC

# Avanzar el reloj de anvil más allá del cierre y cerrar la subasta
cast rpc evm_increaseTime 3600 --rpc-url $RPC
cast rpc evm_mine --rpc-url $RPC
cast send $AUCTION "endAuction()" --private-key $ALICE_PK --rpc-url $RPC

cast call $AUCTION "winner()(address)" --rpc-url $RPC
cast call $AUCTION "finalPrice()(uint256)" --rpc-url $RPC
```

## Notas de diseño

- Los reembolsos usan *pull payments* (`withdraw`) para que un postor que rechace ETH no pueda bloquear la subasta.
- Si el vendedor es un contrato que rechaza ETH, `endAuction()` revierte y la subasta no puede cerrarse. Los postores superados siguen pudiendo retirar.
- El contrato rechaza ETH enviado directamente sin llamar a `bid()`.
