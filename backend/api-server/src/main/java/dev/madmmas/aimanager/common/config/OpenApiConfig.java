package dev.madmmas.aimanager.common.config;

import dev.madmmas.aimanager.security.ApiKeyAuthenticationFilter;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 metadata and security schemes for springdoc. Spec is served at {@code /v3/api-docs};
 * Swagger UI at {@code /swagger-ui}.
 */
@Configuration
public class OpenApiConfig {

  public static final String API_KEY_SCHEME = "apiKey";
  public static final String BEARER_SCHEME = "bearerAuth";

  @Bean
  OpenAPI aiplaneOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("AIPlane API")
                .description(
                    "AIPlane modular monolith REST API (prompts, guardrails, users, usage, config). "
                        + "Browser sessions use httpOnly JWT cookies after `/auth/login`; "
                        + "programmatic clients use `X-API-Key` or `Authorization: Bearer aimg_…`.")
                .version("v1"))
        .components(
            new Components()
                .addSecuritySchemes(
                    API_KEY_SCHEME,
                    new SecurityScheme()
                        .name(ApiKeyAuthenticationFilter.API_KEY_HEADER)
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .description("API key (`aimg_…`) issued via `/api/v1/api-keys`."))
                .addSecuritySchemes(
                    BEARER_SCHEME,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("aimg_ API key or JWT")
                        .description(
                            "Prefer `X-API-Key` for API keys. Bearer also accepts `aimg_…` keys. "
                                + "Browser JWT auth uses httpOnly cookies, not this header.")))
        .addSecurityItem(new SecurityRequirement().addList(API_KEY_SCHEME))
        .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
  }
}
