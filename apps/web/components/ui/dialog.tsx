"use client";

import { useEffect } from "react";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm mx-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className={confirmVariant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
          >
            {loading ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
