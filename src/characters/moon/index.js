/**
 * 月球角色：把动画写进 DOM。
 *
 *   scene.js  图层结构（静态，1 张原图：本体）
 *   anim.js   动作参数 + 纯逻辑（由 `core/motions.js` 的原语叠出）
 *   本文件    月球专属部分：哪个组写什么 transform、入场支点在哪
 *
 * 注入 SVG / 入场进度 / 指针输入 / 逐帧时钟 / 首帧 / destroy 都在 `core/character.js`，
 * 这里只提供 `setup()`。入场形状（`INTRO`）在 `anim.js`。
 *
 * 与太阳 / 地球逐行同构，只少一层三态眼（月球不眨眼）。
 */
import { SVG_SCENE } from './scene.js';
import { BODY_C, INTRO, createMoonAnim } from './anim.js';
import { defineCharacter } from '../../core/character.js';

export const mountMoon = defineCharacter({
  scene: SVG_SCENE,
  createAnim: createMoonAnim,
  intro: INTRO,
  /* 命中区 id 带角色前缀 —— 三个角色的 SVG 在同一页里，id 不能重名。 */
  hit: '#moonHit',

  setup(root) {
    const moonEl = root.querySelector('#moon');
    const sceneEl = root.querySelector('#moonScene');
    const bodyWrapEl = root.querySelector('#moonBodyWrap');

    return {
      apply(v, iv) {
        /* `iv.opacity === null` → 清掉 inline opacity */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        /* 入场缩放与下移叠在 #moon 上（原点 = 画布中心，原地放大）。 */
        moonEl.setAttribute('transform',
          `scale(${iv.k.toFixed(6)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体：呼吸（绕球心缩放）+ 悬停上浮 + 按压下沉。 */
        bodyWrapEl.setAttribute('transform',
          `translate(0 ${v.bodyDY.toFixed(4)}) ` +
          `translate(${BODY_C.x.toFixed(3)} ${BODY_C.y.toFixed(3)}) ` +
          `scale(${v.bodySX.toFixed(6)} ${v.bodySY.toFixed(6)}) ` +
          `translate(${(-BODY_C.x).toFixed(3)} ${(-BODY_C.y).toFixed(3)})`);
      },
    };
  },
});

/* 点击反馈由 `anim.js` 的 `setDown()` 驱动，本文件不额外接线 —— 挂载器把
   pointerdown / pointerup 转发过去，姿态仍走 `bodySX` / `bodySY` / `bodyDY`。 */
