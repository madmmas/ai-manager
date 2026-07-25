package dev.madmmas.aimanager.security.dto;

import java.util.List;

public record AuthUserResponse(String id, String email, String name, List<String> roles) {}
