package dev.madmmas.aimanager.user;

import dev.madmmas.aimanager.common.exception.ConflictException;
import dev.madmmas.aimanager.common.exception.ResourceNotFoundException;
import dev.madmmas.aimanager.common.util.Ids;
import dev.madmmas.aimanager.project.ProjectRepository;
import dev.madmmas.aimanager.user.dto.ApiKeyCreatedResponse;
import dev.madmmas.aimanager.user.dto.ApiKeyResponse;
import dev.madmmas.aimanager.user.dto.CreateApiKeyRequest;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApiKeyService {

  private final ApiKeyRepository apiKeyRepository;
  private final ProjectRepository projectRepository;

  public ApiKeyService(ApiKeyRepository apiKeyRepository, ProjectRepository projectRepository) {
    this.apiKeyRepository = apiKeyRepository;
    this.projectRepository = projectRepository;
  }

  @Transactional(readOnly = true)
  public List<ApiKeyResponse> list(String projectId) {
    if (projectId == null || projectId.isBlank()) {
      throw new IllegalArgumentException("projectId is required");
    }
    return apiKeyRepository.findByProjectIdOrderByCreatedAtDesc(projectId.trim()).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ApiKeyCreatedResponse create(CreateApiKeyRequest request) {
    String projectId = request.projectId().trim();
    if (!projectRepository.existsById(projectId)) {
      throw new IllegalArgumentException("Unknown projectId: " + projectId);
    }
    String name = request.name().trim();
    if (name.isEmpty()) {
      throw new IllegalArgumentException("name must not be blank");
    }
    if (apiKeyRepository.existsByProjectIdAndNameIgnoreCase(projectId, name)) {
      throw new ConflictException("API key already exists for name: " + name);
    }
    List<String> scopes = ApiKeyScope.validateAndNormalize(request.scopes());
    Instant expiresAt = request.expiresAt();
    if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
      throw new IllegalArgumentException("expiresAt must be in the future");
    }

    ApiKeyHasher.GeneratedKey generated = ApiKeyHasher.generate();

    ApiKey entity = new ApiKey();
    entity.setId(Ids.next("akey_"));
    entity.setProjectId(projectId);
    entity.setName(name);
    entity.setPrefix(generated.prefix());
    entity.setKeyHash(generated.keyHash());
    entity.setScopes(scopes.toArray(String[]::new));
    entity.setExpiresAt(expiresAt);
    apiKeyRepository.save(entity);

    return new ApiKeyCreatedResponse(
        entity.getId(),
        entity.getProjectId(),
        entity.getName(),
        entity.getPrefix(),
        Arrays.asList(entity.getScopes()),
        entity.getCreatedAt(),
        entity.getLastUsedAt(),
        entity.getExpiresAt(),
        generated.rawKey());
  }

  @Transactional
  public void revoke(String id) {
    if (!apiKeyRepository.existsById(id)) {
      throw new ResourceNotFoundException("API key not found: " + id);
    }
    apiKeyRepository.deleteById(id);
  }

  /**
   * Looks up a non-expired key by SHA-256 hash of the raw secret. Does not update {@code
   * last_used_at}.
   */
  @Transactional(readOnly = true)
  public Optional<ApiKey> findValidByRawKey(String rawKey) {
    if (!ApiKeyHasher.looksLikeApiKey(rawKey)) {
      return Optional.empty();
    }
    return apiKeyRepository
        .findByKeyHash(ApiKeyHasher.sha256Hex(rawKey))
        .filter(this::isNotExpired);
  }

  @Transactional
  public void touchLastUsed(String id) {
    apiKeyRepository
        .findById(id)
        .ifPresent(
            key -> {
              key.setLastUsedAt(Instant.now());
              apiKeyRepository.save(key);
            });
  }

  private boolean isNotExpired(ApiKey key) {
    Instant expiresAt = key.getExpiresAt();
    return expiresAt == null || expiresAt.isAfter(Instant.now());
  }

  private ApiKeyResponse toResponse(ApiKey key) {
    return new ApiKeyResponse(
        key.getId(),
        key.getProjectId(),
        key.getName(),
        key.getPrefix(),
        Arrays.asList(key.getScopes()),
        key.getCreatedAt(),
        key.getLastUsedAt(),
        key.getExpiresAt());
  }
}
