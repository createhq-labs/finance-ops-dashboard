-- /api/submissions/finance and /api/submissions/my both run
-- .order('submitted_at', { ascending: false }) unconditioned on
-- financial_year. The existing intake_submissions_financial_year_submitted_at_idx
-- index is (financial_year, submitted_at desc), which Postgres can only use
-- for this ordering when a financial_year predicate is present - it is not
-- usable for these routes' current query shape. This adds a plain index on
-- submitted_at so the sort (and any unfiltered scan) can use an index instead
-- of a full sort of the scanned rows. Purely additive; does not change any
-- query results.
create index if not exists idx_submissions_submitted_at
  on public.intake_submissions (submitted_at desc);

-- /api/submissions/my always filters `.eq('submitted_by', appUser.id)` and
-- orders by submitted_at desc with DB-side range() pagination (see
-- app/api/submissions/my/route.ts). The existing idx_submissions_submitted_by
-- index is single-column, so Postgres still has to sort the matching rows
-- separately after using it. This composite index lets the same query use a
-- single index scan that is already in submitted_at order, matching the
-- predicate + order-by exactly. Purely additive; does not change any query
-- results.
create index if not exists idx_submissions_submitted_by_submitted_at
  on public.intake_submissions (submitted_by, submitted_at desc);
