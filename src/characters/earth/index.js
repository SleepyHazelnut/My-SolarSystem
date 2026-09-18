/**
 * 地球角色（Earth）—— 独立于太阳的一套：自己的 SVG 场景 + 自己的动画。
 *
 * 素材来源：`星球素材/地球/` 的合成图。五官（两只眼 + 嘴）是从合成图里**抠出来**的，
 * 底图做了最近邻修补；三态眼里的「半闭 / 闭」是把眼睛纵向压缩生成的。
 *
 * 几何（全部实测）：
 *   球体素材是 2048×2048 的画布，球心 (960,1072)、半径 ≈664（逐行/逐列扫描得到）。
 *
 * 头顶小芽是**三份**素材（用户 2026-10-03 自己拆的，都是同一张 2048 画布导出）：
 *   sprout_stem = 茎，sprout_leaf_l = 左叶，sprout_leaf_r = 右叶。
 *   三份叠回去与原图 `星球素材/地球/小芽.png` 只差切缝上的抗锯齿像素（0.027%）。
 *   动画口径：**茎不动**（只吃静态倾角 `rot`），两片叶吃**同一份** transform ——
 *   绕**同一个圆心**、同一个角度摆动，所以两片叶中间永远不会裂出空隙。
 *
 * ⚠️ 五官图层是从合成图原样抠的（与 `earth_base` 逐像素对齐），所以它和 `earth_base` **共用同一套变换**
 *    （EARTH_T）—— 各写各的会在眨眼时错位。小芽、云、雨则相反：都是**单独摆上去的**，
 *    坐标一律是 viewBox 坐标（不是素材坐标）。
 */
import gsap from 'gsap';
import earth_base from '../../assets/earth/earth_base.png';
import eye_open from '../../assets/earth/eye_open.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import sprout_stem from '../../assets/earth/sprout_stem.png';
import sprout_leaf_l from '../../assets/earth/sprout_leaf_l.png';
import sprout_leaf_r from '../../assets/earth/sprout_leaf_r.png';
import cloud from '../../assets/earth/cloud.png';

const IMG = { earth_base, eye_open, eye_half, eye_closed, sprout_stem, sprout_leaf_l, sprout_leaf_r, cloud };

/* ---------- 素材几何（2048 画布，实测） ---------- */
const SRC = { cx: 960, cy: 1072, r: 664 };

/* ---------- viewBox 落点 ----------
   画面从上到下：云 → 雨 → 小芽 → 球体。所以上方要留出空间给云和雨。 */
const VIEW_W = 440;
const VIEW_H = 560;
const CX = 220;                  // 球心 x
const CY = 410;                  // 球心 y
const S = 260 / (SRC.r * 2);     // ≈0.1958 → 球体直径 260
const TOP_Y = CY - SRC.r * S;    // 球体顶点 y ≈ 280

const EARTH_T = `translate(${CX} ${CY}) scale(${S.toFixed(6)}) translate(${-SRC.cx} ${-SRC.cy})`;

/* 小芽：**三份**素材（同一 2048 画布导出，所以共用一套 translate/scale）
     sprout_stem = 茎 / sprout_leaf_l = 左叶 / sprout_leaf_r = 右叶
   ⚠️ 动画口径（用户定的）：**茎不动** —— 只吃静态倾角 `rot`，一次写完就不再改；
      两片叶吃**同一份** transform —— 绕**同一个圆心**、同一个角度摆，
      所以两片叶中间永远不会裂出空隙。
   ⚠️ 圆心是**素材坐标**，每帧的变换是 translate(-pivot) rotate(a pivot)；
      少了 translate(-pivot) 就会绕画布外的远处一点转、整支被甩飞。
   pivotX/Y：两片叶的**接触点**（用户口径「两个中间就是圆心」）。
     实测：左叶 bbox (431,710)-(1111,1268)、右叶 (1060,559)-(1583,1183)，
     把两片叶各膨胀 3~16px 求交叠，质心稳定在 (1080,1100)。
   rot：静态倾角（度）—— 三份都要吃，否则叶和茎在静态位就对不上。
   ⚠️ x/y 与 pivot 是**绑死**的：渲染结果是 (x,y) + k·R(rot)·(p − pivot)，
      单独改 pivot 会让整株平移。换圆心时按 (x,y) += k·R(rot)·(pivot′ − pivot) 补偿
      （调参页的「圆心移到茎顶」按钮就是干这个的）。
   layer：1 = 芽画在球体**之上**，0 = 沉到球体下面（由 DOM 顺序实现）。 */
const SPROUT = { k: 0.045, x: 274.833, y: 272.703, pivotX: 1080, pivotY: 1100, rot: 29.5, layer: 1 };

/* 云：素材 bbox 中心 ≈(1025.5,1040.5) */
const CLOUD = { k: 0.062, x: 284, y: 170, cx: 1025.5, cy: 1040.5 };

/* 雨：纯 SVG 小水滴（不需要额外素材）。
   ⚠️ 落点**相对云中心**算，不写死 viewBox 坐标 —— 云会横向漂移，雨要跟着一起挪。 */
const RAIN = {
  count: 5,
  halfW: 42,                     // 落点相对云中心的横向半宽
  yTop: 147, yBottom: 299,
  speed: 0.46,                   // 每秒走完的比例
};

/* 水滴形状：尖端朝上、底部圆（下落的雨滴）。原点在形状重心附近，
   所以每帧只要 translate(落点) scale(大小) 即可。 */
const DROP_D = 'M0 -3.6 C1.55 -1.5 2 -0.3 2 0.7 A2 2 0 0 1 -2 0.7 C-2 -0.3 -1.55 -1.5 0 -3.6 Z';

export const EARTH_SCENE = `
    <svg id="earthScene" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
         aria-label="会呼吸、会眨眼、可悬停、可点击的地球角色">

      <!-- 球体 + 三态五官。都吃 EARTH_T，所以完全对齐。
           三态顺序：闭 → 半闭 → 睁（后声明 = 更上层）
           小芽排在球体之后（= 之上），并且整个 #earthBreath 一起呼吸、#earthBob 一起浮动，
           所以芽和球是「绑在一起」的，不是各动各的。 -->
      <g id="earthBob">
        <g id="earthBreath">

          <!-- 云 + 雨：**和地球绑定**（2026-10-03）。
               放进 #earthBob ⊃ #earthBreath 里 —— 于是它们跟着地球一起浮动 / 左右摆 /
               呼吸 / 被点击压扁，不再是「地球动了云还留在原地」。
               位置仍由 index.js 每帧重写，但写的是**相对地球**的位置。
               ⚠️ 必须排在球体**之前**（= 画在球体下面）：雨的落点会压到球顶，
                  排在球体后面才不会被画在球面上。
               ⚠️ 雨还要排在云**之前**（= 画在云下面）：雨的起点 yTop 落在云体内部，
                  靠云的实心部分挡住水滴上半程，读起来才是「从云里落下来」，
                  而不是「云脸上粘了几颗点」。 -->
          <g id="earthSky">
            <g id="earthRain"></g>
            <image id="earthCloud" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048" />
          </g>

          <image id="earthBase" href="${IMG.earth_base}" x="0" y="0" width="2048" height="2048"
                 transform="${EARTH_T}" />
          <image id="earthEyeClosed" href="${IMG.eye_closed}" x="0" y="0" width="2048" height="2048"
                 opacity="0" transform="${EARTH_T}" />
          <image id="earthEyeHalf" href="${IMG.eye_half}" x="0" y="0" width="2048" height="2048"
                 opacity="0" transform="${EARTH_T}" />
          <image id="earthEyeOpen" href="${IMG.eye_open}" x="0" y="0" width="2048" height="2048"
                 opacity="1" transform="${EARTH_T}" />
          <!-- 小芽：排在球体**之后** = 画在球体之上（用户 2026-10-03 定的）。
               三份都是同一画布导出，直接叠就对位；茎与叶的 transform 由 index.js 写
               （茎写一次静态的，叶每帧写摆动的）。
               layer=0 时 index.js 会把这个组挪到球体之前。 -->
          <g id="earthSproutWrap" transform="translate(${SPROUT.x} ${SPROUT.y}) scale(${SPROUT.k})">
            <g id="earthSproutStem">
              <image href="${IMG.sprout_stem}" x="0" y="0" width="2048" height="2048" />
            </g>
            <g id="earthSproutLeafL">
              <image href="${IMG.sprout_leaf_l}" x="0" y="0" width="2048" height="2048" />
            </g>
            <g id="earthSproutLeafR">
              <image href="${IMG.sprout_leaf_r}" x="0" y="0" width="2048" height="2048" />
            </g>
          </g>
        </g>
      </g>

      <!-- 命中区：跟着球体大小走 -->
      <circle id="earthHit" cx="${CX}" cy="${CY}" r="132"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;

/* ============================================================
   参数
   ============================================================ */
export const EARTH = {
  /* 呼吸：不对称（吸快呼慢），悬停时周期变短 */
  breathDur: 3.2,
  breathS: 0.010,
  bobAmp: 3.4,
  hoverBreath: 0.72,

  /* 整体摆动（2026-10-03 加，对标太阳「被拖着走」的读法）：
     球体轻微左右倾 + 上下浮动，周期**刻意不成倍数**，避免几秒后锁相。 */
  swayRot: 1.35,        // ±1.35°
  swayDur: 4.6,

  /* 小芽：两片叶绕**同一圆心**整体摆，且跟着地球的摆动走（同周期、略滞后）——
     这样才读得出「芽是长在球上的」而不是各动各的。
     幅度比球体大（4.2 vs 1.35），呼应太阳那套「越靠外摆得越多」。 */
  sproutSway: 4.2,
  sproutLag: 0.35,      // 相位滞后（秒）：芽比球体晚一点跟上

  /* 云：上下 + 横向漂移（两个周期不成倍数），再加一层呼吸缩放（跟地球同周期） */
  cloudBob: 2.6, cloudDur: 5.1,
  cloudDrift: 3.0,
  cloudBreath: 0.05,

  /* 悬停 / 点击 */
  hoverLift: -9,
  pressSquash: 0.86,
  pressWiden: 1.09,

  /* 点击时两片叶的甩动：一次冲激 + 指数衰减（和太阳那边「装饰被震一下」同一读法）。
     叶子在 #earthBreath 里已经跟着地球一起吃压扁了，这一层是**额外**的甩动 ——
     地球压下去的同时叶子被震得抖两下，读起来才有「软的」感觉。 */
  whipAmp: 7.5,        // 冲激幅度（度）
  whipHz: 4.6,         // 振荡频率
  whipZeta: 0.16,      // 阻尼比
  whipDur: 1.1,        // 冲激总时长（秒）

  /* 眨眼 */
  blinkMin: 2.5, blinkMax: 6.0,
  blinkFirstMin: 1.4, blinkFirstMax: 3.2,
  blinkCloseF: 5, blinkHoldF: 1, blinkOpenF: 3,
};

const BLINK_DUR = (EARTH.blinkCloseF + EARTH.blinkHoldF + EARTH.blinkOpenF) / 60;

/** 把闭眼量 b(0~1) 拆成 睁/半闭/闭 三段不透明度（相邻两段权重和恒为 1） */
function eyeWeights(b) {
  return [
    Math.max(0, 1 - 2 * b),                 // open
    Math.max(0, 1 - Math.abs(2 * b - 1)),   // half
    Math.max(0, 2 * b - 1),                 // closed
  ];
}

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
  const sproutPivotT = `translate(${-SPROUT.pivotX} ${-SPROUT.pivotY}) `;
  sproutStemEl.setAttribute('transform',
    sproutPivotT + `rotate(${SPROUT.rot.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`);

  /* ---------- 雨滴：动态生成，每颗有自己的落点/大小/速度/相位 ---------- */
  const drops = [];
  for (let i = 0; i < RAIN.count; i++) {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', DROP_D);
    el.setAttribute('fill', '#7CC3E8');
    rainEl.appendChild(el);
    /* 每颗记的是**相对云中心**的横向偏移 + 自己的大小/速度/相位，
       这样云横向漂移时整片雨跟着挪，不会「云走了雨还留在原地」。 */
    drops.push({
      el,
      dx: -RAIN.halfW + Math.random() * RAIN.halfW * 2,
      phase: Math.random(),
      sc: 0.90 + Math.random() * 0.40,          // 大小不齐，免得像排队的点
      wob: 0.5 + Math.random() * 1.1,           // 横向微摆幅度
      speed: RAIN.speed * (0.82 + Math.random() * 0.36),
    });
  }

  const ac = new AbortController();

  /* ---------- 交互状态（权重向目标逼近，不用 snap） ---------- */
  let hoverW = 0, pressW = 0;
  let hovered = false, pressed = false;
  /* 叶子甩动的冲激时钟：<0 = 没在甩 */
  let whipT = -1;

  hitEl.addEventListener('pointerenter', () => { hovered = true; }, { signal: ac.signal });
  hitEl.addEventListener('pointerleave', () => { hovered = false; pressed = false; }, { signal: ac.signal });
  hitEl.addEventListener('pointerdown', () => { pressed = true; whipT = 0; }, { signal: ac.signal });
  window.addEventListener('pointerup', () => { pressed = false; }, { signal: ac.signal });

  /* ---------- 眨眼计时器（逐实例） ---------- */
  let blinkT = -1;
  let blinkWait = EARTH.blinkFirstMin + Math.random() * (EARTH.blinkFirstMax - EARTH.blinkFirstMin);
  const scheduleBlink = () => {
    const span = EARTH.blinkMin + Math.random() * (EARTH.blinkMax - EARTH.blinkMin);
    blinkWait = Math.max(span - BLINK_DUR, 0);
  };
  /** 闭眼量 0~1 */
  const blinkValue = () => {
    if (blinkT < 0) return 0;
    const f = blinkT * 60;
    const { blinkCloseF: cf, blinkHoldF: hf, blinkOpenF: of } = EARTH;
    if (f < cf) { const u = f / cf; return u * u * (3 - 2 * u); }      // smoothstep 闭合
    if (f < cf + hf) return 1;
    const u = (f - cf - hf) / of;
    if (u >= 1) return 0;
    const e = 1 - (1 - u) * (1 - u);                                    // ease-out 张开
    return 1 - e;
  };

  /* ---------- 主循环 ---------- */
  let t = 0;
  let fps = 0, frames = 0, fpsAt = performance.now();

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    t += dt;

    /* 权重逼近（与帧率无关） */
    const kk = 1 - Math.exp(-dt * 10);
    hoverW += ((hovered ? 1 : 0) - hoverW) * kk;
    pressW += ((pressed ? 1 : 0) - pressW) * kk;

    /* 呼吸：悬停时周期变短（读起来是「兴奋了一点」） */
    const dur = EARTH.breathDur * (1 - (1 - EARTH.hoverBreath) * hoverW);
    const ph = (t % dur) / dur;
    /* 不对称：吸快、呼慢（和太阳同一套读法） */
    const wave = ph < 0.42 ? Math.sin((ph / 0.42) * Math.PI / 2) : Math.cos(((ph - 0.42) / 0.58) * Math.PI / 2);
    const bs = EARTH.breathS * wave;

    /* 点击挤压：按下时压扁拉宽，松开回弹 */
    const sq = 1 - (1 - EARTH.pressSquash) * pressW;
    const wd = 1 + (EARTH.pressWiden - 1) * pressW;

    /* 整体摆动：和呼吸**不同周期**，故意不成倍数 */
    const sway = Math.sin((t / EARTH.swayDur) * Math.PI * 2) * EARTH.swayRot;

    const bobY = -EARTH.bobAmp * wave + EARTH.hoverLift * hoverW;
    bobEl.setAttribute('transform',
      `translate(0 ${bobY.toFixed(3)}) rotate(${sway.toFixed(3)} ${CX} ${CY})`);
    breathEl.setAttribute('transform',
      `translate(${CX} ${CY}) scale(${((1 + bs) * wd).toFixed(5)} ${((1 + bs * 1.35) * sq).toFixed(5)}) ` +
      `translate(${-CX} ${-CY})`);

    /* 点击甩动：一次冲激 + 指数衰减（叶子被震一下）。
       sin 起手（从 0 开始）—— 起手是 cos 的话第一帧就有位移，会「闪一下」。 */
    let whip = 0;
    if (whipT >= 0) {
      whipT += dt;
      const w = 2 * Math.PI * EARTH.whipHz;
      whip = EARTH.whipAmp * Math.exp(-EARTH.whipZeta * w * whipT) * Math.sin(w * whipT);
      if (whipT >= EARTH.whipDur) whipT = -1;
    }

    /* 小芽的叶：**茎不动**，只有两片叶摆。
       两份叶吃**同一份** transform —— 绕同一个圆心、同一个角度，所以中间永不裂。
       静态倾角 rot 和摆动叠加后再一起绕圆心（不是各转各的）。
       ⚠️ 圆心是**素材坐标**，外层 <g> 已经把坐标系搬到 viewBox 上了，
          所以必须先 translate(-pivot) 再 rotate，否则会绕画布外的一点转、整支被甩飞。
       ⚠️ 相位比球体滞后 sproutLag —— 和球体「一起触发、慢半拍跟上」。
       点击时再叠加 whip（叶子在 #earthBreath 里已经跟着地球一起吃压扁了，
       这一层是额外的甩动）。 */
    const leafA = SPROUT.rot +
      Math.sin(((t - EARTH.sproutLag) / EARTH.swayDur) * Math.PI * 2) * EARTH.sproutSway + whip;
    const leafT = sproutPivotT + `rotate(${leafA.toFixed(3)} ${SPROUT.pivotX} ${SPROUT.pivotY})`;
    sproutLeafLEl.setAttribute('transform', leafT);
    sproutLeafREl.setAttribute('transform', leafT);

    /* 云：上下 + 横向漂移（都是**相对地球**的运动）。
       「和地球绑定」由 DOM 层级保证 —— 云在 #earthBob ⊃ #earthBreath 里，
       所以浮动 / 左右摆 / 呼吸 / 点击压扁都会带着它一起走，这里不用再手算一份。 */
    const cloudY = Math.sin((t / EARTH.cloudDur) * Math.PI * 2) * EARTH.cloudBob;
    const cloudX = Math.sin((t / (EARTH.cloudDur * 1.37)) * Math.PI * 2) * EARTH.cloudDrift;
    const cloudX0 = CLOUD.x + cloudX;      // 云的当前横向中心（雨滴跟着它走）
    /* 云也有呼吸：跟地球同周期（用同一个 wave），幅度小一点免得抢戏 */
    const cloudS = CLOUD.k * (1 + EARTH.cloudBreath * wave);
    cloudEl.setAttribute('transform',
      `translate(${(CLOUD.x + cloudX).toFixed(3)} ${(CLOUD.y + cloudY).toFixed(3)}) ` +
      `scale(${cloudS.toFixed(6)}) translate(${-CLOUD.cx} ${-CLOUD.cy})`);

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出。
       下落时纵向拉长、横向略收 —— 读作「越落越快」，比匀速的点有生气。 */
    for (const d of drops) {
      const p = (t * d.speed + d.phase) % 1;
      const cx = cloudX0 + d.dx + Math.sin((t * 1.6 + d.phase * 6.28) * Math.PI * 2) * d.wob;
      const cy = RAIN.yTop + p * (RAIN.yBottom - RAIN.yTop);
      const sx = d.sc * (1 - 0.12 * p);
      const sy = d.sc * (1 + 0.30 * p);
      d.el.setAttribute('transform',
        `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
      const a = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
      d.el.setAttribute('opacity', (a * 0.85).toFixed(3));
    }

    /* 眨眼 */
    if (blinkT >= 0) {
      blinkT += dt;
      if (blinkT >= BLINK_DUR) { blinkT = -1; scheduleBlink(); }
    } else {
      /* 地球和太阳不同：**悬停时也照常眨眼**（太阳那边是钉住不眨）。
         它没有「被注意到就屏住」的叙事，一直眨反而更活。 */
      blinkWait -= dt;
      if (blinkWait <= 0) blinkT = 0;
    }
    const [oA, hA, cA] = eyeWeights(blinkValue());
    eyeEls[0].setAttribute('opacity', oA.toFixed(4));
    eyeEls[1].setAttribute('opacity', hA.toFixed(4));
    eyeEls[2].setAttribute('opacity', cA.toFixed(4));

    /* fps */
    frames++;
    const nowMs = time * 1000;
    if (nowMs - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (nowMs - fpsAt));
      frames = 0; fpsAt = nowMs;
      debug?.({ ready: true, fps, hover: hoverW, press: pressW, blink: blinkValue() });
    }
  }
  gsap.ticker.add(tick);

  return {
    ready: true,
    get fps() { return fps; },
    get blink() { return blinkValue(); },
    /** 调试：立刻眨一次 */
    blinkNow() { if (blinkT < 0) blinkT = 0; },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
