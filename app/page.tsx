import { redirect } from "next/navigation";

// Signed-out visitors never get this far: proxy.ts sends them to /login.
export default function Home() {
  redirect("/dashboard");
}
