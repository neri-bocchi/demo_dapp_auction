import { redirect } from "next/navigation";
import { AddressForm } from "@/components/AddressForm";
import { AUCTION_ADDRESS } from "@/lib/config";

export default function Home() {
  if (AUCTION_ADDRESS) redirect(`/auction/${AUCTION_ADDRESS}`);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Subasta</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No hay una subasta configurada en <code className="font-mono">NEXT_PUBLIC_AUCTION_ADDRESS</code>.
      </p>
      <AddressForm />
    </div>
  );
}
