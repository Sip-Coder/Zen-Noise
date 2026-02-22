# Zen Noise

## Overview

Zen Noise is a Progressive Web App (PWA) that generates procedural brown noise for deep sleep with layerable ambient soundscapes. It's primarily a **client-side application** — all audio generation, settings, and timer logic happen in the browser using the Web Audio API. The backend exists mainly to serve the frontend and has no meaningful API routes. User preferences (volume, wave intensity, per-sound ambient volumes) are persisted via `localStorage`, not a database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) — single page at `/`
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives, styled with Tailwind CSS
- **Animations**: Framer Motion for transitions and interactive elements
- **Icons**: Lucide React
- **State Management**: React hooks (no Redux/Zustand). React Query is included but barely used since there are no real API calls
- **Styling**: Tailwind CSS with CSS custom properties for theming. Dark-only theme optimized for nighttime/sleep use. Fonts: DM Sans (body), Outfit (display)

### Core Audio Engine (`use-audio-engine.ts`)
- Uses the **Web Audio API** to procedurally generate brown noise in real-time
- Generates separate looping buffers: brown noise (leaky integrator), white noise, pink noise (Voss-McCartney)
- Supports amplitude modulation with three wave intensities: steady, gentle, deep
- Volume control with fade-out capability for sleep timer completion
- **9 layerable ambient sounds** with independent per-sound volume control:
  - Rain (filtered white+pink noise with volume swells)
  - Coffee shop (bandpass brown noise + pink murmur + cup clinks)
  - Storm/Thunder (low-pass brown+pink with scheduled random strikes)
  - Wind (double low-pass white + rustling bandpass pink)
  - Birds (oscillator-based chirps with frequency sweeps, trills via LFO)
  - Fire/Campfire (high-pass white crackle + low-pass brown rumble)
  - Chanting (singing bowl harmonics + vocal drone oscillators)
  - Cats/Purring (rhythmic low-frequency sawtooth with pulse envelope)
  - Forest (layered pink bandpass + white highpass + brown lowpass)
- Audio architecture: Each ambient has a mixGain (for modulation) → userGain (for volume) → destination chain, independent from the brown noise master chain

### Key Custom Hooks
- `useAudioEngine` — manages AudioContext, noise generation, per-sound gain chains, filters, wave modulation, and ambient scheduling
- `useTimer` — countdown timer that triggers a fade-out when complete

### PWA Features
- Service worker (`sw.js`) with cache-first strategy for offline support
- Web app manifest for installability
- Install prompt component that detects `beforeinstallprompt` events

### Backend
- **Runtime**: Node.js with Express 5
- **Purpose**: Serves the built static frontend only. No API routes are implemented
- **Dev Server**: Vite dev server with HMR proxied through Express
- **Build**: Custom build script using esbuild (server) + Vite (client). Output goes to `dist/`

### Database Schema
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Current Usage**: The schema (`shared/schema.ts`) defines a `user_settings` table but it is **not actively used**. The app stores settings in localStorage instead. The schema exists to satisfy the project structure and could be activated later if backend persistence is needed
- **Storage**: `server/storage.ts` uses an in-memory `MemStorage` class — effectively a no-op

### Project Structure
```
client/           → React frontend
  src/
    components/   → App components (VolumeSlider, WaveControl, AmbientSounds, TimerSelector, InstallPrompt)
    components/ui/→ shadcn/ui component library
    hooks/        → Custom React hooks (audio engine, timer, mobile detection)
    pages/        → Route pages (Home, NotFound)
    lib/          → Utilities (cn helper, query client)
  public/         → Static assets (manifest.json, sw.js, favicon)
server/           → Express backend
  index.ts        → Entry point, middleware setup
  routes.ts       → API routes (currently empty)
  storage.ts      → In-memory storage (minimal)
  vite.ts         → Vite dev server integration
  static.ts       → Production static file serving
  db.ts           → Drizzle/PostgreSQL connection (not actively used)
shared/           → Shared between client and server
  schema.ts       → Drizzle table definitions
  routes.ts       → API route definitions (currently empty)
```

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets` → `attached_assets/`

## External Dependencies

### Database
- **PostgreSQL** via `pg` driver and Drizzle ORM — configured but not actively used. The `DATABASE_URL` environment variable is expected but the app gracefully falls back to a dummy connection string
- **Drizzle Kit** for schema migrations (`npm run db:push`)

### Key Frontend Libraries
- `framer-motion` — animations
- `lucide-react` — icons
- `wouter` — routing
- `@tanstack/react-query` — data fetching (minimal use)
- `@radix-ui/*` — accessible UI primitives (via shadcn/ui)
- `tailwindcss` — utility-first CSS

### Key Backend Libraries
- `express` v5 — HTTP server
- `connect-pg-simple` — session store (included but sessions not actively used)
- `drizzle-orm` / `drizzle-zod` — ORM and validation

### Build Tools
- `vite` — frontend bundler with React plugin
- `esbuild` — server bundler
- `tsx` — TypeScript execution for dev mode
- `@replit/vite-plugin-runtime-error-modal` — error overlay in development