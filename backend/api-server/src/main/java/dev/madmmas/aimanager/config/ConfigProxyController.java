package dev.madmmas.aimanager.config;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Convenience proxies to Config Server (SPEC §3 config passthrough). Programmatic clients need API
 * key scopes ({@code config:refresh} / {@code config:read}); JWT ADMIN/DEVELOPER keep working for
 * the UI.
 */
@RestController
@RequestMapping("/api/v1/config")
public class ConfigProxyController {

  private final ConfigServerClient configServerClient;

  public ConfigProxyController(ConfigServerClient configServerClient) {
    this.configServerClient = configServerClient;
  }

  @PostMapping("/refresh/{application}")
  @PreAuthorize(
      "hasAuthority('config:refresh') or hasRole('ADMIN') or hasRole('DEVELOPER')")
  List<String> refresh(@PathVariable("application") String application) {
    return configServerClient.refresh(application);
  }

  @GetMapping("/{application}/{profile}")
  @PreAuthorize(
      "hasAuthority('config:read') or hasRole('ADMIN') or hasRole('DEVELOPER')")
  JsonNode getEnvironment(
      @PathVariable("application") String application,
      @PathVariable("profile") String profile) {
    return configServerClient.fetchEnvironment(application, profile);
  }
}
