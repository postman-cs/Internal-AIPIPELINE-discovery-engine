-- Sync Phase enum: add new values, remove stale ones
-- New values needed by the application: INFRASTRUCTURE, BUILD_LOG, MEETINGS, WORKING_SESSIONS
-- Stale values no longer in schema: MONITORING, ITERATION

-- Add new enum values
ALTER TYPE "Phase" ADD VALUE IF NOT EXISTS 'INFRASTRUCTURE';
ALTER TYPE "Phase" ADD VALUE IF NOT EXISTS 'BUILD_LOG';
ALTER TYPE "Phase" ADD VALUE IF NOT EXISTS 'MEETINGS';
ALTER TYPE "Phase" ADD VALUE IF NOT EXISTS 'WORKING_SESSIONS';

-- Note: PostgreSQL does not support removing enum values directly.
-- MONITORING and ITERATION remain in the DB but are unused by the application.
-- This is safe — they simply won't be referenced by any new rows.
