# Implementation Plan

- [x] 1. Create API endpoint for fetching user referrals





  - [x] 1.1 Create GET `/api/projects/[projectId]/users/[userId]/referrals/route.ts`


    - Implement query parameters: level, parentId, page, limit
    - Query users where referredBy matches userId or parentId
    - Include bonus balance calculation and referral count
    - Return paginated results with stats
    - _Requirements: 1.2, 4.1, 4.2_
  - [ ]* 1.2 Write property test for referral stats calculation
    - **Property 3: Referral stats calculation accuracy**
    - **Validates: Requirements 2.3**
  - [ ]* 1.3 Write unit tests for API endpoint
    - Test successful referrals fetch
    - Test pagination
    - Test empty referrals case
    - Test error handling
    - _Requirements: 1.2, 1.4, 1.5_

- [x] 2. Create utility functions for referral data processing



  - [x] 2.1 Create `src/lib/utils/referral-utils.ts`


    - Implement `groupReferralsByLevel` function
    - Implement `calculateReferralStats` function
    - Implement `formatReferralUser` function
    - _Requirements: 1.3, 2.1, 2.3_
  - [ ]* 2.2 Write property test for referral grouping
    - **Property 1: Referral grouping by level preserves count accuracy**
    - **Validates: Requirements 1.3, 2.1**
  - [ ]* 2.3 Write property test for pagination integrity
    - **Property 5: Pagination preserves data integrity**
    - **Validates: Requirements 4.2**

- [x] 3. Checkpoint - Make sure all tests are passing


  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create React components for referral display


  - [x] 4.1 Create `src/features/bonuses/components/user-referrals-section.tsx`


    - Implement data fetching with useSWR or useQuery
    - Handle loading, error, and empty states
    - Display ReferralStats component
    - _Requirements: 1.1, 1.4, 1.5, 4.3_

  - [ ] 4.2 Create `src/features/bonuses/components/referral-tree.tsx`
    - Implement hierarchical tree structure
    - Handle expand/collapse state
    - Support lazy loading of sub-levels

    - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4_
  - [ ] 4.3 Create `src/features/bonuses/components/referral-item.tsx`
    - Display referral user info (name, email, date, balance)
    - Show expandable indicator for referrals with children
    - Handle click to expand
    - _Requirements: 2.2, 2.4_
  - [ ]* 4.4 Write property test for referral display fields
    - **Property 2: Referral display contains all required fields**
    - **Validates: Requirements 2.2**
  - [x]* 4.5 Write property test for expandable indicator




    - **Property 4: Expandable indicator consistency**
    - **Validates: Requirements 2.4**

- [ ] 5. Integrate referrals section into user profile dialog
  - [ ] 5.1 Update `src/features/bonuses/components/bonus-management-page.tsx`
    - Add UserReferralsSection to profile dialog



    - Pass userId and projectId props
    - _Requirements: 1.1_
  - [ ]* 5.2 Write integration tests for profile dialog with referrals
    - Test referrals section appears in dialog
    - Test expand/collapse functionality
    - _Requirements: 1.1, 3.1, 3.3_

- [ ] 6. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
