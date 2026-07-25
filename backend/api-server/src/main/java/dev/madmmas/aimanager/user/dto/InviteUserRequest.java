package dev.madmmas.aimanager.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InviteUserRequest(
    @NotBlank @Email String email,
    String name,
    @NotBlank String projectId,
    @NotBlank String role) {}
