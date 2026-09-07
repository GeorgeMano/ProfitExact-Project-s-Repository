# ProfitExact

> „Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.”

ProfitExact este o aplicație web mobile-first pentru șoferii de ridesharing și curierii din România. Centralizează încasările, cheltuielile și activitatea pentru rezultate zilnice, săptămânale și lunare.

## Stare

**Faza curentă: 1B — cont și salvare reală, în lucru.**

Aplicația locală include pagina de prezentare, crearea demonstrativă a contului, onboarding-ul contextual și calcule zilnice, săptămânale și lunare. Zilele salvate sunt centralizate automat, iar o săptămână sau lună fără date poate fi introdusă manual. Next.js, TypeScript și Supabase formează fundația tehnică.

Conexiunea Supabase este configurată local; verificarea completă email/SMS și salvarea în cont nu sunt încă gata. Configurarea se păstrează în `.env.local` (exclus din Git), după modelul `.env.example`. Pornire locală: `npm run dev`. Testele de browser folosesc separat portul 3100 și nu accesează proiectul Supabase real.

### Mod de depanare local

La `npm run dev` crearea contului rulează implicit în mod de depanare: nu se trimite niciun email și niciun SMS, iar codul de verificare este **123456** atât pentru email, cât și pentru telefon. Așa poți intra direct în onboarding cât timp site-ul nu este urcat online.

Ca să testezi local fluxul real prin Supabase, adaugă în `.env.local`:

```
NEXT_PUBLIC_DEMO_AUTH=off
```

La build de producție (`npm run build` + `npm start`) modul de depanare este întotdeauna dezactivat, indiferent de setări.

## Documente

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — specificația funcțională;
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — deciziile confirmate și întrebările deschise;
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — starea curentă și pașii următori.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — fazele proiectului.

## Principii

- utilizatorul vede numai câmpurile relevante profilului său;
- introducerea manuală rămâne permanent disponibilă;
- datele extrase din screenshoturi, PDF-uri sau bonuri trebuie confirmate;
- formulele financiare sunt deterministe și testabile;
- V1 folosește RON, data și ora României și interfață în română și engleză;
- dezvoltarea este incrementală, cu teste și fără funcții inutile.

## Direcție

Proiectul înaintează pe bucăți verificabile: clarificăm o secțiune, o implementăm, o testăm și o verifică Product Owner-ul. Starea fazelor este păstrată în roadmap.
