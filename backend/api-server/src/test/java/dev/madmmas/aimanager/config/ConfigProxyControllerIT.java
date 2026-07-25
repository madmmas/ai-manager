package dev.madmmas.aimanager.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.madmmas.aimanager.security.ApiKeyAuthenticationFilter;
import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
class ConfigProxyControllerIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_ackloop";
  private static final RequestPostProcessor ADMIN = user("admin").roles("ADMIN");

  static final MockWebServer CONFIG_SERVER;

  static {
    try {
      CONFIG_SERVER = new MockWebServer();
      CONFIG_SERVER.start();
    } catch (IOException e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  @AfterAll
  static void shutdownConfigServer() throws IOException {
    CONFIG_SERVER.shutdown();
  }

  @DynamicPropertySource
  static void registerConfigServerUrl(DynamicPropertyRegistry registry) {
    registry.add(
        "aiplane.config-server.base-url",
        () -> {
          String url = CONFIG_SERVER.url("/").toString();
          return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        });
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void refreshWithoutAuthIsUnauthorized() throws Exception {
    mockMvc.perform(post("/api/v1/config/refresh/news-radar")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void refreshWithJwtAdminProxiesToConfigServer() throws Exception {
    CONFIG_SERVER.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("[\"aiplane.prompts.x.system\"]"));

    mockMvc
        .perform(post("/api/v1/config/refresh/news-radar"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0]").value("aiplane.prompts.x.system"));

    RecordedRequest upstream = CONFIG_SERVER.takeRequest(2, TimeUnit.SECONDS);
    assertThat(upstream).isNotNull();
    assertThat(upstream.getMethod()).isEqualTo("POST");
    assertThat(upstream.getPath()).isEqualTo("/actuator/refresh");
  }

  @Test
  @WithMockUser(roles = "DEVELOPER")
  void refreshWithJwtDeveloperIsAllowed() throws Exception {
    CONFIG_SERVER.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("[]"));

    mockMvc.perform(post("/api/v1/config/refresh/ackloop")).andExpect(status().isOk());
  }

  @Test
  void apiKeyMissingConfigRefreshScopeIsForbidden() throws Exception {
    String rawKey = createKeyAsAdmin("[\"usage:read\"]");

    mockMvc
        .perform(
            post("/api/v1/config/refresh/news-radar")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey))
        .andExpect(status().isForbidden());
  }

  @Test
  void apiKeyWithConfigRefreshScopeProxiesSuccessfully() throws Exception {
    String rawKey = createKeyAsAdmin("[\"config:refresh\"]");
    CONFIG_SERVER.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("[\"spring.cloud.config\"]"));

    mockMvc
        .perform(
            post("/api/v1/config/refresh/news-radar")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0]").value("spring.cloud.config"));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void getEnvironmentProxiesConfigServerJson() throws Exception {
    CONFIG_SERVER.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody(
                """
                {"name":"news-radar","profiles":["production"],"propertySources":[]}
                """));

    mockMvc
        .perform(get("/api/v1/config/news-radar/production"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("news-radar"))
        .andExpect(jsonPath("$.profiles[0]").value("production"));

    RecordedRequest upstream = CONFIG_SERVER.takeRequest(2, TimeUnit.SECONDS);
    assertThat(upstream).isNotNull();
    assertThat(upstream.getMethod()).isEqualTo("GET");
    assertThat(upstream.getPath()).isEqualTo("/news-radar/production");
  }

  @Test
  void apiKeyWithConfigReadCanGetEnvironment() throws Exception {
    String rawKey = createKeyAsAdmin("[\"config:read\"]");
    CONFIG_SERVER.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("{\"name\":\"ackloop\",\"profiles\":[\"default\"]}"));

    mockMvc
        .perform(
            get("/api/v1/config/ackloop/default")
                .header(ApiKeyAuthenticationFilter.API_KEY_HEADER, rawKey))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("ackloop"));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void refreshWhenConfigServerDownReturnsBadGateway() throws Exception {
    CONFIG_SERVER.enqueue(new MockResponse().setResponseCode(503).setBody("unavailable"));

    mockMvc
        .perform(post("/api/v1/config/refresh/news-radar"))
        .andExpect(status().isBadGateway())
        .andExpect(jsonPath("$.message").value(containsString("Config Server unreachable")));
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
                          "name": "config-key-%s",
                          "scopes": %s
                        }
                        """
                            .formatted(PROJECT_ID, System.nanoTime(), scopesJson)))
            .andExpect(status().isCreated())
            .andReturn();
    JsonNode body = objectMapper.readTree(created.getResponse().getContentAsString());
    return body.get("key").asText();
  }
}
