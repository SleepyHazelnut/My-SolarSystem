/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * ⚠️ 几何数字**不写在这里** —— 从 `anim.js` import。那个文件是地球的唯一数字源，
 *    所以模板里的落点和主循环里算出来的落点天然一致，不存在「两处对不上」。
 *    （太阳那边是反过来的：数字抄在 scene.js 里，靠 `_draft/_verify-handoff.mjs` 复核。）
 *
 * 三条不能改的规则：
 *
 * 1) 绘制顺序在 SVG 里是**反的**（后声明 = 更上层）。地球从上到下的视觉层次是
 *    云 → 雨 → 小芽 → 球体，而**实际绘制顺序**是：
 *      云和雨（#earthSky）→ 球体 → 三态五官（闭 → 半闭 → 睁）→ 小芽
 *    ⚠️ #earthSky 必须排在球体**之前**（= 画在球体下面）：雨的落点会压到球顶，
 *       排在球体后面就会被画在球面上。
 *    ⚠️ 雨还要排在云**之前**（= 画在云下面）：雨的起点落在云体内部，
 *       靠云的实心部分挡住水滴上半程，读起来才是「从云里落下来」，
 *       而不是「云脸上粘了几颗点」。
 *    ⚠️ 三态眼按「闭 → 半闭 → 睁」排，三层都吃 EARTH_T、与球体逐像素对齐，
 *       靠 opacity 切换 —— 不是三个位置不同的眼睛。
 *
 * 2) 「和地球绑定」靠 **DOM 层级**实现，不靠每帧手算一份地球的变换：
 *      #earthBob      浮动 + 左右摆
 *        └ #earthBreath  呼吸 + 点击压扁  ← 所有子节点一起跟着动
 *    所以云、雨、小芽、球体、五官都在 #earthBreath 里，自动跟着地球一起走。
 *    ⚠️ 只有「命中区」#earthHit 故意放在外面：它不该跟着呼吸上下动，
 *       否则贴边移动时 hover 会抖。
 *
 * 3) 只有静态落点写在模板里（球体变换、芽的包装组 translate/scale）。
 *    浮动 / 摆动 / 呼吸 / 挤压 / 叶摆 / 云漂 / 雨落 / 眨眼，全部由 index.js 每帧写绝对值，
 *    所以这里**不要**再套一层静态 transform，否则会和每帧写的叠乘。
 *
 * 8 张 PNG 直接复用原设计稿（没有重绘、没有转矢量），都在 `src/assets/earth/`：
 *   earth_base（球体，无五官）/ eye_open · eye_half · eye_closed（三态眼 + 嘴，一张图）
 *   sprout_stem · sprout_leaf_l · sprout_leaf_r（头顶小芽，三份）/ cloud（云朵）
 */
import { CX, CY, VIEW_W, VIEW_H, EARTH_T, SPROUT } from './anim.js';

import earth_base from '../../assets/earth/earth_base.png';
import eye_open from '../../assets/earth/eye_open.png';
import eye_half from '../../assets/earth/eye_half.png';
import eye_closed from '../../assets/earth/eye_closed.png';
import sprout_stem from '../../assets/earth/sprout_stem.png';
import sprout_leaf_l from '../../assets/earth/sprout_leaf_l.png';
import sprout_leaf_r from '../../assets/earth/sprout_leaf_r.png';
import cloud from '../../assets/earth/cloud.png';

export const IMG = { earth_base, eye_open, eye_half, eye_closed, sprout_stem, sprout_leaf_l, sprout_leaf_r, cloud };

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
