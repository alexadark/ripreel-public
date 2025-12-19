# ripreel.io - Hackathon Presentation Plan

## Elevator Pitch (30 seconds)

> "ripreel.io turns screenplays into video pitch reels in under 1 hour using n8n-orchestrated AI. Instead of spending 2 weeks and $5,000 on concept artists and editors, filmmakers upload a PDF and our AI pipeline generates character-consistent images, converts them to video with AI audio, and assembles a professional reel - all with human-in-the-loop checkpoints at every stage."

---

## Demo Script (3-5 minutes)

### Opening Hook (30 sec)
"Imagine you're a filmmaker with a great screenplay. To pitch it to studios, you need a visual reel - but that traditionally costs $5,000+ and takes weeks. What if you could do it in under an hour?"

### Live Demo Flow

#### 1. Project Creation (30 sec)
- Show landing page with film production aesthetic
- Upload sample screenplay PDF ("The Family Business" - Godfather-style)
- Select "Film Noir" visual style
- Click create

#### 2. Bible Review (60 sec)
- Show extracted characters (Don Vito, Michael, Kay)
- Generate portrait variants with dual-model selection
- Highlight: "Both Seedream 4.5 AND Nano Banana Pro run simultaneously"
- Select and approve character reference
- Show how character consistency is maintained

#### 3. Scene Validation (30 sec)
- Show screenplay-style scene cards
- Demonstrate inline editing capability
- Bulk approve scenes

#### 4. Image Generation (60 sec)
- Show dual-model variant generation
- Highlight Bible injection: "Character references are automatically composed into prompts"
- Select best variant
- Show refinement with natural language: "Add more dramatic shadows"

#### 5. Video Generation (45 sec)
- Show shot breakdown by AI
- Highlight Veo 3.1 integration: "Video AND audio from a single prompt"
- Play generated video clip with AI dialogue and SFX

#### 6. Timeline & Export (30 sec)
- Drag-drop scene reordering
- Show auto-play preview
- Trigger final assembly
- Show download button

### Closing (15 sec)
"8 n8n workflows, 4 AI models, 1 unified interface - ripreel.io makes professional pitch reels accessible to every filmmaker."

---

## Key Technical Highlights to Mention

### n8n Integration (Primary Focus)
1. **8 Specialized Workflows** - Each phase has dedicated orchestration
2. **MCP Client Pattern** - TypeScript client for workflow invocation
3. **Webhook Architecture** - Real-time status updates
4. **Parallel Processing** - Dual-model generation, batched video processing

### AI Model Orchestration
1. **Gemini 2.5 Flash** - Screenplay parsing with structured output
2. **Seedream 4.5 + Nano Banana Pro** - Parallel image generation
3. **Veo 3.1** - Image-to-video with audio generation

### Human-in-the-Loop Design
1. **4 HITL Checkpoints** - Bible, Scenes, Images, Final Review
2. **Variant Selection** - Multiple options at each stage
3. **Natural Language Refinement** - Iterative improvement

---

## Slide Deck Outline

### Slide 1: Title
- ripreel.io logo
- "AI-Powered Pitch Reels in Under 1 Hour"
- n8n x Anthropic Hackathon 2024

### Slide 2: The Problem
- Traditional pitch reel: 2 weeks, $5,000+
- Requires: Concept artist, storyboard artist, video editor
- Barrier for indie filmmakers

### Slide 3: The Solution
- Upload PDF → Get video reel
- 4 HITL checkpoints for quality control
- Under 1 hour, $0 cost

### Slide 4: Architecture Diagram
- Next.js App → n8n → AI Models
- Show 8 workflow connections
- Highlight parallel processing

### Slide 5: n8n Workflow Deep Dive
- Show actual n8n workflow screenshot
- Highlight key nodes
- Explain orchestration logic

### Slide 6: AI Model Stack
- Gemini 2.5 Flash (Parsing)
- Seedream 4.5 + Nano Banana Pro (Images)
- Veo 3.1 (Video + Audio)

### Slide 7: Demo GIF/Video
- 30-second highlight reel of the app

### Slide 8: Technical Achievements
- 8 n8n workflows
- 4 AI models integrated
- Real-time webhook architecture
- Parallel batch processing

### Slide 9: Future Roadmap
- Veo 3.1 Extend API (shot-to-shot continuity)
- Multi-language support
- Audio mixer controls
- Investor share links

### Slide 10: Thank You
- GitHub repo link
- Live demo URL
- Contact info

---

## Judging Criteria Alignment

### Innovation
- First AI-to-video pipeline for screenplays
- Dual-model parallel generation
- Character consistency via Bible system

### Technical Execution
- 8 production-ready n8n workflows
- Full Next.js 15 / React 19 implementation
- Supabase + PostgreSQL with Drizzle ORM

### Use of n8n
- Core orchestration layer
- Webhook-based async processing
- MCP client integration pattern

### User Experience
- Film production design aesthetic
- HITL checkpoints at every stage
- Inline editing and variant selection

### Completeness
- End-to-end pipeline functional
- PDF in → MP4 out
- Real deployable application

---

## Demo Preparation Checklist

### Before Demo
- [ ] Pre-upload "The Family Business" screenplay
- [ ] Pre-generate Bible characters (save time)
- [ ] Have 2-3 scenes already approved
- [ ] Pre-generate some video clips
- [ ] Test internet connection for n8n calls
- [ ] Have backup screenshots/video if live demo fails

### Demo Environment
- [ ] Chrome browser (incognito for clean state)
- [ ] Close unnecessary tabs
- [ ] Disable notifications
- [ ] Full screen mode ready
- [ ] Backup local recording of demo

### Talking Points Cards
1. "n8n orchestrates 8 specialized workflows"
2. "Dual-model generation for maximum variety"
3. "Veo 3.1 generates video AND audio together"
4. "Human-in-the-loop at every stage"
5. "From PDF to MP4 in under an hour"

---

## Q&A Preparation

### Expected Questions

**Q: How do you maintain character consistency?**
A: The Bible system creates reference images that are automatically composed into scene prompts. n8n injects character/location data into every image generation request.

**Q: Why both Seedream and Nano Banana Pro?**
A: Different models excel at different styles. Running both in parallel gives users more variety to choose from without additional wait time.

**Q: How does the video generation handle audio?**
A: Veo 3.1 accepts a 7-component prompt including dialogue and sounds. It generates synchronized audio directly from the scene description.

**Q: What's the cost per reel?**
A: Currently using API credits during development. Production would use pay-per-use model at approximately $5-15 per reel depending on length.

**Q: How long does a full reel take?**
A: With pre-processed Bible: 30-45 minutes for a 5-scene reel. Most time is in video generation (batched for RAM optimization).

**Q: Can it handle longer screenplays?**
A: Yes, the batch processing system is designed for scale. We limit concurrent video jobs to prevent memory issues on the n8n instance.

---

## Backup Plans

### If n8n is slow/down:
- Switch to pre-recorded demo video
- Show screenshots with narration
- Explain architecture without live generation

### If API rate limited:
- Show already-generated content in database
- Walk through completed project
- Emphasize technical implementation

### If browser crashes:
- Backup tab with same project open
- Pre-loaded screenshots as fallback
- Mobile hotspot for network backup

---

## Post-Presentation Materials

### Leave-Behind Package
1. GitHub repo link (cleaned of ship kit files)
2. Live demo URL
3. Architecture diagram PDF
4. n8n workflow export files
5. Contact information

### Follow-Up Email Template
```
Subject: ripreel.io - n8n x Anthropic Hackathon Submission

Thank you for reviewing ripreel.io!

Quick links:
- Live Demo: [URL]
- GitHub: [URL]
- Demo Video: [YouTube]

Key highlights:
- 8 n8n workflows orchestrating 4 AI models
- PDF screenplay → MP4 pitch reel in <1 hour
- Human-in-the-loop at every stage

Happy to discuss the technical implementation or answer questions.

Best,
[Your Name]
```

---

## Success Metrics

### What Makes a Good Demo
- Show the full pipeline working
- Highlight n8n orchestration prominently
- Demonstrate HITL value (user control)
- Generate at least one new image live
- Play at least one video clip

### Minimum Viable Demo
- Show project creation
- Show pre-generated Bible
- Show scene validation
- Play pre-generated video
- Show timeline assembly
