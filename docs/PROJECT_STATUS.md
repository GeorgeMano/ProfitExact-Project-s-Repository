# ProfitExact — Starea proiectului

**Ultima actualizare:** 2026-09-06

## Stare curentă

- Faza curentă este `1B — cont și salvare reală`, în lucru; primul flux local din 1A este implementat. Faza 0 nu este închisă pentru întregul produs, deoarece specificarea celorlalte profiluri continuă în paralel.
- Specificația funcțională V1 rămâne în lucru.
- Fluxul prioritar este `Ridesharing → Angajat`.
- Există o primă aplicație locală cu pagină de prezentare, prototip de creare cont, onboarding, introducere manuală și motor de calcul determinist.
- Schema este aplicată pe proiectul Supabase `yjoozdilbfrczubnshmj` prin migrări versionate. Serverul era gol înainte de aplicare (zero tabele, zero migrări, zero utilizatori), deci nu a fost nevoie de migrări de reparație.
- Fluxul de verificare email + SMS există în aplicație, dar nu este încă validat integral cu servicii reale. Sunt necesare configurarea SMTP sub numele `ProfitExact` și un furnizor SMS; expeditorul SMS poate fi număr sau nume acceptat de furnizor, iar mesajul trebuie să menționeze ProfitExact. Modul demo este permis numai în dezvoltare, fără configurare Supabase.
- Salvarea efectivă în cont, uploadurile și plățile nu sunt încă active în aplicație, dar structura de date există pe server.
- Rolul de administrator există la nivel de bază de date (`profiles.role`, `public.is_admin()`). Adminul vede utilizatorii, abonamentele și plățile; **nu** are drept de citire pe câștigurile șoferilor. Interfața de administrare rămâne pentru faza 4.
- Proba de 14 zile și prețul de 24,99 RON/lună sunt în `app_settings` și se aplică automat la crearea profilului, prin `subscriptions`. Prețul se blochează per abonament la înscriere.
- Statisticile pe oraș se citesc prin `public.get_city_statistics()`, numai pentru orașele cu cel puțin `app_settings.city_stats_min_drivers` șoferi distincți (implicit 5), pe ultimele 90 de zile.
- Bucket-ul privat `documents` există, cu izolare pe folder `<user_id>/`.
- Orașul principal este inclus în onboarding ca text liber normalizat și este pregătit pentru istoricul și statisticile publice viitoare.

## Salvare locală și GitHub

- Workspace oficial: `E:\MANO's\ProfitExact Project`.
- Repository: [ProfitExact-Project-s-Repository](https://github.com/GeorgeMano/ProfitExact-Project-s-Repository).
- Panou de planificare: [GitHub Project](https://github.com/users/GeorgeMano/projects/2); sincronizarea codului se face prin repository.
- După fiecare etapă implementată și verificată: commit local, push pe ramura corespunzătoare și verificarea sincronizării cu GitHub. Dacă push-ul nu reușește, etapa se raportează explicit ca salvată numai local.
- Funcționalitățile importante folosesc ramuri dedicate; se păstrează modificările existente și nu se suprascrie istoricul online.
- Configurările cu secrete și datele utilizatorilor nu fac parte din backupul codului. Sincronizarea se face în timpul lucrului la proiect, nu printr-un proces permanent în fundal.

## Stabilit

- profilurile de activitate și formele Angajat/SRL/PFA;
- onboarding-ul inițial pentru Ridesharing → Angajat;
- Bolt, Uber sau Bolt + Uber, cu rezultate împreună ori separat;
- vehicul personal sau închiriat și costurile contextuale;
- jurnalele de service și spălări;
- combustibilul/energia consumată se calculează din kilometri, consum și preț unitar; totalul bonului nu se scade și nu există jurnal de alimentări;
- prețul unitar se confirmă pentru fiecare zi lucrată; nu există preț mediu săptămânal;
- costurile săptămânale și lunare ale combustibilului sunt suma costurilor zilnice calculate;
- pentru Benzină + GPL există un singur total zilnic de kilometri; utilizatorul alege combustibilul principal, iar sursa secundară este cost general săptămânal sau lunar, fără alocare zilnică;
- pentru PHEV se introduc separat costul zilnic al benzinei și cel al încărcării electrice; totalul se scade din rezultatul zilei, iar valorile rămân distincte;
- CIM săptămânal împărțit la 7 zile, cu media lunară calculată per zi lucrată;
- tips-ul este separat în tips prin aplicație/card și tips cash; regula de lucru este că ambele rămân integral șoferului și nu sunt comisionate, cu validare ulterioară pe screenshot pentru tips-ul prin aplicație;
- regularizarea cu flota ține cont de card, compensări, tips prin aplicație/card, comisionul Bolt introdus exact din screenshot, comisionul flotei și CIM, fără dublarea comisionului Bolt;
- comisionul oprit de aplicație este obligatoriu; fără el nu se calculează și nu se salvează ziua;
- RCA/CASCO anual împărțit la 365 sau 366 de zile;
- rata/leasingul lunar împărțit la zilele calendaristice ale lunii;
- chiria săptămânală împărțită la 7 zile;
- ITP și rovinietă împărțite la zilele de valabilitate; pentru ITP valoarea inițială propusă în onboarding este 180 de zile;
- parcare și taxe punctuale de drum scăzute în ziua înregistrării;
- telefon/internet lunar împărțit la zilele lunii;
- categoria `Alte cheltuieli` pentru costuri punctuale;
- aceste trei categorii sunt disponibile opțional în toate profilurile și pentru ambele tipuri de vehicul;
- kilometri zilnici adaptați configurației platformelor;
- screenshoturi zilnice sau săptămânale pentru încasări și activitate, cu confirmare și fallback manual;
- medii pe zi lucrată calculate numai după încheierea săptămânii sau lunii;
- istoric zilnic, săptămânal, lunar și anual;
- RON, fus orar România și interfață română/engleză;
- import cu confirmare și introducere manuală permanentă;
- câștigul pe kilometru calculat pe aceeași perioadă cu profitul și kilometrii, cu alertă adaptată zilei, săptămânii sau lunii;
- structura și ordinea dashboard-ului pentru `Ridesharing → Angajat`;
- comparații între ultima zi lucrată, săptămâni complete și luni complete, fără compararea perioadelor incomplete cu cele complete;
- alerte comparative V1 pentru încasări, suma rămasă, cheltuieli și ore lucrate, cu regularizarea flotei afișată separat;
- maximum patru alerte după încheierea perioadei, fără praguri procentuale și fără alertă pentru un indicator neschimbat;
- probă de 14 zile și preț de 24,99 RON/lună.

## De stabilit în continuare

1. maparea screenshoturilor Bolt/Uber;
2. formulele fiscale validate pentru SRL/PFA;
3. modelul Delivery;
4. retenția fișierelor și regulile complete ale abonamentului.

## Următorul pas

Prima secțiune funcțională locală pentru profilul `Ridesharing → Angajat` este în verificare. Ea pornește cu onboarding-ul, aplică automat costurile recurente și continuă cu introducerea manuală a unei zile, calculul rezultatului, câștigul pe kilometru, regularizarea cu flota și tratamentul PHEV. Formulele au teste unitare, iar fluxul principal are test de browser.

Schema este aplicată și izolarea între utilizatori a fost verificată efectiv, nu doar prin citirea politicilor: doi utilizatori de test, fiecare vede numai propriile rânduri, scrierea pe contul altuia este respinsă cu `42501`, iar auto-promovarea la `admin` este blocată. Datele de test au fost șterse.

Următorii pași, în ordine:

1. client Supabase pe server (`createServerClient`) plus `middleware.ts` pentru sesiune — fără asta, orice scriere din aplicație rămâne fragilă;
2. rute App Router în locul stării unice din `ProfitExactApp`;
3. reparat cazul contului rămas cu emailul verificat și telefonul neverificat, care astăzi produce un utilizator fără profil;
4. rotunjirea monetară la 2 zecimale în `lib/finance`, ca ecranul și baza de date să nu diverge;
5. salvarea onboarding-ului și a zilei, cu scrierea instantaneului în `work_entries.computed_*`.

Conexiunea administrativă se face prin connectorul Supabase din Claude, distinct de conexiunea aplicației.
