/**
 * 指针输入 → hover / pressed。两个角色共用同一套监听接线。
 *
 * 两条不能省的规则（都踩过）：
 *   ① `up` 必须挂 **window** —— 在元素上按下、移出去再松手，否则会卡在按下态；
 *   ② `leave` 时要不要**连带清掉按下态**由调用方决定（太阳不清、地球清），
 *      所以这里只回调、不写死。
 *
 * 所有监听统一挂在传入的 `AbortController` 上，`destroy()` 时一次清干净。
 * `onCancel` / `onBlur` 不传就不注册 —— 地球只用得上前四个。
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
