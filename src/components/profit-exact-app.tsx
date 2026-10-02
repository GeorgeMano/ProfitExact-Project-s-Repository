"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnboardingConfig } from "@/domain/onboarding";
import {
  upsertManualPeriod,
  type SavedManualPeriod,
} from "@/lib/finance/manual-period";
import {
  upsertSavedWorkDay,
  type SavedWorkDay,
} from "@/lib/finance/weekly-summary";
import { useWorkspace } from "@/lib/persistence/use-workspace";
import { AccountCreation } from "./account-creation";
import { DailyCalculator } from "./daily-calculator";
import { LandingPage } from "./landing-page";
import { OnboardingFlow } from "./onboarding-flow";
import "./welcome-flow.css";

type AppStage = "landing" | "account" | "onboarding" | "calculator";

export function ProfitExactApp() {
  const { status, mode, snapshot, warnings, update, reset } = useWorkspace();

  // Aplicația pornește mereu cu prima pagină. Dacă pe acest dispozitiv există
  // date salvate, prima pagină oferă „Continuă de unde ai rămas”, în loc să
  // sară direct în onboarding sau în calculator.
  const [stage, setStage] = useState<AppStage>("landing");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  // Unde duce „Continuă”: calculatorul dacă onboarding-ul e gata, altfel
  // onboarding-ul pentru un cont deja verificat. Fără date, nu există reluare.
  const resumeStage: AppStage | null = snapshot.config
    ? "calculator"
    : snapshot.account?.verifiedAt
      ? "onboarding"
      : null;

  const completeAccount = useCallback(
    (account: { email: string; phone: string }) => {
      update((current) => ({
        ...current,
        account: {
          email: account.email,
          phone: account.phone,
          verifiedAt: new Date().toISOString(),
        },
      }));
      setStage("onboarding");
    },
    [update],
  );

  const completeOnboarding = useCallback(
    (config: OnboardingConfig) => {
      update((current) => ({ ...current, config }));
      setStage("calculator");
    },
    [update],
  );

  const saveDay = useCallback(
    (day: SavedWorkDay) => {
      update((current) => ({
        ...current,
        savedDays: upsertSavedWorkDay(current.savedDays, day),
      }));
    },
    [update],
  );

  const saveManualPeriod = useCallback(
    (entry: SavedManualPeriod) => {
      update((current) => ({
        ...current,
        manualPeriods: upsertManualPeriod(current.manualPeriods, entry),
      }));
    },
    [update],
  );

  const startOver = useCallback(() => {
    reset();
    setStage("landing");
  }, [reset]);

  // Prima randare pe server și prima randare în browser trebuie să coincidă,
  // deci nu citim storage-ul înainte de montare.
  if (status === "loading") {
    return (
      <main
        aria-busy="true"
        style={{ display: "grid", placeItems: "center", minHeight: "60vh", opacity: 0.7 }}
      >
        <p>Se încarcă datele salvate…</p>
      </main>
    );
  }

  if (stage === "landing") {
    return (
      <LandingPage
        onCreateAccount={() => setStage("account")}
        onResume={resumeStage ? () => setStage(resumeStage) : undefined}
      />
    );
  }

  if (stage === "account") {
    return (
      <AccountCreation onBack={() => setStage("landing")} onContinue={completeAccount} />
    );
  }

  if (stage === "onboarding" || !snapshot.config) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return (
    <DailyCalculator
      config={snapshot.config}
      savedDays={snapshot.savedDays}
      manualPeriods={snapshot.manualPeriods}
      persistenceMode={mode}
      persistenceWarnings={warnings}
      onSaveDay={saveDay}
      onSaveManualPeriod={saveManualPeriod}
      onEditOnboarding={() => setStage("onboarding")}
      onStartOver={startOver}
    />
  );
}
