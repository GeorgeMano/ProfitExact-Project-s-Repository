# ProfitExact V1 — Specificație funcțională

## 1. Statutul documentului

**Stadiu:** în lucru
**Statut de aprobare:** neaprobat încă drept specificație executabilă completă  
**Ultima actualizare:** 2026-08-30

Acest document păstrează cerințele confirmate în contextul inițial al proiectului și indică explicit zonele blocate de decizii deschise. Detaliile nedefinite nu reprezintă comportament aprobat și nu trebuie implementate.

### 1.1 Convenții

- **CONFIRMAT** — cerință aprobată;
- **DESCHIS** — alegere care necesită clarificare și este urmărită în [`DECISIONS.md`](DECISIONS.md);
- **CONTEXT VIITOR** — intenție păstrată pentru o fază ulterioară, fără includere automată în V1;
- **EXCLUS V1** — funcționalitate aflată explicit în afara V1.

### 1.2 Regula de interpretare

Exemplele ilustrează intenția produsului, dar nu devin formule, valori implicite sau validări până când specificația nu le declară explicit aprobate. Pot exista prototipuri sau teste marcate clar pentru explorarea unei întrebări deschise, însă acestea nu stabilesc singure comportamentul de producție.

## 2. Definiția produsului

### 2.1 Mesaj central — CONFIRMAT

> „Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.”

### 2.2 Public țintă — CONFIRMAT

ProfitExact V1 este un SaaS web mobile-first pentru șoferi și curieri individuali din România. Nu este un simplu calculator „venit minus combustibil”; valoarea produsului rezultă din centralizarea costurilor, repartizarea lor corectă, istoric și explicații financiare utile.

### 2.3 Rezultatele principale — CONFIRMAT

Produsul trebuie să ofere:

- centralizarea veniturilor și a tuturor costurilor relevante;
- repartizarea costurilor recurente;
- istoric orientat în primul rând săptămânal;
- cost/km și câștigul obținut pe kilometru, prezentat utilizatorului printr-un mesaj simplu;
- venit/oră și profit/oră;
- comparații între perioade;
- alerte bazate pe reguli matematice explicabile;
- import asistat din screenshot sau PDF, unde este util și fezabil;
- comoditate suficientă pentru a justifica un produs cu abonament.

## 3. Profilurile V1

### 3.1 Contexte principale — CONFIRMAT

După alegerea activității, onboarding-ul încadrează utilizatorul în una dintre următoarele forme de lucru, folosind exact aceste denumiri în interfață:

1. **Angajat**;
2. **Propriul SRL/PFA**.

Pentru `Propriul SRL/PFA`, utilizatorul alege apoi forma exactă: `SRL` sau `PFA`.

Dacă utilizatorul alege `Ambele`, forma de lucru se configurează independent pentru fiecare activitate. De exemplu, utilizatorul poate fi `Angajat` la ridesharing și poate lucra pe `Propriul PFA` la delivery.

Profilul este completat de:

- activitate de ridesharing și/sau delivery;
- platformă: Bolt, Uber, combinația Bolt + Uber sau, pentru delivery, Glovo, Wolt ori Bolt Food;
- mașină proprie sau mașină închiriată.

Un utilizator poate avea simultan maximum două contexte de activitate numai când acestea aparțin unor zone diferite: un context de ridesharing și un context de delivery. De exemplu, același utilizator poate lucra prin propriul PFA/SRL cu Bolt/Uber și separat cu Glovo/Wolt/Bolt Food.

Calculele celor două contexte sunt separate. Regula de grupare pe platformă și vehicul în interiorul fiecărui context este încă **DESCHISĂ** — D-002.

### 3.2 Experiență contextuală — CONFIRMAT

Aplicația cere și afișează numai datele relevante profilului. Posibilitatea ca un cost să existe nu activează automat acel cost pentru utilizator.

Șoferul angajat prin flotă nu trebuie încărcat cu funcții contabile destinate propriului PFA/SRL.

### 3.3 Limbă și localizare — CONFIRMAT PARȚIAL

ProfitExact V1 este disponibil de la început în două limbi de interfață:

- română;
- engleză.

Indiferent de limba aleasă, moneda V1 este RON, iar datele și orele funcționale folosesc `Europe/Bucharest`. Limba implicită este româna. Selectorul `RO / EN` este vizibil pe prima pagină și în setări, iar alegerea utilizatorului se păstrează.

## 4. Onboarding

### 4.1 Rezultatul cerut — CONFIRMAT

Specificația finală a onboarding-ului trebuie să descrie, ecran cu ecran:

- ordinea pașilor;
- toate opțiunile și ramificațiile;
- informațiile configurate o singură dată sau numai când se schimbă;
- informațiile cerute săptămânal;
- caracterul obligatoriu sau opțional al fiecărui câmp;
- unitatea și validarea fiecărui câmp;
- profilurile pentru care câmpul este vizibil;
- efectul răspunsului asupra calculelor și dashboard-ului.

### 4.2 Informații cunoscute pentru configurare — CONFIRMAT

Următoarele categorii apar în onboarding sau în configurarea profilului:

- contextul flotă/SRL ori propriul PFA/SRL;
- tipul activității și platformele folosite;
- mașină proprie sau închiriată;
- costurile recurente aplicabile;
- costurile și reținerile contextuale care există în situația reală a utilizatorului.

Ordinea inițială aprobată este:

1. activitatea: `Ridesharing`, `Delivery` sau `Ambele`;
2. pentru fiecare activitate selectată: `Angajat` sau `Propriul SRL/PFA`;
3. dacă se alege `Propriul SRL/PFA`: alegerea `SRL` sau `PFA`;
4. continuarea cu platformele, vehiculul și întrebările contextuale relevante.

Ramura Delivery folosește aceleași două forme de lucru și aceleași reguli juridice/administrative de bază ca ridesharing. Modelul veniturilor, comisioanelor și cheltuielilor operaționale este definit separat pentru Delivery după obținerea datelor și screenshot-urilor reale.

Într-un context Delivery, utilizatorul poate lucra simultan pe mai multe platforme, inclusiv Glovo, Wolt și Bolt Food. Selectarea platformelor va permite alegerea multiplă; regulile financiare specifice fiecărei platforme vor fi definite înainte de implementarea ramurii Delivery.

Dacă utilizatorul alege `Propriul SRL/PFA` pentru ambele activități, onboarding-ul întreabă dacă este folosită aceeași entitate juridică. Pentru aceeași entitate, costurile administrative fixe comune se configurează o singură dată; pentru entități diferite, configurațiile sunt separate.

Pentru ramura `Ridesharing → Angajat`, ordinea aprobată după pașii comuni este:

1. platformele: Bolt, Uber sau ambele; pentru Bolt + Uber se alege rezultatul împreună sau separat;
2. orașul principal de lucru;
3. vehiculul: propriu sau închiriat;
4. comisionul flotei, CIM/carte de muncă și celelalte costuri datorate flotei, numai dacă există;
5. costurile vehiculului, adaptate tipului ales;
6. rezumatul configurației înainte de confirmare.

Orașul este obligatoriu și se scrie liber, fără o listă întreținută de orașe. Interfața elimină automat diacriticele, spațiile repetate și caracterele care nu aparțin denumirii. Forma afișată și o cheie normalizată sunt păstrate separat, astfel încât `Pitești`, `PITESTI` și `pitesti` să fie tratate ca același oraș. Dacă utilizatorul își schimbă orașul, înregistrările viitoare folosesc noua valoare, iar istoricul rămâne asociat orașului valabil la data activității.

Pentru comisionul flotei, onboarding-ul trebuie să ceară:

- dacă există comision de flotă;
- modul de calcul: procent sau sumă fixă;
- valoarea procentului ori a sumei;
- pentru un comision procentual, baza aleasă de utilizator: încasări brute sau încasări nete.

Configurația comisionului flotei are istoric de valabilitate. La modificare, ProfitExact întreabă utilizatorul de la ce dată se aplică noua valoare. Perioadele anterioare datei efective păstrează comisionul vechi, iar perioadele ulterioare folosesc valoarea nouă.

Aceeași regulă se aplică oricărei configurări modificabile care influențează calculele: valoarea nouă nu suprascrie valoarea veche, ci primește propria dată de început.

Dacă data efectivă cade în mijlocul unei săptămâni pentru care există numai valori agregate săptămânal, ProfitExact nu împarte artificial suma. Utilizatorul alege dacă valoarea veche sau cea nouă se aplică întregii săptămâni; din săptămâna următoare se aplică noua valoare.

Pentru utilizatorul care selectează simultan Bolt + Uber, onboarding-ul trebuie să ceară și modul de prezentare a profitului real estimat:

1. **Împreună** — încasările Bolt și Uber rămân vizibile separat, cheltuielile comune se introduc o singură dată, iar profitul este calculat pentru întreaga activitate de ridesharing;
2. **Separat** — ProfitExact calculează profitul estimat al fiecărei platforme și repartizează automat cheltuielile comune proporțional cu venitul net al platformei.

Un cost comun nu poate fi scăzut integral la ambele platforme.

Pentru modul separat:

`pondere platformă = venit net platformă ÷ suma veniturilor nete Bolt + Uber`

`cost comun alocat platformei = cost comun total × pondere platformă`

Rezultatul este etichetat `profit estimat per platformă`, deoarece repartizarea nu reprezintă consumul real măsurat separat. Formula se aplică numai când suma veniturilor nete este mai mare decât zero.

Ordinea ramurii `Ridesharing → Angajat` este confirmată. Ordinea completă a celorlalte ramuri rămâne **DESCHISĂ**.

Crearea contului solicită cel puțin adresa de email, numărul mobil din România și parola. Adresa de email și numărul de telefon normalizat sunt unice: dacă oricare dintre ele este deja asociat unui cont, un al doilea cont nu este creat. Unicitatea reduce reutilizarea acelorași date de contact, fără a fi prezentată drept singura măsură împotriva abuzului perioadei de probă.

După creare, utilizatorul confirmă mai întâi codul primit pe email și apoi codul primit prin SMS. Onboarding-ul devine accesibil numai după confirmarea ambelor contacte. Mesajele sunt prezentate sub marca ProfitExact: emailul folosește numele de expeditor `ProfitExact` și o adresă de pe domeniul platformei, iar SMS-ul folosește expeditorul `ProfitExact` acolo unde operatorul mobil îl permite. Dacă rețeaua afișează în schimb un număr scurt generic, identitatea platformei rămâne explicită în conținutul mesajului: `Pentru verificarea numărului de telefon pe platforma ProfitExact, folosiți codul {{ .Code }}.` Numele furnizorilor tehnici nu este afișat utilizatorului ca identitate a mesajului.

### 4.3 Clasificare temporală deja confirmată

- profilul și costurile recurente sunt configurate inițial și actualizate când realitatea se schimbă;
- datele de activitate sunt introduse sau importate pentru fiecare perioadă săptămânală;
- intervențiile Service/Revizii sunt înregistrate la apariția lor;
- un document este opțional pentru fiecare intervenție Service/Revizii;
- CASCO este opțional și niciun cost contextual nu este presupus automat.

Pentru celelalte câmpuri, caracterul obligatoriu/opțional nu este încă aprobat.

### 4.4 Specificație ecran cu ecran — Ridesharing → Angajat

Această secțiune începe cu alegerea activității și se încheie cu rezumatul configurației. Nu stabilește încă ecranele de creare a contului.

#### ONB-001 — Activitatea

| Element | Specificație |
|---|---|
| Întrebare | „Ce tip de activitate faci?” |
| Opțiuni | `Ridesharing`, `Delivery`, `Ambele` |
| Obligatoriu | Da |
| Frecvență | La configurare și când activitatea se schimbă |
| Validare | Exact o opțiune dintre cele trei |
| Efect | Activează ramurile relevante; `Ambele` configurează fiecare activitate separat |
| Statut | CONFIRMAT |

#### ONB-002 — Forma de lucru

| Element | Specificație |
|---|---|
| Întrebare | „Cum lucrezi pentru ridesharing?” |
| Opțiuni | `Angajat`, `Propriul SRL/PFA` |
| Obligatoriu | Da |
| Vizibilitate | Pentru activitatea Ridesharing |
| Efect | `Angajat` continuă fluxul descris mai jos; ramura proprie solicită ulterior `SRL` sau `PFA` |
| Statut | CONFIRMAT |

#### ONB-003 — Platformele de ridesharing

| Element | Specificație |
|---|---|
| Întrebare | „Pe ce platformă lucrezi?” |
| Opțiuni | `Bolt`, `Uber`, `Bolt + Uber` |
| Obligatoriu | Da |
| Frecvență | La configurare și când platformele se schimbă |
| Efect | Stabilește importurile și formularele relevante; `Bolt + Uber` activează ONB-008 |
| Statut | CONFIRMAT |

#### ONB-004 — Situația vehiculului

| Element | Specificație |
|---|---|
| Întrebare | „Mașina este personală sau închiriată?” |
| Opțiuni | `Mașină personală`, `Mașină închiriată` |
| Obligatoriu | Da |
| Efect | Activează numai costurile relevante tipului de vehicul |
| Statut | CONFIRMAT |

#### ONB-005 — Comisionul flotei

| Câmp | Tip/opțiuni | Obligatoriu | Vizibilitate | Statut |
|---|---|---|---|---|
| Mod de calcul | Procent/Sumă fixă | Da | Întotdeauna în această ramură | CONFIRMAT |
| Valoare | Număr de la zero | Da | Întotdeauna în această ramură | CONFIRMAT |
| Bază comision | Brut/Net | Da | Numai pentru procent mai mare decât zero | CONFIRMAT |
| Data efectivă | Dată și oră România | Da | Pentru configurația financiară | CONFIRMAT |
| Monedă sumă fixă | RON | Da | Pentru sumă fixă | CONFIRMAT |
| Precizie și limite | Procent 0–100%; maximum două cifre după virgulă pentru procent și RON | Da | Pentru procent și sumă | CONFIRMAT pentru input; rotunjirea calculelor este DESCHISĂ |

Efectul asupra calculelor este versiunea comisionului valabilă pentru perioada analizată. Valoarea `0%` sau `0 RON` înseamnă că nu există comision; nu se afișează o opțiune separată Da/Nu.

#### ONB-006 — CIM/carte de muncă

| Câmp | Tip/opțiuni | Obligatoriu | Vizibilitate | Statut |
|---|---|---|---|---|
| Plătești CIM/carte de muncă prin flotă? | Da/Nu | Da | Ridesharing → Angajat | CONFIRMAT |
| Cost pe săptămână | Număr monetar în RON | Da | Dacă răspunsul este Da | CONFIRMAT |
| Data efectivă | Dată România | Da | Dacă răspunsul este Da | CONFIRMAT ca principiu |

`cost CIM/zi calendaristică = cost CIM săptămânal ÷ 7`

Exemplu: `900 RON ÷ 7 = 128,57 RON/zi calendaristică`, înainte de rotunjirea finală. Suma săptămânală totală rămâne 900 RON.

La finalul lunii se calculează și media raportată la activitatea reală:

`CIM mediu/zi lucrată în lună = cost CIM atribuit lunii ÷ numărul zilelor lucrate în lună`

Costul CIM atribuit lunii este suma cotelor zilnice care cad în luna respectivă. Dacă nu există nicio zi lucrată, costul rămâne în totalul lunii, dar media per zi lucrată nu se calculează.

#### ONB-007 — Rețineri și costuri suplimentare ale flotei

| Câmp | Tip/opțiuni | Obligatoriu | Statut |
|---|---|---|---|
| Contabilitate cerută de flotă? | Da/Nu | Da | CONFIRMAT |
| Cost contabilitate | RON + periodicitate aprobată | Condiționat | CONFIRMAT |
| Casă de marcat suportată de șofer? | Da/Nu | Da | CONFIRMAT |
| Cost casă de marcat | RON + periodicitate aprobată | Condiționat | CONFIRMAT |
| Alte rețineri | Listă configurabilă | Opțional | Structura exactă este DESCHISĂ |
| Data efectivă | Dată România | Condiționat | CONFIRMAT ca principiu |

Niciun cost nu este activat automat. Utilizatorul vede câmpul valorii numai după ce confirmă existența costului.

#### ONB-008 — Modul de profit pentru Bolt + Uber

| Element | Specificație |
|---|---|
| Întrebare | „Cum dorești să vezi profitul pentru Bolt + Uber?” |
| Opțiuni | `Împreună`, `Separat pe platformă` |
| Obligatoriu | Da |
| Vizibilitate | Numai dacă ONB-003 este `Bolt + Uber` |
| Efect | Împreună folosește costurile comune o singură dată; separat le repartizează proporțional cu venitul net |
| Statut | CONFIRMAT |

#### ONB-009 — Costurile vehiculului

Acesta este un grup contextual de ecrane, nu un singur formular aglomerat.

ProfitExact V1 nu solicită marca, modelul, anul fabricației sau categoriile Bolt/Uber ale mașinii. Aceste informații nu modifică formulele aprobate și ar încărca onboarding-ul fără un beneficiu demonstrat. Dacă o funcție viitoare va depinde direct de ele, includerea lor va necesita o decizie nouă.

Pentru ambele tipuri de vehicul, onboarding-ul solicită numai configurația de propulsie relevantă calculului costurilor:

- `Benzină`;
- `Motorină`;
- `Electric`;
- `Benzină + GPL`;
- `Hibrid pe benzină`;
- `Hibrid diesel`.

Pentru un vehicul hibrid se cere apoi tipul `HEV` sau `Plug-in/PHEV`. Un HEV folosește drept sursă alimentată extern combustibilul său de bază — benzină sau motorină. Pentru PHEV, utilizatorul introduce separat pentru fiecare zi lucrată costul benzinei și costul încărcării electrice din ziua respectivă.

Pentru `Benzină + GPL`, utilizatorul alege combustibilul principal folosit în activitate și consumul aproximativ al mașinii cu acel combustibil. Kilometrii rămân un singur total zilnic și nu se împart între GPL și benzină. Alimentările ocazionale cu sursa secundară se tratează separat drept cost general săptămânal sau lunar.

**Mașină închiriată:**

- chirie săptămânală;
- consum;
- combustibil/energie și cost;
- acces la jurnalul de spălări.

**Mașină personală:**

- consum și tipul de energie/combustibil;
- costuri recurente aplicabile;
- rată, finanțare sau leasing, dacă există;
- calculul combustibilului/energiei consumate și acces la jurnalele Service/Revizii și spălări.

Consumul în litri/100 km sau kWh/100 km este obligatoriu pentru calculul combustibilului/energiei. Pentru vehiculele cu două surse rămâne de stabilit numai modul de împărțire a kilometrilor între surse. Câmpurile exacte rămase ale jurnalelor Service/Revizii și spălări se specifică separat.

#### ONB-010 — Rezumat și confirmare

| Element | Specificație |
|---|---|
| Conținut | Toate alegerile și costurile configurate, grupate pe secțiuni |
| Acțiuni | Editarea unei secțiuni; confirmarea configurației |
| Obligatoriu | Confirmarea explicită înainte de folosirea configurației în calcule |
| Validare | Nu se poate confirma dacă lipsește un câmp condiționat obligatoriu |
| Statut | CONFIRMAT |

## 5. Costuri și date operaționale

### 5.1 Mașină proprie — CONFIRMAT

Costurile recurente posibile includ:

- RCA;
- CASCO, dacă există;
- ITP;
- rovinietă;
- alte costuri anuale sau lunare.

RCA și CASCO se introduc ca valori anuale și se repartizează pe fiecare zi calendaristică, indiferent dacă utilizatorul lucrează:

`RCA/zi = cost RCA anual ÷ 365 sau 366`

`CASCO/zi = cost CASCO anual ÷ 365 sau 366`

Numărul de zile este determinat automat din anul calendaristic. ITP-ul și rovinieta se repartizează după numărul zilelor lor de valabilitate. Pentru ITP, onboarding-ul propune inițial 180 de zile, iar utilizatorul poate confirma sau modifica valabilitatea reală.

Pentru mașina personală, costurile operaționale sunt păstrate prin jurnale simple:

- jurnal `Service/Revizii`;
- jurnal de spălări auto.

Combustibilul sau energia nu folosesc un jurnal de alimentări. ProfitExact calculează cantitatea consumată și costul aferent activității din kilometri, consumul vehiculului și prețul confirmat pe litru/kWh.

În configurarea unei mașini personale, ProfitExact întreabă dacă există rată, finanțare sau leasing. Dacă da, utilizatorul introduce rata lunară și data de la care se aplică:

`cost rată/leasing pe zi = rata lunară ÷ numărul zilelor calendaristice din luna respectivă`

Costul se aplică în fiecare zi calendaristică, indiferent de zilele lucrate.

Costul combustibilului sau energiei se calculează separat pentru fiecare zi lucrată. Nu se scade totalul bonului, ci numai costul cantității calculate ca fiind consumată pentru kilometrii zilei, conform formulelor din 5.5.2. Rezultatele săptămânale și lunare însumează costurile zilnice calculate.

### 5.2 Costuri săptămânale — CONFIRMAT

În funcție de profil pot exista:

- combustibil sau energie;
- spălătorie;
- chirie auto;
- alte costuri variabile reale ale activității.

Combustibilul sau energia din totalul săptămânal reprezintă suma costurilor calculate pentru activitatea perioadei și nu se împarte automat la șapte.

### 5.2.1 Regula generală de repartizare — CONFIRMAT

- cost săptămânal: `cost ÷ 7 zile`;
- cost lunar: `cost ÷ numărul zilelor calendaristice din lună`;
- cost anual: `cost ÷ 365 sau 366`;
- cost cu perioadă exactă de valabilitate: `cost ÷ numărul zilelor de valabilitate`;
- cost punctual: se scade integral în ziua asociată.

Chiria auto săptămânală se împarte la 7. Contabilitatea, casa de marcat și celelalte costuri configurabile folosesc regula periodicității selectate.

Parcarea și taxele punctuale de drum se scad integral în ziua înregistrării. Rovinieta rămâne cost cu perioadă de valabilitate și nu se dublează ca taxă punctuală. Formularul zilnic întreabă separat dacă utilizatorul a plătit spălătorie, parcare, taxă de drum/pod, service sau altă taxă apărută pe traseu și cere suma numai pentru răspunsurile afirmative.

Telefonul și internetul folosite pentru activitate se configurează ca sumă lunară:

`telefon și internet/zi = cost lunar ÷ numărul zilelor calendaristice din lună`

Categoria `Alte cheltuieli` păstrează data, descrierea și costul și se scade integral în ziua introdusă.

Parcarea/taxele de drum, telefonul/internetul și `Alte cheltuieli` sunt disponibile pentru toate combinațiile de profil:

- Ridesharing sau Delivery;
- Angajat sau Propriul SRL/PFA;
- vehicul personal sau închiriat.

Aceste costuri sunt opționale și se afișează numai dacă utilizatorul confirmă că le suportă. Nu sunt activate automat și nu se scad de două ori dacă aceeași cheltuială deservește mai multe contexte. Repartizarea între ridesharing și delivery va fi stabilită odată cu modelul Delivery.

### 5.3 Șofer/curier angajat prin flotă — CONFIRMAT

Pot fi relevante, numai dacă există:

- comision de flotă procentual sau ca sumă;
- cost CIM/carte de muncă;
- alte taxe sau rețineri ale flotei;
- casă de marcat, dacă este suportată de șofer;
- chirie auto;
- costurile auto rămase în sarcina șoferului;
- alte costuri reale ale activității.

Pentru o mașină închiriată, partea auto este simplificată și trebuie să reflecte contractul real, fără dublarea costurilor deja incluse în chirie.

Pentru mașina închiriată, setul auto inițial este limitat la:

- chiria săptămânală;
- consumul vehiculului;
- combustibilul sau energia și costul aferent;
- spălările auto înregistrate în jurnal.

Service-ul și celelalte costuri ale proprietarului nu sunt cerute automat șoferului cu mașină închiriată.

#### 5.3.1 Ridesharing prin flotă — date financiare inițiale

Pentru profilul de șofer angajat prin flotă, următoarele valori trebuie păstrate separat per platformă:

- încasări brute;
- încasări nete;
- tips/bacșiș prin aplicație/card;
- tips/bacșiș cash;
- compensări;
- încasări prin card;
- încasări cash;
- încasări din curse introduse manual, realizate în afara aplicației platformei.

Cheltuielile sau reținerile posibile includ:

- taxa/comisionul aplicației, indicat în discuția curentă ca 25% din brut;
- combustibilul sau energia și consumul vehiculului;
- comisionul flotei, configurat pentru fiecare utilizator;
- costul CIM/cărții de muncă, transformat într-un cost săptămânal;
- contabilitatea, numai dacă flota o solicită șoferului și acesta confirmă la onboarding;
- alte costuri contextuale deja confirmate în această specificație.

Formula de lucru curentă este:

`câștiguri nete = (încasări card + încasări cash) − comision aplicație + compensări + tips prin aplicație/card + tips cash`

iar:

`comision aplicație = suma „Comisionul oprit de aplicație” introdusă din screenshot sau manual`

Comisionul aplicației este obligatoriu pentru calculul unei zile sau perioade. ProfitExact nu inventează și nu aplică automat 25%; utilizatorul introduce suma exactă afișată de Bolt/Uber. Până la introducerea ei, rezultatul și salvarea perioadei rămân blocate.

Tips-ul cash rămâne integral la șofer și nu intră în regularizarea cu flota. Regula de lucru curentă este că tips-ul prin aplicație/card rămâne de asemenea integral la șofer: nu intră nici în baza comisionului Bolt, nici în baza comisionului flotei, dar trece prin suma gestionată de flotă și trebuie restituit integral prin regularizare. Compensările nu sunt comisionate în formula de lucru curentă.

Deoarece tratamentul tips-ului prin aplicație este confirmat momentan din experiența Product Owner-ului, nu dintr-un document recent, regula va fi verificată pe screenshoturile reale înainte să devină regulă executabilă pentru fiecare platformă.

#### 5.3.2 Regularizarea șofer–flotă — CONFIRMATĂ CA LOGICĂ

Mecanismul aprobat este:

- încasările cash și tips-ul cash rămân integral la șofer;
- încasările prin card, compensările și tips-ul plătit prin aplicație/card intră în suma gestionată prin flotă;
- din această sumă se scade comisionul Bolt de 25% aferent încasărilor brute din curse, conform formulei de lucru din 5.3.1;
- tips-ul prin aplicație/card nu este inclus în baza comisionului Bolt sau a comisionului flotei și se restituie integral șoferului;
- apoi se scad comisionul flotei și costurile datorate flotei, inclusiv CIM/cartea de muncă și contabilitatea dacă se aplică;
- dacă balanța este pozitivă, utilizatorul vede alerta „Datorezi flotei X RON”;
- dacă balanța este negativă, utilizatorul vede alerta „Flota îți datorează X RON”, folosind valoarea absolută.

Relația de calcul este:

`sumă gestionată prin flotă = încasări card + compensări + tips prin aplicație/card − comision Bolt 25%`

`balanță față de flotă = comision flotă + CIM + alte costuri datorate flotei − sumă gestionată prin flotă`

Comisionul Bolt se scade o singură dată. Dacă valoarea confirmată dintr-un screenshot este deja netă după comisionul aplicației, ProfitExact nu aplică din nou procentul de 25%. Maparea exactă a câmpurilor brute și nete rămâne obligatoriu de validat pe screenshoturile reale.

Comisionul flotei este configurat de utilizator. El poate fi sumă fixă sau procent; pentru procent, utilizatorul selectează dacă baza este brutul ori netul. Relația dintre câmpurile importate și baza selectată trebuie validată înainte ca formula să devină executabilă.

La calculul unei perioade se folosește configurația valabilă pentru acea perioadă, nu pur și simplu ultima valoare introdusă în cont.

### 5.4 Propriul PFA/SRL — CONFIRMAT

Pe lângă costurile activității auto pot exista:

- contabilitate;
- TVA intracomunitar;
- taxe sau obligații specifice formei de organizare;
- alte costuri administrative;
- facturi de platformă.

Produsul poate calcula în siguranță costuri efective configurate de utilizator. Nu va afirma o obligație fiscală exactă decât după validare separată prin legislație actuală, ANAF și contabil.

Regulile funcționale validate pentru forma juridică SRL/PFA sunt reutilizate în ridesharing și delivery; ele nu se reinventează pentru fiecare activitate. Această reutilizare nu înseamnă că același cost efectiv este scăzut de două ori.

Pentru aceeași entitate juridică folosită în ambele activități, costurile administrative fixe comune, precum contabilitatea sau un cost CIM comun, sunt repartizate analitic proporțional cu venitul net al fiecărei activități:

`cost administrativ alocat activității = cost comun × venit net activitate ÷ suma veniturilor nete ridesharing + delivery`

Rezultatul per activitate este estimat. Taxele și obligațiile legale nu sunt repartizate automat prin această formulă; ele urmează numai formule fiscale validate pentru entitatea respectivă.

#### 5.4.1 Ramura SRL

Onboarding-ul SRL trebuie să poată solicita:

- costul contabilității;
- costuri și taxe către stat relevante situației utilizatorului;
- regimul fiscal selectat dintre opțiunile validate la momentul implementării;
- dacă utilizatorul suportă un cost de CIM/carte de muncă;
- dacă răspunsul este da, valoarea și periodicitatea costului efectiv;
- alte costuri administrative reale.

Impozitul pe profit și regimul de 1% din cifra de afaceri sunt ramificații de analizat, nu formule aprobate. Denumirea legală, procentul, baza, condițiile de eligibilitate și perioadele trebuie validate fiscal înainte de implementare.

#### 5.4.2 Ramura PFA

Categoriile și formulele exacte pentru PFA sunt **DESCHISE**. Ele vor fi definite numai după verificarea obligațiilor și costurilor reale prin legislație actuală, ANAF și contabil. Până atunci, specificația poate prevedea introducerea costurilor efectiv cunoscute de utilizator, fără calcul fiscal automat.

### 5.5 Service/Revizii — CONFIRMAT

`Service/Revizii` este o singură categorie, fără fragmentare artificială în numeroase subcategorii. Fiecare intervenție este păstrată într-un jurnal cu:

- data;
- kilometrajul;
- descrierea;
- costul;
- document opțional.

Exemplele de descriere pot include schimb de ulei, frâne, anvelope sau alte intervenții, dar nu formează o taxonomie obligatorie. Datele trebuie să poată contribui ulterior la statistici și la costul real al mașinii.

Costul unei intervenții nu se repartizează pe mai multe perioade: se scade integral ca o cheltuială și este asociat datei intervenției. Prin agregare, acesta apare în ziua, săptămâna și luna care conțin acea dată. O eventuală dată separată a plății nu este încă specificată.

### 5.5.1 Jurnal de spălări — CONFIRMAT

Spălările auto sunt înregistrate individual și păstrate în istoric. Jurnalul trebuie să conțină cel puțin data și costul; celelalte câmpuri rămân de stabilit. Produsul nu impune o spălare pentru fiecare zi lucrată și nu generează automat cheltuieli lipsă.

### 5.5.2 Calculul combustibilului/energiei consumate — CONFIRMAT

ProfitExact nu păstrează un jurnal al alimentărilor și nu scade integral totalul unui bon. Pentru fiecare zi lucrată sunt obligatorii:

- kilometrii zilei;
- consumul vehiculului, exprimat în litri/100 km sau kWh/100 km;
- prețul zilei, confirmat în RON/litru sau RON/kWh.

Cantitatea consumată este calculată obligatoriu, nu introdusă ca valoare opțională:

`litri consumați = kilometri × consum litri/100 km ÷ 100`

`kWh consumați = kilometri × consum kWh/100 km ÷ 100`

`cost combustibil/energie = cantitate consumată × preț pe litru/kWh`

Numai acest cost calculat se scade din rezultatul zilei. ProfitExact afișează atât cantitatea consumată în ziua respectivă, cât și costul ei.

Prețul pe litru/kWh poate fi stabilit astfel:

1. din bon fiscal: se extrage prețul unitar afișat; dacă nu este disponibil clar, se calculează `total bon ÷ cantitate cumpărată`;
2. fără bon: utilizatorul introduce totalul plătit și cantitatea cumpărată, iar ProfitExact calculează prețul unitar.

Datele bonului sau ale alimentării sunt folosite numai pentru determinarea și confirmarea prețului unitar. Totalul bonului și cantitatea cumpărată nu devin automat cheltuiala ori consumul zilei și nu sunt păstrate într-un jurnal de alimentări. Originalul încărcat urmează politica temporară de retenție și ștergere.

Prețul confirmat este asociat numai zilei pentru care a fost introdus. ProfitExact nu calculează și nu folosește un preț mediu săptămânal. Pentru fiecare zi lucrată, utilizatorul confirmă prețul relevant acelei zile.

`cost combustibil săptămânal = suma costurilor de combustibil calculate pentru zilele săptămânii`

`cost combustibil lunar = suma costurilor de combustibil calculate pentru zilele lunii`

Pentru `Benzină + GPL`, calculul zilnic folosește:

- totalul kilometrilor zilei;
- consumul aproximativ configurat pentru combustibilul principal ales de utilizator;
- prețul zilei pentru combustibilul principal.

`cost zilnic combustibil principal = (kilometri totali ai zilei × consum principal ÷ 100) × preț unitar`

Consumul principal este exprimat în litri/100 km.

ProfitExact nu cere kilometri separați pentru GPL și benzină. Alimentările ocazionale cu sursa secundară se înregistrează ca un cost general atribuit unei săptămâni sau unei luni, la alegerea utilizatorului.

Costul general al sursei secundare:

- nu este atribuit unei zile;
- nu modifică profitul zilnic;
- se scade o singură dată din rezultatul săptămânii sau lunii selectate;
- nu se repetă automat în perioada următoare;
- apare separat în detalierea cheltuielilor perioadei.

`rezultat săptămânal/lunar = suma rezultatelor zilnice − costurile generale atribuite perioadei`

Pentru PHEV, calculul aprobat este:

`cost zilnic PHEV = cost benzină introdus pentru zi + cost încărcare electrică introdus pentru zi`

Cele două valori sunt păstrate separat, pot fi `0 RON` când sursa respectivă nu a fost folosită în acea zi, iar totalul se scade din rezultatul zilei. PHEV nu preia regula stabilită pentru `Benzină + GPL`. Separarea se păstrează și pentru eventuale analize viitoare, fără a introduce acum alerte sau formule suplimentare de consum.

### 5.6 Date și perioade de analiză — CONFIRMAT

Pentru fiecare utilizator, ProfitExact trebuie să poată prezenta rezultate zilnice, săptămânale și lunare. Un rezultat zilnic este exact când sursa sau introducerea manuală conține valorile zilei. Dacă există numai totalul săptămânal, ProfitExact nu inventează încasări pentru fiecare zi, ci calculează media pe zi lucrată numai după încheierea săptămânii. Încasările fiecărei platforme rămân vizibile separat. Pentru Bolt + Uber, profitul este prezentat împreună sau separat conform opțiunii alese de utilizator în onboarding.

Săptămâna este definită ca intervalul luni–duminică. Fusul orar funcțional al produsului este `Europe/Bucharest`, cu ajustarea automată a orei de vară/iarnă.

Înainte de realizarea screenshot-ului, utilizatorul poate alege în aplicația platformei afișarea încasărilor pe zi sau pe săptămână. ProfitExact acceptă ambele tipuri:

- screenshot zilnic: valorile confirmate sunt asociate zilei respective;
- screenshot săptămânal: valorile confirmate sunt asociate întregii săptămâni;
- introducerea manuală urmează aceeași alegere și rămâne permanent disponibilă.

Zilele lucrate, orele și kilometrii sunt preluați din screenshot când apar în sursă. Utilizatorul trebuie să confirme sau să corecteze valorile extrase. Când o valoare nu apare ori nu poate fi extrasă sigur, aceasta se completează manual.

Luna este calendaristică, de la ziua 1 până la ultima zi a lunii în fusul orar României. La finalul lunii se afișează un sumar al veniturilor, cheltuielilor și indicatorilor disponibili, inclusiv media lunară calculată după ce numărul zilelor lucrate din lună este cunoscut.

Pentru fiecare perioadă, unde profilul și sursa permit, sistemul poate colecta:

- venituri;
- bonusuri;
- alte încasări;
- ore lucrate;
- zile lucrate;
- kilometri;
- combustibil sau energie;
- costuri săptămânale;
- alte informații specifice platformei.

Kilometrii de activitate sunt extrași din screenshot atunci când apar și sunt suficient de clari; în caz contrar sunt introduși manual. Câmpurile afișate urmează perioada sursei și configurația utilizatorului:

- pentru o singură platformă, se confirmă valoarea zilei sau totalul săptămânii, conform sursei;
- pentru `Bolt + Uber → Împreună`, se confirmă un singur total de kilometri ridesharing pentru ziua sau săptămâna respectivă;
- pentru `Bolt + Uber → Separat pe platformă`, utilizatorul confirmă sau completează kilometrii Bolt și kilometrii Uber; suma lor formează totalul perioadei;
- kilometrii curselor private apar numai când utilizatorul declară încasări din curse private și nu formează un câmp permanent pentru toți utilizatorii.

Pentru calculul câștigului pe kilometru este obligatoriu totalul kilometrilor din aceeași perioadă cu rezultatul financiar. În modul separat, `0 km` este permis pentru platforma pe care utilizatorul nu a lucrat în perioada respectivă. ProfitExact nu deduce kilometrii din marca mașinii, categoria platformei sau încasări.

În introducerea manuală zilnică, orele lucrate și kilometrii activității sunt ceruți atât pentru mașina personală, cât și pentru cea închiriată. Pentru configurațiile non-PHEV, costul combustibilului sau energiei zilei se calculează imediat din kilometri, consumul configurat și prețul unitar introdus pentru ziua respectivă.

Alegerea kilometrilor împreună ori separat nu modifică formula aprobată de repartizare a costurilor comune proporțional cu venitul net. Ea stabilește ce indicatori pe kilometru pot fi calculați per platformă.

La încheierea perioadei, valorile medii pe zi lucrată se calculează astfel:

`medie săptămânală pe zi lucrată = valoare săptămânală ÷ zile lucrate în săptămână`

`medie lunară pe zi lucrată = valoare lunară ÷ zile lucrate în lună`

Media săptămânală se calculează numai după încheierea săptămânii, iar media lunară numai după încheierea lunii, deoarece ProfitExact nu presupune în avans în ce zile va lucra utilizatorul. Mediile sunt etichetate distinct față de valorile zilnice reale importate sau introduse. Când numărul zilelor lucrate este zero sau lipsește, media nu se calculează. Alocarea unei săptămâni care traversează două luni este încă **DESCHISĂ**.

### 5.7 Unități cunoscute, dar încă nespecificate complet

Contextul confirmă folosirea sumelor monetare, procentelor, kilometrilor, orelor, zilelor, litrilor și/sau kWh, după caz. Specificația nu a aprobat încă:

- alte monede decât RON, care sunt excluse din V1;
- o limită tehnică maximă pentru partea întreagă; aceasta nu trebuie să blocheze valori realiste precum 15.000 lei/lună;
- rotunjirile;
- formatul duratelor;
- validările între câmpuri.

Sumele introduse în RON și procentele acceptă maximum două cifre după virgulă. Această regulă privește inputul și afișarea; precizia internă și momentul rotunjirii formulelor se stabilesc separat.

## 6. Import asistat

### 6.1 Flux obligatoriu — CONFIRMAT

Fluxul urmărit este:

1. utilizatorul încarcă un screenshot sau PDF;
2. sistemul folosește contextul de profil și platformă;
3. sistemul încearcă să detecteze dacă sursa este zilnică sau săptămânală și afișează perioada detectată;
4. utilizatorul confirmă sau corectează tipul și perioada;
5. extractorul potrivit propune valori structurate, inclusiv fiecare linie de încasare și explicația ei atunci când apar în sursă;
6. valorile sunt afișate utilizatorului;
7. utilizatorul confirmă sau corectează;
8. numai datele confirmate intră în motorul de calcul.

Pentru introducerea manuală, utilizatorul alege direct una dintre cele două acțiuni:

- `Adaugă o zi`;
- `Adaugă o săptămână`.

Formularul și calculele folosesc perioada aleasă. Nicio detectare automată nu înlocuiește confirmarea utilizatorului.

### 6.2 Limitele automatizării — CONFIRMAT

- inputul manual rămâne permanent fallback;
- OCR-ul/parserul nu calculează rezultatul financiar;
- tehnologia de extracție nu este încă aleasă; opțiunile pot fi cercetate și prototipate înaintea alegerii finale;
- pentru fiecare sursă reală se va compara precizia, costul, viteza și mentenanța soluțiilor posibile;
- nu se implementează un extractor doar pentru că este tehnic posibil.

Denumiri precum `BoltDriverEarningsExtractor` descriu conceptual module viitoare și nu reprezintă o arhitectură sau un stack aprobate.

Sursele confirmate ca intenție includ screenshoturile zilnice sau săptămânale cu încasări și activitate. Zilele lucrate, orele și kilometrii se extrag când sunt vizibile și suficient de clare în sursă. Câmpurile exacte vor fi stabilite după analizarea mostrelor reale; până atunci nu se presupune dacă o linie reprezintă valoare brută, netă, bonus, ajustare sau alt tip și nu se inventează o valoare care lipsește.

## 7. Motorul financiar

### 7.1 Motor determinist — CONFIRMAT

Motorul financiar trebuie să fie determinist, separat de mecanismul de extracție și acoperit ulterior de teste automate.

### 7.2 Relația conceptuală — CONFIRMAT

Direcția de calcul este:

`venituri − costuri/rețineri relevante − costuri variabile − costuri recurente repartizate − tratamentul aprobat pentru service − alte costuri relevante = profit real estimat`

Aceasta este o relație conceptuală, nu formula executabilă finală. Definițiile bazelor, momentelor și numitorilor trebuie aprobate în D-002–D-006.

Încasările din curse introduse manual, realizate în afara aplicației platformei, sunt venit suplimentar. Nu li se aplică taxa aplicației sau comisionul flotei, dar contribuie la profit împreună cu costurile reale ale activității, precum combustibil, service și spălătorie.

### 7.3 Profitul zilei — CONFIRMAT

Profitul zilei pornește de la încasările nete ale zilei și scade toate cheltuielile atribuite zilei respective, atunci când există valori zilnice reale. Costurile înregistrate ca evenimente se asociază datei lor, iar partea zilnică a unui cost recurent urmează formula de repartizare aprobată pentru acel cost.

Dacă încasările sunt disponibile numai ca total săptămânal, ProfitExact calculează rezultatul săptămânii și, după încheierea ei, media rezultatului pe zi lucrată. Media nu este prezentată drept profitul exact al unei anumite zile.

### 7.4 Indicatori obligatorii — CONFIRMAT

V1 trebuie să poată calcula și explica, când există date suficiente:

- venit brut, după aprobarea definiției sale;
- profit real estimat;
- cost total;
- cost/km;
- câștigul obținut pe kilometru;
- venit/oră;
- profit/oră;
- consum;
- litri sau kWh utilizați;
- alți KPI-uri demonstrați ca utili.

`profitul zilei = încasările nete ale zilei − toate cheltuielile atribuite zilei`

`câștig pe kilometru al perioadei = profitul perioadei ÷ kilometrii aceleiași perioade`

Dacă kilometrii sunt zero, indicatorul nu se calculează.

În interfață nu se folosește eticheta `profit/km`. Pentru un rezultat pozitiv, ProfitExact adaptează alerta perioadei:

- „Ai câștigat X RON/km azi.” pentru date zilnice reale;
- „Ai câștigat X RON/km săptămâna aceasta.” pentru rezultatul săptămânal;
- „Ai câștigat X RON/km luna aceasta.” pentru rezultatul lunar.

Formula folosește profitul aceleiași perioade, după scăderea tuturor cheltuielilor atribuite perioadei. Mesajele sunt:

- rezultat pozitiv: „Ai câștigat X RON/km azi/săptămâna aceasta/luna aceasta.”;
- rezultat zero: „Ai câștigat 0 RON.”, fără calcul sau afișare pe kilometru;
- rezultat negativ: „Ai pierdut X RON/km azi/săptămâna aceasta/luna aceasta.”.

Dacă kilometrii perioadei sunt zero, mesajul pe kilometru nu se calculează.

Dacă există date zilnice suficiente, pot fi derivate ulterior profitul mediu/zi, venitul/zi și orele/zi. Acestea nu obligă V1 să ceară alte inputuri zilnice în afara celor aprobate explicit.

## 8. Istoric, dashboard și alerte

### 8.1 Istoric — CONFIRMAT

Istoricul trebuie să permită observarea evoluției pe perioade, cu orientare principală săptămânală.

Datele structurate confirmate și configurațiile financiare se păstrează pentru istoricul utilizatorului pe termen lung, astfel încât comparațiile lunare și anuale să poată fi construite pe măsură ce există suficiente perioade. Politica pentru închiderea contului, export și ștergere rămâne de stabilit înainte de beta.

Sumarul lunar devine disponibil după prima lună calendaristică pentru care există date. Utilizatorul poate deschide ulterior orice lună păstrată și poate vedea detaliat:

- încasările și componentele lor;
- cheltuielile și jurnalele care au contribuit la lună;
- profitul real estimat;
- valorile per platformă sau combinate conform configurației;
- indicatorii și comparațiile disponibile.

Raportul lunar ProfitExact este un instrument intern de analiză și nu este prezentat ca bilanț contabil oficial. Raportul/comparația anuală devine disponibilă după acumularea a 12 luni de istoric.

### 8.2 Dashboard — CONFIRMAT

Dashboard-ul trebuie să fie contextual profilului și să includă grafice, trenduri, comparații și istoric relevante, evidențiind încasările, cheltuielile și profitul estimat. Utilizatorul trebuie să poată vedea rezultatele zilnice, săptămânale și lunare. Încasările Bolt și Uber sunt vizibile separat, iar profitul este afișat împreună sau separat conform alegerii făcute în onboarding. În modul separat, profitul fiecărei platforme este marcat explicit drept estimat.

Pentru profilul `Ridesharing → Angajat`, ordinea funcțională inițială aprobată este:

1. contextul activ: platformă, forma de lucru și tipul vehiculului;
2. selectorul de perioadă: `Azi`, `Săptămână`, `Lună`;
3. perioada calendaristică exactă analizată;
4. rezultatul principal, formulat simplu: `După toate cheltuielile, îți rămân X RON`;
5. încasările nete și cheltuielile totale;
6. alerta de câștig pe kilometru, adaptată perioadei;
7. detalierea cheltuielilor care au contribuit la rezultat;
8. regularizarea cu flota: `Flota îți datorează X RON` sau `Datorezi flotei X RON`;
9. acțiunile `Adaugă o zi` și `Adaugă o săptămână`;
10. navigarea principală: `Acasă`, `Istoric`, `Setări`.

Tab-ul `Azi` prezintă un rezultat exact numai când există date zilnice reale confirmate. Pentru o sursă exclusiv săptămânală se afișează rezultatul săptămânii și media aprobată pe zi lucrată, fără inventarea unui rezultat pentru o anumită zi.

Valorile folosite în schița de validare nu sunt valori implicite ale produsului. Culorile, fonturile, dimensiunile și stilul vizual final nu sunt încă aprobate și vor fi stabilite în etapa de UX/UI.

### 8.3 Alerte — CONFIRMAT

Alertele comparative V1 aprobate sunt:

- „Încasările au crescut/scăzut cu X RON.”;
- „Ți-au rămas cu X RON mai mult/mai puțin.”;
- „Cheltuielile au crescut/scăzut cu X RON.”;
- „Ai lucrat mai multe/mai puține ore pentru rezultatul obținut.”.

Regularizarea cu flota este afișată separat de aceste comparații: „Flota îți datorează X RON” sau „Datorezi flotei X RON”.

Regularizarea zilnică se păstrează în săptămâna calendaristică luni–duminică. Soldul folosit pentru plata săptămânală este suma regularizărilor tuturor zilelor confirmate din acea săptămână. Corectarea și reconfirmarea aceleiași date actualizează ziua existentă și nu o dublează.

Perioadele de comparație aprobate sunt:

- o zi cu ultima zi lucrată anterioară pentru care există date complete și comparabile;
- o săptămână încheiată cu săptămâna anterioară completă;
- o lună încheiată cu luna anterioară completă.

ProfitExact nu compară o perioadă incompletă cu una completă. Pentru creșterea încasărilor, mesajul aprobat ca model este:

> „Felicitări! Încasările au crescut cu X RON față de perioada anterioară.”

Textul concret menționează `ultima zi lucrată`, `săptămâna trecută` sau `luna trecută`, după caz.

Regulile de afișare V1 sunt:

- maximum patru alerte comparative pentru o perioadă;
- ordinea este: suma rămasă după cheltuieli, încasări, cheltuieli, ore lucrate;
- alertele apar numai după încheierea perioadei;
- dacă un indicator nu s-a schimbat, alerta lui nu se afișează;
- V1 nu folosește praguri procentuale pentru aceste patru alerte;
- regularizarea cu flota rămâne permanent separată.

### 8.4 Statistici publice pe oraș — CONFIRMAT

Vizitatorii pot vedea statistici agregate fără cont. Sunt eligibile numai zilele de lucru confirmate. Pentru o lună și un oraș, valorile se publică doar dacă există minimum 10 utilizatori distincți și 30 de zile lucrate confirmate; altfel se afișează `Date insuficiente`.

Setul inițial include rezultatul mediu pe zi lucrată, câștigul pe kilometru, câștigul pe oră, cheltuielile medii pe zi și numărul contribuitorilor. Pagina precizează că valorile provin din datele introduse de utilizatorii ProfitExact și nu sunt statistici oficiale ale platformelor. Nu se publică date individuale și nu se oferă acces flotelor la conturile șoferilor.

## 9. Uploaduri și păstrarea datelor

### 9.1 Principiu — CONFIRMAT

Fluxul de date este:

`upload → extragere → confirmare → păstrarea datelor structurate → ștergerea originalului după perioada de retenție`

Fișierele originale nu se păstrează la infinit. Politica exactă de retenție, ștergere și informare a utilizatorului trebuie aprobată înainte de beta externă. Scopurile declarate sunt reducerea costului de stocare, a riscului GDPR și a datelor personale păstrate inutil.

## 10. Monetizare și context administrativ

### 10.1 Monetizare — CONFIRMATĂ CA REGULĂ DE PRODUS

Perioada de probă este de `14 zile de la înregistrare`. După perioada de probă, prețul lunar aprobat pentru ofertă este `24,99 RON/lună`.

Plățile nu se implementează înainte de existența unui produs funcțional și a validării beta. Data și ora exactă a expirării probei, notificările, acordul pentru plată, anularea, reînnoirea, tratamentul contului după expirare și măsurile împotriva abuzului de conturi rămân de specificat înaintea implementării abonamentului. Complexitatea onboarding-ului nu este tratată drept mecanism anti-abuz.

Înainte de lansarea comercială vor fi verificate procesatorul de plăți, facturarea, taxele, CAEN, GDPR, Terms, Privacy Policy și contabilitatea.

### 10.2 Firma — CONTEXT ADMINISTRATIV

Firma indicată pentru exploatarea viitoare a produsului este `MVG SOLUTIONS EXPRESS SRL`. Situația curentă menționată este CAEN Rev.3 `5320` principal, `4933`, `6210` și `6310`, cu `5829` ca posibilă completare înainte de exploatarea comercială.

Codurile, încadrarea și necesitatea adăugării ori modificării lor se vor reverifica înainte de exploatarea comercială.

## 11. În afara V1

Următoarele sunt **EXCLUSE V1**:

- fleet management complet;
- marketplace;
- administrarea șoferilor pentru flote;
- integrarea cu Bolt Fleet API sau Uber Fleet API;
- sistem complex pentru administratorii de flotă;
- aplicații iOS/Android native de la început;
- automatizări fără utilitate demonstrată.

## 12. Context pentru faze viitoare

Fără includere automată în V1, au fost menționate:

- export Excel/CSV/PDF și centralizare pentru contabil la profilurile PFA/SRL;
- rapoarte mai detaliate;
- aplicații mobile native;
- modul pentru flote;
- API-uri și alte extensii.

### 12.1 Tutorial de onboarding — CERINȚĂ PENTRU FINALUL PRODUSULUI

După finalizarea fluxurilor, ProfitExact va avea un tutorial video accesibil de pe prima pagină, destinat înregistrării și configurării corecte a utilizatorului.

Tutorialul și textele asociate trebuie să explice clar că:

- profilul, configurările și datele structurate confirmate rămân disponibile pentru săptămânile și lunile viitoare;
- utilizatorul nu reintroduce în fiecare săptămână informațiile permanente;
- screenshot-urile și PDF-urile originale nu sunt păstrate la infinit și urmează politica de retenție și ștergere aprobată înainte de beta.

### 12.2 Asistență — CERINȚĂ CONFIRMATĂ, CONECTARE ÎNAINTE DE LANSARE

Interfața va include un buton de asistență prin care utilizatorul descrie problema întâmpinată. Solicitarea trebuie direcționată către canalul oficial de suport al ProfitExact.

Baza secțiunii este prezentă pe prima pagină și solicită numele, emailul pentru răspuns, categoria solicitării și mesajul. Categoriile inițiale acoperă contul, onboarding-ul, calculele, problemele tehnice, ideile și alte solicitări. Interfața avertizează utilizatorul să nu trimită parole sau coduri de verificare. Numărul oficial de contact va fi adăugat înainte de lansare.

Adresele intenționate sunt:

- `support@profitexact.com` pentru solicitările utilizatorilor;
- `administrator@profitexact.com` pentru administrarea platformei.

Crearea adreselor, verificarea domeniului, protecția anti-spam, trimiterea efectivă și fluxul operațional de răspuns se stabilesc la finalul produsului, înainte de utilizarea publică. Aceste adrese sunt deocamdată denumiri planificate, nu conturi confirmate ca active.

## 13. Criteriul de aprobare a specificației funcționale

Specificația funcțională V1 poate fi aprobată drept bază completă de implementare numai după ce include, pentru fiecare profil și flux:

1. onboarding-ul complet, ecran cu ecran;
2. toate opțiunile și ramificațiile;
3. separarea informațiilor configurate ocazional de cele introduse săptămânal;
4. caracterul obligatoriu sau opțional al fiecărui câmp;
5. unitățile și validările;
6. regulile de vizibilitate;
7. formulele deterministe complete;
8. dashboard-ul contextual;
9. deciziile deschise închise ori scoase explicit din V1.

Documentul curent este fundația acestui proces, nu specificația completă. Cercetarea, prototipurile, testele și implementarea incrementală pot evolua în paralel pentru zone suficient de clare, dar comportamentele nerezolvate nu devin reguli de producție fără o decizie documentată.
