-- Add a dedicated in-app event for orders received by a project.
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'new_order';
