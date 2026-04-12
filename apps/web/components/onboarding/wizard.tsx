"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  ArrowUpRight,
  LayoutGrid,
  Sparkles,
  GitBranch,
  Users,
  BookOpen,
} from "lucide-react";
import type { CompletedSteps, OnboardingData } from "./provider";

interface Step {
  id: keyof CompletedSteps;
  title: string;
  description: string;
  action: string;
  href: (data: OnboardingData) => string;
  icon: React.ElementType;
  optional?: boolean;
}

export const ONBOARDING_STEPS: Step[] = [
  {
    id: "productLine",
    title: "Create your first product line",
    description:
      "A product line represents a product area your team owns — like 'Checkout', 'Auth', or 'Mobile App'. Syncop tracks Git activity and generates weekly updates for each one.",
    action: "Create product line",
    href: () => "/product-lines/new",
    icon: LayoutGrid,
  },
  {
    id: "agent",
    title: "Configure your AI agent",
    description:
      "Add product context to help the AI understand what matters. Tell it the tech stack, what to focus on, and what to skip. This dramatically improves update quality.",
    action: "Configure agent",
    href: (data) =>
      data.firstProductLineId
        ? `/product-lines/${data.firstProductLineId}/agent`
        : "/product-lines",
    icon: Sparkles,
  },
  {
    id: "gitTrigger",
    title: "Connect your Git repository",
    description:
      "Copy your webhook URL into GitHub or GitLab. Every push will automatically trigger the agent to analyze commits and generate your weekly product status.",
    action: "Set up webhook",
    href: (data) =>
      data.firstProductLineId
        ? `/product-lines/${data.firstProductLineId}/triggers`
        : "/product-lines",
    icon: GitBranch,
  },
  {
    id: "team",
    title: "Invite your team",
    description:
      "Add your product managers, engineering leads, or stakeholders. Team members can view updates, share dashboards, and collaborate on product line setup.",
    action: "Go to settings",
    href: () => "/settings",
    icon: Users,
    optional: true,
  },
  {
    id: "zendesk",
    title: "Connect Zendesk",
    description:
      "Syncop can automatically create and update knowledge base articles in Zendesk whenever your product changes — keeping your docs in sync without any manual effort.",
    action: "Connect Zendesk",
    href: () => "/settings",
    icon: BookOpen,
    optional: true,
  },
];

interface Props {
  onClose: () => void;
  data: OnboardingData;
}

export function OnboardingWizard({ onClose, data }: Props) {
  const completedCount = Object.values(data.completed).filter(Boolean).length;
  const allDone = completedCount === ONBOARDING_STEPS.length;

  const firstIncompleteIdx = ONBOARDING_STEPS.findIndex(
    (s) => !data.completed[s.id]
  );
  const [activeIdx, setActiveIdx] = useState(
    firstIncompleteIdx === -1 ? ONBOARDING_STEPS.length - 1 : firstIncompleteIdx
  );

  const activeStep = ONBOARDING_STEPS[activeIdx];
  const isActiveCompleted = data.completed[activeStep.id];
  const Icon = activeStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "min(680px, calc(100vh - 2rem))" }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-zinc-100 shrink-0">
          <div
            className="h-full bg-zinc-900 transition-all duration-500"
            style={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Getting started with Syncop
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {allDone
                ? "You've completed all steps — you're all set!"
                : `${completedCount} of ${ONBOARDING_STEPS.length} steps complete`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors ml-4 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: step list */}
          <div className="w-52 shrink-0 bg-zinc-50 border-r border-zinc-100 overflow-y-auto">
            {ONBOARDING_STEPS.map((step, idx) => {
              const done = data.completed[step.id];
              const active = idx === activeIdx;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-zinc-100/70 last:border-0 ${
                    active ? "bg-white" : "hover:bg-zinc-100/70"
                  }`}
                >
                  {/* Circle indicator */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                      done
                        ? "bg-zinc-900 text-white"
                        : active
                        ? "ring-2 ring-zinc-900 ring-offset-1 bg-white text-zinc-700"
                        : "bg-zinc-200 text-zinc-400"
                    }`}
                  >
                    {done ? <Check size={10} strokeWidth={3} /> : idx + 1}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium leading-snug ${
                        active
                          ? "text-zinc-900"
                          : done
                          ? "text-zinc-400 line-through"
                          : "text-zinc-600"
                      }`}
                    >
                      {step.title}
                    </p>
                    {step.optional && (
                      <span className="text-[10px] text-zinc-400">Optional</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: step content */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {allDone ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
                <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center mb-5">
                  <Check size={26} className="text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900">
                  You're all set!
                </h3>
                <p className="text-sm text-zinc-500 mt-2 max-w-xs leading-relaxed">
                  Syncop is fully configured. Your agent will start generating
                  updates automatically on the next Git push.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Go to dashboard
                </button>
              </div>
            ) : (
              <div className="flex flex-col h-full p-8">
                <div className="flex-1">
                  {/* Icon */}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center mb-6 ${
                      isActiveCompleted ? "bg-green-50" : "bg-zinc-100"
                    }`}
                  >
                    {isActiveCompleted ? (
                      <Check size={20} className="text-green-600" />
                    ) : (
                      <Icon size={20} className="text-zinc-600" />
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                      Step {activeIdx + 1} of {ONBOARDING_STEPS.length}
                    </span>
                    {activeStep.optional && (
                      <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                    {isActiveCompleted && (
                      <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-semibold text-zinc-900 mb-3">
                    {activeStep.title}
                  </h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    {activeStep.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-8 pt-6 border-t border-zinc-100">
                  <Link
                    href={activeStep.href(data)}
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    {activeStep.action}
                    <ArrowUpRight size={14} />
                  </Link>

                  {activeIdx < ONBOARDING_STEPS.length - 1 && (
                    <button
                      onClick={() => setActiveIdx(activeIdx + 1)}
                      className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      Skip this step →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
