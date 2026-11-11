# 拼多多去广告 — Quantumult X 原生全量版

为 Quantumult X 原生编写的拼多多净化规则 + 脚本，**代码原创**：不引用、不转写任何 Loon 插件文件，不受任何上游插件加密/禁搬运政策影响。

> 覆盖思路与 ZenmoFeiShi/Qx 的原生 `Pinduoduo.snippet`（底栏/弹窗，仍在维护）互补；两者覆盖重叠，**二选一，不要叠加**。接口与字段来自拼多多 App 公开接口结构。

## 安装

在 Quantumult X「重写 → 引用」中添加（把 `kenny53/kk_mod` 换成本仓库实际路径）：

```
https://raw.githubusercontent.com/kenny53/kk_mod/main/PinDuoDuo.snippet
```

配套分流（可选）在「分流 → 引用」中添加，并使其优先于宽泛直连规则：

```
https://raw.githubusercontent.com/kenny53/kk_mod/main/PinDuoDuo_filter.list
```

然后：开启重写与 HTTPS 解密（MITM）、安装并信任证书，确认 `api.pinduoduo.com`、`api.yangkeduo.com` 在 MITM 主机名内，重启拼多多。

## 覆盖范围

| 层 | 内容 |
|---|---|
| 接口拦截 | 开屏 `cappuccino/splash`；个人中心推广流 `ktt_gateway/.../personal_home_page` |
| 首页 hub | 底栏只保留 首页/聊天/个人中心；删会场推广横幅 `irregular_banner_dy`、热搜推广词 |
| oak 渲染 | 删底部推广区 `bottom_section_list`、`ui.bottom_section`、直播浮窗 `ui.live_section` |
| 个人中心 hub | 删月卡推广入口 `monthly_card_entrance` |
| 全局弹窗 | `hungary/global` 清空弹窗列表；`nagato/gather` 置 `valid_data=false` |
| 搜索 | 删推广扩展区 `expansion` |
| 订单 | 订单详情删底部推荐 `goods_list`；订单列表删 `order_growth_tip`；订单页删营销横幅 `marketing_banner_vo`、物流页推荐 |
| 分流（可选） | titan/apm 统计域名、广告素材 CDN 子域 reject |

脚本原则：只删上列推广/布局字段，不动商品、价格、订单金额；字段不存在即跳过，解析失败或异常一律原样放行。

## 已知边界

- Loon 原插件有一条针对 `api.pinduoduo.com` 的 QUIC 条件拦截，Quantumult X 无等价语法，本版未做（也未用全局禁 QUIC 替代）。
- 首页图标区（icon_set）属于功能瘦身而非广告，本版未删。
- 本版已经过本地模拟测试（字段清理/放行逻辑），**尚未在真机拼多多上验证**；App 改版后接口字段可能变化，失效时以抓包结果为准更新。

## 文件

- `PinDuoDuo.snippet` — 重写引用入口
- `pinduoduo_clean.js` — 统一响应清理脚本（按接口分流）
- `PinDuoDuo_filter.list` — 配套分流规则（可选）

## 更新日志

- v2.0（2026-11-11）：全量版首发。合并 v1（oak/个人中心/开屏/推广流）与底栏、弹窗、搜索、订单覆盖。
