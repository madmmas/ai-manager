package dev.madmmas.aimanager.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiKeyRepository extends JpaRepository<ApiKey, String> {

  List<ApiKey> findByProjectIdOrderByCreatedAtDesc(String projectId);

  Optional<ApiKey> findByKeyHash(String keyHash);

  boolean existsByProjectIdAndNameIgnoreCase(String projectId, String name);
}
