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
];

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
};

const requestedCoverage = {
  brownNoise: ["createBrownNoiseBuffer", "normalizeBuffer", "makeLoopSeamless", "setVolume"],
  rain: ["createAmbientChannel(\"rain\")", "scheduleRainEvent", "ambientVolumes.rain"],
  coffee: ["createAmbientChannel(\"coffee\")", "scheduleCoffeeEvent", "ambientVolumes.coffee"],
  thunder: ["createAmbientChannel(\"thunder\")", "scheduleStrike", "ambientVolumes.thunder"],
  wind: ["createAmbientChannel(\"wind\")", "scheduleGust", "ambientVolumes.wind"],
  birds: ["createAmbientChannel(\"birds\")", "scheduleChirpGroup", "ambientVolumes.birds"],
  campfire: ["createAmbientChannel(\"campfire\")", "scheduleCrackle", "ambientVolumes.campfire"],
  ring: ["createAmbientChannel(\"ring\")", "scheduleBowlStrike", "ambientVolumes.ring"],
  purring: ["createAmbientChannel(\"purring\")", "schedulePurrCycle", "ambientVolumes.purring"],
  forest: ["createAmbientChannel(\"forest\")", "scheduleForestEvent", "ambientVolumes.forest"],
};

const docCoverageTerms = [
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
  "Additional Calming Sounds To Add Next",
];

const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".webm"]);

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

function walkFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

function assertSameSet(name, actual, expected, failures) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  if (missing.length || extra.length) {
    failures.push(`${name} mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`);
  }
}

const engineText = read("client/src/hooks/use-audio-engine.ts");
const homeText = read("client/src/pages/Home.tsx");
const ambientComponentText = read("client/src/components/AmbientSounds.tsx");
const reviewText = read("docs/audio-soundscape-review.md");

const engineSource = parse("client/src/hooks/use-audio-engine.ts", engineText);
const homeSource = parse("client/src/pages/Home.tsx", homeText);
const ambientSource = parse("client/src/components/AmbientSounds.tsx", ambientComponentText);

const failures = [];
const ambientUnion = getStringUnion(engineSource, "AmbientSound");
const allAmbients = getStringArray(engineSource, "ALL_AMBIENTS");
const engineDefaults = getObjectKeys(engineSource, "DEFAULT_VOLUMES");
const homeDefaults = getObjectKeys(homeSource, "DEFAULT_AMBIENT_VOLUMES");
const ambientOptions = getAmbientOptions(ambientSource);
const ambientOptionValues = ambientOptions.map((option) => option.value);

assertSameSet("AmbientSound union", ambientUnion, expectedAmbients, failures);
assertSameSet("ALL_AMBIENTS", allAmbients, expectedAmbients, failures);
assertSameSet("audio engine defaults", engineDefaults, expectedAmbients, failures);
assertSameSet("home saved-volume defaults", homeDefaults, expectedAmbients, failures);
assertSameSet("ambient UI options", ambientOptionValues, expectedAmbients, failures);

ambientOptions.forEach((option) => {
  if (expectedLabels[option.value] !== option.label) {
    failures.push(`Unexpected label for ${option.value}: expected ${expectedLabels[option.value]}, found ${option.label}.`);
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

if (!engineText.includes("ug.gain.setTargetAtTime(nextVol")) {
  failures.push("Ambient slider changes do not clearly drive the per-sound GainNode target value.");
}

Object.entries(requestedCoverage).forEach(([sound, needles]) => {
  needles.forEach((needle) => {
    if (!engineText.includes(needle)) {
      failures.push(`${sound} is missing source evidence: ${needle}.`);
    }
  });
});

docCoverageTerms.forEach((term) => {
  if (!reviewText.includes(term)) {
    failures.push(`Audio review doc is missing required coverage term: ${term}.`);
  }
});

const audioFiles = walkFiles(root)
  .filter((filePath) => audioExtensions.has(path.extname(filePath).toLowerCase()))
  .map((filePath) => path.relative(root, filePath).replaceAll(path.sep, "/"));

const report = {
  mode: audioFiles.length === 0 ? "procedural-web-audio" : "file-backed-audio-present",
  audioFilesFound: audioFiles,
  ambientSoundsVerified: expectedAmbients.map((sound) => ({
    sound,
    label: expectedLabels[sound],
    type: ambientUnion.includes(sound),
    allAmbients: allAmbients.includes(sound),
    engineDefault: engineDefaults.includes(sound),
    homeDefault: homeDefaults.includes(sound),
    uiOption: ambientOptionValues.includes(sound),
    gainWired: engineText.includes("ug.gain.setTargetAtTime(nextVol"),
  })),
  brownNoiseVerified: requestedCoverage.brownNoise.every((needle) => engineText.includes(needle)),
  sliderControlsVerified: ambientComponentText.includes("slider-ambient-${opt.value}") &&
    ambientComponentText.includes("ambient-volume-${opt.value}") &&
    engineText.includes("setAmbientVolume"),
  documentationVerified: docCoverageTerms.every((term) => reviewText.includes(term)),
};

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, report }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, report }, null, 2));

