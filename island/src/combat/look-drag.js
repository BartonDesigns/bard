// One captured finger can keep firing while adjusting the view. Other fingers remain free.
export function bindLookDrag(button, mount, { start = () => true, end = () => {}, cancel = end } = {}) {
 let pointer = null;
 const finish = (e, aborted = false) => {
  if (!pointer || (e && e.pointerId !== pointer.id)) return;
  const id = pointer.id; pointer = null;
  if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
  (aborted ? cancel : end)();
 };
 button.addEventListener('pointerdown', e => {
  e.stopPropagation(); e.preventDefault();
  if (pointer || start(e) === false) return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { button.setPointerCapture(e.pointerId); } catch {}
 });
 button.addEventListener('pointermove', e => {
  if (!pointer || e.pointerId !== pointer.id) return;
  e.stopPropagation(); e.preventDefault();
  mount.dispatchEvent(new CustomEvent('l99-look-delta', { detail: { x: e.clientX - pointer.x, y: e.clientY - pointer.y } }));
  pointer.x = e.clientX; pointer.y = e.clientY;
 });
 button.addEventListener('pointerup', e => finish(e));
 button.addEventListener('pointercancel', e => finish(e, true));
 button.addEventListener('lostpointercapture', e => finish(e, true));
 addEventListener('blur', () => finish(null, true));
 document.addEventListener('visibilitychange', () => { if (document.hidden) finish(null, true); });
 return () => finish(null, true);
}
