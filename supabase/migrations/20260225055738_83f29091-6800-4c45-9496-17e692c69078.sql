
-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  language text NOT NULL DEFAULT 'bn',
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Agents can view assigned conversations" ON public.chat_conversations FOR SELECT USING (has_role(auth.uid(), 'agent'));
CREATE POLICY "Agents can update assigned conversations" ON public.chat_conversations FOR UPDATE USING (has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins can manage all conversations" ON public.chat_conversations FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Agents can view assigned messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'agent'));
CREATE POLICY "Agents can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins can manage all messages" ON public.chat_messages FOR ALL USING (has_role(auth.uid(), 'admin'));

-- FAQ table for rapid solutions (user-facing)
CREATE TABLE public.chat_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bn text NOT NULL,
  question_en text NOT NULL,
  answer_bn text NOT NULL,
  answer_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active FAQ" ON public.chat_faq FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage FAQ" ON public.chat_faq FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Canned responses for agents
CREATE TABLE public.chat_canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message_bn text NOT NULL,
  message_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can read canned responses" ON public.chat_canned_responses FOR SELECT USING (has_role(auth.uid(), 'agent') AND is_active = true);
CREATE POLICY "Admins can manage canned responses" ON public.chat_canned_responses FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Agent settings table
CREATE TABLE public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  max_chats integer NOT NULL DEFAULT 10,
  is_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own settings" ON public.agent_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Agents can update own settings" ON public.agent_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all agent settings" ON public.agent_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default FAQs
INSERT INTO public.chat_faq (question_bn, question_en, answer_bn, answer_en, sort_order) VALUES
('কিভাবে ডিপোজিট করবো?', 'How to deposit?', 'Account > Deposit এ যান, payment method সিলেক্ট করুন, amount দিন এবং TrxID সাবমিট করুন।', 'Go to Account > Deposit, select payment method, enter amount and submit TrxID.', 1),
('উইথড্র কতক্ষণ লাগে?', 'How long does withdrawal take?', 'সাধারণত ১-২৪ ঘণ্টার মধ্যে প্রসেস হয়।', 'Usually processed within 1-24 hours.', 2),
('মিনিমাম উইথড্র কত?', 'What is minimum withdrawal?', 'মিনিমাম উইথড্র ৳500।', 'Minimum withdrawal is ৳500.', 3),
('বোনাস কিভাবে পাবো?', 'How to get bonus?', 'প্রতিটি ডিপোজিটে ২.২৫% বোনাস অটোমেটিক যোগ হয়।', 'Every deposit gets 2.25% bonus automatically.', 4);

-- Insert default canned responses
INSERT INTO public.chat_canned_responses (title, message_bn, message_en, sort_order) VALUES
('Greeting', 'আসসালামু আলাইকুম! আমি কিভাবে সাহায্য করতে পারি?', 'Hello! How can I help you?', 1),
('Deposit Issue', 'আপনার ডিপোজিট প্রসেস করা হচ্ছে, দয়া করে কিছুক্ষণ অপেক্ষা করুন।', 'Your deposit is being processed, please wait.', 2),
('Withdraw Info', 'উইথড্র সাধারণত ১-২৪ ঘণ্টার মধ্যে প্রসেস হয়।', 'Withdrawals are usually processed within 1-24 hours.', 3),
('Closing', 'আর কোনো সাহায্য লাগলে জানাবেন। ধন্যবাদ!', 'Let me know if you need further help. Thank you!', 4);

-- Function to assign conversation to available agent
CREATE OR REPLACE FUNCTION public.assign_agent_to_conversation(p_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT as2.user_id INTO v_agent_id
  FROM public.agent_settings as2
  JOIN public.user_roles ur ON ur.user_id = as2.user_id AND ur.role = 'agent'
  WHERE as2.is_online = true
  AND (
    SELECT COUNT(*) FROM public.chat_conversations cc 
    WHERE cc.agent_id = as2.user_id AND cc.status = 'active'
  ) < as2.max_chats
  ORDER BY (
    SELECT COUNT(*) FROM public.chat_conversations cc 
    WHERE cc.agent_id = as2.user_id AND cc.status = 'active'
  ) ASC
  LIMIT 1;

  IF v_agent_id IS NOT NULL THEN
    UPDATE public.chat_conversations 
    SET agent_id = v_agent_id, status = 'active', updated_at = now()
    WHERE id = p_conversation_id;
  END IF;

  RETURN v_agent_id;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chat_faq_updated_at BEFORE UPDATE ON public.chat_faq FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chat_canned_responses_updated_at BEFORE UPDATE ON public.chat_canned_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
