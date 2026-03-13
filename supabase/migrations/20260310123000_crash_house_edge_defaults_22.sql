ALTER TABLE public.crash_settings
  ALTER COLUMN house_edge_percent SET DEFAULT 22;

UPDATE public.crash_settings
SET house_edge_percent = 22,
    updated_at = now()
WHERE COALESCE(game_id, 'aviator') IN ('aviator', 'rocket', 'jet', 'turbo', 'multi');
