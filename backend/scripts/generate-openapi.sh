#!/usr/bin/env bash
# Regenerate frozen OpenAPI YAML under docs/api/ from springdoc (generate-then-freeze).
# Requires JDK 21+, Maven, and Docker (Testcontainers Postgres for api-server).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS_API="${ROOT}/docs/api"

export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 21 2>/dev/null || true)}"
if [[ -z "${JAVA_HOME}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  echo "error: JAVA_HOME must point at JDK 21+" >&2
  exit 1
fi

mkdir -p "${DOCS_API}"

echo "Generating docs/api/api-server.yaml from springdoc (Testcontainers)…"
mvn -f "${ROOT}/backend/pom.xml" -pl api-server -am -B verify \
  -Dtest=none \
  -Dit.test=OpenApiIT \
  -Dopenapi.export=true \
  -Dopenapi.docs.dir="${DOCS_API}" \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dfailsafe.failIfNoSpecifiedTests=false

echo "Wrote ${DOCS_API}/api-server.yaml"
echo "Commit the updated YAML when the API contract change is intentional."
