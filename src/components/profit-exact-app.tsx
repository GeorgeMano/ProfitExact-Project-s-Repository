"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { daysOfActivity, periodsOfActivity } from "@/lib/finance/activity";
import type { OnboardingConfig } from "@/domain/onboarding";
import {
  upsertManualPeriod,
  type SavedManualPeriod,
} from "@/lib/finance/manual-period";
import {
  upsertSavedWorkDay,
  type SavedWorkDay,
} from "@/lib/finance/weekly-summary";
import {
  clearPendingRegistration,
  readPendingRegistration,
  type PendingRegistration,
} from "@/lib/persistence/pending-registration";
import { useWorkspace } from "@/lib/persistence/use-workspace";
import { isDemoSignedOut, setDemoSignedOut, signOut } from "@/lib/auth/session";
import { AccountCreation } from "./account-creation";
import { DailyCalculator } from "./daily-calculator";
import { LandingPage } from "./landing-page";
import { OnboardingFlow } from "./onboarding-flow";
import { SignIn } from "./sign-in";
import "./welcome-flow.css";

type AppStage = "landing" | "account" | "signin" | "onboarding" | "calculator";

export function ProfitExactApp() {
  const { status, mode, snapshot, warnings, update, reset, reload } = useWorkspace();

  // Aplicația pornește mereu cu prima pagină. Dacă pe acest dispozitiv există
  // date salvate, prima pagină oferă „Continuă de unde ai rămas”, în loc să
  // sară direct în onboarding sau în calculator.
  const [stage, setStage] = useState<AppStage>("landing");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  // Unde duce „Continuă”: calculatorul dacă onboarding-ul e gata, altfel
  // onboarding-ul pentru un cont deja verificat. Fără date, nu există reluare.
  // O înregistrare începută și neterminată revine la pasul codului. Se
  // recitește când utilizatorul se întoarce pe prima pagină din formular.
  const [pendingVersion, setPendingVersion] = useState(0);
  const pendingRegistration = useMemo<PendingRegistration | null>(() => {
    if (status !== "ready") return null;
    // Un cont deja verificat nu mai are nimic de reluat la înregistrare.
    if (snapshot.config || snapshot.account?.verifiedAt) return null;
    return readPendingRegistration();
    // `pendingVersion` forțează recitirea din storage după revenirea pe prima pagină.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, snapshot.config, snapshot.account, pendingVersion]);

  // În modul de depanare local, „Ieși din cont” este reținut pe calculator:
  // datele rămân, dar reluarea cere o nouă conectare.
  const demoSignedOut = useMemo(
    () => status === "ready" && mode === "demo" && isDemoSignedOut(),
    // `pendingVersion` forțează recitirea după conectare sau ieșire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, mode, pendingVersion],
  );

  const resumeStage: AppStage | null = demoSignedOut
    ? null
    : snapshot.config
    ? "calculator"
    : snapshot.account?.verifiedAt
      ? "onboarding"
      : pendingRegistration
        ? "account"
        : null;
  // „Creează cont” pornește întotdeauna de la zero; „Continuă” reia pasul.
  const [resumingRegistration, setResumingRegistration] = useState(false);

  // După confirmarea emailului există o sesiune nouă: datele se recitesc ca
  // salvarea să meargă de acum în contul real, nu în locul de dinainte.
  const completeAccount = useCallback(
    async (account: { email: string }) => {
      setDemoSignedOut(false);
      await reload();
      update((current) => ({
        ...current,
        account: current.account ?? {
          email: account.email,
          phone: "",
          verifiedAt: new Date().toISOString(),
        },
      }));
      setPendingVersion((version) => version + 1);
      setStage("onboarding");
    },
    [reload, update],
  );

  const completeSignIn = useCallback(async () => {
    const loaded = await reload();
    setPendingVersion((version) => version + 1);
    setStage(loaded.config ? "calculator" : loaded.account ? "onboarding" : "landing");
  }, [reload]);

  const leaveAccount = useCallback(async () => {
    await signOut();
    await reload();
    setPendingVersion((version) => version + 1);
    setStage("landing");
  }, [reload]);

  const completeOnboarding = useCallback(
    (config: OnboardingConfig) => {
      update((current) => ({ ...current, config }));
      setStage("calculator");
    },
    [update],
  );

  // Fiecare activitate își vede doar datele ei; celelalte rămân salvate.
  const activity = snapshot.config?.activity ?? "ridesharing";
  const activityDays = useMemo(
    () => daysOfActivity(snapshot.savedDays, activity),
    [snapshot.savedDays, activity],
  );
  const activityPeriods = useMemo(
    () => periodsOfActivity(snapshot.manualPeriods, activity),
    [snapshot.manualPeriods, activity],
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

  const deleteManualPeriod = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        manualPeriods: current.manualPeriods.filter((entry) => entry.id !== id),
      }));
    },
    [update],
  );

  const startOver = useCallback(() => {
    clearPendingRegistration();
    setDemoSignedOut(false);
    setPendingVersion((version) => version + 1);
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
        onCreateAccount={() => {
          setResumingRegistration(false);
          setStage("account");
        }}
        onSignIn={() => setStage("signin")}
        onResume={
          resumeStage
            ? () => {
                setResumingRegistration(resumeStage === "account");
                setStage(resumeStage);
              }
            : undefined
        }
      />
    );
  }

  if (stage === "account") {
    return (
      <AccountCreation
        resume={resumingRegistration ? pendingRegistration : null}
        onBack={() => {
          setPendingVersion((version) => version + 1);
          setStage("landing");
        }}
        onContinue={completeAccount}
        onSignIn={() => setStage("signin")}
      />
    );
  }

  if (stage === "signin") {
    return (
      <SignIn
        demoAccountEmail={mode === "demo" ? (snapshot.account?.email ?? null) : null}
        onBack={() => setStage("landing")}
        onCreateAccount={() => {
          setResumingRegistration(false);
          setStage("account");
        }}
        onSignedIn={completeSignIn}
      />
    );
  }

  if (stage === "onboarding" || !snapshot.config) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return (
    <DailyCalculator
      config={snapshot.config}
      savedDays={activityDays}
      manualPeriods={activityPeriods}
      persistenceMode={mode}
      persistenceWarnings={warnings}
      onSaveDay={saveDay}
      onSaveManualPeriod={saveManualPeriod}
      onDeleteManualPeriod={deleteManualPeriod}
      onEditOnboarding={() => setStage("onboarding")}
      onStartOver={startOver}
      onSignOut={leaveAccount}
    />
  );
}
