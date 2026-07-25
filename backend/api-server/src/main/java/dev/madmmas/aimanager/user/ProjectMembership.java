package dev.madmmas.aimanager.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "project_memberships")
@IdClass(ProjectMembershipId.class)
public class ProjectMembership {

  @Id
  @Column(name = "user_id", length = 64)
  private String userId;

  @Id
  @Column(name = "project_id", length = 64)
  private String projectId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private MembershipRole role;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getProjectId() {
    return projectId;
  }

  public void setProjectId(String projectId) {
    this.projectId = projectId;
  }

  public MembershipRole getRole() {
    return role;
  }

  public void setRole(MembershipRole role) {
    this.role = role;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
