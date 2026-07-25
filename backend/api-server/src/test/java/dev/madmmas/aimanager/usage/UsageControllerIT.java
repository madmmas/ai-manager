package dev.madmmas.aimanager.usage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.madmmas.aimanager.support.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
class UsageControllerIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_ackloop";

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void ingestCreatesEventsAndReturnsEnvelope() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/usage/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "events": [
                            {
                              "projectId": "%s",
                              "provider": "openai",
                              "model": "gpt-4o-mini",
                              "status": "success",
                              "inputTokens": 10,
                              "outputTokens": 20,
                              "latencyMs": 150,
                              "costUsd": 0.002
                            },
                            {
                              "projectId": "%s",
                              "provider": "anthropic",
                              "model": "claude-haiku-4-20250414",
                              "status": "guardrail-blocked",
                              "inputTokens": 5,
                              "outputTokens": 0,
                              "latencyMs": 12
                            }
                          ]
                        }
                        """
                            .formatted(PROJECT_ID, PROJECT_ID)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accepted").value(2))
            .andExpect(jsonPath("$.events.length()").value(2))
            .andExpect(jsonPath("$.events[0].id").exists())
            .andExpect(jsonPath("$.events[0].provider").value("openai"))
            .andExpect(jsonPath("$.events[1].status").value("guardrail-blocked"))
            .andReturn();

    JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
    String id0 = json.get("events").get(0).get("id").asText();
    assertThat(id0).startsWith("ue_");

    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM usage_events WHERE id = ?", Integer.class, id0);
    assertThat(count).isEqualTo(1);
  }

  @Test
  void ingestWithoutCostUsdComputesFromRates() throws Exception {
    // gpt-4o-mini: 1000 * 0.00015/1k + 2000 * 0.0006/1k = 0.00015 + 0.0012 = 0.00135
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/usage/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "events": [
                            {
                              "projectId": "%s",
                              "provider": "openai",
                              "model": "gpt-4o-mini",
                              "status": "success",
                              "inputTokens": 1000,
                              "outputTokens": 2000,
                              "latencyMs": 40
                            }
                          ]
                        }
                        """
                            .formatted(PROJECT_ID)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accepted").value(1))
            .andExpect(jsonPath("$.events[0].costUsd").value(0.00135))
            .andReturn();

    JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
    String id = json.get("events").get(0).get("id").asText();
    BigDecimalFromDb cost =
        jdbcTemplate.queryForObject(
            "SELECT cost_usd FROM usage_events WHERE id = ?",
            (rs, rowNum) -> new BigDecimalFromDb(rs.getBigDecimal("cost_usd")),
            id);
    assertThat(cost.value()).isEqualByComparingTo("0.00135000");
  }

  @Test
  void summaryReturnsAggregatesAfterIngest() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "events": [
                        {
                          "projectId": "%s",
                          "provider": "openai",
                          "model": "gpt-4o-mini",
                          "status": "success",
                          "inputTokens": 100,
                          "outputTokens": 50,
                          "costUsd": 0.01,
                          "timestamp": "2026-07-24T10:00:00Z"
                        },
                        {
                          "projectId": "%s",
                          "provider": "anthropic",
                          "model": "claude-haiku-4-20250414",
                          "status": "success",
                          "inputTokens": 200,
                          "outputTokens": 100,
                          "costUsd": 0.02,
                          "timestamp": "2026-07-24T11:00:00Z"
                        }
                      ]
                    }
                    """
                        .formatted(PROJECT_ID, PROJECT_ID)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/usage/summary")
                .param("projectId", PROJECT_ID)
                .param("period", "30d"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projectId").value(PROJECT_ID))
        .andExpect(jsonPath("$.period").value("30d"))
        .andExpect(jsonPath("$.totalRequests").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
        .andExpect(jsonPath("$.totalCostUsd").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0.03)))
        .andExpect(jsonPath("$.byProvider").isArray());
  }

  @Test
  void listEventsAndProjectionEndpoints() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "events": [
                        {
                          "projectId": "%s",
                          "provider": "openai",
                          "model": "gpt-4o-mini",
                          "status": "success",
                          "inputTokens": 10,
                          "outputTokens": 10,
                          "costUsd": 0.7,
                          "timestamp": "2026-07-24T09:00:00Z"
                        }
                      ]
                    }
                    """
                        .formatted(PROJECT_ID)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            get("/api/v1/usage/events")
                .param("projectId", PROJECT_ID)
                .param("from", "2026-07-01T00:00:00Z")
                .param("to", "2026-07-31T23:59:59Z"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    mockMvc
        .perform(get("/api/v1/usage/costs/projection").param("projectId", PROJECT_ID))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projectId").value(PROJECT_ID))
        .andExpect(jsonPath("$.windowDays").value(7))
        .andExpect(jsonPath("$.avgDailyCostUsd").exists())
        .andExpect(jsonPath("$.projectedMonthlyCostUsd").exists());
  }

  @Test
  void ingestRejectsEmptyBatch() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                { "events": [] }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("non-empty")));
  }

  @Test
  void ingestRejectsMalformedBatchWithErrorList() throws Exception {
    long before =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usage_events", Long.class);

    mockMvc
        .perform(
            post("/api/v1/usage/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "events": [
                        {
                          "projectId": "proj_does_not_exist",
                          "provider": "openai",
                          "model": "gpt-4o",
                          "status": "success"
                        },
                        {
                          "projectId": "%s",
                          "provider": "openai",
                          "model": "gpt-4o",
                          "status": "success",
                          "inputTokens": -1
                        }
                      ]
                    }
                    """
                        .formatted(PROJECT_ID)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors").isArray())
        .andExpect(jsonPath("$.errors.length()").value(2))
        .andExpect(jsonPath("$.errors[0]").value(org.hamcrest.Matchers.containsString("Unknown projectId")))
        .andExpect(jsonPath("$.errors[1]").value(org.hamcrest.Matchers.containsString("inputTokens")));

    long after = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usage_events", Long.class);
    assertThat(after).isEqualTo(before);
  }

  private record BigDecimalFromDb(java.math.BigDecimal value) {}
}
