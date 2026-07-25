package dev.madmmas.aimanager.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.madmmas.aimanager.security.ApiKeyAuthenticationFilter;
import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
class ApiKeyControllerIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_ackloop";
  private static final RequestPostProcessor ADMIN = user("admin").roles("ADMIN");

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void createReturnsRawKeyOnceListHidesItAndRevokeStopsAuth() throws Exception {
    String name = "ingest-" + System.nanoTime();

    MvcResult created =
        mockMvc
            .perform(
                post("/api/v1/api-keys")
                    .with(ADMIN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "projectId": "%s",
                          "name": "%s",
                          "scopes": ["usage:write", "usage:read"]
                        }
                        """
                            .formatted(PROJECT_ID, name)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.prefix").value(startsWith("aimg_")))
            .andExpect(jsonPath("$.key").value(startsWith("aimg_")))
            .andExpect(jsonPath("$.scopes[0]").value("usage:write"))
            .andReturn();

    JsonNode body = objectMapper.readTree(created.getResponse().getContentAsString());
    String id = body.get("id").asText();
    String rawKey = body.get("key").asText();
    String prefix = body.get("prefix").asText();

    assertThat(rawKey).startsWith(prefix);
    assertThat(ApiKeyHasher.sha256Hex(rawKey))
        .isEqualTo(
            jdbcTemplate.queryForObject(
                "SELECT key_hash FROM api_keys WHERE id = ?", String.class, id));

    mockMvc
        .perform(get("/api/v1/api-keys").with(ADMIN).param("projectId", PROJECT_ID))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.id == '%s')].key".formatted(id)).isEmpty())
        .andExpect(jsonPath("$[?(@.id == '%s')].prefix".formatted(id)).value(prefix));

    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ingestBody()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.accepted").value(1));

    mockMvc
        .perform(delete("/api/v1/api-keys/" + id).with(ADMIN))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ingestBody()))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void createRejectsUnknownScope() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/api-keys")
                .with(ADMIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "projectId": "%s",
                      "name": "bad-scope-%s",
                      "scopes": ["usage:write", "admin:all"]
                    }
                    """
                        .formatted(PROJECT_ID, System.nanoTime())))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(containsString("Unknown scope")));
  }

  @Test
  void apiKeyWithUsageWriteCanIngestWithoutJwt() throws Exception {
    String rawKey = createKeyAsAdmin("[\"usage:write\"]");

    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ingestBody()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.accepted").value(1));
  }

  @Test
  void apiKeyWithoutUsageWriteIsForbiddenOnIngest() throws Exception {
    String rawKey = createKeyAsAdmin("[\"usage:read\"]");

    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ingestBody()))
        .andExpect(status().isForbidden());
  }

  @Test
  void apiKeyWithUsageReadCanReadSummary() throws Exception {
    String rawKey = createKeyAsAdmin("[\"usage:read\"]");

    mockMvc
        .perform(
            get("/api/v1/usage/summary")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey)
                .param("projectId", PROJECT_ID)
                .param("period", "7d"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalRequests").exists());
  }

  @Test
  @WithMockUser(roles = "DEVELOPER")
  void jwtDeveloperCannotManageApiKeys() throws Exception {
    mockMvc
        .perform(get("/api/v1/api-keys").param("projectId", PROJECT_ID))
        .andExpect(status().isForbidden());
  }

  private String createKeyAsAdmin(String scopesJson) throws Exception {
    MvcResult created =
        mockMvc
            .perform(
                post("/api/v1/api-keys")
                    .with(ADMIN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "projectId": "%s",
                          "name": "key-%s",
                          "scopes": %s
                        }
                        """
                            .formatted(PROJECT_ID, System.nanoTime(), scopesJson)))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(created.getResponse().getContentAsString()).get("key").asText();
  }

  private static String ingestBody() {
    return """
        {
          "events": [
            {
              "projectId": "%s",
              "provider": "openai",
              "model": "gpt-4o-mini",
              "status": "success",
              "inputTokens": 1,
              "outputTokens": 1,
              "latencyMs": 10
            }
          ]
        }
        """
        .formatted(PROJECT_ID);
  }
}
