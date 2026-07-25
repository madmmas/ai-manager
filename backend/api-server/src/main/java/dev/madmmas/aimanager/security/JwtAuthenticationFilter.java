package dev.madmmas.aimanager.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the httpOnly access cookie and populates the SecurityContext. When no cookie is present,
 * leaves any existing context alone (so {@code @WithMockUser} keeps working in MockMvc ITs).
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private final CookieAuthSupport cookieAuthSupport;
  private final JwtTokenProvider jwtTokenProvider;
  private final UserDetailsServiceImpl userDetailsService;

  public JwtAuthenticationFilter(
      CookieAuthSupport cookieAuthSupport,
      JwtTokenProvider jwtTokenProvider,
      UserDetailsServiceImpl userDetailsService) {
    this.cookieAuthSupport = cookieAuthSupport;
    this.jwtTokenProvider = jwtTokenProvider;
    this.userDetailsService = userDetailsService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    Optional<String> accessToken = cookieAuthSupport.readAccessToken(request);
    if (accessToken.isPresent()
        && SecurityContextHolder.getContext().getAuthentication() == null) {
      try {
        JwtTokenProvider.ParsedToken parsed = jwtTokenProvider.parse(accessToken.get());
        if (jwtTokenProvider.isAccessToken(parsed)) {
          AuthUserPrincipal principal = userDetailsService.loadById(parsed.userId());
          if (principal.isEnabled()) {
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
          }
        }
      } catch (JwtTokenProvider.JwtExpiredException | JwtTokenProvider.JwtInvalidException ex) {
        // Invalid/expired cookie → leave context empty; SecurityConfig returns 401.
      }
    }

    filterChain.doFilter(request, response);
  }
}
