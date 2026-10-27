import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";

/**
 * Dutch address lookup: postcode + house number → street and town, via the
 * free PDOK Locatieserver (BAG). Logged-in users only; answers are cached.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Geen toegang" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const postcode = (params.get("postcode") ?? "").toUpperCase().replace(/\s+/g, "");
  const number = (params.get("huisnummer") ?? "").match(/^\d{1,5}/)?.[0] ?? "";
  if (!/^\d{4}[A-Z]{2}$/.test(postcode) || !number)
    return NextResponse.json({ error: "Vul een geldige postcode en huisnummer in." }, { status: 400 });

  const url = new URL("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free");
  url.searchParams.set("q", `postcode:${postcode} and huisnummer:${number}`);
  url.searchParams.set("fq", "type:adres");
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "straatnaam,woonplaatsnaam");

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as {
      response?: { docs?: { straatnaam?: string; woonplaatsnaam?: string }[] };
    };
    const doc = json.response?.docs?.[0];
    if (!doc?.straatnaam || !doc.woonplaatsnaam)
      return NextResponse.json({ error: "Geen adres gevonden bij deze postcode en dit huisnummer." }, { status: 404 });
    return NextResponse.json(
      { street: doc.straatnaam, city: doc.woonplaatsnaam },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "Adres opzoeken lukt nu niet. Vul het zelf in." }, { status: 502 });
  }
}
