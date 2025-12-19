import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Legacy Bible route - redirects to new studio-integrated Bible page
 * The Bible page is now part of the studio layout for consistent navigation
 */
export default async function LegacyBiblePage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/${id}/studio/bible`);
}
