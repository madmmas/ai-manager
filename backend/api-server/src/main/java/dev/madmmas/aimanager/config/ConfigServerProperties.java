package dev.madmmas.aimanager.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aiplane.config-server")
public record ConfigServerProperties(String baseUrl) {

  public ConfigServerProperties {
    if (baseUrl == null || baseUrl.isBlank()) {
      throw new IllegalArgumentException("aiplane.config-server.base-url must not be blank");
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
  }
}
