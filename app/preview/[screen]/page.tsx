import { notFound } from "next/navigation";
import { CategoriesView } from "@/components/admin/categories-view";
import { LoginView } from "@/components/auth/login-view";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AlbumView } from "@/components/gallery/album-view";
import { GalleryView } from "@/components/gallery/gallery-view";
import { ServiceListView } from "@/components/services/service-list-view";
import { ServiceView } from "@/components/services/service-view";
import { AppShell } from "@/components/shell/app-shell";
import {
  previewAlbum,
  previewCategories,
  previewDashboard,
  previewGallery,
  previewService,
  previewServiceList,
  previewEmptyDashboard,
  previewUpload,
  previewUser,
} from "@/lib/preview/fixtures";

/**
 * Design previews: the real screens with sample data, no sign-in and no
 * database. Local development only; on any deployed build this is a 404.
 */
export default async function PreviewPage({
  params,
}: PageProps<"/preview/[screen]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;

  switch (screen) {
    case "login":
      return <LoginView />;
    case "login-error":
      return <LoginView errorKey="not_invited" />;
    case "dashboard":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/dashboard">
          <DashboardView data={previewDashboard} />
        </AppShell>
      );
    case "dashboard-empty":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/dashboard">
          <DashboardView data={previewEmptyDashboard} />
        </AppShell>
      );
    case "dashboard-member":
      return (
        <AppShell
          user={{ ...previewUser, name: "Grace Mensah", role: "member" }}
          upload={previewUpload}
          currentPath="/dashboard"
        >
          <DashboardView
            data={{ ...previewDashboard, firstName: "Grace", role: "member", canManage: false }}
          />
        </AppShell>
      );
    case "upload":
      return (
        <AppShell
          user={previewUser}
          upload={{ ...previewUpload, initiallyOpen: true }}
          currentPath="/dashboard"
        >
          <DashboardView data={previewDashboard} />
        </AppShell>
      );
    case "dashboard-viewer":
      return (
        <AppShell
          user={{ ...previewUser, name: "Tola Adeyemi", role: "viewer" }}
          upload={null}
          currentPath="/dashboard"
        >
          <DashboardView
            data={{
              ...previewDashboard,
              firstName: "Tola",
              role: "viewer",
              canManage: false,
              canUpload: false,
              myTasks: [],
            }}
          />
        </AppShell>
      );
    case "service":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/services">
          <ServiceView data={previewService} />
        </AppShell>
      );
    case "services":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/services">
          <ServiceListView {...previewServiceList} canManage />
        </AppShell>
      );
    case "album":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/services">
          <AlbumView data={previewAlbum} />
        </AppShell>
      );
    case "gallery":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/gallery">
          <GalleryView data={previewGallery} />
        </AppShell>
      );
    case "categories":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/admin/categories">
          <CategoriesView data={previewCategories} />
        </AppShell>
      );
    case "category-open":
      return (
        <AppShell user={previewUser} upload={previewUpload} currentPath="/admin/categories">
          <CategoriesView data={{ ...previewCategories, openCategoryId: "c2" }} />
        </AppShell>
      );
    default:
      notFound();
  }
}
