"use client";

import { useEffect, useState } from "react";

interface Props {
  iso: string;
  className?: string;
}

export function LocalTime({ iso, className }: Props) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(
      new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }, [iso]);

  if (!formatted) return null;
  return <span className={className}>{formatted}</span>;
}
