package dev.madmmas.aimanager.user;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class UserStatusConverter implements AttributeConverter<UserStatus, String> {

  @Override
  public String convertToDatabaseColumn(UserStatus attribute) {
    return attribute == null ? null : attribute.wireValue();
  }

  @Override
  public UserStatus convertToEntityAttribute(String dbData) {
    return dbData == null ? null : UserStatus.fromWireValue(dbData);
  }
}
