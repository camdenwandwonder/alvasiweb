"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { requestExtraBudget } from "@/lib/budget-request-actions";

/** Ask the approvers for extra budget (or credits), with a reason. */
export function RequestBudgetDialog({ unit, onClose }: { unit: "euro" | "credits"; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await requestExtraBudget(fd);
      if (res.ok) {
        toast.success("Aanvraag verstuurd naar je beheerder");
        onClose();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meer budget aanvragen</DialogTitle>
          <DialogDescription>
            Je beheerder krijgt een melding. Na goedkeuring is het extra budget direct te gebruiken.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label={unit === "credits" ? "Aantal credits" : "Bedrag (€)"}>
            <Input
              name="amount"
              type="number"
              min={unit === "credits" ? "1" : "0.01"}
              step={unit === "credits" ? "1" : "0.01"}
              required
            />
          </Field>
          <Field label="Reden">
            <Textarea
              name="reason"
              rows={3}
              required
              placeholder="Bijv. nieuwe werkzaamheden waarvoor extra kleding nodig is"
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Aanvraag versturen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

