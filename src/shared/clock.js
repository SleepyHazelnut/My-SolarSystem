/**
 * 逐帧时钟的两个小工具。
 *
 * ⚠️ `performance.now()` 只在 `createFpsCounter()` 创建时取一次（当统计窗口起点），
 *    和原来两个角色各写一遍时的取法一致。
 */

/**
 * ticker 给的 `deltaMs` → 秒，并钳到 `max` 秒。
 * 钳制是必要的：切走标签页再回来，delta 会是好几秒，不钳会「跳一大步」。
 */
export function clampDt(deltaMs, max = 0.1) {
  return Math.min(deltaMs / 1000, max);
}

/**
 * 每 `intervalMs` 统计一次 fps。
 * `tick(time)` 返回 `true` 表示这一帧刚好够一个窗口 —— 调用方据此回报 debug 面板。
 * `time` 是 `gsap.ticker` 给的毫秒值（不是 `performance.now()`）。
 */
export function createFpsCounter(intervalMs = 500) {
  let frames = 0, at = performance.now(), fps = 0;
  return {
    get fps() { return fps; },
    tick(time) {
      frames++;
      const nowMs = time * 1000;
      if (nowMs - at < intervalMs) return false;
      fps = Math.round(frames * 1000 / (nowMs - at));
      frames = 0; at = nowMs;
      return true;
    },
  };
}
