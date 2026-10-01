/**
 * 一次冲激 + 指数衰减：`A · e^(−decay·t) · sin(ω·t)`
 *
 * `ω` 与 `decay` 的语义由调用方定。不同动作对同一对参数的解释可能不同，
 * 统一语义会改掉已调好的手感，故不做。
 *
 * sin 起手（t = 0 位移为 0）。需要衔接已有位移的波形用 cos 起手。
 */
export function dampedImpulse(t, amp, decay, omega) {
  return amp * Math.exp(-decay * t) * Math.sin(omega * t);
}
