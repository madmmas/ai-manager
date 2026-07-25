package dev.madmmas.aimanager.user.dto;

import java.time.Instant;
import java.util.List;

/** List/detail shape — never includes the raw secret. */
public record ApiKeyResponse(
    String id,
    String projectId,
    String name,
    String prefix,
    List<String> scopes,
    Instant createdAt,
    Instant lastUsedAt,
    Instant expiresAt) {}
