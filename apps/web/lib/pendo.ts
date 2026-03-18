const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "18b7acfc-bf6b-4d4f-b985-8c5cfea543c9";

export async function pendoTrackServer({
  event,
  visitorId,
  accountId,
  properties,
}: {
  event: string;
  visitorId: string;
  accountId: string;
  properties?: Record<string, string | number | boolean>;
}) {
  try {
    await fetch(PENDO_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties,
      }),
    });
  } catch {
    console.error(`[Pendo] Failed to track event: ${event}`);
  }
}
