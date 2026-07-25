package dev.madmmas.aimanager.security;

import dev.madmmas.aimanager.security.dto.AcceptInviteRequest;
import dev.madmmas.aimanager.security.dto.AuthResponse;
import dev.madmmas.aimanager.security.dto.AuthUserResponse;
import dev.madmmas.aimanager.security.dto.LoginRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/accept-invite")
  AuthResponse acceptInvite(
      @Valid @RequestBody AcceptInviteRequest request, HttpServletResponse response) {
    return authService.acceptInvite(request, response);
  }

  @PostMapping("/login")
  AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    return authService.login(request, response);
  }

  @PostMapping("/refresh")
  AuthResponse refresh(HttpServletRequest request, HttpServletResponse response) {
    return authService.refresh(request, response);
  }

  @PostMapping("/logout")
  void logout(HttpServletResponse response) {
    authService.logout(response);
  }

  @GetMapping("/me")
  AuthUserResponse me() {
    return authService.me();
  }
}
