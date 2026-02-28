# HeyYou 👋

**AI-powered greetings for every entrance.**

HeyYou is an AI greeter for physical spaces — retail stores, conferences, hotels, gyms, and more. Mount a device at your entrance, and the AI watches the camera feed in real-time, delivering personalized spoken compliments based on what it sees.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────┐
│                     │         │                          │         │                     │
│   Next.js Frontend  │◄───────►│  Stream Edge Network     │◄───────►│  Python Vision      │
│   (Dashboard +      │  WebRTC │  (Video + Audio relay)   │  WebRTC │  Agent (Gemini      │
│    Greeter View)    │         │                          │         │   Realtime API)     │
│                     │         │                          │         │                     │
└────────┬────────────┘         └──────────────────────────┘         └─────────────────────┘
         │
         │ REST
         ▼
┌─────────────────────┐
│                     │
│   Agent Service API │
│  (start sessions)   │
│                     │
└─────────────────────┘
```

**How it works:**
1. The **Next.js frontend** serves the dashboard (where business owners configure their spaces) and the **greeter view** (what displays on the iPad at the entrance).
2. The greeter view opens a **Stream Video** call, streaming the entrance camera feed.
3. The **Python Vision Agent** joins the same Stream call, watches the video feed using **Gemini's Realtime API**, and speaks personalized greetings.
4. The frontend server starts agent sessions on-demand via the agent service API (`/sessions`).

---

## Setup

### Prerequisites

- **Node.js** 18+ and [**Bun**](https://bun.sh/)
- **Python** 3.11+ and [**uv**](https://docs.astral.sh/uv/) *(for agent only)*
- A [Stream](https://getstream.io/) account (Video API key + secret)
- A [Google AI](https://ai.google.dev/) API key (for Gemini)

### 1. Clone & Install

```bash
git clone <repo-url> heyyou
cd heyyou
```

### 2. Frontend Setup

```bash
cd frontend
bun install
cp .env.example .env.local
# Fill in your env vars in .env.local
```

### 3. Agent Setup

```bash
cd agent
uv sync
cp .env.example .env
# Fill in your env vars in .env
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_STREAM_API_KEY` | Stream Video public API key |
| `STREAM_API_SECRET` | Stream Video secret (server-side only) |
| `NEXT_PUBLIC_APP_URL` | App URL (default: `http://localhost:3000`) |
| `AGENT_SERVICE_URL` | Agent service base URL (default local: `http://127.0.0.1:8000`) |
| `AGENT_SERVICE_SECRET` | Shared secret used by frontend backend when calling agent `/sessions` |

### Agent (`agent/.env`)

| Variable | Description |
|---|---|
| `STREAM_API_KEY` | Stream Video API key |
| `STREAM_API_SECRET` | Stream Video API secret |
| `OPENROUTER_API_KEY` | OpenRouter key used by `agent_yolo.py` |
| `GOOGLE_API_KEY` | Google AI API key (used by other agent variants) |
| `AGENT_SERVICE_SECRET` | Shared secret required to call agent `serve` session APIs |
| `AGENT_IDLE_TIMEOUT_SECONDS` | Session idle timeout (default: `60`) |
| `YOLO_PROCESS_FPS` | YOLO frame processing FPS, clamped to `3-5` (default: `5`) |
| `YOLO_OUTPUT_FPS` | Published annotated video FPS, clamped to `3-5` (default: `5`) |
| `YOLO_LITE_ANNOTATIONS` | `true` disables hand/wrist-heavy overlays for faster demo output |

---

## Running Locally

Open **two terminals**:

**Terminal 1 — Frontend:**
```bash
cd frontend
bun run dev
```
→ Opens at [http://localhost:3000](http://localhost:3000)

**Terminal 2 — Agent:**
```bash
cd agent
uv run agent_yolo.py serve --host 127.0.0.1 --port 8000
```

---

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend Agent:** Python, Vision Agents SDK, Gemini Realtime API
- **Video:** Stream Video (WebRTC)
- **Session Orchestration:** Vision Agents `serve` API + frontend server route
- **Data Fetching:** TanStack React Query
