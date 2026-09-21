import 'server-only';

// PostgREST encodes a Supabase `.in('col', ids)` filter as a literal
// comma-separated list in the request URL. With enough ids (a few hundred
// UUIDs) that URL can exceed the HTTP client's max header/request-line size
// and fail at the connection layer (e.g. undici's UND_ERR_HEADERS_OVERFLOW)
// rather than as an ordinary Supabase/Postgres error. Splitting a large id
// list into bounded batches keeps each request's URL well under that limit.
//
// 100 ids per batch keeps a UUID `.in(...)` filter well under a few KB, far
// short of the ~16KB failure boundary observed in production, without being
// so small that it multiplies request count unnecessarily for the current
// data volumes.
export const DEFAULT_ID_BATCH_SIZE = 100;

export function chunkArray<T>(items: T[], chunkSize: number = DEFAULT_ID_BATCH_SIZE): T[][] {
  if (chunkSize <= 0) throw new Error('chunkSize must be a positive number');
  if (items.length === 0) return [];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

/**
 * Runs a Supabase `.in(...)`-style lookup across bounded batches of ids and
 * merges the results. If any batch errors, throws immediately without
 * returning a partial/incomplete result set.
 */
export async function fetchRowsForIdsInBatches<T>(
  ids: string[],
  fetchBatch: (batchIds: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  chunkSize: number = DEFAULT_ID_BATCH_SIZE
): Promise<T[]> {
  if (ids.length === 0) return [];

  const batches = chunkArray(ids, chunkSize);
  const results = await Promise.all(batches.map((batch) => fetchBatch(batch)));

  const rows: T[] = [];
  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
    rows.push(...(result.data ?? []));
  }
  return rows;
}
