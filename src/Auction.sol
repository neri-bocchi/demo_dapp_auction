// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Auction
/// @notice Subasta inglesa de un solo bien pagada en ETH. Quien despliega es el vendedor.
/// @dev Los postores superados recuperan su ETH con `withdraw` (pull payment). El vendedor
///      cobra la puja ganadora en la misma transacción de `endAuction`.
contract Auction {
    /// @notice La duración indicada en el constructor es cero.
    error ZeroDuration();
    /// @notice Se intentó pujar en el cierre programado o después.
    error AuctionEnded();
    /// @notice El vendedor no puede pujar en su propia subasta.
    error SellerCannotBid();
    /// @notice La puja es cero, menor que el precio mínimo o no supera a la más alta.
    error BidTooLow();
    /// @notice La cuenta no tiene saldo retirable.
    error NothingToWithdraw();
    /// @notice Falló la transferencia de ETH al destinatario.
    error TransferFailed();
    /// @notice Se intentó cerrar antes del cierre programado.
    error AuctionNotYetEnded();
    /// @notice La subasta ya fue cerrada.
    error AuctionAlreadyEnded();

    /// @notice Se aceptó una puja.
    event BidPlaced(address indexed bidder, uint256 amount);
    /// @notice Una cuenta retiró su saldo retirable.
    event Withdrawn(address indexed account, uint256 amount);
    /// @notice La subasta se cerró. `winner` es la dirección cero si nadie pujó.
    event AuctionClosed(address indexed winner, uint256 amount);

    /// @notice Cuenta que creó la subasta y recibe la puja ganadora.
    address public immutable seller;
    /// @notice Puja mínima aceptada, en wei.
    uint256 public immutable minPrice;
    /// @notice Instante (timestamp) a partir del cual no se aceptan pujas y se puede cerrar.
    uint256 public immutable endTime;

    /// @notice Autor de la puja más alta vigente (dirección cero si no hay pujas).
    address public highestBidder;
    /// @notice Monto de la puja más alta vigente, en wei.
    uint256 public highestBid;
    /// @notice Indica si la subasta ya fue cerrada.
    bool public ended;

    /// @notice Saldo retirable de cada postor superado, en wei.
    mapping(address => uint256) public pendingReturns;

    /// @param minPrice_ Puja mínima aceptada, en wei (puede ser cero).
    /// @param duration Segundos desde el despliegue hasta el cierre programado (mayor que cero).
    constructor(uint256 minPrice_, uint256 duration) {
        if (duration == 0) revert ZeroDuration();
        seller = msg.sender;
        minPrice = minPrice_;
        endTime = block.timestamp + duration;
    }

    /// @notice Puja con el ETH enviado. Debe ser mayor que cero, al menos `minPrice` y
    ///         estrictamente mayor que `highestBid`. La puja superada pasa a `pendingReturns`.
    function bid() external payable {
        if (block.timestamp >= endTime) revert AuctionEnded();
        if (msg.sender == seller) revert SellerCannotBid();
        if (msg.value == 0 || msg.value < minPrice || msg.value <= highestBid) revert BidTooLow();

        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }
        highestBidder = msg.sender;
        highestBid = msg.value;

        emit BidPlaced(msg.sender, msg.value);
    }

    /// @notice Transfiere a quien llama todo su saldo retirable. Disponible en cualquier momento.
    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingReturns[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Cierra la subasta, registra al ganador y paga la puja ganadora al vendedor.
    ///         Cualquiera puede llamarla una vez alcanzado `endTime`, y solo una vez.
    function endAuction() external {
        if (block.timestamp < endTime) revert AuctionNotYetEnded();
        if (ended) revert AuctionAlreadyEnded();

        ended = true;
        emit AuctionClosed(highestBidder, highestBid);

        if (highestBid > 0) {
            (bool ok,) = seller.call{value: highestBid}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Ganador de la subasta; dirección cero si no se ha cerrado o nadie pujó.
    function winner() external view returns (address) {
        return ended ? highestBidder : address(0);
    }

    /// @notice Precio final pagado al vendedor; cero si no se ha cerrado o nadie pujó.
    function finalPrice() external view returns (uint256) {
        return ended ? highestBid : 0;
    }
}
