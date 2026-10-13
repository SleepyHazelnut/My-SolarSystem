/**
 * SVG 场景：太阳角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体光晕 → 本体（含烘死的火焰边缘 / 嘴 / 腮红）
 *    → 三态眼 → 光环·后 → 星·光晕 → 星 → 光环·前 → 光环特效 → 特效。
 *    · 都是 `#sunBodyWrap` 的子节点，不做前后分层。
 *    · 光环原图拆成「环后 / 星 / 环前」三张：星的尖压在环上，整张抠不开，拆开才能让
 *      星和环各自呼吸（星缩放时环不动）。三层共用 `HALO_T`，星的位置见 `STAR_IMG_T`。
 *    · 水滴（光环特效）与星点各切成单颗（`HF_PTS` / `FX_PTS`），一颗一个 `<image>`，逐颗改 opacity。
 *      水滴是触发式的（初始 `opacity="0"`），星点是常驻的。
 *
 * 2) 各层都是 1536 画布（`sun_fx.png` 实际是 1535），内容已在画布上的正确位置 ——
 *    本体与眼共用 `CANVAS_T`，其余各按自己的图变换把锚点挪到组原点。
 *    切出来的小图存的是「在原画布上的 x y w h」，放在同一份图变换里摆回去即可。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #sun          入场缩放。局部原点即太阳中心，`scale` 原地生效
 *      #sunBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *    眼睛挂在 #sunBodyWrap 内，本体缩放 / 上浮时随之移动，不会与烘死的嘴错开。
 *    #sunHaloBack / #sunStar / #sunHaloFront / #sunFx 的 transform 由 `index.js` 逐帧写，
 *    水滴那 6 张 `<image>` 的 opacity 与 transform、本体光晕的 opacity 也由 `index.js` 写。
 *
 * 4) 命中区 <circle id="sunHit"> 放在 #sun 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 150 略大于球体半径 ≈146，火焰尖不算命中。
 *
 * viewBox 由所有动作的包络加边距推出（见 `anim.js` 的 `VIEW`）；动作幅度调大后必须重算。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import eye_closed from '../../assets/eye/eye_closed.png';
import eye_half from '../../assets/eye/eye_half.png';
import eye_open from '../../assets/eye/eye_open.png';
import sun_base from '../../assets/sun/sun_base.png';
import sun_click_face from '../../assets/sun/sun_click_face.png';
import sun_halo_back from '../../assets/sun/sun_halo_back.png';
import sun_halo_front from '../../assets/sun/sun_halo_front.png';
import sun_star from '../../assets/sun/sun_star.png';

import { BALL_D, BODY_C, CANVAS_T, FX_IMG_T, FX_PTS, FX_STARS, FX_T, GLOW, HALO_FX_IMG_T, HALO_FX_T, HALO_IMG_T, HALO_T, HF_PTS, ORIGIN, STAR_IMG_T, VIEW } from './anim.js';

const IMG = { eye_closed, eye_half, eye_open, sun_base, sun_click_face, sun_halo_back, sun_halo_front, sun_star };

/* 光晕圆的半径（局部单位）。 */
const GLOW_R = ((BALL_D / 2) * GLOW.r).toFixed(1);

/* 切碎的两层：文件名排序即 `anim.js` 里落位数组的顺序（`_draft/_split_fx.py` 生成时同序）。 */
const hfMods = import.meta.glob('../../assets/sun/halofx/*.png', { eager: true, query: '?url', import: 'default' });
const fxMods = import.meta.glob('../../assets/sun/fx/*.png', { eager: true, query: '?url', import: 'default' });
const starMods = import.meta.glob('../../assets/sun/star/*.png', { eager: true, query: '?url', import: 'default' });
const hfImgs = Object.keys(hfMods).sort().map((k) => hfMods[k]);
const fxImgs = Object.keys(fxMods).sort().map((k) => fxMods[k]);
const starImgs = Object.keys(starMods).sort().map((k) => starMods[k]);

/* `pts` 每项是 `[x, y, w, h, scale]`，`scale` 缺省 1，按中心缩放。
   片数多于图数时循环取图。 */
const parts = (imgs, pts, prefix, label, opacity) => pts
  .map(([x, y, w, h, s = 1], i) => {
    const W = w * s, H = h * s;
    const left = (x + w / 2 - W / 2).toFixed(1), top = (y + h / 2 - H / 2).toFixed(1);
    return `<image id="${prefix}${i}" data-name="${label}${i}" href="${imgs[i % imgs.length]}"`
      + ` x="${left}" y="${top}" width="${W.toFixed(1)}" height="${H.toFixed(1)}"`
      + (opacity == null ? '' : ` opacity="${opacity}"`) + ' />';
  })
  .join('\n                ');

export const SVG_SCENE = `
    <svg id="sunScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的太阳角色">

      <defs>
        <radialGradient id="sunGlowGrad">
          <stop offset="0.30" stop-color="#FFE0A0" stop-opacity="1" />
          <stop offset="0.58" stop-color="#FFC864" stop-opacity="0.62" />
          <stop offset="0.82" stop-color="#FFB43C" stop-opacity="0.22" />
          <stop offset="1" stop-color="#FFA824" stop-opacity="0" />
        </radialGradient>
      </defs>

      <g transform="translate(${ORIGIN.x} ${ORIGIN.y})">
        <g id="sun">

          <g id="sunBodyWrap">
            <!-- 本体光晕：垫在本体下面的暖色渐变圆，圆心 = 球心，跟着呼吸一起缩放。 -->
            <circle id="sunGlow" data-name="本体光晕" cx="${BODY_C.x}" cy="${BODY_C.y}" r="${GLOW_R}"
                    fill="url(#sunGlowGrad)" opacity="${GLOW.opacity}" />

            <image id="sunBody" data-name="本体" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。
                 与本体同一画布、同一变换，位置即脸上原位置。 -->
            <g id="sunEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="sunEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="sunEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="sunEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>

            <!-- 点击表情：按住时替换三态眼与嘴（整张 1536 画布，与本体同变换）。 -->
            <image id="sunClickFace" data-name="点击表情" href="${IMG.sun_click_face}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" opacity="0" />

            <!-- 光环：拆成 环后 / 星 / 环前 三层，中间夹着星，近弧才能压在星身上。
                 摆放参数见 anim.js 的 HALO，星的下沉见 STAR_SINK。 -->
            <g id="sunHaloBack" data-name="光环·后" transform="${HALO_T}">
              <image id="sunHaloBackImg" data-name="光环·后图" href="${IMG.sun_halo_back}" x="0" y="0" width="1536" height="1536"
                     transform="${HALO_IMG_T}" />
            </g>

            <!-- 星的光晕：同一张星图 + 固定半径模糊，逐帧只改 opacity，不重算滤镜。 -->
            <g id="sunStarGlow" data-name="星·光晕" transform="${HALO_T}" opacity="0">
              <image id="sunStarGlowImg" data-name="星·光晕图" href="${IMG.sun_star}" x="0" y="0" width="1536" height="1536"
                     transform="${STAR_IMG_T}" style="filter: blur(36px)" />
            </g>

            <g id="sunStar" data-name="星" transform="${HALO_T}">
              <image id="sunStarImg" data-name="星·图" href="${IMG.sun_star}" x="0" y="0" width="1536" height="1536"
                     transform="${STAR_IMG_T}" />
            </g>

            <g id="sunHaloFront" data-name="光环·前" transform="${HALO_T}">
              <image id="sunHaloFrontImg" data-name="光环·前图" href="${IMG.sun_halo_front}" x="0" y="0" width="1536" height="1536"
                     transform="${HALO_IMG_T}" />
            </g>

            <!-- 光环特效：光环上方那串水滴，点一下才迸溅一次 —— 静止时 opacity 0，
                 亮的瞬间 6 颗沿各自径向往外飞（逐颗的 opacity 与 transform 由 index.js 写）。 -->
            <g id="sunHaloFx" data-name="光环特效">
              <g id="sunHaloFxLayer" transform="${HALO_FX_T}">
                <g transform="${HALO_FX_IMG_T}">
                ${parts(hfImgs, HF_PTS, 'sunHf', '水滴', 0)}
                </g>
              </g>
            </g>

            <!-- 特效：散落在四周的碎点与装饰星。碎点逐颗沿背离太阳的方向溅出，
                 装饰星留在原地闪。整层再按按压权重放大做爆发，并套一层暖色柔光。
                 特效.png 切出的 15 片碎点 + 设定7 抠出的 5 颗装饰星。 -->
            <g id="sunFx" data-name="特效" style="filter: drop-shadow(0 0 5px rgba(255, 203, 86, 0.9))">
              <g id="sunFxLayer" transform="${FX_T}">
                <g transform="${FX_IMG_T}">
                ${parts(fxImgs, FX_PTS, 'sunFxPt', '星点')}
                ${parts(starImgs, FX_STARS, 'sunFxStar', '星闪')}
                </g>
              </g>
            </g>
          </g>

        </g>
      </g>

      <!-- 命中区：在 #sun 组外，不随悬停移动。
           圆心对准球心（BODY_C 为球心相对素材画布中心的偏移），半径 150 略大于球体半径
           （≈146 局部单位），火焰尖不算命中。 -->
      <circle id="sunHit" cx="${(ORIGIN.x + BODY_C.x).toFixed(1)}" cy="${(ORIGIN.y + BODY_C.y).toFixed(1)}" r="150"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
