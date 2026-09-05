"use client";

import { useEffect, useState } from "react";
import type { OnboardingConfig } from "@/domain/onboarding";
import { AccountCreation } from "./account-creation";
import { DailyCalculator } from "./daily-calculator";
import { LandingPage } from "./landing-page";
import { OnboardingFlow } from "./onboarding-flow";
import "./welcome-flow.css";

type AppStage = "landing" | "account" | "onboarding" | "calculator";

export function ProfitExactApp() {
  const [stage, setStage] = useState<AppStage>("landing");
  const [config, setConfig] = useState<OnboardingConfig | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  if (stage === "landing") {
    return <LandingPage onCreateAccount={() => setStage("account")} />;
  }

  if (stage === "account") {
    return <AccountCreation onBack={() => setStage("landing")} onContinue={() => setStage("onboarding")} />;
  }

  if (stage === "onboarding" || !config) {
    return <OnboardingFlow onComplete={(nextConfig) => { setConfig(nextConfig); setStage("calculator"); }} />;
  }

  return <DailyCalculator config={config} onEditOnboarding={() => setStage("onboarding")} />;
}
