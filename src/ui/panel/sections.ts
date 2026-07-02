import {
  getColorSettings,
  getSeed,
  getSeedSettings,
  randomizeSeed,
  regenerateColors,
  regenerateSeed,
  setSeed,
  updateColorSettings,
  updateSeedSettings,
} from "../../document/commands/generation.js";
import { traceImageEdges } from "../../document/commands/trace.js";
import { getTraceSettings, updateTraceSettings } from "../../settings/store.js";
import {
  COLOR_LIMITS,
  SEED_LIMITS,
  TRACE_LIMITS,
  type ColorStrategy,
} from "../../settings/types.js";
import { t } from "../../i18n/index.js";
import { attachTooltip } from "../tooltip.js";
import { ICONS } from "../icons/index.js";
import { buildSegmentedField, buildSlider, makeIconButton, makeSection } from "./controls.js";

// The seed is a uint32, so its decimal form is at most 10 digits. The field is
// held to exactly this width: digits only, longer input truncated, shorter input
// zero-padded on commit.
const SEED_DIGITS = 10;

function formatSeed(seed: number): string {
  return String(seed >>> 0).padStart(SEED_DIGITS, "0");
}

export function buildPointSection(): HTMLElement {
  const section = makeSection(t("panel.pointGen.title"), t("panel.pointGen.hint"));

  const s = getSeedSettings();
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.perSide"),
      tip: t("panel.pointGen.perSideTip"),
      limits: SEED_LIMITS.borderPerSide,
      value: s.borderPerSide,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ borderPerSide: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.minRadius"),
      tip: t("panel.pointGen.minRadiusTip"),
      limits: SEED_LIMITS.minRadius,
      value: s.minRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ minRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.pointGen.maxRadius"),
      tip: t("panel.pointGen.maxRadiusTip"),
      limits: SEED_LIMITS.maxRadius,
      value: s.maxRadius,
      format: (v) => String(v),
      onInput: (v) => updateSeedSettings({ maxRadius: v }),
      onChange: () => regenerateSeed(),
    }),
  );
  section.appendChild(buildSeedField());

  return section;
}

function buildSeedField(): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = t("panel.pointGen.seed");
  label.append(name);
  // Both the label and the field itself carry the hint; the randomize button keeps
  // its own so hovering anywhere on the row explains what the seed does.
  attachTooltip(label, t("panel.pointGen.seed"), t("panel.pointGen.seedTip"));

  const row = document.createElement("div");
  row.className = "seed-row";

  const input = document.createElement("input");
  input.className = "seed-input";
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = SEED_DIGITS;
  input.value = formatSeed(getSeed());
  attachTooltip(input, t("panel.pointGen.seed"), t("panel.pointGen.seedTip"));

  // Keep the field digits-only and within the fixed width while typing.
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, SEED_DIGITS);
    if (digits !== input.value) input.value = digits;
  });

  // On commit: ignore a non-numeric (empty) entry; otherwise store the value and
  // redisplay the normalized seed zero-padded to the fixed width.
  input.addEventListener("change", () => {
    const digits = input.value.replace(/\D/g, "");
    if (digits === "") {
      input.value = formatSeed(getSeed());
      return;
    }
    setSeed(Number(digits));
    input.value = formatSeed(getSeed());
  });

  const randomizeButton = makeIconButton(
    ICONS.dice,
    t("panel.pointGen.randomSeed"),
    t("panel.pointGen.randomSeedHint"),
    () => {
      randomizeSeed();
      input.value = formatSeed(getSeed());
    },
  );

  row.append(input, randomizeButton);
  field.append(label, row);
  return field;
}

export function buildTraceSection(): HTMLElement {
  const section = makeSection(t("panel.trace.title"), t("panel.trace.hint"));

  const s = getTraceSettings();
  section.appendChild(
    buildSlider({
      label: t("panel.trace.low"),
      tip: t("panel.trace.lowTip"),
      limits: TRACE_LIMITS.lowThreshold,
      value: s.lowThreshold,
      format: (v) => v.toFixed(2),
      onInput: (v) => updateTraceSettings({ lowThreshold: v }),
      onChange: () => {},
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.trace.high"),
      tip: t("panel.trace.highTip"),
      limits: TRACE_LIMITS.highThreshold,
      value: s.highThreshold,
      format: (v) => v.toFixed(2),
      onInput: (v) => updateTraceSettings({ highThreshold: v }),
      onChange: () => {},
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.trace.simplify"),
      tip: t("panel.trace.simplifyTip"),
      limits: TRACE_LIMITS.simplifyPx,
      value: s.simplifyPx,
      format: (v) => v.toFixed(1),
      onInput: (v) => updateTraceSettings({ simplifyPx: v }),
      onChange: () => {},
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.trace.minPoints"),
      tip: t("panel.trace.minPointsTip"),
      limits: TRACE_LIMITS.minPoints,
      value: s.minPoints,
      format: (v) => String(v),
      onInput: (v) => updateTraceSettings({ minPoints: v }),
      onChange: () => {},
    }),
  );
  section.appendChild(
    buildSlider({
      label: t("panel.trace.minLength"),
      tip: t("panel.trace.minLengthTip"),
      limits: TRACE_LIMITS.minLength,
      value: s.minLength,
      format: (v) => String(v),
      onInput: (v) => updateTraceSettings({ minLength: v }),
      onChange: () => {},
    }),
  );

  // One-shot action: trace the image into the managed "Traced contours" group with the
  // current settings (overwrites it). No-op when no image is loaded.
  const run = document.createElement("button");
  run.className = "panel-button subtle trace-run";
  run.innerHTML = `${ICONS.trace}<span>${t("panel.trace.run")}</span>`;
  attachTooltip(run, t("panel.trace.run"), t("panel.trace.runTip"));
  run.addEventListener("click", () => traceImageEdges());
  section.appendChild(run);

  return section;
}

export function buildColorSection(): HTMLElement {
  const section = makeSection(t("panel.color.title"), t("panel.color.hint"));

  const c = getColorSettings();
  section.appendChild(
    buildSlider({
      label: t("panel.color.samples"),
      tip: t("panel.color.samplesTip"),
      limits: COLOR_LIMITS.samplesPerTriangle,
      value: c.samplesPerTriangle,
      format: (v) => String(v),
      onInput: (v) => updateColorSettings({ samplesPerTriangle: v }),
      onChange: () => regenerateColors(),
    }),
  );
  section.appendChild(
    buildSegmentedField<ColorStrategy>(
      t("panel.color.strategy"),
      [
        {
          value: "median",
          icon: ICONS.median,
          label: t("panel.color.median"),
          tip: t("panel.color.medianTip"),
        },
        {
          value: "average",
          icon: ICONS.average,
          label: t("panel.color.average"),
          tip: t("panel.color.averageTip"),
        },
      ],
      c.strategy,
      (v) => {
        updateColorSettings({ strategy: v });
        regenerateColors();
      },
    ),
  );

  return section;
}
