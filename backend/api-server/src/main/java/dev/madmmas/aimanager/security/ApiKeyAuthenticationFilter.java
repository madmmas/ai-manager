package dev.madmmas.aimanager.security;

import dev.madmmas.aimanager.user.ApiKey;
import dev.madmmas.aimanager.user.ApiKeyHasher;
import dev.madmmas.aimanager.user.ApiKeyService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates programmatic clients via {@code X-API-Key: aimg_…} or {@code Authorization: Bearer
 * aimg_…}. Runs before {@link JwtAuthenticationFilter}. Invalid/expired keys leave the context
 * empty so AuthorizationFilter can return 401; JWT cookies still apply when no API key authenticates.
 */
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

  public static final String API_KEY_HEADER = "X-API-Key";

  private final ApiKeyService apiKeyService;

  public ApiKeyAuthenticationFilter(ApiKeyService apiKeyService) {
    this.apiKeyService = apiKeyService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (SecurityContextHolder.getContext().getAuthentication() == null) {
      extractRawKey(request)
          .flatMap(apiKeyService::findValidByRawKey)
          .ifPresent(key -> authenticate(request, key));
    }
    filterChain.doFilter(request, response);
  }

  private void authenticate(HttpServletRequest request, ApiKey key) {
    ApiKeyPrincipal principal =
        new ApiKeyPrincipal(key.getId(), key.getProjectId(), key.getName(), key.getScopes());
    UsernamePasswordAuthenticationToken authentication =
        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
    SecurityContextHolder.getContext().setAuthentication(authentication);
    apiKeyService.touchLastUsed(key.getId());
  }

  /**
   * Prefer {@code X-API-Key}; also accept {@code Authorization: Bearer aimg_…} so JWT Bearer tokens
   * (non-{@code aimg_}) do not collide.
   */
  static Optional<String> extractRawKey(HttpServletRequest request) {
    String headerKey = request.getHeader(API_KEY_HEADER);
    if (ApiKeyHasher.looksLikeApiKey(headerKey)) {
      return Optional.of(headerKey.trim());
    }
    String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
      String token = authorization.substring(7).trim();
      if (ApiKeyHasher.looksLikeApiKey(token)) {
        return Optional.of(token);
      }
    }
    return Optional.empty();
  }
}
