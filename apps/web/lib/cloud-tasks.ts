export interface AgentJob {
  triggerId?: string;
  productLineId: string;
  orgId: string;
  payload: unknown;
  targetIsoWeek?: number;
  targetYear?: number;
}

export async function enqueueAgentJob(job: AgentJob): Promise<void> {
  const tokenRes = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );
  if (!tokenRes.ok) throw new Error(`Metadata server error: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const project = process.env.GCP_PROJECT_ID!;
  const location = process.env.GCP_LOCATION ?? "us-central1";
  const queue = process.env.CLOUD_TASKS_QUEUE ?? "agent-jobs";
  const baseUrl = (process.env.WORKER_URL ?? "").replace(/\/$/, "");
  const workerUrl = baseUrl.startsWith("http") ? `${baseUrl}/api/worker/process` : `https://${baseUrl}/api/worker/process`;
  console.log("[cloud-tasks] workerUrl:", workerUrl);

  const res = await fetch(
    `https://cloudtasks.googleapis.com/v2/projects/${project}/locations/${location}/queues/${queue}/tasks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        task: {
          httpRequest: {
            httpMethod: "POST",
            url: workerUrl,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.WORKER_AUTH_TOKEN}`,
            },
            body: Buffer.from(JSON.stringify(job)).toString("base64"),
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Cloud Tasks API ${res.status}: ${detail}`);
  }
}
