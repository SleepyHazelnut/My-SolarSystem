/**
 * 地球角色：DOM 与时钟。
 *
 * 用法：
 *   const earth = mountEarth(document.getElementById('earth'), { debug: fn });
 *   earth.destroy();   // 拆 ticker / 监听，并把注入的 SVG 清掉
 *
 * 职责划分（和太阳同一套）：
 *   scene.js  图层结构（静态，8 张原图）
 *   anim.js   几何落点 + 动画参数 + 每帧的数值计算（纯逻辑，不碰 DOM）
 *   本文件     把数值写回 DOM 属性、绑定输入、跑逐帧时钟
 *
 * ⚠️ 地球和太阳不同的一点：它**没有状态机** —— 呼吸 / 摆动 / 眨眼 / 云雨都是程序化正弦，
 *    不是关键帧表。所以这一层不做混合，只做「取数 → 写属性」。
 */
import gsap from 'gsap';
import { EARTH_SCENE } from './scene.js';
import { CX, CY, CLOUD, SPROUT, SPROUT_PIVOT_T, DROP_D, createEarthAnim } from './anim.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 挂载地球。
 * @param root  容器元素
 * @param opts  { debug }
 */
export function mountEarth(root, opts = {}) {
  const { debug } = opts;
  root.innerHTML = EARTH_SCENE;

  const $ = (s) => root.querySelector(s);
  const bobEl = $('#earthBob');
  const breathEl = $('#earthBreath');
  const sproutWrapEl = $('#earthSproutWrap');
  const sproutStemEl = $('#earthSproutStem');
  const sproutLeafLEl = $('#earthSproutLeafL');
  const sproutLeafREl = $('#earthSproutLeafR');
  const cloudEl = $('#earthCloud');
  const rainEl = $('#earthRain');
  const hitEl = $('#earthHit');
  const eyeEls = [$('#earthEyeOpen'), $('#earthEyeHalf'), $('#earthEyeClosed')];

  /* ---------- 图层：模板里芽排在球体**之后**（= 画在球体之上）。
     SPROUT.layer = 0 时把它挪到 #earthBreath 的最前面 —— 即沉到球体下面。
     ⚠️ 用 DOM 顺序调 z，不是 z-index（SVG 里 z-index 不生效）。 ---------- */
  if (!SPROUT.layer) {
    breathEl.insertBefore(sproutWrapEl, breathEl.firstChild);
  }

  /* ---------- 茎：**不动** ----------
     只吃静态倾角 rot，写一次就再也不碰（所以它不在主循环里）。
     ⚠️ rot 三份都要吃 —— 只给叶子的话，叶子和茎在静态位就对不上。 */
  sproutStemEl.setAttribute('transform',
    SPROUT_PIVOT_T + `rotate(${SPROUT.rot.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`);

  /* ---------- 动画实例（纯计算）：随机落点、悬停/按压权重、眨眼计时器都在里面 ---------- */
  const anim = createEarthAnim();

  /* ---------- 雨滴元素：形状是死的，落点每帧由 anim 给 ---------- */
  const dropEls = anim.drops.map(() => {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', DROP_D);
    el.setAttribute('fill', '#7CC3E8');
    rainEl.appendChild(el);
    return el;
  });

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();

  /* ---------- 输入：enter/exit → hover，down/up → pressed ----------
     up 挂 window：在地球上按下、移出去再松手也要清掉 pressed。
     按下时顺手把叶子的冲激时钟归零（triggerWhip）。 ---------- */
  let hovered = false, pressed = false;

  hitEl.addEventListener('pointerenter', () => { hovered = true; }, { signal: ac.signal });
  hitEl.addEventListener('pointerleave', () => { hovered = false; pressed = false; }, { signal: ac.signal });
  hitEl.addEventListener('pointerdown', () => { pressed = true; anim.triggerWhip(); }, { signal: ac.signal });
  window.addEventListener('pointerup', () => { pressed = false; }, { signal: ac.signal });

  /* ---------- 主循环 ---------- */
  let fps = 0, frames = 0, fpsAt = performance.now();

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const v = anim.step(dt, { hovered, pressed });

    /* 浮动 + 左右摆：绕**球心**转，所以读起来是「站着的球在晃」而不是「原地自转」 */
    bobEl.setAttribute('transform',
      `translate(0 ${v.bobY.toFixed(3)}) rotate(${v.sway.toFixed(3)} ${CX} ${CY})`);
    /* 呼吸 / 挤压：绕球心缩放（先 translate 到球心、缩完再挪回来）。
       y 方向比 x 多 35%，所以是「上下拉长」的呼吸，不是等比膨胀 */
    breathEl.setAttribute('transform',
      `translate(${CX} ${CY}) scale(${v.breathSX.toFixed(5)} ${v.breathSY.toFixed(5)}) ` +
      `translate(${-CX} ${-CY})`);

    /* 小芽的叶：**茎不动**，只有两片叶摆。
       两份叶吃**同一份** transform —— 绕同一个圆心、同一个角度，所以中间永不裂。
       ⚠️ 圆心是**素材坐标**，外层 <g> 已经把坐标系搬到 viewBox 上了，
          所以必须先 translate(-pivot) 再 rotate，否则会绕画布外的一点转、整支被甩飞。 */
    const leafT = SPROUT_PIVOT_T + `rotate(${v.leafA.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`;
    sproutLeafLEl.setAttribute('transform', leafT);
    sproutLeafREl.setAttribute('transform', leafT);

    /* 云：上下 + 横向漂移（都是**相对地球**的运动）。
       「和地球绑定」由 DOM 层级保证 —— 云在 #earthBob ⊃ #earthBreath 里，
       所以浮动 / 左右摆 / 呼吸 / 点击压扁都会带着它一起走，这里不用再手算一份。 */
    cloudEl.setAttribute('transform',
      `translate(${v.cloudX.toFixed(3)} ${v.cloudY.toFixed(3)}) ` +
      `scale(${v.cloudS.toFixed(6)}) translate(${-CLOUD.cx} ${-CLOUD.cy})`);

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出。
       下落时纵向拉长、横向略收 —— 读作「越落越快」，比匀速的点有生气。 */
    for (let i = 0; i < dropEls.length; i++) {
      const o = v.drops[i];
      dropEls[i].setAttribute('transform',
        `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) scale(${o.sx.toFixed(3)} ${o.sy.toFixed(3)})`);
      dropEls[i].setAttribute('opacity', o.op.toFixed(3));
    }

    /* 眨眼：三态眼按权重切 opacity（相邻两段权重和恒为 1，所以不会闪） */
    eyeEls[0].setAttribute('opacity', v.eyes[0].toFixed(4));
    eyeEls[1].setAttribute('opacity', v.eyes[1].toFixed(4));
    eyeEls[2].setAttribute('opacity', v.eyes[2].toFixed(4));

    /* fps：每 500 ms 统计一次，顺手喂给 ?debug=1 的面板 */
    frames++;
    const nowMs = time * 1000;
    if (nowMs - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (nowMs - fpsAt));
      frames = 0; fpsAt = nowMs;
      debug?.({ ready: true, fps, hover: anim.hoverW, press: anim.pressW, blink: v.blink });
    }
  }
  gsap.ticker.add(tick);

  return {
    ready: true,
    get fps() { return fps; },
    get blink() { return anim.blinkValue(); },
    /** 调试：立刻眨一次 */
    blinkNow() { anim.blinkNow(); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
