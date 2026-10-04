/**
 * SVG 场景：金星角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体（含云带 / 嘴 / 腮红）
 *    → 三态眼。本体与眼睛不拆前后层：`#venusEyes` 是 `#venusBodyWrap` 的子节点。
 *    云带溢出球体之外，烘在本体图上，随本体一起缩放。
 *
 * 2) 本体与三态眼都是 1536 画布，眼图是从本体上抠出来的（`_draft/_eyes.py`），
 *    内容已在画布上的正确位置，两层共用同一份 `CANVAS_T`（定义在 anim.js），无需对位修正。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #venus          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #venusBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle> 放在 #venus 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 181 略大于球体半径 ≈178。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import eye_closed from '../../assets/venus/eye_closed.png';
import eye_half from '../../assets/venus/eye_half.png';
import eye_open from '../../assets/venus/eye_open.png';
import venus_base from '../../assets/venus/venus_base.png';

import { BODY_C, CANVAS_T, ORIGIN, VIEW } from './anim.js';

const IMG = { eye_closed, eye_half, eye_open, venus_base };

export const SVG_SCENE = `
    <svg id="venusScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的金星角色">

      <g transform="translate(${ORIGIN.x} ${ORIGIN.y})">
        <g id="venus">

          <g id="venusBodyWrap">
            <image id="venusBody" data-name="本体" href="${IMG.venus_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。 -->
            <g id="venusEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="venusEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="venusEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="venusEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>
          </g>

        </g>
      </g>

      <circle id="venusHit" cx="${(ORIGIN.x + BODY_C.x).toFixed(1)}" cy="${(ORIGIN.y + BODY_C.y).toFixed(1)}" r="181"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
