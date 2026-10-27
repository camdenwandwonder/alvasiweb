import { redirect } from "next/navigation";

export default async function RoleRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/personeel?tab=functies&functie=${encodeURIComponent(id)}`);
}
