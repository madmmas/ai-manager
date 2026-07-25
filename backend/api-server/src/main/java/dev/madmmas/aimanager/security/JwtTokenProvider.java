package dev.madmmas.aimanager.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

  public static final String CLAIM_TYPE = "typ";
  public static final String CLAIM_EMAIL = "email";
  public static final String CLAIM_NAME = "name";
  public static final String CLAIM_ROLES = "roles";
  public static final String TYPE_ACCESS = "access";
  public static final String TYPE_REFRESH = "refresh";

  private final JwtProperties properties;
  private final SecretKey key;

  public JwtTokenProvider(JwtProperties properties) {
    this.properties = properties;
    byte[] secretBytes = properties.secret().getBytes(StandardCharsets.UTF_8);
    if (secretBytes.length < 32) {
      throw new IllegalStateException("aiplane.jwt.secret must be at least 32 characters");
    }
    this.key = Keys.hmacShaKeyFor(secretBytes);
  }

  public String createAccessToken(AuthUserPrincipal principal) {
    return createToken(principal, TYPE_ACCESS, properties.accessTokenTtl());
  }

  public String createAccessToken(AuthUserPrincipal principal, Duration ttl) {
    return createToken(principal, TYPE_ACCESS, ttl);
  }

  public String createRefreshToken(AuthUserPrincipal principal) {
    return createToken(principal, TYPE_REFRESH, properties.refreshTokenTtl());
  }

  public String createRefreshToken(AuthUserPrincipal principal, Duration ttl) {
    return createToken(principal, TYPE_REFRESH, ttl);
  }

  private String createToken(AuthUserPrincipal principal, String type, Duration ttl) {
    Instant now = Instant.now();
    Instant expires = now.plus(ttl);
    return Jwts.builder()
        .subject(principal.getId())
        .claim(CLAIM_TYPE, type)
        .claim(CLAIM_EMAIL, principal.getEmail())
        .claim(CLAIM_NAME, principal.getName())
        .claim(CLAIM_ROLES, principal.getRoles())
        .issuedAt(Date.from(now))
        .expiration(Date.from(expires))
        .signWith(key)
        .compact();
  }

  public ParsedToken parse(String token) {
    try {
      Claims claims =
          Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
      String type = claims.get(CLAIM_TYPE, String.class);
      @SuppressWarnings("unchecked")
      List<String> roles = claims.get(CLAIM_ROLES, List.class);
      return new ParsedToken(
          claims.getSubject(),
          claims.get(CLAIM_EMAIL, String.class),
          claims.get(CLAIM_NAME, String.class),
          type,
          roles == null ? List.of() : List.copyOf(roles),
          claims.getExpiration().toInstant());
    } catch (ExpiredJwtException ex) {
      throw new JwtExpiredException("JWT expired", ex);
    } catch (JwtException | IllegalArgumentException ex) {
      throw new JwtInvalidException("Invalid JWT", ex);
    }
  }

  public boolean isAccessToken(ParsedToken token) {
    return TYPE_ACCESS.equals(token.type());
  }

  public boolean isRefreshToken(ParsedToken token) {
    return TYPE_REFRESH.equals(token.type());
  }

  public record ParsedToken(
      String userId,
      String email,
      String name,
      String type,
      List<String> roles,
      Instant expiresAt) {}

  public static class JwtExpiredException extends RuntimeException {
    public JwtExpiredException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  public static class JwtInvalidException extends RuntimeException {
    public JwtInvalidException(String message, Throwable cause) {
      super(message, cause);
    }
  }
}
