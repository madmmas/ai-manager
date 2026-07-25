package dev.madmmas.aimanager.user;

/** Matches Flyway V6 {@code ck_project_memberships_role}. */
public enum MembershipRole {
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_VIEWER;

  public static MembershipRole fromWireValue(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("role is required");
    }
    try {
      return MembershipRole.valueOf(value.trim());
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "role must be ROLE_ADMIN, ROLE_DEVELOPER, or ROLE_VIEWER");
    }
  }
}
