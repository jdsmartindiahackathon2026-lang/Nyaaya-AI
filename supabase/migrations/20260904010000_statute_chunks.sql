-- Extension
create extension if not exists vector with schema extensions;

-- Table
create table if not exists public.statute_chunks (
  id                text primary key,
  statute_id        text not null,
  statute_display   text not null,
  section_number    text not null,
  section_title     text,
  clause_id         text,
  text              text not null,
  page_number       int,
  citation_url      text,
  deep_link         text,
  embedding         extensions.vector(384) not null,
  created_at        timestamptz not null default now()
);

create index if not exists statute_chunks_statute_id_idx
  on public.statute_chunks (statute_id);

create index if not exists statute_chunks_embedding_hnsw
  on public.statute_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table public.statute_chunks enable row level security;

create policy "statute_chunks_read_authenticated"
  on public.statute_chunks for select
  to authenticated
  using (true);

create or replace function public.match_statute_chunks(
  query_embedding extensions.vector(384),
  match_threshold float default 0.65,
  match_count     int   default 8
)
returns table (
  id              text,
  statute_id      text,
  statute_display text,
  section_number  text,
  section_title   text,
  clause_id       text,
  text            text,
  page_number     int,
  citation_url    text,
  deep_link       text,
  similarity      float
)
language sql stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id, c.statute_id, c.statute_display, c.section_number, c.section_title,
    c.clause_id, c.text, c.page_number, c.citation_url, c.deep_link,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.statute_chunks c
  where 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_statute_chunks(extensions.vector, float, int)
  to authenticated, service_role;
