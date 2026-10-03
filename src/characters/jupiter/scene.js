/**
 * SVG 场景：木星角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。木星只有一层：本体（含烘死的脸与两侧云）。
 *
 * 2) 本体是 1536 画布，原位叠上去即可。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #jupiter          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #jupiterBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle id="jupiterHit"> 放在 #jupiter 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心在 viewBox 中心（= 球心），半径 162 略大于球体半径 158.7。
 *
 * ⚠️ 木星**不眨眼** —— 五官烘在本体图上，没有三态眼层。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import jupiter_base from '../../assets/jupiter/jupiter_base.png';

import { BODY_C, CANVAS_T, JUPITER, VIEW } from './anim.js';

export const SVG_SCENE = `
    <svg id="jupiterScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、可悬停的木星角色">

      <g transform="translate(${JUPITER.x} ${JUPITER.y})">
        <g id="jupiter">

          <g id="jupiterBodyWrap">
            <image id="jupiterBody" data-name="本体" href="${jupiter_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />
          </g>

        </g>
      </g>

      <circle id="jupiterHit" cx="${(JUPITER.x + BODY_C.x).toFixed(1)}" cy="${(JUPITER.y + BODY_C.y).toFixed(1)}" r="162"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
