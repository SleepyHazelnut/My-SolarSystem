/**
 * 眨眼层：逐实例的随机计时器 + 三态闭眼量。
 *
 * 太阳和地球用的是**同一套结构**，差别只在参数 —— 相位帧数、间隔区间、缓动、
 * 要不要连眨。所以差异全部收进 options，数值本身一点不改。
 *
 * ⚠️ 相位**按帧对齐**（`closeF` / `holdF` / `openF` 是帧数，不是比例）：
 *    用「时长 × 百分比」分相位会让采样点错开「完全闭合」那一帧 ——
 *    实测闭眼量峰值只到 0.883、豆豆眼残留 0.117，也就是**眼睛从来没真正闭上**。
 *
 * ⚠️ 间隔一律是「两次眨眼**起点**到起点」的口径，不是「眨完之后的停顿」，
 *    内部会减掉 `dur` —— 所以传进来的数就是眼睛两次闭上之间的真实间隔。
 *
 * ⚠️ `rand` 是注入的随机源（默认 `Math.random`）。`double = 0` 时**不消耗随机数**，
 *    所以没开连眨的角色，它的随机序列与改动前完全一致。
 */
export function createBlinkLayer({
  closeF, holdF, openF,
  min, max,
  firstMin, firstMax,
  double = 0, doubleMin = 0, doubleMax = 0,
  easeIn = (u) => u,
  easeOut = (u) => u,
  rand = Math.random,
} = {}) {
  const dur = (closeF + holdF + openF) / 60;
  let t = -1;        // 当前这次眨眼已经进行了多少秒；-1 = 没在眨
  let wait = firstMin + rand() * (firstMax - firstMin);

  /**
   * 立刻眨一次（给「转场眨眼」用：进入 Hover 时眨一下 = 注意到你了）。
   * ⚠️ 已经在眨的那一次**不受影响** —— 直接把 t 置 0 会把它截断成半次。
   */
  function fire() { if (t < 0) t = 0; }

  /**
   * 排下一次眨眼：把「起点到起点」的间隔换算成「本次结束之后的停顿」。
   * ⚠️ 连眨的概率判定放在**每次眨眼结束时**（见 `step`），不是放在调度时 ——
   *    这样连眨的第二下还有机会再触发第三下。
   */
  function schedule() {
    const span = (double > 0 && rand() < double)
      ? doubleMin + rand() * (doubleMax - doubleMin)
      : min + rand() * (max - min);
    wait = Math.max(span - dur, 0);
  }

  /** 闭眼量 0~1（0 = 完全睁开） */
  function value() {
    if (t < 0) return 0;
    const f = t * 60;                                 // 已进行的帧数
    if (f < closeF) return easeIn(f / closeF);
    if (f < closeF + holdF) return 1;                 // 真正闭上，保持
    const u = (f - closeF - holdF) / openF;
    return u >= 1 ? 0 : 1 - easeOut(u);
  }

  /**
   * 推进计时器。
   * @param active 是否允许**发起**新的眨眼。false 时**冻结倒计时**（不是清零）——
   *               移开指针后从原来的进度继续，不会「一移开就立刻眨」。
   *               已经在眨的那次不受影响，会正常播完。
   */
  function step(dt, active = true) {
    if (t >= 0) {
      t += dt;
      if (t >= dur) { t = -1; schedule(); }
    } else if (active) {
      wait -= dt;
      if (wait <= 0) t = 0;
    }
  }

  return { step, value, fire, schedule, dur };
}
