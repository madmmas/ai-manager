package dev.madmmas.aimanager.prompt;

import dev.madmmas.aimanager.project.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Writes active prompt config into the shared {@code config_properties} table (Config Server JDBC
 * backend). Invoked from {@link PromptService} when a version becomes active.
 *
 * <p>Key schema (application = project slug, profile = {@code default}, label = {@code main}):
 *
 * <ul>
 *   <li>{@code aiplane.prompts.{promptName}.system}
 *   <li>{@code aiplane.prompts.{promptName}.user}
 *   <li>{@code aiplane.prompts.{promptName}.model}
 *   <li>{@code aiplane.prompts.{promptName}.provider}
 *   <li>{@code aiplane.prompts.{promptName}.version}
 *   <li>{@code aiplane.prompts.{promptName}.versionId}
 * </ul>
 *
 * <p>Prompt names are sanitized for key safety ({@code /} → {@code .}). Upserts are idempotent via
 * the unique constraint on {@code (application, profile, label, "KEY")}.
 */
@Component
public class JdbcPromptConfigExporter implements PromptConfigExporter {

  static final String PROFILE = "default";
  static final String LABEL = "main";

  private static final Logger log = LoggerFactory.getLogger(JdbcPromptConfigExporter.class);

  private static final String UPSERT_SQL =
      """
      INSERT INTO config_properties (application, profile, label, "KEY", value, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (application, profile, label, "KEY")
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      """;

  private final JdbcTemplate jdbcTemplate;
  private final ProjectRepository projectRepository;

  public JdbcPromptConfigExporter(
      JdbcTemplate jdbcTemplate, ProjectRepository projectRepository) {
    this.jdbcTemplate = jdbcTemplate;
    this.projectRepository = projectRepository;
  }

  @Override
  public void onVersionActivated(Prompt prompt, PromptVersion version) {
    String application = resolveApplication(prompt.getProjectId());
    String keyPrefix = "aiplane.prompts." + sanitizePromptName(prompt.getName()) + ".";

    upsert(application, keyPrefix + "system", nullToEmpty(version.getSystemPrompt()));
    upsert(application, keyPrefix + "user", nullToEmpty(version.getUserPromptTemplate()));
    upsert(application, keyPrefix + "model", nullToEmpty(version.getModel()));
    upsert(application, keyPrefix + "provider", version.getProvider().wireValue());
    upsert(application, keyPrefix + "version", String.valueOf(version.getVersion()));
    upsert(application, keyPrefix + "versionId", version.getId());

    log.info(
        "Exported active prompt to config_properties: application={}, prompt={}, versionId={},"
            + " version={}",
        application,
        prompt.getName(),
        version.getId(),
        version.getVersion());
  }

  private String resolveApplication(String projectId) {
    return projectRepository.findSlugById(projectId).orElse(projectId);
  }

  private void upsert(String application, String key, String value) {
    jdbcTemplate.update(UPSERT_SQL, application, PROFILE, LABEL, key, value);
  }

  /** Replaces {@code /} with {@code .} so nested prompt names stay valid property keys. */
  static String sanitizePromptName(String name) {
    if (name == null || name.isBlank()) {
      return "unnamed";
    }
    return name.replace('/', '.');
  }

  private static String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
