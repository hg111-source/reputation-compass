-- Add status column to source_snapshots and make score columns nullable for "not_listed" entries
ALTER TABLE public.source_snapshots 
  ALTER COLUMN score_raw DROP NOT NULL,
  ALTER COLUMN score_scale DROP NOT NULL,
  ALTER COLUMN normalized_score_0_10 DROP NOT NULL;

-- Add status column with default 'found'
ALTER TABLE public.source_snapshots 
  ADD COLUMN status text NOT NULL DEFAULT 'found';

-- Add check constraint for valid status values
ALTER TABLE public.source_snapshots 
  ADD CONSTRAINT source_snapshots_status_check 
  CHECK (status IN ('found', 'not_listed'));