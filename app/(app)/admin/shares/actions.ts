"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { expiryFromChoice } from "@/lib/domain/share";
import { appUrl } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { closePublicFiles } from "@/lib/share/drive";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uploads/api";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Creates a share link and hands its address back to the form. */
export async function createShareLink(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const label = field(formData, "label");
  if (!label) return { error: "Say who this link is for, so you can find it later." };
  if (label.length > 80) return { error: "Keep that under 80 characters." };

  const expiresAt = expiryFromChoice(field(formData, "expires"), new Date());
  if (expiresAt === undefined) return { error: "Choose when the link expires." };

  const serviceId = field(formData, "service_id");
  const categoryId = field(formData, "category_id");
  if ((serviceId && !isUuid(serviceId)) || (categoryId && !isUuid(categoryId))) {
    return { error: "That is not something a link can be made for." };
  }

  // 32 random bytes: nobody can guess a working link.
  const token = randomBytes(32).toString("base64url");

  const supabase = await createClient();
  const { error } = await supabase.from("share_links").insert({
    token,
    label,
    service_id: serviceId || null,
    category_id: categoryId || null,
    allow_download: formData.get("allow_download") === "on",
    expires_at: expiresAt,
    created_by: admin.id,
  });
  if (error) return { error: "Could not create the link. Try again." };

  revalidatePath("/admin/shares");
  return { success: "Link created.", url: `${appUrl()}/s/${token}` };
}

/** Turns a link off for good. Anyone holding it sees "no longer available". */
export async function revokeShareLink(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = field(formData, "share_id");
  if (!isUuid(id)) return { error: "Link not found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) return { error: "Could not turn the link off. Try again." };

  // Any videos this link opened up in Google Drive go private again. If Drive
  // cannot be reached now, the scheduled job finishes it.
  try {
    await closePublicFiles(id);
  } catch (closeError) {
    console.error("Closing shared files failed", closeError);
  }

  revalidatePath("/admin/shares");
  return {};
}
