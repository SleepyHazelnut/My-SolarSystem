/**
 * 入场：页面加载时的一次性**镜头级**效果（两个角色同一条曲线、同一组参数）。
 *
 * 它不是角色状态 —— 所以不进 `anim.js`（那里每帧输出角色状态，入场叠在它外面、
 * 结束后完全不参与）。两个角色只在**作用点**上不同：
 *   · 太阳写在 `#sun` —— 父组已 `translate(SUN.x SUN.y)`，局部原点就是太阳中心，
 *     所以 `scale` 天然是原地放大；
 *   · 地球写在 `#earthBob` —— 它直接坐在 viewBox 原点上，得自己补一对
 *     `translate(CX CY) … translate(-CX -CY)` 把缩放支点搬回球心，
 *     否则整颗球绕画布左上角放大、被甩出去。
 *
 * 曲线用 `easing.js` 的 `easeOutBack`（末段冲过 1 再落回，读作「弹一下站住」）。
 */
import { easeOutBack } from './easing.js';

/** 入场的形状（两个角色同一组）。
 *  ⚠️ 就地改这里即可整体调参 —— `_draft/_intro-shots.mjs` 就是靠把 `dur` 拉长到 1.6 s
 *  再重挂来逐帧取图的（入场只有 0.62 s，`captureScreenshot` 一次 ~170 ms，抓不住）。 */
export const INTRO = {
  dur: 0.62,         // 秒
  fromScale: 0.62,   // 起始缩放（相对静止姿态）
  dy: 34,            // 起始下移（viewBox / Sun 局部单位）
};

/**
 * 入场进度器：每帧给一次 `dt`，拿回要写进 DOM 的三个量。
 *
 * @param delay   错开多少秒（地球比太阳晚 0.15 s 起跑，并排读作级联而不是同时「啪」一下）。
 *                用**负的起始进度**实现：延迟期间 `t < 0` → `easeOutBack` 返回 0
 *                → 停在起始姿态，到点才开始弹。
 * @param enabled false = 直接是终态（`prefers-reduced-motion: reduce` / 逐帧截图脚本）。
 *                `matchMedia` 是 DOM 的事，所以由调用方判断后传进来。
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
