
-- Fix: profiles table "Authenticated users can view all usernames" is too broad
-- Drop the overly permissive policy and keep the existing user-own + admin + moderator policies
DROP POLICY IF EXISTS "Authenticated users can view all usernames" ON public.profiles;
