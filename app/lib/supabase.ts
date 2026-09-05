import "server-only";

import { createClient, type PostgrestError } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.local.example to .env.local and fill both in.",
  );
}

// Uses a secret key, which bypasses row level security. Never import this from
// a client component.
export const supabase = createClient(url, secretKey, {
  auth: { persistSession: false },
});

const PAGE_SIZE = 1000;

type EqualityFilter = {
  column: string;
  value: string;
};

/**
 * Reads every row of a table, in pages.
 *
 * Supabase refuses to return more than 1000 rows for one request and reports
 * the cut as HTTP 206 rather than an error, so a plain `.select()` hands back
 * partial data with `error` set to null. Any table that grows past 1000 rows
 * — `assignments` and `written_scores` both hold one row per applicant per
 * grader — must be read through here instead.
 *
 * `orderBy` has to be unique: paging over an unordered query lets Postgres
 * return rows in a different order per page, which would duplicate some rows
 * and skip others.
 */
export async function selectAllRows<T>(
  table: string,
  columns: string,
  orderBy = "id",
  filter?: EqualityFilter,
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select(columns)
      .order(orderBy);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) return { data: null, error };
    if (!data) break;

    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

/**
 * 200 ids per request, because the list travels in the query string and a long
 * enough one produces a URL that intermediaries truncate or refuse. It also
 * keeps each response under the row cap above: the callers here read
 * `assignments` and `written_scores`, which hold at most
 * `MAX_GRADERS_PER_APPLICANT` rows per applicant, so 200 ids can return at most
 * 600 rows. Raising either this or that ceiling without checking the product
 * against the 1000-row cap would start silently truncating again.
 */
const IN_CHUNK = 200;

/**
 * Reads the rows whose `column` matches one of `values`.
 *
 * The alternative — reading the table whole and filtering in memory — is what
 * this exists to avoid: a grader's queue is a small fraction of the table, and
 * fetching the rest to discard it is most of the cost of the page.
 */
export async function selectRowsIn<T>(
  table: string,
  columns: string,
  column: string,
  values: string[],
  filter?: EqualityFilter,
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  if (values.length === 0) return { data: [], error: null };

  const rows: T[] = [];

  for (let from = 0; from < values.length; from += IN_CHUNK) {
    let query = supabase
      .from(table)
      .select(columns)
      .in(column, values.slice(from, from + IN_CHUNK));
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query;

    if (error) return { data: null, error };
    rows.push(...((data ?? []) as T[]));
  }

  return { data: rows, error: null };
}
