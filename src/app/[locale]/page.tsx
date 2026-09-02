import { redirect } from "next/navigation";

// The Hive Commons docs site has no marketing landing page — the docs are the
// site. Send visitors straight to the documentation.
export default function Home() {
  redirect("/docs");
}
