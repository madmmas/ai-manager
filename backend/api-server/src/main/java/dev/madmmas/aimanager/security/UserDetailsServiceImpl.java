package dev.madmmas.aimanager.security;

import dev.madmmas.aimanager.user.User;
import dev.madmmas.aimanager.user.UserRepository;
import dev.madmmas.aimanager.user.UserService;
import dev.madmmas.aimanager.user.UserStatus;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

  private final UserRepository userRepository;
  private final UserService userService;

  public UserDetailsServiceImpl(UserRepository userRepository, UserService userService) {
    this.userRepository = userRepository;
    this.userService = userService;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    User user =
        userRepository
            .findByEmailIgnoreCase(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    return toPrincipal(user);
  }

  public AuthUserPrincipal loadById(String userId) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));
    return toPrincipal(user);
  }

  public AuthUserPrincipal toPrincipal(User user) {
    return new AuthUserPrincipal(
        user.getId(),
        user.getEmail(),
        user.getName(),
        user.getPasswordHash(),
        user.getStatus() == UserStatus.ACTIVE,
        userService.rolesFor(user.getId()));
  }
}
