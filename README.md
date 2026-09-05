# ProfitExact

> „Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.”

ProfitExact este o aplicație web mobile-first pentru șoferii de ridesharing și curierii din România. Centralizează încasările, cheltuielile și activitatea pentru rezultate zilnice, săptămânale și lunare.

## Stare

**Faza curentă: 1A — primul flux funcțional `Ridesharing → Angajat`.**

Aplicația locală include pagina de prezentare, crearea demonstrativă a contului, onboarding-ul contextual, introducerea manuală a unei zile, calculele și regularizarea săptămânală. Next.js, TypeScript și Supabase formează fundația tehnică. Specificația continuă în paralel pentru zonele încă nedefinite.

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
