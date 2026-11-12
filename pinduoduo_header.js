/*
 * 拼多多响应头清理 — Quantumult X 原生全量版 v4.2（2026-11-12）
 *
 * 删除 Alt-Svc 响应头，阻止 App 得知可以升级到 HTTP/3（QUIC，UDP 443）。
 * 原因：QX 无法解密 QUIC。App 冷启动走 TCP 时重写生效，收到 Alt-Svc 后
 * 下拉刷新改走 QUIC，重写失效，原版底栏/推广位回来。
 * 只删这一个头，其余原样放行；任何异常一律原样放行。代码原创。
 */

(function () {
  try {
    var h = ($response && $response.headers) || {};
    var out = {}, hit = false;
    Object.keys(h).forEach(function (k) {
      if (/^alt-svc$/i.test(k)) hit = true;
      else out[k] = h[k];
    });
    $done(hit ? { headers: out } : {});
  } catch (e) {
    $done({});
  }
})();
