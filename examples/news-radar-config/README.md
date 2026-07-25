# News Radar Config Server example

Minimal Go client that GETs a Spring Cloud Config **Environment** from AIPlane’s
config-server and prints `aiplane.prompts.*` keys. Stdlib `net/http` only.

Full walkthrough (architecture, promote steps, refresh proxy):  
[`docs/integrations/news-radar-config-server.md`](../../docs/integrations/news-radar-config-server.md).

## Prerequisites

- Go 1.22+
- AIPlane stack with `CONFIG_MODE=jdbc`, api-server + config-server + Postgres
- At least one prompt promoted to **Active** for the target project slug

## Run

```bash
# Defaults: -url http://localhost:8888 -app news-radar -profile default
go run .

# Explicit label (same as jdbc default-label: main)
go run . -app news-radar -profile default -label main
```

## Curl equivalents

```bash
./demo.sh
# or:
curl -fsS "http://localhost:8888/news-radar/default" | jq '.propertySources[].source | with_entries(select(.key | startswith("aiplane.prompts.")))'
```

Optional refresh via API Server (API key with `config:refresh`):

```bash
curl -X POST "http://localhost:8080/api/v1/config/refresh/news-radar" \
  -H "Authorization: Bearer $AIPLANE_API_KEY"
```
