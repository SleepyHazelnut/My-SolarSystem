/**
 * 地球角色的**纯逻辑**：几何落点 + 动画参数 + 每帧的数值计算。
 *
 * 这一层**只依赖 `src/shared/` 里的纯原语**（缓动 / 眨眼 / 冲激 / 逼近），
 * 不引素材、不碰 DOM、不用 gsap —— 所以它照旧能在 Node 里直接 `import` 做纯逻辑断言，
 * 也能给多个实例共用。
 *
 * ⚠️ 与太阳的一处分工差异：太阳的 `scene.js` 把几何数字**抄成字面量**（皇冠 `scale`、4 颗星光坐标），
 *    同一件事写在两个文件里，得靠 `_draft/_verify-handoff.mjs` 复核有没有漂移。
 *    地球反过来 —— **数字只在本文件出现一次**，`scene.js` 从这里 import 去搭模板，
 *    所以不存在「改了一处忘了另一处」这类隐患。
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
 * ⚠️ 五官图层是从合成图原样抠的（与 `earth_base` 逐像素对齐），所以它和 `earth_base`
 *    **共用同一套变换**（`EARTH_T`）—— 各写各的会在眨眼时错位。小芽、云、雨则相反：
 *    都是**单独摆上去的**，坐标一律是 viewBox 坐标（不是素材坐标）。
 */
import { smoothstep, easeOutQuad } from '../../shared/easing.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { approach } from '../../shared/approach.js';
import { createBlinkLayer } from '../../shared/blink.js';

/* ---------- 素材几何（2048 画布，实测） ---------- */
export const SRC = { cx: 960, cy: 1072, r: 664 };

/* ---------- viewBox 落点 ----------
   画面从上到下：云 → 雨 → 小芽 → 球体。所以上方要留出空间给云和雨。 */
export const VIEW_W = 440;
export const VIEW_H = 560;
export const CX = 220;                  // 球心 x
export const CY = 410;                  // 球心 y
export const S = 260 / (SRC.r * 2);     // ≈0.1958 → 球体直径 260
export const TOP_Y = CY - SRC.r * S;    // 球体顶点 y ≈ 280（定位参照，模板里不用）

export const EARTH_T = `translate(${CX} ${CY}) scale(${S.toFixed(6)}) translate(${-SRC.cx} ${-SRC.cy})`;

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
export const SPROUT = { k: 0.045, x: 274.833, y: 272.703, pivotX: 1080, pivotY: 1100, rot: 29.5, layer: 1 };

/* 茎与两片叶的变换前缀 —— 圆心在**素材坐标**，所以要先 translate(-pivot)。
   茎只用它一次（静态），两片叶每帧都用。 */
export const SPROUT_PIVOT_T = `translate(${-SPROUT.pivotX} ${-SPROUT.pivotY}) `;

/* 云：素材 bbox 中心 ≈(1025.5,1040.5) */
export const CLOUD = { k: 0.062, x: 284, y: 170, cx: 1025.5, cy: 1040.5 };

/* 雨：纯 SVG 小水滴（不需要额外素材）。
   ⚠️ 落点**相对云中心**算，不写死 viewBox 坐标 —— 云会横向漂移，雨要跟着一起挪。 */
export const RAIN = {
  count: 5,
  halfW: 42,                     // 落点相对云中心的横向半宽
  yTop: 147, yBottom: 299,
  speed: 0.46,                   // 每秒走完的比例
};

/* 水滴形状：尖端朝上、底部圆（下落的雨滴）。原点在形状重心附近，
   所以每帧只要 translate(落点) scale(大小) 即可。 */
export const DROP_D = 'M0 -3.6 C1.55 -1.5 2 -0.3 2 0.7 A2 2 0 0 1 -2 0.7 C-2 -0.3 -1.55 -1.5 0 -3.6 Z';

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

/** 一次眨眼的总时长（秒）：闭 5 帧 + 保持 1 帧 + 睁 3 帧。
    ⚠️ 和 `shared/blink.js` 内部算的 `dur` 是同一个式子，改帧数时两处自动一致。 */
export const BLINK_DUR = (EARTH.blinkCloseF + EARTH.blinkHoldF + EARTH.blinkOpenF) / 60;

/** 把闭眼量 b(0~1) 拆成 睁/半闭/闭 三段不透明度（相邻两段权重和恒为 1） */
export function eyeWeights(b) {
  return [
    Math.max(0, 1 - 2 * b),                 // open
    Math.max(0, 1 - Math.abs(2 * b - 1)),   // half
    Math.max(0, 2 * b - 1),                 // closed
  ];
}

/**
 * 建一个地球的动画实例（**纯计算，不碰 DOM**）。
 *
 * 有状态的部分全在这里：悬停 / 按压权重、叶子的冲激时钟、眨眼计时器、
 * 以及每颗雨滴随机的落点 / 大小 / 速度 / 相位。所以同一份参数能跑多个实例，互不干扰。
 *
 * ⚠️ 地球**没有状态机** —— 呼吸 / 摆动 / 眨眼 / 云雨都是程序化正弦，不是关键帧表，
 *    所以这里不搬太阳那套「状态互斥 + 混合器」，只按时间推进。
 *
 * @param rand 随机源（默认 Math.random）。测试时塞一个确定性 PRNG 就能复现同一帧。
 */
export function createEarthAnim({ rand = Math.random } = {}) {
  /* ---------- 雨滴：每颗有自己的落点 / 大小 / 速度 / 相位 ----------
     记的是**相对云中心**的横向偏移，这样云横向漂移时整片雨跟着挪，
     不会「云走了雨还留在原地」。 */
  const drops = [];
  for (let i = 0; i < RAIN.count; i++) {
    drops.push({
      dx: -RAIN.halfW + rand() * RAIN.halfW * 2,
      phase: rand(),
      sc: 0.90 + rand() * 0.40,          // 大小不齐，免得像排队的点
      wob: 0.5 + rand() * 1.1,           // 横向微摆幅度
      speed: RAIN.speed * (0.82 + rand() * 0.36),
    });
  }
  /* 每帧复用的输出槽（不每帧新建对象 —— 这个循环跑在 rAF 里） */
  const frame = drops.map(() => ({ x: 0, y: 0, sx: 0, sy: 0, op: 0 }));

  /* ---------- 交互状态（权重向目标逼近，不用 snap） ---------- */
  let hoverW = 0, pressW = 0;
  /* 叶子甩动的冲激时钟：<0 = 没在甩 */
  let whipT = -1;

  /* ---------- 眨眼计时器（逐实例） ----------
     时序走 `src/shared/blink.js`；曲线用地球自己的两条 ——
     smoothstep 闭合 / 二次 ease-out 张开，和太阳那两条贝塞尔不是一个形状，所以显式传进去。
     ⚠️ 地球**悬停时也照常眨**（太阳那边是钉住不眨），所以 step 的 active 恒为 true。 */
  const blink = createBlinkLayer({
    closeF: EARTH.blinkCloseF, holdF: EARTH.blinkHoldF, openF: EARTH.blinkOpenF,
    min: EARTH.blinkMin, max: EARTH.blinkMax,
    firstMin: EARTH.blinkFirstMin, firstMax: EARTH.blinkFirstMax,
    easeIn: smoothstep, easeOut: easeOutQuad,
    rand,
  });

  let t = 0;

  /**
   * 推进一帧，返回这一帧要写进 DOM 的**全部数值**（本函数不碰 DOM）。
   * ⚠️ `drops` 是复用的数组，调用方要立刻写进属性、不要跨帧存着。
   */
  function step(dt, { hovered = false, pressed = false } = {}) {
    t += dt;

    /* 权重逼近（与帧率无关） */
    hoverW = approach(hoverW, hovered ? 1 : 0, 10, dt);
    pressW = approach(pressW, pressed ? 1 : 0, 10, dt);

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

    /* 点击甩动：一次冲激 + 指数衰减（叶子被震一下）。
       ⚠️ 地球这里用**同一个 ω 既做衰减又做振荡**（调参时就是这么定的），
          和太阳那边的阻尼振子不是一套语义 —— 见 `shared/impulse.js` 的说明。
       sin 起手（从 0 开始）—— 起手是 cos 的话第一帧就有位移，会「闪一下」。 */
    let whip = 0;
    if (whipT >= 0) {
      whipT += dt;
      const w = 2 * Math.PI * EARTH.whipHz;
      whip = dampedImpulse(whipT, EARTH.whipAmp, EARTH.whipZeta * w, w);
      if (whipT >= EARTH.whipDur) whipT = -1;
    }

    /* 小芽的叶：**茎不动**，只有两片叶摆。
       两份叶吃**同一份**角度 —— 绕同一个圆心、同一个角度，所以中间永不裂。
       静态倾角 rot 和摆动叠加后再一起绕圆心（不是各转各的）。
       ⚠️ 相位比球体滞后 sproutLag —— 和球体「一起触发、慢半拍跟上」。
       点击时再叠加 whip。 */
    const leafA = SPROUT.rot +
      Math.sin(((t - EARTH.sproutLag) / EARTH.swayDur) * Math.PI * 2) * EARTH.sproutSway + whip;

    /* 云：上下 + 横向漂移（都是**相对地球**的运动）。
       「和地球绑定」由 DOM 层级保证 —— 云在 #earthBob ⊃ #earthBreath 里，
       所以浮动 / 左右摆 / 呼吸 / 点击压扁都会带着它一起走，这里不用再手算一份。 */
    const cloudY = Math.sin((t / EARTH.cloudDur) * Math.PI * 2) * EARTH.cloudBob;
    const cloudX = Math.sin((t / (EARTH.cloudDur * 1.37)) * Math.PI * 2) * EARTH.cloudDrift;
    const cloudX0 = CLOUD.x + cloudX;      // 云的当前横向中心（雨滴跟着它走）
    /* 云也有呼吸：跟地球同周期（用同一个 wave），幅度小一点免得抢戏 */
    const cloudS = CLOUD.k * (1 + EARTH.cloudBreath * wave);

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出。
       下落时纵向拉长、横向略收 —— 读作「越落越快」，比匀速的点有生气。 */
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const p = (t * d.speed + d.phase) % 1;
      const o = frame[i];
      o.x = cloudX0 + d.dx + Math.sin((t * 1.6 + d.phase * 6.28) * Math.PI * 2) * d.wob;
      o.y = RAIN.yTop + p * (RAIN.yBottom - RAIN.yTop);
      o.sx = d.sc * (1 - 0.12 * p);
      o.sy = d.sc * (1 + 0.30 * p);
      const a = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
      o.op = a * 0.85;
    }

    /* 眨眼：时序推进交给共享层。
       地球和太阳不同：**悬停时也照常眨眼**（太阳那边是钉住不眨）——
       它没有「被注意到就屏住」的叙事，一直眨反而更活。所以 active 恒为 true。 */
    blink.step(dt, true);

    return {
      bobY, sway,
      breathSX: (1 + bs) * wd,
      breathSY: (1 + bs * 1.35) * sq,
      leafA,
      cloudX: CLOUD.x + cloudX, cloudY: CLOUD.y + cloudY, cloudS,
      drops: frame,
      eyes: eyeWeights(blink.value()),
      blink: blink.value(),
    };
  }

  return {
    step,
    drops,
    /** 点下去 → 叶子被震一下（把冲激时钟归零） */
    triggerWhip() { whipT = 0; },
    /** 调试：立刻眨一次 */
    blinkNow() { blink.fire(); },
    blinkValue: blink.value,
    get hoverW() { return hoverW; },
    get pressW() { return pressW; },
  };
}
