package dev.madmmas.aimanager.user;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Known API key permission scopes (wire values stored in {@code api_keys.scopes}). */
public enum ApiKeyScope {
  PROMPTS_READ("prompts:read"),
  PROMPTS_WRITE("prompts:write"),
  GUARDRAILS_READ("guardrails:read"),
  GUARDRAILS_EVALUATE("guardrails:evaluate"),
  USAGE_READ("usage:read"),
  USAGE_WRITE("usage:write"),
  CONFIG_READ("config:read"),
  CONFIG_REFRESH("config:refresh");

  private final String wireValue;

  ApiKeyScope(String wireValue) {
    this.wireValue = wireValue;
  }

  public String wireValue() {
    return wireValue;
  }

  public static ApiKeyScope fromWireValue(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("scope must not be blank");
    }
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    for (ApiKeyScope scope : values()) {
      if (scope.wireValue.equals(normalized)) {
        return scope;
      }
    }
    throw new IllegalArgumentException("Unknown scope: " + value);
  }

  /**
   * Validates and normalizes a list of wire scopes. Rejects unknowns and duplicates; preserves
   * first-seen order.
   */
  public static List<String> validateAndNormalize(List<String> scopes) {
    if (scopes == null || scopes.isEmpty()) {
      throw new IllegalArgumentException("scopes must not be empty");
    }
    Set<String> normalized = new LinkedHashSet<>();
    for (String scope : scopes) {
      normalized.add(fromWireValue(scope).wireValue());
    }
    return List.copyOf(normalized);
  }

  public static Set<String> allWireValues() {
    return Arrays.stream(values()).map(ApiKeyScope::wireValue).collect(Collectors.toUnmodifiableSet());
  }
}
