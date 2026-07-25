package dev.madmmas.aimanager.common.exception;

/** Thrown when the Config Server HTTP proxy cannot reach or complete a call (maps to HTTP 502). */
public class ConfigServerUnreachableException extends RuntimeException {

  public ConfigServerUnreachableException(String message, Throwable cause) {
    super(message, cause);
  }

  public ConfigServerUnreachableException(String message) {
    super(message);
  }
}
