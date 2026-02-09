
-- Update properties SELECT policy: all authenticated users can read
DROP POLICY "Users can view their own properties" ON public.properties;
CREATE POLICY "Authenticated users can view all properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (true);

-- Update source_snapshots SELECT policy
DROP POLICY "Users can view their property snapshots" ON public.source_snapshots;
CREATE POLICY "Authenticated users can view all snapshots"
  ON public.source_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Update hotel_aliases SELECT policy
DROP POLICY "Users can view their property aliases" ON public.hotel_aliases;
CREATE POLICY "Authenticated users can view all aliases"
  ON public.hotel_aliases FOR SELECT
  TO authenticated
  USING (true);

-- Update review_analysis SELECT policy
DROP POLICY "Users can view their property analysis" ON public.review_analysis;
CREATE POLICY "Authenticated users can view all analysis"
  ON public.review_analysis FOR SELECT
  TO authenticated
  USING (true);

-- Update review_texts SELECT policy
DROP POLICY "Users can view their property reviews" ON public.review_texts;
CREATE POLICY "Authenticated users can view all reviews"
  ON public.review_texts FOR SELECT
  TO authenticated
  USING (true);

-- Update debug_logs SELECT policy
DROP POLICY "Users can view their debug logs" ON public.debug_logs;
CREATE POLICY "Authenticated users can view all debug logs"
  ON public.debug_logs FOR SELECT
  TO authenticated
  USING (true);

-- Update group_snapshots SELECT policy
DROP POLICY "Users can view their group snapshots" ON public.group_snapshots;
CREATE POLICY "Authenticated users can view all group snapshots"
  ON public.group_snapshots FOR SELECT
  TO authenticated
  USING (true);
