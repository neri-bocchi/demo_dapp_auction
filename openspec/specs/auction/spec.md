# auction Specification

## Purpose

Permite que un vendedor subaste un bien a cambio de ETH en cadena: recibe pujas hasta un plazo fijo, gana la puja más alta, los postores superados recuperan su ETH y el vendedor cobra al cierre.

## Requirements

### Requirement: Configuración de la subasta
La subasta SHALL crearse con un vendedor (la cuenta que la crea), un precio mínimo en wei y una duración en segundos. El cierre programado SHALL ser el instante de creación más la duración. La creación MUST rechazarse si la duración es cero. Vendedor, precio mínimo y cierre programado MUST ser consultables públicamente y no cambiar nunca.

#### Scenario: Creación válida
- **WHEN** una cuenta crea una subasta con precio mínimo 1 ETH y duración 3600 s
- **THEN** el vendedor es esa cuenta, el precio mínimo es 1 ETH y el cierre programado es el instante de creación + 3600 s

#### Scenario: Duración cero
- **WHEN** una cuenta intenta crear una subasta con duración 0
- **THEN** la creación se revierte y no existe subasta

#### Scenario: Precio mínimo cero
- **WHEN** una cuenta crea una subasta con precio mínimo 0
- **THEN** la subasta se crea y acepta cualquier puja mayor que cero

### Requirement: Pujar
Mientras el instante actual sea anterior al cierre programado, cualquier cuenta distinta del vendedor SHALL poder pujar enviando ETH. El monto enviado es la puja. La puja MUST ser mayor que cero, mayor o igual al precio mínimo y estrictamente mayor que la puja más alta vigente; si no, MUST revertirse sin cambiar el estado. Una puja aceptada pasa a ser la más alta.

#### Scenario: Primera puja válida
- **WHEN** un postor envía 1 ETH en una subasta abierta con precio mínimo 1 ETH y sin pujas
- **THEN** ese postor es el mejor postor y la puja más alta es 1 ETH

#### Scenario: Puja inferior al precio mínimo
- **WHEN** un postor envía 0,5 ETH en una subasta con precio mínimo 1 ETH
- **THEN** la transacción se revierte

#### Scenario: Puja no superior a la más alta
- **WHEN** la puja más alta es 2 ETH y otro postor envía 2 ETH
- **THEN** la transacción se revierte y la puja más alta sigue siendo 2 ETH del postor anterior

#### Scenario: Puja después del cierre programado
- **WHEN** un postor envía una puja en el instante del cierre programado o después
- **THEN** la transacción se revierte

#### Scenario: El vendedor intenta pujar
- **WHEN** el vendedor envía una puja
- **THEN** la transacción se revierte

#### Scenario: El mejor postor sube su propia puja
- **WHEN** el mejor postor actual, con 1 ETH, envía una nueva puja de 2 ETH
- **THEN** la puja más alta pasa a ser 2 ETH y el 1 ETH anterior queda como saldo retirable de ese postor

### Requirement: Saldo retirable de postores superados
Cuando una puja es superada, su monto SHALL acreditarse al saldo retirable del postor que la hizo, acumulándose si fue superado varias veces. El ETH de pujas superadas MUST NOT devolverse automáticamente. La puja más alta vigente MUST NOT formar parte del saldo retirable de nadie. El saldo retirable de cada cuenta MUST ser consultable públicamente.

#### Scenario: Puja superada
- **WHEN** A puja 1 ETH y luego B puja 2 ETH
- **THEN** el saldo retirable de A es 1 ETH y el de B es 0

#### Scenario: Superado varias veces
- **WHEN** A puja 1 ETH, B puja 2 ETH, A puja 3 ETH y B puja 4 ETH
- **THEN** el saldo retirable de A es 4 ETH y el de B es 2 ETH

### Requirement: Retirar fondos
Una cuenta con saldo retirable mayor que cero SHALL poder retirarlo en cualquier momento, antes o después del cierre. El retiro MUST transferir el saldo completo a esa cuenta y dejarlo en cero antes de la transferencia. Si la transferencia falla, el retiro MUST revertirse y el saldo conservarse. Retirar con saldo cero MUST revertirse.

#### Scenario: Retiro exitoso
- **WHEN** A tiene 1 ETH de saldo retirable y lo retira
- **THEN** A recibe 1 ETH y su saldo retirable pasa a 0

#### Scenario: Retiro sin saldo
- **WHEN** una cuenta con saldo retirable 0 intenta retirar
- **THEN** la transacción se revierte

#### Scenario: Doble retiro
- **WHEN** A retira su saldo y vuelve a intentar retirar
- **THEN** el segundo intento se revierte y A no recibe ETH adicional

#### Scenario: Reentrada durante el retiro
- **WHEN** un contrato postor intenta volver a retirar desde la recepción del ETH
- **THEN** no obtiene más que su saldo original

### Requirement: Cerrar la subasta
En o después del cierre programado, cualquier cuenta SHALL poder cerrar la subasta, una sola vez. Al cerrar, el mejor postor y la puja más alta MUST quedar registrados como ganador y precio final, consultables públicamente. Cerrar antes del cierre programado o cerrar por segunda vez MUST revertirse.

#### Scenario: Cierre con ganador
- **WHEN** el plazo venció, B tiene la puja más alta de 2 ETH y una cuenta cierra la subasta
- **THEN** la subasta queda cerrada con ganador B y precio final 2 ETH

#### Scenario: Cierre anticipado
- **WHEN** una cuenta intenta cerrar antes del cierre programado
- **THEN** la transacción se revierte y la subasta sigue abierta

#### Scenario: Cierre repetido
- **WHEN** una cuenta intenta cerrar una subasta ya cerrada
- **THEN** la transacción se revierte

#### Scenario: Cierre sin pujas
- **WHEN** el plazo venció sin pujas y una cuenta cierra la subasta
- **THEN** la subasta queda cerrada sin ganador (dirección cero), con precio final 0, y no se transfiere ETH

### Requirement: Pago al vendedor
Al cerrar una subasta con ganador, la puja ganadora SHALL transferirse al vendedor en la misma transacción. Si esa transferencia falla, el cierre completo MUST revertirse. El pago al vendedor MUST NOT afectar los saldos retirables de los postores superados.

#### Scenario: Vendedor cobra al cerrar
- **WHEN** se cierra una subasta cuya puja ganadora es 2 ETH
- **THEN** el vendedor recibe 2 ETH en esa transacción

#### Scenario: Fondos de postores intactos tras el cierre
- **WHEN** A tiene 1 ETH de saldo retirable y se cierra la subasta pagando al vendedor
- **THEN** A puede seguir retirando su 1 ETH

### Requirement: Eventos observables
La subasta SHALL emitir un evento por cada puja aceptada (postor y monto), por cada retiro (cuenta y monto) y al cerrar (ganador y precio final), para que clientes fuera de la cadena puedan seguir su estado.

#### Scenario: Evento de puja
- **WHEN** se acepta una puja de 1 ETH de A
- **THEN** se emite un evento de puja con postor A y monto 1 ETH

#### Scenario: Evento de cierre
- **WHEN** se cierra la subasta con ganador B y precio final 2 ETH
- **THEN** se emite un evento de cierre con ganador B y precio 2 ETH

### Requirement: Rechazo de ETH no solicitado
La subasta MUST rechazar ETH enviado sin invocar la operación de pujar, para que todo ETH recibido corresponda a una puja.

#### Scenario: Transferencia directa
- **WHEN** una cuenta envía ETH directamente a la subasta sin pujar
- **THEN** la transacción se revierte
