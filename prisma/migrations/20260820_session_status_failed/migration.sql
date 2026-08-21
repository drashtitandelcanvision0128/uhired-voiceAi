-- Add FAILED so stuck LIVE sessions can be auto-abandoned without counting as completed.
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'FAILED';
