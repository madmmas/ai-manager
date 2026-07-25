package dev.madmmas.aimanager.project;

import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** JDBC access for the {@code projects} table (JdbcTemplate; prompts use JPA). */
@Repository
public class JdbcProjectRepository implements ProjectRepository {

  private final JdbcTemplate jdbcTemplate;

  public JdbcProjectRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public long count() {
    Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM projects", Long.class);
    return count == null ? 0L : count;
  }

  @Override
  public List<String> findAllSlugs() {
    return jdbcTemplate.queryForList("SELECT slug FROM projects ORDER BY slug", String.class);
  }

  @Override
  public Optional<String> findSlugById(String id) {
    try {
      String slug =
          jdbcTemplate.queryForObject(
              "SELECT slug FROM projects WHERE id = ?", String.class, id);
      return Optional.ofNullable(slug);
    } catch (EmptyResultDataAccessException ex) {
      return Optional.empty();
    }
  }

  @Override
  public boolean existsBySlug(String slug) {
    Long matches =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM projects WHERE slug = ?", Long.class, slug);
    return matches != null && matches > 0;
  }

  @Override
  public boolean existsById(String id) {
    Long matches =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM projects WHERE id = ?", Long.class, id);
    return matches != null && matches > 0;
  }
}
