/**
 * 月球角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，1 张原图：本体）
 *   anim.js   动作参数与几何（姿态由 `core/pose.js` 给出）
 *   本文件    挂载入口：命中区选择器 + 把姿态写进 DOM 的 `setupPose`
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`。
 *
 * 月球不眨眼，`setupPose` 不传 `eyes`。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, createMoonAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';
import { setupPose } from '../../core/apply.js';

export const mount = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createMoonAnim,
  hit: '#moonHit',
  setup: setupPose({ name: 'moon', bodyC: BODY_C }),
});

export { BALL_D, BODY_C, ORIGIN, VIEW } from './anim.js';
