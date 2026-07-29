-- Schema for accounts, lists and saved artworks.
--
-- Idempotent throughout, so it is safe to re-run: paste it into the Neon SQL
-- Editor, or run `npm run db:push`. There is no migration tool here on purpose
-- — this is the whole schema, and re-applying it is the only operation.
--
-- If you ever need to change a column rather than add one, add the ALTER
-- below the CREATE that owns it rather than editing the CREATE in place, or
-- existing databases will silently drift from new ones.

create table if not exists users (
  id           bigint generated always as identity primary key,
  google_sub   text        not null unique,  -- Google's stable subject id
  email        text        not null,
  -- What Google last told us. Refreshed on every sign-in.
  name         text,
  -- What the user chose to be called. Owned by the user, never touched by the
  -- login upsert — if this shared a column with `name`, every sign-in would
  -- silently overwrite it. NULL means "hasn't set one", which is deliberately
  -- distinguishable from '' so clearing the field falls back to `name`.
  display_name text,
  picture_url  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists lists (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references users(id) on delete cascade,
  name       text        not null,
  -- The auto-created "Saved" list. Cannot be deleted; can be renamed.
  is_default boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Case-insensitive per-user name uniqueness: "Studies" and "studies" collide.
create unique index if not exists lists_user_name_key
  on lists (user_id, lower(name));

-- Exactly one default list per user, enforced by the database rather than by
-- application code that would otherwise have to race with itself when two
-- tabs sign in at the same moment.
create unique index if not exists lists_one_default_per_user
  on lists (user_id) where is_default;

create index if not exists lists_user_id_idx on lists (user_id);

create table if not exists list_items (
  id       bigint      generated always as identity primary key,
  list_id  bigint      not null references lists(id) on delete cascade,
  uid      text        not null,  -- Artwork.uid, `${sourceId}:${originalId}`
  -- The full Artwork snapshot. MuseumSource exposes only search(), never
  -- getById, so a uid can never be resolved back into an artwork later —
  -- this row IS the artwork. blurDataUrl is stripped before insert; it is a
  -- 1-2 KB base64 blob (AIC only) worth keeping out of every row.
  artwork  jsonb       not null,
  saved_at timestamptz not null default now()
);

-- The same artwork can't be saved twice to one list. Also serves as the
-- (list_id, ...) prefix index behind every per-list read and the saved-map join.
create unique index if not exists list_items_list_uid_key
  on list_items (list_id, uid);

create index if not exists list_items_list_saved_idx
  on list_items (list_id, saved_at desc);
