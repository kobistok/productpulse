#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Product Pulse — One-time GCP infrastructure setup
#
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export REGION=us-central1
#   bash infra/setup.sh
#
# Run this once from your local machine with gcloud authed as project owner.
# Idempotent — safe to re-run.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${REGION:=us-central1}"

echo "▶ Project : $PROJECT_ID"
echo "▶ Region  : $REGION"
echo ""

gcloud config set project "$PROJECT_ID"

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
echo "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudtasks.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  bigquery.googleapis.com \
  pubsub.googleapis.com \
  iam.googleapis.com

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create productpulse \
  --repository-format=docker \
  --location="$REGION" \
  --description="Product Pulse Docker images" \
  || true  # already exists is OK

# ── 3. Service Account ────────────────────────────────────────────────────────
echo "Creating service account..."
SA_EMAIL="productpulse-sa@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create productpulse-sa \
  --display-name="Product Pulse service account" \
  || true

# Grant required roles
for ROLE in \
  roles/cloudsql.client \
  roles/cloudtasks.enqueuer \
  roles/secretmanager.secretAccessor \
  roles/bigquery.dataEditor \
  roles/bigquery.jobUser \
  roles/pubsub.publisher \
  roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

# Allow Cloud Build to deploy to Cloud Run
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin" \
  --condition=None --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None --quiet

# ── 4. Cloud SQL ──────────────────────────────────────────────────────────────
echo "Creating Cloud SQL (PostgreSQL) instance..."
# db-f1-micro is cheapest for dev — upgrade to db-g1-small or higher for prod
gcloud sql instances create productpulse-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --no-assign-ip \
  || true

gcloud sql databases create productpulse \
  --instance=productpulse-db \
  || true

# Create DB user — change the password before running!
DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create productpulse \
  --instance=productpulse-db \
  --password="$DB_PASSWORD" \
  || true

echo ""
echo "⚠️  Cloud SQL user password (save this now):"
echo "   $DB_PASSWORD"
echo ""

# Build the DATABASE_URL using Unix socket format for Cloud Run
# (Cloud Run injects the socket at /cloudsql/<connection-name>)
CONN_NAME="$PROJECT_ID:$REGION:productpulse-db"
DATABASE_URL="postgresql://productpulse:${DB_PASSWORD}@localhost/productpulse?host=/cloudsql/${CONN_NAME}"

# ── 5. Secret Manager ─────────────────────────────────────────────────────────
echo "Creating Secret Manager secrets..."

create_secret() {
  local NAME=$1
  local VALUE=$2
  echo -n "$VALUE" | gcloud secrets create "$NAME" \
    --data-file=- \
    --replication-policy=automatic \
    || echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=-
}

create_secret "productpulse-database-url"        "$DATABASE_URL"
create_secret "productpulse-anthropic-key"        "${ANTHROPIC_API_KEY:-REPLACE_ME}"
create_secret "productpulse-firebase-client-email" "${FIREBASE_CLIENT_EMAIL:-REPLACE_ME}"
create_secret "productpulse-firebase-private-key"  "${FIREBASE_PRIVATE_KEY:-REPLACE_ME}"
create_secret "productpulse-worker-auth-token"     "$(openssl rand -hex 32)"

# ── 6. Cloud Tasks queue ──────────────────────────────────────────────────────
echo "Creating Cloud Tasks queue..."
gcloud tasks queues create agent-jobs \
  --location="$REGION" \
  --max-attempts=3 \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=3 \
  || true

# ── 7. Firestore (Native mode) ────────────────────────────────────────────────
echo "Initialising Firestore (Native mode)..."
gcloud firestore databases create \
  --location="$REGION" \
  || true

# ── 8. BigQuery dataset ───────────────────────────────────────────────────────
echo "Creating BigQuery dataset..."
bq --location="$REGION" mk \
  --dataset \
  --description="Product Pulse analytics" \
  "$PROJECT_ID:productpulse" \
  || true

bq mk \
  --table \
  --description="Agent decision log" \
  "$PROJECT_ID:productpulse.agent_events" \
  infra/bigquery/agent_events_schema.json \
  || true

# ── 9. Cloud Build trigger ────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Manual step: connect Cloud Build to your GitHub repo"
echo ""
echo "  1. Go to: https://console.cloud.google.com/cloud-build/triggers"
echo "  2. Click 'Connect Repository' → GitHub → authorise"
echo "  3. Create a trigger:"
echo "     - Event: Push to branch"
echo "     - Branch: ^main$"
echo "     - Config: cloudbuild.yaml (repo root)"
echo "     - Substitutions:"
echo "         _REGION = $REGION"
echo "         _CLOUDSQL_INSTANCE = productpulse-db"
echo "         NEXT_PUBLIC_FIREBASE_API_KEY = <your firebase web api key>"
echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo "✅  Infrastructure setup complete!"
echo ""
echo "Next: fill in missing secrets in Secret Manager:"
echo "  https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID"
