import Link from "next/link";
import { Suspense } from "react";
import { isAddress } from "viem";
import { AuctionView } from "@/components/AuctionView";

async function AuctionRoute({ params }: { params: PageProps<"/auction/[address]">["params"] }) {
  const { address } = await params;

  if (!isAddress(address)) {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">La dirección no es válida.</p>
        <p className="font-mono break-all">{decodeURIComponent(address)}</p>
        <Link href="/" className="underline">
          Introducir otra dirección
        </Link>
      </div>
    );
  }

  return <AuctionView address={address} />;
}

export default function AuctionPage({ params }: PageProps<"/auction/[address]">) {
  return (
    <Suspense fallback={<p className="text-sm">Cargando…</p>}>
      <AuctionRoute params={params} />
    </Suspense>
  );
}
