# Zen Noise

Zen Noise is a Replit-origin ambient sound app now backed by GitHub for ongoing Codex work.

## Canonical Locations

- GitHub source of truth: <https://github.com/Sip-Coder/Zen-Noise>
- Original Replit project: <https://replit.com/@SipStudies/Zen-Noise>
- Owner's local Windows path: `C:\codebase\sip_studies\actual\Zen-Noise`

Use GitHub as the handoff point between Replit, local Windows work, and Codex App/mobile work.

## Local Setup

```bash
npm install
npm run dev
```

The app defaults to port `5000`.

## Click To Open Locally

From the repository folder, double-click `Start-Local-Site.cmd`.

That launcher starts the Vite-backed local server, waits for it to respond, and opens:

```text
http://127.0.0.1:5000
```

If the server is already running, you can also double-click `Open-Zen-Noise-Localhost.url`.

On Windows, if port `5000` is already in use:

```powershell
$env:PORT = "5180"
npm run dev
```

## Verify

```bash
npm run check
npm run build
```

Production smoke test:

```bash
npm run build
npm run start
```

## Audio Review

The app generates its ambience procedurally with Web Audio instead of bundled audio files. See `docs/audio-soundscape-review.md` for the current sound coverage review and recommended next additions.

## Codex Mobile Access

Codex mobile works by remote-controlling a running Codex App host. To edit this app from the phone:

1. Install/open Codex App on the Windows host that has this repo.
2. Add/open the project folder `C:\codebase\sip_studies\actual\Zen-Noise`.
3. In Codex App, use **Set up Codex mobile** and scan the QR code from ChatGPT mobile.
4. Keep the Windows host awake, online, and signed in to the same ChatGPT account/workspace.
5. From the phone, choose the connected host and the `Zen-Noise` project.
6. After edits, run checks, commit, and push to `origin/main`.

