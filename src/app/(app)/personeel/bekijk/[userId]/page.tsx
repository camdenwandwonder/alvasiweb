import { notFound, redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { loadShopPreview } from "@/lib/personeel/preview";
import { ShopPreview } from "@/components/personeel/shop-preview";

export const dynamic = "force-dynamic";

export default async function PreviewShopPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "users.view")) redirect("/dashboard");

  const preview = await loadShopPreview(user.companyId, userId);
  if (!preview) notFound();

  return <ShopPreview {...preview} backHref={`/personeel?persoon=${userId}`} />;
}
