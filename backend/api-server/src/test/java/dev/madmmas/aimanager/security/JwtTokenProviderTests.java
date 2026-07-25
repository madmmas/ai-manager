package dev.madmmas.aimanager.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTests {

  private JwtTokenProvider provider;

  @BeforeEach
  void setUp() {
    provider =
        new JwtTokenProvider(
            new JwtProperties(
                "change-me-min-32-chars-for-local-dev-only!!",
                Duration.ofMinutes(15),
                Duration.ofDays(7),
                false));
  }

  @Test
  void createAndParseAccessToken() {
    AuthUserPrincipal principal = principal();
    String token = provider.createAccessToken(principal);

    JwtTokenProvider.ParsedToken parsed = provider.parse(token);
    assertThat(parsed.userId()).isEqualTo("user_1");
    assertThat(parsed.email()).isEqualTo("dev@aiplane.local");
    assertThat(parsed.name()).isEqualTo("Dev");
    assertThat(parsed.roles()).containsExactly("ROLE_ADMIN");
    assertThat(provider.isAccessToken(parsed)).isTrue();
    assertThat(provider.isRefreshToken(parsed)).isFalse();
  }

  @Test
  void createAndParseRefreshToken() {
    String token = provider.createRefreshToken(principal());
    JwtTokenProvider.ParsedToken parsed = provider.parse(token);
    assertThat(provider.isRefreshToken(parsed)).isTrue();
    assertThat(provider.isAccessToken(parsed)).isFalse();
  }

  @Test
  void expiredTokenIsRejected() {
    String token = provider.createAccessToken(principal(), Duration.ofMillis(-1));
    assertThatThrownBy(() -> provider.parse(token))
        .isInstanceOf(JwtTokenProvider.JwtExpiredException.class);
  }

  @Test
  void tamperedTokenIsRejected() {
    String token = provider.createAccessToken(principal()) + "x";
    assertThatThrownBy(() -> provider.parse(token))
        .isInstanceOf(JwtTokenProvider.JwtInvalidException.class);
  }

  private static AuthUserPrincipal principal() {
    return new AuthUserPrincipal(
        "user_1",
        "dev@aiplane.local",
        "Dev",
        "hash",
        true,
        List.of("ROLE_ADMIN"));
  }
}
