# Mentr

**Your AI mentor for career and life.**

Mentr helps people figure out where they are, where they want to go, and exactly
what to do next — with a personalized roadmap and one small "1%" action every day.

## What's in Phase 1

- **Auth** — magic link / one-time code and Google (Supabase Auth), session refresh in `src/proxy.ts`.
- **Adaptive onboarding** — conversational, one question at a time, different paths for students, high
  schoolers, recent grads, professionals, career changers, founders (with or without an idea), and
  explorers. "Not sure yet" is always valid; core questions build the first plan, deeper ones are optional.
- **Worldwide university search** — ~10k schools from an open dataset, ranked trigram search.
- **Roadmap** — long term → year → semester/quarter → month → week → today, with milestone status,
  add/remove, and a revision log. Exploration mode when the user doesn't know what they want yet.
- **The 1% system** — one 2–10 minute quick win a day — never homework: done (with optional note), undo, why this?, give me
  another, easier, bigger, skip. Weekly priorities. Progress by category, no guilt streaks.
- **Mentor chat** — streaming, persistent context, conversation history, one-tap suggestions
  ("Add to roadmap", "Make this today's 1%"), background memory extraction.
- **Weekly check-in** — four optional questions; the mentor updates priorities and the roadmap.
- **Campus hub** — verified resources only, with source and last-checked date; otherwise honest,
  clearly labelled site searches of the school's own domain.
- **Profile** — edit any answer, rebuild the plan, see and delete what Mentr remembers, saved items,
  low-frequency notification preferences.

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (Radix)
- Supabase (Postgres, Auth, Row Level Security)
- AI provider abstraction (`src/lib/ai`) — Anthropic (`claude-opus-5` by default) with a deterministic,
  rules-based mock for development, tests, and outages
- Zod validation at every boundary (env, forms, AI output, external data)

## Getting started

```bash
npm install
cp .env.example .env.local   # Supabase + (optional) Anthropic keys
npm run dev
```

Without `ANTHROPIC_API_KEY` the app runs in **demo mode** (`AI_PROVIDER=mock`): every AI feature falls back
to built-in rules and the UI says so.

### Supabase setup

1. Create a project, then apply migrations: `supabase link` and `supabase db push`
   (or run `supabase/migrations/*.sql` in order in the SQL editor).
2. Import universities: `npm run db:import-universities` (needs `SUPABASE_SERVICE_ROLE_KEY`), or
   `npm run db:import-universities -- --sql universities.sql` and run the file in the SQL editor.
3. **Auth → URL configuration**: add `http://localhost:3000/**` and your production URL to the
   redirect allow-list.
4. **Auth → Email templates → Magic link**: include both the link and the code so people can sign in on
   any device:

   ```html
   <p>
     <a
       href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
       >Sign in to Mentr</a
     >
   </p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```

5. **Auth → Providers → Google**: enable and add your OAuth client ID/secret.

### Demo persona (local)

`supabase db reset` runs `supabase/seed.sql`, which creates `demo@mentr.local` — a junior at San Diego State
studying Artificial Intelligence (minor: Data Science) interested in AI product management, AI solutions
engineering, and technology entrepreneurship. Sign in with a magic link (local emails appear in Inbucket);
you'll land on "Build my plan". Nothing in the product special-cases this persona.

## Scripts

| Script                           | Purpose                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                    | Local dev server                                                         |
| `npm run lint`                   | ESLint                                                                   |
| `npm run typecheck`              | Route type generation + `tsc --noEmit`                                   |
| `npm test`                       | Unit tests (Vitest)                                                      |
| `npm run db:test`                | Apply all migrations to a scratch Postgres and run RLS / integrity tests |
| `npm run db:types`               | Regenerate `src/types/database.ts` from the migrations                   |
| `npm run db:import-universities` | Import / refresh the worldwide university directory                      |
| `npm run build`                  | Production build                                                         |

`db:test` needs a local Postgres 15+ (set `DB_TEST_URL` to a superuser connection, e.g.
`postgresql://postgres:postgres@localhost:5432/postgres`). CI runs everything above on every push.

## Architecture

```
src/
  app/                 routes: (marketing) landing, (auth) login, onboarding, (app) home / roadmap /
                       explore / mentor / profile / checkin / settings, api/mentor/chat, auth callbacks
  components/          ui (shadcn), app shell, onboarding, dashboard, roadmap, mentor, campus, profile
  lib/
    ai/                provider interface, Anthropic + mock providers, context renderer, prompts, URL guard
    auth/              server actions, session + onboarding guards, safe redirects
    onboarding/        declarative flow (shared), answer persistence (server)
    plan/              schemas + sanitizers, rules-based planner, plan service, actions
    mentor/            chat service, rules-based replies, suggestion schemas
    checkin/ campus/ roadmap/ profile/   feature services and server actions
    data/              RLS-scoped loaders (mentor context, dashboard)
    supabase/          browser / server / admin clients
supabase/migrations    schema, RLS, functions        tests/db   RLS + integrity tests
```

**Context, not the whole database.** Every AI call gets a compact rendering of the user's profile, goals,
open milestones, recent actions, and mentor memories (`renderMentorContext`) — typically 1–2k tokens.
Long chats are folded into a rolling summary.

**Rules fallback everywhere.** Each AI function has a deterministic rules-based counterpart. The mock
provider uses it; the Anthropic provider uses it when the model errors, declines, or returns invalid output.

## Data principles

- Anything time-sensitive (opportunities, news, events, university resources, regulations) must come from
  a real, cited source and store `source_url`, `source_name`, `published_at`, `retrieved_at`, and
  `last_verified_at`.
- The AI personalizes and explains; it never invents facts, organizations, opportunities, or links.
  Model output passes a URL guard that strips any link not backed by a verified record.
- Suggestions from the mentor are never applied automatically — the user taps to accept, and the server
  re-reads the stored suggestion rather than trusting the client.
- Every user-owned table has RLS keyed on `auth.uid()`; composite `(id, user_id)` foreign keys stop users
  attaching rows to someone else's records.

## What's next

- **Phase 2 — live discovery:** ingestion framework (sources, runs, dedupe), RSS news with "why this
  matters", jobs/internships from public ATS feeds, events, resources, clubs, people to learn from, career
  explorer with "how close am I?".
- **Phase 3 — entrepreneurship:** deeper founder flow, business roadmap, sourced local research, unit
  economics calculator.
- **Phase 4 — advanced personalization:** skill graph, adaptive roadmaps, recommendation feedback loops.
- Notification delivery (email) — preferences are stored today; nothing is sent yet.
