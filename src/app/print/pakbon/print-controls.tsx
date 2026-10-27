"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintControls({ count }: { count: number }) {
  return (
    <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-4 print:hidden">
      <Button variant="ghost" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Button>
      <span className="text-sm text-neutral-500">
        {count === 1 ? "1 pakbon" : `${count} pakbonnen`}
      </span>
      <Button onClick={() => window.print()} disabled={!count}>
        <Printer className="h-4 w-4" /> Afdrukken
      </Button>
    </div>
  );
}
