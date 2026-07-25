package dev.madmmas.aimanager.user;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<ProjectMembership, ProjectMembershipId> {

  List<ProjectMembership> findByUserId(String userId);
}
