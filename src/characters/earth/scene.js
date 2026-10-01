/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 DOM 顺序一致，后声明者在上。自下而上：本体（含烘死的云 / 嘴 / 腮红）
 *    → 三态眼。
 *    · 本体与眼睛不拆前后层：`#earthEyes` 是 `#earthBodyWrap` 的子节点，
 *      本体缩放 / 上浮时眼睛随之移动，不会与烘死的嘴错开。
 *    · 云烘在本体边缘上，不是独立图层。再加一层时排在本体之后，并给它 `data-name`。
 *
 * 2) 本体与三态眼都是 1536 画布，且眼图是从本体上原样抠出来的
 *    （见 `_draft/_import-earth-moon.py`）—— 内容已在画布上的正确位置，
 *    所以两层共用同一份 `CANVAS_T`（定义在 anim.js），无需任何对位修正。
 *
 * 3) 每帧写 transform 的只有两个组：
 *      #earth          入场缩放。局部原点即画布中心，`scale` 原地生效
 *      #earthBodyWrap  呼吸 + 悬停 + 按压，绕球心缩放与上浮
 *
 * 4) 命中区 <circle id="hit"> 放在 #earth 之外，不随悬停移动，避免贴边 hover 抖动。
 *    圆心对准球心（非素材画布中心），半径 172 略大于球体半径 ≈170，云边不算命中。
 *
 * `data-name` 是 `_draft/character-tuner.html` 读取的中文图层名，不参与渲染。
 *
 * ⚠️ 下面整块是模板字符串：注释里不能出现反引号，也不能出现裸的 ${。改完必跑 `npm run build`。
 */
import earth_base from '../../assets/earth/earth_base.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_open from '../../assets/earth/eye_open.png';

import { BODY_C, CANVAS_T, EARTH, VIEW } from './anim.js';

const IMG = { earth_base, eye_closed, eye_half, eye_open };

export const SVG_SCENE = `
    <svg id="earthScene" viewBox="${VIEW.minX} ${VIEW.minY} ${VIEW.w} ${VIEW.h}" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停的地球角色">

      <g transform="translate(${EARTH.x} ${EARTH.y})">
        <g id="earth">

          <g id="earthBodyWrap">
            <image id="earthBody" data-name="本体" href="${IMG.earth_base}" x="0" y="0" width="1536" height="1536"
                   transform="${CANVAS_T}" />

            <!-- 三态眼：各一层，靠 opacity 交叉淡入，初始为「睁」。
                 与本体同一画布、同一变换，位置即脸上原位置。 -->
            <g id="earthEyes" data-name="眼睛" transform="${CANVAS_T}">
              <image id="earthEyeClosed" data-name="眼睛·闭" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="earthEyeHalf" data-name="眼睛·半闭" href="${IMG.eye_half}" x="0" y="0" width="1536" height="1536"
                     opacity="0" />
              <image id="earthEyeOpen" data-name="眼睛·睁" href="${IMG.eye_open}" x="0" y="0" width="1536" height="1536"
                     opacity="1" />
            </g>
          </g>

        </g>
      </g>

      <!-- 命中区：在 #earth 组外，不随悬停移动。圆心对准球心（BODY_C 为球心相对素材画布中心的偏移）。
           id 以 Hit 结尾是 _draft/character-tuner.html 的约定（它按这个正则找命中区）。 -->
      <circle id="earthHit" cx="${(EARTH.x + BODY_C.x).toFixed(1)}" cy="${(EARTH.y + BODY_C.y).toFixed(1)}" r="172"
              fill="transparent" style="pointer-events: all" />
    </svg>
`;
