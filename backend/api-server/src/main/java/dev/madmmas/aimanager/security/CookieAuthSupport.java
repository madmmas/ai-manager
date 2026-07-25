package dev.madmmas.aimanager.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class CookieAuthSupport {

  public static final String ACCESS_COOKIE = "aiplane_access";
  public static final String REFRESH_COOKIE = "aiplane_refresh";

  private final JwtProperties jwtProperties;

  public CookieAuthSupport(JwtProperties jwtProperties) {
    this.jwtProperties = jwtProperties;
  }

  public void writeTokenCookies(
      HttpServletResponse response, String accessToken, String refreshToken) {
    response.addCookie(buildCookie(ACCESS_COOKIE, accessToken, jwtProperties.accessTokenTtl()));
    response.addCookie(buildCookie(REFRESH_COOKIE, refreshToken, jwtProperties.refreshTokenTtl()));
  }

  public void clearTokenCookies(HttpServletResponse response) {
    response.addCookie(clearCookie(ACCESS_COOKIE));
    response.addCookie(clearCookie(REFRESH_COOKIE));
  }

  public Optional<String> readAccessToken(HttpServletRequest request) {
    return readCookie(request, ACCESS_COOKIE);
  }

  public Optional<String> readRefreshToken(HttpServletRequest request) {
    return readCookie(request, REFRESH_COOKIE);
  }

  private Cookie buildCookie(String name, String value, Duration maxAge) {
    Cookie cookie = new Cookie(name, value);
    cookie.setHttpOnly(true);
    cookie.setSecure(jwtProperties.cookieSecure());
    cookie.setPath("/");
    cookie.setMaxAge(Math.toIntExact(maxAge.toSeconds()));
    cookie.setAttribute("SameSite", "Lax");
    return cookie;
  }

  private Cookie clearCookie(String name) {
    Cookie cookie = new Cookie(name, "");
    cookie.setHttpOnly(true);
    cookie.setSecure(jwtProperties.cookieSecure());
    cookie.setPath("/");
    cookie.setMaxAge(0);
    cookie.setAttribute("SameSite", "Lax");
    return cookie;
  }

  private static Optional<String> readCookie(HttpServletRequest request, String name) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) {
      return Optional.empty();
    }
    return Arrays.stream(cookies)
        .filter(c -> name.equals(c.getName()))
        .map(Cookie::getValue)
        .filter(v -> v != null && !v.isBlank())
        .findFirst();
  }
}
