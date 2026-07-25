package dev.madmmas.aimanager.user;

import dev.madmmas.aimanager.common.exception.ConflictException;
import dev.madmmas.aimanager.common.util.Ids;
import dev.madmmas.aimanager.project.ProjectRepository;
import dev.madmmas.aimanager.user.dto.InviteUserRequest;
import dev.madmmas.aimanager.user.dto.UserResponse;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

  private final UserRepository userRepository;
  private final MembershipRepository membershipRepository;
  private final ProjectRepository projectRepository;

  public UserService(
      UserRepository userRepository,
      MembershipRepository membershipRepository,
      ProjectRepository projectRepository) {
    this.userRepository = userRepository;
    this.membershipRepository = membershipRepository;
    this.projectRepository = projectRepository;
  }

  @Transactional(readOnly = true)
  public List<UserResponse> list() {
    return userRepository.findAll().stream().map(this::toResponse).toList();
  }

  @Transactional
  public UserResponse invite(InviteUserRequest request) {
    String email = request.email().trim().toLowerCase();
    if (userRepository.existsByEmailIgnoreCase(email)) {
      throw new ConflictException("User already exists for email: " + email);
    }
    if (!projectRepository.existsById(request.projectId())) {
      throw new IllegalArgumentException("Unknown projectId: " + request.projectId());
    }
    MembershipRole role = MembershipRole.fromWireValue(request.role());

    User user = new User();
    user.setId(Ids.next("user_"));
    user.setEmail(email);
    user.setName(
        request.name() == null || request.name().isBlank()
            ? email
            : request.name().trim());
    user.setStatus(UserStatus.INVITED);
    user.setPasswordHash(null);
    userRepository.save(user);

    ProjectMembership membership = new ProjectMembership();
    membership.setUserId(user.getId());
    membership.setProjectId(request.projectId());
    membership.setRole(role);
    membershipRepository.save(membership);

    return toResponse(user);
  }

  @Transactional(readOnly = true)
  public UserResponse toResponse(User user) {
    List<String> roles =
        membershipRepository.findByUserId(user.getId()).stream()
            .map(m -> m.getRole().name())
            .distinct()
            .sorted()
            .toList();
    return new UserResponse(
        user.getId(), user.getEmail(), user.getName(), user.getStatus().wireValue(), roles);
  }

  @Transactional(readOnly = true)
  public List<String> rolesFor(String userId) {
    Set<String> roles = new LinkedHashSet<>();
    for (ProjectMembership membership : membershipRepository.findByUserId(userId)) {
      roles.add(membership.getRole().name());
    }
    return List.copyOf(roles);
  }
}
