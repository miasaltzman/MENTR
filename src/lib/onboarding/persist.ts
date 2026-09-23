import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Enums, TablesUpdate } from "@/types/database";
import {
  type Answer,
  type AnswerFor,
  type Answers,
  choiceValue,
  isSkipped,
  NOT_SURE,
  type UserType,
} from "./flow";

type Ctx = { supabase: ServerSupabase; userId: string; answers: Answers };

function check<T extends { error: { message: string } | null }>(
  result: T,
  what: string,
): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result;
}

const textOf = (a: Answer | undefined): string | null =>
  a && !isSkipped(a) && "value" in a && typeof a.value === "string"
    ? a.value
    : null;
const listOf = (a: Answer | undefined): string[] =>
  a && !isSkipped(a) && "values" in a
    ? a.values.filter((v) => v !== NOT_SURE)
    : [];
const numberOf = (a: Answer | undefined): number | null =>
  a && !isSkipped(a) && "value" in a && typeof a.value === "number"
    ? a.value
    : null;
const certainty = (v: string | null): Enums<"certainty_level"> | null =>
  v === "yes" || v === "kind_of" || v === "no_idea" ? v : null;

async function updateProfile(
  { supabase, userId }: Ctx,
  fields: TablesUpdate<"profiles">,
) {
  check(
    await supabase.from("profiles").update(fields).eq("id", userId),
    "profile",
  );
}

async function upsertPreferences(
  { supabase, userId }: Ctx,
  fields: TablesUpdate<"user_preferences">,
) {
  check(
    await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, ...fields }, { onConflict: "user_id" }),
    "preferences",
  );
}

async function upsertProfessional(
  { supabase, userId }: Ctx,
  fields: TablesUpdate<"professional_profiles">,
) {
  check(
    await supabase
      .from("professional_profiles")
      .upsert({ user_id: userId, ...fields }, { onConflict: "user_id" }),
    "professional profile",
  );
}

async function upsertVenture(
  { supabase, userId }: Ctx,
  fields: TablesUpdate<"venture_profiles">,
) {
  const existing = check(
    await supabase
      .from("venture_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle(),
    "venture lookup",
  ).data;
  if (existing) {
    check(
      await supabase
        .from("venture_profiles")
        .update(fields)
        .eq("id", existing.id),
      "venture update",
    );
  } else {
    check(
      await supabase
        .from("venture_profiles")
        .insert({ user_id: userId, ...fields }),
      "venture insert",
    );
  }
}

function educationLevel(
  answers: Answers,
): "high_school" | "undergraduate" | "graduate" {
  const type = choiceValue(answers, "user_type");
  if (type === "high_school_student") return "high_school";
  const year = answers.year;
  if (
    year &&
    !isSkipped(year) &&
    "year" in year &&
    year.year === "graduate student"
  )
    return "graduate";
  return "undergraduate";
}

/** Returns the id of the user's current education record, creating it if needed. */
async function ensureEducation(ctx: Ctx): Promise<string> {
  const { supabase, userId, answers } = ctx;
  const level = educationLevel(answers);
  const existing = check(
    await supabase
      .from("education_profiles")
      .select("id, level")
      .eq("user_id", userId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "education lookup",
  ).data;
  if (existing) {
    if (existing.level !== level) {
      check(
        await supabase
          .from("education_profiles")
          .update({ level })
          .eq("id", existing.id),
        "education level",
      );
    }
    return existing.id;
  }
  const inserted = check(
    await supabase
      .from("education_profiles")
      .insert({ user_id: userId, level })
      .select("id")
      .single(),
    "education insert",
  );
  return inserted.data!.id;
}

/** Onboarding facts without a dedicated column become labelled mentor memories. */
async function setMemory(
  ctx: Ctx,
  label: string,
  value: string | null,
  kind: Enums<"memory_kind"> = "context",
) {
  const { supabase, userId } = ctx;
  check(
    await supabase
      .from("mentor_memories")
      .delete()
      .eq("user_id", userId)
      .like("content", `${label}:%`),
    "memory clear",
  );
  if (value) {
    check(
      await supabase.from("mentor_memories").insert({
        user_id: userId,
        kind,
        content: `${label}: ${value}`.slice(0, 500),
        importance: 4,
      }),
      "memory insert",
    );
  }
}

const SOFT_SKILLS: Record<string, Enums<"skill_category">> = {
  writing: "communication",
  "public speaking": "communication",
  "customer service": "communication",
  leadership: "leadership",
  "project management": "leadership",
  sales: "business",
  negotiation: "business",
  networking: "networking",
  "teaching / tutoring": "communication",
};

async function replaceSkills(
  ctx: Ctx,
  names: string[],
  status: "current" | "target",
) {
  const { supabase, userId } = ctx;
  check(
    await supabase
      .from("user_skills")
      .delete()
      .eq("user_id", userId)
      .eq("origin", "onboarding")
      .eq("status", status),
    "skills clear",
  );
  const existing = new Set(
    (
      check(
        await supabase.from("user_skills").select("name").eq("user_id", userId),
        "skills lookup",
      ).data ?? []
    ).map((s) => s.name.toLowerCase()),
  );
  const rows = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()]
    .filter((n) => !existing.has(n.toLowerCase()))
    .map((name) => ({
      user_id: userId,
      name,
      status,
      origin: "onboarding" as const,
      category: SOFT_SKILLS[name.toLowerCase()] ?? ("technical" as const),
    }));
  if (rows.length)
    check(await supabase.from("user_skills").insert(rows), "skills insert");
}

const OFFERING: Record<string, { offering_type: string; channel: string }> = {
  product_online: { offering_type: "product", channel: "online" },
  product_physical: { offering_type: "product", channel: "physical" },
  service_online: { offering_type: "service", channel: "online" },
  service_physical: { offering_type: "service", channel: "physical" },
  both_both: { offering_type: "both", channel: "both" },
};

const HS_AFTER: Record<string, string> = {
  four_year: "4-year college",
  community_college: "Community college",
  trade: "Trade or apprenticeship",
  work: "Start working",
  gap_year: "Gap year",
  [NOT_SURE]: "Not sure yet",
};

const GRAD_STATUS: Record<string, string> = {
  job_searching: "Looking for a job",
  working: "Working",
  grad_school: "In or applying to grad school",
  taking_time: "Taking some time",
  [NOT_SURE]: "Not sure yet",
};

/**
 * Writes one onboarding answer into the structured profile tables.
 * Idempotent: re-answering a question replaces what it wrote before.
 */
export async function persistAnswer(
  ctx: Ctx,
  key: string,
  answer: Answer,
): Promise<void> {
  const { supabase, userId } = ctx;
  const skipped = isSkipped(answer);

  switch (key) {
    case "name": {
      const name = textOf(answer)!;
      return updateProfile(ctx, {
        display_name: name,
        first_name: name.split(" ")[0],
      });
    }
    case "user_type":
      return updateProfile(ctx, { user_type: textOf(answer) as UserType });

    case "school": {
      const a = answer as AnswerFor<"school">;
      const id = await ensureEducation(ctx);
      check(
        await supabase
          .from("education_profiles")
          .update({ university_id: a.id, school_name: a.id ? null : a.name })
          .eq("id", id),
        "school",
      );
      return;
    }
    case "hs_school": {
      const id = await ensureEducation(ctx);
      check(
        await supabase
          .from("education_profiles")
          .update({ school_name: textOf(answer) })
          .eq("id", id),
        "school",
      );
      return;
    }
    case "study": {
      const a = answer as AnswerFor<"study">;
      const id = await ensureEducation(ctx);
      check(
        await supabase
          .from("user_majors")
          .delete()
          .eq("education_profile_id", id),
        "majors clear",
      );
      const rows = [
        a.major ? { name: a.major, kind: "major" } : null,
        a.secondMajor ? { name: a.secondMajor, kind: "second_major" } : null,
        ...a.minors.map((m) => ({ name: m, kind: "minor" })),
      ]
        .filter((r): r is { name: string; kind: string } => r !== null)
        .map((r, position) => ({
          ...r,
          position,
          user_id: userId,
          education_profile_id: id,
        }));
      if (rows.length)
        check(await supabase.from("user_majors").insert(rows), "majors insert");
      return;
    }
    case "year":
    case "hs_year":
    case "grad_date": {
      const a = answer as AnswerFor<"schoolYear">;
      const id = await ensureEducation(ctx);
      check(
        await supabase
          .from("education_profiles")
          .update({
            year_in_school: key === "grad_date" ? "graduated" : a.year,
            expected_graduation: a.graduation ? `${a.graduation}-01` : null,
            is_current: true,
          })
          .eq("id", id),
        "school year",
      );
      return;
    }
    case "gpa": {
      const id = await ensureEducation(ctx);
      check(
        await supabase
          .from("education_profiles")
          .update({ gpa: numberOf(answer) })
          .eq("id", id),
        "gpa",
      );
      return;
    }
    case "hs_after":
      return setMemory(
        ctx,
        "Thinking about after high school",
        HS_AFTER[textOf(answer) ?? ""] ?? null,
        "goal",
      );
    case "grad_status":
      return setMemory(
        ctx,
        "Current status",
        GRAD_STATUS[textOf(answer) ?? ""] ?? null,
      );

    case "current_role":
      return upsertProfessional(ctx, { current_title: textOf(answer) });
    case "industry":
      return upsertProfessional(ctx, { industry: textOf(answer) });
    case "years_experience":
      return upsertProfessional(ctx, { years_experience: numberOf(answer) });
    case "desired_role":
      return upsertProfessional(ctx, { desired_next_role: textOf(answer) });
    case "desired_career":
      return upsertProfessional(ctx, { desired_career: textOf(answer) });
    case "stuck":
      return upsertProfessional(ctx, { stuck_points: textOf(answer) });
    case "constraints":
      return upsertProfessional(ctx, {
        constraints_note: listOf(answer).join("; ") || null,
      });
    case "timeline": {
      const t = textOf(answer);
      return upsertProfessional(ctx, {
        desired_timeline: t === NOT_SURE ? null : t,
      });
    }

    case "venture_has_idea": {
      const v = certainty(textOf(answer));
      return upsertVenture(ctx, {
        has_idea: v,
        stage: v === "no_idea" ? "no_idea_yet" : undefined,
      });
    }
    case "venture_idea":
      return upsertVenture(ctx, { idea_summary: textOf(answer) });
    case "venture_industry":
      return upsertVenture(ctx, { industry: textOf(answer) });
    case "venture_offering": {
      const o = OFFERING[textOf(answer) ?? ""] ?? {
        offering_type: "not_sure",
        channel: "not_sure",
      };
      return upsertVenture(ctx, o);
    }
    case "venture_stage":
      return upsertVenture(ctx, { stage: textOf(answer) });
    case "venture_customer":
      return upsertVenture(ctx, { target_customer: textOf(answer) });
    case "venture_capital": {
      const c = textOf(answer);
      return upsertVenture(ctx, {
        starting_capital_range: c === NOT_SURE ? null : c,
      });
    }
    case "venture_problems":
      return setMemory(
        ctx,
        "Problems they’ve noticed",
        textOf(answer),
        "context",
      );

    case "skills":
      return replaceSkills(ctx, listOf(answer), "current");
    case "learn":
      await replaceSkills(ctx, listOf(answer), "target");
      return upsertPreferences(ctx, { skills_to_learn: listOf(answer) });
    case "interests":
      return upsertPreferences(ctx, { interests: listOf(answer) });
    case "career_certainty":
      return updateProfile(ctx, {
        career_certainty: certainty(textOf(answer)),
      });
    case "career_interests": {
      check(
        await supabase.from("career_interests").delete().eq("user_id", userId),
        "interests clear",
      );
      const level = certainty(choiceValue(ctx.answers, "career_certainty"));
      const rows = [
        ...new Map(listOf(answer).map((l) => [l.toLowerCase(), l])).values(),
      ].map((label, position) => ({
        user_id: userId,
        label,
        position,
        certainty: level,
      }));
      if (rows.length)
        check(
          await supabase.from("career_interests").insert(rows),
          "interests insert",
        );
      return;
    }
    case "vision":
      return upsertPreferences(ctx, { five_year_vision: textOf(answer) });
    case "industries":
      return upsertPreferences(ctx, { preferred_industries: listOf(answer) });
    case "priorities":
      return upsertPreferences(ctx, { lifestyle_priorities: listOf(answer) });
    case "grad_school":
      return upsertPreferences(ctx, {
        grad_school_interest: certainty(textOf(answer)),
      });
    case "entrepreneurship":
      return upsertPreferences(ctx, {
        entrepreneurship_interest: certainty(textOf(answer)),
      });
    case "companies":
      return upsertPreferences(ctx, { companies_admired: listOf(answer) });
    case "salary_goal":
      return upsertPreferences(ctx, { salary_goal: textOf(answer) });

    case "location": {
      if (skipped) {
        return updateProfile(ctx, {
          current_city: null,
          relocation_preference: null,
          preferred_locations: [],
        });
      }
      const a = answer as AnswerFor<"location">;
      return updateProfile(ctx, {
        current_city: a.current,
        relocation_preference: a.relocation,
        preferred_locations: a.places,
        open_to_remote: a.relocation === "remote" ? true : null,
      });
    }

    case "goals": {
      check(
        await supabase
          .from("user_goals")
          .delete()
          .eq("user_id", userId)
          .eq("origin", "onboarding"),
        "goals clear",
      );
      const rows = listOf(answer).map((title, position) => ({
        user_id: userId,
        title,
        position,
        horizon: "year" as const,
        origin: "onboarding" as const,
      }));
      if (rows.length)
        check(await supabase.from("user_goals").insert(rows), "goals insert");
      return;
    }

    default:
      throw new Error(`Unknown onboarding question: ${key}`);
  }
}
