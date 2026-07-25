package dev.madmmas.aimanager.guardrail;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
class GuardrailSetControllerIT extends AbstractPostgresIntegrationTest {

  private static final String PROJECT_ID = "proj_ackloop";

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void createSetAndEvaluateWithShortCircuit() throws Exception {
    String keywordId =
        createGuardrail(
            """
            {
              "projectId": "%s",
              "name": "mvc-keyword-%d",
              "type": "keyword-blocklist",
              "stage": "input",
              "config": { "keywords": ["explode"] },
              "action": "block"
            }
            """
                .formatted(PROJECT_ID, System.nanoTime()));
    String lengthId =
        createGuardrail(
            """
            {
              "projectId": "%s",
              "name": "mvc-length-%d",
              "type": "max-length",
              "stage": "input",
              "config": { "maxChars": 2 },
              "action": "block"
            }
            """
                .formatted(PROJECT_ID, System.nanoTime()));

    MvcResult setResult =
        mockMvc
            .perform(
                post("/api/v1/guardrail-sets")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "projectId": "%s",
                          "name": "mvc-set-%d",
                          "shortCircuitOnBlock": true,
                          "guardrailIds": ["%s", "%s"]
                        }
                        """
                            .formatted(PROJECT_ID, System.nanoTime(), keywordId, lengthId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.guardrailIds[0]").value(keywordId))
            .andExpect(jsonPath("$.shortCircuitOnBlock").value(true))
            .andReturn();

    String setId = objectMapper.readTree(setResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(
            post("/api/v1/guardrail-sets/" + setId + "/evaluate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    { "input": "please explode now", "output": "" }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.blocked").value(true))
        .andExpect(jsonPath("$.shortCircuited").value(true))
        .andExpect(jsonPath("$.results.length()").value(1));

    mockMvc
        .perform(
            post("/api/v1/guardrail-sets/" + setId + "/evaluate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "input": "please explode now",
                      "output": "",
                      "shortCircuitOnBlock": false
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.blocked").value(true))
        .andExpect(jsonPath("$.shortCircuited").value(false))
        .andExpect(jsonPath("$.results.length()").value(2));
  }

  private String createGuardrail(String body) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/guardrails").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn();
    JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(json.get("id").asText()).startsWith("gr_");
    return json.get("id").asText();
  }
}
