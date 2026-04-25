/**
 * Weight Inference - on-device XGBoost regressor + LWR formula (pure TypeScript)
 *
 * Two prediction methods are blended:
 *   1. XGBoost model: base_score + Σ leaf_value(tree_i, features)
 *   2. Length-Weight Relationship (LWR): W = a · L¹ᵇ
 *      where a and b are species-specific constants from weight.json.
 *
 * Final predicted weight is the simple average of both outputs.
 *
 * Feature order (XGBoost): [Species(int), Length1, Length3, Height, Width] (cm)
 * Species mapping mirrors ML/weight.py exactly so predictions are consistent.
 */

// ── LWR constants (weight.json) ──────────────────────────────────────────────

interface LWREntry {
  id: number;
  common_name: string;
  constant_a: number;
  constant_b: number;
  growth_type: string;
}

// Loaded once; keyed by lower-cased common_name for robust lookup.
const _lwrMap: Map<string, LWREntry> = new Map(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require("../weight.json") as LWREntry[]).map((e) => [
    e.common_name.toLowerCase(),
    e,
  ]),
);

/**
 * Compute weight via the Length-Weight Relationship: W = a · L^b
 * Returns null when the species has no LWR entry.
 */
function lwrPredict(speciesName: string, lengthCm: number): number | null {
  const entry = _lwrMap.get(speciesName.trim().toLowerCase());
  if (!entry) return null;
  return entry.constant_a * Math.pow(lengthCm, entry.constant_b);
}

// ── Types for the JSON tree format ────────────────────────────────────────────

interface XGBNode {
  nodeid: number;
  depth?: number;
  split?: string; // feature name, e.g. "Length1"
  split_condition?: number; // threshold
  yes?: number; // child nodeid when feature < threshold
  no?: number; // child nodeid when feature >= threshold
  missing?: number; // child nodeid for missing values
  leaf?: number; // leaf value (present only on leaf nodes)
  children?: XGBNode[];
}

interface WeightModelJSON {
  base_score: number;
  feature_names: string[]; // ["Species","Length1","Length3","Height","Width"]
  trees: XGBNode[];
  _meta: {
    n_trees: number;
    objective: string;
    formula: string;
    reference_predictions: Array<{ input: number[]; output: number }>;
  };
}

// ── Species mapping (31 app species → 7 XGBoost classes) ─────────────────────

const SPECIES_ORDER = [
  "Bream", // 0
  "Parkki", // 1
  "Perch", // 2
  "Pike", // 3
  "Roach", // 4
  "Smelt", // 5
  "Whitefish", // 6
] as const;

const SPECIES_MAPPING: Record<string, string> = {
  Bangus: "Whitefish",
  "Big Head Carp": "Pike",
  "Black Spotted Barb": "Roach",
  Catfish: "Pike",
  "Climbing Perch": "Perch",
  "Fourfinger Threadfin": "Whitefish",
  "Freshwater Eel": "Bream",
  "Glass Perchlet": "Smelt",
  Goby: "Smelt",
  "Gold Fish": "Roach",
  Gourami: "Perch",
  "Grass Carp": "Pike",
  "Green Spotted Puffer": "Roach",
  "Indian Carp": "Whitefish",
  "Indo-Pacific Tarpon": "Pike",
  "Jaguar Guapote": "Pike",
  "Janitor Fish": "Bream",
  Knifefish: "Perch",
  "Long-Snouted Pipefish": "Smelt",
  "Mosquito Fish": "Smelt",
  Mudfish: "Perch",
  Mullet: "Bream",
  Pangasius: "Pike",
  Perch: "Perch",
  "Scat Fish": "Perch",
  "Silver Barb": "Bream",
  "Silver Carp": "Pike",
  "Silver Perch": "Perch",
  Snakehead: "Pike",
  Tenpounder: "Pike",
  Tilapia: "Bream",
};

/** Returns the integer index (0-6) for a species name, or null if unmappable. */
export function getSpeciesIndex(speciesName: string): number | null {
  const title = speciesName.trim();
  const mapped =
    SPECIES_MAPPING[title] ??
    (SPECIES_ORDER.includes(title as (typeof SPECIES_ORDER)[number])
      ? title
      : null);
  if (!mapped) return null;
  const idx = SPECIES_ORDER.indexOf(mapped as (typeof SPECIES_ORDER)[number]);
  return idx >= 0 ? idx : null;
}

// ── Model loading ─────────────────────────────────────────────────────────────

let _modelData: WeightModelJSON | null = null;
// feature name → array index map built once after loading
let _featureIndex: Map<string, number> | null = null;

export function isWeightModelLoaded(): boolean {
  return _modelData !== null;
}

export async function loadWeightModel(): Promise<void> {
  if (_modelData) return;

  // require() is synchronous in React Native / Metro bundler
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw: WeightModelJSON = require("../assets/models/weight_model.json");
  _modelData = raw;

  _featureIndex = new Map(raw.feature_names.map((name, idx) => [name, idx]));

  console.log(
    `[WeightInference] Loaded ${raw._meta.n_trees} trees, base_score=${raw.base_score}`,
  );
}

// ── Tree walking ──────────────────────────────────────────────────────────────

/**
 * Flatten a tree rooted at `root` into a Map<nodeid, XGBNode> for O(1) lookup.
 */
function buildNodeMap(root: XGBNode): Map<number, XGBNode> {
  const map = new Map<number, XGBNode>();
  const stack: XGBNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    map.set(node.nodeid, node);
    if (node.children) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }
  return map;
}

function walkTree(
  root: XGBNode,
  features: number[],
  featureIndex: Map<string, number>,
): number {
  const nodeMap = buildNodeMap(root);
  let node = root;

  while (node.leaf === undefined) {
    const featName = node.split!;
    const featIdx = featureIndex.get(featName) ?? -1;
    const val = featIdx >= 0 ? features[featIdx] : NaN;
    const threshold = node.split_condition!;

    let nextId: number;
    if (isNaN(val)) {
      nextId = node.missing ?? node.yes!;
    } else if (val < threshold) {
      nextId = node.yes!;
    } else {
      nextId = node.no!;
    }

    node = nodeMap.get(nextId)!;
  }

  return node.leaf!;
}

// ── Public inference API ──────────────────────────────────────────────────────

export interface WeightInputs {
  species: string; // species label from the TFLite classifier
  length1: number; // vertical body length   (cm)
  length3: number; // cross / diagonal length (cm)
  height: number; // body height             (cm)
  width: number; // body width              (cm)
}

export interface WeightResult {
  /** Final predicted weight - average of XGBoost and LWR (or XGBoost alone if LWR unavailable). */
  predictedWeightG: number;
  /** Raw XGBoost model output (g). */
  xgboostWeightG: number;
  /** LWR formula output W = a·L^b (g), or null if the species has no LWR data. */
  lwrWeightG: number | null;
  mappedSpecies: string | null;
  speciesIndex: number | null;
}

/**
 * Run weight estimation entirely on-device.
 * Loads weight_model.json on first call automatically.
 */
export async function predictWeight(
  inputs: WeightInputs,
): Promise<WeightResult> {
  if (!_modelData) {
    await loadWeightModel();
  }

  const model = _modelData!;
  const featureIndex = _featureIndex!;

  const speciesIndex = getSpeciesIndex(inputs.species);
  if (speciesIndex === null) {
    throw new Error(
      `Species "${inputs.species}" is not supported by the weight model.`,
    );
  }
  const mappedSpecies = SPECIES_ORDER[speciesIndex];

  // Feature vector order must match training: [Species, Length1, Length3, Height, Width]
  const features: number[] = [
    speciesIndex,
    inputs.length1,
    inputs.length3,
    inputs.height,
    inputs.width,
  ];

  // Sum leaf values across all trees (reg:squarederror - no sigmoid/log transform)
  let leafSum = 0;
  for (const tree of model.trees) {
    leafSum += walkTree(tree, features, featureIndex);
  }

  const xgboostWeightG = Math.max(0, model.base_score + leafSum);

  // LWR: W = a · Length3^b  (species-specific constants from weight.json)
  const rawLwr = lwrPredict(inputs.species, inputs.length3);
  const lwrWeightG = rawLwr !== null ? Math.max(0, rawLwr) : null;

  // Final weight: average of both methods (or XGBoost alone as fallback)
  const blended =
    lwrWeightG !== null ? (xgboostWeightG + lwrWeightG) / 2 : xgboostWeightG;

  return {
    predictedWeightG: Math.round(blended * 10) / 10,
    xgboostWeightG: Math.round(xgboostWeightG * 10) / 10,
    lwrWeightG: lwrWeightG !== null ? Math.round(lwrWeightG * 10) / 10 : null,
    mappedSpecies,
    speciesIndex,
  };
}
