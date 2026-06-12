# Zen Noise Codex Instructions

## Project Identity

- Canonical GitHub repo: `https://github.com/Sip-Coder/Zen-Noise`
- Original Replit project: `https://replit.com/@SipStudies/Zen-Noise`
- Local Windows path used by the owner: `C:\codebase\sip_studies\actual\Zen-Noise`
- Default branch: `main`

Treat GitHub as the source of truth for Codex App, Codex mobile remote-control work, and future local clones. Replit is the original build host and may be used as a deploy/import mirror, but do not assume it has newer source unless it is explicitly pulled into Git.

## Commands

Run these before committing source changes:

```bash
npm run check
npm run build
```

For local development:

```bash
npm install
npm run dev
```

The app defaults to port `5000`. On Windows, if that port is occupied, set `PORT` before starting the dev server:

```powershell
$env:PORT = "5180"
npm run dev
```

For production smoke testing:

```bash
npm run build
npm run start
```

## Notes For Codex Mobile

Codex mobile controls a connected Codex App host. The phone does not use this local folder by itself. Keep the Windows host awake, signed in to the same ChatGPT workspace, and pointed at this project folder or at a fresh clone of the GitHub repo.

When working from the phone, prefer this flow:

1. Start or continue a thread on the connected host project `Zen-Noise`.
2. Make changes on `main` or in a worktree.
3. Run `npm run check` and `npm run build`.
4. Commit and push to `origin/main`.

