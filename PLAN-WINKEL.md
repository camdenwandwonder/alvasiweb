# Plan: een winkel die in één oogopslag laat zien wat je kunt bestellen

Status: **plan, nog niet gebouwd** (28-10-2026).

Doel: de winkel wordt compact, persoonlijk en snel. Een medewerker ziet direct wat hij
mag bestellen, in zijn eigen maat, en heeft het met één klik in zijn winkelwagen. Een
manager overziet het assortiment en bestelt snel meerdere maten tegelijk. Dat geldt voor
alle rollen: medewerker, leidinggevende, manager en Alvasi in het winkelvoorbeeld.

---

## 1. Wat er nu mis is

Bij Zieleman (schermafbeelding van Wilko) staat **boven de vouw geen enkele productnaam of
prijs**. Je ziet een titel, twee meldingen en drie foto's van ruim 500 pixels breed. Pas
na scrollen zie je wat een product is en kost.

| Onderdeel | Nu | Probleem |
|---|---|---|
| Raster | 3 kolommen op een laptop, 2 op een tablet, 1 op mobiel | Kaarten zijn twee keer zo groot als gebruikelijk; 3 producten per scherm |
| Foto | Vierkant, bijgesneden (`cover`) | Vlaggen en ronde geurhangers worden afgesneden; geen vaste achtergrond |
| Kaart | Naam, prijs, categorie, omschrijving en een volledig bestelformulier (keuzelijst, aantal, knop) in elke kaart | Druk en lang; de keuzelijst toont "Maat: S, Kleur: Navy" als tekst |
| Bovenaan | Twee brede meldingen: "Vul je maten in" en "Geen budgetlimiet" | Duwen alles omlaag, ook bij een manager; "Geen budgetlimiet" zegt niets nuttigs |
| Categorieën | Verstopt in een keuzelijst | Je ziet niet welke categorieën er zijn |
| Productinformatie | Geen productpagina; tweede foto alleen bij aanwijzen met de muis | Geen fotogalerij, maattabel, levertijd of uitleg |
| Persoonlijk | Alleen de standaardmaat wordt vooraf gekozen | Geen favorieten, geen "eerder besteld", geen "voor jouw functie" |
| Manager | Precies dezelfde winkel als de medewerker | Geen lijstweergave, niet meerdere maten in één keer |

Gevonden in de data en code:

- **Gegevens die er al zijn maar niet getoond worden.** Per product bestaan al:
  - levertijd (`lead_time_days`);
  - "proef nodig" (`requires_proof`);
  - "altijd goedkeuring" (`requires_approval_override`);
  - "maximaal per bestelling" (`max_quantity_per_order`).

  De winkel doet er niets mee, en het maximum per bestelling wordt pas bij het afrekenen
  gecontroleerd.
- **Geen omschrijvingen.** Geen enkel product van Zieleman heeft een omschrijving; elk
  product heeft 1 of 2 foto's.
- **Één kleur.** Alle kledingvarianten zijn "Kleur: Navy". Een kleurkeuze voegt nu dus
  niets toe, maar moet wel werken zodra er meer kleuren komen.

---

## 2. Wat vergelijkbare winkels doen (onderzoek)

| Bron | Patroon | Overnemen? |
|---|---|---|
| Baymard Institute (e-commerce-onderzoek) | **Maatfilter bovenaan**: 39% ontdekt pas op de productpagina dat de maat er niet is; ~90% filtert eerst op maat | Ja: "Jouw maat" staat vooraf aan en staat op elke kaart |
| Baymard | **Snelle weergave** helpt bij kleding, maar de knop mag niet midden op de foto staan (wordt per ongeluk aangeklikt) | Ja: productpaneel, knop onderaan de kaart |
| Baymard | **Meerdere foto's** per kaart met zichtbare stipjes; op mobiel vegen | Ja |
| Baymard | Horizontale filterbalk werkt tot ~6–8 filters; "Alle filters"-knoppen worden over het hoofd gezien | Ja: plakkende balk met een paar filters, geen verborgen paneel |
| Baymard | **"Meer laden"** boven eindeloos scrollen; terug van een product = zelfde plek | Ja |
| Nielsen Norman Group | Gelijke uitsnede, achtergrond en schaal van foto's; prijs ontbreken is een groot probleem op B2B-sites | Ja: vaste fotoverhouding, altijd een "rechtenregel" |
| Nielsen Norman Group | Categorieën **zichtbaar boven het raster**, niet in een keuzelijst | Ja: categorie-chips met aantallen |
| Depict, Shopify Horizon | 2 kolommen mobiel, 3–4 tablet, 4–6 desktop; kaarten van ~240–300 px | Ja: 2 / 3 / 4 / 5 kolommen |
| Shopify Horizon | **Snel toevoegen** vanaf de kaart | Ja, als de maat al vaststaat |
| Shopify B2B (snelbestellijst) | **Aantal per maat in één keer** (3× M, 5× L) | Ja: maatmatrix voor managers |
| Amazon Business | **Opnieuw bestellen**-lijsten; niet-toegestane artikelen grijs, "goedkeuring nodig" met label | Ja: "Eerder besteld" en labels |
| UniformMarket, Experlogix (uniformportalen) | Assortiment en quota **per functie**; resterend tegoed zichtbaar; maten per medewerker; **bestellen namens** een medewerker | Ja: "Voor jouw functie", budget in de kop, bestellen namens (fase 3) |
| Desmos-winkel | Tegoed klein **rechtsboven** in plaats van grote meldingen | Ja: budgetmeter in de kop |
| Inclusive Components | Hele kaart klikbaar via de titel-link, niet alles in één `<a>` | Ja (toegankelijkheid) |

Valkuilen uit hetzelfde onderzoek:

- te grote foto's;
- alles alleen bij aanwijzen met de muis (werkt niet op een telefoon);
- meer dan twee labels per kaart;
- grote budgetmeldingen die het raster omlaag duwen;
- prijzen tonen terwijl ze verborgen horen te zijn;
- eindeloos scrollen;
- de scrollpositie kwijtraken na het bekijken van een product.

Bronnen: baymard.com (productlijsten, quick views, maatfilter, horizontale filters,
hover-info, maattabellen), nngroup.com (productfoto's, productlijsten, varianten),
depict.ai, help.shopify.com (B2B snelbestellijst, Horizon), business.amazon.com,
uniformmarket.com, experlogix.com, inclusive-components.design (onderzoek 28-10-2026).

---

## 3. Het idee in één zin

> Een **compacte, persoonlijke winkel**: kleine nette kaarten (4–5 naast elkaar), op
> elke kaart **wat dit voor jóu betekent** (prijs of credits, "nog 2 van 3", "jouw maat
> L"), en met één klik in je winkelwagen. Alle details staan in een productpaneel dat
> de winkel niet verlaat.

---

## 4. Indeling van de pagina

```
Winkel                                    [Tegoed: € 312 over ▾]  [Bestellen voor: mezelf ▾]*
Bestel de producten van Zieleman.

┌───────────────────────────────────────────────────────────────────────────────────┐
│ [Zoek een product…              ]  [Maat: L ×]  [Alleen bestelbaar ✓]  [Sorteer ▾] [Raster|Lijst] │   plakt bovenaan
│ (Alles 7) (Kleding 5) (Reclame 2) (Favorieten 2)                                        │
└───────────────────────────────────────────────────────────────────────────────────┘

Voor jouw functie                                                    alleen zonder filters
[kaart] [kaart] [kaart] [kaart]

Eerder besteld                                                       alleen zonder filters
[kaart] [kaart] [kaart]

Alle producten (7)
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ foto │ │ foto │ │ foto │ │ foto │ │ foto │
│ ...  │ │ ...  │ │ ...  │ │ ...  │ │ ...  │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

`*` "Bestellen voor" alleen voor managers, zie §9 en beslispunt 4.

- **Tegoed in de kop.** Een klein knopje vervangt de twee grote meldingen, bijvoorbeeld
  "€ 312 over", "128 credits over" of "Maxima per product". Klik je erop, dan zie je
  hoe het werkt, wanneer het vernieuwt, en de knop *Meer budget aanvragen*.
  - Bij "geen budget en geen maxima" verschijnt helemaal niets.
  - Bij een manager staat er alleen iets als er voor hem echt iets geldt.
- **Maten nog niet ingevuld?** Dan staat er geen grote melding meer. Het maatfilter
  toont "Maat: kies jouw maat" en een kort zinnetje in het productpaneel.
- **Plakkende balk** met:
  - zoekveld met suggesties: foto, naam en categorie;
  - maatfilter, vooraf op de eigen maat;
  - "Alleen bestelbaar";
  - sorteren;
  - wissel tussen raster en lijst.

  Daaronder staan **categorie-chips met aantallen** en een chip *Favorieten*.
- **De rijen "Voor jouw functie" en "Eerder besteld"** staan alleen bovenaan zolang er
  niet gezocht of gefilterd wordt. Daarna zie je direct de resultaten.
- **Alles staat in de link**: categorie, maat, zoekopdracht, sortering en het geopende
  product. Terug van een product brengt je naar dezelfde plek.

---

## 5. De productkaart

```
┌─────────────────────────┐
│ [Nieuw]            [hart]  │  maximaal 2 labels linksboven, favoriet rechtsboven
│                         │
│        (foto 4:5)       │  hele foto zichtbaar op lichte achtergrond
│                         │
│          • ○ ○          │  stipjes bij meerdere foto's; vegen op mobiel
├─────────────────────────┤
│ Softshell jas Tulsa     │  naam, max. 2 regels
│ ● Navy · S – XXL        │  kleuren + maatbereik
│ € 99,00                 │  "rechtenregel" (zie hieronder)
│ Jouw maat: L            │
│ [+ In winkelwagen (L)]  │  of [Kies maat] als de maat niet vaststaat
└─────────────────────────┘
```

**Kaartgrootte**: ongeveer 240–280 px breed.

| Scherm | Kolommen |
|---|---|
| Mobiel | 2 |
| Tablet | 3 |
| Laptop | 4 |
| Breed scherm | 5 |

Op een gewone laptop zie je dus 8 producten met naam en prijs zonder te scrollen; nu 0.

**Foto**: vaste verhouding 4:5. De hele foto blijft zichtbaar (`contain`) op een lichte,
egale achtergrond, zodat vlaggen en ronde geurhangers niet worden afgesneden. Foto's
laden pas als ze in beeld komen, met een grijze schaduwkaart zolang ze laden.

**De rechtenregel** volgt de bestelwijze van het bedrijf:

| Bestelwijze | Wat de medewerker ziet |
|---|---|
| Budget in euro | € 99,00 (of "vanaf € 99,00" als maten anders geprijsd zijn) |
| Budget in credits | 33 credits |
| Maxima per product | "Nog 2 van 3 dit jaar"; bij 0: "Maximum bereikt, aanvragen kan" |
| Geen budget, prijzen verborgen | Niets, of alleen het maximum |
| Manager | Altijd de europrijs, met credits erbij als het bedrijf met credits werkt |

**Labels** (maximaal twee, altijd tekst, in deze volgorde):

1. *Goedkeuring nodig*: de functie keurt altijd goed, of het product heeft "altijd
   goedkeuring";
2. *Maximum bereikt*;
3. *Voor jouw functie*;
4. *Proef vooraf*;
5. *Nieuw*: korter dan 30 dagen in het assortiment.

**Knop onderaan**:

- Staat de maat vast (eigen standaardmaat, of maar één variant)? Dan is het *+ In
  winkelwagen (L)*: één klik, en er verschijnt een korte melding met *Bekijk
  winkelwagen*.
- Anders is het *Kies maat*: dat opent het productpaneel met de maatknoppen.
- In het winkelvoorbeeld (bekijk de winkel als) is de knop uitgeschakeld, net als nu.

**Niet meer op de kaart**: de omschrijving, het aantalveld, de keuzelijst en de
categorienaam. De categorie staat al als chip bovenaan.

---

## 6. Het productpaneel (snelle weergave)

Klik op een kaart, dan opent rechts een paneel (op mobiel: volledig scherm). De link
krijgt `?product=…`, dus je kunt een product doorsturen. De winkel blijft eronder staan.

- **Fotogalerij** met miniaturen en vegen.
- **Naam en rechtenregel**, met het gevolg van je keuze live erbij:
  - "Na deze bestelling: nog 1 van 3 dit jaar";
  - "Na deze bestelling: € 213 over";
  - en als het over de grens gaat: "Dit wordt een aanvraag voor je leidinggevende".
- **Maat als knoppen** (S M L XL XXL), met *jouw maat* gemarkeerd. Een maat die voor
  dit product niet bestaat staat doorgestreept.
- **Kleur als kleurbolletjes** zodra er meer dan één kleur is.
- **Maattabel** naast de maatknoppen (beslispunt 6).
- **Aantal** met min- en plusknoppen, begrensd door het maximum per bestelling en het
  resterende maximum.
- **Praktisch**:
  - "Levertijd ongeveer 10 werkdagen";
  - "Je krijgt eerst een proef ter goedkeuring";
  - "Deze bestelling gaat ter goedkeuring naar je leidinggevende".
- **Omschrijving**, als Alvasi die heeft ingevuld.
- **Jouw geschiedenis**: "Eerder besteld: 2× L op 7 juli", met een knop *Zelfde
  nogmaals*.
- **Manager**: een schakelaar *Meerdere maten tegelijk* toont een **maatmatrix** met
  een aantalveld per maat (en per kleur), plus het totaal en de prijs. Eén knop zet
  alles in de winkelwagen.
- Knoppen *In winkelwagen*, *Favoriet* en *Sluiten*. Op mobiel blijft de
  bestelknop onderaan staan.

---

## 7. Lijstweergave

Met de wissel in de balk krijg je een compacte lijst, handig voor managers en voor
reclamemateriaal.

```
[▫] Bannervlaggen        Reclame   80 × 200 cm      € 200,00   [ 1 ] [In winkelwagen]
[▫] Geurhanger           Reclame   12 × 12 cm       € 2,50     [25 ] [In winkelwagen]
[▫] Softshell jas Tulsa  Kleding   S – XXL          € 99,00    [Kies maat ▾] [ 1 ] [+]
```

Elke rij heeft een kleine foto, de naam, de categorie, de varianten, de rechtenregel, en
direct een maat- en aantalveld met een knop. De keuze tussen raster en lijst wordt per
gebruiker onthouden.

---

## 8. Persoonlijke onderdelen

| Onderdeel | Wat | Waar komt het vandaan |
|---|---|---|
| **Jouw maat** | Maatfilter vooraf op de eigen maat; elke kaart toont "Jouw maat: L" of "Niet in jouw maat" | Bestaande standaardmaten (profiel) |
| **Favorieten** | Hartje op de kaart en in het paneel; chip *Favorieten* | Nieuw: tabel `product_favorites` |
| **Eerder besteld** | Rij bovenaan met wat je eerder bestelde, in dezelfde maat, met *Zelfde nogmaals* | Bestaande bestellingen |
| **Voor jouw functie** | Rij bovenaan met de producten die bij je functie horen; label op de kaart | Nieuw: per functie in te stellen in het Functie-paneel op Personeel (beslispunt 5) |
| **Starterspakket** | Een nieuwe medewerker ziet bovenaan: "Welkom! Dit hoort bij jouw functie", en kan het pakket in één keer in de winkelwagen leggen | Dezelfde functielijst + het al bestaande welkomstbudget |
| **Alleen bestelbaar** | Staat standaard aan. Verbergt wat je niet kunt bestellen; producten waarvan je maximum op is blijven zichtbaar met *aanvragen* | Bestaande maxima en zichtbaarheid |

---

## 9. Medewerker, manager en Alvasi

| Wie | Krijgt |
|---|---|
| Medewerker | Kaarten met zijn eigen rechtenregel; zijn maat vooraf; *Voor jouw functie*, *Eerder besteld* en *Favorieten*; geen prijzen als het bedrijf die verbergt |
| Leidinggevende of manager | Altijd prijzen, de lijstweergave, de maatmatrix. Ziet de hele catalogus, zoals nu. Fase 3: **"Bestellen voor"** een medewerker; dan gelden diens maat, budget en maxima en komt de bestelling op diens naam (beslispunt 4) |
| Alvasi (winkelvoorbeeld) | Exact de winkel van die medewerker, met bestellen uitgeschakeld |

---

## 10. Wat Alvasi per product kan invullen

De winkel wordt pas echt goed als de productgegevens kloppen. In de productbewerker van
Alvasi komen (of worden zichtbaar):

- **omschrijving** (kort, 1–3 zinnen);
- **levertijd in werkdagen**;
- **proef vooraf**;
- **altijd goedkeuring**;
- **maximaal per bestelling**;
- **maattabel**: per maatsysteem één keer, met eventueel een eigen tabel per product
  (beslispunt 6);
- **fotorichtlijn** in de bewerker: liefst 3 foto's of meer, lichte egale achtergrond,
  product gecentreerd.

---

## 11. Techniek

**Data**: de bestaande `buildShop` wordt uitgebreid. Per product komen erbij:

- maatbereik, kleuren en of jouw maat bestaat;
- levertijd, proef, goedkeuring en maximum per bestelling;
- favoriet ja of nee;
- eerder besteld: laatste datum, aantal en maat;
- "voor jouw functie" ja of nee;
- "nieuw" ja of nee.

Eén extra query per onderdeel; de winkel van een bedrijf blijft klein genoeg om in één
keer te laden en in de browser te filteren.

**Nieuwe tabellen** (één migratie, alleen toevoegen, met rijbeveiliging):

- `product_favorites (user_id, product_id)`: alleen je eigen favorieten;
- `role_products (role_id, product_id, kind)` met `kind` = *aanbevolen* of
  *starterspakket*: lezen voor het eigen bedrijf, beheren met "bestelregels beheren";
- `size_charts (option_set_id of product_id, rows jsonb)`: maattabel als tabel, bijv.
  borstomvang en lengte per maat.

**Pagina**

- Categorie, maat, zoekopdracht, sortering, weergave en het geopende product staan in de
  link (`?categorie=&maat=&zoek=&product=`). De terugknop werkt zoals verwacht.
- Bij meer dan 40 producten verschijnt een knop **"Meer laden"**.
- Foto's: Next.js-beeldoptimalisatie met de juiste formaten per kolombreedte, en lazy
  loading.
- Schaduwkaarten tijdens het laden.

**Onderdelen**, die het winkelvoorbeeld (`/personeel/bekijk/…`) en Alvasi's voorbeeld
automatisch overnemen:

- `ShopToolbar`;
- `ProductCard`;
- `ProductRow` (lijst);
- `ProductPanel`;
- `SizeButtons`;
- `SizeMatrix`;
- `AllowanceChip` (tegoed in de kop);
- `ShopShelf` (rijen bovenaan).

**Toegankelijkheid**

- De titel is de link en de hele kaart is klikbaar, zonder alles in één `<a>` te
  stoppen.
- Labels zijn tekst, geen kleur alleen.
- Alles werkt zonder muis (geen informatie alleen bij aanwijzen).
- Focus blijft in het paneel zolang het open is.

**Mobiel**

- 2 kolommen;
- filters achter één knop in een paneel van onderaf;
- foto's vegen;
- productpaneel op volledig scherm met de bestelknop vast onderaan.

---

## 12. Bouwvolgorde

**Fase 1: overzicht en gevoel** (het grootste verschil)

1. Nieuw raster en nieuwe kaart:
   - 2/3/4/5 kolommen;
   - foto 4:5 met `contain`;
   - stipjes;
   - rechtenregel;
   - labels;
   - snel toevoegen in de eigen maat.
2. Plakkende balk:
   - zoeken met suggesties;
   - categorie-chips met aantallen;
   - maatfilter;
   - "Alleen bestelbaar";
   - sorteren;
   - alles in de link.
3. Tegoed in de kop in plaats van de twee meldingen.
4. Productpaneel:
   - galerij;
   - maatknoppen;
   - aantal;
   - live gevolg voor budget of maximum;
   - levertijd, proef en goedkeuring.
5. Mobiel, schaduwkaarten en "Meer laden".

**Fase 2: persoonlijk en sneller bestellen**

6. Favorieten, "Eerder besteld" en *Zelfde nogmaals*.
7. "Voor jouw functie" en het starterspakket, in te stellen in het Functie-paneel.
8. Lijstweergave en de maatmatrix voor managers.
9. Maattabellen, plus de productbewerker van Alvasi met omschrijving, levertijd, proef,
   goedkeuring, maximum en fotorichtlijn.

**Fase 3: bestellen namens een ander**

10. "Bestellen voor":
    - de winkel toont de rechten en de maat van die medewerker;
    - de winkelwagen onthoudt voor wie hij is;
    - de bestelling komt op naam van de medewerker, met "geplaatst door" erbij.

---

## 13. Beslispunten

1. **Productdetail in een zijpaneel of op een eigen pagina?**
   Advies: **zijpaneel met eigen link**, net als bij Personeel en Bestellingen. Je
   verlaat de winkel niet.
2. **Hoeveel producten naast elkaar?**
   Advies: **4 op een laptop, 5 op een breed scherm, 2 op mobiel.**
3. **Raster of lijst als standaard voor managers?**
   Advies: **raster voor iedereen**, lijst met één klik. De keuze wordt onthouden.
4. **"Bestellen voor iemand anders" bouwen?**
   Advies: **ja, in fase 3.** Het raakt de winkelwagen, het afrekenen en de bestellingen
   (de bestelling komt op naam van de medewerker, "geplaatst door" de manager). Daarom
   pas na de rest.
5. **Wie bepaalt "Voor jouw functie" en het starterspakket?**
   Advies: **de manager, in het Functie-paneel op Personeel.** Alvasi kan het daar
   namens het bedrijf invullen.
6. **Maattabellen: per maatsysteem of per product?**
   Advies: **per maatsysteem** (Alvasi vult het één keer in), met een eigen tabel per
   product als die afwijkt.
7. **Producten waarvan het maximum op is: tonen of verbergen?**
   Advies: **tonen met "Maximum bereikt, aanvragen kan"**, zoals nu. Producten die je
   helemaal niet mag bestellen blijven verborgen.

## 14. Bewust niet (nu)

- Voorraad per maat. Die is er niet: Alvasi produceert op bestelling. Wel de levertijd.
- Beoordelingen en sterren. Die passen niet in een bedrijfswinkel.
- Kortingen of acties.
