-- Task 3 incremental sync introduces `WHERE user_id = ? AND updated_at > ?`
-- delta queries against notifications (see app/api/notifications/my/route.ts
-- delta mode). The existing indexes on this table -
-- idx_notifications_user_created (user_id, created_at desc) and
-- idx_notifications_user_unread (user_id, is_read, created_at desc) - are
-- both ordered by created_at, not updated_at, so neither can satisfy this
-- predicate without a filter scan across the user's full notification
-- history. Purely additive; does not change any query results.
create index if not exists idx_notifications_user_updated
  on public.notifications (user_id, updated_at);

-- Task 3 incremental sync introduces `WHERE updated_at > ?` delta queries
-- against master_data_reviews (see listMasterDataReviews's `updatedAfter`
-- option, used by app/api/master-data/reviews/route.ts delta mode). The only
-- existing index, idx_master_reviews_status, does not include updated_at.
-- Purely additive; does not change any query results.
create index if not exists idx_master_reviews_updated_at
  on public.master_data_reviews (updated_at);
