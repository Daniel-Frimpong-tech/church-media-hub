"use server";

import type { UploadService } from "@/components/upload/upload-provider";
import { getProfile } from "@/lib/auth";
import { loadUploadService } from "@/lib/upload-targets";
import { isUuid } from "@/lib/uploads/api";

/**
 * Looks up one service for the upload sheet. Used when someone taps Upload on
 * a service that is not in the sheet's usual short list, for example one from
 * months ago or one created a moment ago.
 */
export async function fetchUploadService(serviceId: string): Promise<UploadService | null> {
  const profile = await getProfile();
  if (!profile || !isUuid(serviceId)) return null;
  return loadUploadService(profile, serviceId);
}
