# Implementation Plan

- [ ] 1. Add OperationMode to database schema
  - [ ] 1.1 Update `prisma/schema.prisma`
    - Add OperationMode enum (WITH_BOT, WITHOUT_BOT)
    - Add operationMode field to Project model with default WITH_BOT
    - _Requirements: 5.1_
  - [ ] 1.2 Create and apply database migration
    - Generate migration with `npx prisma migrate dev`
    - Verify migration applies correctly
    - _Requirements: 5.1_
  - [ ]* 1.3 Write property test for operation mode persistence
    - **Property 4: Operation mode persistence**
    - **Validates: Requirements 5.1**

- [ ] 2. Update user registration logic
  - [ ] 2.1 Update `src/lib/services/user.service.ts`
    - Modify createUser to check project operationMode
    - Set isActive based on mode (true for WITHOUT_BOT, false for WITH_BOT)
    - _Requirements: 2.1, 3.1_
  - [ ]* 2.2 Write property test for user activation based on mode
    - **Property 1: User activation state depends on operation mode**
    - **Validates: Requirements 2.1, 3.1**

- [ ] 3. Update webhook handler
  - [ ] 3.1 Update webhook handler for spend_bonuses action
    - Check project operationMode before processing
    - Skip activation check in WITHOUT_BOT mode
    - Reject inactive users in WITH_BOT mode with clear error
    - _Requirements: 2.3, 3.3, 5.2_
  - [ ]* 3.2 Write property test for bonus spending authorization
    - **Property 3: Bonus spending authorization depends on mode and activation**
    - **Validates: Requirements 2.3, 3.3**
  - [ ]* 3.3 Write property test for webhook mode checking
    - **Property 6: Webhook handler checks operation mode**
    - **Validates: Requirements 5.2**

- [ ] 4. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update bot service initialization
  - [ ] 5.1 Update `src/lib/services/bot-manager.ts` or equivalent
    - Filter projects by operationMode when initializing bots
    - Skip initialization for WITHOUT_BOT projects
    - _Requirements: 5.3_
  - [ ]* 5.2 Write property test for bot initialization filtering
    - **Property 5: Bot service initialization respects operation mode**
    - **Validates: Requirements 5.3**

- [ ] 6. Create UI components for operation mode selection
  - [ ] 6.1 Create `src/features/projects/components/operation-mode-selector.tsx`
    - Radio group or select with two options
    - Show description for each mode
    - Handle onChange with confirmation dialog trigger
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3_
  - [ ] 6.2 Create `src/features/projects/components/operation-mode-confirm-dialog.tsx`
    - Show implications of mode change
    - Show warning if project has existing users
    - Confirm/Cancel buttons
    - _Requirements: 1.4, 4.4_
  - [ ]* 6.3 Write property test for UI visibility based on mode
    - **Property 2: UI visibility adapts to operation mode**
    - **Validates: Requirements 2.2, 2.4, 3.2**

- [ ] 7. Integrate operation mode into project settings
  - [ ] 7.1 Update `src/features/projects/components/project-settings-view.tsx`
    - Add OperationModeSelector component
    - Conditionally show/hide Telegram bot settings based on mode
    - Handle mode change with API call
    - _Requirements: 1.1, 1.3, 1.5, 2.2, 3.2_
  - [ ] 7.2 Update project API endpoint to handle operationMode
    - Update PUT `/api/projects/[projectId]/route.ts`
    - Validate operationMode value
    - Save to database
    - _Requirements: 1.3, 5.1_
  - [ ]* 7.3 Write integration tests for settings page
    - Test mode selector appears
    - Test mode change flow with confirmation
    - Test Telegram settings visibility toggle
    - _Requirements: 1.1, 1.4, 2.2, 3.2_

- [ ] 8. Update user profile display
  - [ ] 8.1 Update user profile components
    - Hide Telegram-related fields in WITHOUT_BOT mode
    - Adapt user status display based on mode
    - _Requirements: 2.4_

- [ ] 9. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
