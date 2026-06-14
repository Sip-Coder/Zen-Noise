import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedAmbients = [
  "rain",
  "coffee",
  "thunder",
  "wind",
  "birds",
  "campfire",
  "ring",
  "purring",
  "forest",
  "ocean",
  "stream",
  "waterfall",
  "crickets",
  "fan",
  "city",
  "train",
  "airplane",
  "washer",
];

const expectedSampleSources = {
  brown: "/audio/brown-noise.ogg",
  rain: "/audio/rain.mp3",
  coffee: "/audio/coffee-shop.mp3",
  thunder: "/audio/thunderstorm.mp3",
  wind: "/audio/wind.mp3",
  birds: "/audio/birds.mp3",
  campfire: "/audio/campfire.mp3",
  ring: "/audio/tibetan-bowl.mp3",
  purring: "/audio/cat-purr.mp3",
  forest: "/audio/forest-leaves.mp3",
  ocean: "/audio/ocean-waves.mp3",
  stream: "/audio/stream-river.mp3",
  waterfall: "/audio/waterfall-forest.mp3",
  crickets: "/audio/night-crickets.mp3",
  fan: "/audio/room-fan.mp3",
  city: "/audio/city-rumble.mp3",
  train: "/audio/train-interior.mp3",
  airplane: "/audio/airplane-cabin.mp3",
  washer: "/audio/washing-machine.mp3",
};

const expectedLabels = {
  rain: "Rain",
  coffee: "Coffee",
  thunder: "Storm",
  wind: "Wind",
  birds: "Birds",
  campfire: "Fire",
  ring: "Bowl",
  purring: "Purr",
  forest: "Forest",
  ocean: "Ocean",
  stream: "Stream",
  waterfall: "Falls",
  crickets: "Crickets",
  fan: "Fan",
  city: "City",
  train: "Train",
  airplane: "Airplane",
  washer: "Washer",
};

const docCoverageTerms = [
  "real recorded audio assets",
  "Brown noise",
  "Gentle rain",
  "Coffee shop background",
  "Gentle thunderstorms",
  "Soft winds",
  "Chirping birds",
  "Crackling camp fire",
  "Tibetan bowl ringing",
  "Sleeping cat purr",
  "Forest rustling leaves",
  "Ocean surf",
  "Creek stream",
  "Forest waterfall",
  "Night crickets",
  "Room fan",
  "City hush",
  "Train interior",
  "Airplane cabin",
  "Washing machine",
  "Recorded Audio Sources",
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function parse(relPath, text) {
  const kind = relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, kind);
}

function visitAll(source, predicate) {
  const matches = [];

  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }

  visit(source);
  return matches;
}

function getVariable(source, name) {
  const declarations = visitAll(source, ts.isVariableDeclaration);
  return declarations.find((node) => node.name?.getText(source) === name);
}

function getStringUnion(source, name) {
  const declarations = visitAll(source, ts.isTypeAliasDeclaration);
  const declaration = declarations.find((node) => node.name.text === name);
  if (!declaration || !ts.isUnionTypeNode(declaration.type)) return [];

  return declaration.type.types
    .filter(ts.isLiteralTypeNode)
    .map((node) => node.literal)
    .filter(ts.isStringLiteral)
    .map((node) => node.text);
}

function getStringArray(source, name) {
  const declaration = getVariable(source, name);
  if (!declaration || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) return [];

  return declaration.initializer.elements
    .filter(ts.isStringLiteral)
    .map((node) => node.text);
}

function getObjectKeys(source, name) {
  const declaration = getVariable(source, name);
  if (!declaration || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) return [];

  return declaration.initializer.properties
    .filter(ts.isPropertyAssignment)
    .map((property) => property.name)
    .filter((propertyName) => ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName))
    .map((propertyName) => propertyName.text);
}

function getObjectStringValues(source, name) {
  const declaration = getVariable(source, name);
  if (!declaration || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) return {};

  const values = {};
  declaration.initializer.properties
    .filter(ts.isPropertyAssignment)
    .forEach((property) => {
      const propertyName = property.name;
      const key = ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName) ? propertyName.text : propertyName.getText(source);
      if (ts.isStringLiteral(property.initializer)) {
        values[key] = property.initializer.text;
      }
    });

  return values;
}

function getAmbientOptions(source) {
  const declaration = getVariable(source, "AMBIENT_OPTIONS");
  if (!declaration || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) return [];

  return declaration.initializer.elements
    .filter(ts.isObjectLiteralExpression)
    .map((item) => {
      const result = {};
      item.properties.filter(ts.isPropertyAssignment).forEach((property) => {
        const key = property.name.getText(source);
        if (key === "value" && ts.isStringLiteral(property.initializer)) result.value = property.initializer.text;
        if (key === "label" && ts.isStringLiteral(property.initializer)) result.label = property.initializer.text;
      });
      return result;
    });
}

function assertSameSet(name, actual, expected, failures) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  if (missing.length || extra.length) {
    failures.push(`${name} mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`);
  }
}

function publicPathToFile(publicPath) {
  return path.join(root, "client", "public", publicPath.replace(/^\//, ""));
}

const engineText = read("client/src/hooks/use-audio-engine.ts");
const homeText = read("client/src/pages/Home.tsx");
const ambientComponentText = read("client/src/components/AmbientSounds.tsx");
const savedMixesComponentText = read("client/src/components/SavedMixes.tsx");
const reviewText = read("docs/audio-soundscape-review.md");
const sampleSourceText = read("docs/audio-sample-sources.md");
const savedMixesText = read("client/src/lib/saved-mixes.ts");
const mixPresetsText = read("client/src/lib/mix-presets.ts");
const mixPresetsComponentText = read("client/src/components/MixPresets.tsx");
const sourceManifest = JSON.parse(read("client/public/audio/audio-sources.json"));

const engineSource = parse("client/src/hooks/use-audio-engine.ts", engineText);
const homeSource = parse("client/src/pages/Home.tsx", homeText);
const ambientSource = parse("client/src/components/AmbientSounds.tsx", ambientComponentText);
const mixPresetsSource = parse("client/src/lib/mix-presets.ts", mixPresetsText);

const failures = [];
const ambientUnion = getStringUnion(engineSource, "AmbientSound");
const allAmbients = getStringArray(engineSource, "ALL_AMBIENTS");
const engineDefaults = getObjectKeys(engineSource, "DEFAULT_VOLUMES");
const homeDefaults = getObjectKeys(mixPresetsSource, "DEFAULT_AMBIENT_VOLUMES");
const sampleSources = getObjectStringValues(engineSource, "SAMPLE_SOURCES");
const ambientOptions = getAmbientOptions(ambientSource);
const ambientOptionValues = ambientOptions.map((option) => option.value);
const expectedManifestSounds = Object.keys(expectedSampleSources);

assertSameSet("AmbientSound union", ambientUnion, expectedAmbients, failures);
assertSameSet("ALL_AMBIENTS", allAmbients, expectedAmbients, failures);
assertSameSet("audio engine defaults", engineDefaults, expectedAmbients, failures);
assertSameSet("home saved-volume defaults", homeDefaults, expectedAmbients, failures);
assertSameSet("ambient UI options", ambientOptionValues, expectedAmbients, failures);
assertSameSet("SAMPLE_SOURCES", Object.keys(sampleSources), expectedManifestSounds, failures);
assertSameSet("audio source manifest", sourceManifest.map((entry) => entry.sound), expectedManifestSounds, failures);

ambientOptions.forEach((option) => {
  if (expectedLabels[option.value] !== option.label) {
    failures.push(`Unexpected label for ${option.value}: expected ${expectedLabels[option.value]}, found ${option.label}.`);
  }
});

Object.entries(expectedSampleSources).forEach(([sound, publicPath]) => {
  if (sampleSources[sound] !== publicPath) {
    failures.push(`SAMPLE_SOURCES.${sound} expected ${publicPath}, found ${sampleSources[sound] || "missing"}.`);
  }

  const filePath = publicPathToFile(publicPath);
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing audio file for ${sound}: ${publicPath}.`);
  } else if (fs.statSync(filePath).size < 10_000) {
    failures.push(`Audio file for ${sound} is unexpectedly small: ${publicPath}.`);
  }

  const manifestEntry = sourceManifest.find((entry) => entry.sound === sound);
  if (!manifestEntry) {
    failures.push(`Missing audio source manifest entry for ${sound}.`);
  } else {
    ["localFile", "sourceTitle", "sourcePage", "sourceFile", "license", "attribution"].forEach((field) => {
      if (!manifestEntry[field]) failures.push(`Audio source manifest entry for ${sound} is missing ${field}.`);
    });
    if (manifestEntry.localFile !== publicPath) {
      failures.push(`Manifest localFile for ${sound} expected ${publicPath}, found ${manifestEntry.localFile}.`);
    }
  }
});

if (!ambientComponentText.includes("data-testid={`btn-ambient-${opt.value}`}")) {
  failures.push("Ambient buttons are missing the expected btn-ambient-* test id template.");
}

if (!ambientComponentText.includes("data-testid={`slider-ambient-${opt.value}`}")) {
  failures.push("Ambient sliders are missing the expected slider-ambient-* test id template.");
}

if (!ambientComponentText.includes("data-testid={`ambient-volume-${opt.value}`}")) {
  failures.push("Ambient sliders are missing visible ambient-volume-* readouts.");
}

[
  "btn-brown-noise",
  "brown_noise_enabled",
  "changeBrownNoiseLevel",
].forEach((needle) => {
  if (!homeText.includes(needle)) failures.push(`Brown-noise independent control is missing source evidence: ${needle}.`);
});

[
  "layer_modulation_intensity",
  "layer-modulation-panel",
].forEach((needle) => {
  if (!homeText.includes(needle)) failures.push(`Global layer modulation UI is missing source evidence: ${needle}.`);
});

[
  "fetchAudioBuffer",
  "decodeAudioData",
  "ctx.createBufferSource()",
  "source.loop = true",
  "SAMPLE_PLAYBACK_RATES",
  "purring: 0.5",
  "source.playbackRate.value = getSamplePlaybackRate(sound)",
  "setAmbientVolume",
  "node.gain.gain.setTargetAtTime",
  "createBrownNoiseBuffer",
].forEach((needle) => {
  if (!engineText.includes(needle)) failures.push(`Sample-backed engine is missing source evidence: ${needle}.`);
});

[
  "getActiveSampleSounds",
  "scheduleLayerModulation",
  "modulationIndexRef",
  "starSound",
  "starGainTarget",
  "bedGainTarget",
  "holdGainAtCurrentValue",
].forEach((needle) => {
  if (!engineText.includes(needle)) failures.push(`Layer modulation engine is missing source evidence: ${needle}.`);
});

[
  "MIX_PRESETS",
  "encodeMixToSearchParams",
  "decodeMixFromSearch",
  "deep-focus",
  "sleep-rain",
  "rain-cabin",
  "forest-rest",
  "hearth",
  "bowl-reset",
  "coast-drift",
  "city-hush",
  "travel-hum",
].forEach((needle) => {
  if (!mixPresetsText.includes(needle)) failures.push(`Mix preset wiring is missing source evidence: ${needle}.`);
});

[
  "SAVED_MIXES_STORAGE_KEY",
  "loadSavedMixes",
  "persistSavedMixes",
  "createSavedMix",
  "sanitizeSavedMixName",
  "brownNoiseEnabled",
  "waveIntensity",
].forEach((needle) => {
  if (!savedMixesText.includes(needle)) failures.push(`Saved mix storage is missing source evidence: ${needle}.`);
});

if (mixPresetsText.includes("brownVolume") || mixPresetsText.includes("waveIntensity")) {
  failures.push("Mix presets should not control brown noise volume or brown-noise wave intensity.");
}

[
  "btn-mix-shuffle",
  "btn-mix-share",
  "btn-mix-${preset.id}",
].forEach((needle) => {
  if (!mixPresetsComponentText.includes(needle)) failures.push(`Mix preset UI is missing source evidence: ${needle}.`);
});

[
  "saved-mixes-panel",
  "input-saved-mix-name",
  "btn-save-current-mix",
  "btn-apply-saved-mix-${mix.id}",
  "btn-delete-saved-mix-${mix.id}",
].forEach((needle) => {
  if (!savedMixesComponentText.includes(needle)) failures.push(`Saved mix UI is missing source evidence: ${needle}.`);
});

docCoverageTerms.forEach((term) => {
  if (!reviewText.includes(term) && !sampleSourceText.includes(term)) {
    failures.push(`Audio docs are missing required coverage term: ${term}.`);
  }
});

const audioFiles = Object.values(expectedSampleSources).map((publicPath) => {
  const filePath = publicPathToFile(publicPath);
  return {
    sound: Object.entries(expectedSampleSources).find(([, value]) => value === publicPath)?.[0],
    publicPath,
    bytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
  };
});

const report = {
  mode: "recorded-sample-backed-web-audio",
  audioFiles,
  ambientSoundsVerified: expectedAmbients.map((sound) => ({
    sound,
    label: expectedLabels[sound],
    type: ambientUnion.includes(sound),
    allAmbients: allAmbients.includes(sound),
    engineDefault: engineDefaults.includes(sound),
    homeDefault: homeDefaults.includes(sound),
    uiOption: ambientOptionValues.includes(sound),
    sampleSource: sampleSources[sound],
    sampleFilePresent: fs.existsSync(publicPathToFile(expectedSampleSources[sound])),
  })),
  brownNoiseVerified: sampleSources.brown === expectedSampleSources.brown &&
    fs.existsSync(publicPathToFile(expectedSampleSources.brown)),
  purrPlaybackRateVerified: engineText.includes("SAMPLE_PLAYBACK_RATES") &&
    engineText.includes("purring: 0.5") &&
    engineText.includes("source.playbackRate.value = getSamplePlaybackRate(sound)"),
  sliderControlsVerified: ambientComponentText.includes("slider-ambient-${opt.value}") &&
    ambientComponentText.includes("ambient-volume-${opt.value}") &&
    engineText.includes("setAmbientVolume") &&
    engineText.includes("setTargetAtTime"),
  mixPresetsVerified: mixPresetsText.includes("MIX_PRESETS") &&
    mixPresetsComponentText.includes("btn-mix-share") &&
    homeText.includes("copyCurrentMixLink") &&
    !mixPresetsText.includes("brownVolume") &&
    !mixPresetsText.includes("waveIntensity"),
  savedMixesVerified: savedMixesText.includes("SAVED_MIXES_STORAGE_KEY") &&
    savedMixesText.includes("createSavedMix") &&
    savedMixesComponentText.includes("saved-mixes-panel") &&
    savedMixesComponentText.includes("input-saved-mix-name") &&
    homeText.includes("saveCurrentMix") &&
    homeText.includes("applySavedMix") &&
    homeText.includes("deleteSavedMix"),
  brownNoiseStandaloneVerified: homeText.includes("btn-brown-noise") &&
    homeText.includes("brown_noise_enabled") &&
    engineText.includes("if (volumeRef.current > 0)") &&
    engineText.includes("Could not load brown-noise sample"),
  layerModulationVerified: homeText.includes("layer-modulation-panel") &&
    homeText.includes("layer_modulation_intensity") &&
    engineText.includes("scheduleLayerModulation") &&
    engineText.includes("getActiveSampleSounds") &&
    engineText.includes("starGainTarget") &&
    engineText.includes("bedGainTarget"),
  documentationVerified: failures.filter((failure) => failure.includes("docs")).length === 0,
};

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, report }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, report }, null, 2));
