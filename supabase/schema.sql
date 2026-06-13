-- Everyday News long-term fact store.
-- Run this in Supabase SQL editor after enabling pgvector:
-- create extension if not exists vector;

create extension if not exists vector;

create table if not exists news_sources (
  id text primary key,
  name text not null,
  category text not null,
  rss_url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id text primary key,
  source_id text references news_sources(id),
  source_name text not null,
  category text not null,
  title text not null,
  url text not null,
  guid text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text,
  unique (url)
);

create table if not exists article_contents (
  article_id text primary key references articles(id) on delete cascade,
  status text not null check (status in ('ok', 'empty', 'unsupported', 'failed')),
  title text,
  excerpt text,
  content_text text,
  error text,
  fetched_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'C')
  ) stored
);

create index if not exists article_contents_search_idx
  on article_contents using gin (search_vector);

create table if not exists article_embeddings (
  article_id text primary key references articles(id) on delete cascade,
  provider text not null,
  model text not null,
  dimension integer not null,
  embedding vector(384) not null,
  embedded_at timestamptz not null default now()
);

create index if not exists article_embeddings_vector_idx
  on article_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists event_clusters (
  id text primary key,
  representative_article_id text references articles(id),
  centroid vector(384) not null,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists article_event_memberships (
  article_id text primary key references articles(id) on delete cascade,
  event_cluster_id text not null references event_clusters(id) on delete cascade,
  similarity double precision not null check (similarity >= 0 and similarity <= 1),
  created_at timestamptz not null default now()
);

create index if not exists article_event_memberships_cluster_idx
  on article_event_memberships(event_cluster_id);

create table if not exists article_metrics (
  id bigserial primary key,
  article_id text not null references articles(id) on delete cascade,
  kind text not null check (kind in ('percent', 'money', 'number')),
  raw_text text not null,
  value double precision,
  unit text,
  context text not null,
  created_at timestamptz not null default now()
);

create table if not exists watchlist_terms (
  id bigserial primary key,
  term text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists watchlist_matches (
  id bigserial primary key,
  article_id text not null references articles(id) on delete cascade,
  term_id bigint not null references watchlist_terms(id) on delete cascade,
  matched_at timestamptz not null default now(),
  unique (article_id, term_id)
);
