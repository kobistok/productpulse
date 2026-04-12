"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { OnboardingWizard } from "./wizard";

export interface CompletedSteps {
  productLine: boolean;
  agent: boolean;
  gitTrigger: boolean;
  team: boolean;
  zendesk: boolean;
}

export interface OnboardingData {
  orgId: string;
  completed: CompletedSteps;
  firstProductLineId: string | null;
}

interface OnboardingContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  data: OnboardingData;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: OnboardingData;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "1") {
      setIsOpen(true);
      params.delete("onboarding");
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
      return;
    }

    const dismissed = localStorage.getItem(`syncop-onboarding-${data.orgId}`);
    if (!dismissed && !data.completed.productLine) {
      setIsOpen(true);
    }
  }, [data.orgId, data.completed.productLine]);

  const open = () => setIsOpen(true);
  const close = () => {
    setIsOpen(false);
    localStorage.setItem(`syncop-onboarding-${data.orgId}`, "1");
  };

  return (
    <OnboardingContext.Provider value={{ open, close, isOpen, data }}>
      {children}
      {isOpen && <OnboardingWizard onClose={close} data={data} />}
    </OnboardingContext.Provider>
  );
}
