/**
 * 土星角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态：光环后层 / 本体 / 光环前层）
 *   anim.js   动作参数与几何（姿态由 `core/pose.js` 给出）
 *   本文件    挂载入口：命中区选择器 + 把姿态写进 DOM 的 `setupPose`
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`。
 *
 * 土星不眨眼，所以 `setupPose` 不传 `eyes`；三层光环都挂在 `#saturnBodyWrap` 内一起缩。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, createSaturnAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';
import { setupPose } from '../../core/apply.js';

export const mount = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createSaturnAnim,
  hit: '#saturnHit',
  setup: setupPose({ name: 'saturn', bodyC: BODY_C }),
});

export { BALL_D, BODY_C, ORIGIN, VIEW } from './anim.js';
