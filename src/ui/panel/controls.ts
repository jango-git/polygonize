import { attachTooltip } from "../tooltip.js";

// Generic panel widgets shared by the modifier stack and the settings sections: labeled
// icon-toggle buttons, sliders (with an optional gamma response curve), segmented fields,
// section wrappers, and icon buttons. None of these know about the document; callers wire
// in labels and handlers.

interface Limits {
  min: number;
  max: number;
  step: number;
}

// Native-range position resolution for gamma-mapped sliders (see buildSlider).
const CURVE_STEPS = 1000;

interface SliderOptions {
  label: string;
  tip?: string;
  limits: Limits;
  value: number;
  // Optional response curve: value = min + span * t^gamma, where t is the
  // normalized track position. gamma > 1 spends more of the track on the low end
  // (finer control near the start of the range). Omit or 1 for a linear slider.
  gamma?: number;
  format: (v: number) => string;
  onInput: (v: number) => void;
  onChange: (v: number) => void;
}

// A labeled icon-toggle button (icon + text label, an `active` class). Shared by the
// closed toggle, the path interpolation segments, and buildSegmentedField.
export function iconToggle(
  icon: string,
  label: string,
  active: boolean,
  onClick: (e: MouseEvent) => void,
  tip?: string,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "icon-toggle labeled";
  btn.innerHTML = `${icon}<span class="seg-label">${label}</span>`;
  btn.classList.toggle("active", active);
  if (tip) attachTooltip(btn, label, tip);
  btn.addEventListener("click", onClick);
  return btn;
}

export function makeSection(title: string, hint: string): HTMLElement {
  const section = document.createElement("div");
  section.className = "panel-section";

  const titleEl = document.createElement("p");
  titleEl.className = "section-title";
  titleEl.textContent = title;
  section.appendChild(titleEl);

  const hintEl = document.createElement("p");
  hintEl.className = "section-hint";
  hintEl.textContent = hint;
  section.appendChild(hintEl);

  return section;
}

export function makeIconButton(
  icon: string,
  title: string,
  description: string,
  onClick: () => void,
): HTMLElement {
  const button = document.createElement("button");
  button.className = "panel-button subtle icon-button";
  button.innerHTML = icon;
  attachTooltip(button, title, description);
  button.addEventListener("click", onClick);
  return button;
}

export function buildSlider(options: SliderOptions): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = options.label;
  const value = document.createElement("span");
  value.className = "field-value";
  value.textContent = options.format(options.value);
  label.append(name, value);
  // Attach to the whole field (label + slider) so hovering the slider itself, not
  // only its label, surfaces the hint.
  if (options.tip) attachTooltip(field, options.label, options.tip);

  const input = document.createElement("input");
  input.type = "range";

  const { min, max, step } = options.limits;
  const gamma = options.gamma ?? 1;

  if (gamma === 1) {
    // Linear: the native range maps its position straight onto the value.
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(options.value);
    input.addEventListener("input", () => {
      const v = Number(input.value);
      value.textContent = options.format(v);
      options.onInput(v);
    });
    input.addEventListener("change", () => options.onChange(Number(input.value)));
  } else {
    // Gamma curve: drive the native range as a 0..CURVE_STEPS position and map it
    // through value = min + span * t^gamma, snapping back to the real step. Higher
    // gamma gives finer resolution near the start of the range.
    const span = max - min;
    const toValue = (position: number): number => {
      const t = Math.pow(position / CURVE_STEPS, gamma);
      const snapped = min + Math.round((span * t) / step) * step;
      return Math.min(max, Math.max(min, snapped));
    };
    const toPosition = (v: number): number => {
      const t = span > 0 ? (v - min) / span : 0;
      return Math.round(Math.pow(t, 1 / gamma) * CURVE_STEPS);
    };
    input.min = "0";
    input.max = String(CURVE_STEPS);
    input.step = "1";
    input.value = String(toPosition(options.value));
    input.addEventListener("input", () => {
      const v = toValue(Number(input.value));
      value.textContent = options.format(v);
      options.onInput(v);
    });
    input.addEventListener("change", () => options.onChange(toValue(Number(input.value))));
  }

  field.append(label, input);
  return field;
}

export function buildSegmentedField<T extends string>(
  label: string,
  options: Array<{ value: T; icon: string; label: string; tip?: string }>,
  current: T,
  onChange: (v: T) => void,
): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const labelEl = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = label;
  labelEl.append(name);

  const seg = document.createElement("div");
  seg.className = "seg seg-full";

  let active = current;
  const buttons = options.map((opt) =>
    iconToggle(
      opt.icon,
      opt.label,
      opt.value === active,
      () => {
        if (opt.value === active) return;
        active = opt.value;
        buttons.forEach((b, i) => b.classList.toggle("active", options[i].value === active));
        onChange(opt.value);
      },
      opt.tip,
    ),
  );
  seg.append(...buttons);

  field.append(labelEl, seg);
  return field;
}
