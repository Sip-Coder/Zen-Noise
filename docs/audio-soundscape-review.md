# Zen Noise Audio Soundscape Review

## Summary

Zen Noise now ships real recorded audio assets under `client/public/audio/`. The app plays those files through Web Audio in `client/src/hooks/use-audio-engine.ts`, so each sound has a real local audio source plus per-sound gain control.

The previous procedural synthesis path was useful for prototyping, but the current app path is now recorded-sample-backed for more recognizable rain, coffee-room, storm, wind, birds, campfire, bowl, purr, and leaves textures. Licensing and attribution are documented in `docs/audio-sample-sources.md` and `client/public/audio/audio-sources.json`.

## Current Sound Coverage

| Requested sound | Current implementation | Review status |
| --- | --- | --- |
| Brown noise | `/audio/brown-noise.ogg` | Covered. Real local audio file with Web Audio gain control and wave modulation. |
| Gentle rain | `/audio/rain.ogg` | Covered. Real rain recording. |
| Coffee shop background | `/audio/coffee-shop.ogg` | Covered. Real restaurant/cafe-style room ambience recording. |
| Gentle thunderstorms | `/audio/thunderstorm.ogg` | Covered. Real rain-and-thunder recording. |
| Soft winds | `/audio/wind.ogg` | Covered. Real gentle breeze recording. |
| Chirping birds | `/audio/birds.ogg` | Covered. Real birdsong recording. |
| Crackling camp fire | `/audio/campfire.ogg` | Covered. Real campfire ambience recording. |
| Tibetan bowl ringing | `/audio/tibetan-bowl.ogg` | Covered. Real Tibetan singing bowl recording. |
| Sleeping cat purr | `/audio/cat-purr.ogg` | Covered. Real loopable purring recording. |
| Forest rustling leaves | `/audio/forest-leaves.wav` | Covered. Real rustling-leaves recording. |

## Sound Engine Changes Made In This Pass

- Added real recorded audio files for brown noise and every ambient layer.
- Replaced the default procedural synthesis path with sample-backed Web Audio playback.
- Added `SAMPLE_SOURCES` in `client/src/hooks/use-audio-engine.ts` so each app sound maps to a local audio file.
- Added source/licensing metadata in `client/public/audio/audio-sources.json` and `docs/audio-sample-sources.md`.
- Kept Web Audio gain nodes so each slider still controls its own sound independently.
- Renamed the visible ambient labels from `Ring` to `Bowl` and from `Cats` to `Purr` so the controls match the intended sounds.
- Added clamping for brown-noise and ambient-layer volume values so saved or slider-sent values stay between 0 and 1.
- Added visible per-layer intensity readouts for each ambient slider.

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
- Brown noise has a local audio file and Web Audio gain control.
- The source manifest documents source pages, source files, licenses, and attribution.

## Slider Intensity Verification

Each ambient tile has:

- a button test id: `btn-ambient-{sound}`
- a slider test id: `slider-ambient-{sound}`
- a visible percentage test id: `ambient-volume-{sound}`
- a `data-volume` value on the tile

Moving a slider calls `setAmbientVolume(sound, value)`, clamps the value to `0..1`, updates React state, updates the visible percentage, and writes the same value into that sound's dedicated `GainNode` with `setTargetAtTime`. If a recorded sample has not loaded yet, turning the sound on loads and decodes that file before playback.

## Additional Calming Sounds To Add Next

| Priority | Sound | Why it fits Zen Noise | Implementation note |
| --- | --- | --- | --- |
| 1 | Ocean surf | Strong sleep association, natural low-frequency wash, pairs well with brown noise. | Pink/brown wave bed with slow swells and soft foam hiss. Avoid gulls by default. |
| 2 | Creek or stream | Continuous, low-stress water movement that can mask speech without sharp events. | Layer filtered noise with small randomized bubble/pluck bursts. |
| 3 | Soft fan or HVAC | Useful for users who want a familiar steady mechanical sleep sound. | Mostly brown/pink noise with subtle rotational modulation and no rattles. |
| 4 | Night crickets | Natural nighttime cue, good for low-volume sleep ambience. | Sparse high-frequency pulses with strong volume cap and adjustable density. |
| 5 | Light snowfall | Quiet granular texture with little semantic distraction. | Very soft filtered white noise grains with wide stereo placement. |
| 6 | Distant train or city hush | Good optional comfort layer for urban sleepers. | Keep distant, low, and non-rhythmic; avoid horns, brakes, or sirens. |

## Sounds To Avoid Or Keep Optional

- Recognizable speech, because it pulls attention and can feel privacy-invasive.
- Sudden animal calls, alarms, horns, sirens, or bright chimes.
- Heavy storm cracks as a default sleep layer.
- Short obvious sample loops, unless they are long, well-crossfaded, and licensed.

## QA Checklist

Before shipping major audio changes:

1. Run `npm run check`.
2. Run `npm run build`.
3. Run `npm run verify:audio`.
4. Open the local app with `Start-Local-Site.cmd`.
5. Test each ambient layer individually at 50 percent volume.
6. Move each ambient slider down and back up; confirm the visible percentage and perceived layer intensity both change.
7. Test layered playback with brown noise at 35-50 percent and two ambiences at 20-35 percent.
8. Listen for clicks, obvious loops, harsh high-frequency events, and startling peaks.
9. Confirm the timer fade still suspends playback cleanly.
