import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioPage({ params }: PageProps) {
  const { id } = await params;

  // Redirect to Bible page under studio layout (Bible-First Architecture)
  redirect(`/projects/${id}/studio/bible`);
}
