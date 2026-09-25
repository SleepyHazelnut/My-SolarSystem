/**
 * 一次冲激 + 指数衰减：`A · e^(−decay·t) · sin(ω·t)`
 *
 * `ω` 与 `decay` 的语义由调用方定 —— 太阳的装饰弹簧是阻尼振子（ωd 振荡、ζωn 衰减），
 * 地球的叶甩用同一个 ω 既衰减又振荡。统一会改掉两边已调好的手感，故不做。
 *
 * sin 起手（t = 0 位移为 0，触发那帧不闪）。⚠️ 地球的落地「释放」波形必须 cos 起手
 * （要接上蓄力末端的压扁量），所以它没走这个函数，别把 sin 起手当全局规矩。
 */
export function dampedImpulse(t, amp, decay, omega) {
  return amp * Math.exp(-decay * t) * Math.sin(omega * t);
}
