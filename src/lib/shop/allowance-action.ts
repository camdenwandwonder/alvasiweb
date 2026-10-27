"use server";

import { getCurrentUser, can } from "@/lib/auth/user";
import { getAllowanceFor, type PersonAllowance } from "@/lib/allowance";
import type { OrderingSettings } from "@/lib/ordering";
import { getOrderRecipient } from "./recipient";

/** Budget/maxima for the header indicator (the employee's when ordering for someone). */
export async function getHeaderAllowance(): Promise<{
  settings: OrderingSettings;
  allowance: PersonAllowance;
  forName: string | null;
  canRequest: boolean;
} | null> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create")) return null;
  const recipient = await getOrderRecipient(user);
  const { settings, allowance } = await getAllowanceFor(user.companyId, recipient?.id ?? user.id);
  if (!allowance.budget && !allowance.capsEnabled) return null;
  return {
    settings,
    allowance,
    forName: recipient ? recipient.name.split(" ")[0]! : null,
    canRequest: !recipient,
  };
}
