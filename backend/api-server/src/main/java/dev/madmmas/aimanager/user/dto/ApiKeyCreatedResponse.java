package dev.madmmas.aimanager.user.dto;

import java.time.Instant;
import java.util.List;

/** Create response — {@code key} is the full secret, shown once. */
public record ApiKeyCreatedResponse(
    String id,
    String projectId,
    String name,
    String prefix,
    List<String> scopes,
    Instant createdAt,
    Instant lastUsedAt,
    Instant expiresAt,
    String key) {}
