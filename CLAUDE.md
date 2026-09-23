@AGENTS.md

# Mentr — project notes

- Product name is **Mentr** everywhere (use `brand` from `src/lib/brand.ts`).
- Server-only secrets live in `src/lib/env.ts` (`server-only`); browser-safe values in `src/lib/public-env.ts`.
- Database changes go through `supabase/migrations/*` only. Every user-owned table has RLS keyed on `auth.uid()`.
- Retrieval of facts and AI personalization are separate. The AI may only reference records by id from a supplied candidate list; never let it produce URLs or opportunities.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build` (and `npm run db:test` when migrations change).
