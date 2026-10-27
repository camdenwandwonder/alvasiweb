# Plan: een bestellingenoverzicht dat echt antwoord geeft

Status: **gebouwd** (28-10-2026), met het advies bij alle beslispunten.

Doel: de pagina Bestellingen moet een manager en Alvasi binnen een paar seconden laten zien
**wie wat heeft besteld, in welke periode, voor hoeveel, en wat er nog openstaat**. Dat moet
ook werken bij honderden medewerkers en duizenden bestellingen.

---

## 1. Wat er nu mis is

De pagina is nu een platte lijst kaarten met bestelnummer, status, naam, aantal artikelen,
datum en bedrag (zie de schermafbeelding van Zieleman). Dat werkt bij vier bestellingen en
loopt vast bij vierhonderd.

| Vraag van de manager | Kan dat nu? | Waarom niet |
|---|---|---|
| Wat heeft Jan dit jaar besteld? | Nee | Geen zoeken, geen filter op medewerker, geen periode |
| Wat is er in september besteld en voor hoeveel? | Nee | Geen periodekeuze, geen totalen |
| *Wat* zit er in een bestelling? | Pas na doorklikken | De lijst toont "2 artikelen", niet "2× Polo maat L" |
| Wat wacht er nog op mij? | Half | Status staat erbij, maar je kunt er niet op filteren |
| Welke functie of afdeling kost het meest? | Nee | Er is geen samenvatting |
| Hoeveel jassen in welke maten zijn er besteld? | Nee | Er is geen overzicht per product of maat |
| Kan ik dit in Excel krijgen? | Nee | Alleen Alvasi kan exporteren, en dan alles zonder filter |

Technische problemen die het plan meteen oplost:

- **Alles wordt in één keer geladen.** De pagina haalt *alle* bestellingen met *alle*
  regels op en zoekt daarna de namen erbij. Bij duizenden bestellingen wordt dat traag en
  zwaar. Filteren, tellen en bladeren moet in de database gebeuren.
- **Geen geheugen voor de functie.** Een bestelling weet niet welke functie de medewerker
  had op het moment van bestellen. Wisselt Jan van functie, dan verschuiven zijn oude
  bestellingen in elk overzicht "per functie". Dat moet vastgelegd worden.
- **Ontbrekende indexen.** Er is geen index op `(company_id, created_at)` of op status.
  Zoeken op productnaam of bestelnummer kan nu alleen traag.
- **Alvasi heeft geen bestellingenoverzicht.** Er is alleen het productiebord (kanban) en
  een rapportage met één totaal per bedrijf. Een filterbare lijst over alle bedrijven
  ontbreekt, en de CSV-export negeert elke selectie.

---

## 2. Wat vergelijkbare systemen doen (onderzoek)

| Systeem | Patroon | Overnemen? |
|---|---|---|
| Nielsen Norman Group (onderzoek naar datatabellen) | **Tabel boven kaarten** om records te vergelijken; vaste kop en eerste kolom; detail in een **zijpaneel**, niet in een pop-up of uitklaprij | Ja, de basis van het ontwerp |
| Shopify (bestellingenlijst) | **Weergaven als tabbladen** ("Alles" + eigen weergaven), zoeken op nummer, klant en product, meerdere tegelijk selecteren, pakbonnen printen | Ja: statustabs, bulk goedkeuren, pakbon later |
| Stripe (betalingen) | Vaste weergaven per status; **zoekopdracht en filters in de link**, zodat je een overzicht kunt delen; **exporteert precies wat je ziet** | Ja: filters in de link, export volgt de filters |
| Linear | Filters als **chips**; periodes per maand, kwartaal en jaar; weergaven opslaan en delen | Ja: chips en presets; opgeslagen weergaven later |
| Precoro | Snelle filters in beeld, de rest achter een knop "Filters"; zoeken op meerdere bestelnummers tegelijk | Ja: snelle filters plus een paneel voor de rest |
| Procurify (inkoopinzicht) | Kaarten met **deze maand tegenover vorige maand**, top 10, budget tegenover besteding per afdeling, doorklikken naar de bestellingen | Ja: samenvatting boven de lijst die meebeweegt met de filters |
| Amazon Business | Filteren op **gebruiker, groep, besteldatum en categorie**; beheerder ziet alles, goedkeurder ziet zijn groep, besteller ziet alleen zijn eigen bestellingen | Ja: die drie zichtniveaus hebben we al (alles / eigen) |
| Snappy (bedrijfscadeaus) | Losse tabbladen **Bestellingen / Producten / Medewerkers / Transacties** | Ja: drie weergaven van dezelfde selectie |
| OrderMyGear (teamkleding) | Productrapport **per product, kleur en maat**, met namen erbij en een CSV-download | Ja: weergave "Per product" met maatverdeling |
| Brilliant (bedrijfswinkel) | Bedrag **betaald door het bedrijf apart van credits/eigen bijdrage**; afdeling als kolom | Ja: euro én credits naast elkaar voor de manager |
| Bedrijfskledingportalen NL | Budget of punten per medewerker, soms een bestelfrequentie | Ja: budgetverbruik per medewerker tonen |

Valkuilen uit hetzelfde onderzoek:

- **Verborgen filters** ("waarom klopt dit totaal niet?"). Actieve filters zijn daarom
  altijd als chip zichtbaar.
- **Een export die de filters negeert.**
- **Alleen vaste periodes zonder eigen datumkeuze.**
- **Een standaardfilter dat stilletjes bestellingen verbergt.**
- **Uitklaprijen die allemaal open blijven staan.**
- **Één bedragkolom terwijl er in credits wordt betaald.**

Bronnen: nngroup.com (Data Tables, Mobile Tables), help.shopify.com, docs.stripe.com,
linear.app/docs, help.precoro.com, success.procurify.com, business.amazon.com,
help.snappy.com, support.ordermygear.com, help.brilliantmade.com (onderzoek 27-10-2026).

---

## 3. Het idee in één zin

> Eén selectie (periode + filters) en drie manieren om ernaar te kijken:
> **per bestelling**, **per medewerker** en **per product**. Erboven staan de totalen van
> precies die selectie.

Zo beantwoordt dezelfde pagina alle drie de vragen:

- *Wat is er gebeurd?* → per bestelling
- *Wie heeft wat besteld?* → per medewerker
- *Wat is er besteld?* → per product en maat

---

## 4. Indeling van de pagina

```
Bestellingen                                              [Exporteren ▾]
Alle bestellingen van Zieleman

[Dit jaar ▾]  [Zoek op bestelnummer, naam of product             ]
[Status ▾] [Medewerker ▾] [Functie ▾] [Product ▾] [Leveradres ▾] [Meer filters]
Actief: (Functie: Monteur ×) (Product: Softshell jas ×)          Wissen

┌───────────────┬───────────────┬──────────────────┬──────────────────┐
│ 128           │ € 6.412,50    │ 41 van 56        │ 3                │
│ bestellingen  │ besteed       │ medewerkers      │ wacht op         │
│ +12% t.o.v.   │ 1.283 credits │ hebben besteld   │ goedkeuring  →   │
│ vorig jaar    │               │ 15 nog niet  →   │                  │
└───────────────┴───────────────┴──────────────────┴──────────────────┘

Weergave:  [Bestellingen]  [Per medewerker]  [Per product]

Alles 128 · Wacht op goedkeuring 3 · In productie 9 · Verzonden 4 · Geleverd 109 · Afgewezen/geannuleerd 3

☐ Bestelling      Datum        Medewerker           Inhoud                       Bedrag     Status
☐ ALV-2026-00128  27 okt 09:12 Jan de Vries         2× Polo (L), 1× Jas (XL)     € 101,50   ● In productie
                                Monteur                                                     
☐ ALV-2026-00127  26 okt 16:40 Fatima El Amrani     1× Softshell jas (M)          € 79,00   ● Wacht op goedkeuring
…
                                                         1–50 van 128   ‹ 1 2 3 ›
```

Klik je op een rij, dan opent rechts een **zijpaneel** met de hele bestelling (zie §9). De
lijst blijft zichtbaar, je kunt met de pijltjestoetsen naar de volgende bestelling, en de
link verandert mee zodat je hem kunt delen.

---

## 5. Periode, zoeken en filters

**Periode, altijd zichtbaar en als eerste keuze**

- Presets: Vandaag, Deze week, Deze maand, Vorige maand, Dit kwartaal, Vorig kwartaal,
  Dit jaar, Vorig jaar, Laatste 30 dagen, Laatste 12 maanden, Alles, en Aangepast (van–tot).
- Standaard staat de periode op **Dit jaar** (beslispunt 2).
- **Open bestellingen buiten de periode raken nooit zoek.** Valt een bestelling die op
  goedkeuring wacht buiten de gekozen periode, dan verschijnt een melding: "2 open
  bestellingen vallen buiten deze periode. Toon ze."

**Zoeken**, één veld dat zoekt in:

- bestelnummer, ook een deel ("128") en meerdere tegelijk ("124, 127, 128");
- naam en e-mail van de medewerker;
- productnaam, maat of variant en artikelnummer;
- de notitie bij de bestelling.

**Snelle filters** (keuzelijsten met zoekveld en aantallen):

| Filter | Toelichting |
|---|---|
| Status | Meerdere tegelijk; "Open" = wacht op goedkeuring, in productie of verzonden |
| Medewerker | Meerdere tegelijk; ook gedeactiveerde medewerkers |
| Functie | Op de functie **op het moment van bestellen** (§12) |
| Product | Ook per categorie; vindt bestellingen waarin dat product zit |
| Leveradres | Op de vestiging uit de leveradressen, of "afwijkend adres" |

**Meer filters**, in een paneel:

- bedrag van–tot;
- "aangevraagd buiten budget of maximum" (`is_request`);
- goedgekeurd door;
- "met proef";
- "met notitie".

**Gedrag**

- Elke actieve filter staat als **chip** in beeld met een kruisje. "Wissen" zet alles
  terug naar de standaard.
- Periode, filters, zoekopdracht, weergave, sortering en pagina staan **in de link**. Een
  manager kan dus "alle jassen van monteurs in Q3" als link doorsturen of als bladwijzer
  bewaren.
- Kolommen zijn sorteerbaar op datum, medewerker, bedrag en status. Standaard staat de
  nieuwste bovenaan.

---

## 6. Samenvatting boven de lijst

Vier kaarten die **altijd de huidige selectie** tonen. Elke kaart is klikbaar en zet dan
een filter.

| Kaart | Inhoud | Klik |
|---|---|---|
| Bestellingen | aantal + verschil met de vorige gelijke periode | – |
| Besteed | euro (en credits als het bedrijf met credits werkt) + aantal artikelen | opent "Per product" |
| Medewerkers | "41 van 56 hebben besteld", met "15 nog niet" | opent "Per medewerker" met "nog niet besteld" |
| Wacht op goedkeuring | aantal open goedkeuringen in deze selectie | filtert op die status |

Afgewezen en geannuleerde bestellingen tellen niet mee in "besteed". Zo werkt het ook bij
budgetten.

Bij de bestelwijze **geen budget + prijzen verborgen** zien medewerkers geen bedragen. De
manager ziet de bedragen wel (het bedrijf betaalt), net als nu.

---

## 7. Weergave "Bestellingen"

**Statustabs met aantallen** boven de tabel: Alles, Wacht op goedkeuring, In productie,
Verzonden, Geleverd, Afgewezen of geannuleerd. Een tab is een snelkoppeling voor het
statusfilter.

**Kolommen**:

- selectievakje;
- bestelnummer;
- datum en tijd;
- medewerker, met de functie eronder;
- **inhoud**: "2× Polo (L), 1× Jas (XL)", ingekort met "+3 meer";
- aantal artikelen;
- bedrag (euro en/of credits volgens de bestelwijze);
- status;
- leveradres (verborgen kolom, aan te zetten).

Een kolomkeuze ("Kolommen ▾") laat de manager kolommen aan- en uitzetten. Die keuze wordt
per gebruiker onthouden.

**Meerdere tegelijk selecteren**, waarna een balk verschijnt met:

- *Goedkeuren* en *Afwijzen*: alleen voor goedkeurders, en alleen bij bestellingen die
  wachten;
- *Exporteren* van de selectie.

**Bladeren**: 50 per pagina, met het totaal erbij ("1–50 van 128"). Bladeren en tellen
gebeuren in de database (§12).

---

## 8. Weergave "Per medewerker": wie heeft wat besteld

Eén rij per medewerker in de gekozen periode:

| Medewerker | Functie | Bestellingen | Artikelen | Besteed | Budget | Laatste bestelling |
|---|---|---|---|---|---|---|
| Jan de Vries | Monteur | 4 | 9 | € 312,00 | ▓▓▓▓░ 78% | 27 okt |
| Piet Bakker | Monteur | 0 | 0 | – | ░░░░░ 0% | nog nooit |

- Klik je een medewerker open, dan zie je **alles wat hij in die periode besteld heeft**
  als productregels met maat ("Polo L ×4, Jas XL ×1"), plus zijn bestellingen. Er is ook
  een link naar zijn kaart op de Personeel-pagina.
- Je kunt kiezen tussen **"Iedereen" en "Alleen wie besteld heeft"**. "Iedereen" toont
  ook wie *niet* besteld heeft. Dat is precies wat een kledingprogramma wil weten, zoals
  "wie heeft zijn winterjas nog niet?".
- De budgetkolom alleen bij euro- of creditbudget; bij maxima per product: "3 van 5
  producten op".
- Sorteren op besteed, aantal of naam.

---

## 9. Weergave "Per product": wat is er besteld, in welke maten

Eén rij per product, met de maatverdeling:

| Product | Totaal | Maten | Medewerkers | Besteed |
|---|---|---|---|---|
| Softshell jas | 38 | S 4 · M 12 · L 14 · XL 6 · XXL 2 | 31 | € 3.002,00 |
| Polo | 96 | … | 40 | € 2.112,00 |

- Klik je een product open, dan zie je per maat **wie** het besteld heeft. Daarmee
  beantwoord je "wie heeft er allemaal een jas in maat L gekregen?".
- Dit is ook handig voor Alvasi bij het inkopen en produceren: het is een paklijst per
  periode.

### Detailpaneel (in alle weergaven)

Het zijpaneel toont de bestelling volledig:

- nummer, status en tijdlijn;
- besteller (klik opent de Personeel-kaart);
- regels met maat, aantal, stukprijs, credits en totaal;
- leveradres;
- notitie en reden van een aanvraag;
- proeven;
- goedgekeurd door en wanneer.

Knoppen, afhankelijk van rechten: *Goedkeuren / Afwijzen*, *Annuleren* (eigen bestelling
die nog wacht), *Pakbon printen* (fase 3) en *Opnieuw bestellen* (fase 3). De losse
pagina `/orders/[id]` blijft bestaan voor links uit e-mails.

---

## 10. Exporteren

De knop "Exporteren ▾" exporteert **precies de huidige selectie**. Het menu toont hoeveel
er meegaan ("128 bestellingen"). Drie soorten:

1. **Bestellingen**: één regel per bestelling met nummer, datum, medewerker, e-mail,
   functie, status, aantal artikelen, bedrag, credits, leveradres en goedgekeurd door.
2. **Bestelregels**: één regel per product, met maat, aantal, stukprijs, credits en
   regeltotaal. Hiermee maakt een manager in Excel elke draaitabel die hij wil.
3. **Per medewerker / per product**: de tabel van de actieve weergave.

Het bestandsformaat wordt Excel (.xlsx) of CSV; zie beslispunt 4.

---

## 11. Wie ziet wat

| Wie | Ziet | Extra |
|---|---|---|
| Medewerker (alleen eigen bestellingen) | Eigen bestellingen, eenvoudigere pagina: zoeken, periode, status. Geen medewerker- of functiefilter en geen "Per medewerker"-weergave. Bedragen in zijn eigen eenheid (credits als het bedrijf met credits werkt) | Inhoud per bestelling zichtbaar; status volgen; *opnieuw bestellen* (fase 3) |
| Manager met "alle bestellingen zien" | Alles van het eigen bedrijf, alle drie de weergaven, samenvatting, export | Goedkeuren alleen met het recht "goedkeuren" |
| Alvasi (superadmin) | **Nieuw: Bestellingen over alle bedrijven** in de groep Werk, met een extra filter en kolom *Bedrijf*. Plus een tab *Bestellingen* bij elk bedrijf met hetzelfde overzicht, al op dat bedrijf gefilterd | Het productiebord blijft voor het werkproces; de rapportage linkt hierheen |

Deze rechten worden in de database afgedwongen (de bestaande rijbeveiliging), niet alleen
in de schermen.

---

## 12. Techniek

**Filteren, tellen en bladeren in de database**

- Eén databasefunctie `order_overview(filters)` geeft drie dingen terug: de pagina met
  bestellingen, het totaal aantal, en de samenvatting.
- Twee zusterfuncties leveren de weergaven per medewerker en per product.
- De functies draaien **met de rechten van de ingelogde gebruiker**, dus de bestaande
  rijbeveiliging blijft gelden. Een medewerker kan via deze functie nooit andermans
  bestellingen opvragen.
- Snelheid: één query per weergave in plaats van alles ophalen. Met indexen blijft dat
  onder ~200 ms bij tienduizenden bestellingen.

**Nieuwe velden en indexen** (één migratie, alleen toevoegen):

- `orders.role_id` en `orders.role_name`: de functie op het moment van bestellen. Wordt
  gevuld bij het afrekenen. Bestaande bestellingen krijgen de huidige functie.
- `orders.ordered_by_name`: de naam op het moment van bestellen, zodat de lijst ook klopt
  als iemand later van naam verandert, en sneller zoekt.
- Indexen:
  - `orders (company_id, created_at desc)`;
  - `orders (company_id, status)`;
  - `order_items (product_id)`;
  - trigram-zoekindexen (pg_trgm) op bestelnummer, besteller, productnaam en variant.

**De pagina zelf**

- De server rendert de eerste weergave direct uit de link, zonder laadflits.
- Filters wijzigen de link. Alleen de tabel en de samenvatting worden opnieuw opgehaald,
  met een korte laadtoestand; de pagina zelf blijft staan.
- Zoeken wacht 300 ms tot je stopt met typen.
- Het zijpaneel laadt de details van één bestelling apart.

**Onderdelen**, zo opgezet dat ze bij het bedrijf, bij Alvasi en bij de medewerker
herbruikbaar zijn:

- `OrdersWorkspace` voor de pagina;
- `OrderFilters`;
- `OrderSummary`;
- de drie tabellen;
- `OrderDrawer`;
- de export-route `/orders/export`, die dezelfde filters leest als de pagina.

**Mobiel**

- De tabel wordt een lijst gestapelde rijen: nummer + status, naam, inhoud, bedrag.
- Filters openen in een paneel van onderaf.
- De samenvatting wordt twee kaarten naast elkaar.
- Het zijpaneel wordt een volledig scherm.

---

## 13. Bouwvolgorde

**Fase 1: de kern** (het grootste verschil, direct bruikbaar)

1. Migratie: functie en naam vastleggen bij een bestelling, de indexen en de
   zoekfuncties.
2. Afrekenen vult `role_id`, `role_name` en `ordered_by_name`.
3. Weergave Bestellingen:
   - periode, zoeken, snelle filters met chips, alles in de link;
   - statustabs met aantallen;
   - tabel met inhoud en bladeren.
4. Samenvatting boven de lijst.
5. Zijpaneel met goedkeuren en afwijzen.
6. Export van bestellingen en bestelregels, volgens de filters.
7. Eenvoudige variant voor medewerkers.

**Fase 2: wie en wat**

8. Weergave Per medewerker, inclusief "nog niet besteld" en budgetverbruik.
9. Weergave Per product met maatverdeling en namen.
10. Meer filters, bulk goedkeuren en afwijzen, kolomkeuze.

**Fase 3: Alvasi en extra's**

11. Bestellingen over alle bedrijven voor Alvasi, en een tab Bestellingen bij elk bedrijf.
12. Pakbon printen, opnieuw bestellen, opgeslagen weergaven.

---

## 14. Beslispunten

1. **Detail in een zijpaneel of op een eigen pagina?**
   Advies: **zijpaneel**, net als bij Personeel. Je blijft in de lijst en klikt snel door.
   De losse pagina blijft voor links.
2. **Standaardperiode?**
   Advies: **Dit jaar**. Open bestellingen buiten de periode worden altijd gemeld.
   Alternatieven: Deze maand, of Laatste 3 maanden.
3. **Drie weergaven of alleen de bestellingenlijst?**
   Advies: **drie weergaven** (Bestellingen / Per medewerker / Per product). Juist "wie
   heeft wat besteld" was de vraag.
4. **Exportformaat?**
   Advies: **Excel (.xlsx)** met nette kolommen en euro-opmaak, plus CSV voor
   boekhoudpakketten.
5. **Moet een leidinggevende alleen zijn eigen team zien?**
   Nu ziet "alle bestellingen zien" het hele bedrijf; er bestaan nog geen teams of
   afdelingen. Advies: **nu niet**, wel zo bouwen dat een filter "team" later kan.
6. **Alvasi-overzicht in fase 3, of meteen in fase 1?**
   Advies: **fase 3**. Eerst de manager, daarna is het voor Alvasi grotendeels hergebruik.

## 15. Bewust niet (nu)

- Grafieken over tijd. De samenvatting en het maandoverzicht op Personeel dekken dit
  eerst. Een trendlijn kan later.
- Facturen of kostenplaatsen per bestelling.
- Teams en afdelingen als nieuw begrip (zie beslispunt 5).
