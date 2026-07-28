/**
 * Ref-counted body scroll lock so nested overlays (drawer + modal + command palette)
 * don't unlock scroll while another overlay is still open.
 */

let lockCount = 0;
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0 && typeof document !== "undefined") {
      document.body.style.overflow = previousOverflow;
      previousOverflow = "";
    }
  };
}
