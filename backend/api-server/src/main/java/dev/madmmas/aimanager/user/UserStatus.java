package dev.madmmas.aimanager.user;

/** Matches Flyway V6 {@code ck_users_status}. */
public enum UserStatus {
  ACTIVE("active"),
  INVITED("invited"),
  DISABLED("disabled");

  private final String wireValue;

  UserStatus(String wireValue) {
    this.wireValue = wireValue;
  }

  public String wireValue() {
    return wireValue;
  }

  public static UserStatus fromWireValue(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("status is required");
    }
    for (UserStatus status : values()) {
      if (status.wireValue.equals(value)) {
        return status;
      }
    }
    throw new IllegalArgumentException("Unknown user status: " + value);
  }
}
