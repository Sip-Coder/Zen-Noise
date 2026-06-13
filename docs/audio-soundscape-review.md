# Zen Noise Audio Soundscape Review

## Summary

Zen Noise does not currently ship sample audio files such as `.mp3`, `.wav`, `.ogg`, or `.flac`. The app generates its soundscape procedurally with Web Audio in `client/src/hooks/use-audio-engine.ts`.

That is a good fit for this product: no licensing risk, no large downloads, no looping sample artifacts from compressed files, and fine control over density, volume, stereo placement, and sleep-safe transient levels.

## Current Sound Coverage

| Requested sound | Current implementation | Review status |
| --- | --- | --- |
| Brown noise | Generated brown-noise buffer through low-frequency random walk, low-pass filtering, volume control, and optional wave modulation. | Covered. Updated to avoid hard clipping and reduce loop-edge artifacts. |
| Gentle rain | Layered filtered white, pink, and brown noise with randomized droplet and splash events. | Covered. Good calming fit because events are soft, short, and stereo-spread. |
| Coffee shop background | Low murmur bed with soft cup clinks, footsteps, and room movement. | Covered. Updated to reduce sharp clink frequency so it stays ambient instead of distracting. |
| Gentle thunderstorms | Low rumble bed with occasional rolling thunder events. | Covered. Updated to make close strikes rarer, softer, and less sudden. |
| Soft winds | Pink-noise gust bed with slow gain movement and soft rustle bursts. | Covered. Good fit for sleep because the modulation is gradual. |
| Chirping birds | Sparse oscillator chirps, overtones, quiet breath/noise texture, and occasional trills. | Covered. Updated to reduce peak volume, increase spacing, and make trills less frequent. |
| Crackling camp fire | Brown/pink fire bed with randomized crackles and small pop clusters. | Covered. Updated to slow and soften crackle density for nighttime listening. |
| Tibetan bowl ringing | Sine harmonics, beating partials, long decay, and optional low drone. | Covered. Updated to slightly lower harmonic/drone levels and add more space between strikes. |
| Sleeping cat purr | Low oscillator pulses with breathing-like amplitude shape plus brown-noise texture. | Covered. Good fit for sleep because it is low, steady, and close-mic styled. |
| Forest rustling leaves | Pink/brown canopy bed with sweeping leaf rustles and rare soft creaks. | Covered. Good fit for sleep when kept at lower volume. |

## Sound Engine Changes Made In This Pass

- Added longer reusable noise beds for the looping ambient sources.
- Added loop-tail crossfading so repeated noise beds return to their start without a hard edge.
- Normalized generated brown noise instead of clipping samples at `-1` and `1`.
- Reduced sharp or surprising transient density in coffee shop, thunder, birds, campfire, and Tibetan bowl layers.
- Renamed the visible ambient labels from `Ring` to `Bowl` and from `Cats` to `Purr` so the controls match the intended sounds.
- Added clamping for brown-noise and ambient-layer volume values so saved or slider-sent values stay between 0 and 1.
- Added visible per-layer intensity readouts for each ambient slider.

## Deep Audio Wiring Analytics

Run this repo-level check after sound changes:

```bash
npm run verify:audio
```

The analyzer verifies:

- The app has no bundled audio sample files, so the current sound path is procedural Web Audio.
- Every requested ambient sound appears in the `AmbientSound` union, `ALL_AMBIENTS`, engine defaults, saved-volume defaults, and UI options.
- Every ambient tile has a button, slider test ID, visible intensity readout, and per-sound gain wiring.
- Brown noise uses the generated brown-noise path with normalization and loop crossfading.
- This review document still covers the requested sound set and the additional calming-sound backlog.

## Slider Intensity Verification

Each ambient tile has:

- a button test id: `btn-ambient-{sound}`
- a slider test id: `slider-ambient-{sound}`
- a visible percentage test id: `ambient-volume-{sound}`
- a `data-volume` value on the tile

Moving a slider calls `setAmbientVolume(sound, value)`, clamps the value to `0..1`, updates React state, updates the visible percentage, and writes the same value into that sound's dedicated `GainNode` with `setTargetAtTime`.

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
