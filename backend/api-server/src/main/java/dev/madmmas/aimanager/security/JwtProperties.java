package dev.madmmas.aimanager.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aiplane.jwt")
public record JwtProperties(
    String secret, Duration accessTokenTtl, Duration refreshTokenTtl, boolean cookieSecure) {}
