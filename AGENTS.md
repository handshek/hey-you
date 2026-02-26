# AGENTS.md — HeyYou

## What is this project?

HeyYou is an AI-powered greeter for physical spaces. A business owner mounts a laptop or iPad at their entrance, configures tone/business type/context, and the AI watches the camera feed in real-time — delivering personalized spoken compliments to anyone who walks by based on what it sees (outfit, accessories, colors, group size, energy).
It uses the Vision Agents SDK by Stream.

## Running locally

Terminal 1: `cd agent && uv run agent.py run`
Terminal 2: `cd frontend && bun dev`

Both must use the same Stream API key. The frontend creates a call, the agent joins it.

**Do not run** Assume already running.

## Architecture

```
frontend/ (Next.js 15, App Router, TypeScript, TailwindCSS, shadcn/ui)
    │
    │  User's browser captures camera via @stream-io/video-react-sdk
    │  Joins a Stream video call with a unique call ID
    │
    ├── WebRTC via Stream Edge Network (~30ms latency)
    │
agent/ (Python 3.12+, vision-agents SDK)
    │
    │  Joins the SAME Stream call as an AI participant
    │  Receives video frames, runs YOLO for person detection,
    │  sends frames to Gemini Realtime for visual understanding + voice output
    │
    └── Speaks compliment back through the call (audio track)
```

The frontend and agent never communicate directly. Both join the same Stream video call using matching call IDs. Stream's edge network routes WebRTC streams between them.

## Monorepo structure

```
/Users/abhi/dev/hey-you
├── agent
│ ├── .env.example _
│ ├── agent.py _ +
│ ├── agent_yolo.py _ +
│ ├── pyproject.toml _
│ ├── uv.lock _
│ └── yolo11n-pose.pt _
├── frontend
│ ├── app
│ │ ├── (dashboard)
│ │ │ ├── spaces
│ │ │ │ ├── [id]
│ │ │ │ │ ├── greeter
│ │ │ │ │ │ ├── layout.tsx _ +
│ │ │ │ │ │ └── page.tsx _ +
│ │ │ │ │ ├── greeter-test
│ │ │ │ │ │ └── page.tsx _ +
│ │ │ │ │ └── page.tsx _ +
│ │ │ │ ├── new
│ │ │ │ │ └── page.tsx _ +
│ │ │ │ └── page.tsx _ +
│ │ │ └── layout.tsx _ +
│ │ ├── api
│ │ │ ├── agent-events
│ │ │ │ └── route.ts _ +
│ │ │ └── stream-token
│ │ │ └── route.ts _ +
│ │ ├── favicon.ico _
│ │ ├── globals.css _
│ │ ├── layout.tsx _ +
│ │ └── page.tsx _ +
│ ├── components
│ │ ├── ui
│ │ │ ├── badge.tsx _ +
│ │ │ ├── button.tsx _ +
│ │ │ ├── card.tsx _ +
│ │ │ ├── dropdown-menu.tsx _ +
│ │ │ ├── input.tsx _ +
│ │ │ ├── label.tsx _ +
│ │ │ ├── select.tsx _ +
│ │ │ ├── separator.tsx _ +
│ │ │ ├── sonner.tsx _ +
│ │ │ └── textarea.tsx _ +
│ │ ├── bot-face.tsx _ +
│ │ ├── greeter-call.tsx _ +
│ │ ├── greeter-screen.tsx _ +
│ │ ├── greeter-yolo-call.tsx _ +
│ │ ├── streaming-text.tsx _ +
│ │ └── voice-waveform.tsx _ +
│ ├── lib
│ │ ├── stream.ts _ +
│ │ └── utils.ts _ +
│ ├── public
│ │ ├── stock
│ │ │ └── street_10.mp4 _
│ │ ├── file.svg _
│ │ ├── globe.svg _
│ │ ├── next.svg _
│ │ ├── vercel.svg _
│ │ └── window.svg _
│ ├── types
│ │ └── index.ts _ +
│ ├── .gitignore _
│ ├── README.md _
│ ├── bun.lock _
│ ├── components.json _
│ ├── eslint.config.mjs _
│ ├── next.config.ts _ +
│ ├── package.json _
│ ├── postcss.config.mjs _
│ └── tsconfig.json _
├── .gitignore _
├── AGENTS.md _
└── README.md _
```

## Tech stack

### Frontend

- Next.js 15 (App Router, server components by default, `"use client"` only where needed)
- TypeScript (strict)
- TailwindCSS v4
- shadcn/ui (New York style, neutral base)
- @stream-io/video-react-sdk (WebRTC video calls)
- framer-motion (bot face animations)
- bun (package manager, see bun.lock)

### Agent

- Python 3.12+
- vision-agents SDK by Stream (v0.3+)
- Plugins: `getstream` (edge network), `gemini` (Realtime LLM with native video), `ultralytics` (YOLO pose detection)
- `uv` package manager

### External services

- **Stream** (getstream.io) — WebRTC video transport, edge network
- **Google Gemini** — Realtime multimodal LLM (sees video + speaks responses)
- **YOLO** (Ultralytics) — Person/pose detection, runs locally

## Key design decisions

1. **Gemini Realtime is the primary LLM** — it handles video understanding AND voice output in a single pipeline. No separate STT/TTS needed. Use `gemini.Realtime(fps=3)`.

2. **YOLO is for triggering, not understanding** — YOLO detects when a person enters the frame and provides pose data. Gemini does the actual visual understanding (outfit, colors, accessories).

3. **The greeter page is fullscreen** — No sidebar, no nav, no chrome. Just the bot face, text, and waveform. This is what gets displayed on the iPad at the entrance.

4. **The bot has personality states** — idle (floating smiley, "Waiting for someone amazing..."), detecting (surprised face, "Oh! Let me get a look at you..."), speaking (happy face, streamed compliment text, voice waveform).

5. **Privacy-first** — No faces are saved, no personal data stored. Camera feed is processed in real-time and discarded.

6. **Video file override for testing** — Use `--video-track-override` flag to test with pre-recorded MP4 files instead of live camera. The stock video is at `frontend/public/stock/street_10.mp4`.

## Known limitations of the Vision Agents SDK

- Video AI struggles with small text — don't rely on reading signs/labels
- Models lose context after ~30 seconds of continuous video — use burst-mode (send frames only when person detected)
- Video alone doesn't trigger responses — must send audio or text prompt to get the model to react
- Response latency is 2-4 seconds from detection to spoken output
- FPS must stay low (1-5) for performance and cost

## Environment variables

### Frontend (`frontend/.env.local`)

```

NEXT_PUBLIC_STREAM_API_KEY=
STREAM_API_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

```

### Agent (`agent/.env`)

```

STREAM_API_KEY=
STREAM_API_SECRET=
GOOGLE_API_KEY=

```

## Rules

1. Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
