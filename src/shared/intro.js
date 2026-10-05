/**
 * 入场：页面加载时的一次性镜头级效果。形状按角色给（`characters/<名>/anim.js` 的 `INTRO`），
 * 这里只提供进度器。
 *
 * 缩放的作用点由角色在 `apply` 里决定：局部原点即角色中心的组可直接写 `scale(k)`，
 * 否则要自己补 `translate(C) … translate(-C)` 把支点搬回中心。
 *
 * 曲线用 `easing.js` 的 `easeOutBack`。
 */
import { easeOutBack } from './easing.js';

/** 入场形状的兜底值；角色在 `anim.js` 里给自己的 `INTRO` 覆盖，`main.js` 的错开只补 `delay`。 */
export const INTRO_DEFAULT = {
  dur: 0.62,         // 秒
  fromScale: 0.62,   // 起始缩放（相对静止姿态）
  dy: 34,            // 起始下移（viewBox 局部单位）
  delay: 0,          // 延迟秒数
};

/**
 * 入场进度器：每帧给一次 `dt`，拿回要写进 DOM 的三个量。
 *
 * @param params   入场形状，只写要覆盖的那几项，其余由 `INTRO_DEFAULT` 补
 * @param enabled  false = 直接是终态（`prefers-reduced-motion` / 逐帧截图脚本）；
 *                 `matchMedia` 由调用方判断后传进来
 */
export function createIntro({ params = {}, enabled = true } = {}) {
  const { dur, fromScale, dy, delay } = { ...INTRO_DEFAULT, ...params };
  let t = enabled ? -delay : dur;

  /** 当前该写进 DOM 的三个量。
   *  `opacity === null` = 把 inline opacity **清掉**（`sceneEl.style.opacity` 退回空串）。 */
  function current() {
    const ie = easeOutBack(t / dur);
    return {
      k: fromScale + (1 - fromScale) * ie,
      dy: (1 - ie) * dy,
      opacity: ie < 1 ? ie.toFixed(3) : null,
    };
  }

  return {
    /** 推进 `dt` 秒（走完 `dur` 之后不再累加，`current()` 恒为终态） */
    step(dt) { if (t < dur) t += dt; },
    current,
    /** 还在播？false = 已是终态 */
    get playing() { return t < dur; },
  };
}
