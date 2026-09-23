# Mentr

**Your AI mentor for career and life.**

Mentr helps people figure out where they are, where they want to go, and exactly
what to do next — with a personalized roadmap and one small "1%" action every day.

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (Radix)
- Supabase (Postgres, Auth, Row Level Security)
- AI provider abstraction (`src/lib/ai`) — Anthropic by default, deterministic mock for development/tests
- Zod validation at every boundary (env, AI output, external APIs)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm run dev
```

Without `ANTHROPIC_API_KEY`, set `AI_PROVIDER=mock` to use the deterministic mock mentor.

## Scripts

| Script              | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Local dev server                                             |
| `npm run lint`      | ESLint                                                       |
| `npm run typecheck` | Route type generation + `tsc --noEmit`                       |
| `npm test`          | Unit tests (Vitest)                                          |
| `npm run db:test`   | Apply all migrations to a scratch Postgres and run RLS tests |
| `npm run build`     | Production build                                             |

## Data principles

Anything time-sensitive (opportunities, news, events, university resources,
regulations) must come from a real, cited source and store `source_url`,
`source_name`, `published_at`, `retrieved_at`, and `last_verified_at`. The AI
personalizes and explains; it never invents facts, links, or opportunities.
