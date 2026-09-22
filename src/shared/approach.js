/**
 * 指数逼近（与帧率无关）：`cur += (target − cur) · (1 − e^(−rate·dt))`，`rate` 越大越跟手。
 * 系数算法只写这一份，避免调用方各自漂移。
 */
export function approach(cur, target, rate, dt) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}
