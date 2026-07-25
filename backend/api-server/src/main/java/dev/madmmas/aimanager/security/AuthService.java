package dev.madmmas.aimanager.security;

import dev.madmmas.aimanager.security.dto.AcceptInviteRequest;
import dev.madmmas.aimanager.security.dto.AuthResponse;
import dev.madmmas.aimanager.security.dto.AuthUserResponse;
import dev.madmmas.aimanager.security.dto.LoginRequest;
import dev.madmmas.aimanager.user.User;
import dev.madmmas.aimanager.user.UserRepository;
import dev.madmmas.aimanager.user.UserStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private final UserRepository userRepository;
  private final UserDetailsServiceImpl userDetailsService;
  private final PasswordEncoder passwordEncoder;
  private final JwtTokenProvider jwtTokenProvider;
  private final CookieAuthSupport cookieAuthSupport;

  public AuthService(
      UserRepository userRepository,
      UserDetailsServiceImpl userDetailsService,
      PasswordEncoder passwordEncoder,
      JwtTokenProvider jwtTokenProvider,
      CookieAuthSupport cookieAuthSupport) {
    this.userRepository = userRepository;
    this.userDetailsService = userDetailsService;
    this.passwordEncoder = passwordEncoder;
    this.jwtTokenProvider = jwtTokenProvider;
    this.cookieAuthSupport = cookieAuthSupport;
  }

  @Transactional
  public AuthResponse acceptInvite(
      AcceptInviteRequest request, HttpServletResponse response) {
    String email = request.email().trim().toLowerCase();
    User user =
        userRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));
    if (user.getStatus() != UserStatus.INVITED) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Invite is not pending for this email");
    }
    if (request.name() != null && !request.name().isBlank()) {
      user.setName(request.name().trim());
    }
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    user.setStatus(UserStatus.ACTIVE);
    userRepository.save(user);

    AuthUserPrincipal principal = userDetailsService.toPrincipal(user);
    issueCookies(principal, response);
    return new AuthResponse(toAuthUser(principal));
  }

  @Transactional(readOnly = true)
  public AuthResponse login(LoginRequest request, HttpServletResponse response) {
    String email = request.email().trim().toLowerCase();
    User user =
        userRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

    if (user.getStatus() == UserStatus.INVITED) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "User has not accepted invite");
    }
    if (user.getStatus() != UserStatus.ACTIVE) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account is disabled");
    }
    if (user.getPasswordHash() == null
        || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new BadCredentialsException("Invalid email or password");
    }

    AuthUserPrincipal principal = userDetailsService.toPrincipal(user);
    issueCookies(principal, response);
    return new AuthResponse(toAuthUser(principal));
  }

  @Transactional(readOnly = true)
  public AuthResponse refresh(HttpServletRequest request, HttpServletResponse response) {
    String refreshToken =
        cookieAuthSupport
            .readRefreshToken(request)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing refresh token"));
    try {
      JwtTokenProvider.ParsedToken parsed = jwtTokenProvider.parse(refreshToken);
      if (!jwtTokenProvider.isRefreshToken(parsed)) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
      }
      AuthUserPrincipal principal = userDetailsService.loadById(parsed.userId());
      if (!principal.isEnabled()) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account is not active");
      }
      issueCookies(principal, response);
      return new AuthResponse(toAuthUser(principal));
    } catch (JwtTokenProvider.JwtExpiredException | JwtTokenProvider.JwtInvalidException ex) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }
  }

  public void logout(HttpServletResponse response) {
    cookieAuthSupport.clearTokenCookies(response);
  }

  @Transactional(readOnly = true)
  public AuthUserResponse me() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
    }
    return toAuthUser(principal);
  }

  private void issueCookies(AuthUserPrincipal principal, HttpServletResponse response) {
    String access = jwtTokenProvider.createAccessToken(principal);
    String refresh = jwtTokenProvider.createRefreshToken(principal);
    cookieAuthSupport.writeTokenCookies(response, access, refresh);
  }

  private static AuthUserResponse toAuthUser(AuthUserPrincipal principal) {
    return new AuthUserResponse(
        principal.getId(), principal.getEmail(), principal.getName(), principal.getRoles());
  }
}
