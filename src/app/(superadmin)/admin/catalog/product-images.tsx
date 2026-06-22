"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Loader2, X, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addProductImageUrl,
  removeProductImage,
  setPrimaryImage,
} from "./actions";

type Img = { id: string; url: string; is_primary: boolean };

export function ProductImages({
  productId,
  companyId,
  images,
}: {
  productId: string;
  companyId: string;
  images: Img[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024,
    );
    if (!files.length) {
      toast.error("Kies geldige afbeeldingen (max 5 MB).");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    let ok = 0;
    for (const file of files) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        await addProductImageUrl(productId, companyId, data.publicUrl);
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload mislukt.");
      }
    }
    setUploading(false);
    if (ok) {
      toast.success(`${ok} afbeelding${ok === 1 ? "" : "en"} toegevoegd`);
      router.refresh();
    }
  }

  function onRemove(id: string) {
    startTransition(async () => {
      await removeProductImage(id, productId);
      router.refresh();
    });
  }
  function onPrimary(id: string) {
    startTransition(async () => {
      await setPrimaryImage(id, productId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {images.map((im) => (
            <div
              key={im.id}
              className="group/img relative overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={im.url}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {im.is_primary ? (
                <span className="absolute left-1.5 top-1.5">
                  <Badge>Hoofd</Badge>
                </span>
              ) : null}
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover/img:opacity-100">
                {!im.is_primary ? (
                  <button
                    type="button"
                    onClick={() => onPrimary(im.id)}
                    title="Als hoofdfoto"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 hover:bg-background"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(im.id)}
                  title="Verwijderen"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-destructive hover:bg-background"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Compact dropzone — uploads (and saves) immediately, multiple at once */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition",
          dragging
            ? "border-[var(--brand-2)] bg-[var(--brand-2)]/5"
            : "text-muted-foreground hover:border-foreground/30 hover:bg-muted/50",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Bezig met uploaden…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" /> Sleep afbeeldingen hierheen of
            klik — meerdere tegelijk mogelijk
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
