/**
 * SVG 场景：月球角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。月球只有一层：本体（含烘死的闭眼 / 嘴 / 腮红）。
 *    · 无睡帽层。加回时补一层 `#moonCap`，必须挂在 `#moonBodyWrap` **内**与本体同缩，
 *      分开缩会在呼吸时与头顶错开。
 *
 * 2) 本体是 1536 画布，原位叠上去即可。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #moon          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #moonBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle id="hit"> 放在 #moon 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 162 略大于球体半径 ≈159。
 *
 * ⚠️ 月球**不眨眼** —— 五官烘在本体图上，没有三态眼层。
 *
 * `data-name` 是图层中文名（调试用），不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import moon_base from '../../assets/moon/moon_base.png';

import { BODY_C, CANVAS_T, ORIGIN, VIEW } from './anim.js';

export const SVG_SCENE = `
    <svg id="moonScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、可悬停的月球角色">

      <g transform="translate(${ORIGIN.x} ${ORIGIN.y})">
        <g id="moon">

          <g id="moonBodyWrap">
            <image id="moonBody" data-name="本体" href="${moon_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />
          </g>

        </g>
      </g>

      <!-- 命中区：在 #moon 组外，不随悬停移动。圆心对准球心（BODY_C 为球心相对素材画布中心的偏移）。 -->
      <circle id="moonHit" cx="${(ORIGIN.x + BODY_C.x).toFixed(1)}" cy="${(ORIGIN.y + BODY_C.y).toFixed(1)}" r="162"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
