package dev.madmmas.aimanager.user;

import dev.madmmas.aimanager.user.dto.InviteUserRequest;
import dev.madmmas.aimanager.user.dto.UserResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping
  List<UserResponse> list() {
    return userService.list();
  }

  @PostMapping("/invite")
  @ResponseStatus(HttpStatus.CREATED)
  UserResponse invite(@Valid @RequestBody InviteUserRequest request) {
    return userService.invite(request);
  }
}
