-- Make user_id the primary key for executive_summaries (one summary per user)
-- First drop existing PK, then add unique constraint on user_id

-- Drop the id column and make user_id the primary key
ALTER TABLE public.executive_summaries DROP CONSTRAINT executive_summaries_pkey;
ALTER TABLE public.executive_summaries DROP COLUMN id;
ALTER TABLE public.executive_summaries ADD PRIMARY KEY (user_id);