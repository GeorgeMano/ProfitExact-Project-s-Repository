"use client";

import { tracksOdometer, vehicleShortNames, type OnboardingConfig } from "@/domain/onboarding";
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import type { SavedWorkDay } from "@/lib/finance/weekly-summary";
import {
  serviceKindLabels,
  serviceLog,
  serviceStatus,
  type DayServiceInfo,
  type ServiceStatus,
} from "@/lib/finance/vehicle-service";
import "./vehicle-journal.css";

const km = (value: number) => `${Math.round(value).toLocaleString("ro-RO")} km`;
const money = (value: number) =>
  value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
};

/** Zilele salvate (și intervențiile din totalurile de perioadă), în forma jurnalului. */
export function journalDays(days: SavedWorkDay[], periods: SavedManualPeriod[] = []): DayServiceInfo[] {
  const fromDays = days.map((day) => ({
    date: day.date,
    kilometers: day.kilometers,
    odometerKm: day.inputs?.odometerKm,
    serviceCost: day.inputs?.serviceCost,
    serviceKind: day.inputs?.serviceKind,
    serviceNote: day.inputs?.serviceNote,
  }));
  // Un total de săptămână sau lună are doar suma intervențiilor, fără detalii.
  // Kilometrii lui nu se adaugă la kilometraj: zilele aceleiași perioade îi au deja.
  const fromPeriods = periods
    .filter((period) => period.values.serviceCost > 0)
    .map((period) => ({
      date: period.endDate,
      kilometers: 0,
      serviceCost: period.values.serviceCost,
      serviceNote: period.periodType === "week" ? "Din totalul săptămânii" : "Din totalul lunii",
    }));
  return [...fromDays, ...fromPeriods];
}

function vehicleGenitive(config: OnboardingConfig) {
  return { car: "mașinii", moto: "scuterului", e_bike: "bicicletei electrice", bicycle: "bicicletei" }[config.vehicleType];
}

/** Textul alertei, scurt și direct. */
function alertText(status: ServiceStatus) {
  const parts: string[] = [];
  if (status.nextServiceKm !== null && status.kmLeft !== null) {
    parts.push(
      status.kmLeft < 0
        ? `Revizia trebuia făcută la ${km(status.nextServiceKm)}: ai depășit-o cu ${km(-status.kmLeft)}.`
        : `Urmează revizia la ${km(status.nextServiceKm)}: mai ai ${km(status.kmLeft)}.`,
    );
  }
  if (status.nextServiceDate && status.daysLeft !== null && (status.reason === "time" || status.reason === "both" || status.kmLeft === null)) {
    parts.push(
      status.daysLeft < 0
        ? `Termenul reviziei a trecut pe ${shortDate(status.nextServiceDate)}.`
        : `Termenul reviziei: ${shortDate(status.nextServiceDate)} (${status.daysLeft === 0 ? "azi" : status.daysLeft === 1 ? "mâine" : `peste ${status.daysLeft} zile`}).`,
    );
  }
  return parts.join(" ");
}

/** Varianta scurtă, sub cifra din jurnal: fără să repete kilometrajul. */
function remainingText(status: ServiceStatus) {
  const parts: string[] = [];
  if (status.kmLeft !== null) parts.push(status.kmLeft < 0 ? `Depășită cu ${km(-status.kmLeft)}` : `Mai ai ${km(status.kmLeft)}`);
  if (status.nextServiceDate && status.daysLeft !== null) {
    parts.push(status.daysLeft < 0 ? `termenul a trecut pe ${shortDate(status.nextServiceDate)}` : `termen ${shortDate(status.nextServiceDate)}`);
  }
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Banda roșie de sus, vizibilă pe orice ecran când revizia se apropie sau a trecut. */
export function ServiceAlert({ config, days, today }: { config: OnboardingConfig; days: DayServiceInfo[]; today: string }) {
  if (!tracksOdometer(config)) return null;
  const status = serviceStatus(config.vehicleService, days, today);
  if (status.level !== "soon" && status.level !== "overdue") return null;
  return (
    <div className={`service-alert ${status.level}`} role="alert">
      <strong>{status.level === "overdue" ? "Revizie depășită" : "Revizia se apropie"}</strong>
      <span>{alertText(status)}</span>
    </div>
  );
}

export function VehicleJournalCard({ config, days, today }: { config: OnboardingConfig; days: DayServiceInfo[]; today: string }) {
  const tracks = tracksOdometer(config);
  const status = tracks ? serviceStatus(config.vehicleService, days, today) : null;
  const log = serviceLog(tracks ? config.vehicleService : undefined, days);
  const year = today.slice(0, 4);
  const spentThisYear = log.filter((entry) => entry.date.startsWith(year)).reduce((total, entry) => total + entry.cost, 0);
  const alert = status && (status.level === "soon" || status.level === "overdue");

  return (
    <section className={`journal-card ${alert ? "alert" : ""}`} aria-labelledby="jurnal-titlu">
      <div className="card-heading">
        <div>
          <p className="eyebrow">{tracks ? "Service" : "Reparații"}</p>
          <h2 id="jurnal-titlu">{tracks ? `Cartea de service a ${vehicleGenitive(config)}` : `Reparațiile ${vehicleGenitive(config)}`}</h2>
        </div>
        <span>{log.length === 1 ? "1 intervenție" : `${log.length} intervenții`}</span>
      </div>

      {status ? (
        <dl className="journal-status">
          <div>
            <dt>Kilometraj</dt>
            <dd>
              {status.estimatedKm !== null ? km(status.estimatedKm) : "—"}
              {status.estimatedKm !== null && status.kmSinceReading > 0 ? <small>estimat: citirea din {shortDate(status.lastReadingDate!)} + {km(status.kmSinceReading)} de lucru</small> : null}
            </dd>
          </div>
          <div className={alert ? "danger" : ""}>
            <dt>Următoarea revizie</dt>
            <dd>
              {status.nextServiceKm !== null ? km(status.nextServiceKm) : status.nextServiceDate ? shortDate(status.nextServiceDate) : "—"}
              {status.level !== "unknown" ? <small>{remainingText(status)}</small> : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {status && status.estimatedKm === null ? (
        <p className="journal-hint">Trece kilometrajul de la bord într-o zi (la „Activitatea zilei”) sau la configurare, ca să știi când urmează revizia.</p>
      ) : status && status.level === "unknown" ? (
        <p className="journal-hint">Adaugă intervalul de revizie din „Modifică configurarea” ca să primești alerta.</p>
      ) : null}

      {log.length === 0 ? (
        <p className="journal-empty">
          Nicio intervenție încă. Când ai o revizie sau o reparație, bifeaz-o la „Cheltuieli apărute azi”: costul intră în calculul zilei și rămâne aici.
        </p>
      ) : (
        <>
          <ol className="journal-list">
            {log.slice(0, 12).map((entry, index) => (
              <li key={`${entry.date}-${index}`}>
                <div>
                  <strong>{serviceKindLabels[entry.kind]}</strong>
                  {entry.note ? <span>{entry.note}</span> : null}
                  <small>
                    {shortDate(entry.date)}
                    {tracks && entry.odometerKm !== null ? ` · ${entry.odometerEstimated ? "≈ " : ""}${km(entry.odometerKm)}` : ""}
                  </small>
                </div>
                <b>{money(entry.cost)} RON</b>
              </li>
            ))}
          </ol>
          <p className="journal-total">
            <span>Cheltuit pe {vehicleShortNames[config.vehicleType]} în {year}</span>
            <strong>{money(spentThisYear)} RON</strong>
          </p>
        </>
      )}
    </section>
  );
}
