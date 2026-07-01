// Transient notice stack anchored to the bottom-center of the preview (#stage). Newest
// message sits at the bottom, older ones above; each removes itself after a timeout.
// Deliberately not animated - messages appear and vanish instantly. The single entry
// point `notify` is imported by every error site (see persistence + ui error handlers).

export type NoticeLevel = "error" | "info";

const NOTICE_DURATION_MS = 5000;
const MAX_NOTICES = 4;

interface ActiveNotice {
  element: HTMLElement;
  timer: number;
}

let stack: HTMLElement | undefined;
// Keyed by message text so repeated failures (e.g. autosave hitting quota every 300ms)
// refresh one notice instead of piling up duplicates.
const active = new Map<string, ActiveNotice>();

export function mountNoticeStack(container: HTMLElement): void {
  stack = document.createElement("div");
  stack.className = "notice-stack";
  container.appendChild(stack);
}

export function notify(message: string, level: NoticeLevel = "error"): void {
  if (!stack) return;

  const existing = active.get(message);
  if (existing) {
    clearTimeout(existing.timer);
    existing.timer = window.setTimeout(() => remove(message), NOTICE_DURATION_MS);
    return;
  }

  const element = document.createElement("div");
  element.className = `notice ${level}`;
  element.textContent = message;
  stack.appendChild(element);

  const timer = window.setTimeout(() => remove(message), NOTICE_DURATION_MS);
  active.set(message, { element, timer });

  // Drop the oldest (topmost) notice once the cap is exceeded.
  while (active.size > MAX_NOTICES) {
    const oldest = active.keys().next().value;
    if (oldest === undefined) break;
    remove(oldest);
  }
}

function remove(message: string): void {
  const notice = active.get(message);
  if (!notice) return;
  clearTimeout(notice.timer);
  notice.element.remove();
  active.delete(message);
}
