package dev.madmmas.aimanager.user;

import dev.madmmas.aimanager.user.dto.ApiKeyCreatedResponse;
import dev.madmmas.aimanager.user.dto.ApiKeyResponse;
import dev.madmmas.aimanager.user.dto.CreateApiKeyRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API key management. Requires JWT user auth with {@code ROLE_ADMIN} (cookie) — not another API
 * key.
 */
@RestController
@RequestMapping("/api/v1/api-keys")
public class ApiKeyController {

  private final ApiKeyService apiKeyService;

  public ApiKeyController(ApiKeyService apiKeyService) {
    this.apiKeyService = apiKeyService;
  }

  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  List<ApiKeyResponse> list(@RequestParam("projectId") String projectId) {
    return apiKeyService.list(projectId);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  ApiKeyCreatedResponse create(@Valid @RequestBody CreateApiKeyRequest request) {
    return apiKeyService.create(request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasRole('ADMIN')")
  void revoke(@PathVariable("id") String id) {
    apiKeyService.revoke(id);
  }
}
