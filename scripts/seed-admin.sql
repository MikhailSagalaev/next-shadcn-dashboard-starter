-- Create test admin with verified email
-- Password: Test123! (bcrypt hash for it)
INSERT INTO admin_accounts (id, email, password_hash, email_verified, is_active, role, created_at, updated_at)
VALUES (
  'test-admin-001',
  'test@example.com',
  '$2a$10$K8aQiDJT6S6jqHUfPjhvG.xGX5HpFHN7kqvwF.n3h.Zxs9nQz3kHW',
  true,
  true,
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  email_verified = true,
  is_active = true;
