# Spec Delta

## Purpose

Interfaz web para consultar una subasta desplegada en una red local anvil e interactuar con ella (elegir cuenta, pujar, retirar y cerrar) sin usar la terminal.

## ADDED Requirements

### Requirement: Red local anvil
La aplicación SHALL conectarse únicamente a una red local anvil (chain id 31337) en la URL RPC configurada, por defecto `http://127.0.0.1:8545`. Si el nodo no responde o su chain id no es 31337, la aplicación MUST mostrar un aviso explicativo y deshabilitar las acciones.

#### Scenario: Nodo disponible
- **WHEN** anvil está en marcha en la URL configurada
- **THEN** la aplicación carga los datos de la subasta sin avisos de red

#### Scenario: Nodo caído
- **WHEN** no hay ningún nodo respondiendo en la URL configurada
- **THEN** la aplicación muestra un aviso indicando que inicie `anvil` y no ofrece acciones

#### Scenario: Red equivocada
- **WHEN** el nodo responde con un chain id distinto de 31337
- **THEN** la aplicación muestra un aviso de red no soportada y no ofrece acciones

### Requirement: Selección de la subasta
La aplicación SHALL mostrar una subasta identificada por su dirección en la ruta `/auction/<dirección>`. La página de inicio MUST redirigir a la dirección configurada por defecto si existe; si no, MUST pedir una dirección y navegar a ella. Una dirección mal formada o sin contrato `Auction` MUST mostrar un error en lugar de datos.

#### Scenario: Dirección configurada
- **WHEN** hay una dirección por defecto configurada y el usuario abre la página de inicio
- **THEN** la aplicación navega a `/auction/<esa dirección>`

#### Scenario: Sin dirección configurada
- **WHEN** no hay dirección por defecto y el usuario abre la página de inicio
- **THEN** ve un campo para introducir la dirección y, al enviarla, navega a `/auction/<dirección>`

#### Scenario: Dirección inválida
- **WHEN** el usuario abre `/auction/hola`
- **THEN** la aplicación indica que la dirección no es válida

#### Scenario: Dirección sin contrato
- **WHEN** el usuario abre `/auction/<dirección>` de una cuenta sin código desplegado
- **THEN** la aplicación indica que no hay una subasta en esa dirección

### Requirement: Selección de cuenta
La aplicación SHALL listar las cuentas desbloqueadas del nodo anvil con su saldo en ETH y permitir elegir una como cuenta activa. Todas las transacciones MUST enviarse en nombre de la cuenta activa. La elección MUST conservarse al recargar la página. La aplicación MUST NOT pedir ni almacenar claves privadas.

#### Scenario: Elegir cuenta
- **WHEN** el usuario elige la segunda cuenta de anvil
- **THEN** esa cuenta pasa a ser la activa y se muestran su dirección y su saldo

#### Scenario: Recarga
- **WHEN** el usuario recarga la página tras elegir una cuenta
- **THEN** la misma cuenta sigue activa

#### Scenario: Cuenta activa es el vendedor
- **WHEN** la cuenta activa es el vendedor de la subasta
- **THEN** la aplicación lo indica y no ofrece la acción de pujar

### Requirement: Estado de la subasta
La aplicación SHALL mostrar vendedor, precio mínimo, puja más alta y su autor, cierre programado, tiempo restante y estado: "abierta" antes del cierre programado, "lista para cerrar" desde ese instante si no se ha cerrado, y "cerrada" tras el cierre, con ganador y precio final. El tiempo MUST calcularse con el reloj de la cadena, no con el del navegador.

#### Scenario: Subasta abierta sin pujas
- **WHEN** la subasta no ha llegado a su cierre programado y nadie ha pujado
- **THEN** se muestra estado "abierta", el tiempo restante y que aún no hay pujas

#### Scenario: Plazo vencido sin cerrar
- **WHEN** el reloj de la cadena alcanzó el cierre programado y nadie ha cerrado
- **THEN** se muestra estado "lista para cerrar"

#### Scenario: Subasta cerrada
- **WHEN** la subasta está cerrada con ganador B y precio final 2 ETH
- **THEN** se muestra estado "cerrada", ganador B y precio final 2 ETH

#### Scenario: Cerrada sin pujas
- **WHEN** la subasta está cerrada y nadie pujó
- **THEN** se muestra estado "cerrada" e indica que no hubo ganador

#### Scenario: Reloj de la cadena adelantado
- **WHEN** se adelanta el tiempo de anvil más allá del cierre programado aunque el reloj del navegador no haya llegado
- **THEN** la aplicación muestra "lista para cerrar"

### Requirement: Actualización automática
La aplicación SHALL refrescar el estado de la subasta y los saldos al minarse cada bloque nuevo, sin recargar la página, de modo que los cambios hechos desde otra pestaña o desde `cast` se vean en pocos segundos.

#### Scenario: Puja externa
- **WHEN** otra cuenta puja desde `cast` mientras la página está abierta
- **THEN** la puja más alta y su autor se actualizan en la página sin recargar

### Requirement: Pujar
Mientras la subasta esté abierta y la cuenta activa no sea el vendedor, la aplicación SHALL permitir pujar un monto en ETH. MUST rechazar antes de enviar un monto vacío, no numérico, cero, menor que el precio mínimo o no superior a la puja más alta, indicando el mínimo aceptable. Tras confirmarse la transacción, la página MUST reflejar la nueva puja.

#### Scenario: Puja válida
- **WHEN** la subasta está abierta con precio mínimo 1 ETH, sin pujas, y el usuario puja 1,5 ETH
- **THEN** se envía la transacción y, al confirmarse, la puja más alta es 1,5 ETH de la cuenta activa

#### Scenario: Monto insuficiente
- **WHEN** la puja más alta es 2 ETH y el usuario introduce 2 ETH
- **THEN** la aplicación no envía la transacción e indica que debe superar 2 ETH

#### Scenario: Monto no numérico
- **WHEN** el usuario introduce "abc" como monto
- **THEN** la aplicación no envía la transacción e indica que el monto no es válido

#### Scenario: Subasta no abierta
- **WHEN** la subasta está lista para cerrar o cerrada
- **THEN** la acción de pujar no está disponible

### Requirement: Retirar
La aplicación SHALL mostrar el saldo retirable de la cuenta activa y, si es mayor que cero, permitir retirarlo en cualquier estado de la subasta. Si el saldo es cero, la acción MUST NOT estar disponible.

#### Scenario: Retiro disponible
- **WHEN** la cuenta activa tiene 1 ETH de saldo retirable y pulsa retirar
- **THEN** se envía la transacción y, al confirmarse, su saldo retirable pasa a 0 y su saldo de ETH aumenta

#### Scenario: Sin saldo
- **WHEN** la cuenta activa tiene saldo retirable 0
- **THEN** la acción de retirar no está disponible

### Requirement: Cerrar
Cuando la subasta esté lista para cerrar, la aplicación SHALL permitir que cualquier cuenta la cierre. En cualquier otro estado la acción MUST NOT estar disponible. Tras confirmarse, la página MUST mostrar el estado cerrado con ganador y precio final.

#### Scenario: Cierre
- **WHEN** la subasta está lista para cerrar y el usuario pulsa cerrar
- **THEN** se envía la transacción y, al confirmarse, se muestra "cerrada" con ganador y precio final

#### Scenario: Antes del plazo
- **WHEN** la subasta está abierta
- **THEN** la acción de cerrar no está disponible

### Requirement: Estado de las transacciones y errores
Mientras una transacción esté pendiente, la aplicación SHALL indicarlo y MUST impedir enviar otra acción. Si la transacción revierte o falla, MUST mostrar un mensaje comprensible en español; los errores conocidos del contrato (por ejemplo, puja demasiado baja o subasta terminada) MUST traducirse a mensajes específicos.

#### Scenario: Transacción pendiente
- **WHEN** el usuario envía una puja
- **THEN** se muestra un indicador de pendiente y los botones de acción quedan deshabilitados hasta que se confirma o falla

#### Scenario: Revert conocido
- **WHEN** una puja revierte porque otra cuenta pujó más justo antes
- **THEN** se muestra un mensaje indicando que la puja es demasiado baja

#### Scenario: Error de red
- **WHEN** el nodo deja de responder al enviar una transacción
- **THEN** se muestra un mensaje de error de conexión y los botones vuelven a estar disponibles
