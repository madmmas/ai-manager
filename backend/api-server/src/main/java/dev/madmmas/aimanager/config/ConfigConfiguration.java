package dev.madmmas.aimanager.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(ConfigServerProperties.class)
public class ConfigConfiguration {

  @Bean
  RestClient configServerRestClient(ConfigServerProperties properties) {
    // Dedicated builder so we do not mutate the shared RestClient.Builder bean.
    return RestClient.builder().baseUrl(properties.baseUrl()).build();
  }
}
