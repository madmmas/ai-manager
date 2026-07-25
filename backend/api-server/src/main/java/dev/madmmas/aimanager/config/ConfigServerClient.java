package dev.madmmas.aimanager.config;

import com.fasterxml.jackson.databind.JsonNode;
import dev.madmmas.aimanager.common.exception.ConfigServerUnreachableException;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * HTTP client for Spring Cloud Config Server. Used by {@link ConfigProxyController} to proxy
 * refresh and environment reads. Connection / upstream failures surface as {@link
 * ConfigServerUnreachableException} (HTTP 502).
 */
@Component
public class ConfigServerClient {

  private static final Logger log = LoggerFactory.getLogger(ConfigServerClient.class);

  private final RestClient restClient;

  public ConfigServerClient(RestClient configServerRestClient) {
    this.restClient = configServerRestClient;
  }

  /**
   * POSTs Config Server {@code /actuator/refresh}. {@code application} is accepted for API
   * symmetry / future targeting; Actuator refresh itself is server-wide.
   */
  public List<String> refresh(String application) {
    log.debug("Proxying Config Server refresh for application={}", application);
    try {
      String[] keys =
          restClient.post().uri("/actuator/refresh").retrieve().body(String[].class);
      if (keys == null || keys.length == 0) {
        return List.of();
      }
      return Arrays.asList(keys);
    } catch (RestClientException ex) {
      throw unreachable("refresh", ex);
    }
  }

  /** GETs {@code /{application}/{profile}} and returns the Environment JSON body. */
  public JsonNode fetchEnvironment(String application, String profile) {
    log.debug("Proxying Config Server environment application={} profile={}", application, profile);
    try {
      JsonNode body =
          restClient
              .get()
              .uri("/{application}/{profile}", application, profile)
              .retrieve()
              .body(JsonNode.class);
      if (body == null) {
        throw new ConfigServerUnreachableException(
            "Config Server returned an empty environment for " + application + "/" + profile);
      }
      return body;
    } catch (RestClientException ex) {
      throw unreachable("fetch environment", ex);
    }
  }

  private static ConfigServerUnreachableException unreachable(String action, RestClientException ex) {
    return new ConfigServerUnreachableException(
        "Config Server unreachable during " + action + ": " + ex.getMessage(), ex);
  }
}
