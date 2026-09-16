"use client";

const PRESS_SCALE = 1.16;
const PRESS_EASING = "cubic-bezier(0.2, 0, 0, 1)";

function setPressed(surface: HTMLElement, pressed: boolean) {
  surface.style.transition = `transform ${pressed ? 150 : 210}ms ${PRESS_EASING}`;
  surface.style.transform = pressed ? `scale(${PRESS_SCALE})` : "";
}

/** Swells a glass surface while it is held, settling once the press ends.
 *
 * The release is watched on the window rather than the surface: touch
 * implicitly captures the pointer to whatever was pressed, so a finger that
 * slides off never fires pointerleave there and the surface would stay stuck
 * enlarged. Transitions rather than keyframes, so a press interrupted midway
 * carries on from wherever it currently sits. */
export function beginPress(surface: HTMLElement | null) {
  if (!surface || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  setPressed(surface, true);

  const release = () => {
    setPressed(surface, false);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
  };

  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
}

/** True for the press that should drive the feedback — primary pointer, main
 * button — so a right-click or a second finger does not trigger it. */
export function isPrimaryPress(event: {
  button: number;
  isPrimary: boolean;
}) {
  return event.isPrimary && event.button === 0;
}
