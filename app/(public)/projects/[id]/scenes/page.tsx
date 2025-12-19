import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Legacy Scenes route - redirects to new studio-integrated Scenes page
 * The Scenes page is now part of the studio layout for consistent navigation
 */
export default async function LegacyScenesPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/${id}/studio/scenes`);
}
