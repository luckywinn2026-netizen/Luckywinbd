
-- Add 'agent' to app_role enum (separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';
