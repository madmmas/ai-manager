package dev.madmmas.aimanager.user;

import java.io.Serializable;
import java.util.Objects;

public class ProjectMembershipId implements Serializable {

  private String userId;
  private String projectId;

  public ProjectMembershipId() {}

  public ProjectMembershipId(String userId, String projectId) {
    this.userId = userId;
    this.projectId = projectId;
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

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof ProjectMembershipId that)) {
      return false;
    }
    return Objects.equals(userId, that.userId) && Objects.equals(projectId, that.projectId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, projectId);
  }
}
