package dev.madmmas.aimanager.project;

import java.util.List;
import java.util.Optional;

/** Persistence port for the {@code projects} table. */
public interface ProjectRepository {

  long count();

  List<String> findAllSlugs();

  Optional<String> findSlugById(String id);

  boolean existsBySlug(String slug);

  boolean existsById(String id);
}
