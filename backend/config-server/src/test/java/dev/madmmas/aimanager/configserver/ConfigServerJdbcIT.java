package dev.madmmas.aimanager.configserver;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Config Server JDBC backend against a real Postgres (Flyway V9 DDL applied manually —
 * Config Server does not run migrations; api-server owns them).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("jdbc")
class ConfigServerJdbcIT {

  static {
    // docker-java defaults to API 1.24; Docker Engine 25+/Desktop rejects that with HTTP 400.
    System.setProperty("api.version", "1.44");
  }

  @SuppressWarnings("resource")
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  static {
    POSTGRES.start();
    applyV9Schema();
  }

  @DynamicPropertySource
  static void registerDatasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void seedProperty() {
    jdbcTemplate.update("DELETE FROM config_properties");
    jdbcTemplate.update(
        """
        INSERT INTO config_properties (application, profile, label, "KEY", value)
        VALUES (?, ?, ?, ?, ?)
        """,
        "demo-app",
        "default",
        "main",
        "aiplane.jdbc.test",
        "from-jdbc");
  }

  @Test
  void servesPropertyFromJdbcBackend() throws Exception {
    mockMvc
        .perform(get("/demo-app/default"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("demo-app"))
        .andExpect(jsonPath("$.propertySources[0].source['aiplane.jdbc.test']").value("from-jdbc"));
  }

  @Test
  void healthEndpointIsUp() throws Exception {
    mockMvc
        .perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }

  /** Same DDL as api-server Flyway V9 — Config Server assumes the table already exists. */
  private static void applyV9Schema() {
    String ddl =
        """
        CREATE TABLE config_properties (
            id              BIGSERIAL PRIMARY KEY,
            application     VARCHAR(100) NOT NULL,
            profile         VARCHAR(50) NOT NULL,
            label           VARCHAR(50) NOT NULL DEFAULT 'main',
            "KEY"           VARCHAR(200) NOT NULL,
            value           TEXT,
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_config_properties_lookup UNIQUE (application, profile, label, "KEY")
        )
        """;
    try (Connection connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Statement statement = connection.createStatement()) {
      statement.execute(ddl);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to apply V9 config_properties DDL", e);
    }
  }
}
