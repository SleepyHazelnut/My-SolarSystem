/**
 * SVG 场景：水星角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体（含烘死的陨石坑 / 嘴 / 腮红）
 *    → 三态眼。本体与眼睛不拆前后层：`#mercuryEyes` 是 `#mercuryBodyWrap` 的子节点。
 *
 * 2) 本体与三态眼都是 1536 画布，眼图是从本体上抠出来的（`_draft/_eyes.py`），
 *    内容已在画布上的正确位置，两层共用同一份 `CANVAS_T`（定义在 anim.js），无需对位修正。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #mercury          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #mercuryBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle> 放在 #mercury 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 149 略大于球体半径 ≈146。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import eye_closed from '../../assets/mercury/eye_closed.png';
import eye_half from '../../assets/mercury/eye_half.png';
import eye_open from '../../assets/mercury/eye_open.png';
import mercury_base from '../../assets/mercury/mercury_base.png';

import { BODY_C, CANVAS_T, MERCURY, VIEW } from './anim.js';

const IMG = { eye_closed, eye_half, eye_open, mercury_base };

export const SVG_SCENE = `
    <svg id="mercuryScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的水星角色">

      <g transform="translate(${MERCURY.x} ${MERCURY.y})">
        <g id="mercury">

          <g id="mercuryBodyWrap">
            <image id="mercuryBody" data-name="本体" href="${IMG.mercury_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。 -->
            <g id="mercuryEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="mercuryEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="mercuryEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="mercuryEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>
          </g>

        </g>
      </g>

      <circle id="mercuryHit" cx="${(MERCURY.x + BODY_C.x).toFixed(1)}" cy="${(MERCURY.y + BODY_C.y).toFixed(1)}" r="149"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
