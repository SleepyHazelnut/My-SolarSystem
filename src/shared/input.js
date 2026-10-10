/**
 * 指针输入 → hover / pressed。所有角色共用同一套接线。
 *
 * ① `up` 挂 window，不挂命中区。
 * ② `leave` 是否连带清掉按下态由调用方决定，这里只回调。
 * ③ 触屏的 `pointerenter` 不算悬停，直接跳过（否则点一下会留下 hover 态）。
 *
 * 监听统一挂传入的 `AbortController`；`onCancel` / `onBlur` 不传就不注册。
 */
export function bindPointerInput(hitEl, ac, { onEnter, onLeave, onDown, onUp, onCancel, onBlur } = {}) {
  const opt = { signal: ac.signal };
  hitEl.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') onEnter?.(); }, opt);
  hitEl.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') onLeave?.(); }, opt);
  hitEl.addEventListener('pointerdown', (e) => onDown?.(e), opt);
  window.addEventListener('pointerup', () => onUp?.(), opt);
  if (onCancel) window.addEventListener('pointercancel', () => onCancel(), opt);
  if (onBlur) window.addEventListener('blur', () => onBlur(), opt);
}
