-- Fix: Admin dashboard shows bonus rules but user Promotions page does not
-- Cause: "Public can view active bonus rules" has strict starts_at/ends_at check
-- Fix: Simplify to only require is_enabled = true so user UI shows active promos
DROP POLICY IF EXISTS "Public can view active bonus rules" ON public.bonus_rules;
CREATE POLICY "Public can view active bonus rules"
ON public.bonus_rules FOR SELECT
TO anon, authenticated
USING (is_enabled = true);
