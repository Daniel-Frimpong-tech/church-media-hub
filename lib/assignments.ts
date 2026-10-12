import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, UploadRecord } from "@/lib/domain/assignments";
import type { Database } from "@/lib/supabase/database.types";

export type AssignmentDetail = {
  id: string;
  serviceId: string;
  profileId: string;
  dutyRoleId: string;
  tasks: Task[];
};

/** Assignments, with their category tasks, for a set of services. */
export async function loadAssignments(
  supabase: SupabaseClient<Database>,
  serviceIds: string[],
): Promise<AssignmentDetail[]> {
  if (serviceIds.length === 0) return [];

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("*")
    .in("service_id", serviceIds)
    .order("created_at");
  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  if (assignments.length === 0) return [];

  const { data: categories, error: categoriesError } = await supabase
    .from("assignment_categories")
    .select("*")
    .in(
      "assignment_id",
      assignments.map((assignment) => assignment.id),
    );
  if (categoriesError) {
    throw new Error(`Could not load assignments: ${categoriesError.message}`);
  }

  return assignments.map((assignment) => ({
    id: assignment.id,
    serviceId: assignment.service_id,
    profileId: assignment.profile_id,
    dutyRoleId: assignment.duty_role_id,
    tasks: categories
      .filter((row) => row.assignment_id === assignment.id)
      .map((row) => ({
        assignmentId: assignment.id,
        serviceId: assignment.service_id,
        profileId: assignment.profile_id,
        categoryId: row.category_id,
        doneAt: row.done_at,
      })),
  }));
}

/** Finished uploads for a set of services, as the missing-uploads rule needs them. */
export async function loadUploadRecords(
  supabase: SupabaseClient<Database>,
  serviceIds: string[],
): Promise<UploadRecord[]> {
  if (serviceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("uploads")
    .select("service_id, category_id, uploaded_by")
    .in("service_id", serviceIds)
    .eq("status", "complete");
  if (error) throw new Error(`Could not load uploads: ${error.message}`);
  return data.map((row) => ({
    serviceId: row.service_id,
    categoryId: row.category_id,
    uploadedBy: row.uploaded_by,
  }));
}
