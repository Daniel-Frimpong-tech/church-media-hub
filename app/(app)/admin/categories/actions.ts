"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/domain/time";
import { revokeDriveGrants } from "@/lib/google/grants";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Could not save. Check your connection and try again.";

export async function createCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { error: "Give the category a name." };
  if (name.length > 40) return { error: "Keep the name under 40 characters." };

  const slug = slugify(name);
  if (!slug) return { error: "Use letters or numbers in the name." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("categories")
    .insert({ name, slug, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `There is already a category called ${name}.` };
    }
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/admin/categories");
  return {
    success: `${name} added. Services created from now on get a ${name} folder.`,
  };
}

export async function setCategoryActive(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = formData.get("id");
  const intent = formData.get("intent");
  if (typeof id !== "string" || !id) return { error: "Category not found." };
  if (intent !== "retire" && intent !== "restore") {
    return { error: "Unknown action." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: intent === "restore" })
    .eq("id", id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/admin/categories");
  return {};
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseDeadlineHours(value: string): number | null {
  const hours = Number(value);
  return Number.isInteger(hours) && hours >= 0 && hours <= 24 * 30 ? hours : null;
}

/** Start delivering a category to a team, with a deadline. */
export async function addCategoryTeam(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const categoryId = field(formData, "category_id");
  const teamId = field(formData, "team_id");
  const hours = parseDeadlineHours(field(formData, "deadline_hours"));
  if (!categoryId) return { error: "Category not found." };
  if (!teamId) return { error: "Choose a team." };
  if (hours === null) return { error: "Enter the deadline as a whole number of hours." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("category_teams")
    .insert({ category_id: categoryId, team_id: teamId, deadline_hours: hours });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "That team already receives this category." };
    }
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/handoffs");
  return {};
}

/** Change a team's deadline, or stop delivering the category to them. */
export async function updateCategoryTeam(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const categoryId = field(formData, "category_id");
  const teamId = field(formData, "team_id");
  const intent = field(formData, "intent");
  if (!categoryId || !teamId) return { error: "Mapping not found." };

  const supabase = await createClient();

  if (intent === "remove") {
    const { data: members } = await supabase
      .from("team_members")
      .select("profile_id")
      .eq("team_id", teamId);
    const { error } = await supabase
      .from("category_teams")
      .delete()
      .eq("category_id", categoryId)
      .eq("team_id", teamId);
    if (error) return { error: GENERIC_ERROR };
    // That team can no longer see this category, so take back any Drive
    // folders its members were given.
    await Promise.all(
      (members ?? []).map((member) => revokeDriveGrants(member.profile_id)),
    );
  } else {
    const hours = parseDeadlineHours(field(formData, "deadline_hours"));
    if (hours === null) return { error: "Enter the deadline as a whole number of hours." };
    const { error } = await supabase
      .from("category_teams")
      .update({ deadline_hours: hours })
      .eq("category_id", categoryId)
      .eq("team_id", teamId);
    if (error) return { error: GENERIC_ERROR };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/handoffs");
  return intent === "remove" ? {} : { success: "Deadline saved." };
}
