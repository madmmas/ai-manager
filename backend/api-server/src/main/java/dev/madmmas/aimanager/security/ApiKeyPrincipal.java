package dev.madmmas.aimanager.security;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Principal for requests authenticated via an API key. Authorities are raw scope strings. */
public class ApiKeyPrincipal {

  private final String id;
  private final String projectId;
  private final String name;
  private final List<String> scopes;

  public ApiKeyPrincipal(String id, String projectId, String name, String[] scopes) {
    this.id = id;
    this.projectId = projectId;
    this.name = name;
    this.scopes = scopes == null ? List.of() : List.copyOf(Arrays.asList(scopes));
  }

  public String getId() {
    return id;
  }

  public String getProjectId() {
    return projectId;
  }

  public String getName() {
    return name;
  }

  public List<String> getScopes() {
    return scopes;
  }

  public Collection<? extends GrantedAuthority> getAuthorities() {
    return scopes.stream().map(SimpleGrantedAuthority::new).collect(Collectors.toList());
  }
}
