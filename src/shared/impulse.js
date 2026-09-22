/**
 * 一次冲激 + 指数衰减：`A · e^(−decay·t) · sin(ω·t)`
 *
 * `ω` 与 `decay` 的语义**由调用方定**，两个角色用法不同：
 *   太阳的装饰弹簧用阻尼频率 ωd 振荡、`ζ·ωn` 衰减（阻尼振子）；
 *   地球的叶甩用同一个 ω 既衰减又振荡。统一语义会改掉两边已调好的手感，故不做。
 *
 * 一律 **sin 起手**（t=0 位移为 0）；cos 起手第一帧就有位移，会闪一下。
 */
export function dampedImpulse(t, amp, decay, omega) {
  return amp * Math.exp(-decay * t) * Math.sin(omega * t);
}
