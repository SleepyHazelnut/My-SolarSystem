/**
 * 一次冲激 + 指数衰减：`A · e^(−decay·t) · sin(ω·t)`
 *
 * `ω` 与 `decay` 的语义**由调用方定**，两个角色用法不同：
 *   太阳的装饰弹簧用阻尼频率 ωd 振荡、`ζ·ωn` 衰减（阻尼振子）；
 *   地球的叶甩用同一个 ω 既衰减又振荡。统一语义会改掉两边已调好的手感，故不做。
 *
 * 一律 **sin 起手**（t=0 位移为 0，触发那一帧不闪）。
 * ⚠️ 这不是「所有振荡都得 sin 起手」—— 地球的落地「释放」波形（`earth/anim.js` 的
 *    `releaseWave`）**必须 cos 起手**：它要接着蓄力末端的压扁量往下走，t=0 值为 1 才连续。
 *    只是它没走这个函数（自己写了一条），这里别当成全局规矩照搬。
 */
export function dampedImpulse(t, amp, decay, omega) {
  return amp * Math.exp(-decay * t) * Math.sin(omega * t);
}
