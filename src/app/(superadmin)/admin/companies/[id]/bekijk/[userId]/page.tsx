import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { loadShopPreview } from "@/lib/personeel/preview";
import { ShopPreview } from "@/components/personeel/shop-preview";

export const dynamic = "force-dynamic";

export default async function AdminPreviewShopPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  const me = await getCurrentUser();
  if (!me?.isSuperadmin) redirect("/dashboard");
  const preview = await loadShopPreview(id, userId);
  if (!preview) notFound();

  return (
    <ShopPreview
      {...preview}
      backHref={`/admin/companies/${id}?tab=personeel&persoon=${userId}`}
    />
  );
}
