"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelOwnOrder } from "../actions";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await cancelOwnOrder(orderId);
      if (res.ok) {
        toast.success("Bestelling geannuleerd");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <XCircle className="h-4 w-4" /> Annuleren
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bestelling annuleren?</DialogTitle>
          <DialogDescription>
            De bestelling wordt niet uitgevoerd en telt niet meer mee voor je
            budget of maximum.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Terug
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Annuleren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
