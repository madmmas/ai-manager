package dev.madmmas.aimanager.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class ApiKeyHasherTests {

  @Test
  void sha256HexIsDeterministic() {
    String key = "aimg_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assertThat(ApiKeyHasher.sha256Hex(key)).isEqualTo(ApiKeyHasher.sha256Hex(key));
    assertThat(ApiKeyHasher.sha256Hex(key)).hasSize(64);
  }

  @Test
  void generateUsesAimPrefixAndVisiblePrefix() {
    ApiKeyHasher.GeneratedKey generated = ApiKeyHasher.generate();
    assertThat(generated.rawKey()).startsWith(ApiKeyHasher.KEY_PREFIX);
    assertThat(generated.rawKey()).hasSize(ApiKeyHasher.KEY_PREFIX.length() + 64);
    assertThat(generated.prefix()).isEqualTo(generated.rawKey().substring(0, 13));
    assertThat(generated.keyHash()).isEqualTo(ApiKeyHasher.sha256Hex(generated.rawKey()));
  }

  @Test
  void looksLikeApiKeyRequiresPrefix() {
    assertThat(ApiKeyHasher.looksLikeApiKey("aimg_abc")).isTrue();
    assertThat(ApiKeyHasher.looksLikeApiKey("aimg_")).isFalse();
    assertThat(ApiKeyHasher.looksLikeApiKey("Bearer aimg_x")).isFalse();
    assertThat(ApiKeyHasher.looksLikeApiKey(null)).isFalse();
  }
}

class ApiKeyScopeTests {

  @Test
  void validateAndNormalizeAcceptsKnownScopesAndDedupes() {
    assertThat(
            ApiKeyScope.validateAndNormalize(
                List.of("usage:write", "USAGE:READ", "usage:write", "prompts:read")))
        .containsExactly("usage:write", "usage:read", "prompts:read");
  }

  @Test
  void validateAndNormalizeRejectsUnknownScope() {
    assertThatThrownBy(() -> ApiKeyScope.validateAndNormalize(List.of("usage:write", "admin:all")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown scope");
  }

  @Test
  void validateAndNormalizeRejectsEmpty() {
    assertThatThrownBy(() -> ApiKeyScope.validateAndNormalize(List.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("empty");
  }
}
