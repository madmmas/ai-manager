package dev.madmmas.aimanager.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.madmmas.aimanager.common.exception.ConfigServerUnreachableException;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class ConfigServerClientTests {

  private MockWebServer server;
  private ConfigServerClient client;

  @BeforeEach
  void setUp() throws IOException {
    server = new MockWebServer();
    server.start();
    RestClient restClient = RestClient.builder().baseUrl(server.url("/").toString()).build();
    client = new ConfigServerClient(restClient);
  }

  @AfterEach
  void tearDown() throws IOException {
    server.shutdown();
  }

  @Test
  void refreshPostsActuatorRefreshAndReturnsKeys() throws Exception {
    server.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("[\"aiplane.prompts.dedup.system\",\"spring.cloud.client\"]"));

    List<String> keys = client.refresh("news-radar");

    assertThat(keys)
        .containsExactly("aiplane.prompts.dedup.system", "spring.cloud.client");

    RecordedRequest request = server.takeRequest(1, TimeUnit.SECONDS);
    assertThat(request).isNotNull();
    assertThat(request.getMethod()).isEqualTo("POST");
    assertThat(request.getPath()).isEqualTo("/actuator/refresh");
  }

  @Test
  void fetchEnvironmentGetsApplicationProfile() throws Exception {
    String body =
        """
        {"name":"news-radar","profiles":["production"],"propertySources":[]}
        """;
    server.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody(body));

    JsonNode env = client.fetchEnvironment("news-radar", "production");

    assertThat(env.get("name").asText()).isEqualTo("news-radar");
    assertThat(env.get("profiles").get(0).asText()).isEqualTo("production");

    RecordedRequest request = server.takeRequest(1, TimeUnit.SECONDS);
    assertThat(request).isNotNull();
    assertThat(request.getMethod()).isEqualTo("GET");
    assertThat(request.getPath()).isEqualTo("/news-radar/production");
  }

  @Test
  void refreshMapsConnectionFailureToUnreachable() throws IOException {
    server.shutdown();

    assertThatThrownBy(() -> client.refresh("news-radar"))
        .isInstanceOf(ConfigServerUnreachableException.class)
        .hasMessageContaining("Config Server unreachable");
  }

  @Test
  void fetchEnvironmentMapsHttpErrorToUnreachable() {
    server.enqueue(new MockResponse().setResponseCode(503).setBody("down"));

    assertThatThrownBy(() -> client.fetchEnvironment("news-radar", "default"))
        .isInstanceOf(ConfigServerUnreachableException.class)
        .hasMessageContaining("Config Server unreachable");
  }

  @Test
  void refreshEmptyBodyReturnsEmptyList() {
    server.enqueue(
        new MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("[]"));

    assertThat(client.refresh("app")).isEmpty();
  }

  @Test
  void propertiesStripTrailingSlash() {
    ConfigServerProperties props =
        new ConfigServerProperties("http://localhost:8888/");
    assertThat(props.baseUrl()).isEqualTo("http://localhost:8888");
  }

  @Test
  void propertiesRejectBlankBaseUrl() {
    assertThatThrownBy(() -> new ConfigServerProperties("  "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("base-url");
  }

  /** Sanity: ObjectMapper can round-trip typical Config Server Environment JSON. */
  @Test
  void environmentJsonIsParseable() throws Exception {
    JsonNode node =
        new ObjectMapper()
            .readTree(
                """
                {"name":"x","profiles":["default"],"propertySources":[{"name":"a","source":{"k":"v"}}]}
                """);
    assertThat(node.path("propertySources").get(0).path("source").path("k").asText())
        .isEqualTo("v");
  }
}
