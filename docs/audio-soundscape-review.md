# Zen Noise Audio Soundscape Review

## Summary

Zen Noise now ships real recorded audio assets under `client/public/audio/`. The app plays those files through Web Audio in `client/src/hooks/use-audio-engine.ts`, so each sound has a real local audio source plus per-sound gain control.

The current pass improves authenticity and compatibility by replacing most OGG ambience assets with researched MP3 previews from CC0 Freesound recordings. Brown noise keeps a public-domain reference OGG and adds a generated fallback buffer for browsers that cannot decode OGG. Brown noise is now a standalone opt-in layer instead of part of the curated mixes, so ambient mixes stay lighter by default. Modulation now applies to every active layer, rotating emphasis so one sound rises briefly while the other layers settle back. Licensing and attribution are documented in `docs/audio-sample-sources.md` and `client/public/audio/audio-sources.json`.

## Current Sound Coverage

| Requested sound | Current implementation | Review status |
| --- | --- | --- |
| Brown noise | `/audio/brown-noise.ogg` plus generated fallback | Covered. Local audio file with Web Audio gain control, standalone opt-in control, and global layer modulation support; generated fallback protects OGG decode failures. |
| Gentle rain | `/audio/rain.mp3` | Covered. Real gentle rain recording with softer transients than the previous heavier rain source. |
| Coffee shop background | `/audio/coffee-shop.mp3` | Covered. Real cafeteria ambience recording. |
| Gentle thunderstorms | `/audio/thunderstorm.mp3` | Covered. Real rain-and-distant-thunder recording. |
| Soft winds | `/audio/wind.mp3` | Covered. Dedicated wind-in-trees recording without baked-in bird calls. |
| Chirping birds | `/audio/birds.mp3` | Covered. Real morning birds recording, separate from wind. |
| Crackling camp fire | `/audio/campfire.mp3` | Covered. Quiet nighttime campfire recording. |
| Tibetan bowl ringing | `/audio/tibetan-bowl.mp3` | Covered. Real Tibetan singing bowl recording, now CC0. |
| Sleeping cat purr | `/audio/cat-purr.mp3` | Covered. Real cat purr recording. |
| Forest rustling leaves | `/audio/forest-leaves.mp3` | Covered. Gentler breeze-through-pines recording, replacing the more aggressive rustling-leaves WAV. |

## Deep Audio Research Findings

- The prior wind file included birds, which made the wind and birds controls less semantically accurate. The new wind file is a dedicated wind-in-trees recording.
- The prior bowl file was CC BY-SA 4.0, which creates share-alike friction for redistribution. The replacement bowl file is CC0.
- The prior campfire file was CC BY 3.0. The replacement is CC0 and was recorded in a quiet nighttime setting.
- MP3 is now used for every ambience layer. This is more compatible than relying on OGG ambience files and keeps the forest layer lighter than the prior WAV.
- Brown noise is a noise color rather than a field recording target. A generated fallback is acceptable because it preserves the expected acoustic profile when the browser cannot decode the bundled OGG.
- The prior forest leaves file felt too intense as a sleep layer, so it was replaced with a softer CC0 breeze-through-pines recording.

## Product Audio Changes Made In This Pass

- Rewired ambience playback to MP3 assets for rain, coffee, storm, wind, birds, fire, bowl, and purr.
- Added a generated brown-noise fallback buffer for browsers that cannot decode the brown-noise OGG file.
- Moved brown noise out of curated mixes and share links.
- Replaced the forest leaves WAV with a subtler MP3 breeze-through-pines recording.
- Replaced higher-friction CC BY and CC BY-SA assets with CC0 Freesound recordings where available.
- Added six curated mixes in `client/src/lib/mix-presets.ts`.
- Added shuffle and share-link controls in `client/src/components/MixPresets.tsx`.
- Added URL mix encoding and decoding so a shared mix can reopen the same ambient-layer state.
- Extended modulation from brown noise to all active layers, rotating a short focus lift across the current sound set while returning every layer to its slider-set base volume.

## Deep Audio Wiring Analytics

Run this repo-level check after sound changes:

```bash
npm run verify:audio
```

The analyzer verifies:

- The app has bundled recorded audio files and uses recorded-sample-backed Web Audio.
- Every requested ambient sound appears in the `AmbientSound` union, `ALL_AMBIENTS`, engine defaults, saved-volume defaults, and UI options.
- Every requested sound maps to an existing local audio file in `SAMPLE_SOURCES`.
- Every ambient tile has a button, slider test ID, visible intensity readout, and per-sound gain wiring.
- Brown noise has a local audio file, Web Audio gain control, generated fallback evidence, and an independent opt-in button.
- Layer modulation has a global UI control and a Web Audio scheduler that rotates focus across all active recorded samples.
- Mix presets, shuffle, and share-link UI are wired.
- The source manifest documents source pages, source files, licenses, and attribution.

## Slider Intensity Verification

Each ambient tile has:

- a button test id: `btn-ambient-{sound}`
- a slider test id: `slider-ambient-{sound}`
- a visible percentage test id: `ambient-volume-{sound}`
- a `data-volume` value on the tile

Moving a slider calls `setAmbientVolume(sound, value)`, clamps the value to `0..1`, updates React state, updates the visible percentage, and writes the same value into that sound's dedicated `GainNode` with `setTargetAtTime`. If a recorded sample has not loaded yet, turning the sound on loads and decodes that file before playback.

## Layer Modulation Verification

The modulation control is global rather than brown-noise-specific. During playback, `scheduleLayerModulation` builds the active sound list from brown noise plus every ambient layer above zero, then rotates a `starSound` through that list. The star layer gets a temporary gain lift, backing layers get a smaller temporary duck, and all layers return to their slider-set base volume before the next rotation.

## Additional Calming Sounds To Add Next

| Priority | Sound | Why it fits Zen Noise | Implementation note |
| --- | --- | --- | --- |
| 1 | Ocean surf | Strong sleep association, natural low-frequency wash, pairs well with brown noise. | Use a long real surf loop without gulls by default. |
| 2 | Creek or stream | Continuous, low-stress water movement that can mask speech without sharp events. | Prefer real stream recordings with no hikers, voices, or birds baked in. |
| 3 | Soft fan or HVAC | Familiar steady mechanical sleep sound. | A synthesized fallback is acceptable, but a real fan recording is better for recognition. |
| 4 | Night crickets | Natural nighttime cue, good for low-volume sleep ambience. | Keep volume capped and avoid sudden close insect calls. |
| 5 | Light snowfall | Quiet granular texture with little semantic distraction. | Real snow or soft granular Foley can work; avoid icy crunches. |
| 6 | Distant train or city hush | Good optional comfort layer for urban sleepers. | Keep distant, low, and non-rhythmic; avoid horns, brakes, sirens, and announcements. |

## Sounds To Avoid Or Keep Optional

- Recognizable speech, because it pulls attention and can feel privacy-invasive.
- Sudden animal calls, alarms, horns, sirens, or bright chimes.
- Heavy storm cracks as a default sleep layer.
- Short obvious sample loops, unless they are long, well-crossfaded, and licensed.

## QA Checklist

Before shipping major audio changes:

1. Run `npm run verify:audio`.
2. Run `npm run check`.
3. Run `npm run build`.
4. Open the local app with `Start-Local-Site.cmd`.
5. Test each ambient layer individually at 50 percent volume.
6. Apply each curated mix and confirm the visible sliders update.
7. Use the share button, reopen the copied link, and confirm the same ambient mix loads without forcing brown noise on.
8. Move each ambient slider down and back up; confirm the visible percentage and perceived layer intensity both change.
9. Turn on Brown Noise separately, then test layered playback with brown noise at 25-40 percent and two ambiences at 20-35 percent.
10. Set modulation to Gentle or Deep with at least three active layers and confirm each layer briefly comes forward without permanently changing its slider value.
11. Listen for clicks, obvious loops, harsh high-frequency events, and startling peaks.
12. Confirm the timer fade still suspends playback cleanly.
