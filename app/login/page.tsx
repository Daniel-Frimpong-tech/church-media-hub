import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  return (
    <LoginView
      errorKey={typeof error === "string" ? error : undefined}
      next={typeof next === "string" ? next : undefined}
    />
  );
}
