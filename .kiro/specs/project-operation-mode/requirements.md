# Requirements Document

## Introduction

Данная функциональность позволяет выбирать режим работы проекта бонусной системы. Проект может работать в двух режимах: с Telegram ботом (требуется активация профиля через бота для траты бонусов) или без Telegram бота (автоматическая активация при регистрации). Это даёт гибкость клиентам, которые не хотят использовать Telegram бота, но хотят использовать бонусную систему.

## Glossary

- **Project** — проект клиента в SaaS бонусной системе
- **Operation_Mode** — режим работы проекта (WITH_BOT или WITHOUT_BOT)
- **WITH_BOT_Mode** — режим с Telegram ботом, требующий активации профиля через бота для траты бонусов
- **WITHOUT_BOT_Mode** — режим без Telegram бота, с автоматической активацией пользователей при регистрации
- **User_Activation** — процесс активации профиля пользователя для возможности тратить бонусы
- **Project_Settings** — страница настроек проекта в административной панели
- **Webhook_Handler** — обработчик входящих webhook запросов от сайта клиента

## Requirements

### Requirement 1

**User Story:** As a project owner, I want to choose the operation mode for my project, so that I can decide whether to use Telegram bot integration or not.

#### Acceptance Criteria

1. WHEN a project owner opens Project_Settings THEN the system SHALL display an Operation_Mode selector
2. WHEN the Operation_Mode selector is displayed THEN the system SHALL show two options: WITH_BOT_Mode and WITHOUT_BOT_Mode
3. WHEN the project owner selects an Operation_Mode THEN the system SHALL save the selection to the database
4. WHEN the Operation_Mode is changed THEN the system SHALL display a confirmation dialog explaining the implications
5. IF the project owner confirms the mode change THEN the system SHALL update the project configuration

### Requirement 2

**User Story:** As a project owner, I want the WITHOUT_BOT_Mode to automatically activate users, so that users can spend bonuses without Telegram integration.

#### Acceptance Criteria

1. WHEN a project operates in WITHOUT_BOT_Mode THEN the system SHALL automatically set isActive to true for new users during registration
2. WHEN a project operates in WITHOUT_BOT_Mode THEN the system SHALL hide Telegram bot configuration options in Project_Settings
3. WHEN a project operates in WITHOUT_BOT_Mode THEN the Webhook_Handler SHALL process bonus spending requests without requiring user activation
4. WHEN displaying user profile in WITHOUT_BOT_Mode THEN the system SHALL hide Telegram-related fields

### Requirement 3

**User Story:** As a project owner, I want the WITH_BOT_Mode to require user activation through Telegram, so that I can ensure users connect their Telegram accounts.

#### Acceptance Criteria

1. WHEN a project operates in WITH_BOT_Mode THEN the system SHALL set isActive to false for new users during registration
2. WHEN a project operates in WITH_BOT_Mode THEN the system SHALL display Telegram bot configuration options in Project_Settings
3. WHEN a user attempts to spend bonuses in WITH_BOT_Mode without activation THEN the Webhook_Handler SHALL reject the request with an appropriate error message
4. WHEN a user activates their profile through Telegram bot THEN the system SHALL set isActive to true

### Requirement 4

**User Story:** As a project owner, I want to see clear information about each mode, so that I can make an informed decision.

#### Acceptance Criteria

1. WHEN displaying the Operation_Mode selector THEN the system SHALL show a description for each mode
2. WHEN WITH_BOT_Mode is selected THEN the system SHALL display information about Telegram bot requirements
3. WHEN WITHOUT_BOT_Mode is selected THEN the system SHALL display information about automatic activation
4. WHEN the project has existing users THEN the system SHALL show a warning about how mode change affects existing users

### Requirement 5

**User Story:** As a system administrator, I want the mode setting to be persisted and respected across all system components, so that the behavior is consistent.

#### Acceptance Criteria

1. WHEN the Operation_Mode is saved THEN the system SHALL store it in the Project database record
2. WHEN the Webhook_Handler processes requests THEN the system SHALL check the project's Operation_Mode
3. WHEN the bot service starts THEN the system SHALL skip initialization for projects in WITHOUT_BOT_Mode
4. WHEN displaying project statistics THEN the system SHALL adapt metrics based on Operation_Mode
