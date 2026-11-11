# 拼多多去广告 — Quantumult X 原生全量版

为 Quantumult X 原生编写的拼多多净化规则 + 脚本，**代码原创**：不引用、不转写任何 Loon 插件文件，不受任何上游插件加密/禁搬运政策影响。

> 覆盖思路与 ZenmoFeiShi/Qx 的原生 `Pinduoduo.snippet`（底栏/弹窗，仍在维护）互补；两者覆盖重叠，**二选一，不要叠加**。接口与字段来自拼多多 App 公开接口结构。

## 来源与礼仪

- 本仓代码为**独立原创实现**，未复制、未转写 ZenmoFeiShi 或可莉（luestr）的任何规则/脚本文件。
- 接口路径与响应字段名是拼多多 App 的公开结构事实，任何实现都必然会碰到相同的字段；实现代码（解析、删除、放行逻辑）为本仓原创。
- 底栏精简与全局弹窗这两个净化方向，以及 Titan 长连接拦截（v3.0 起，域名/IP 清单参考其 snippet），与 ZenmoFeiShi 在其 QX 仓公开维护的做法一致，特此致谢并指路原版：[ZenmoFeiShi/Qx](https://github.com/ZenmoFeiShi/Qx) —— 想用原版请直接去那边引用。
- 与可莉的 Loon 插件**无代码关系**，未使用其插件中心分发的任何资源；尊重其“禁止搬运、索引、二改”的立场，本仓存在的理由正是为 Quantumult X 用户提供一份不依赖该插件的原生替代。
- 仅供个人学习与自用，请勿商业使用或二次分发牟利。如相关作者认为本仓有任何不妥，欢迎提 issue，将及时修改或删除。

## 安装（两步都要做）

**第 1 步｜分流 → 引用**（必需；**不要设置策略覆盖 / force-policy**，每行自带策略；排在 `geoip, cn, direct` 等宽泛直连规则之前）：

```
https://raw.githubusercontent.com/kenny53/kk_mod/main/PinDuoDuo_filter.list
```

**第 2 步｜重写 → 引用**：

```
https://raw.githubusercontent.com/kenny53/kk_mod/main/PinDuoDuo.snippet
```

然后：开启重写与 HTTPS 解密（MITM）、安装并信任证书，确认 `api.pinduoduo.com`、`api.yangkeduo.com` 在 MITM 主机名内，**彻底杀掉拼多多后台再打开**（Titan 长连接要断开重连才会回落 HTTPS）。

> 为什么第 1 步是必需的：拼多多把首页、个人中心等 API 请求走自家 Titan 私有长连接，不经过 HTTPS，MITM 看不到，任何重写都不会命中。拦掉 Titan 域名后 App 回落到普通 HTTPS 接口，重写才生效。Surge / Loon 的拼多多插件同样会拦 Titan。

不想用远程引用时，可用 `pinduoduo_local.conf`，把其中 `[filter_local]` / `[rewrite_local]` / `[mitm]` 三段并入当前配置的同名段落。

## 排障：仍然无效时，关闭 QUIC（UDP 443）

拼多多可能走 QUIC（HTTP/3，UDP 443）连 `api.pinduoduo.com`，QX 解不开 QUIC，重写同样无从触发。Surge 会对 MITM 主机自动拦 QUIC，Loon 插件里也有专门的 QUIC 拦截，所以同一台手机上它们能生效而 QX 不行。QX 没有“只拦某个域名的 QUIC”的语法，只能在配置 `[general]` 段全局丢弃 UDP 443（App 会自动回落 TCP，日常使用一般无感）：

```
udp_whitelist = 1-442, 444-65535
```

若 `[general]` 里已有 `udp_whitelist` 行，改它而不要重复添加。改完需重启 QX 的 VPN 开关并杀掉拼多多后台。（待真机确认）

## 覆盖范围

| 层 | 内容 |
|---|---|
| 接口拦截 | 开屏 `cappuccino/splash`；个人中心推广流 `ktt_gateway/.../personal_home_page` |
| 首页 hub | 底栏只保留 首页/聊天/个人中心；删会场推广横幅 `irregular_banner_dy`、热搜推广词 |
| oak 渲染 | 删底部推广区 `bottom_section_list`、`ui.bottom_section`、直播浮窗 `ui.live_section` |
| 个人中心 hub | 删月卡推广入口 `monthly_card_entrance` |
| 全局弹窗 | `hungary/global` 清空弹窗列表；`nagato/gather` 各弹窗子对象置 `valid_data=false` |
| 搜索 | 删推广扩展区 `expansion` |
| 订单 | 订单详情删底部推荐 `goods_list`；订单列表删 `order_growth_tip`；订单页删营销横幅 `marketing_banner_vo`、物流页推荐 |
| 分流（必需） | Titan 长连接域名（pinduoduo / yangkeduo）、titan-mt 专用 IP、拼多多自有 HTTPDNS reject（生效前提）；另含 apm 监控、广告素材 CDN 子域 |

脚本原则：只删上列推广/布局字段，不动商品、价格、订单金额；字段不存在即跳过，解析失败或异常一律原样放行。16 位以上的长整数（订单号、商品 ID 等）在解析前做占位保护、输出时原样还原，不会因 JS 数字精度被改写。

## 已知边界

- Loon 原插件有一条针对 `api.pinduoduo.com` 的 QUIC 条件拦截，Quantumult X 无等价语法，本版未做（也未用全局禁 QUIC 替代）。
- 首页图标区（icon_set）属于功能瘦身而非广告，本版未删。
- 不按 IP 拦 Titan：Titan 与购物接口共用网关 IP（见 v3.1 日志）；若拦截后个别功能（如消息实时推送）变慢，属回落 HTTPS 的正常代价。
- 本版已经过本地模拟测试（字段清理/放行/长整数保护），**尚未在真机拼多多上验证**；App 改版后接口字段可能变化，失效时以抓包结果为准更新。

## 文件

- `PinDuoDuo.snippet` — 重写引用入口
- `pinduoduo_clean.js` — 响应清理脚本（v3.0 起所有 body 类规则统一使用）
- `PinDuoDuo_filter.list` — 配套分流规则（**必需**，含 Titan 拦截）
- `PinDuoDuo_debug.snippet` + `pinduoduo_clean_debug.js` — 调试版：规则同主版，脚本处理首页/个人中心接口时弹通知报告命中路径与删除结果（调试脚本由主脚本把 `DEBUG` 改为 true 生成）
- `pinduoduo_local.conf` — 本地版（分流 + 重写 + MITM 三段）
- `test-personal-reject.snippet` — 诊断探针（个人中心接口单行 reject，测完删除）

## 更新日志

- v3.4（2026-11-12）：v3.3.1 真机：解密全部拼多多子域后刷新仍无任何通知；QX 连接记录显示刷新时有 `m`、`api`、`th-a`、`ta-a` 前缀的拼多多连接。推断刷新经 `m.pinduoduo.net`（与购物接口同网关）或非 JSON 通道下发：分流新增 `host, m.pinduoduo.net, reject`；调试版对空响应/非 JSON 响应也弹通知。待真机确认。
- v3.3.1（2026-11-12）：v3.3 真机：刷新仍无通知、底栏回 5 个。仅调试版改动：临时 MitM 全部 pinduoduo/yangkeduo/pinduoduo.net 子域，任一响应出现底栏/月卡字段即弹通知并报出域名，用于排查刷新是否走了其它 HTTPS 域名。主版不变。
- v3.3（2026-11-12）：真机调试通知确认：冷启动 hub 经 HTTPS 命中（5→3），下拉刷新**无通知**、底栏回 5 个——刷新数据仍走 Titan 裸 IP 直连。Titan 与购物接口共用网关 IP，Surge/Loon 版（ZenmoFeiShi）用 `no-resolve` 区分“按域名访问”与“裸 IP 直连”；QX 无此参数，改用 QX 固定规则优先级（host > host-suffix > ip-cidr）模拟：`host-suffix` 放行拼多多域名请求，再按 IP 拦截 Titan 全量 IP（pinduoduo/yangkeduo 两侧 DNS 结果 + 内置 IP，含 IPv6）。**分流资源从本版起不得设置 force-policy**。待真机确认。
- v3.2.1（2026-11-11）：真机确认下拉刷新同样命中 hub 且脚本已 5→3，但界面仍为 5 个——底栏另有来源或 App 有校验。仅升级调试版通知（报告 tab 字段名、同层字段、名字带 tab 的其它字段、请求参数名），主版行为不变。
- v3.2（2026-11-11）：真机（调试版通知）确认冷启动 `/api/alexa/homepage/hub` 已命中并 `bottom_tabs 5→3`，但下拉刷新后回到 5 个。推断刷新经 Titan 下发：补拦 `titan(-mt).yangkeduo.com` 与 titan-mt 专用 IP，并切断拼多多自有 HTTPDNS（`dns`/`httpdns` × pinduoduo/yangkeduo 及其 IP），防止 App 拿到 Titan IP 后直连绕过域名拦截。所有新增 IP 均经多地 DNS 核对与购物接口无重叠。待真机确认。
- v3.1（2026-11-11）：
  - **纠错**：前几轮真机测试期间用户 QX 的 MitM 开关处于关闭状态，v2.x–v3.0 的“零效果”结论及其上的推断（含 QUIC 排障）均在 MitM 关闭下得出，不再作为依据。MitM 打开后：Safari 探针生效；冷启动底栏 3 个，但下拉刷新后回到 5 个，月卡仍在。
  - **撤回 v3.0 的 Titan IP 拦截**：多地 DNS 实测 Titan 与 `api.pinduoduo.com`、`api.yangkeduo.com` 解析到同一批网关 IP，按 IP 拦截会误伤购物接口，疑为“刷新后回到 5 个”的原因（待真机确认）。分流只保留域名拦截。
  - 月卡入口改为按字段触发（任一已挂脚本的响应出现即删）；新增 `alexa`/`philo` 兜底规则以覆盖刷新与个人中心的其他路径。
  - 新增调试版（弹通知），用于在无抓包条件下确认命中路径。
- v3.0（2026-11-11）：定位 v2.x 零效果的根因——拼多多 API 走 Titan 私有长连接，未经 HTTPS，重写从未被触发（与 v2.0–v2.3 换机制均无变化、关闭本资源无差异的现象一致）。分流列表改为必需并补齐 `titan-mt` 与 Titan 直连 IP（此前仅有 `titan.pinduoduo.com` 且被标为“可选统计域名”）；body 规则统一回 JS 脚本；脚本新增长整数保护，修正 `nagato/gather` 的 `valid_data` 位置；本地版增加 `[filter_local]` 段。待真机验收。
- v2.3（2026-11-11）：二分测试版。v2.2 真机反馈广告全面回归（连原本有效的开屏 reject 都失效，疑似整条资源解析失败——长 jq 行中的特殊字符或资源解析器所致）。本版回到 v2.1 基线（开屏等 reject 恢复），仅把个人中心一条换成最简 jsonjq `del(.monthly_card_entrance?)` 单独验证 jq 机制；其余接口仍用 JS 脚本版。
- v2.2（2026-11-11）：机制切换。真机确认 v2.0/v2.1 的 `script-response-body` 未生效（QX 对脚本型 body 重写的 1024KB 上限，拼多多首页/个人中心响应过大被跳过；而 Surge/Loon 用 jq 不受此限、同接口同字段在其上有效）。全部改用 QX 原生 `jsonjq-response-body`（QX 官方 sample v1.5.5 已支持，与 Loon 的 `http-response-jq` 同机制），每接口一条组合 jq 表达式，均已在本地用真实 jq 验证（含字段缺失时原样通过）。`pinduoduo_clean.js` 自本版起弃用，保留在仓库仅作历史参考。
- v2.1（2026-11-11）：真机反馈底栏仍为 5 个后的针对性修复——底栏过滤改为按字段触发（任一已挂脚本的响应里出现 `bottom_tabs` 即处理）并递归深层查找；重写规则放宽为 pinduoduo/yangkeduo 双主机，且不再要求接口 URL 带查询参数。
- v2.0（2026-11-11）：全量版首发。合并 v1（oak/个人中心/开屏/推广流）与底栏、弹窗、搜索、订单覆盖。
