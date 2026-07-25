package dev.madmmas.aimanager.project;

import static org.assertj.core.api.Assertions.assertThat;

import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ProjectRepositoryIT extends AbstractPostgresIntegrationTest {

  @Autowired
  private ProjectRepository projectRepository;

  @Test
  void countAndSlugsReflectFlywaySeedData() {
    assertThat(projectRepository.count()).isGreaterThanOrEqualTo(2);
    assertThat(projectRepository.findAllSlugs()).contains("ackloop", "news-radar");
    assertThat(projectRepository.existsBySlug("news-radar")).isTrue();
    assertThat(projectRepository.existsBySlug("missing-project")).isFalse();
    assertThat(projectRepository.findSlugById("proj_news_radar")).contains("news-radar");
    assertThat(projectRepository.findSlugById("proj_missing")).isEmpty();
  }
}
