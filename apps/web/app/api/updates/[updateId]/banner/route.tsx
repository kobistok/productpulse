import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Extract section headlines from the update's markdown content
function extractHeadlines(content: string): string[] {
  return content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((section) => {
      const stripped = section
        .replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "")
        .trimStart();
      const firstLine = stripped.split("\n")[0].trim();
      const m = firstLine.match(/^\*\*(.+?)\*\*$/);
      const raw = m ? m[1] : firstLine;
      // Remove inline code ticks
      return raw.replace(/`([^`]+)`/g, "$1");
    })
    .filter((h) => h.length > 2)
    .slice(0, 5);
}

const TEAL = "#2dd4bf";
const BG = "#0a0a0a";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;

  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return new Response("No org", { status: 403 });

  const update = await prisma.update.findFirst({
    where: { id: updateId, productLine: { orgId } },
    include: { productLine: { select: { name: true } } },
  });
  if (!update) return new Response("Not found", { status: 404 });

  const headlines = extractHeadlines(update.content);
  const name = update.productLine.name;
  const week = update.isoWeek;
  const year = update.year;

  // Clamp product name for display
  const displayName = name.length > 30 ? name.slice(0, 28) + "…" : name;
  const nameFontSize = name.length > 22 ? 34 : 42;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 400,
          display: "flex",
          background: BG,
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ── Left content column ───────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "44px 52px",
          }}
        >
          {/* Header: brand + week pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 26,
            }}
          >
            {/* Syncop wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <svg width="24" height="24" viewBox="0 0 32 32">
                <rect width="32" height="32" rx="7" fill="#18181b" />
                <polyline
                  points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Syncop
              </span>
            </div>

            {/* Week pill */}
            <div
              style={{
                display: "flex",
                background: "rgba(45,212,191,0.08)",
                border: "1px solid rgba(45,212,191,0.22)",
                borderRadius: 100,
                padding: "5px 14px",
              }}
            >
              <span
                style={{ color: TEAL, fontSize: 12, fontWeight: 600 }}
              >
                Week {week} · {year}
              </span>
            </div>
          </div>

          {/* "Product Update" label */}
          <div
            style={{
              display: "flex",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: TEAL,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Product Update
          </div>

          {/* Product name */}
          <div
            style={{
              display: "flex",
              fontSize: nameFontSize,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginBottom: 22,
            }}
          >
            {displayName}
          </div>

          {/* Separator */}
          <div
            style={{
              display: "flex",
              height: 1,
              background: "rgba(255,255,255,0.07)",
              marginBottom: 18,
            }}
          />

          {/* Highlights */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {(headlines.length > 0
              ? headlines
              : ["Product update available"]
            )
              .slice(0, 4)
              .map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  {/* Teal dot */}
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: TEAL,
                      marginTop: 7,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.68)",
                      lineHeight: 1.5,
                    }}
                  >
                    {h.length > 70 ? h.slice(0, 68) + "…" : h}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* ── Right decoration column ───────────────────────── */}
        <div
          style={{
            width: 390,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
            borderLeft: "1px solid rgba(255,255,255,0.04)",
            overflow: "hidden",
          }}
        >
          {/* Ambient radial glow */}
          <div
            style={{
              position: "absolute",
              width: 340,
              height: 340,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(45,212,191,0.09) 0%, transparent 68%)",
              display: "flex",
              top: 30,
              left: 25,
            }}
          />

          {/* Concentric rings */}
          <div
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              border: "1px solid rgba(45,212,191,0.06)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: "50%",
              border: "1px solid rgba(45,212,191,0.1)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 168,
              height: 168,
              borderRadius: "50%",
              border: "1px solid rgba(45,212,191,0.16)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 104,
              height: 104,
              borderRadius: "50%",
              border: "2px solid rgba(45,212,191,0.22)",
              display: "flex",
            }}
          />

          {/* Center icon */}
          <div
            style={{
              position: "absolute",
              width: 60,
              height: 60,
              borderRadius: 14,
              background: "rgba(45,212,191,0.1)",
              border: "1px solid rgba(45,212,191,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="36" height="22" viewBox="0 0 32 20">
              <polyline
                points="0,10 5,10 7.5,3 11,17 14,1 17,17 20.5,3 23,10 28,10 32,10"
                fill="none"
                stroke={TEAL}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Update count badge */}
          <div
            style={{
              position: "absolute",
              bottom: 28,
              right: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "rgba(45,212,191,0.2)",
                lineHeight: 1,
              }}
            >
              {headlines.length > 0 ? headlines.length : "—"}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "rgba(45,212,191,0.25)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {headlines.length === 1 ? "update" : "updates"}
            </span>
          </div>

          {/* Dot grid (top-left of decoration panel) */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                style={{ display: "flex", gap: 8 }}
              >
                {[0, 1, 2, 3].map((col) => (
                  <div
                    key={col}
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      background: `rgba(45,212,191,${0.08 + (row + col) * 0.02})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 400,
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
