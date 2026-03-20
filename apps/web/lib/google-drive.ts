import { prisma } from "./db";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

export interface DriveDoc {
  id: string;
  name: string;
  content: string;
}

async function refreshAccessToken(orgId: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google token");

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.googleDriveConfig.update({
    where: { orgId },
    data: { accessToken: data.access_token, expiresAt },
  });

  return data.access_token;
}

async function getValidAccessToken(orgId: string): Promise<string | null> {
  const config = await prisma.googleDriveConfig.findUnique({ where: { orgId } });
  if (!config) return null;

  // 60s buffer so we don't use a token that's about to expire
  if (new Date(Date.now() + 60_000) < config.expiresAt) {
    return config.accessToken;
  }

  try {
    return await refreshAccessToken(orgId, config.refreshToken);
  } catch {
    return null;
  }
}

// Build search queries from the output title.
// Produces: full title + adjacent word pairs (length > 3) — deduped, max 5.
function buildSearchQueries(title: string): string[] {
  const queries: string[] = [title.trim()];
  const words = title.trim().split(/[\s\-–:,/]+/).filter((w) => w.length > 3);
  for (let i = 0; i < words.length - 1; i++) {
    queries.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...new Set(queries)].slice(0, 5);
}

export async function searchGoogleDrive(orgId: string, title: string): Promise<DriveDoc[]> {
  const accessToken = await getValidAccessToken(orgId);
  if (!accessToken) return [];

  const queries = buildSearchQueries(title);
  // Map of fileId → name, preserves insertion order for ranking
  const found = new Map<string, string>();

  for (const query of queries) {
    if (found.size >= 5) break;
    try {
      const q = `fullText contains '${query.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`;
      const url = `${FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) continue;

      const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
      for (const file of data.files ?? []) {
        if (!found.has(file.id)) found.set(file.id, file.name);
      }
    } catch {
      continue;
    }
  }

  // Fetch plain-text content for each unique doc
  const docs: DriveDoc[] = [];
  for (const [fileId, name] of [...found.entries()].slice(0, 5)) {
    try {
      const exportUrl = `${FILES_URL}/${fileId}/export?mimeType=text/plain`;
      const res = await fetch(exportUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) continue;

      const text = await res.text();
      // Cap at 3 000 chars per doc to keep the prompt manageable
      docs.push({ id: fileId, name, content: text.slice(0, 3000) });
    } catch {
      continue;
    }
  }

  return docs;
}
