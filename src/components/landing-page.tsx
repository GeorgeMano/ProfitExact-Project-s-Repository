"use client";

import { useState, type FormEvent } from "react";
import { BrandMark } from "./brand-mark";

export function LandingPage({ onCreateAccount }: { onCreateAccount: () => void }) {
  const [supportNotice, setSupportNotice] = useState("");

  const prepareSupportMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSupportNotice("Formularul este pregătit. Trimiterea reală va fi activată înainte de lansare.");
  };

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <a className="landing-brand" href="#sus" aria-label="ProfitExact — prima pagină">
          <BrandMark className="landing-brand-mark" />
          <span>ProfitExact</span>
        </a>
        <nav aria-label="Navigare principală">
          <a href="#cum-functioneaza">Cum funcționează</a>
          <a href="#ce-afli">Ce afli</a>
          <a href="#pentru-cine">Contexte</a>
          <a href="#suport">Suport</a>
        </nav>
        <button className="landing-header-button" type="button" onClick={onCreateAccount}>Creează cont</button>
      </header>

      <section className="landing-hero" id="sus">
        <div className="hero-copy">
          <p className="landing-kicker">Pentru șoferi și curieri din România</p>
          <h1>Știi cât încasezi.<br /><span>ProfitExact îți arată exact ce rămâne după cheltuieli.</span></h1>
          <p className="hero-lead">Aduni într-un singur loc încasările, kilometrii, orele și toate cheltuielile activității. ProfitExact face calculele zilnice, săptămânale și lunare și îți explică rezultatul pe înțelesul tău.</p>
          <div className="hero-actions">
            <button className="landing-primary" type="button" onClick={onCreateAccount}>Creează cont gratuit</button>
            <a className="landing-secondary" href="#cum-functioneaza">Vezi cum funcționează</a>
          </div>
          <div className="hero-facts" aria-label="Detalii principale">
            <span>14 zile de probă</span>
            <span>24,99 RON/lună după probă</span>
            <span>Creat pentru România</span>
          </div>
        </div>

        <div className="hero-report" aria-label="Exemplu de rezultat ProfitExact">
          <div className="report-topline"><span>Exemplu săptămânal</span><strong>26 aug. – 1 sept.</strong></div>
          <div className="report-main"><span>După toate cheltuielile, îți rămân</span><strong>2.846,50 RON</strong><small>Ai câștigat 2,91 RON/km săptămâna aceasta.</small></div>
          <div className="report-grid"><div><span>Încasări nete</span><strong>4.920 RON</strong></div><div><span>Cheltuieli</span><strong>2.073,50 RON</strong></div><div><span>Ore lucrate</span><strong>48 ore</strong></div><div><span>Kilometri</span><strong>978 km</strong></div></div>
          <div className="report-fleet"><span>Regularizare flotă</span><strong>Flota îți datorează 385 RON</strong></div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Platforme și activități acceptate">
        <span>Ridesharing</span><strong>Bolt</strong><strong>Uber</strong><span>Delivery</span><strong>Glovo</strong><strong>Wolt</strong><strong>Bolt Food</strong>
      </section>

      <section className="landing-section" id="cum-functioneaza">
        <div className="section-heading"><p className="landing-kicker">Cum începi</p><h2>Îl configurezi o dată. Apoi completezi numai ce s-a întâmplat.</h2><p>Onboarding-ul adaptează aplicația situației tale, ca să nu vezi întrebări și costuri care nu ți se aplică.</p></div>
        <div className="steps-grid">
          <article><span>01</span><h3>Îți creezi contul</h3><p>Pornești perioada de probă și îți pregătești profilul personal.</p></article>
          <article><span>02</span><h3>Configurezi activitatea</h3><p>Alegi ridesharing, delivery sau ambele, forma de lucru, platformele și tipul vehiculului.</p></article>
          <article><span>03</span><h3>Adaugi activitatea</h3><p>Introduci manual o zi sau o săptămână. Importul asistat din screenshot va completa aceleași câmpuri, cu confirmarea ta.</p></article>
          <article><span>04</span><h3>Vezi ce îți rămâne</h3><p>Primești rezultatul după toate costurile, indicatorii activității și regularizarea cu flota.</p></article>
        </div>
      </section>

      <section className="onboarding-explainer">
        <div className="onboarding-copy"><p className="landing-kicker">Onboarding contextual</p><h2>ProfitExact întreabă numai ce contează pentru situația ta.</h2><p>Datele permanente sunt configurate la început și refolosite în săptămânile și lunile următoare. Dacă un comision sau un cost se schimbă, alegi data de la care se aplică noua valoare.</p><ul><li>Activitatea și forma de lucru</li><li>Bolt, Uber sau ambele platforme</li><li>Mașină personală ori închiriată</li><li>Comisionul flotei și costul CIM</li><li>Combustibilul, consumul și costurile recurente</li></ul></div>
        <div className="data-rhythm">
          <div><span>Configurezi o singură dată</span><strong>Profil, platforme, vehicul, flotă, RCA, CASCO, ITP, leasing, chirie și alte costuri recurente reale.</strong></div>
          <div><span>Completezi în fiecare zi lucrată</span><strong>Încasări, tips, compensări, ore, kilometri, prețul combustibilului și cheltuielile apărute pe traseu.</strong></div>
          <div><span>Primești automat</span><strong>Rezultat zilnic, total săptămânal, istoric lunar, câștig/km, câștig/oră și soldul față de flotă.</strong></div>
        </div>
      </section>

      <section className="landing-section" id="ce-afli">
        <div className="section-heading compact"><p className="landing-kicker">Mai mult decât venit minus combustibil</p><h2>Toate costurile care schimbă rezultatul real.</h2></div>
        <div className="benefits-grid">
          <article><span>RON</span><h3>Exact cât îți rămâne</h3><p>Vezi încasările după comisioane, CIM, combustibil și toate celelalte cheltuieli.</p></article>
          <article><span>KM</span><h3>Câștig pe kilometru</h3><p>Vezi cât ai câștigat pentru fiecare kilometru al aceleiași perioade.</p></article>
          <article><span>H</span><h3>Câștig pe oră</h3><p>Orele lucrate sunt centralizate împreună cu rezultatul activității.</p></article>
          <article><span>7Z</span><h3>Regularizare săptămânală</h3><p>Știi dacă datorezi flotei sau dacă flota trebuie să îți plătească diferența.</p></article>
          <article><span>365</span><h3>Costuri repartizate</h3><p>RCA, CASCO, leasing, chirie, telefon și alte costuri sunt împărțite corect.</p></article>
          <article><span>↗</span><h3>Istoric și comparații</h3><p>Compari zile, săptămâni și luni complete fără să pierzi datele vechi.</p></article>
        </div>
      </section>

      <section className="audience-section" id="pentru-cine">
        <div><p className="landing-kicker">Un cont, contexte separate</p><h2>Aceleași două forme de lucru, pentru fiecare activitate.</h2><p>Poți avea un context de ridesharing și unul de delivery în același cont. În fiecare activitate alegi forma ta de lucru, iar calculele rămân separate.</p></div>
        <div className="audience-cards"><article><span>Ridesharing</span><h3>Angajat prin flotă</h3><p>Bolt, Uber sau ambele, cu CIM, comision de flotă și regularizare săptămânală.</p></article><article><span>Ridesharing</span><h3>Propriul SRL/PFA</h3><p>Costurile administrative și fiscale sunt configurate pentru entitatea ta, după validarea regulilor reale.</p></article><article><span>Delivery</span><h3>Angajat prin flotă</h3><p>Glovo, Wolt, Bolt Food sau alte platforme, într-un context calculat separat de ridesharing.</p></article><article><span>Delivery</span><h3>Propriul SRL/PFA</h3><p>Veniturile și cheltuielile delivery sunt păstrate separat, cu regulile entității tale.</p></article></div>
      </section>

      <section className="transparency-section"><div><p className="landing-kicker light">Calcule clare</p><h2>Automatizarea te ajută să introduci datele. Nu inventează rezultatul.</h2></div><div><p>Motorul financiar folosește formule deterministe. Importul din screenshot sau PDF va extrage și structura valorile, dar nimic nu intră în calcul până când nu confirmi.</p><p>Introducerea manuală rămâne permanent disponibilă.</p></div></section>


      <section className="support-section" id="suport">
        <div className="support-copy">
          <p className="landing-kicker">Suport și contact</p>
          <h2>Ai o întrebare, o problemă sau o idee?</h2>
          <p>Descrie cât mai clar ce s-a întâmplat. Mesajele utilizatorilor ne vor ajuta să corectăm problemele și să îmbunătățim ProfitExact.</p>
          <div className="support-channels">
            <article><span>Email suport</span><strong>support@profitexact.com</strong><small>Adresa va fi activată înainte de lansare.</small></article>
            <article><span>Telefon de contact</span><strong>Va fi adăugat ulterior</strong><small>Numărul oficial va apărea aici înainte de lansare.</small></article>
          </div>
        </div>


        <form className="support-form" onSubmit={prepareSupportMessage}>
          <label><span>Numele tău</span><input name="name" type="text" autoComplete="name" required /></label>
          <label><span>Email pentru răspuns</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="support-full"><span>Cu ce te putem ajuta?</span><select name="category" defaultValue="" required><option value="" disabled>Alege categoria</option><option>Cont și autentificare</option><option>Onboarding și configurare</option><option>Calcul sau rezultat</option><option>Problemă tehnică</option><option>Idee sau sugestie</option><option>Altceva</option></select></label>
          <label className="support-full"><span>Mesaj</span><textarea name="message" rows={6} minLength={20} placeholder="Spune-ne ce ai încercat și ce rezultat ai primit..." required /></label>
          <button className="landing-primary support-full" type="submit">Trimite mesajul</button>
          {supportNotice ? <p className="support-notice support-full" role="status">{supportNotice}</p> : null}
          <small className="support-privacy support-full">Nu include parola, codurile de verificare sau alte date sensibile.</small>
        </form>
      </section>

      <section className="final-cta"><p className="landing-kicker">Începe cu situația ta reală</p><h2>Configurează ProfitExact și vezi rezultatul exact după toate cheltuielile.</h2><p>14 zile de probă. Apoi 24,99 RON/lună.</p><button className="landing-primary" type="button" onClick={onCreateAccount}>Creează cont gratuit</button></section>

      <footer className="landing-footer"><a className="landing-brand" href="#sus"><BrandMark className="landing-brand-mark" /><span>ProfitExact</span></a><div className="footer-copy"><p>Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.</p><small>© 2026 ProfitExact — un produs MVG SOLUTIONS EXPRESS SRL. Toate drepturile rezervate.</small></div><span>România · RON</span></footer>
    </main>
  );
}
