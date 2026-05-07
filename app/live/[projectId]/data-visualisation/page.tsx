import { redirect } from "next/navigation";

type Props = { params: Promise<{ projectId: string }> };

/** Old URL — live analysis now lives at `/live/[projectId]/defects`. */
export default async function LiveDataVisualisationRedirect({ params }: Props) {
  const { projectId } = await params;
  redirect(`/live/${projectId}/defects`);
}
