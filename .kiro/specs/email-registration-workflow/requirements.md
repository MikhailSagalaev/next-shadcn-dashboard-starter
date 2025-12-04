# Requirements Document

## Introduction

Данная спецификация описывает улучшенный сценарий регистрации пользователей в Telegram-боте бонусной системы. Основные изменения:
1. Регистрация начинается с запроса email (вместо контакта)
2. После активации аккаунта бот последовательно запрашивает дату рождения и контакт
3. Расширение модели User полем metadata для хранения произвольных данных

## Glossary

- **Workflow**: Сценарий взаимодействия бота с пользователем, состоящий из узлов (nodes) и связей (connections)
- **User**: Конечный пользователь бонусной системы, привязанный к проекту
- **Email Verification**: Процесс идентификации пользователя по email-адресу
- **Birthday**: Дата рождения пользователя (поле birthDate в модели User)
- **Metadata**: JSON-поле для хранения произвольных пар ключ-значение для пользователя
- **Contact**: Телефонный номер пользователя, получаемый через Telegram API
- **Activation**: Процесс привязки Telegram-аккаунта к существующему пользователю в базе данных

## Requirements

### Requirement 1

**User Story:** As a user, I want to register in the loyalty program using my email, so that I can start earning bonuses without sharing my phone number initially.

#### Acceptance Criteria

1. WHEN a user sends /start command to the bot THEN the Workflow System SHALL display a welcome message requesting email input
2. WHEN a user enters a valid email address THEN the Workflow System SHALL search for an existing user record by email and projectId
3. WHEN a user enters an invalid email format THEN the Workflow System SHALL display an error message and request valid email input
4. WHEN the email is found in the database THEN the Workflow System SHALL proceed to account activation
5. WHEN the email is not found in the database THEN the Workflow System SHALL display a message directing user to register on the website

### Requirement 2

**User Story:** As a user, I want to provide my birthday after account activation, so that I can receive birthday bonuses.

#### Acceptance Criteria

1. WHEN a user account is successfully activated THEN the Workflow System SHALL send a message requesting birthday input
2. WHEN a user enters a valid date in DD.MM.YYYY format THEN the Workflow System SHALL save the birthday to the User record
3. WHEN a user enters a valid date in DD.MM format THEN the Workflow System SHALL save the birthday with current year to the User record
4. WHEN a user enters an invalid date format THEN the Workflow System SHALL display an error message with format examples and request valid input
5. WHEN the birthday is successfully saved THEN the Workflow System SHALL proceed to contact request

### Requirement 3

**User Story:** As a user, I want to optionally share my phone contact after providing birthday, so that I can have additional verification method.

#### Acceptance Criteria

1. WHEN the birthday is saved THEN the Workflow System SHALL send a message requesting phone contact with a share contact button
2. WHEN a user shares contact via Telegram button THEN the Workflow System SHALL save the phone number to the User record
3. WHEN a user skips contact sharing THEN the Workflow System SHALL proceed to the main menu without saving phone
4. WHEN the contact is successfully saved THEN the Workflow System SHALL display success message and show main menu

### Requirement 4

**User Story:** As a project administrator, I want to store additional user properties as key-value pairs, so that I can add custom fields and comments for users.

#### Acceptance Criteria

1. WHEN a User record is created or updated THEN the Database System SHALL support storing arbitrary key-value pairs in metadata field
2. WHEN metadata is queried THEN the Database System SHALL return all stored key-value pairs as JSON object
3. WHEN metadata is updated THEN the Database System SHALL merge new values with existing metadata preserving unmodified keys
4. WHEN a metadata key is set to null THEN the Database System SHALL remove that key from the metadata object

### Requirement 5

**User Story:** As a developer, I want the workflow to handle date parsing correctly, so that user birthdays are stored accurately.

#### Acceptance Criteria

1. WHEN parsing date input THEN the Date Parser SHALL accept formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
2. WHEN parsing date input without year THEN the Date Parser SHALL accept formats: DD.MM, DD/MM, DD-MM and use current year
3. WHEN the parsed date is in the future THEN the Date Parser SHALL reject the input and request valid date
4. WHEN the parsed date results in age over 120 years THEN the Date Parser SHALL reject the input and request valid date
5. WHEN printing a parsed date THEN the Date Formatter SHALL output in DD.MM.YYYY format
