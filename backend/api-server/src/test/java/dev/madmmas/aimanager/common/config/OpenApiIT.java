package dev.madmmas.aimanager.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * OpenAPI smoke + generate-then-freeze contract check against {@code docs/api/api-server.yaml}.
 *
 * <p>Regenerate the frozen file (requires Docker for Testcontainers):
 *
 * <pre>{@code
 * make openapi
 * # or: mvn -f backend/pom.xml -pl api-server -am verify -Dit.test=OpenApiIT -Dopenapi.export=true
 * }</pre>
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiIT extends AbstractPostgresIntegrationTest {

  private static final String MODULE = "api-server";

  @Autowired private MockMvc mockMvc;

  @Test
  void openApiDocumentIsPublicAndDescribesApi() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.openapi").exists())
        .andExpect(jsonPath("$.info.title").value("AIPlane API"))
        .andExpect(jsonPath("$.info.version").value("v1"))
        .andExpect(jsonPath("$.paths['/api/v1/prompts']").exists())
        .andExpect(jsonPath("$.components.securitySchemes.apiKey").exists())
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth").exists());
  }

  @Test
  void swaggerUiIsPublic() throws Exception {
    mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
  }

  @Test
  void openApiYamlMatchesFrozenContractOrExports() throws Exception {
    String live =
        mockMvc
            .perform(get("/v3/api-docs.yaml"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);

    String normalizedLive = normalizeYaml(live);
    Path frozen = frozenSpecPath();

    if (Boolean.getBoolean("openapi.export")) {
      Files.createDirectories(frozen.getParent());
      Files.writeString(frozen, normalizedLive, StandardCharsets.UTF_8);
      return;
    }

    assertThat(frozen)
        .as(
            "Frozen OpenAPI missing at %s — run `make openapi` and commit docs/api/%s.yaml",
            frozen, MODULE)
        .exists();

    String frozenYaml = normalizeYaml(Files.readString(frozen, StandardCharsets.UTF_8));
    assertThat(normalizedLive)
        .as(
            "Live springdoc YAML drifted from docs/api/%s.yaml — run `make openapi` and commit the update",
            MODULE)
        .isEqualTo(frozenYaml);
  }

  private static Path frozenSpecPath() {
    String docsDir = System.getProperty("openapi.docs.dir");
    Path dir =
        docsDir != null && !docsDir.isBlank()
            ? Path.of(docsDir)
            : Path.of("").toAbsolutePath().resolve("../../docs/api").normalize();
    return dir.resolve(MODULE + ".yaml");
  }

  /** Stable trailing newline; strip CR so Windows checkouts do not false-fail. */
  private static String normalizeYaml(String yaml) {
    String unix = yaml.replace("\r\n", "\n").replace('\r', '\n');
    return unix.stripTrailing() + "\n";
  }
}
