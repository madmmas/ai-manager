package dev.madmmas.aimanager.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_ackloop";

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtTokenProvider jwtTokenProvider;

  @Test
  void loginAsSeedAdminIssuesHttpOnlyCookiesWithoutTokensInBody() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        { "email": "admin@aiplane.local", "password": "changeme" }
                        """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("admin@aiplane.local"))
            .andExpect(jsonPath("$.user.roles").isArray())
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(jsonPath("$.refreshToken").doesNotExist())
            .andExpect(cookie().exists(CookieAuthSupport.ACCESS_COOKIE))
            .andExpect(cookie().httpOnly(CookieAuthSupport.ACCESS_COOKIE, true))
            .andExpect(cookie().exists(CookieAuthSupport.REFRESH_COOKIE))
            .andExpect(cookie().httpOnly(CookieAuthSupport.REFRESH_COOKIE, true))
            .andReturn();

    Cookie access = result.getResponse().getCookie(CookieAuthSupport.ACCESS_COOKIE);
    assertThat(access).isNotNull();

    mockMvc
        .perform(get("/auth/me").cookie(access))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("admin@aiplane.local"));

    mockMvc
        .perform(get("/api/v1/users").cookie(access))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray());
  }

  @Test
  void inviteAcceptLoginRefreshAndRejectInvitedLogin() throws Exception {
    Cookie adminAccess = loginAsAdmin();
    String email = "invitee-" + System.nanoTime() + "@aiplane.local";

    mockMvc
        .perform(
            post("/api/v1/users/invite")
                .cookie(adminAccess)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "email": "%s",
                      "name": "Invitee",
                      "projectId": "%s",
                      "role": "ROLE_DEVELOPER"
                    }
                    """
                        .formatted(email, PROJECT_ID)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.status").value("invited"))
        .andExpect(jsonPath("$.roles[0]").value("ROLE_DEVELOPER"));

    mockMvc
        .perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    { "email": "%s", "password": "password1" }
                    """
                        .formatted(email)))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message", containsString("accepted invite")));

    MvcResult accept =
        mockMvc
            .perform(
                post("/auth/accept-invite")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "email": "%s",
                          "password": "password1",
                          "name": "Invitee Active"
                        }
                        """
                            .formatted(email)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.name").value("Invitee Active"))
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(cookie().exists(CookieAuthSupport.ACCESS_COOKIE))
            .andExpect(cookie().exists(CookieAuthSupport.REFRESH_COOKIE))
            .andReturn();

    Cookie access = accept.getResponse().getCookie(CookieAuthSupport.ACCESS_COOKIE);
    Cookie refresh = accept.getResponse().getCookie(CookieAuthSupport.REFRESH_COOKIE);
    assertThat(access).isNotNull();
    assertThat(refresh).isNotNull();

    mockMvc
        .perform(get("/auth/me").cookie(access))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email));

    MvcResult refreshed =
        mockMvc
            .perform(post("/auth/refresh").cookie(refresh))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(cookie().exists(CookieAuthSupport.ACCESS_COOKIE))
            .andReturn();

    Cookie newAccess = refreshed.getResponse().getCookie(CookieAuthSupport.ACCESS_COOKIE);
    assertThat(newAccess).isNotNull();

    mockMvc
        .perform(get("/api/v1/users").cookie(newAccess))
        .andExpect(status().isOk());

    mockMvc
        .perform(post("/auth/logout"))
        .andExpect(status().isOk())
        .andExpect(cookie().maxAge(CookieAuthSupport.ACCESS_COOKIE, 0))
        .andExpect(cookie().maxAge(CookieAuthSupport.REFRESH_COOKIE, 0));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void inviteDuplicateEmailReturnsConflict() throws Exception {
    String email = "dup-" + System.nanoTime() + "@aiplane.local";
    String body =
        """
        {
          "email": "%s",
          "projectId": "%s",
          "role": "ROLE_VIEWER"
        }
        """
            .formatted(email, PROJECT_ID);

    mockMvc
        .perform(post("/api/v1/users/invite").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post("/api/v1/users/invite").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isConflict());
  }

  @Test
  void expiredAccessTokenIsRejectedOnProtectedRoute() throws Exception {
    AuthUserPrincipal principal =
        new AuthUserPrincipal(
            "user_admin",
            "admin@aiplane.local",
            "AIPlane Admin",
            "hash",
            true,
            List.of("ROLE_ADMIN"));
    String expired = jwtTokenProvider.createAccessToken(principal, Duration.ofMillis(-1));

    mockMvc
        .perform(
            get("/api/v1/users").cookie(new Cookie(CookieAuthSupport.ACCESS_COOKIE, expired)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void protectedRouteWithoutAuthReturnsUnauthorized() throws Exception {
    mockMvc.perform(get("/api/v1/users")).andExpect(status().isUnauthorized());
  }

  private Cookie loginAsAdmin() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        { "email": "admin@aiplane.local", "password": "changeme" }
                        """))
            .andExpect(status().isOk())
            .andReturn();
    Cookie access = result.getResponse().getCookie(CookieAuthSupport.ACCESS_COOKIE);
    assertThat(access).isNotNull();
    return access;
  }
}
