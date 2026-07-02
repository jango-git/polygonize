// Click-to-confirm: counts down from `start` on repeated clicks, then runs `onConfirm`.
// Reverts to `icon` if left idle for CONFIRM_REVERT_MS. Shared by the modifier panel's
// clear-all / per-card / per-group remove buttons and the tool palette's reset button.
const CONFIRM_REVERT_MS = 2000;

export function attachCountdownConfirm(
  button: HTMLElement,
  icon: string,
  start: number,
  onConfirm: () => void,
): void {
  let count: number | undefined;
  let timer: number | undefined;

  const revert = (): void => {
    count = undefined;
    button.classList.remove("counting");
    button.innerHTML = icon;
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (timer !== undefined) clearTimeout(timer);

    count = count === undefined ? start : count - 1;

    if (count <= 0) {
      revert();
      onConfirm();
      return;
    }

    button.classList.add("counting");
    button.textContent = String(count);
    timer = window.setTimeout(revert, CONFIRM_REVERT_MS);
  });
}
