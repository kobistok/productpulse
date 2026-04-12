"use client";

import { useState } from "react";
import { X, Download, Check, Copy, ImageIcon } from "lucide-react";

interface Props {
  updateId: string;
  productLineName: string;
  week: number;
  year: number;
  onClose: () => void;
}

export function UpdateBannerModal({
  updateId,
  productLineName,
  week,
  year,
  onClose,
}: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const bannerUrl = `/api/updates/${updateId}/banner`;
  const filename = `syncop-update-${productLineName.toLowerCase().replace(/\s+/g, "-")}-w${week}-${year}.png`;

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(bannerUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(
      `${window.location.origin}${bannerUrl}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <ImageIcon size={15} className="text-zinc-400" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Newsletter Banner
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {productLineName} · Week {week}, {year}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Banner preview */}
        <div className="px-6 pt-5">
          <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
            {/* Loading skeleton */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400">
                  <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin" />
                  <span className="text-xs">Generating banner…</span>
                </div>
              </div>
            )}

            {imageError ? (
              <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">
                Failed to generate banner.
              </div>
            ) : (
              <img
                src={bannerUrl}
                alt={`Banner for ${productLineName} Week ${week}`}
                className={`w-full transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                style={{ aspectRatio: "3 / 1" }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </div>

        {/* Usage hint */}
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2">
          <span className="text-xs text-zinc-500">
            1200 × 400 px · PNG · Optimised for email newsletters, Slack, and
            customer updates
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-5">
          <button
            onClick={handleDownload}
            disabled={downloading || !imageLoaded}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            {downloading ? "Downloading…" : "Download PNG"}
          </button>

          <button
            onClick={handleCopyUrl}
            disabled={!imageLoaded}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 text-sm font-medium rounded-lg text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-600" />
                <span className="text-green-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy URL
              </>
            )}
          </button>

          <p className="ml-auto text-xs text-zinc-400">
            URL requires login to access
          </p>
        </div>
      </div>
    </div>
  );
}
