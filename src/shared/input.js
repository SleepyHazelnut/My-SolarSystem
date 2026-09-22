/**
 * 指针输入 → hover / pressed。两个角色共用同一套接线。
 *
 * ① `up` 必须挂 **window**：在元素上按下、移出去再松手，否则卡在按下态。
 * ② `leave` 要不要连带清掉按下态**由调用方决定**（太阳不清、地球清），这里只回调。
 *
 * 监听统一挂传入的 `AbortController`；`onCancel` / `onBlur` 不传就不注册。
 */
export function bindPointerInput(hitEl, ac, { onEnter, onLeave, onDown, onUp, onCancel, onBlur } = {}) {
  const opt = { signal: ac.signal };
  hitEl.addEventListener('pointerenter', () => onEnter?.(), opt);
  hitEl.addEventListener('pointerleave', () => onLeave?.(), opt);
  hitEl.addEventListener('pointerdown', (e) => onDown?.(e), opt);
  window.addEventListener('pointerup', () => onUp?.(), opt);
  if (onCancel) window.addEventListener('pointercancel', () => onCancel(), opt);
  if (onBlur) window.addEventListener('blur', () => onBlur(), opt);
}
