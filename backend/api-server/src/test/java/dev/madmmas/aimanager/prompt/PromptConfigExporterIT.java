package dev.madmmas.aimanager.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
class PromptConfigExporterIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_news_radar";
  private static final String APPLICATION = "news-radar";

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void promoteToActiveWritesConfigPropertiesIdempotently() throws Exception {
    String promptName = "export-it/" + System.nanoTime();
    String keyPrefix = "aiplane.prompts." + promptName.replace('/', '.') + ".";

    String promptId = createPrompt(promptName);
    String versionId = createVersion(promptId, "You are v1.", "Ask {{q}}");

    promote(promptId, versionId); // draft → testing
    promote(promptId, versionId); // testing → active

    Map<String, String> firstExport = loadPromptKeys(keyPrefix);
    assertThat(firstExport)
        .containsEntry(keyPrefix + "system", "You are v1.")
        .containsEntry(keyPrefix + "user", "Ask {{q}}")
        .containsEntry(keyPrefix + "model", "claude-haiku-4-5")
        .containsEntry(keyPrefix + "provider", "anthropic")
        .containsEntry(keyPrefix + "version", "1")
        .containsEntry(keyPrefix + "versionId", versionId);
    assertThat(countPromptKeys(keyPrefix)).isEqualTo(6);

    String version2Id = createVersion(promptId, "You are v2.", "Ask again {{q}}");
    mockMvc
        .perform(
            patch("/api/v1/prompts/" + promptId + "/versions/" + version2Id + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "status": "testing" }
                    """))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            patch("/api/v1/prompts/" + promptId + "/versions/" + version2Id + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "status": "active" }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("active"));

    Map<String, String> secondExport = loadPromptKeys(keyPrefix);
    assertThat(countPromptKeys(keyPrefix)).isEqualTo(6);
    assertThat(secondExport)
        .containsEntry(keyPrefix + "system", "You are v2.")
        .containsEntry(keyPrefix + "user", "Ask again {{q}}")
        .containsEntry(keyPrefix + "version", "2")
        .containsEntry(keyPrefix + "versionId", version2Id);
  }

  private String createPrompt(String name) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/prompts")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "projectId": "%s",
                          "name": "%s",
                          "description": "export IT"
                        }
                        """
                            .formatted(PROJECT_ID, name)))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
  }

  private String createVersion(String promptId, String system, String user) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/prompts/" + promptId + "/versions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "label": "it",
                          "model": "claude-haiku-4-5",
                          "provider": "anthropic",
                          "systemPrompt": %s,
                          "userPromptTemplate": %s
                        }
                        """
                            .formatted(
                                objectMapper.writeValueAsString(system),
                                objectMapper.writeValueAsString(user))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("draft"))
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
  }

  private void promote(String promptId, String versionId) throws Exception {
    mockMvc
        .perform(post("/api/v1/prompts/" + promptId + "/versions/" + versionId + "/promote"))
        .andExpect(status().isOk());
  }

  private Map<String, String> loadPromptKeys(String keyPrefix) {
    return jdbcTemplate
        .query(
            """
            SELECT "KEY", value FROM config_properties
            WHERE application = ? AND profile = ? AND label = ? AND "KEY" LIKE ?
            """,
            (rs, rowNum) -> Map.entry(rs.getString(1), rs.getString(2)),
            APPLICATION,
            JdbcPromptConfigExporter.PROFILE,
            JdbcPromptConfigExporter.LABEL,
            keyPrefix + "%")
        .stream()
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private int countPromptKeys(String keyPrefix) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM config_properties
            WHERE application = ? AND profile = ? AND label = ? AND "KEY" LIKE ?
            """,
            Integer.class,
            APPLICATION,
            JdbcPromptConfigExporter.PROFILE,
            JdbcPromptConfigExporter.LABEL,
            keyPrefix + "%");
    return count == null ? 0 : count;
  }
}
