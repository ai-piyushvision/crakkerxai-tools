/**
 * Contain page-level horizontal edge gestures on all CrakkerXworld.AI routes.
 * Vertical scrolling and pinch zoom remain available. Horizontal scrollers
 * opt in with .cx-allow-horizontal-scroll or [data-allow-horizontal-scroll].
 */
let installed = false;
export function initBrowserGestureGuard() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  const isHorizontalScroller = (target) =>
    target instanceof Element &&
    Boolean(target.closest('.cx-allow-horizontal-scroll,[data-allow-horizontal-scroll],.dash-table-scroll'));

  let edgeTouch = null;
  const edgeSize = 56;

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      edgeTouch = null;
      return;
    }
    const touch = event.touches[0];
    const atViewportEdge =
      touch.clientX <= edgeSize ||
      touch.clientX >= window.innerWidth - edgeSize;
    edgeTouch = atViewportEdge ? { x: touch.clientX, y: touch.clientY } : null;
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!edgeTouch || event.touches.length !== 1 || isHorizontalScroller(event.target)) return;
    const touch = event.touches[0];
    const dx = touch.clientX - edgeTouch.x;
    const dy = touch.clientY - edgeTouch.y;
    if (Math.abs(dx) >= 14 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      edgeTouch = null;
    }
  }, { capture: true, passive: false });

  const clearTouch = () => { edgeTouch = null; };
  document.addEventListener('touchend', clearTouch, { capture: true, passive: true });
  document.addEventListener('touchcancel', clearTouch, { capture: true, passive: true });

  document.addEventListener('wheel', (event) => {
    if (isHorizontalScroller(event.target) || !event.cancelable) return;
    const horizontal = Math.abs(event.deltaX);
    const vertical = Math.abs(event.deltaY);
    if (horizontal >= 8 && horizontal > vertical * 1.15) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true, passive: false });


  // Some mouse-gesture extensions and desktop gesture tools use right-button
  // horizontal drags to request browser Back/Forward. Cancel only an actual
  // horizontal right-drag; ordinary right-click context menus remain intact.
  let rightDrag = null;
  let suppressContextMenu = false;
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 2) {
      rightDrag = { x: event.clientX, y: event.clientY, dragged: false };
    }
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', (event) => {
    if (!rightDrag || event.buttons !== 2) return;
    const dx = event.clientX - rightDrag.x;
    const dy = event.clientY - rightDrag.y;
    if (Math.abs(dx) >= 18 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      rightDrag.dragged = true;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true, passive: false });

  document.addEventListener('pointerup', () => {
    if (rightDrag?.dragged) {
      suppressContextMenu = true;
      window.setTimeout(() => { suppressContextMenu = false; }, 0);
    }
    rightDrag = null;
  }, { capture: true, passive: true });

  document.addEventListener('pointercancel', () => { rightDrag = null; }, { capture: true, passive: true });

  document.addEventListener('contextmenu', (event) => {
    if (suppressContextMenu) {
      event.preventDefault();
      event.stopPropagation();
      suppressContextMenu = false;
    }
  }, { capture: true });

  // Avoid horizontal overscroll chaining from nested page containers.
  document.documentElement.style.overscrollBehaviorX = 'none';
  document.documentElement.style.overscrollBehaviorY = 'contain';
  document.body.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorY = 'contain';
  document.body.style.touchAction = 'pan-y pinch-zoom';
}
