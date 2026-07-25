#!/usr/bin/env bash
# Curl-based smoke demo against local Config Server (and optional API refresh).
# See docs/integrations/news-radar-config-server.md for the full promote → fetch flow.
set -euo pipefail

CONFIG_URL="${CONFIG_URL:-http://localhost:8888}"
APP="${APP:-news-radar}"
PROFILE="${PROFILE:-default}"
API_URL="${API_URL:-http://localhost:8080}"

echo "==> GET ${CONFIG_URL}/${APP}/${PROFILE}"
curl -fsS "${CONFIG_URL}/${APP}/${PROFILE}" | {
  if command -v jq >/dev/null 2>&1; then
    jq '{
      name,
      profiles,
      label,
      promptKeys: [
        .propertySources[]?.source
        | to_entries[]
        | select(.key | startswith("aiplane.prompts."))
        | {key: .key, value: .value}
      ]
    }'
  else
    cat
  fi
}

if [[ -n "${AIPLANE_API_KEY:-}" ]]; then
  echo
  echo "==> POST ${API_URL}/api/v1/config/refresh/${APP} (config:refresh)"
  curl -fsS -X POST "${API_URL}/api/v1/config/refresh/${APP}" \
    -H "Authorization: Bearer ${AIPLANE_API_KEY}"
  echo
else
  echo
  echo "(skip refresh) set AIPLANE_API_KEY to exercise POST /api/v1/config/refresh/{application}"
fi
