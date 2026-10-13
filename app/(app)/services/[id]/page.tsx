import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceView } from "@/components/services/service-view";
import { requireProfile } from "@/lib/auth";
import { loadServicePage } from "@/lib/service-page";
import { isUuid } from "@/lib/uploads/api";

export const metadata: Metadata = { title: "Service" };

export default async function ServicePage({
  params,
}: PageProps<"/services/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const data = await loadServicePage(profile, id);
  if (!data) notFound();
  return <ServiceView data={data} />;
}
