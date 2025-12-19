import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Drizzle
    DATABASE_URL: z.string().url(),

    // Supabase (server-only, not exposed to browser)
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // n8n Workflow Webhooks (all optional - only add what you use)
    N8N_PARSE_SCREENPLAY_WEBHOOK: z.string().url().optional(),
    N8N_IMAGE_GENERATION_WEBHOOK: z.string().url().optional(),
    N8N_GENERATE_BIBLE_WEBHOOK: z.string().url().optional(),
    N8N_GENERATE_SCENES_WEBHOOK: z.string().url().optional(),
    N8N_FLUX_ENHANCEMENT_WEBHOOK: z.string().url().optional(),
    N8N_VIDEO_GENERATION_WEBHOOK: z.string().url().optional(),
    N8N_SCENE_TO_SHOTS_WEBHOOK: z.string().url().optional(),
    N8N_VIDEO_GENERATION_SIMPLE_WEBHOOK: z.string().url().optional(),
    N8N_ASSEMBLY_WEBHOOK: z.string().url().optional(),

    // AI Providers (optional - not needed until Phase 5+ for image generation)
    OPENROUTER_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // Bible webhooks - optional during initial deployment
    NEXT_PUBLIC_BIBLE_CHARACTER_WEBHOOK: z.string().url().optional(),
    NEXT_PUBLIC_BIBLE_LOCATION_WEBHOOK: z.string().url().optional(),
    NEXT_PUBLIC_BIBLE_PROP_WEBHOOK: z.string().url().optional(),
  },
  runtimeEnv: {
    // Server variables
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    N8N_PARSE_SCREENPLAY_WEBHOOK: process.env.N8N_PARSE_SCREENPLAY_WEBHOOK,
    N8N_IMAGE_GENERATION_WEBHOOK: process.env.N8N_IMAGE_GENERATION_WEBHOOK,
    N8N_GENERATE_BIBLE_WEBHOOK: process.env.N8N_GENERATE_BIBLE_WEBHOOK,
    N8N_GENERATE_SCENES_WEBHOOK: process.env.N8N_GENERATE_SCENES_WEBHOOK,
    N8N_FLUX_ENHANCEMENT_WEBHOOK: process.env.N8N_FLUX_ENHANCEMENT_WEBHOOK,
    N8N_VIDEO_GENERATION_WEBHOOK: process.env.N8N_VIDEO_GENERATION_WEBHOOK,
    N8N_SCENE_TO_SHOTS_WEBHOOK: process.env.N8N_SCENE_TO_SHOTS_WEBHOOK,
    N8N_VIDEO_GENERATION_SIMPLE_WEBHOOK: process.env.N8N_VIDEO_GENERATION_SIMPLE_WEBHOOK,
    N8N_ASSEMBLY_WEBHOOK: process.env.N8N_ASSEMBLY_WEBHOOK,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,

    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BIBLE_CHARACTER_WEBHOOK: process.env.NEXT_PUBLIC_BIBLE_CHARACTER_WEBHOOK,
    NEXT_PUBLIC_BIBLE_LOCATION_WEBHOOK: process.env.NEXT_PUBLIC_BIBLE_LOCATION_WEBHOOK,
    NEXT_PUBLIC_BIBLE_PROP_WEBHOOK: process.env.NEXT_PUBLIC_BIBLE_PROP_WEBHOOK,
  },
});
