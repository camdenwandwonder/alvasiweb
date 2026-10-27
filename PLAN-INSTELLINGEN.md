# Plan: Instellingen en Mijn profiel die echt iets voor je doen

Status: **gebouwd** (28-10-2026), volgens de besluiten hieronder.

Doel:

- **Instellingen** wordt een rustige, overzichtelijke plek voor alles wat een bedrijf af
  en toe instelt: huisstijl, adressen, meldingen en bestelvoorkeuren. Je ziet meteen hoe
  het eruitziet en wat het betekent.
- **Mijn profiel** wordt de plek waar een medewerker regelt wat hém helpt sneller en
  zekerder te bestellen: zijn maten, zijn standaardadres, zijn budget en rechten, en
  welke berichten hij krijgt.

---

## 1. Wat er nu mis is

**Instellingen**

| Onderdeel | Nu | Probleem |
|---|---|---|
| Indeling | Eén smalle kolom: naam, logo, twee kleuren, daaronder adressen | Geen overzicht of navigatie; je moet scrollen om iets te vinden |
| Logo | Voorbeeld van een heel scherm groot | Zegt niets over hoe het logo er echt uitziet (in de zijbalk is het 32 px); geen eisen aan formaat |
| Kleuren | Twee kleurkiezers zonder voorbeeld | Je ziet het effect pas na opslaan; geen controle of tekst op de kleur leesbaar blijft |
| Startpagina | Sfeerbeelden en welkomsttekst kan alleen Alvasi instellen | Het bedrijf kan zijn eigen portaal niet aankleden |
| Adressen | Formulier altijd open onderaan; alleen toevoegen en verwijderen | Geen bewerken; geen contactpersoon, telefoon of afleverinstructie; verwijderen kan ook als er openstaande bestellingen op staan |
| Meldingen | Niet in te stellen | Medewerkers krijgen **geen** bericht als hun bestelling is goedgekeurd, afgewezen of verzonden |
| Bestelvoorkeuren | Ontbreken | Geen bestelreferentie of kostenplaats (bijv. PO-nummer) mogelijk |
| Wijzigingen | Niet zichtbaar wie wat aanpaste | De wijzigingsgeschiedenis bestaat al, maar wordt hier niet getoond |

**Mijn profiel en Account**

| Onderdeel | Nu | Probleem |
|---|---|---|
| Twee pagina's | "Mijn profiel" (naam, telefoon, maten) en "Account" (onder je naam linksonder) | Dubbel en verwarrend |
| Maten | Keuzelijsten met "—" | De belangrijkste instelling voor bedrijfskleding is weggestopt; geen maattabel erbij |
| Budget en rechten | Niet zichtbaar | Een medewerker ziet nergens rustig wat hij nog mag en wie goedkeurt |
| Standaardadres | Ontbreekt | Iedereen moet bij elke bestelling het adres opnieuw kiezen |
| Wachtwoord | Niet zelf te wijzigen | Alleen een beheerder kan het aanpassen |
| Meldingen | Niet in te stellen | – |

---

## 2. Wat vergelijkbare systemen doen (onderzoek)

| Bron | Patroon | Overnemen? |
|---|---|---|
| GitHub, Linear, Shopify | Instellingen met een **menu links** en per onderwerp een pagina met een duidelijke naam | Ja |
| Shopify Polaris | Per blok **links uitleg, rechts de velden**; op mobiel onder elkaar | Ja |
| Baymard | Mensen komen met één taak; **weinig pagina's** werkt beter dan een diepe boom; woorden als "Adresboek" worden niet herkend | Ja: zes korte onderdelen, gewone woorden |
| Primer (GitHub) | **Eén opslaanknop per blok** met een duidelijke tekst ("Huisstijl opslaan"); nooit automatisch en handmatig opslaan mengen; waarschuwen bij weglopen met wijzigingen | Ja |
| Nielsen Norman Group | Een **schakelaar werkt direct**, zonder opslaanknop | Ja: meldingen en maten slaan direct op |
| Nielsen Norman Group | Bevestigen alleen bij iets onomkeerbaars, en dan **concreet** ("3 open bestellingen gebruiken dit adres") | Ja: archiveren in plaats van verwijderen |
| GOV.UK (samenvattingslijst) | Gegevens eerst als lijst, met **"Wijzig"** per regel | Ja: bedrijfsgegevens en persoonlijke gegevens |
| Shopify, Stripe, Google | Logo-eisen erbij zetten (formaat, bestandsgrootte); laten zien **waar** het logo terugkomt; een apart vierkant icoon | Ja |
| WCAG 2.2 (1.4.3 en 1.4.11) | Tekst minimaal 4,5:1 contrast, knoppen 3:1 | Ja: een contrastcontrole met voorstel voor een leesbare tint |
| Baymard + PDOK (overheid) | Adres invullen met **postcode en huisnummer**; de gratis landelijke adresservice vult straat en plaats in | Ja |
| GitHub, Smashing Magazine | Meldingen als **gebeurtenissen × kanaal**, met rustige standaarden; regelmaat is de grootste ergernis | Ja |
| Google Account | Profiel in een paar blokken: persoonlijke gegevens, beveiliging, voorkeuren | Ja |
| UniformMarket | Medewerker ziet **eigen tegoed**, vraagt meer aan, krijgt een melding als het bijna op is | Ja |

Valkuilen uit hetzelfde onderzoek:

- één lange kolom;
- een voorbeeld groter dan het echte gebruik;
- schakelaars en opslaanknoppen door elkaar;
- uitgeschakelde opslaanknoppen;
- een vaag "Weet je het zeker?";
- budgetregels dubbel in Instellingen;
- kleuren zonder contrastcontrole;
- een adres verwijderen dat nog in gebruik is.

Bronnen: github.blog, linear.app, help.shopify.com, polaris.shopify.com, baymard.com,
primer.style, nngroup.com, design-system.service.gov.uk, docs.stripe.com,
support.google.com, w3.org/WAI, api.pdok.nl, docs.github.com, smashingmagazine.com,
uniformmarket.com (onderzoek 28-10-2026).

---

## 3. Het idee in één zin

> **Instellingen** = zes korte, duidelijke onderdelen met een menu links, waarin je ziet
> wat je instelt voordat je opslaat.
> **Mijn profiel** = één pagina met wat een medewerker nodig heeft: maten, budget,
> standaardadres, meldingen en beveiliging.

Budget, credits, maxima, goedkeuring, functies en personeel blijven op **Personeel**,
waar ze gebruikt worden. Instellingen verwijst ernaar met één regel.

---

## 4. Instellingen

```
Instellingen
┌───────────────────┐  ┌──────────────────────────────────────────────────────────┐
│ Algemeen          │  │ Huisstijl                                                │
│ Huisstijl       ● │  │ ───────────────────────────────────────────────────────  │
│ Startpagina       │  │ Logo                    │ [logo]  Wijzigen  Verwijderen   │
│ Leveradressen     │  │ PNG of SVG, liggend,    │ Zo ziet het eruit:              │
│ Meldingen         │  │ min. 400 px breed, ≤2MB │ ┌ zijbalk ┐ ┌ pakbon ┐ ┌ e-mail┐│
│ Wijzigingen       │  │                         │ └─────────┘ └────────┘ └───────┘│
│                   │  │ Kleuren                 │ Hoofdkleur [■ #1F2A44]          │
│ Budget, functies  │  │ Voor knoppen, actieve   │ Witte tekst leesbaar (11:1)     │
│ en goedkeuring →  │  │ menu-items en labels    │ Tweede kleur [■ #C2185B]        │
│ (Personeel)       │  │                         │ ! Te licht voor tekst: voorstel │
└───────────────────┘  │                         │   #A3134C  [Gebruik voorstel]   │
                       │ Voorbeeld               │ [mini-portaal: zijbalk, knop,   │
                       │                         │  productkaart, label]           │
                       │                         │           [Huisstijl opslaan]   │
                       └──────────────────────────────────────────────────────────┘
```

Op mobiel wordt het menu links een keuzelijst bovenaan.

### 4.1 Algemeen

Gegevens als lijst met **Wijzig** per regel:

- bedrijfsnaam;
- korte naam (in de zijbalk);
- contactpersoon bij het bedrijf, met e-mail en telefoon;
- **je contactpersoon bij Alvasi** (alleen lezen, ingevuld door Alvasi).

**Bestelvoorkeuren** (beslispunt 4):

- *Bestelreferentie* (bijvoorbeeld een PO-nummer): uit, vragen of verplicht. Hij komt
  op de afrondpagina, de bestelling, de pakbon en in de export.
- *Kostenplaats*: uit, of een keuzelijst die het bedrijf zelf vult. Bijvoorbeeld per
  vestiging of afdeling, voor de doorbelasting.

Onderaan een blok met een verwijzing: "Budget, credits, maxima en goedkeuring beheer je
op Personeel →".

### 4.2 Huisstijl

- **Logo**:
  - een liggend logo, met een apart **vierkant icoon** (voor de zijbalk dichtgeklapt, het
    tabblad van de browser en e-mails);
  - de eisen staan erbij (formaat, minimale breedte, maximale bestandsgrootte);
  - een voorbeeld **op ware grootte** in een mini-zijbalk, op een pakbon en in een
    e-mailkop, op lichte en donkere achtergrond;
  - het voorbeeld van een heel scherm verdwijnt.
- **Kleuren**:
  - kleurkiezer met hexwaarde;
  - een **contrastcontrole** volgens WCAG: wordt witte of zwarte tekst op deze kleur goed
    leesbaar?
  - is het te licht, dan een **voorstel voor een leesbare tint** met dezelfde kleur, met
    de knop *Gebruik voorstel*.
- **Live voorbeeld**: een klein nagebouwd portaal met de zijbalk, een knop, een
  productkaart en een label in de gekozen kleuren. Pas na *Huisstijl opslaan* wordt het
  echt.
- **Niet opgeslagen?** Bij weglopen komt er een waarschuwing.

### 4.3 Startpagina (beslispunt 5)

- **Welkomsttekst**: maximaal ongeveer 140 tekens, met een voorbeeld van de kop van de
  startpagina.
- **Sfeerbeelden** (nu alleen voor Alvasi): uploaden, slepen om de volgorde te wijzigen,
  verwijderen. Met de eis erbij: liggend, minimaal 1600 px breed.
- **Mededeling bovenaan de winkel** (optioneel), bijvoorbeeld "Bestel je winterjas vóór
  1 december". Met een begin- en einddatum.

### 4.4 Leveradressen

- **Kaartjes** per adres, met naam, adres, contactpersoon, telefoon en
  afleverinstructie. Het standaardadres heeft het label *Standaard*. Per kaartje:
  *Bewerken*, *Maak standaard* en *Archiveren*.
- **Toevoegen en bewerken in een venster**:
  - **postcode + huisnummer vult straat en plaats in**, via de gratis landelijke
    adresservice PDOK (beslispunt 8); handmatig invullen kan altijd;
  - nieuwe velden: contactpersoon, telefoon en afleverinstructie ("Achterom, bij de
    werkplaats").
- **Archiveren in plaats van verwijderen.** Een adres dat in openstaande bestellingen
  staat, kan niet weg. De melding zegt welke bestellingen het zijn ("3 open
  bestellingen"). Gearchiveerde adressen staan onder een uitklapper en zijn terug te zetten.

### 4.5 Meldingen (beslispunt 2)

Een tabel met **gebeurtenissen × kanaal**, voor het hele bedrijf. Medewerkers kunnen de
niet-noodzakelijke uitzetten in hun profiel.

| Gebeurtenis | Wie | E-mail standaard | Uit te zetten door medewerker? |
|---|---|---|---|
| Bestelling geplaatst (bevestiging) | Besteller | Aan | Ja |
| Aanvraag wacht op goedkeuring | Goedkeurders | Aan | Ja (dan een dagelijkse samenvatting) |
| Bestelling goedgekeurd of afgewezen | Besteller | Aan | Nee |
| Bestelling verzonden | Besteller | Aan | Ja |
| Budgetaanvraag ingediend / besloten | Goedkeurders / aanvrager | Aan | Nee |
| Budget bijna op (80%) | Medewerker | Uit | Ja |
| Maandoverzicht beschikbaar | Beheerders | Uit | Ja |

- De schakelaars werken **direct**, zonder opslaanknop.
- E-mails komen met het logo en de kleuren van het bedrijf, en met een knop naar de
  bestelling.
- Melden in het portaal zelf (een belletje met ongelezen meldingen) bewaren we voor
  later; zie §9.

### 4.6 Wijzigingen

Een lijst van wie wat aanpaste in de instellingen: huisstijl, adressen, meldingen en
bestelvoorkeuren, met naam en tijd. De wijzigingsgeschiedenis bestaat al.

---

## 5. Mijn profiel (vervangt ook de pagina "Account")

Eén pagina met een kop en blokken. Op een breed scherm staat er een kleine inhoudsopgave
naast.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ (LA)  Leon Achternaam                                                    │
│       Personeel · Zieleman · leon@autozieleman.nl                        │
└──────────────────────────────────────────────────────────────────────────┘
Mijn maten                                            Opgeslagen  
  Kleding     [S] [M] [L●] [XL] [XXL]        Maattabel bekijken
  Broeken     [44] [46] [48] [50●] …
Mijn budget en rechten
  € 401 van € 500 over dit jaar  ███████████░░  vernieuwt 1 januari
  Polo: nog 2 van 3 · Jas: nog 1 van 1
  Goedkeuring door Wilko Zieleman · [Meer budget aanvragen] [Mijn bestellingen]
Standaard leveradres
  (●) Alvasi Nieuwleusen   ( ) Zieleman Nieuwleusen
Persoonlijke gegevens
  Naam            Leon Achternaam        Wijzig
  Telefoon        Niet ingevuld          Toevoegen
  E-mail          leon@…  (wijzigen via je beheerder)
Meldingen
  Bevestiging na bestellen     [aan]
  Bestelling verzonden         [aan]
  Budget bijna op              [uit]
Beveiliging
  Wachtwoord      ••••••••               Wijzig
  [Overal uitloggen]   [Uitloggen]
```

- **Mijn maten** komen bovenaan, want dat is het belangrijkste voor bedrijfskleding.
  - Per maatsysteem knoppen in plaats van keuzelijsten.
  - Een klik slaat direct op, met "Opgeslagen".
  - Ernaast een link *Maattabel bekijken*, met de tabel die Alvasi per maatsysteem
    invult.
  - Deze maten staan in de winkel vooraf klaar.
- **Mijn budget en rechten** (alleen lezen):
  - resterend budget of resterende credits, met een balk en de vernieuwdatum;
  - de maxima per product;
  - wie goedkeurt;
  - wat je functie mag, in gewone taal (dezelfde tekst als "Wat kan …?" op Personeel);
  - knoppen *Meer budget aanvragen* en *Mijn bestellingen*.
- **Standaard leveradres**: kies uit de adressen van het bedrijf. Dit adres staat
  voortaan vooraf geselecteerd op de afrondpagina.
- **Persoonlijke gegevens** als lijst met *Wijzig* per regel. Het e-mailadres is ook
  de inlognaam, dus dat wijzig je via de beheerder.
- **Meldingen**: schakelaars voor de meldingen die je zelf uit mag zetten (zie §4.5).
- **Beveiliging** (beslispunt 3):
  - *Wachtwoord wijzigen*, met je huidige wachtwoord ter controle;
  - *Overal uitloggen*, voor alle apparaten;
  - *Uitloggen*.
- **Bestellen namens anderen**: wie dat recht heeft, ziet hier een korte regel met een
  link naar de winkel.
- De pagina **"Account"** verdwijnt. Klik je linksonder op je naam, dan kom je hier.

---

## 6. Alvasi (superadmin)

- Bij een bedrijf gebruikt Alvasi dezelfde onderdelen:
  - Huisstijl, met dezelfde editor en contrastcontrole;
  - Startpagina;
  - Leveradressen;
  - Meldingen.
- Daar vult Alvasi ook **de contactpersoon bij Alvasi** in.

---

## 7. Techniek

**Database** (één migratie, alleen toevoegen):

- `companies`:
  - `logo_icon_url` (vierkant icoon);
  - `welcome_text`;
  - `announcement` (tekst, begin, einde);
  - de contactgegevens;
  - in `settings`: bestelreferentie (uit/vragen/verplicht), kostenplaatsen (lijst) en
    de standaarden voor meldingen.
- `company_addresses`: `contact_name`, `phone`, `instructions` en `archived_at`.
- `profiles`: `default_address_id` en `notification_prefs` (jsonb).
- `orders`: `reference` en `cost_center`.
- `company_media`: schrijven ook toegestaan voor wie "bestelregels beheren" heeft
  (alleen voor het eigen bedrijf).

**Meldingen**:

- Eén servicefunctie `notifyOrderEvent(orderId, gebeurtenis)`, aangeroepen bij plaatsen,
  goedkeuren/afwijzen, en statuswijzigingen door Alvasi (verzonden).
- Die bepaalt de ontvangers en hun voorkeuren, en verstuurt via Resend in de huisstijl
  van het bedrijf.
- E-mails die niet aankomen, houden de bestelling nooit tegen.

**Adressen opzoeken**: een serverroute `/api/adres?postcode=&huisnummer=` naar de
PDOK-locatieserver. Gratis en zonder sleutel. Met een korte cache en nette foutmeldingen;
handmatig invullen blijft altijd mogelijk.

**Contrast**: een kleine rekenfunctie (WCAG-luminantie) en een functie die een leesbare
tint van dezelfde kleur zoekt.

**Opslaan**:

- per blok een eigen knop met een duidelijke tekst;
- schakelaars en maatknoppen slaan direct op;
- waarschuwing bij weglopen met wijzigingen die nog niet zijn opgeslagen;
- elke wijziging komt in de wijzigingsgeschiedenis.

**Wachtwoord**:

- het huidige wachtwoord wordt gecontroleerd door opnieuw aan te melden;
- daarna wordt het nieuwe wachtwoord opgeslagen, met de eisen van Supabase;
- *Overal uitloggen* meldt alle sessies van de gebruiker af.

---

## 8. Bouwvolgorde

**Fase 1: indeling en de dagelijkse dingen**

1. Instellingen met het menu links en de zes onderdelen, plus het blok met de verwijzing
   naar Personeel.
2. Huisstijl: logo en icoon met eisen en voorbeeld op ware grootte, kleuren met
   contrastcontrole en live voorbeeld.
3. Leveradressen: kaartjes, venster, postcodezoeker, nieuwe velden, archiveren.
4. Mijn profiel:
   - maten als knoppen met maattabel;
   - budget en rechten;
   - standaardadres;
   - persoonlijke gegevens;
   - beveiliging.
   - "Account" verdwijnt.

**Fase 2: berichten en bestelvoorkeuren**

5. Meldingen: de tabel bij Instellingen, de schakelaars in het profiel en de e-mails voor
   bevestigd, goedgekeurd, afgewezen, verzonden en budget bijna op.
6. Bestelreferentie en kostenplaats op de afrondpagina, de bestelling, de pakbon en in de
   export.
7. Startpagina: welkomsttekst, sfeerbeelden en de mededeling in de winkel.
8. Wijzigingen-overzicht en dezelfde onderdelen bij Alvasi.

---

## 9. Beslispunten

1. **Instellingen met een menu links en losse onderdelen, of één lange pagina met
   ankers?**
   Advies: **menu links met losse onderdelen**.
2. **Meldingen per e-mail aan medewerkers bouwen?** Bijvoorbeeld bij bevestigd,
   goedgekeurd, afgewezen en verzonden.
   Advies: **ja**. Meldingen in het portaal zelf (een belletje) komen later.
3. **Mag een medewerker zijn eigen wachtwoord wijzigen?**
   Advies: **ja**, met het huidige wachtwoord ter controle, plus *Overal uitloggen*.
   Een beheerder kan het daarnaast nog steeds instellen. Tweestapsverificatie komt
   later.
4. **Bestelreferentie (PO-nummer) en kostenplaats bij bestellen?**
   Advies: **ja, per bedrijf in te stellen** (uit / vragen / verplicht).
5. **Mag het bedrijf zelf de startpagina aankleden** (welkomsttekst, sfeerbeelden,
   mededeling)?
   Advies: **ja**.
6. **Standaard leveradres per medewerker?**
   Advies: **ja**.
7. **De pagina "Account" samenvoegen met Mijn profiel?**
   Advies: **ja**.
8. **Postcode + huisnummer automatisch invullen via PDOK** (de gratis adresservice van de
   overheid)?
   Advies: **ja**.

### Besluiten (28-10-2026)

1. Menu links met losse onderdelen: **akkoord**.
2. E-mailmeldingen: **nee**. Het onderdeel Meldingen vervalt, ook in het profiel.
3. Eigen wachtwoord wijzigen: **ja**.
4. Bestelreferentie en kostenplaats: **akkoord**.
5. Startpagina door het bedrijf zelf: **ja**.
6. Standaard leveradres per medewerker: **nee**. Alleen de manager beheert de
   leveradressen.
7. Account samenvoegen met Mijn profiel: **akkoord**.
8. Postcode via PDOK: **ja**.

## 10. Bewust niet (nu)

- Tweestapsverificatie en een overzicht van actieve apparaten. "Overal uitloggen" dekt
  het belangrijkste.
- Taalkeuze; het portaal is Nederlands.
- Meldingen in het portaal zelf (een belletje).
- Facturatiegegevens; Alvasi factureert buiten het portaal.
