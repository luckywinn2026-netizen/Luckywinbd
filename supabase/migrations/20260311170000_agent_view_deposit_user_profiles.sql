-- Payment agents need to view profiles of users who made deposits (to show username/user_code in Deposit Management)
DROP POLICY IF EXISTS "Payment agents can view deposit user profiles" ON public.profiles;
CREATE POLICY "Payment agents can view deposit user profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'payment_agent'::app_role)
  );
