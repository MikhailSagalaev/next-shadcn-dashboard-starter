# Implementation Plan

## 1. Database Schema Update

- [x] 1.1 Add metadata field to User model in Prisma schema
  - Add `metadata Json? @default("{}")` field to User model
  - Run `npx prisma migrate dev --name add_user_metadata`
  - Update Prisma client
  - _Requirements: 4.1, 4.2_

## 2. DateParser Service

- [x] 2.1 Create DateParser service
  - Create `src/lib/services/date-parser.ts`
  - Implement `parse(input: string): DateParserResult`
  - Implement `format(date: Date): string`
  - Implement `validate(date: Date): ValidationResult`
  - Support formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD.MM, DD/MM, DD-MM
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.2 Write property test for date parsing round-trip
  - **Property 3: Date parsing round-trip consistency**
  - **Validates: Requirements 5.1, 5.5**

- [x] 2.3 Write property test for multiple date formats
  - **Property 4: Date parsing accepts multiple formats**
  - **Validates: Requirements 5.1**

- [x] 2.4 Write property test for short date format
  - **Property 5: Short date format uses current year**
  - **Validates: Requirements 5.2**

- [x] 2.5 Write property test for future date rejection
  - **Property 6: Future dates are rejected**
  - **Validates: Requirements 5.3**

- [x] 2.6 Write property test for very old date rejection
  - **Property 7: Very old dates are rejected**
  - **Validates: Requirements 5.4**

## 3. Email Validation

- [x] 3.1 Create email validator utility
  - Create `src/lib/utils/email-validator.ts`
  - Implement `validateEmail(input: string): ValidationResult`
  - Return structured result with success/error
  - _Requirements: 1.2, 1.3_

- [x] 3.2 Write property test for email validation
  - **Property 1: Email validation rejects invalid formats**
  - **Property 2: Email validation accepts valid formats**
  - **Validates: Requirements 1.2, 1.3**

## 4. User Metadata Service

- [x] 4.1 Extend UserService with metadata operations
  - Add `getMetadata(userId: string)` method
  - Add `setMetadata(userId: string, key: string, value: any)` method
  - Add `updateMetadata(userId: string, data: Record<string, any>)` method
  - Add `removeMetadataKey(userId: string, key: string)` method
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.2 Write property test for metadata merge
  - **Property 8: Metadata merge preserves existing keys**
  - **Validates: Requirements 4.3**

- [x] 4.3 Write property test for metadata key removal
  - **Property 9: Metadata null removes key**
  - **Validates: Requirements 4.4**

## 5. Checkpoint - Ensure all tests pass
- Ensure all tests pass, ask the user if questions arise.

## 6. Database Query Extensions

- [x] 6.1 Add birthday update query to QueryExecutor
  - Add `update_user_birthday` query
  - Accept userId and birthDate parameters
  - Update User.birthDate field
  - _Requirements: 2.2, 2.3_

- [x] 6.2 Add metadata queries to QueryExecutor
  - Add `update_user_metadata` query
  - Add `get_user_metadata` query
  - Implement merge logic for metadata updates
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6.3 Write property test for birthday persistence
  - **Property 10: Birthday save persists to database**
  - **Validates: Requirements 2.2, 2.3**

## 7. Workflow Template Creation

- [x] 7.1 Create email registration workflow JSON template
  - Create `src/lib/workflow-templates/email-registration.json`
  - Define all nodes: start, check-user, request-email, validate-email, etc.
  - Define all connections between nodes
  - Include variables: telegramUser, contactUser, emailInput, birthdayInput
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 7.2 Implement email request message node
  - Configure welcome message requesting email
  - Remove contact request button from initial message
  - Add "Ввести email" instruction
  - _Requirements: 1.1_

- [x] 7.3 Implement email validation condition node
  - Add condition node to check email format
  - Route to error message on invalid email
  - Route to search on valid email
  - _Requirements: 1.3_

- [x] 7.4 Implement birthday request flow
  - Add message node requesting birthday after activation
  - Add condition node for date validation
  - Add action node to save birthday
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7.5 Implement contact request flow
  - Add message node requesting contact after birthday
  - Add "Поделиться контактом" button
  - Add "Пропустить" button
  - Add action node to save contact
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## 8. Workflow Runtime Integration

- [x] 8.1 Update WorkflowRuntimeService for email input handling
  - Add email input detection in message handler
  - Integrate email validator
  - Pass validated email to workflow context
  - _Requirements: 1.2, 1.3_

- [x] 8.2 Update WorkflowRuntimeService for birthday input handling
  - Add birthday input detection in message handler
  - Integrate DateParser service
  - Pass parsed date to workflow context
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 8.3 Handle skip contact action
  - Detect "Пропустить" button click
  - Route to main menu without saving contact
  - _Requirements: 3.3_

## 9. Checkpoint - Ensure all tests pass
- Ensure all tests pass, ask the user if questions arise.

## 10. Admin UI for Metadata

- [x] 10.1 Add metadata display to user details page
  - Show metadata as key-value table in user profile
  - Display in read-only format initially
  - _Requirements: 4.2_

- [x] 10.2 Add metadata editing capability
  - Add "Добавить поле" button
  - Add inline editing for existing fields
  - Add delete button for each field
  - _Requirements: 4.1, 4.3, 4.4_

## 11. Final Checkpoint - Ensure all tests pass
- Ensure all tests pass, ask the user if questions arise.
