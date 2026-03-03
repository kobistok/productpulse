"use client";

import { useEffect } from "react";

interface PendoIdentifyProps {
  visitor: {
    id: string;
    email: string;
    full_name: string | null;
    avatarUrl: string | null;
    createdAt: string;
    role: string;
    orgId: string;
  };
  account: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  };
}

export function PendoIdentify({ visitor, account }: PendoIdentifyProps) {
  useEffect(() => {
    if (typeof pendo !== "undefined") {
      pendo.identify({
        visitor: {
          id: visitor.id,
          email: visitor.email,
          full_name: visitor.full_name ?? undefined,
          avatarUrl: visitor.avatarUrl ?? undefined,
          createdAt: visitor.createdAt,
          role: visitor.role,
          orgId: visitor.orgId,
        },
        account: {
          id: account.id,
          name: account.name,
          slug: account.slug,
          createdAt: account.createdAt,
        },
      });
    }
  }, [visitor, account]);

  return null;
}
