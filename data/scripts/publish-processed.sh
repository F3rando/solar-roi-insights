#!/usr/bin/env bash
# Sync local public/processed/v1/ → S3 so API Gateway + Lambda serve fresh JSON.
# Requires: AWS CLI configured (`aws configure`), same account/credentials as the bucket.
#
# Usage:
#   export S3_METRICS_BUCKET=your-bucket-name   # must match Lambda DATA_BUCKET
#   npm run data:publish
#
# Optional extra args passed through to `aws s3 sync` (e.g. --dryrun):
#   npm run data:publish -- --dryrun

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="${REPO_ROOT}/public/processed/v1"

# Load shell vars (optional): prefer .env.publish for S3-only; otherwise .env.local next to Vite vars.
# Temporarily turn off nounset while sourcing — .env files often use optional expansions.
_env_load() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set +u
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  set -u
}
_env_load "$REPO_ROOT/.env.publish"
_env_load "$REPO_ROOT/.env.local"

# Fallback if sourcing missed (CRLF, etc.): read S3_METRICS_BUCKET= line literally
if [[ -z "${S3_METRICS_BUCKET:-}" ]]; then
  for f in "$REPO_ROOT/.env.publish" "$REPO_ROOT/.env.local"; do
    [[ -f "$f" ]] || continue
    line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?S3_METRICS_BUCKET=' "$f" | tail -1)" || true
    if [[ -n "${line:-}" ]]; then
      line="${line#export }"
      S3_METRICS_BUCKET="${line#S3_METRICS_BUCKET=}"
      S3_METRICS_BUCKET="${S3_METRICS_BUCKET//$'\r'/}"
      S3_METRICS_BUCKET="${S3_METRICS_BUCKET%\"}"
      S3_METRICS_BUCKET="${S3_METRICS_BUCKET#\"}"
      export S3_METRICS_BUCKET
      break
    fi
  done
fi

if [[ ! -d "$SOURCE" ]]; then
  echo "Missing ${SOURCE}. Run the ETL first." >&2
  exit 1
fi

if [[ -z "${S3_METRICS_BUCKET:-}" ]]; then
  echo "Error: Set S3_METRICS_BUCKET to the S3 bucket your Lambda reads from (processed/v1/)." >&2
  echo "Example: export S3_METRICS_BUCKET=my-team-metrics-bucket" >&2
  exit 1
fi

DEST="s3://${S3_METRICS_BUCKET}/processed/v1/"
echo "Publishing:"
echo "  ${SOURCE}/"
echo "  → ${DEST}"
exec aws s3 sync "${SOURCE}/" "${DEST}" "$@"
