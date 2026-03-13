-- Add forced_result column to profiles for admin-controlled outcomes
ALTER TABLE public.profiles ADD COLUMN forced_result text DEFAULT NULL;
-- Values: null (normal), 'loss' (always lose), 'mega_win', 'big_win'

COMMENT ON COLUMN public.profiles.forced_result IS 'Admin-set forced game result: null=normal, loss=always lose, mega_win, big_win';