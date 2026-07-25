package dev.madmmas.aimanager.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aiplane.cors")
public record CorsProperties(List<String> allowedOrigins) {}
