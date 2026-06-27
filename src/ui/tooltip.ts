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

  const rect = target.getBoundingClientRect();
  const width = el.offsetWidth;
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8),
  );
  el.style.left = `${left}px`;
  el.style.top = `${rect.bottom + 8}px`;
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
