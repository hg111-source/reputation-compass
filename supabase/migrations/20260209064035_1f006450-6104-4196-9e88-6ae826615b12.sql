CREATE TABLE public.executive_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.executive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own summaries"
  ON public.executive_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own summaries"
  ON public.executive_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own summaries"
  ON public.executive_summaries FOR UPDATE
  USING (auth.uid() = user_id);

-- Only keep one row per user (latest)
CREATE UNIQUE INDEX idx_executive_summaries_user ON public.executive_summaries (user_id);