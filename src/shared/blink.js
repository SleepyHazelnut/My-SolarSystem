/**
 * 眨眼层：逐实例的随机计时器 + 三态闭眼量。各角色结构相同，差异全在 options。
 *
 * 相位按**帧**对齐（`closeF` / `holdF` / `openF` 是帧数，不是比例）。
 * 间隔口径是「两次眨眼的**起点到起点**」，内部再减 `dur`。
 * `rand` 是注入的随机源；`double = 0` 时**不消耗随机数**。
 */
import { cubicBezier } from './easing.js';

/** 默认口径：相位 5 闭 + 1 保持 + 3 睁 = 9 帧，间隔与连眨概率见下。 */
export const BLINK_DEFAULT = {
  min: 2.5, max: 6.0,              /* 两次眨眼起点到起点的间隔（秒） */
  firstMin: 1.5, firstMax: 3.5,    /* 首次眨眼的延迟 */
  double: 0.15,                    /* 连眨概率 */
  doubleMin: 0.20, doubleMax: 0.28,
  closeF: 5, holdF: 1, openF: 3,
};

/* 眨眼的闭合 / 张开曲线。 */
const EASE_IN = cubicBezier(0.40, 0.00, 1.00, 1.00);
const EASE_OUT = cubicBezier(0.00, 0.00, 0.20, 1.00);

export function createBlinkLayer(options = {}) {
  const {
    closeF, holdF, openF,
    min, max,
    firstMin, firstMax,
    double = 0, doubleMin = 0, doubleMax = 0,
    easeIn = EASE_IN,
    easeOut = EASE_OUT,
    rand = Math.random,
  } = { ...BLINK_DEFAULT, ...options };
  const dur = (closeF + holdF + openF) / 60;
  let t = -1;        // 当前这次眨眼已经进行了多少秒；-1 = 没在眨
  let wait = firstMin + rand() * (firstMax - firstMin);

  /**
   * 立刻眨一次（转场用）。
   * 已经在眨的那次不受影响 —— 直接把 t 置 0 会把它截断成半次。
   */
  function fire() { if (t < 0) t = 0; }

  /**
   * 排下一次眨眼：把「起点到起点」的间隔换算成「本次结束后的停顿」。
   * 连眨概率在**每次眨眼结束时**判定（见 `step`），不是调度时 —— 这样第二下还能再触发第三下。
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
    if (f < closeF + holdF) return 1;                 // 完全闭合，保持
    const u = (f - closeF - holdF) / openF;
    return u >= 1 ? 0 : 1 - easeOut(u);
  }

  /**
   * 推进计时器。
   * @param active 是否允许**发起**新的眨眼。false 时**冻结倒计时**（不是清零），
   *               移开指针后从原进度继续；已在播的那次不受影响。
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

  return { step, value, fire };
}

/**
 * 把闭眼量 b(0~1) 拆成「睁 / 半闭 / 闭」三段不透明度。
 *
 * 相邻两段权重**和恒为 1** —— 三张眼图叠着画时总遮盖不变，交叉淡入不会闪。
 * 放这里：眼图与闭眼深度是各角色共用的口径，必须一致。
 */
export function eyeWeights(b) {
  return [
    Math.max(0, 1 - 2 * b),                 // open
    Math.max(0, 1 - Math.abs(2 * b - 1)),   // half
    Math.max(0, 2 * b - 1),                 // closed
  ];
}
