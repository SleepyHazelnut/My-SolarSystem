/**
 * SVG 场景：火星角色的图层结构。
 *
 * 绘制顺序与 DOM 顺序一致，后声明者在上：本体（含烘死的陨石坑 / 嘴 / 腮红）→ 三态眼。
 * `#marsEyes` 是 `#marsBodyWrap` 的子节点。
 *
 * 每帧写 transform 的只有两个组：
 *   #mars          入场缩放，局部原点即画布中心
 *   #marsBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 命中区 <circle> 在 #mars 之外，不随悬停移动；圆心对准球心，半径 162 略大于球体半径 ≈159。
 *
 * `data-name` 是图层中文名（调试用）。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import eye_closed from '../../assets/mars/eye_closed.png';
import eye_half from '../../assets/mars/eye_half.png';
import eye_open from '../../assets/mars/eye_open.png';
import mars_base from '../../assets/mars/mars_base.png';

import { BODY_C, CANVAS_T, MARS, VIEW } from './anim.js';

const IMG = { eye_closed, eye_half, eye_open, mars_base };

export const SVG_SCENE = `
    <svg id="marsScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的火星角色">

      <g transform="translate(${MARS.x} ${MARS.y})">
        <g id="mars">

          <g id="marsBodyWrap">
            <image id="marsBody" data-name="本体" href="${IMG.mars_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。 -->
            <g id="marsEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="marsEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="marsEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="marsEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>
          </g>

        </g>
      </g>

      <circle id="marsHit" cx="${(MARS.x + BODY_C.x).toFixed(1)}" cy="${(MARS.y + BODY_C.y).toFixed(1)}" r="162"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
