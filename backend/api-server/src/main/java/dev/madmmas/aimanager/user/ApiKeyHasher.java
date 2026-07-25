package dev.madmmas.aimanager.user;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/** Generates {@code aimg_}-prefixed API keys and SHA-256 hashes. Never log raw keys. */
public final class ApiKeyHasher {

  public static final String KEY_PREFIX = "aimg_";

  /** Visible prefix length: {@code aimg_} + 8 hex chars. */
  public static final int VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length() + 8;

  private static final int SECRET_BYTES = 32;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private ApiKeyHasher() {}

  public record GeneratedKey(String rawKey, String prefix, String keyHash) {}

  public static GeneratedKey generate() {
    byte[] secret = new byte[SECRET_BYTES];
    SECURE_RANDOM.nextBytes(secret);
    String secretHex = HexFormat.of().formatHex(secret);
    String rawKey = KEY_PREFIX + secretHex;
    return new GeneratedKey(rawKey, visiblePrefix(rawKey), sha256Hex(rawKey));
  }

  public static String visiblePrefix(String rawKey) {
    if (rawKey == null || rawKey.length() < VISIBLE_PREFIX_LENGTH) {
      throw new IllegalArgumentException("raw key too short for visible prefix");
    }
    return rawKey.substring(0, VISIBLE_PREFIX_LENGTH);
  }

  public static String sha256Hex(String rawKey) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 not available", ex);
    }
  }

  public static boolean looksLikeApiKey(String value) {
    return value != null && value.startsWith(KEY_PREFIX) && value.length() > KEY_PREFIX.length();
  }
}
