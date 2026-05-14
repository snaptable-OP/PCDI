import { redirect } from "next/navigation";

/** Project creation moved to sidebar project selector (+ New project…). */
export default function LegacyLiveNewProjectRedirect() {
  redirect("/live");
}
