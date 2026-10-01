/**
 * SVG 场景：太阳角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体（含烘死的火焰边缘 / 嘴 / 腮红）
 *    → 三态眼。
 *    · 本体与眼睛不拆前后层：`#sunEyes` 是 `#sunBodyWrap` 的子节点。
 *    · 头顶光环与 `sun_rays.png` 已移除。再加一层时排在本体之后，并给它 `data-name`。
 *
 * 2) 本体与三态眼都是 1536 画布，且眼图是从本体上原样抠出来的 ——
 *    内容已在画布上的正确位置，所以两层共用同一份 `CANVAS_T`（定义在 anim.js），
 *    无需任何对位修正。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #sun          入场缩放。局部原点即太阳中心，`scale` 原地生效
 *      #sunBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *    眼睛挂在 #sunBodyWrap 内，本体缩放 / 上浮时随之移动，不会与烘死的嘴错开。
 *
 * 4) 命中区 <circle id="hit"> 放在 #sun 之外，不随悬停移动，避免贴边 hover 抖动。
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

import { BODY_C, CANVAS_T, SUN, VIEW } from './anim.js';

const IMG = { eye_closed, eye_half, eye_open, sun_base };

export const SVG_SCENE = `
    <svg id="scene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的太阳角色">

      <g transform="translate(${SUN.x} ${SUN.y})">
        <g id="sun">

          <g id="sunBodyWrap">
            <image id="sunBody" data-name="本体" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。
                 与本体同一画布、同一变换，位置即脸上原位置。 -->
            <g id="sunEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="eyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="eyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="eyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>
          </g>

        </g>
      </g>

      <!-- 命中区：在 #sun 组外，不随悬停移动。
           圆心对准球心（BODY_C 为球心相对素材画布中心的偏移），半径 150 略大于球体半径
           （≈146 局部单位），火焰尖不算命中。 -->
      <circle id="hit" cx="${(SUN.x + BODY_C.x).toFixed(1)}" cy="${(SUN.y + BODY_C.y).toFixed(1)}" r="150"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
