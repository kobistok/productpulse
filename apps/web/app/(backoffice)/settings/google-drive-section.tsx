"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface GoogleDriveSectionProps {
  connected: boolean;
  email: string | null;
}

export function GoogleDriveSection({ connected: initialConnected, email: initialEmail }: GoogleDriveSectionProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [email, setEmail] = useState(initialEmail);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch("/api/google-drive", { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
      setEmail(null);
      setOpen(false);
    }
    setRemoving(false);
  }

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">Google Drive</p>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                connected
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
              }`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            When content agents generate outputs, relevant Drive docs are used to refine the result.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          {connected ? "Edit" : "Connect"}
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Google Drive</p>
                {connected && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Connected
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {connected ? (
                <>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 space-y-1">
                    <p className="text-xs text-zinc-500">Connected account</p>
                    <p className="text-sm font-medium text-zinc-900">{email}</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Content agents search your entire Drive for docs relevant to each generated output and use them to refine the content.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleRemove}
                      disabled={removing}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      {removing ? "Removing..." : "Remove integration"}
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { window.location.href = "/api/auth/google/authorize"; }}
                    >
                      Reconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-500">
                    Connect your Google account to let content agents search Drive for relevant docs and use them to improve generated KB articles and customer updates.
                  </p>
                  <p className="text-xs text-zinc-400">
                    Only read access to your Drive is requested. No files are modified.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-amber-800 font-medium mb-0.5">Heads up</p>
                    <p className="text-xs text-amber-700">
                      Google will show a &quot;This app isn&apos;t verified&quot; warning. This is expected for new integrations.
                      Click <strong>Advanced</strong> → <strong>Go to ProductPulse (unsafe)</strong> to continue. We&apos;ve submitted for verification and this warning will disappear once approved.
                    </p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => { window.location.href = "/api/auth/google/authorize"; }}
                    >
                      Connect Google Drive
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
