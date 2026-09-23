-- Mentor chat: conversations, messages (with structured suggestions), and
-- compact long-term memories used to build prompt context efficiently.

create table public.mentor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  -- Rolling summary of older messages so prompts stay small.
  summary text,
  summarized_through timestamptz,
  kind text not null default 'chat' check (kind in ('chat', 'checkin', 'onboarding')),
  archived boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index mentor_conversations_user on public.mentor_conversations (user_id, last_message_at desc);

create trigger mentor_conversations_updated_at before update on public.mentor_conversations
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.mentor_conversations');

create table public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  -- Structured, user-confirmable suggestions (add to roadmap, today's action...).
  suggestions jsonb not null default '[]',
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id)
    references public.mentor_conversations (id, user_id) on delete cascade
);

create index mentor_messages_conversation on public.mentor_messages (conversation_id, created_at);

select public.apply_owner_rls('public.mentor_messages');

alter table public.roadmap_milestones
  add constraint roadmap_milestones_source_message_fk
  foreign key (source_message_id, user_id)
  references public.mentor_messages (id, user_id) on delete set null (source_message_id);

create table public.mentor_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.memory_kind not null,
  content text not null check (char_length(content) between 1 and 500),
  importance smallint not null default 3 check (importance between 1 and 5),
  source_message_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_message_id, user_id)
    references public.mentor_messages (id, user_id) on delete set null (source_message_id)
);

create index mentor_memories_user on public.mentor_memories (user_id, is_active, importance desc);

create trigger mentor_memories_updated_at before update on public.mentor_memories
  for each row execute function public.set_updated_at();

select public.apply_owner_rls('public.mentor_memories');
