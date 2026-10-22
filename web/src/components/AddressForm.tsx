"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";

/** Pide la dirección de una subasta y navega a `/auction/<dirección>`. */
export function AddressForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = value.trim();
    if (!isAddress(address)) {
      setError("Introduce una dirección válida (0x seguido de 40 caracteres hexadecimales).");
      return;
    }
    router.push(`/auction/${address}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="address" className="text-sm font-medium">
        Dirección de la subasta
      </label>
      <div className="flex gap-2">
        <input
          id="address"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-neutral-700"
          value={value}
          aria-invalid={!!error}
          aria-describedby="address-help"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Abrir
        </button>
      </div>
      <p id="address-help" className={`text-sm ${error ? "text-red-700" : "text-neutral-600 dark:text-neutral-400"}`}>
        {error ?? "Es la dirección que imprime script/Subasta.s.sol al desplegar."}
      </p>
    </form>
  );
}
