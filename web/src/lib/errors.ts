import { BaseError, ContractFunctionRevertedError, HttpRequestError } from "viem";

/** Mensajes para los errores personalizados del contrato Auction. */
export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  BidTooLow: "La puja es demasiado baja: debe superar la puja actual y el precio mínimo.",
  AuctionEnded: "La subasta ya no acepta pujas.",
  SellerCannotBid: "El vendedor no puede pujar en su propia subasta.",
  NothingToWithdraw: "No tienes saldo para retirar.",
  AuctionNotYetEnded: "La subasta todavía no ha terminado.",
  AuctionAlreadyEnded: "La subasta ya está cerrada.",
  TransferFailed: "La transferencia de ETH falló.",
};

export const CONNECTION_ERROR_MESSAGE = "No se pudo conectar con el nodo (¿está anvil en marcha?).";

/** Convierte cualquier error de viem (o desconocido) en un mensaje para el usuario. */
export function toUserMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && CONTRACT_ERROR_MESSAGES[name]) return CONTRACT_ERROR_MESSAGES[name];
      return `La transacción fue revertida${name ? ` (${name})` : ""}.`;
    }
    if (error.walk((e) => e instanceof HttpRequestError) instanceof HttpRequestError) {
      return CONNECTION_ERROR_MESSAGE;
    }
    return `Error: ${error.shortMessage}`;
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) return CONNECTION_ERROR_MESSAGE;
  if (error instanceof Error) return `Error: ${error.message}`;
  return "Error desconocido.";
}
