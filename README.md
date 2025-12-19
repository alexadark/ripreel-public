# ripreel.io

**AI-Powered Film Production Tool** - Create professional video pitch reels from screenplays in under 1 hour (vs 2 weeks + $5,000 traditional cost).

Built for the **n8n x Anthropic Hackathon 2024**.

## What It Does

Upload a screenplay PDF and ripreel.io transforms it into a professional pitch reel through an AI-orchestrated pipeline:

1. **Script Parsing** - AI extracts scenes, characters, locations, and props
2. **Visual Bible** - Generate/upload reference images for character consistency
3. **Scene Images** - Dual-model generation with variant selection
4. **Video Generation** - Image-to-video with Veo 3.1 (includes AI audio)
5. **Timeline Editor** - Drag-and-drop scene reordering
6. **Final Assembly** - FFmpeg stitches videos with crossfade transitions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Storage + PostgreSQL), Drizzle ORM |
| Orchestration | n8n (8 specialized workflows) |
| AI Models | Gemini 2.5 Flash, Seedream 4.5, Nano Banana Pro, Veo 3.1 |
| Video Processing | FFmpeg API Service (Express.js) |

## Architecture

```
                    +------------------+
                    |   Next.js App    |
                    |   (React 19)     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+         +----------v---------+
     |    Supabase     |         |       n8n          |
     | Storage + Auth  |         |   Orchestration    |
     +-----------------+         +----+----+----+-----+
                                      |    |    |
                    +-----------------+    |    +-----------------+
                    |                      |                      |
           +--------v--------+   +---------v-------+   +----------v-------+
           |  Gemini 2.5     |   |  Seedream 4.5   |   |    Veo 3.1       |
           |  (Parsing)      |   |  + Nano Banana  |   |  (Video+Audio)   |
           +-----------------+   +-----------------+   +------------------+
                                                                |
                                                       +--------v--------+
                                                       |  FFmpeg API     |
                                                       |  (Assembly)     |
                                                       +-----------------+
```

## Key Features

### Human-in-the-Loop (HITL) Checkpoints
- **Bible Review** - Approve character/location references before scene generation
- **Scene Validation** - Edit AI-extracted scenes with inline editing
- **Image Selection** - Choose from multiple AI-generated variants
- **Final Review** - Timeline reordering and export approval

### Parallel Processing
- Dual-model image generation (Seedream 4.5 + Nano Banana Pro simultaneously)
- Batched video generation (RAM-optimized for n8n instance)
- Real-time status polling with visual progress indicators

### Film Production Design System
- Dark cinematic aesthetic with yellow (#f5c518) and red (#e02f2f) accents
- Oswald typography for headers, Courier for technical elements
- Clapper card components and screenplay-style scene cards

## Demo

Watch the demo video or try the live app:
- **Demo Video**: [YouTube Link]
- **Live App**: [Deployed URL]

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Supabase project
- n8n instance with 8 configured workflows

### Setup

```bash
# Clone the repo
git clone https://github.com/[your-username]/ripreel.git
cd ripreel

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Configure environment variables (see .env.local.example)

# Run database migrations
npm run db:migrate

# Setup storage buckets
npm run storage:setup

# Start development server
npm run dev
```

### Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
N8N_MCP_URL=https://your-n8n-instance.com
N8N_MCP_API_KEY=your-n8n-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## n8n Workflows

| Workflow | Description |
|----------|-------------|
| `break_script_into_scenes` | Parses screenplay PDF into structured scenes |
| `generate_bible` | Extracts characters, locations, props |
| `image_generation_orchestrator` | Dual-model image generation |
| `image_enhancement_flux` | Natural language image refinement |
| `scene_to_shots` | Divides scenes into 8-second narrative shots |
| `video_generation_veo3` | Veo 3.1 image-to-video with audio |
| `video_generation_simple` | Simplified video generation mode |
| `assembly_line` | FFmpeg video stitching |

## Project Structure

```
ripreel/
├── app/
│   ├── (public)/           # Public routes (demo mode)
│   │   ├── projects/       # Project dashboard and studio
│   │   └── page.tsx        # Landing page
│   ├── actions/            # Server Actions
│   └── api/webhooks/n8n/   # n8n webhook endpoints
├── components/
│   ├── bible/              # Character/location cards
│   ├── scenes/             # Scene validation UI
│   ├── studio/             # Studio layout components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── drizzle/            # Database schema and client
│   ├── n8n/                # MCP client for n8n
│   └── supabase/           # Supabase client
└── ffmpeg-api-service/     # Video assembly microservice
```

## License

MIT License - Built for the n8n x Anthropic Hackathon 2024.

## Credits

Built by [Your Name] with AI assistance from Claude.

---

**ripreel.io** - *Turn Your Screenplay Into A Rip Reel*
