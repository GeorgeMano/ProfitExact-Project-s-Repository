# ProfitExact — Decizii de produs

Acest document păstrează numai deciziile care influențează produsul. Detaliile complete sunt în [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md).

## Confirmate

### Utilizatori și activități

- Activități: Ridesharing, Delivery sau Ambele.
- Forme de lucru: Angajat sau Propriul SRL/PFA.
- Pentru forma proprie se alege SRL sau PFA.
- Un cont poate avea simultan un context ridesharing și unul delivery, cu rezultate separate.
- Delivery va avea propriile venituri și costuri operaționale, definite după obținerea datelor reale.

### Localizare și perioade

- Interfață în română și engleză; româna este implicită.
- Monedă: RON.
- Fus orar: `Europe/Bucharest`.
- Săptămână: luni–duminică.
- Lună: ziua 1 până la ultima zi calendaristică.
- Istoricul structurat se păstrează pentru rapoarte lunare și anuale.
- Orașul principal de lucru este obligatoriu pentru fiecare context de activitate și se scrie liber, fără listă fixă.
- Diacriticele sunt eliminate automat, iar variațiile de scriere sunt grupate printr-o cheie normalizată; schimbarea orașului se aplică numai înregistrărilor viitoare.
- Statisticile publice pe oraș folosesc numai perioade confirmate și apar de la minimum 10 utilizatori distincți și 30 de zile lucrate confirmate; sub prag se afișează `Date insuficiente`.
- Statisticile reprezintă date agregate introduse de utilizatorii ProfitExact, nu date oficiale ale platformelor.

### Reduceri și flote partenere

- O colaborare cu o flotă poate oferi exclusiv o reducere șoferilor printr-un cod sau o campanie limitată.
- Flota nu primește acces la conturi, date, rezultate ori administrarea șoferilor.
- Orașul principal de lucru este obligatoriu pentru fiecare context de activitate și se scrie liber, fără listă fixă.
- Diacriticele sunt eliminate automat, iar variațiile de scriere sunt grupate printr-o cheie normalizată; schimbarea orașului se aplică numai înregistrărilor viitoare.
- Statisticile publice pe oraș folosesc numai perioade confirmate și apar de la minimum 10 utilizatori distincți și 30 de zile lucrate confirmate; sub prag se afișează `Date insuficiente`.
- Statisticile reprezintă date agregate introduse de utilizatorii ProfitExact, nu date oficiale Bolt, Uber sau ale platformelor Delivery.

### Reduceri și flote partenere

- O colaborare cu o flotă poate oferi exclusiv o reducere șoferilor printr-un cod sau o campanie limitată.
- Flota nu primește acces la conturi, date, rezultate ori administrarea șoferilor.

### Ridesharing prin flotă

- Platforme: Bolt, Uber sau Bolt + Uber.
- Comisionul flotei poate fi procent sau sumă fixă; procentul poate avea baza Brut sau Net.
- `0%` sau `0 RON` înseamnă fără comision.
- Configurările financiare au dată efectivă și nu suprascriu istoricul.
- CIM, contabilitatea, casa de marcat și alte rețineri apar numai dacă există.
- CIM-ul se introduce ca sumă săptămânală și se împarte la 7 zile calendaristice.
- La finalul lunii se afișează `cost CIM al lunii ÷ zile lucrate în lună`.
- Curse private: venit manual, fără comision de platformă sau flotă.
- Cash-ul și tips-ul cash rămân integral la șofer.
- Tips-ul are două câmpuri distincte: tips prin aplicație/card și tips cash.
- Regula de lucru este că ambele tipuri de tips rămân integral șoferului și nu intră în baza comisionului Bolt sau a comisionului flotei; regula pentru tips-ul prin aplicație se validează pe screenshoturi reale.
- Suma gestionată prin flotă este formată din încasările card, compensările și tips-ul prin aplicație/card, minus comisionul Bolt de 25% aferent încasărilor brute din curse.
- Din suma gestionată prin flotă se scad comisionul flotei, CIM-ul și celelalte costuri datorate flotei.
- Balanța se definește ca obligațiile către flotă minus suma gestionată prin flotă.
- Balanță pozitivă: `Datorezi flotei X RON`; balanță negativă: `Flota îți datorează X RON`.
- Comisionul aplicației se introduce ca sumă exactă din screenshot sau manual, în câmpul `Comisionul oprit de aplicație`; ProfitExact nu aplică automat 25%.
- Fără această sumă obligatorie, rezultatul și salvarea zilei/perioadei sunt blocate.
- Comisionul aplicației se scade o singură dată dacă valorile importate sunt brute; dacă screenshotul este deja net, maparea trebuie confirmată înainte de calcul.

### Bolt + Uber

- Utilizatorul alege rezultate împreună sau separat pe platformă.
- Împreună: costurile comune se introduc o singură dată.
- Separat: costurile comune se repartizează proporțional cu venitul net.
- Kilometrii se confirmă sau se completează ca total în modul Împreună și per platformă în modul Separat.

### Vehicul și costuri

- Vehicul personal sau închiriat.
- Nu se cer marca, modelul, anul sau categoria Bolt/Uber.
- Propulsie: benzină, motorină, electric, benzină + GPL, hibrid benzină sau hibrid diesel.
- Pentru hibrid se alege HEV sau Plug-in/PHEV.
- Pentru PHEV, utilizatorul introduce separat în fiecare zi costul benzinei și costul încărcării electrice; totalul se scade din rezultatul zilei, iar cele două valori rămân distincte pentru analize viitoare.
- Pentru Benzină + GPL există un singur total zilnic de kilometri.
- Utilizatorul alege combustibilul principal și consumul aproximativ; calculul zilnic folosește această sursă.
- Alimentările ocazionale cu sursa secundară sunt cost general săptămânal sau lunar, ales de utilizator.
- Costul sursei secundare nu afectează profitul unei zile, se scade o singură dată din perioada aleasă și nu se repetă automat.
- Mașina personală are jurnale pentru Service/Revizii și spălări.
- Service/Revizii păstrează data, kilometrajul, descrierea, costul și documentul opțional.
- Nu există jurnal de alimentări; totalul bonului nu se scade integral.
- Cantitatea consumată se calculează obligatoriu din kilometri și consumul în litri/100 km sau kWh/100 km.
- Costul scăzut din rezultat este `cantitate consumată × preț pe litru/kWh`.
- Prețul unitar se extrage din bon sau se calculează din totalul plătit și cantitatea cumpărată; datele trebuie confirmate.
- Prețul este confirmat separat pentru fiecare zi lucrată; nu se calculează și nu se folosește un preț mediu săptămânal.
- Costul săptămânal și lunar al combustibilului este suma costurilor zilnice calculate.
- Mașina închiriată folosește chiria, combustibilul/energia și spălările relevante șoferului.
- RCA și CASCO se împart la 365 sau 366 de zile și se aplică zilnic, indiferent de zilele lucrate.
- Rata/leasingul lunar se împarte la numărul zilelor calendaristice din lună și se aplică zilnic.
- Chiria săptămânală se împarte la 7 zile.
- ITP-ul și rovinieta se împart la numărul zilelor de valabilitate.
- Parcarea și taxele punctuale de drum se scad integral în ziua înregistrării.
- Telefonul și internetul se introduc lunar și se împart la zilele calendaristice ale lunii.
- `Alte cheltuieli` se introduc cu dată, descriere și cost și se scad în ziua respectivă.
- Regula generală este: săptămânal ÷ 7, lunar ÷ zilele lunii, anual ÷ 365/366, valabilitate exactă ÷ zilele de valabilitate, punctual integral în ziua asociată.
- Parcarea/taxele de drum, telefonul/internetul și `Alte cheltuieli` sunt opționale și disponibile în toate profilurile și pentru ambele tipuri de vehicul.
- Un cost comun mai multor contexte se introduce o singură dată.

### Importuri și calcule

- Introducerea manuală rămâne disponibilă.
- Datele extrase trebuie confirmate sau corectate înainte de calcul.
- Motorul financiar nu depinde de mecanismul de extragere.
- Screenshoturile cu încasări și activitate pot fi zilnice sau săptămânale.
- Pentru screenshot, ProfitExact detectează perioada și îi cere utilizatorului să o confirme sau să o corecteze.
- Pentru introducerea manuală, utilizatorul alege `Adaugă o zi` sau `Adaugă o săptămână`.
- Zilele lucrate, orele și kilometrii se extrag din screenshot când sunt vizibile și se confirmă; valorile absente sau nesigure se introduc manual.
- Datele zilnice reale sunt asociate zilei; un total săptămânal nu este transformat în zile fictive.
- După încheierea săptămânii se calculează `valoare săptămânală ÷ zile lucrate în săptămână`.
- După încheierea lunii se calculează `valoare lunară ÷ zile lucrate în lună`.
- Când există valori zilnice reale, profitul zilei este: `încasările nete ale zilei − toate cheltuielile atribuite zilei`.
- Câștigul pe kilometru: `profitul perioadei ÷ kilometrii aceleiași perioade`.
- În interfață nu se afișează eticheta `profit/km`; pentru o valoare pozitivă, alerta menționează perioada: azi, săptămâna aceasta sau luna aceasta.
- Pentru rezultat zero se afișează simplu `Ai câștigat 0 RON.`, fără calcul pe kilometru.
- Pentru rezultat negativ se afișează `Ai pierdut X RON/km`, cu perioada corespunzătoare.
- Dacă kilometrii sunt zero, indicatorul pe kilometru nu se calculează.

### Dashboard Ridesharing → Angajat

- Selector de perioadă: Azi, Săptămână și Lună.
- Rezultatul principal folosește formularea `După toate cheltuielile, îți rămân X RON`.
- Urmează încasările nete, cheltuielile totale, alerta pe kilometru, detalierea cheltuielilor și regularizarea cu flota.
- Dashboard-ul oferă acțiunile `Adaugă o zi` și `Adaugă o săptămână` și navigarea `Acasă`, `Istoric`, `Setări`.
- Valorile din schița aprobată sunt demonstrative; stilul vizual final nu este încă stabilit.

### Comparații

- Ziua se compară cu ultima zi lucrată anterioară care are date complete și comparabile.
- Săptămâna încheiată se compară cu săptămâna anterioară completă.
- Luna încheiată se compară cu luna anterioară completă.
- O perioadă incompletă nu se compară cu una completă.
- Model de mesaj pozitiv: `Felicitări! Încasările au crescut cu X RON față de perioada anterioară.`
- Alertele comparative V1 urmăresc: încasările, suma rămasă după cheltuieli, cheltuielile totale și orele lucrate pentru rezultatul obținut.
- Regularizarea cu flota este afișată separat și nu este tratată ca o comparație.
- Se afișează maximum patru alerte, în ordinea: suma rămasă, încasări, cheltuieli, ore.
- Alertele apar numai după încheierea perioadei; un indicator neschimbat nu produce alertă.
- V1 nu folosește praguri procentuale pentru aceste comparații.

### Monetizare și funcții ulterioare

- Probă: 14 zile de la înregistrare.
- Preț: 24,99 RON/lună după probă.
- Plățile se implementează după produsul funcțional și beta.
- Sunt planificate tutorialul video și adresele `support@profitexact.com` și `administrator@profitexact.com`. Secțiunea de suport și contact este pregătită pe prima pagină; numărul oficial și trimiterea reală se adaugă înainte de lansare.

### Dezvoltare

- Produsul se construiește incremental: clarificare, implementare, teste, verificare și corectare pentru fiecare secțiune.
- Fundația aprobată este Next.js cu TypeScript și Supabase.
- Motorul financiar are teste unitare rapide cu Vitest, iar fluxurile complete sunt verificate cu Playwright.
- Prima secțiune funcțională este numai în română. Engleza nu blochează nucleul produsului și va fi reevaluată după validarea acestuia.
- Contul se activează numai după verificarea prin cod atât a emailului, cât și a numărului mobil. Emailurile și SMS-urile de verificare sunt trimise sub marca `ProfitExact`, fără expunerea numelui Supabase către utilizator. Este acceptat ca operatorul să afișeze un număr scurt generic în locul numelui, dar textul SMS-ului identifică întotdeauna ProfitExact.

## Deschise

- maparea câmpurilor din screenshoturile Bolt și Uber, inclusiv validarea regulii de necomisionare pentru tips-ul prin aplicație și maparea compensărilor;
- formulele fiscale SRL/PFA, după validare fiscală;
- modelul operațional Delivery;
- politica de păstrare a fișierelor încărcate;
- regulile asistenței;
- regulile complete ale abonamentului și contului expirat.
