# ripreel.io User Guide

Complete walkthrough for creating a professional pitch reel from your screenplay.

---

## Overview

ripreel.io transforms your screenplay into a video pitch reel through 6 workflow phases. Each phase includes Human-in-the-Loop (HITL) checkpoints where you review and approve AI-generated content before proceeding.

**Estimated Time**: 30-60 minutes (vs 2+ weeks traditional)

---

## Phase 1: Project Setup

### Step 1.1: Create New Project

1. Click **"Start Your Rip Reel"** on the landing page (or **"New Project"** from the dashboard)
2. Upload your screenplay as a **PDF file**
3. Select a **Visual Style** from the dropdown:
   - Film Noir
   - Sci-Fi Cyberpunk
   - Western
   - Period Drama
   - Modern Thriller
   - Fantasy Epic
   - Horror
   - Romantic Comedy
4. Enter your **Project Name**
5. Click **"Create Project"**

### What Happens Behind the Scenes
- PDF is uploaded to Supabase Storage
- n8n workflow `generate_bible` parses the screenplay
- AI extracts: Characters, Locations, Props, and Scenes
- Project status changes to `bible_review`

---

## Phase 2: Bible Review (HITL Checkpoint #1)

The "Bible" is your visual reference guide - ensuring character and location consistency across all generated images.

### Step 2.1: Review Characters

For each character extracted from your screenplay:

1. **Review the AI-generated description** (age, appearance, costume)
2. **Generate Portrait Images**:
   - Select model(s): **Seedream 4.5**, **Nano Banana Pro**, or **Both**
   - Click **"Generate Variants"**
   - Wait for variants to appear (usually 15-30 seconds each)
3. **Select Best Variant**: Click on your preferred image
4. **Confirm Selection**: Click the confirm button
5. **Approve Character**: Once satisfied, click **"Approve"**

### Step 2.2: Review Locations

For each location:

1. Review the AI-generated description
2. Generate location reference images using the same process
3. Select and approve the best variant

### Step 2.3: Complete Bible Review

- All characters must show a green checkmark
- All locations must show a green checkmark
- Click **"Proceed to Scene Validation"** when ready

---

## Phase 3: Scene Validation (HITL Checkpoint #2)

Review and edit the AI-extracted scenes from your screenplay.

### Step 3.1: Review Each Scene

Each scene card displays:
- **Slugline**: INT/EXT, Location, Time of Day
- **Scene Description**: Visual summary of the scene
- **Characters Present**: Who appears in this scene
- **Dialogue**: Key dialogue lines
- **Action Description**: What happens

### Step 3.2: Edit Scenes (Optional)

Click the **Edit** button on any scene to:
- Modify the scene description
- Add/remove characters
- Edit dialogue
- Adjust the action description

### Step 3.3: Approve Scenes

- **Individual Approval**: Click "Approve" on each scene
- **Bulk Approval**: Use "Approve All Scenes" for faster processing

### Step 3.4: Proceed to Images

Once all scenes are approved, click **"Proceed to Image Generation"**

---

## Phase 4: Image Generation (HITL Checkpoint #3)

Generate the key visual for each scene that will become your video frame.

### Step 4.1: Generate Scene Images

For each scene:

1. **Review the composed prompt** (combines scene + character + location data)
2. **Select AI Model(s)**:
   - **Both Models**: Generates variants from Seedream 4.5 AND Nano Banana Pro
   - **Seedream 4.5**: ByteDance's 4K text-to-image model
   - **Nano Banana Pro**: Google DeepMind's advanced model
3. Click **"Generate Variants"**

### Step 4.2: Select Best Image

- Multiple variants appear in a gallery
- Click to select your preferred image
- Click **"Confirm Selection"** to lock in your choice

### Step 4.3: Refine Images (Optional)

If the selected image needs improvement:

1. Click **"Refine with Feedback"**
2. Enter natural language feedback:
   - "Make the lighting more dramatic"
   - "Add more fog in the background"
   - "Character should look more menacing"
3. New variants are generated based on your feedback

### Step 4.4: Approve Images

- Click **"Approve"** on each scene image
- Approved images are locked for video generation

### Bulk Operations

- **Generate All**: Start image generation for all scenes simultaneously
- **Approve All Ready**: Approve all images that have been selected

---

## Phase 5: Video Generation

Transform your approved images into video clips with AI-generated audio.

### Step 5.1: Automatic Shot Breakdown

The AI divides each scene into narrative "shots" (max 8 seconds each):
- **Subject**: Who/what is the focus
- **Action**: What's happening
- **Scene**: Environmental context
- **Style**: Visual treatment
- **Dialogue**: Character speech
- **Sounds**: SFX and ambient audio
- **Technical**: Camera movement

### Step 5.2: Generate Videos

1. Click **"Generate Videos"** to start
2. Videos generate in batches (2-3 at a time for RAM optimization)
3. Progress indicators show generation status:
   - **Pending**: Queued for generation
   - **Generating**: Currently processing
   - **Ready**: Video complete
   - **Failed**: Error occurred (can retry)

### Step 5.3: Review Generated Videos

- Click the play button to preview each video
- Videos include AI-generated audio (dialogue, SFX, ambient sounds)
- Veo 3.1 generates audio directly from the scene description

---

## Phase 6: Timeline & Export

### Step 6.1: Timeline Editor

The timeline shows all your video clips in sequence:

1. **Drag and Drop**: Reorder scenes by dragging thumbnails
2. **Preview Monitor**: Click any scene to preview it
3. **Auto-Play**: Enable to watch the entire reel continuously
4. **Duration Display**: Shows total reel length

### Step 6.2: Reorder Scenes

- Scenes appear in the order extracted from your screenplay
- Drag scenes to rearrange for better narrative flow
- Changes save automatically

### Step 6.3: Final Preview

Click **"Play All"** to watch your complete reel with:
- All video clips in order
- Crossfade transitions between scenes
- Combined audio track

### Step 6.4: Export Final Reel

1. Click **"Assemble Final Reel"**
2. FFmpeg stitches videos with crossfade transitions
3. Progress bar shows assembly status
4. Download link appears when complete

### Step 6.5: Share Your Reel

- **Download MP4**: Save to your device
- **Generate Share Link**: Create a public preview URL
- **Upload to YouTube**: Direct unlisted upload (coming soon)

---

## Tips for Best Results

### Screenplay Formatting
- Use standard screenplay format (Final Draft, Highland, etc.)
- Include clear sluglines (INT./EXT. LOCATION - TIME)
- Add character descriptions in action lines

### Character Consistency
- Approve Bible images before generating scene images
- Character reference images are injected into scene prompts
- More detailed descriptions = better consistency

### Image Selection
- Generate multiple variants before selecting
- Use "Both Models" for maximum variety
- Refine with specific feedback for better results

### Video Generation
- Batched processing prevents memory issues
- Failed videos can be regenerated individually
- Veo 3.1 audio quality depends on prompt clarity

---

## Troubleshooting

### Images Not Generating
- Check that n8n workflows are active
- Verify API keys in settings
- Try regenerating with a single model

### Video Generation Stuck
- Check n8n instance RAM usage
- Only 2-3 videos generate simultaneously
- Wait for current batch to complete

### Timeline Not Loading
- Ensure all scene videos are in "ready" status
- Refresh the page
- Check browser console for errors

### Assembly Failed
- Verify FFmpeg API service is running
- Check that all videos have valid URLs
- Try regenerating failed video clips

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause preview |
| `Left/Right Arrow` | Previous/Next scene |
| `Enter` | Approve current item |
| `Esc` | Close modal/dialog |

---

## Status Reference

| Status | Meaning |
|--------|---------|
| `pending` | Waiting to be processed |
| `generating` | AI is currently working |
| `ready` | Complete, awaiting approval |
| `approved` | Locked and ready for next phase |
| `failed` | Error occurred, can retry |

---

## Support

For issues or feedback:
- GitHub Issues: [Repository Link]
- Demo Questions: [Contact Email]

---

*Built with n8n, Next.js 15, and AI models from Google, ByteDance, and Anthropic.*
