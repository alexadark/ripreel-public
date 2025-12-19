import { db } from '@/lib/drizzle/db';
import {
  projects,
  projectCharacters,
  projectLocations,
  bibleImageVariants
} from '@/lib/drizzle/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, MapPin, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CharacterCard } from '@/components/bible/character-card';
import { LocationCard } from '@/components/bible/location-card';
import { BibleProgress } from '@/components/bible/bible-progress';
import { SkipBibleButton } from '@/components/bible/skip-bible-button';
import { BulkApproveBibleButton } from '@/components/bible/bulk-approve-bible-button';
import { BibleAutoRefresh } from '@/components/bible/bible-auto-refresh';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioBiblePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    notFound();
  }

  // Fetch Bible assets
  const characters = await db
    .select()
    .from(projectCharacters)
    .where(eq(projectCharacters.project_id, id))
    .orderBy(projectCharacters.created_at);

  // Fetch image variants only for this project's characters
  const characterIds = characters.map((c) => c.id);
  const allCharacterVariants = characterIds.length > 0
    ? await db
        .select()
        .from(bibleImageVariants)
        .where(
          and(
            eq(bibleImageVariants.asset_type, 'character'),
            inArray(bibleImageVariants.asset_id, characterIds)
          )
        )
    : [];

  // Group variants by character ID and shot type
  const variantsByCharacter = new Map<string, Map<string, typeof allCharacterVariants>>();
  for (const variant of allCharacterVariants) {
    if (!variantsByCharacter.has(variant.asset_id)) {
      variantsByCharacter.set(variant.asset_id, new Map());
    }
    const characterVariants = variantsByCharacter.get(variant.asset_id)!;
    const shotType = variant.shot_type || 'unknown';
    if (!characterVariants.has(shotType)) {
      characterVariants.set(shotType, []);
    }
    characterVariants.get(shotType)!.push(variant);
  }

  const locations = await db
    .select()
    .from(projectLocations)
    .where(eq(projectLocations.project_id, id))
    .orderBy(projectLocations.created_at);

  // Fetch image variants only for this project's locations
  const locationIds = locations.map((l) => l.id);
  const allLocationVariants = locationIds.length > 0
    ? await db
        .select()
        .from(bibleImageVariants)
        .where(
          and(
            eq(bibleImageVariants.asset_type, 'location'),
            inArray(bibleImageVariants.asset_id, locationIds)
          )
        )
    : [];

  // Group variants by location ID
  const variantsByLocation = new Map<string, typeof allLocationVariants>();
  for (const variant of allLocationVariants) {
    if (!variantsByLocation.has(variant.asset_id)) {
      variantsByLocation.set(variant.asset_id, []);
    }
    variantsByLocation.get(variant.asset_id)!.push(variant);
  }

  // Calculate approval stats (MVP: portrait only for characters)
  const charApproved = characters.filter(c => c.portrait_status === 'approved').length;
  const locApproved = locations.filter(l => l.image_status === 'approved').length;

  // Check if all required assets are approved (characters + locations required)
  const allApproved =
    characters.length > 0 &&
    charApproved === characters.length &&
    locations.length > 0 &&
    locApproved === locations.length;

  // Count items ready to approve (MVP: portrait only for characters)
  let readyToApproveCount = 0;

  for (const character of characters) {
    // MVP: Only count portrait shot
    if (character.portrait_status === 'approved') continue;

    // Check if there are ready variants for portrait
    const characterVariants = variantsByCharacter.get(character.id);
    if (characterVariants) {
      const portraitVariants = characterVariants.get('portrait') || [];
      const hasReadyVariant = portraitVariants.some(
        (v) => (v.status === 'ready' || v.status === 'selected') && v.image_url
      );
      if (hasReadyVariant) readyToApproveCount++;
    }
  }

  for (const location of locations) {
    if (location.image_status === 'approved') continue;
    const locationVariants = variantsByLocation.get(location.id) || [];
    const hasReadyVariant = locationVariants.some(
      (v) => (v.status === 'ready' || v.status === 'selected') && v.image_url
    );
    if (hasReadyVariant) readyToApproveCount++;
  }

  // Count variants currently generating (for auto-refresh)
  const generatingCount =
    allCharacterVariants.filter((v) => v.status === 'generating').length +
    allLocationVariants.filter((v) => v.status === 'generating').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Instructions */}
      <div className="mb-8 p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
        <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
          Bible Review (HITL Checkpoint #0.5)
        </h2>
        <p className="font-courier text-[#888] text-sm leading-relaxed">
          Review and approve character portraits and location images before scene generation.
          These reference images will be used to maintain visual consistency across all scenes.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#1c1c1f] border border-[#333] rounded mb-6">
        <div className="flex items-center gap-2 text-[#888]">
          <Users size={16} />
          <span className="font-courier text-sm">
            {charApproved}/{characters.length} Characters
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <MapPin size={16} />
          <span className="font-courier text-sm">
            {locApproved}/{locations.length} Locations
          </span>
        </div>
        {readyToApproveCount > 0 && (
          <Badge className="bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518] font-courier text-sm">
            {readyToApproveCount} Ready
          </Badge>
        )}
        <div className="ml-auto">
          <BulkApproveBibleButton projectId={id} readyCount={readyToApproveCount} />
        </div>
      </div>

      {/* Progress Bar */}
      <BibleProgress
        characters={{ total: characters.length, approved: charApproved }}
        locations={{ total: locations.length, approved: locApproved }}
      />

      {/* Tabs */}
      <Tabs defaultValue="characters" className="mt-8">
        <TabsList className="bg-[#1c1c1f] border border-[#333] p-1">
          <TabsTrigger
            value="characters"
            className="font-oswald uppercase tracking-wider data-[state=active]:bg-[#f5c518] data-[state=active]:text-black"
          >
            <Users size={16} className="mr-2" />
            Characters ({characters.length})
          </TabsTrigger>
          <TabsTrigger
            value="locations"
            className="font-oswald uppercase tracking-wider data-[state=active]:bg-[#f5c518] data-[state=active]:text-black"
          >
            <MapPin size={16} className="mr-2" />
            Locations ({locations.length})
          </TabsTrigger>
        </TabsList>

        {/* Characters Tab */}
        <TabsContent value="characters" className="mt-6">
          {characters.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-courier">No characters extracted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  variantsByShot={variantsByCharacter.get(character.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="mt-6">
          {locations.length === 0 ? (
            <div className="text-center py-12 text-[#666]">
              <MapPin size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-courier">No locations extracted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {locations.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  variants={variantsByLocation.get(location.id) || []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        </Tabs>

      {/* Action Buttons */}
      <div className="mt-12 flex justify-center items-center gap-4 flex-wrap">
        <SkipBibleButton projectId={id} />
        <Link
          href={allApproved ? `/projects/${id}/studio/scenes` : '#'}
          className={cn(
            'inline-flex items-center gap-3 font-oswald text-lg uppercase tracking-widest px-8 py-4 transition-all',
            allApproved
              ? 'bg-[#f5c518] hover:bg-white text-black hover:scale-105'
              : 'bg-[#333] text-[#666] cursor-not-allowed pointer-events-none'
          )}
          aria-disabled={!allApproved}
        >
          <CheckCircle size={20} />
          Continue to Scene Validation
        </Link>
      </div>

      {/* Auto-refresh while generating */}
      <BibleAutoRefresh generatingCount={generatingCount} />
    </div>
  );
}
