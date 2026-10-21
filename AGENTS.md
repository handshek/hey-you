# AGENTS.md — HeyYou

## What is this project?

HeyYou is an AI-powered greeter for physical spaces. A business owner mounts a laptop or iPad at their entrance, configures tone/business type/context, and the AI watches the camera feed in real-time — delivering personalized spoken compliments to anyone who walks by based on what it sees (outfit, accessories, colors, group size, energy).
It uses the Vision Agents SDK by Stream.

## Running locally

Terminal 1: `cd frontend && bun run dev`
Terminal 2: `cd agent && uv run agent_yolo.py serve --host 127.0.0.1 --port 8000`

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
agent/ (Python 3.11+, vision-agents SDK)
    │
    │  Joins the SAME Stream call as an AI participant
    │  Receives video frames, runs YOLO for person detection,
    │  sends frames to Claude Haiku (via OpenRouter) for visual understanding
    │
    └── Speaks compliment back through the call (audio track)
```

The frontend and agent never communicate directly. Both join the same Stream video call using matching call IDs. Stream's edge network routes WebRTC streams between them.

## Monorepo structure

```
├── agent
│   ├── .env.example *
│   ├── agent.py * +
│   ├── agent_yolo.py * +
│   ├── pyproject.toml *
│   ├── uv.lock *
│   └── yolo11n-pose.pt *
├── frontend
│   ├── app
│   │   ├── api
│   │   │   ├── agent-events
│   │   │   │   └── route.ts * +
│   │   │   ├── agent-session
│   │   │   │   ├── start
│   │   │   │   │   └── route.ts * +
│   │   │   │   └── stop
│   │   │   │       └── route.ts * +
│   │   │   └── stream-token
│   │   │       └── route.ts * +
│   │   ├── create
│   │   │   └── page.tsx * +
│   │   ├── greeter
│   │   │   ├── [id]
│   │   │   │   └── page.tsx * +
│   │   │   └── demo
│   │   │       └── page.tsx * +
│   │   ├── favicon.ico *
│   │   ├── globals.css *
│   │   ├── layout.tsx * +
│   │   ├── not-found.tsx * +
│   │   └── page.tsx * +
│   ├── components
│   │   ├── avatar
│   │   │   ├── Avatar.tsx * +
│   │   │   ├── Eyes.tsx * +
│   │   │   └── Mouth.tsx * +
│   │   ├── ui
│   │   │   ├── badge.tsx * +
│   │   │   ├── button.tsx * +
│   │   │   ├── card.tsx * +
│   │   │   ├── drawer.tsx * +
│   │   │   ├── dropdown-menu.tsx * +
│   │   │   ├── input.tsx * +
│   │   │   ├── label.tsx * +
│   │   │   ├── select.tsx * +
│   │   │   ├── separator.tsx * +
│   │   │   ├── sonner.tsx * +
│   │   │   └── textarea.tsx * +
│   │   ├── bot-face.tsx * +
│   │   ├── greeter-call.tsx * +
│   │   ├── greeter-drawer.tsx * +
│   │   ├── greeter-screen.tsx * +
│   │   ├── greeter-yolo-call.tsx * +
│   │   ├── streaming-text.tsx * +
│   │   └── voice-waveform.tsx * +
│   ├── lib
│   │   ├── space-config.ts * +
│   │   ├── stream.ts * +
│   │   └── utils.ts * +
│   ├── public
│   │   ├── stock
│   │   │   ├── convo_21.mp4 *
│   │   │   ├── movie_24.mp4 *
│   │   │   └── street_10.mp4 *
│   │   ├── file.svg *
│   │   ├── globe.svg *
│   │   ├── next.svg *
│   │   ├── vercel.svg *
│   │   └── window.svg *
│   ├── types
│   │   └── index.ts * +
│   ├── .gitignore *
│   ├── README.md *
│   ├── bun.lock *
│   ├── components.json *
│   ├── eslint.config.mjs *
│   ├── next.config.ts * +
│   ├── package.json *
│   ├── postcss.config.mjs *
│   └── tsconfig.json *
├── .gitignore *
├── AGENTS.md *
└── README.md *
```

## Tech stack

### Frontend

- Next.js 15 (App Router, server components by default, `"use client"` only where needed)
- TypeScript (strict)
- TailwindCSS v4
- shadcn/ui (New York style, neutral base)
- @hugeicons/react @hugeicons/core-free-icons (icons)
- @stream-io/video-react-sdk (WebRTC video calls)
- framer-motion (bot face animations)
- bun (package manager, see bun.lock)

### Agent

- Python 3.11+
- vision-agents SDK by Stream (v0.3+)
- Plugins: `getstream` (edge network), `openai` (Chat Completions VLM, pointed at OpenRouter), `elevenlabs` (TTS), `ultralytics` (YOLO pose detection)
- `uv` package manager

### External services

- **Stream** (getstream.io) — WebRTC video transport, edge network
- **OpenRouter (Claude Haiku 5.5)** — Vision LLM for visual understanding
- **ElevenLabs** — Fast, high-quality text-to-speech (optional, falls back to text-only)
- **YOLO** (Ultralytics) — Person/pose detection, runs locally

## Key design decisions

1. **Claude Haiku via OpenRouter is the primary VLM** — it handles video understanding. Voice output is handled separately by ElevenLabs TTS.

2. **YOLO is for triggering, not understanding** — YOLO detects when a person enters the frame and provides pose data. Claude Haiku does the actual visual understanding (outfit, colors, accessories).

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

| Variable                     | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_STREAM_API_KEY` | Stream Video public API key                                           |
| `STREAM_API_SECRET`          | Stream Video secret (server-side only)                                |
| `NEXT_PUBLIC_APP_URL`        | App URL (default: `http://localhost:3000`)                            |
| `AGENT_SERVICE_URL`          | Agent service base URL (default local: `http://127.0.0.1:8000`)       |
| `AGENT_SERVICE_SECRET`       | Shared secret used by frontend backend when calling agent `/sessions` |

### Agent (`agent/.env`)

| Variable                                     | Description                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `STREAM_API_KEY`                             | Stream Video API key                                                               |
| `STREAM_API_SECRET`                          | Stream Video API secret                                                            |
| `OPENROUTER_API_KEY`                         | OpenRouter key used by `agent_yolo.py`                                             |
| `ELEVENLABS_API_KEY`                         | ElevenLabs API key for TTS (optional)                                              |
| `GOOGLE_API_KEY`                             | Google AI API key (used by other agent variants)                                   |
| `AGENT_SERVICE_SECRET`                       | Shared secret required to call agent `serve` session APIs                          |
| `AGENT_IDLE_TIMEOUT_SECONDS`                 | Session idle timeout (default: `60`)                                               |
| `AGENT_WAIT_FOR_PARTICIPANT_TIMEOUT_SECONDS` | Timeout to wait for a participant to join (default: `20`)                          |
| `YOLO_LLM_VIDEO_SOURCE`                      | Force LLM to use `raw` or `processed` video track (default: `raw`)                 |
| `YOLO_PROCESS_FPS`                           | YOLO frame processing FPS, clamped to `1-5` (default: `3`)                         |
| `YOLO_OUTPUT_FPS`                            | Published annotated video FPS, clamped to `1-5` (default: `3`)                     |
| `YOLO_LITE_ANNOTATIONS`                      | `true` disables hand/wrist-heavy overlays for faster demo output (default: `true`) |

## Rules

1. Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
2. Do not create custom icons. Unless the icon required is not available in hugeicons.
