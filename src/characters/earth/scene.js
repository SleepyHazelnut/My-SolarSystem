/**
 * SVG 场景：地球角色的图层结构（唯一一份）。
 *
 * ⚠️ 几何数字**不写在这里** —— 从 `anim.js` import。那个文件是地球的唯一数字源，
 *    所以模板里的落点和主循环里算出来的落点天然一致，不存在「两处对不上」。
 *    （太阳那边是反过来的：数字抄在 scene.js 里，靠 `_draft/_verify-handoff.mjs` 复核。）
 *
 * 四条不能改的规则：
 *
 * 1) 绘制顺序在 SVG 里是**反的**（后声明 = 更上层）。实际绘制顺序是：
 *      雨 → 云(后层) → 球体 → 云(前层) → 三态五官（闭 → 半闭 → 睁）→ 小芽
 *
 *    ⚠️ 云是**两份 <image>**（同一个 href，浏览器只解码一次），靠显示哪一个来换图层：
 *         #earthCloudBack  —— 排在球体**之前** = 画在球体下面（回程弧那一段）
 *         #earthCloudFront —— 排在球体**之后** = 画在球体上面（进场弧 + 环那两段）
 *       两份每帧吃**同一份** transform 字符串，index.js 按 anim 给的 `behind` 切显示。
 *       位置差在哪一段？看 `anim.js` 的 ORBIT 注释 —— 切换点在最左点，那一刻云离球体
 *       还有 29 px，所以**切换本身看不见**。
 *    ⚠️ 雨排在云**之前**（= 画在云下面）：雨的起点落在云体内部，
 *       靠云的实心部分挡住水滴上半程，读起来才是「从云里落下来」，
 *       而不是「云脸上粘了几颗点」。
 *    ⚠️ 雨留在**后层**（不是前层）：雨的落点会压到球顶（yBottom 299 > 球顶 280），
 *       排在前层就会被画在球面上；排在后层才是「落进球后面」。
 *    ⚠️ 三态眼按「闭 → 半闭 → 睁」排，三层都吃 EARTH_T、与球体逐像素对齐，
 *       靠 opacity 切换 —— 不是三个位置不同的眼睛。
 *       三层外面套一层 `#earthFace`：**跟随偏移只写这一个组**（见下面 3 的说明）。
 *
 * 2) 「和地球绑定」靠 **DOM 层级**实现，不靠每帧手算一份地球的变换：
 *      #earthBob      浮动 + 左右摆
 *        └ #earthBreath  呼吸 + 点击压扁  ← 所有子节点一起跟着动
 *    所以云、雨、小芽、球体、五官都在 #earthBreath 里，自动跟着地球一起走。
 *    ⚠️ 只有「命中区」#earthHit 故意放在外面：它不该跟着呼吸上下动，
 *       否则贴边移动时 hover 会抖。
 *
 * 3) 只有静态落点写在模板里（球体变换、芽的包装组 translate/scale）。
 *    浮动 / 摆动 / 呼吸 / 挤压 / 叶摆 / 云漂 + 环绕 / 雨落 / 眨眼 / 五官跟随，
 *    全部由 index.js 每帧写绝对值，所以这里**不要**再套一层静态 transform，
 *    否则会和每帧写的叠乘。
 *    ⚠️ 唯一的例外是 `#earthFace` —— 它本身就是「每帧写的空组」：
 *       三张眼图各自带静态 EARTH_T（保持与球体对齐），跟随平移写在组上，两者是叠加关系。
 *
 * 4) 场景模板串里的注释**不能出现反引号或裸 `${`**（模板串会被当表达式解析）。
 *    改完**必跑 `npm run build`**。
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

export const IMG = {
  earth_base, eye_open, eye_half, eye_closed,
  sprout_stem, sprout_leaf_l, sprout_leaf_r,
  cloud,
};

export const EARTH_SCENE = `
    <svg id="earthScene" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
         aria-label="会呼吸、会眨眼、可悬停、可点击的地球角色">

      <!-- 球体 + 三态五官。都吃 EARTH_T，所以完全对齐。
           三态顺序：闭 → 半闭 → 睁（后声明 = 更上层）
           小芽排在球体之后（= 之上），并且整个 #earthBreath 一起呼吸、#earthBob 一起浮动，
           所以芽和球是「绑在一起」的，不是各动各的。 -->
      <g id="earthBob">
        <g id="earthBreath">

          <!-- 后层天空：雨 + 云（云只在**回程弧**那一段用这一份）。
               整个组**和地球绑定**（放进 #earthBob ⊃ #earthBreath 里）—— 于是它们跟着
               地球一起浮动 / 左右摆 / 呼吸 / 被点击压扁，不再是「地球动了云还留在原地」。
               位置仍由 index.js 每帧重写，但写的是**相对地球**的位置。
               ⚠️ 本组必须排在球体**之前**（= 画在球体下面）：雨的落点会压到球顶。
               ⚠️ 雨排在云**之前**（= 画在云下面）：雨的起点落在云体内部，
                  靠云的实心部分挡住水滴上半程，读起来才是「从云里落下来」。 -->
          <g id="earthSkyBack">
            <g id="earthRain"></g>
            <image id="earthCloudBack" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048"
                   style="display: none" />
          </g>

          <image id="earthBase" href="${IMG.earth_base}" x="0" y="0" width="2048" height="2048"
                 transform="${EARTH_T}" />

          <!-- 前层云：排在球体**之后** = 画在球体之上（进场弧 + 环绕那两段）。
               但要排在五官与小芽**之前** —— 脸和芽永远不该被云盖住。
               两份云每帧吃**同一份** transform，只有显示哪一个不同。 -->
          <image id="earthCloudFront" href="${IMG.cloud}" x="0" y="0" width="2048" height="2048" />

          <!-- 五官：**整层**包在一个可写组里 —— 云走开时 index.js 给这个组写一个纯平移
               （最多 8 px），读作「云走了，脸跟着偏过去看」。
               ⚠️ 五官（两只眼 + 嘴）是**同一张图**，只能整层平移，不能只动眼睛。
               ⚠️ 三态眼各自仍吃静态 EARTH_T（与球体逐像素对齐），跟随偏移写在外层组上，
                  所以两者是**叠加**的：p ↦ translate(dx dy) · EARTH_T(p)。
                  写在组上而不是三张图上，是「一份变换、三处共用」——省两次字符串拼装，
                  也避免三张图各写各的、改一处忘一处。 -->
          <g id="earthFace">
            <image id="earthEyeClosed" href="${IMG.eye_closed}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeHalf" href="${IMG.eye_half}" x="0" y="0" width="2048" height="2048"
                   opacity="0" transform="${EARTH_T}" />
            <image id="earthEyeOpen" href="${IMG.eye_open}" x="0" y="0" width="2048" height="2048"
                   opacity="1" transform="${EARTH_T}" />
          </g>
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
