/**
 * 指数逼近（与帧率无关）：把 `cur` 朝 `target` 推，`rate` 越大越跟手。
 *
 * 等价于 `cur += (target - cur) * (1 - exp(-rate · dt))` ——
 * 抽出来是为了「系数怎么算」只写一遍，两边不会各自漂移。
 *
 * 太阳用它做视线平滑（`rate = SMOOTH = 14`），地球用它做悬停 / 按压权重（`rate = 10`）。
 */
export function approach(cur, target, rate, dt) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}
