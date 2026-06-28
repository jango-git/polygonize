let tip: HTMLElement | null = null;
let tipTitle: HTMLElement | null = null;
let tipDesc: HTMLElement | null = null;

function ensureTip(): HTMLElement {
  if (tip && tipTitle && tipDesc) return tip;
  tip = document.createElement("div");
  tip.className = "tooltip";
  tipTitle = document.createElement("div");
  tipTitle.className = "tooltip-title";
  tipDesc = document.createElement("div");
  tipDesc.className = "tooltip-desc";
  tip.append(tipTitle, tipDesc);
  document.body.appendChild(tip);
  return tip;
}

function showTooltip(target: HTMLElement, title: string, description: string): void {
  const el = ensureTip();
  tipTitle!.textContent = title;
  tipDesc!.textContent = description;
  tipDesc!.style.display = description ? "" : "none";
  el.classList.add("visible");

  const GAP = 8;
  const rect = target.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const left = Math.max(
    GAP,
    Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - GAP),
  );

  // Default below the target; flip above when that would overflow the viewport
  // bottom. The flipped position sits a gap above the top edge, never overlapping.
  let top = rect.bottom + GAP;
  if (top + height > window.innerHeight - GAP) {
    top = Math.max(GAP, rect.top - height - GAP);
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function hideTooltip(): void {
  tip?.classList.remove("visible");
}

export function attachTooltip(target: HTMLElement, title: string, description = ""): void {
  target.setAttribute("aria-label", description ? `${title}. ${description}` : title);
  target.addEventListener("mouseenter", () => showTooltip(target, title, description));
  target.addEventListener("mouseleave", hideTooltip);

  target.addEventListener("mousedown", hideTooltip);
}
