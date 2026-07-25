package dev.madmmas.aimanager.user.dto;

import java.util.List;

public record UserResponse(
    String id, String email, String name, String status, List<String> roles) {}
