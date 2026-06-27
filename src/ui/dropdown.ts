export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

export interface DropdownConfig {
  options: DropdownOption[];
  value: string;
  columns?: number;
  className?: string;
  ariaLabel?: string;
  triggerLabel?: (current: DropdownOption | undefined, value: string) => string;
  onSelect: (value: string) => void;
}

export interface DropdownHandle {
  el: HTMLButtonElement;
  setValue(value: string): void;
}

const CARET = `<svg class="dropdown-caret" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="3,6 8,11 13,6"/>
</svg>`;

let activeClose: (() => void) | null = null;

function closeActive(): void {
  if (activeClose) activeClose();
}

export function createDropdown(config: DropdownConfig): DropdownHandle {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = config.className
    ? `dropdown-trigger ${config.className}`
    : "dropdown-trigger";
  if (config.ariaLabel) trigger.setAttribute("aria-label", config.ariaLabel);

  const labelSpan = document.createElement("span");
  labelSpan.className = "dropdown-trigger-label";
  trigger.append(labelSpan);
  trigger.insertAdjacentHTML("beforeend", CARET);

  let current = config.value;

  const renderLabel = (): void => {
    const opt = config.options.find((o) => o.value === current);
    labelSpan.textContent = config.triggerLabel
      ? config.triggerLabel(opt, current)
      : (opt?.label ?? current);
  };
  renderLabel();

  const open = (): void => {
    const pop = document.createElement("div");
    pop.className = "dropdown-pop";
    const columns = config.columns ?? 1;
    if (columns > 1) {
      pop.classList.add("grid");
      pop.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    }

    for (const opt of config.options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "dropdown-option";
      if (opt.value === current) item.classList.add("selected");

      const main = document.createElement("span");
      main.className = "dropdown-option-label";
      main.textContent = opt.label;
      item.append(main);

      if (opt.hint) {
        const hint = document.createElement("span");
        hint.className = "dropdown-option-hint";
        hint.textContent = opt.hint;
        item.append(hint);
      }

      item.addEventListener("click", () => {
        const value = opt.value;
        closeActive();
        if (value !== current) {
          current = value;
          renderLabel();
        }
        config.onSelect(value);
      });
      pop.append(item);
    }

    document.body.append(pop);
    trigger.classList.add("open");
    position(pop, trigger);

    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!pop.contains(target) && !trigger.contains(target)) closeActive();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeActive();
      }
    };
    const onReflow = (): void => closeActive();

    // Defer so the click that opened the popup doesn't immediately close it.
    setTimeout(() => document.addEventListener("pointerdown", onPointer), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);

    activeClose = (): void => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
      pop.remove();
      trigger.classList.remove("open");
      activeClose = null;
    };
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeClose) {
      // Toggle: clicking the open trigger closes it.
      closeActive();
      return;
    }
    open();
  });

  return {
    el: trigger,
    setValue(value: string): void {
      current = value;
      renderLabel();
    },
  };
}

function position(pop: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect();
  const width = pop.offsetWidth;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  pop.style.left = `${left}px`;

  const height = pop.offsetHeight;
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 6);
  }
  pop.style.top = `${top}px`;
}
