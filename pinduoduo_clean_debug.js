/*
 * 拼多多响应清理 — Quantumult X 原生全量版 v3.2.1（2026-11-11）
 *
 * v3.2.1：调试版通知增加底栏结构信息（tab 字段名、同层字段、名字带 tab 的其它字段），主版行为不变。
 * v3.1：月卡入口改为按字段触发（任一已挂脚本的响应中出现即删，深度≤4）；
 *       DEBUG=true 时每次处理 hub 类接口都弹通知报告命中路径与删除结果
 *       （pinduoduo_clean_debug.js 由本文件生成，仅此开关不同）。
 * v3.0：
 *   - 长整数保护：解析前把 16 位以上的整数字面量替换为占位字符串，
 *     输出前还原，避免订单号/商品 ID 等超过 2^53 的数字被 JSON.parse 改写；
 *   - nagato/gather：valid_data 位于各弹窗子对象内，改为逐个子对象置 false；
 *   - 生效前提：必须同时拦截 Titan 长连接（见 PinDuoDuo_filter.list），
 *     否则 App 走私有长连接，HTTPS 重写无从触发。
 *
 * 代码原创，不引用、不转写任何 Loon 插件文件。
 * 原则：只处理列明的推广/布局字段；字段不存在就跳过；
 *       解析失败或任何异常一律原样放行（$done({})）。
 */

(function () {
  try {
    if (!$response || !$response.body) {
      $done({});
      return;
    }

    var DEBUG = true;
    var url = ($request && $request.url) || "";
    var notes = [];
    var BIG = "__pdd_bigint__";

    // 把字符串外的长整数字面量包成字符串，返回新文本
    function protectBigInts(s) {
      var out = [], i = 0, n = s.length, last = 0;
      while (i < n) {
        var c = s.charCodeAt(i);
        if (c === 34) { // "
          i++;
          while (i < n) {
            var d = s.charCodeAt(i);
            if (d === 92) { i += 2; continue; } // \
            if (d === 34) break;
            i++;
          }
          i++;
          continue;
        }
        if (c === 45 || (c >= 48 && c <= 57)) { // - 或数字
          var j = i + 1;
          while (j < n) {
            var e = s.charCodeAt(j);
            if ((e >= 48 && e <= 57) || e === 46 || e === 101 || e === 69 || e === 43 || e === 45) j++;
            else break;
          }
          var tok = s.slice(i, j);
          if (/^-?\d{16,}$/.test(tok)) {
            out.push(s.slice(last, i), '"', BIG, tok, '"');
            last = j;
          }
          i = j;
          continue;
        }
        i++;
      }
      if (!out.length) return s;
      out.push(s.slice(last));
      return out.join("");
    }

    function restoreBigInts(s) {
      return s.indexOf(BIG) === -1 ? s
        : s.replace(new RegExp('"' + BIG + '(-?\\d+)"', "g"), "$1");
    }

    var obj;
    try {
      obj = JSON.parse(protectBigInts($response.body));
    } catch (e) {
      $done({});
      return;
    }
    if (!obj || typeof obj !== "object") {
      $done({});
      return;
    }

    var changed = false;

    function isObj(v) {
      return v && typeof v === "object" && !Array.isArray(v);
    }

    function del(parent, key) {
      if (isObj(parent) && Object.prototype.hasOwnProperty.call(parent, key)) {
        delete parent[key];
        changed = true;
      }
    }

    function roots() {
      var r = [obj];
      if (isObj(obj.result)) r.push(obj.result);
      if (isObj(obj.data)) r.push(obj.data);
      return r;
    }

    // 底部导航只保留 首页 / 聊天 / 个人中心；按字段触发，向下查找（深度≤4）
    var KEEP_TABS = ["index.html", "chat_list.html", "personal.html"];
    function pageOf(link) {
      return String(link || "").split("?")[0].split("#")[0].split("/").pop();
    }
    function filterTabsIn(node, depth, path) {
      if (!isObj(node) || depth > 4) return;
      ["bottom_tabs", "buffer_bottom_tabs"].forEach(function (key) {
        var arr = node[key];
        if (!Array.isArray(arr) || !arr.length) return;
        var kept = arr.filter(function (t) {
          return t && KEEP_TABS.indexOf(pageOf(t.link)) !== -1;
        });
        notes.push(path + key + " " + arr.length + "→" + (kept.length || arr.length));
        if (DEBUG) {
          // 调试：报告底栏页面、单个 tab 的字段名、同层其它字段名（找序号/签名/版本类校验字段）
          notes.push("页面:" + arr.map(function (t) { return t && pageOf(t.link).replace(".html", ""); }).join(","));
          notes.push("tab字段:" + (isObj(arr[0]) ? Object.keys(arr[0]).join(",") : typeof arr[0]));
          notes.push("同层:" + Object.keys(node).filter(function (k) { return k !== key; }).join(","));
        }
        if (kept.length && kept.length !== arr.length) {
          node[key] = kept;
          changed = true;
        }
      });
      // 个人中心月卡推广入口：按字段触发
      if (Object.prototype.hasOwnProperty.call(node, "monthly_card_entrance")) {
        del(node, "monthly_card_entrance");
        notes.push(path + "monthly_card_entrance 已删");
      }
      Object.keys(node).forEach(function (k) {
        if (isObj(node[k])) filterTabsIn(node[k], depth + 1, path + k + ".");
      });
    }
    filterTabsIn(obj, 0, "");

    // 调试：全响应（含数组内）查找名字带 tab 的其它数组/对象字段，排查底栏的其它来源
    if (DEBUG) {
      var seen = 0;
      (function scan(node, path, depth) {
        if (!node || typeof node !== "object" || depth > 8 || seen >= 8) return;
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length && i < 30; i++) scan(node[i], path.replace(/\.$/, "") + "[" + i + "].", depth + 1);
          return;
        }
        Object.keys(node).forEach(function (k) {
          var v = node[k];
          if (/tab/i.test(k) && k !== "bottom_tabs" && k !== "buffer_bottom_tabs" &&
              v && typeof v === "object" && seen < 8) {
            seen++;
            notes.push("其它:" + path + k + (Array.isArray(v) ? "[" + v.length + "]" : "{" + Object.keys(v).slice(0, 6).join(",") + "}"));
          }
          scan(v, path + k + ".", depth + 1);
        });
      })(obj, "", 0);
    }

    if (/\/api\/alexa\/homepage\/hub/.test(url)) {
      // 首页：会场推广横幅 + 热搜推广词
      roots().forEach(function (r) {
        if (isObj(r.dy_module)) del(r.dy_module, "irregular_banner_dy");
        del(r, "search_bar_hot_query");
      });
    }
    if (/\/api\/oak\/integration\/render/.test(url)) {
      // 渲染接口：底部推广区 + 直播浮窗
      roots().forEach(function (r) {
        del(r, "bottom_section_list");
        if (isObj(r.ui)) {
          del(r.ui, "bottom_section");
          del(r.ui, "live_section");
        }
      });
    }
    if (/\/(aquarius|flow)\/hungary\/(window\/)?global\//.test(url)) {
      // 全局弹窗接口：清空弹窗列表
      roots().forEach(function (r) {
        if (Array.isArray(r.list) && r.list.length) {
          r.list = [];
          changed = true;
        }
      });
    }
    if (/\/api\/growth\/nagato\/app\/index\/gather/.test(url)) {
      // 弹窗聚合接口：根层及其直接子对象里的 valid_data=true 一律置 false
      roots().forEach(function (r) {
        [r].concat(Object.keys(r).map(function (k) { return r[k]; }))
          .forEach(function (o) {
            if (isObj(o) && o.valid_data === true) {
              o.valid_data = false;
              changed = true;
            }
          });
      });
    }
    if (/pinduoduo\.com\/search/.test(url)) {
      // 搜索页：推广扩展区
      roots().forEach(function (r) {
        del(r, "expansion");
      });
    }
    if (/\/api\/caterham\/v3\/query\/order_detail_group/.test(url)) {
      // 订单详情页：底部推荐商品
      roots().forEach(function (r) {
        del(r, "goods_list");
      });
    }
    if (/\/api\/aristotle\/order_list_v4/.test(url)) {
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
    }
    if (/pinduoduo\.com\/order\//.test(url)) {
      // 订单页：营销横幅 + 物流页上方推荐
      roots().forEach(function (r) {
        del(r, "marketing_banner_vo");
        if (isObj(r.shipping)) del(r.shipping, "banner_above_recommend");
      });
    }

    if (DEBUG && (/hub|personal/.test(url) || notes.length)) {
      var path = url.split("?")[0].replace(/^https?:\/\/[^\/]+/, "");
      var qs = (url.split("?")[1] || "").split("&").map(function (p) { return p.split("=")[0]; }).filter(Boolean);
      $notify("PDD调试 " + path, ($response.body.length / 1024).toFixed(0) + "KB " +
        (changed ? "已修改" : "未修改") + (qs.length ? " 参数:" + qs.slice(0, 8).join(",") : ""),
        notes.length ? notes.join(" | ") : "未发现底栏/月卡字段");
    }

    if (changed) {
      $done({ body: restoreBigInts(JSON.stringify(obj)) });
    } else {
      $done({});
    }
  } catch (e) {
    $done({});
  }
})();
