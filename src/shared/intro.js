/**
 * 入场：页面加载时的一次性**镜头级**效果（三个角色同一条曲线、同一组参数）。
 *
 * 它不是角色状态，所以不进 `anim.js` —— 入场叠在角色状态外面，结束后完全不参与。
 * 三个角色只在**作用点**上不同：太阳写在 `#sun`（局部原点就是太阳中心，`scale` 天然原地）；
 * 地球 / 月球写在 `#earthBob` / `#moonBob`，得自己补一对 `translate(C) … translate(-C)`
 * 把缩放支点搬回球心，否则整颗绕画布左上角放大、被甩出去。
 *
 * 曲线用 `easing.js` 的 `easeOutBack`（末段冲过 1 再落回）。
 */
import { easeOutBack } from './easing.js';

/** 入场的形状（三个角色同一组）—— 就地改这里即可整体调参。
 *  ⚠️ `_draft/_intro-shots.mjs` 靠把 `dur` 拉长再重挂来逐帧取图（0.62 s 太短，截图抓不住）。 */
export const INTRO = {
  dur: 0.62,         // 秒
  fromScale: 0.62,   // 起始缩放（相对静止姿态）
  dy: 34,            // 起始下移（viewBox / Sun 局部单位）
};

/**
 * 入场进度器：每帧给一次 `dt`，拿回要写进 DOM 的三个量。
 *
 * @param delay   错开多少秒（地球比太阳晚 0.15 s，并排读作级联）。用**负的起始进度**实现：
 *                延迟期间 `t < 0` → `easeOutBack` 返回 0 → 停在起始姿态。
 * @param enabled false = 直接是终态（`prefers-reduced-motion` / 逐帧截图脚本）。
 *                `matchMedia` 是 DOM 的事，由调用方判断后传进来。
 */
export function createIntro({ delay = 0, enabled = true } = {}) {
  let t = enabled ? -delay : INTRO.dur;

  /** 当前该写进 DOM 的三个量。
   *  `opacity === null` = 把 inline opacity **清掉** —— 入场结束后画面要逐位回到
   *  没有入场时的样子（`sceneEl.style.opacity` 退回空串，与入场前逐字节相同）。 */
  function current() {
    const ie = easeOutBack(t / INTRO.dur);
    return {
      k: INTRO.fromScale + (1 - INTRO.fromScale) * ie,
      dy: (1 - ie) * INTRO.dy,
      opacity: ie < 1 ? ie.toFixed(3) : null,
    };
  }

  return {
    /** 推进 `dt` 秒（走完 `dur` 之后不再累加，`current()` 恒为终态） */
    step(dt) { if (t < INTRO.dur) t += dt; },
    current,
    /** 还在播？false = 已是终态，画面与「没有入场」逐位相同 */
    get playing() { return t < INTRO.dur; },
  };
}
