import "server-only";
import type { MentorContext } from "@/lib/ai/context";
import { addDays, localDate } from "@/lib/domain/dates";
import type { ServerSupabase } from "@/lib/supabase/server";

const asNumber = (v: unknown): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;

/**
 * Loads the compact mentor context for the signed-in user. Every query runs
 * through RLS as that user. Queries run in parallel.
 */
export async function loadMentorContext(
  supabase: ServerSupabase,
  userId: string,
): Promise<MentorContext> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (profileError || !profile) throw new Error("Profile not found");

  const today = localDate(profile.timezone);

  const [
    education,
    professional,
    venture,
    preferences,
    interests,
    goals,
    skills,
    roadmap,
    actions,
    progress,
    memories,
  ] = await Promise.all([
    supabase
      .from("education_profiles")
      .select(
        "level, school_name, year_in_school, expected_graduation, university_id, universities(name), user_majors(name, kind, position)",
      )
      .eq("user_id", userId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("professional_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("venture_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("career_interests")
      .select("label, certainty")
      .eq("user_id", userId)
      .order("position"),
    supabase
      .from("user_goals")
      .select("title, horizon")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("position"),
    supabase
      .from("user_skills")
      .select("name, category, status")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("roadmaps")
      .select(
        "id, title, north_star, mode, roadmap_milestones(id, horizon, title, status, category, position)",
      )
      .eq("user_id", userId)
      .eq("kind", "career")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("daily_actions")
      .select("action_date, title, category, status")
      .eq("user_id", userId)
      .neq("status", "replaced")
      .gte("action_date", addDays(today, -14))
      .order("action_date", { ascending: false })
      .limit(7),
    supabase.rpc("get_progress_summary", { p_today: today }),
    supabase
      .from("mentor_memories")
      .select("kind, content")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const edu = education.data;
  const universityId = edu?.university_id ?? null;
  const links = universityId
    ? await supabase
        .from("university_resources")
        .select("name, url")
        .eq("university_id", universityId)
        .eq("verification_status", "verified")
        .limit(15)
    : { data: [] as { name: string; url: string }[] };

  const majors = [...(edu?.user_majors ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const progressJson = (progress.data ?? {}) as Record<string, unknown>;
  const HORIZON_ORDER = [
    "today",
    "week",
    "month",
    "term",
    "year",
    "long_term",
  ] as const;

  const location = [
    profile.current_city,
    profile.current_region,
    profile.current_country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    today,
    profile: {
      firstName: profile.first_name,
      userType: profile.user_type,
      location: location || null,
      relocation: profile.relocation_preference,
      preferredLocations: profile.preferred_locations,
      openToRemote: profile.open_to_remote,
      careerCertainty: profile.career_certainty,
    },
    education: edu
      ? {
          level: edu.level,
          school: edu.universities?.name ?? edu.school_name,
          yearInSchool: edu.year_in_school,
          expectedGraduation: edu.expected_graduation,
          majors: majors.filter((m) => m.kind !== "minor").map((m) => m.name),
          minors: majors.filter((m) => m.kind === "minor").map((m) => m.name),
        }
      : null,
    professional: professional.data
      ? {
          currentTitle: professional.data.current_title,
          industry: professional.data.industry,
          yearsExperience: professional.data.years_experience,
          desiredNextRole: professional.data.desired_next_role,
          desiredCareer: professional.data.desired_career,
          stuckPoints: professional.data.stuck_points,
          constraints: professional.data.constraints_note,
          timeline: professional.data.desired_timeline,
        }
      : null,
    venture: venture.data
      ? {
          hasIdea: venture.data.has_idea,
          ideaSummary: venture.data.idea_summary,
          industry: venture.data.industry,
          offeringType: venture.data.offering_type,
          channel: venture.data.channel,
          stage: venture.data.stage,
          targetCustomer: venture.data.target_customer,
        }
      : null,
    preferences: preferences.data
      ? {
          industries: preferences.data.preferred_industries,
          companiesAdmired: preferences.data.companies_admired,
          lifestylePriorities: preferences.data.lifestyle_priorities,
          skillsToLearn: preferences.data.skills_to_learn,
          fiveYearVision: preferences.data.five_year_vision,
          gradSchoolInterest: preferences.data.grad_school_interest,
          entrepreneurshipInterest: preferences.data.entrepreneurship_interest,
        }
      : null,
    careerInterests: interests.data ?? [],
    goals: goals.data ?? [],
    skills: (skills.data ?? []).map((s) => ({
      ...s,
      status: s.status === "target" ? "target" : "current",
    })),
    roadmap: roadmap.data
      ? {
          id: roadmap.data.id,
          title: roadmap.data.title,
          northStar: roadmap.data.north_star,
          mode: roadmap.data.mode === "exploring" ? "exploring" : "directed",
          milestones: [...roadmap.data.roadmap_milestones]
            .sort(
              (a, b) =>
                HORIZON_ORDER.indexOf(a.horizon) -
                  HORIZON_ORDER.indexOf(b.horizon) || a.position - b.position,
            )
            .map(({ id, horizon, title, status, category }) => ({
              id,
              horizon,
              title,
              status,
              category,
            })),
        }
      : null,
    recentActions: (actions.data ?? []).map((a) => ({
      date: a.action_date,
      title: a.title,
      category: a.category,
      status: a.status,
    })),
    progress: {
      totalCompleted: asNumber(progressJson.total_completed),
      activeDaysLast7: asNumber(progressJson.active_days_last_7),
    },
    memories: memories.data ?? [],
    verifiedLinks: links.data ?? [],
  };
}
