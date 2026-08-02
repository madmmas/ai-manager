# API contracts (OpenAPI)

Frozen OpenAPI 3 specs for AIPlane backend modules that expose a springdoc surface.
External consumers can use these files without running the stack.

| File | Module | Live docs (local) |
|------|--------|-------------------|
| [`api-server.yaml`](./api-server.yaml) | `backend/api-server` | http://localhost:8080/v3/api-docs.yaml · UI: `/swagger-ui` |

`config-server` is **not** listed — it is Spring Cloud Config, not part of this REST catalog.

## Generate-then-freeze

Specs are **generated from annotated controllers** (springdoc), not hand-authored:

```bash
make openapi
# → backend/scripts/generate-openapi.sh (Docker required for Testcontainers)
```

CI / `mvn verify` fails if the live `/v3/api-docs.yaml` differs from the committed file.
When you change controllers or DTOs, run `make openapi` and commit the YAML update in the same PR.

See `docs/MICROSERVICES_PLAN.md` §5. As services are extracted, add `docs/api/<service>.yaml` the same way.
