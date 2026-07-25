package dev.madmmas.aimanager.usage;

import dev.madmmas.aimanager.usage.dto.UsageCostProjectionResponse;
import dev.madmmas.aimanager.usage.dto.UsageEventIngestRequest;
import dev.madmmas.aimanager.usage.dto.UsageEventIngestResponse;
import dev.madmmas.aimanager.usage.dto.UsageEventResponse;
import dev.madmmas.aimanager.usage.dto.UsageSummaryResponse;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Usage telemetry API. Programmatic clients need API-key scopes ({@code usage:write} /
 * {@code usage:read}); JWT users with ADMIN/DEVELOPER (and VIEWER for reads) keep working for the
 * UI.
 */
@RestController
@RequestMapping("/api/v1/usage")
public class UsageController {

  private final UsageService usageService;
  private final UsageSummaryService usageSummaryService;

  public UsageController(UsageService usageService, UsageSummaryService usageSummaryService) {
    this.usageService = usageService;
    this.usageSummaryService = usageSummaryService;
  }

  @PostMapping("/events")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "hasAuthority('usage:write') or hasRole('ADMIN') or hasRole('DEVELOPER')")
  UsageEventIngestResponse ingest(@RequestBody UsageEventIngestRequest request) {
    return usageService.ingest(request);
  }

  @GetMapping("/events")
  @PreAuthorize(
      "hasAuthority('usage:read') or hasRole('ADMIN') or hasRole('DEVELOPER') or hasRole('VIEWER')")
  List<UsageEventResponse> listEvents(
      @RequestParam("projectId") String projectId,
      @RequestParam("from") Instant from,
      @RequestParam("to") Instant to) {
    return usageSummaryService.listEvents(projectId, from, to);
  }

  @GetMapping("/summary")
  @PreAuthorize(
      "hasAuthority('usage:read') or hasRole('ADMIN') or hasRole('DEVELOPER') or hasRole('VIEWER')")
  UsageSummaryResponse summary(
      @RequestParam("projectId") String projectId, @RequestParam("period") String period) {
    return usageSummaryService.summary(projectId, period);
  }

  @GetMapping("/costs/projection")
  @PreAuthorize(
      "hasAuthority('usage:read') or hasRole('ADMIN') or hasRole('DEVELOPER') or hasRole('VIEWER')")
  UsageCostProjectionResponse projection(@RequestParam("projectId") String projectId) {
    return usageSummaryService.projection(projectId);
  }
}
