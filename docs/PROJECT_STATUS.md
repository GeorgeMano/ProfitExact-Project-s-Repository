# ProfitExact — Starea proiectului

**Ultima actualizare:** 2026-09-07

## Stare curentă

- Faza curentă este `1B — cont și salvare reală`, în lucru; primul flux local din 1A este implementat. Faza 0 nu este închisă pentru întregul produs, deoarece specificarea celorlalte profiluri continuă în paralel.
- Specificația funcțională V1 rămâne în lucru.
- Fluxul prioritar este `Ridesharing → Angajat`.
- Există o primă aplicație locală cu pagină de prezentare, prototip de creare cont, onboarding, introducere manuală și motor de calcul determinist.
- Schema este aplicată pe proiectul Supabase `yjoozdilbfrczubnshmj` prin migrări versionate. Serverul era gol înainte de aplicare (zero tabele, zero migrări, zero utilizatori), deci nu a fost nevoie de migrări de reparație.
- Fluxul de verificare email + SMS există în aplicație, dar nu este încă validat integral cu servicii reale. Sunt necesare configurarea SMTP sub numele `ProfitExact` și un furnizor SMS; expeditorul SMS poate fi număr sau nume acceptat de furnizor, iar mesajul trebuie să menționeze ProfitExact. Modul demo este permis numai în dezvoltare, fără configurare Supabase.
- Există un strat de persistență cu o formă unică de date (`src/lib/persistence`): același instantaneu — cont, onboarding, zile salvate, perioade manuale — este scris fie pe calculator în modul de depanare local, fie în contul Supabase când există sesiune autentificată. Interfața nu știe care driver este activ, deci trecerea demo → cont nu cere rescriere.
- În modul de depanare local (codurile fixe 123456) datele supraviețuiesc reîncărcării paginii. Ele rămân pe calculatorul de test și nu ajung în baza online, fiindcă fără sesiune autentificată politicile RLS ar respinge scrierea.
- Uploadurile și plățile nu sunt încă active în aplicație, dar structura de date există pe server.
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

Prima secțiune funcțională locală pentru profilul `Ridesharing → Angajat` este în verificare. Ea include onboarding-ul, introducerea zilnică, centralizări săptămânale și lunare, fallback manual pentru perioade fără date, costuri recurente calendaristice, regularizarea cu flota și tratamentul PHEV. Formulele și exemplele Bolt reale au teste unitare, iar fluxul zi–săptămână–lună are test de browser.

Schema este aplicată și izolarea între utilizatori a fost verificată efectiv, nu doar prin citirea politicilor: doi utilizatori de test, fiecare vede numai propriile rânduri, scrierea pe contul altuia este respinsă cu `42501`, iar auto-promovarea la `admin` este blocată. Datele de test au fost șterse.

Migrarea `20260907184047_work_entries_month_period_and_upsert_key` a reparat trei lucruri care ar fi blocat salvarea reală: `work_entries` accepta numai `day` și `week`, deși interfața oferă deja centralizarea lunii; `worked_days` era limitat la 7, imposibil pentru o lună; și nu exista nicio cheie unică pe perioadă, deci resalvarea aceleiași zile ar fi creat un rând nou în loc să îl actualizeze. Constrângerea de formă a intervalului cere acum ca luna să înceapă în ziua 1 și să se termine în ultima zi calendaristică.

## Defalcarea pe platformă

`profitView` („Împreună” / „Separat pe platformă”) era colectat în onboarding și
salvat, dar nu îl citea nimeni: alegerea nu avea niciun efect, deși pasul 2
promitea în subtitlu că „încasările rămân vizibile per platformă”. Acum are.

Regula stabilită: se separă numai ce se poate măsura direct pe fiecare
aplicație — încasările, comisionul oprit de aplicație și kilometrii — plus cele
două costuri care decurg din ele, combustibilul (repartizat după kilometri) și
comisionul procentual al flotei (repartizat după încasări). Rămân comune zilei
CIM-ul, chiria, RCA, ITP, leasingul, telefonul, spălarea, parcarea, taxele de
drum și service-ul: ele aparțin mașinii și zilei, nu aplicației. Un comision fix
al flotei este tot cost comun, fiindcă este o sumă unică, nu un procent.

Invariant garantat prin teste, atât unitare cât și în browser: profitul zilei
este identic indiferent dacă rezultatul este privit împreună sau separat.
Sumele derivate se repartizează cu `distributeAmount`, care garantează că suma
părților este exact totalul, fără un ban în plus sau în minus.

Migrarea `20260907193034_platform_earnings_application_commission` a adăugat
coloana lipsă pentru comision. Până atunci, singurul câmp obligatoriu al
aplicației nu avea unde să fie salvat, nici în `work_entries`, nici în
`platform_earnings`; supraviețuia doar scăzut în `computed_total_earnings`.

### Cum se introduc kilometrii

Șoferul alege în onboarding, lângă întrebarea despre vizualizare. Alegerea se
salvează în `work_contexts.kilometer_entry` prin migrarea
`20260907195118_work_contexts_kilometer_entry_mode` și contează numai pentru
„Bolt + Uber”.

- **Pe fiecare aplicație** — kilometrii se iau din ecranul fiecărei aplicații.
  Exacți pe platformă, dar nu cuprind mersul în gol: drumul până la client, între
  curse și spre casă. Combustibilul zilei iese astfel mai mic decât în realitate,
  iar profitul afișat este ușor optimist.
- **Un singur total** — se introduce totalul real, cu tot cu mersul în gol, deci
  combustibilul este corect. Kilometrii fiecărei platforme se deduc proporțional
  cu încasările, ceea ce este o aproximare asumată și scrisă în interfață.

Compromisul este explicit în ambele sensuri: exact pe platformă dar incomplet pe
zi, ori corect pe zi dar aproximativ pe platformă. Șoferul alege care contează.

### Săptămâna și luna

Formularul manual de perioadă are aceleași grupuri pe platformă ca ziua, iar
centralizarea adună pe platformă atât zilele salvate cât și perioadele introduse
manual. `ManualPeriodValues` păstrează acum `platforms` și `sharedKilometers` în
locul câmpurilor combinate, iar `PeriodContribution` poartă defalcarea mai
departe, prin `aggregatePlatformEntries`.

## Corectarea unei zile salvate

Salvarea funcționa prin suprascriere pe aceeași dată, dar formularul nu încărca
înapoi ce fusese introdus: o greșeală de o cifră cerea retastarea întregii zile.
Cauza era că instantaneul păstra numai totalurile calculate.

`SavedWorkDay.inputs` reține acum prețul unitar, costurile PHEV, kilometrii
comuni și defalcarea cheltuielilor punctuale. Schimbarea datei sau click pe o zi
din rezumatul săptămânii completează formularul cu valorile de atunci, iar panoul
de salvare spune explicit „Corectezi ziua de …” și „Actualizează ziua”.

Aceleași date au deblocat scrierea în `energy_entries` și `expenses`, pentru zile
și pentru perioadele introduse manual. Cheltuielile punctuale se rescriu integral
la fiecare salvare, ca o categorie ștearsă să dispară din bază, nu să rămână cu
valoarea veche. Zilele salvate înainte de această extindere nu au `inputs`;
pentru ele nu se scrie nimic în cele două tabele, fiindcă valorile nu există și
inventarea lor ar strica auditul.

## Ce a fost verificat efectiv (07.09.2026)

Nu prin citirea codului, ci prin rulare:

- `npx tsc --noEmit` fără erori, `npx next build` reușit;
- 73 de teste unitare trec, dintre care 39 noi: validarea și serializarea instantaneului, calculul pe platformă, repartizarea sumelor derivate fără pierdere de bani, modul „kilometri în comun”, și invariantul „împreună = separat” pentru comision procentual din brut, procentual din net, fix, o singură platformă și kilometri comuni;
- 13 teste de browser trec, dintre care 10 noi: onboarding-ul și ziua salvată supraviețuiesc reîncărcării, perioada introdusă manual la fel, ștergerea este definitivă, fiecare platformă are propriile câmpuri și propriul comision obligatoriu, kilometrii zilei sunt suma celor două platforme, modul „un singur total” cere kilometrii o dată și îi repartizează după încasări, defalcarea apare numai în modul separat — atât pe zi cât și pe săptămână — iar profitul zilei este identic în ambele moduri. Cele 3 teste existente au rămas verzi;
- 16 teste de browser trec în total, ultimele 3 pentru corectarea unei zile: valorile introduse se încarcă înapoi (inclusiv prețul unitar și spălarea, exact ce se pierdea), corectarea actualizează ziua în loc să adauge una nouă, iar corecția supraviețuiește reîncărcării;
- pe baza online, sub RLS: `platform_earnings` primește comisionul exact al fiecărei aplicații (Bolt 128,33 și Uber 79,61 rămân distincte), iar a doua salvare a aceleiași zile actualizează rândurile în loc să le dubleze;
- tot pe baza online: `energy_entries` primește tipul de calcul, consumul și prețul unitar, iar `expenses` primește câte un rând pe categorie. La a doua salvare, categoriile șterse de utilizator chiar dispar din bază, iar prețul combustibilului se actualizează fără să se dubleze rândul;
- pe baza online, cu un utilizator de test și rolul `authenticated`: s-au scris toate cele trei tipuri de perioadă, inclusiv luna — imposibilă înainte de migrare. A doua salvare a acelorași date a actualizat rândurile în loc să le dubleze (3 rânduri, nu 6), ceea ce confirmă cheia unică nouă;
- constrângerea de formă respinge luna care nu începe în ziua 1, luna care nu se termină în ultima zi, peste 31 de zile lucrate și săptămâna care nu are 7 zile; acceptă corect februarie bisect cu 29 de zile;
- izolarea între utilizatori a fost reverificată: al doilea utilizator nu vede perioadele sau contextul primului, scrierea pe contextul altuia este respinsă cu `42501`, iar auto-promovarea la `admin` nu are efect. Datele de test au fost șterse; tabelele publice sunt din nou goale.

Ce rămâne neverificat: apelurile clientului către PostgREST (sintaxa `upsert` cu `onConflict`). Containerul de lucru nu are acces la `supabase.co`. Pentru asta există `src/lib/persistence/supabase-workspace.integration.test.ts`, care sare automat fără variabile de mediu; instrucțiunile de rulare sunt în capul fișierului.

Următorii pași, în ordine:

1. client Supabase pe server (`createServerClient`) plus `middleware.ts` pentru sesiune — fără asta, orice scriere din aplicație rămâne fragilă;
2. rute App Router în locul stării unice din `ProfitExactApp`;
3. reparat cazul contului rămas cu emailul verificat și telefonul neverificat. Nu mai este o ipoteză: `emailderezerva9@yahoo.com` este chiar în această stare în baza online din 06.09, cu `email_confirmed_at` pus, `phone_confirmed_at` gol și zero rânduri în `profiles`. Trigger-ul `auth_user_create_verified_profile` cere ambele confirmări plus telefonul, deci contul nu poate fi finalizat, iar o nouă înscriere cu același email este respinsă ca „email deja folosit”. Este nevoie fie de curățarea conturilor incomplete, fie de reluarea verificării telefonului la reautentificare;
4. reconcilierea migrărilor locale: `supabase/migrations/202609030001_initial_profitexact.sql` este o versiune veche a schemei inițiale, nu a fost aplicată niciodată pe server și dublează `20260906163505_initial_profitexact.sql`;
5. verificările reale de email și SMS, cu SMTP sub numele `ProfitExact` și un furnizor SMS. Aici este de luat o decizie de produs: fiecare SMS costă și cere contract cu un furnizor, iar azi acesta este pasul care blochează orice înscriere reală. Merită cântărit dacă telefonul trebuie verificat chiar la înscriere sau poate fi colectat acum și verificat mai târziu — numai cu SMTP s-ar putea deschide conturi reale, fără costuri de SMS;
6. `public.rls_auto_enable()` este apelabilă de rolul `anon` prin `/rest/v1/rpc/`; este un ajutor intern, nu o funcție de API. Tot de la advisor: protecția pentru parole compromise este dezactivată.

Punctele 5 și 6 din lista anterioară sunt închise: defalcarea pe platformă este implementată și verificată, iar instantaneul zilei păstrează acum tot ce s-a introdus.

Conexiunea administrativă se face prin contul de administrare Supabase, distinct de conexiunea aplicației.
