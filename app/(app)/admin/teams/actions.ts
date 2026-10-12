"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import type { TeamKind } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Could not save. Check your connection and try again.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isTeamKind(value: string): value is TeamKind {
  return value === "media" || value === "receiving";
}

export async function createTeam(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) return { error: "Give the team a name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };

  const kind = text(formData, "kind");
  if (!isTeamKind(kind)) return { error: "Choose what kind of team this is." };

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name, kind });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `There is already a team called ${name}.` };
    }
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/admin/teams");
  return { success: `${name} created.` };
}

/** Add a member, remove a member, or delete the team, chosen by `intent`. */
export async function manageTeam(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const teamId = text(formData, "team_id");
  if (!teamId) return { error: "Team not found." };

  const intent = text(formData, "intent");
  const supabase = await createClient();

  if (intent === "add_member") {
    const profileId = text(formData, "profile_id");
    if (!profileId) return { error: "Choose a person to add." };
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, profile_id: profileId });
    // Adding someone who is already on the team is not worth an error.
    if (error && error.code !== UNIQUE_VIOLATION) return { error: GENERIC_ERROR };
  } else if (intent.startsWith("remove_member:")) {
    const profileId = intent.slice("remove_member:".length);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("profile_id", profileId);
    if (error) return { error: GENERIC_ERROR };
  } else if (intent === "delete_team") {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) return { error: GENERIC_ERROR };
  } else {
    return { error: "Unknown action." };
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/people");
  return {};
}
