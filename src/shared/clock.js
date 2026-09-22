/**
 * 逐帧时钟工具。
 */

/**
 * ticker 给的 `deltaMs` → 秒，并钳到 `max` 秒。
 * 钳制是必要的：切走标签页再回来，delta 会是好几秒，不钳会「跳一大步」。
 */
export function clampDt(deltaMs, max = 0.1) {
  return Math.min(deltaMs / 1000, max);
}
