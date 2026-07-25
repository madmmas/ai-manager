package dev.madmmas.aimanager.common.exception;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ResourceNotFoundException.class)
  ResponseEntity<Map<String, Object>> notFound(ResourceNotFoundException ex) {
    return body(HttpStatus.NOT_FOUND, ex.getMessage());
  }

  @ExceptionHandler(ConflictException.class)
  ResponseEntity<Map<String, Object>> conflict(ConflictException ex) {
    return body(HttpStatus.CONFLICT, ex.getMessage());
  }

  @ExceptionHandler(BadCredentialsException.class)
  ResponseEntity<Map<String, Object>> badCredentials(BadCredentialsException ex) {
    return body(HttpStatus.UNAUTHORIZED, ex.getMessage());
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<Map<String, Object>> accessDenied(AccessDeniedException ex) {
    String message = ex.getMessage() != null ? ex.getMessage() : "Access denied";
    return body(HttpStatus.FORBIDDEN, message);
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, Object>> responseStatus(ResponseStatusException ex) {
    HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
    if (status == null) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }
    String message = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
    return body(status, message);
  }

  @ExceptionHandler(BatchValidationException.class)
  ResponseEntity<Map<String, Object>> batchValidation(BatchValidationException ex) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("status", HttpStatus.BAD_REQUEST.value());
    payload.put("error", HttpStatus.BAD_REQUEST.getReasonPhrase());
    payload.put("message", ex.getMessage());
    payload.put("errors", ex.getErrors());
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(payload);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException ex) {
    return body(HttpStatus.BAD_REQUEST, ex.getMessage());
  }

  @ExceptionHandler(ProviderNotConfiguredException.class)
  ResponseEntity<Map<String, Object>> providerNotConfigured(ProviderNotConfiguredException ex) {
    return body(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
  }

  @ExceptionHandler(ProviderTimeoutException.class)
  ResponseEntity<Map<String, Object>> providerTimeout(ProviderTimeoutException ex) {
    return body(HttpStatus.GATEWAY_TIMEOUT, ex.getMessage());
  }

  @ExceptionHandler(ProviderCallException.class)
  ResponseEntity<Map<String, Object>> providerCall(ProviderCallException ex) {
    return body(HttpStatus.BAD_GATEWAY, ex.getMessage());
  }

  @ExceptionHandler(ConfigServerUnreachableException.class)
  ResponseEntity<Map<String, Object>> configServerUnreachable(ConfigServerUnreachableException ex) {
    return body(HttpStatus.BAD_GATEWAY, ex.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex) {
    String message =
        ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(err -> err.getField() + ": " + err.getDefaultMessage())
            .orElse("Validation failed");
    return body(HttpStatus.BAD_REQUEST, message);
  }

  private static ResponseEntity<Map<String, Object>> body(HttpStatus status, String message) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("status", status.value());
    payload.put("error", status.getReasonPhrase());
    payload.put("message", message);
    return ResponseEntity.status(status).body(payload);
  }
}
