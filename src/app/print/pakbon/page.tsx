import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { PrintControls } from "./print-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pakbon" };

type Item = {
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string | null;
  created_at: string;
  ordered_by_name: string | null;
  role_name: string | null;
  note: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  ship_to_postal: string | null;
  ship_to_city: string | null;
  ship_to_country: string | null;
  company: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
  items: Item[] | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

export default async function PackingSlipPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { ids: raw } = await searchParams;
  const ids = [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)))].slice(0, 100);

  let orders: Order[] = [];
  if (ids.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, created_at, ordered_by_name, role_name, note, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, ship_to_country, company:companies(name, logo_url), items:order_items(product_name, variant_label, sku, quantity, created_at)",
      )
      .in("id", ids);
    const position = new Map(ids.map((id, i) => [id, i]));
    orders = ((data ?? []) as unknown as Order[]).sort(
      (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-black print:bg-white">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <PrintControls count={orders.length} />

      {orders.length === 0 ? (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="font-medium">Geen pakbonnen gevonden</p>
          <p className="mt-1 text-sm text-neutral-500">
            De bestellingen bestaan niet of je hebt er geen toegang toe.
          </p>
        </div>
      ) : (
        orders.map((o) => {
          const company = Array.isArray(o.company) ? o.company[0] : o.company;
          const items = (o.items ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
          const count = items.reduce((s, i) => s + i.quantity, 0);
          const cityLine = [o.ship_to_postal, o.ship_to_city].filter(Boolean).join(" ");
          return (
            <section
              key={o.id}
              className="mx-auto mb-6 max-w-[210mm] bg-white p-10 shadow-sm [break-after:page] last:[break-after:auto] print:mb-0 print:max-w-none print:p-0 print:shadow-none"
            >
              <header className="flex items-start justify-between gap-6 border-b border-black pb-5">
                <div>
                  {company?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={company.logo_url} alt="" className="mb-3 h-10 w-auto object-contain" />
                  ) : null}
                  <p className="text-sm font-medium">{company?.name ?? ""}</p>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-semibold tracking-tight">Pakbon</h1>
                  <p className="mt-1 text-sm">{o.order_number ?? "Bestelling"}</p>
                  <p className="text-sm text-neutral-600">{date(o.created_at)}</p>
                </div>
              </header>

              <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Besteld door</p>
                  <p className="font-medium">{o.ordered_by_name ?? "Onbekend"}</p>
                  {o.role_name ? <p className="text-neutral-600">{o.role_name}</p> : null}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Leveradres</p>
                  {o.ship_to_name ? <p className="font-medium">{o.ship_to_name}</p> : null}
                  {o.ship_to_address ? <p>{o.ship_to_address}</p> : null}
                  {cityLine ? <p>{cityLine}</p> : null}
                  {o.ship_to_country ? <p>{o.ship_to_country}</p> : null}
                  {!o.ship_to_name && !o.ship_to_address && !cityLine ? (
                    <p className="text-neutral-500">Geen leveradres opgegeven</p>
                  ) : null}
                </div>
              </div>

              {o.note?.trim() ? (
                <div className="mt-6 rounded border border-neutral-300 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Notitie</p>
                  <p className="whitespace-pre-line">{o.note}</p>
                </div>
              ) : null}

              <table className="mt-8 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="py-2 pr-3 font-semibold">Product</th>
                    <th className="py-2 pr-3 font-semibold">Variant</th>
                    <th className="py-2 pr-3 font-semibold">Artikelnummer</th>
                    <th className="py-2 pr-3 text-right font-semibold">Aantal</th>
                    <th className="w-28 py-2 text-center font-semibold">Gecontroleerd</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx} className="border-b border-neutral-300 [break-inside:avoid]">
                      <td className="py-2.5 pr-3">{i.product_name}</td>
                      <td className="py-2.5 pr-3">{i.variant_label ?? ""}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs">{i.sku ?? ""}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{i.quantity}</td>
                      <td className="py-2.5 text-center">
                        <span className="inline-block h-4 w-4 border border-black" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right font-semibold">
                      Totaal artikelen
                    </td>
                    <td className="pt-3 pr-3 text-right font-semibold tabular-nums">{count}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>

              <footer className="mt-12 grid grid-cols-2 gap-8 text-sm text-neutral-600">
                <div>
                  <p>Ingepakt door</p>
                  <div className="mt-8 border-b border-neutral-400" />
                </div>
                <div>
                  <p>Datum</p>
                  <div className="mt-8 border-b border-neutral-400" />
                </div>
              </footer>
            </section>
          );
        })
      )}
    </div>
  );
}
