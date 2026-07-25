package dev.madmmas.aimanager.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.time.Instant;
import java.util.List;

public record CreateApiKeyRequest(
    @NotBlank String projectId,
    @NotBlank String name,
    @NotEmpty List<String> scopes,
    Instant expiresAt) {}
