package dev.madmmas.aimanager.prompt;

/**
 * Hook invoked when a prompt version becomes {@link PromptVersionStatus#ACTIVE}.
 *
 * <p>The production bean ({@link JdbcPromptConfigExporter}) upserts prompt fields into the shared
 * {@code config_properties} table for Spring Cloud Config JDBC mode.
 */
public interface PromptConfigExporter {

  void onVersionActivated(Prompt prompt, PromptVersion version);
}
