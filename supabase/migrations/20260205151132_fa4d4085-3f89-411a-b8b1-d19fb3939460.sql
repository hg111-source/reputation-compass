-- Function to delete duplicate snapshots, keeping only the latest per property/source/day
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_snapshots()
RETURNS TABLE(deleted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_deleted integer;
BEGIN
  WITH duplicates AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY property_id, source, DATE(collected_at)
        ORDER BY collected_at DESC
      ) as rn
    FROM source_snapshots
    WHERE property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  )
  DELETE FROM source_snapshots
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN QUERY SELECT rows_deleted;
END;
$$;