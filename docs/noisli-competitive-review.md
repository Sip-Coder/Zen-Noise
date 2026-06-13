# Noisli Competitive Review

Research date: 2026-06-13.

## Noisli Benchmark

Noisli's official feature set centers on:

- 28 mixable high-quality background sounds.
- Curated Playlists and user-saveable Favorites/Combos.
- Shareable sound combinations.
- Oscillation, which changes individual sound volumes gradually over time.
- Shuffle, which moves between Playlist or Favorite combinations.
- Advanced Timer sessions, breaks, notifications, and session statistics.
- Distraction-free Markdown text editor with account/cloud export options.
- iOS, Android, Chrome extension, offline sounds, and background audio support.

Sources reviewed:

- <https://www.noisli.com/features>
- <https://www.noisli.com/how-it-works>
- <https://support.noisli.com/getting-started-guide/>
- <https://www.noisli.com/apps>
- <https://www.noisli.com/blog/the-noisli-android-app-is-here/>

## Zen Noise Before This Pass

Zen Noise already had a focused advantage: it is small, local-first, no-account, and fast to open. The app had brown noise, nine ambience layers, per-sound sliders, saved local settings, a timer, install prompt, and local recorded samples.

The gaps versus Noisli were:

- No curated sound combinations to start from.
- No shareable mix links.
- No favorites library beyond automatic local persistence.
- No shuffle or playlist-like movement.
- Fewer sound categories than Noisli.
- No advanced work-session timer or text editor.
- Several ambience samples used OGG, which is less compatible than MP3/WAV across browsers.
- Some source licenses were acceptable but less redistribution-friendly than CC0.

## Built In This Pass

- Added six curated mixes: Focus, Sleep, Storm, Forest, Hearth, and Reset.
- Added a shuffle control that jumps between curated mixes.
- Added shareable mix links using URL parameters for active ambience volumes.
- Added named local saved mixes with restore and delete controls.
- Split brown noise into a standalone opt-in layer so curated mixes do not force the heavy low-frequency bed.
- Replaced most ambience files with researched CC0 MP3 recordings.
- Added MP3 assets for rain, coffee shop, thunderstorm, wind, birds, campfire, Tibetan bowl, purr, and forest leaves.
- Kept the brown-noise OGG, with a generated brown-noise fallback for decode failures.
- Extended modulation across all active layers so one sound briefly rises as the current focus while the rest soften, then the focus rotates.
- Updated audio source documentation, manifest metadata, and audio wiring verification.

## Still Worth Building Later

| Gap | Recommendation |
| --- | --- |
| Favorites polish | Add rename, reorder, and per-saved-mix share controls. |
| Automatic shuffle | Let users cycle through saved mixes every 15/30/60 minutes with a crossfade. |
| Oscillation depth | Add per-sound opt-outs, custom depth, and custom tempo for users who want finer modulation control. |
| Timer sessions | Add Focus/Break loops, long breaks, tab title countdown, and optional notification. |
| Catalog depth | Add ocean, stream, fan, crickets, snowfall, distant train, city hush, and white/pink noise. |
| Offline confidence | Pre-cache selected active sounds after first play and expose install/offline readiness in QA. |
| Background audio | Verify PWA media-session behavior on Android Chrome and iOS Safari. |
| Text editor | Consider only if Zen Noise should move toward productivity; it may dilute the sleep-first focus. |

## Product Direction

Zen Noise should not try to become a full Noisli clone. Its stronger lane is a no-account, sleep-friendly, source-documented mixer that opens quickly and keeps controls calm. The best next competitive move is automatic mix crossfades plus saved-mix polish, because named local saved mixes now close the core Noisli Combo/Favorites gap without adding accounts or clutter.
