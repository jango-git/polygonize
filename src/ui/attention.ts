import { signals } from "../document/signals.js";
import { store } from "../document/store.js";

const NEEDS_IMAGE_CLASS = "needs-image";

/**
 * Pulse-highlight an element while no image is loaded, clearing the highlight
 * once one is. Used to nudge first-time users toward loading a photo.
 */
export function highlightUntilImage(el: HTMLElement): void {
  const sync = (): void => {
    el.classList.toggle(NEEDS_IMAGE_CLASS, !store.data().image);
  };
  signals.image.on(sync);
  sync();
}
