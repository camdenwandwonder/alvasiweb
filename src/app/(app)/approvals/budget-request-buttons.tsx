"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { decideBudgetRequest } from "@/lib/budget-request-actions";

export function BudgetRequestButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function decide(approve: boolean) {
    start(async () => {
      const res = await decideBudgetRequest(id, approve, note);
      if (res.ok) {
        toast.success(approve ? "Extra budget toegekend" : "Aanvraag afgewezen");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => decide(true)} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Goedkeuren
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" variant="destructive" disabled={pending} />}>
          Afwijzen
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aanvraag afwijzen</DialogTitle>
          </DialogHeader>
          <Field label="Toelichting voor de medewerker (optioneel)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Terug
            </Button>
            <Button type="button" variant="destructive" onClick={() => decide(false)} disabled={pending}>
              Afwijzen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
