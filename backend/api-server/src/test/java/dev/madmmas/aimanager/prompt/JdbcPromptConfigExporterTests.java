package dev.madmmas.aimanager.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.madmmas.aimanager.project.ProjectRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class JdbcPromptConfigExporterTests {

  @Mock private JdbcTemplate jdbcTemplate;
  @Mock private ProjectRepository projectRepository;

  private JdbcPromptConfigExporter exporter;

  @BeforeEach
  void setUp() {
    exporter = new JdbcPromptConfigExporter(jdbcTemplate, projectRepository);
  }

  @Test
  void sanitizePromptNameReplacesSlash() {
    assertThat(JdbcPromptConfigExporter.sanitizePromptName("news-radar/dedup"))
        .isEqualTo("news-radar.dedup");
    assertThat(JdbcPromptConfigExporter.sanitizePromptName("plain")).isEqualTo("plain");
    assertThat(JdbcPromptConfigExporter.sanitizePromptName("  ")).isEqualTo("unnamed");
  }

  @Test
  void onVersionActivatedUpsertsSixKeysUnderProjectSlug() {
    when(projectRepository.findSlugById("proj_news_radar")).thenReturn(Optional.of("news-radar"));

    Prompt prompt = new Prompt();
    prompt.setId("prm_1");
    prompt.setProjectId("proj_news_radar");
    prompt.setName("news-radar/dedup");

    PromptVersion version = new PromptVersion();
    version.setId("ver_1");
    version.setPromptId("prm_1");
    version.setVersion(3);
    version.setModel("claude-haiku-4-5");
    version.setProvider(LlmProvider.ANTHROPIC);
    version.setSystemPrompt("You are a dedup judge.");
    version.setUserPromptTemplate("Compare {{a}} and {{b}}");

    exporter.onVersionActivated(prompt, version);

    ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> valueCaptor = ArgumentCaptor.forClass(String.class);
    verify(jdbcTemplate, times(6))
        .update(
            any(String.class),
            eq("news-radar"),
            eq(JdbcPromptConfigExporter.PROFILE),
            eq(JdbcPromptConfigExporter.LABEL),
            keyCaptor.capture(),
            valueCaptor.capture());

    List<String> pairs = new ArrayList<>();
    List<String> keys = keyCaptor.getAllValues();
    List<String> values = valueCaptor.getAllValues();
    for (int i = 0; i < keys.size(); i++) {
      pairs.add(keys.get(i) + "=" + values.get(i));
    }
    assertThat(pairs)
        .containsExactlyInAnyOrder(
            "aiplane.prompts.news-radar.dedup.system=You are a dedup judge.",
            "aiplane.prompts.news-radar.dedup.user=Compare {{a}} and {{b}}",
            "aiplane.prompts.news-radar.dedup.model=claude-haiku-4-5",
            "aiplane.prompts.news-radar.dedup.provider=anthropic",
            "aiplane.prompts.news-radar.dedup.version=3",
            "aiplane.prompts.news-radar.dedup.versionId=ver_1");
  }

  @Test
  void onVersionActivatedFallsBackToProjectIdWhenSlugMissing() {
    when(projectRepository.findSlugById("proj_orphan")).thenReturn(Optional.empty());

    Prompt prompt = new Prompt();
    prompt.setId("prm_2");
    prompt.setProjectId("proj_orphan");
    prompt.setName("solo");

    PromptVersion version = new PromptVersion();
    version.setId("ver_2");
    version.setPromptId("prm_2");
    version.setVersion(1);
    version.setModel("gpt-4o-mini");
    version.setProvider(LlmProvider.OPENAI);
    version.setSystemPrompt("");
    version.setUserPromptTemplate("");

    exporter.onVersionActivated(prompt, version);

    verify(jdbcTemplate, times(6))
        .update(
            any(String.class),
            eq("proj_orphan"),
            eq(JdbcPromptConfigExporter.PROFILE),
            eq(JdbcPromptConfigExporter.LABEL),
            anyString(),
            anyString());
  }
}
