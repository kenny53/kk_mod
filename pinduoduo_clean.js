/*
 * 拼多多响应清理 — Quantumult X 原生全量版 v2.0（2026-11-11）
 *
 * 代码原创，不引用、不转写任何 Loon 插件文件。
 * 覆盖接口与字段来自拼多多 App 公开接口结构；与 ZenmoFeiShi/Qx 的
 * 原生 Pinduoduo.snippet 覆盖面互补（底栏/弹窗部分思路一致，实现独立）。
 *
 * 原则：
 *   - 只处理下列列明的推广/布局字段，不动商品、价格、订单金额等核心业务数据；
 *   - 字段不存在就跳过；解析失败或任何异常一律原样放行（$done({})）。
 */

(function () {
  try {
    if (!$response || !$response.body) {
      $done({});
      return;
    }

    var url = ($request && $request.url) || "";

    var obj;
    try {
      obj = JSON.parse($response.body);
    } catch (e) {
      $done({});
      return;
    }
    if (!obj || typeof obj !== "object") {
      $done({});
      return;
    }

    var changed = false;

    function del(parent, key) {
      if (parent && typeof parent === "object" &&
          Object.prototype.hasOwnProperty.call(parent, key)) {
        delete parent[key];
        changed = true;
      }
    }

    function roots() {
      var r = [obj];
      if (obj.result && typeof obj.result === "object") r.push(obj.result);
      if (obj.data && typeof obj.data === "object") r.push(obj.data);
      return r;
    }

    // 底部导航只保留 首页 / 聊天 / 个人中心（去掉多多视频、直播等推广 tab）
    var KEEP_TABS = ["index.html", "chat_list.html", "personal.html"];
    function pageOf(link) {
      return String(link || "").split("?")[0].split("#")[0].split("/").pop();
    }
    function filterTabs(container) {
      if (!container || typeof container !== "object") return;
      ["bottom_tabs", "buffer_bottom_tabs"].forEach(function (key) {
        var arr = container[key];
        if (!Array.isArray(arr) || !arr.length) return;
        var kept = arr.filter(function (t) {
          return t && KEEP_TABS.indexOf(pageOf(t.link)) !== -1;
        });
        if (kept.length && kept.length !== arr.length) {
          container[key] = kept;
          changed = true;
        }
      });
    }

    if (/\/api\/alexa\/homepage\/hub/.test(url)) {
      // 首页：底栏精简 + 会场推广横幅 + 热搜推广词
      roots().forEach(function (r) {
        filterTabs(r);
        if (r.dy_module && typeof r.dy_module === "object") {
          del(r.dy_module, "irregular_banner_dy");
        }
        del(r, "search_bar_hot_query");
      });
    } else if (/\/api\/oak\/integration\/render/.test(url)) {
      // 渲染接口：底部推广区 + 直播浮窗
      roots().forEach(function (r) {
        del(r, "bottom_section_list");
        if (r.ui && typeof r.ui === "object") {
          del(r.ui, "bottom_section");
          del(r.ui, "live_section");
        }
      });
    } else if (/\/api\/philo\/personal\/hub/.test(url)) {
      // 个人中心：月卡推广入口
      roots().forEach(function (r) {
        del(r, "monthly_card_entrance");
      });
    } else if (/\/(aquarius|flow)\/hungary\/(window\/)?global\//.test(url)) {
      // 全局弹窗接口：清空弹窗列表
      roots().forEach(function (r) {
        if (Array.isArray(r.list) && r.list.length) {
          r.list = [];
          changed = true;
        }
      });
    } else if (/\/api\/growth\/nagato\/app\/index\/gather/.test(url)) {
      // 弹窗聚合接口：将 valid_data 置为 false 使其失效
      roots().forEach(function (r) {
        if (r.valid_data === true) {
          r.valid_data = false;
          changed = true;
        }
      });
    } else if (/pinduoduo\.com\/search/.test(url)) {
      // 搜索页：推广扩展区
      roots().forEach(function (r) {
        del(r, "expansion");
      });
    } else if (/\/api\/caterham\/v3\/query\/order_detail_group/.test(url)) {
      // 订单详情页：底部推荐商品
      roots().forEach(function (r) {
        del(r, "goods_list");
      });
    } else if (/\/api\/aristotle\/order_list_v4/.test(url)) {
      // 订单列表：按钮上的增长提示
      var orders = obj.orders || (obj.result && obj.result.orders) || (obj.data && obj.data.orders);
      if (Array.isArray(orders)) {
        orders.forEach(function (o) {
          if (o && Array.isArray(o.order_buttons)) {
            o.order_buttons.forEach(function (b) {
              del(b, "order_growth_tip");
            });
          }
        });
      }
    } else if (/pinduoduo\.com\/order\//.test(url)) {
      // 订单页：营销横幅 + 物流页上方推荐
      roots().forEach(function (r) {
        del(r, "marketing_banner_vo");
        if (r.shipping && typeof r.shipping === "object") {
          del(r.shipping, "banner_above_recommend");
        }
      });
    }

    if (changed) {
      $done({ body: JSON.stringify(obj) });
    } else {
      $done({});
    }
  } catch (e) {
    $done({});
  }
})();
