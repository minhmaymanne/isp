import { useState, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
const sleep = ms => new Promise(r => setTimeout(r, ms));
// ═══════════════════════════════════════════════════════════════════════════════
// GATEWAY DATABASE
// ═══════════════════════════════════════════════════════════════════════════════
const GATEWAYS = [
  { ip: "192.168.100.1", hint: "Modem cáp DOCSIS (VNPT/Viettel/FPT cáp)" },
  { ip: "192.168.1.1",   hint: "Viettel / TP-Link / ASUS / Mercusys" },
  { ip: "192.168.0.1",   hint: "VNPT / D-Link / Linksys / Netgear" },
  { ip: "192.168.1.254", hint: "Modem ADSL/FTTH (một số hãng)" },
  { ip: "10.0.0.1",      hint: "Viettel (modem mới)" },
  { ip: "10.0.0.138",    hint: "Viettel (Huawei EchoLife)" },
  { ip: "192.168.2.1",   hint: "VNPT / Apple Airport" },
  { ip: "192.168.10.1",  hint: "FPT Telecom" },
  { ip: "192.168.8.1",   hint: "Huawei (4G router)" },
  { ip: "192.168.3.1",   hint: "Totolink / ZTE" },
  { ip: "192.168.43.1",  hint: "Hotspot Android" },
  { ip: "172.20.10.1",   hint: "Hotspot iPhone/iPad" },
  { ip: "192.168.88.1",  hint: "MikroTik" },
  { ip: "172.16.0.1",    hint: "Corporate / VPN" },
];
const WAN_TARGETS = [
  { id: "cf1",    label: "Cloudflare 1.1.1.1",  url: "https://1.1.1.1/cdn-cgi/trace" },
  { id: "google", label: "Google DNS",           url: "https://dns.google/resolve?name=test.com&type=A" },
  { id: "cf2",    label: "Cloudflare Edge",      url: "https://cloudflare.com/cdn-cgi/trace" },
];
const SPEED_TARGETS = [
  { label: "500KB", url: "https://speed.cloudflare.com/__down?bytes=500000",  bytes: 500000 },
  { label: "2MB",   url: "https://speed.cloudflare.com/__down?bytes=2000000", bytes: 2000000 },
];
// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function stats(arr) {
  if (!arr.length) return null;
  const avg    = arr.reduce((a, b) => a + b, 0) / arr.length;
  const min    = Math.min(...arr);
  const max    = Math.max(...arr);
  const jitter = arr.length > 1
    ? arr.slice(1).reduce((s, v, i) => s + Math.abs(v - arr[i]), 0) / (arr.length - 1)
    : 0;
  return { avg, min, max, jitter, n: arr.length };
}
// ─── Engine A: Gateway LAN Probe ──────────────────────────────────────────────
async function scanGateways(list, onHit) {
  const SCAN_MS = 1200;
  const results = await Promise.allSettled(
    list.map(async ({ ip, hint }) => {
      const t0 = performance.now();
      try {
        await fetch(`http://${ip}/`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(SCAN_MS) });
        const rtt = performance.now() - t0;
        onHit?.({ ip, hint, rtt, alive: true });
        return { ip, hint, rtt, alive: true };
      } catch {
        const rtt = performance.now() - t0;
        if (rtt < SCAN_MS - 80) {
          onHit?.({ ip, hint, rtt, alive: true }); // TCP RST = router có đó
          return { ip, hint, rtt, alive: true };
        }
        return { ip, hint, rtt: null, alive: false };
      }
    })
  );
  return results
    .filter(r => r.status === "fulfilled" && r.value.alive)
    .map(r => r.value)
    .sort((a, b) => a.rtt - b.rtt);
}
async function probeGateway(ip, samples = 12, onSample) {
  const raw = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    try {
      await fetch(`http://${ip}/`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(2000) });
      const rtt = performance.now() - t0;
      raw.push(rtt); onSample?.({ i, rtt, ok: true });
    } catch {
      const rtt = performance.now() - t0;
      if (rtt < 1900) { raw.push(rtt); onSample?.({ i, rtt, ok: true }); }
      else             { onSample?.({ i, rtt: null, ok: false }); }
    }
    if (i < samples - 1) await sleep(350);
  }
  if (!raw.length) return { ok: false, ip };
  const s = stats(raw);
  return { ok: true, ip, ...s, loss: ((samples - raw.length) / samples) * 100, raw };
}
// ─── Engine B: WAN RTT ────────────────────────────────────────────────────────
async function probeWAN(onUpdate) {
  const SAMPLES = 8;
  const allResults = [];
  for (const target of WAN_TARGETS) {
    const raw = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = performance.now();
      try {
        await fetch(`${target.url}&_=${Date.now()}`, {
          mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000),
        });
        raw.push(performance.now() - t0);
      } catch { /* loss */ }
      if (i < SAMPLES - 1) await sleep(200);
    }
    if (raw.length) {
      const s = stats(raw);
      const r = { ...s, id: target.id, label: target.label, loss: ((SAMPLES - raw.length) / SAMPLES) * 100, raw };
      allResults.push(r);
      onUpdate?.(allResults);
    }
  }
  return allResults;
}
// ─── Engine C: Network Info API ───────────────────────────────────────────────
function readNetworkInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return null;
  return {
    type:          c.type          || "unknown",
    effectiveType: c.effectiveType || "unknown",
    downlink:      c.downlink      || null,
    rtt:           c.rtt           || null,
    saveData:      c.saveData      || false,
  };
}
// ─── Engine D: Speed Test ─────────────────────────────────────────────────────
async function probeSpeed(onUpdate) {
  const results = [];
  for (const t of SPEED_TARGETS) {
    try {
      const t0  = performance.now();
      const res = await fetch(t.url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const buf = await res.arrayBuffer();
      const sec = (performance.now() - t0) / 1000;
      const mbps = (buf.byteLength * 8) / (sec * 1e6);
      results.push({ label: t.label, mbps, sec });
      onUpdate?.(results);
    } catch { /* skip */ }
  }
  return results;
}
// ─── Engine E: DNS Timing ─────────────────────────────────────────────────────
async function probeDNS() {
  const domains = ["cloudflare.com", "google.com", "facebook.com"];
  const results = [];
  for (const d of domains) {
    const t0 = performance.now();
    try {
      await fetch(`https://dns.google/resolve?name=${d}&type=A&_=${Date.now()}`, {
        mode: "cors", cache: "no-store", signal: AbortSignal.timeout(3000),
      });
      results.push({ domain: d, ms: performance.now() - t0 });
    } catch { /* skip */ }
  }
  if (!results.length) return null;
  const avg = results.reduce((a, b) => a + b.ms, 0) / results.length;
  return { avg, results };
}
// ─── Engine F: Resource Timing ────────────────────────────────────────────────
function readResourceTiming() {
  const nav = performance.getEntriesByType("navigation")[0];
  if (!nav) return null;
  return {
    dns:  Math.round(nav.domainLookupEnd  - nav.domainLookupStart),
    tcp:  Math.round(nav.connectEnd       - nav.connectStart),
    tls:  nav.secureConnectionStart > 0 ? Math.round(nav.connectEnd - nav.secureConnectionStart) : 0,
    ttfb: Math.round(nav.responseStart    - nav.requestStart),
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-ANALYSIS ENGINE
// So sánh chéo kết quả từ nhiều engine → detect patterns → tạo gợi ý
// ═══════════════════════════════════════════════════════════════════════════════
function crossAnalyze(data) {
  const { lan, wan, netInfo, speed, dns, resTiming } = data;
  const patterns   = []; // pattern đã detect
  const hints      = []; // gợi ý cụ thể
  const dataPoints = []; // data points để hiển thị evidence
  // Các ngưỡng tham chiếu
  const TH = {
    lan: { avg_good: 8, avg_warn: 30, avg_bad: 80, jitter_good: 3, jitter_warn: 10, loss_warn: 2 },
    wan: { avg_good: 80, avg_warn: 180, jitter_warn: 30, loss_warn: 2 },
    speed: { good: 20, warn: 5 },
  };
  const isWiFi   = netInfo?.type === "wifi" || netInfo?.effectiveType !== "4g" && netInfo?.downlink < 100;
  const connType = netInfo?.type === "wifi" ? "wifi" : netInfo?.type === "ethernet" ? "ethernet" : "unknown";
  const lanOk  = lan?.ok;
  const wanRef = wan?.[0]; // Cloudflare làm reference chính
  // ─── Đánh giá LAN ────────────────────────────────────────────────────────
  let lanScore = "unknown"; // good / ok / warn / bad
  if (lanOk) {
    if      (lan.avg < TH.lan.avg_good   && lan.jitter < TH.lan.jitter_good && lan.loss < 1) lanScore = "good";
    else if (lan.avg < TH.lan.avg_warn   && lan.jitter < TH.lan.jitter_warn && lan.loss < TH.lan.loss_warn) lanScore = "ok";
    else if (lan.avg < TH.lan.avg_bad)   lanScore = "warn";
    else                                 lanScore = "bad";
  }
  // ─── Đánh giá WAN ────────────────────────────────────────────────────────
  let wanScore = "unknown";
  if (wanRef) {
    if      (wanRef.avg < TH.wan.avg_good  && wanRef.jitter < TH.wan.jitter_warn && wanRef.loss < 1) wanScore = "good";
    else if (wanRef.avg < TH.wan.avg_warn  && wanRef.loss < TH.wan.loss_warn)                        wanScore = "ok";
    else                                                                                              wanScore = "warn";
  }
  // ══════════════════════════════════════════════════════════════════════════
  // PATTERN DETECTION
  // ══════════════════════════════════════════════════════════════════════════
  // P1: LAN tốt + WAN xấu → nghi ISP hoặc modem, KHÔNG phải mạng nội bộ
  if (["good","ok"].includes(lanScore) && wanScore === "warn") {
    patterns.push({
      id: "LAN_OK_WAN_BAD",
      confidence: "medium",
      summary: "Mạng nội bộ ổn định, vấn đề có thể nằm ở phía ISP hoặc modem",
      evidence: [
        lanOk ? `LAN RTT đến router: ${lan.avg.toFixed(1)}ms (bình thường)` : null,
        wanRef ? `WAN RTT đến Cloudflare: ${wanRef.avg.toFixed(1)}ms (cao)` : null,
      ].filter(Boolean),
    });
    hints.push({
      priority: 1, type: "isp",
      action: "Thử khởi động lại modem (ngắt điện hoàn toàn 60 giây, không phải chỉ bấm nút reset)",
      why: "Modem đôi khi bị treo bộ đệm sau nhiều giờ hoạt động, gây tăng độ trễ WAN mà không ảnh hưởng LAN",
    });
    hints.push({
      priority: 2, type: "isp",
      action: "Kiểm tra xem có phải giờ cao điểm không (18:00–22:00) rồi thử lại lúc sáng sớm",
      why: "Tắc nghẽn tại tổng đài ISP thường xảy ra theo giờ, LAN vẫn ổn nhưng WAN chậm",
    });
    hints.push({
      priority: 3, type: "isp",
      action: "Đổi DNS thủ công sang 1.1.1.1 (Cloudflare) hoặc 8.8.8.8 (Google) trong cài đặt mạng",
      why: "DNS mặc định của ISP đôi khi chậm hơn DNS công cộng",
    });
  }
  // P2: LAN xấu + WAN tương đối tốt → nghi vấn đề vật lý LAN
  if (["warn","bad"].includes(lanScore) && ["good","ok"].includes(wanScore)) {
    const isHighAvg    = lan?.avg >= TH.lan.avg_warn;
    const isHighJitter = lan?.jitter >= TH.lan.jitter_warn;
    const isLoss       = lan?.loss >= TH.lan.loss_warn;
    patterns.push({
      id: "LAN_BAD_WAN_OK",
      confidence: "medium",
      summary: "Có dấu hiệu bất thường trong mạng nội bộ, kết nối ra Internet tương đối bình thường",
      evidence: [
        isHighAvg    ? `RTT đến router cao: ${lan.avg.toFixed(1)}ms` : null,
        isHighJitter ? `Jitter không đều: ${lan.jitter.toFixed(1)}ms` : null,
        isLoss       ? `Mất ${lan.loss.toFixed(0)}% gói tin` : null,
      ].filter(Boolean),
    });
    if (isHighJitter && !isHighAvg) {
      // Jitter cao nhưng avg OK → kết nối không ổn định vật lý
      if (connType === "wifi" || connType === "unknown") {
        hints.push({
          priority: 1, type: "physical",
          action: "Thử di chuyển thiết bị gần router WiFi hơn và test lại",
          why: "Jitter không đều thường là dấu hiệu tín hiệu WiFi không ổn định, không nhất thiết là tốc độ chậm",
        });
        hints.push({
          priority: 2, type: "wifi",
          action: "Thử đổi sang băng tần 5GHz nếu router có hỗ trợ (tìm mạng tên có '_5G' hoặc '_5GHz')",
          why: "Băng tần 2.4GHz dễ bị nhiễu từ lò vi sóng, thiết bị Bluetooth và mạng WiFi hàng xóm",
        });
      }
      if (connType === "ethernet") {
        hints.push({
          priority: 1, type: "physical",
          action: "Kiểm tra đầu bấm RJ45 — thử rút ra cắm lại cả hai đầu dây",
          why: "Jitter không đều trên dây mạng thường do đầu RJ45 tiếp xúc kém, không phải do đứt dây",
        });
      }
    }
    if (isHighAvg) {
      hints.push({
        priority: 1, type: "router",
        action: "Thử khởi động lại router (không phải modem) — ngắt điện 30 giây",
        why: `RTT ${lan.avg.toFixed(0)}ms đến router khá cao (bình thường < 5ms), router có thể đang quá tải`,
      });
      hints.push({
        priority: 2, type: "physical",
        action: "Kiểm tra số thiết bị đang kết nối vào router — tạm thời ngắt bớt thiết bị không dùng",
        why: "Quá nhiều kết nối đồng thời có thể làm router xử lý chậm dù băng thông vẫn đủ",
      });
    }
    if (isLoss) {
      hints.push({
        priority: 1, type: "physical",
        action: "Thử thay dây mạng khác (dây patch cord) từ máy tính đến switch hoặc router",
        why: `Mất ${lan.loss.toFixed(0)}% gói tin trong LAN thường do dây mạng hoặc đầu bấm RJ45 có vấn đề, không phải do router`,
      });
      hints.push({
        priority: 2, type: "physical",
        action: "Thử cắm sang port khác trên switch hoặc router",
        why: "Port switch đôi khi bị lỗi vật lý, cắm sang port khác để loại trừ",
      });
    }
  }
  // P3: Cả LAN lẫn WAN đều xấu → router là điểm chung nghi vấn
  if (["warn","bad"].includes(lanScore) && wanScore === "warn") {
    patterns.push({
      id: "BOTH_BAD",
      confidence: "medium",
      summary: "Cả mạng nội bộ và kết nối Internet đều có dấu hiệu chậm — router có thể là điểm chung cần xem xét",
      evidence: [
        lanOk  ? `LAN RTT: ${lan.avg.toFixed(1)}ms` : "LAN không đo được",
        wanRef ? `WAN RTT: ${wanRef.avg.toFixed(1)}ms` : null,
      ].filter(Boolean),
    });
    hints.push({
      priority: 1, type: "router",
      action: "Khởi động lại router (ngắt điện 30 giây) và modem (ngắt điện 60 giây) — làm lần lượt",
      why: "Khi cả LAN lẫn WAN đều chậm, router là thiết bị dùng chung cho cả hai — khởi động lại thường giải quyết được",
    });
    hints.push({
      priority: 2, type: "router",
      action: "Kiểm tra đèn trạng thái trên router/modem — đèn nhấp nháy bất thường hoặc đỏ là dấu hiệu cần chú ý",
      why: "Trạng thái đèn cho biết router có đang hoạt động ổn định hay không",
    });
  }
  // P4: LAN avg ổn nhưng jitter/loss cao → kết nối vật lý không ổn định
  if (lanOk && lan.avg < TH.lan.avg_warn && (lan.jitter > TH.lan.jitter_warn || lan.loss > TH.lan.loss_warn)) {
    patterns.push({
      id: "LAN_UNSTABLE",
      confidence: "medium",
      summary: "Tốc độ phản hồi trung bình của router còn chấp nhận được, nhưng kết nối không ổn định",
      evidence: [
        `Jitter: ${lan.jitter.toFixed(1)}ms — dao động lớn giữa các lần đo`,
        lan.loss > 0 ? `Mất gói: ${lan.loss.toFixed(0)}%` : null,
      ].filter(Boolean),
    });
    if (connType !== "wifi") {
      hints.push({
        priority: 1, type: "physical",
        action: "Kiểm tra kỹ đầu bấm RJ45 ở cả hai đầu dây — thử bấm chặt hoặc thay đầu RJ45 mới",
        why: "Kết nối dao động không đều (jitter cao) thường là dấu hiệu tiếp xúc vật lý không tốt, không phải đứt hoàn toàn",
      });
      hints.push({
        priority: 2, type: "physical",
        action: "Kiểm tra đường đi của dây mạng — tránh đè vật nặng lên dây, tránh gập góc vuông",
        why: "Dây mạng bị gập hoặc bị ép có thể gây mất kết nối ngắt quãng",
      });
    } else {
      hints.push({
        priority: 1, type: "wifi",
        action: "Thử dùng app 'WiFi Analyzer' (Android) hoặc 'Wireless Diagnostics' (Mac) để xem kênh WiFi đang dùng có bị nhiễu không",
        why: "Kết nối WiFi không ổn định thường do nhiều mạng dùng chung kênh, đặc biệt ở chung cư",
      });
    }
  }
  // P5: Speed thấp nhưng RTT ổn → băng thông bị giới hạn, không phải latency
  if (speed?.length) {
    const bestSpeed = Math.max(...speed.map(s => s.mbps));
    if (bestSpeed < TH.speed.warn && wanScore !== "warn") {
      patterns.push({
        id: "SPEED_LOW_RTT_OK",
        confidence: "low",
        summary: "Tốc độ tải thấp nhưng độ trễ tương đối ổn — có thể liên quan đến giới hạn băng thông hơn là chất lượng kết nối",
        evidence: [`Tốc độ đo được: ${bestSpeed.toFixed(1)} Mbps`],
      });
      hints.push({
        priority: 1, type: "bandwidth",
        action: "Kiểm tra xem có thiết bị nào trong nhà đang tải xuống/upload nhiều không (streaming, backup, torrent)",
        why: "Tốc độ thấp khi độ trễ ổn thường do băng thông bị chia sẻ, không phải do chất lượng đường truyền",
      });
      hints.push({
        priority: 2, type: "bandwidth",
        action: "Thử test lại vào lúc ít người dùng (sáng sớm) để so sánh",
        why: "Tốc độ ISP thường giảm vào giờ cao điểm do nhiều người dùng cùng lúc",
      });
    }
  }
  // P6: WAN jitter cao → kết nối không ổn định ra ngoài
  if (wanRef && wanRef.jitter > TH.wan.jitter_warn) {
    patterns.push({
      id: "WAN_JITTER",
      confidence: "low",
      summary: "Kết nối ra Internet có độ dao động cao — có thể ảnh hưởng đến video call, game online",
      evidence: [`WAN jitter: ${wanRef.jitter.toFixed(1)}ms (${WAN_TARGETS[0].label})`],
    });
    hints.push({
      priority: 2, type: "isp",
      action: "Nếu ảnh hưởng đến video call hoặc game, thử khởi động lại modem trước",
      why: "WAN jitter cao đôi khi giảm sau khi modem reset lại kết nối với ISP",
    });
  }
  // P7: Tất cả đều ổn
  if (lanScore === "good" && ["good","ok"].includes(wanScore) && !patterns.length) {
    patterns.push({
      id: "ALL_OK",
      confidence: "high",
      summary: "Các chỉ số đo được đều trong ngưỡng bình thường",
      evidence: [
        lanOk  ? `LAN RTT: ${lan.avg.toFixed(1)}ms, jitter: ${lan.jitter.toFixed(1)}ms` : null,
        wanRef ? `WAN RTT: ${wanRef.avg.toFixed(1)}ms` : null,
      ].filter(Boolean),
    });
  }
  // ─── Tính health score ────────────────────────────────────────────────────
  let score = 100;
  if (lanScore === "bad")  score -= 35;
  if (lanScore === "warn") score -= 18;
  if (wanScore === "warn") score -= 15;
  if (lanOk && lan.loss > 5)    score -= 15;
  if (lanOk && lan.loss > 0)    score -= 5;
  if (lanOk && lan.jitter > 15) score -= 10;
  if (wanRef?.loss > 5)         score -= 10;
  const patternIds = patterns.map(p => p.id);
  if (patternIds.includes("BOTH_BAD"))     score -= 10;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    grade: score >= 90 ? "Tốt" : score >= 70 ? "Chấp nhận được" : score >= 45 ? "Cần chú ý" : "Có vấn đề",
    gradeColor: score >= 90 ? "#44cc77" : score >= 70 ? "#aacc44" : score >= 45 ? "#ffaa00" : "#ff4444",
    patterns,
    hints: hints.sort((a, b) => a.priority - b.priority),
    connType,
    isWiFi,
    lanScore,
    wanScore,
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
const CONF_COLOR = { high: "#44cc77", medium: "#ffaa00", low: "#4488cc" };
const CONF_LABEL = { high: "Độ tin cậy cao", medium: "Cần xem xét thêm", low: "Gợi ý tham khảo" };
const TYPE_ICON  = { isp: "📡", physical: "🔌", wifi: "📶", router: "🔄", bandwidth: "⬇" };
function MetricBar({ label, value, max, unit, color, note }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2, fontFamily: "monospace" }}>
        <span style={{ color: "#3a5a6a" }}>{label}</span>
        <span style={{ color: value != null ? color : "#1e3040" }}>
          {value != null ? `${Number(value).toFixed(value < 10 ? 1 : 0)} ${unit}` : "—"}
          {note && <span style={{ color: "#2a4050", marginLeft: 6, fontSize: 9 }}>{note}</span>}
        </span>
      </div>
      <div style={{ height: 3, background: "#0c1c28", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
function EngineCard({ title, icon, status, children }) {
  const sc = { idle: "#0d1e2c", running: "#003d6e", done: "#003322", error: "#3a0808", skip: "#0d1e2c" };
  const sl = { idle: "—", running: "●", done: "✓", error: "✗", skip: "skip" };
  const tc = { idle: "#1a3040", running: "#0077cc", done: "#00aa55", error: "#cc3333", skip: "#1a3040" };
  return (
    <div style={{ background: "#060e16", border: `1px solid ${sc[status]}`, borderRadius: 6, padding: "10px 12px", transition: "border-color 0.4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <span style={{ fontSize: 9, color: "#5588a0", letterSpacing: 0.5 }}>{icon} {title}</span>
        <span style={{ fontSize: 8, color: tc[status], letterSpacing: 1 }}>{sl[status]}</span>
      </div>
      {children}
    </div>
  );
}
function Spinner({ active }) {
  const [f, setF] = useState(0);
  useState(() => { if (!active) return; const t = setInterval(() => setF(x => (x+1)%4), 200); return () => clearInterval(t); });
  return active ? <span style={{ color: "#0077cc" }}>{["◐","◓","◑","◒"][f]}</span> : null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function NetDiag() {
  const [phase, setPhase]         = useState("idle");
  const [status, setStatus]       = useState({});
  const [data, setData]           = useState({});
  const [scanHits, setScanHits]   = useState([]);
  const [probeSamples, setPS]     = useState([]);
  const [chart, setChart]         = useState([]);
  const [analysis, setAnalysis]   = useState(null);
  const [openHint, setOpenHint]   = useState(null);
  const [openPat, setOpenPat]     = useState(null);
  const [manualGW, setManualGW]   = useState("");
  const [manualErr, setManualErr] = useState("");
  const [tick, setTick]           = useState(0);
  const [logs, setLogs]           = useState([]);
  const abortRef = useRef(false);
  const timerRef = useRef(null);
  const logRef   = useRef(null); // for auto-scroll
  const addLog = useCallback((msg, level = "info") => {
    const entry = {
      t: new Date().toLocaleTimeString("vi", { hour12: false }),
      msg,
      level, // info | ok | warn | error | debug
    };
    setLogs(l => [...l, entry]);
    // auto-scroll
    setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, 30);
  }, []);
  const setS  = (k, v) => setStatus(s => ({ ...s, [k]: v }));
  const setD  = (k, v) => setData(d => ({ ...d, [k]: v }));
  const busy  = phase === "running";
  const isValidIP = s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s.trim()) &&
    s.trim().split(".").every(n => +n >= 0 && +n <= 255);
  const run = useCallback(async (manualGateway = null) => {
    abortRef.current = false;
    const collected  = {};
    setScanHits([]); setPS([]); setChart([]); setAnalysis(null); setData({});
    setLogs([]);
    setStatus({ A: "idle", B: "running", C: "idle", D: "idle", E: "idle", F: "idle" });
    setPhase("running"); setTick(0);
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    addLog("═══ BẮT ĐẦU PHÂN TÍCH ═══", "info");
    addLog(`Thời điểm: ${new Date().toLocaleString("vi")}`, "debug");
    addLog(`User Agent: ${navigator.userAgent.split(") ")[0].split("(")[1] || "unknown"}`, "debug");
    // ── F: Resource Timing (instant) ─────────────────────────────────────
    const rt = readResourceTiming();
    collected.resTiming = rt; setD("resTiming", rt);
    if (rt) addLog(`[F] Resource Timing — DNS:${rt.dns}ms TCP:${rt.tcp}ms TLS:${rt.tls}ms TTFB:${rt.ttfb}ms`, "debug");
    else    addLog("[F] Resource Timing không khả dụng", "debug");
    // ── C: Network Info (instant) ─────────────────────────────────────────
    setS("C", "running");
    const ni = readNetworkInfo();
    collected.netInfo = ni; setD("netInfo", ni); setS("C", ni ? "done" : "skip");
    if (ni) addLog(`[C] Network Info — type:${ni.type} effectiveType:${ni.effectiveType} downlink:${ni.downlink}Mbps rtt:${ni.rtt}ms`, "debug");
    else    addLog("[C] Network Info API không hỗ trợ (Firefox/Safari)", "warn");
    // ── A: Gateway scan + probe (concurrent with B) ───────────────────────
    setS("A", "running");
    addLog(manualGateway
      ? `[A] Gateway thủ công: ${manualGateway}`
      : `[A] Bắt đầu scan ${GATEWAYS.length} gateway candidates...`, "info");
    const engineA = (async () => {
      let gwIP = null;
      if (manualGateway) {
        gwIP = manualGateway;
      } else {
        const hits = [];
        const found = await scanGateways(GATEWAYS, h => {
          hits.push(h); setScanHits([...hits]);
          addLog(`[A] scan → ${h.ip} phản hồi ${h.rtt.toFixed(0)}ms`, "debug");
        });
        if (!found.length) {
          setS("A", "error");
          addLog("[A] Không tìm thấy gateway nào phản hồi", "error");
          return null;
        }
        gwIP = found[0].ip;
        addLog(`[A] Chọn gateway: ${gwIP} (${found[0].rtt.toFixed(0)}ms, nhanh nhất trong ${found.length} kết quả)`, "ok");
      }
      addLog(`[A] Probe ${gwIP} × 12 mẫu...`, "info");
      const samples = [];
      const res = await probeGateway(gwIP, 12, s => {
        samples.push(s); setPS([...samples]);
        setChart(c => [...c, { t: c.length + 1, lan: s.rtt ? Math.round(s.rtt) : null }]);
        const tag = s.rtt != null ? `${s.rtt.toFixed(1)}ms` : "timeout/loss";
        addLog(`[A]   mẫu ${String(samples.length).padStart(2," ")}: ${tag}`, s.ok ? "debug" : "warn");
      });
      collected.lan = res; setD("lan", res);
      setS("A", res.ok ? "done" : "error");
      if (res.ok)
        addLog(`[A] Kết quả LAN — avg:${res.avg.toFixed(2)}ms min:${res.min.toFixed(2)}ms max:${res.max.toFixed(2)}ms jitter:${res.jitter.toFixed(2)}ms loss:${res.loss.toFixed(0)}%`,
          res.avg < 30 ? "ok" : "warn");
      else
        addLog("[A] Không đo được LAN RTT", "error");
      return res;
    })();
    // ── B: WAN RTT (concurrent with A) ───────────────────────────────────
    addLog("[B] Bắt đầu probe WAN (chạy song song với A)...", "info");
    const engineB = (async () => {
      const wanResults = await probeWAN(r => {
        setD("wan", r);
        const last = r[r.length - 1];
        if (last) addLog(`[B] ${last.label} — avg:${last.avg.toFixed(0)}ms jitter:${last.jitter.toFixed(0)}ms loss:${last.loss.toFixed(0)}%`,
          last.avg < 180 ? "ok" : "warn");
      });
      collected.wan = wanResults; setD("wan", wanResults); setS("B", "done");
      if (wanResults[0])
        setChart(c => c.map((p, i) => i === 0 ? { ...p, wan: Math.round(wanResults[0].avg) } : p));
      return wanResults;
    })();
    await Promise.all([engineA, engineB]);
    if (abortRef.current) {
      addLog("⛔ Người dùng dừng phân tích", "warn");
      clearInterval(timerRef.current); setPhase("idle"); return;
    }
    // ── E: DNS Timing ─────────────────────────────────────────────────────
    setS("E", "running");
    addLog("[E] Đo DNS timing...", "info");
    const dnsRes = await probeDNS();
    collected.dns = dnsRes; setD("dns", dnsRes); setS("E", dnsRes ? "done" : "skip");
    if (dnsRes)
      addLog(`[E] DNS avg: ${dnsRes.avg.toFixed(0)}ms (${dnsRes.results.map(r => `${r.domain}:${r.ms.toFixed(0)}ms`).join(" ")})`,
        dnsRes.avg < 150 ? "ok" : "warn");
    else
      addLog("[E] DNS timing không đo được", "warn");
    // ── D: Speed Test ─────────────────────────────────────────────────────
    setS("D", "running");
    addLog("[D] Bắt đầu speed test...", "info");
    const spdRes = await probeSpeed(r => {
      setD("speed", r);
      const last = r[r.length - 1];
      if (last) addLog(`[D] ${last.label}: ${last.mbps.toFixed(2)} Mbps (${last.sec.toFixed(1)}s)`,
        last.mbps > 5 ? "ok" : "warn");
    });
    collected.speed = spdRes; setD("speed", spdRes); setS("D", spdRes?.length ? "done" : "skip");
    if (!spdRes?.length) addLog("[D] Speed test thất bại", "error");
    // ── Cross-analysis ────────────────────────────────────────────────────
    addLog("═══ CROSS-ANALYSIS ═══", "info");
    clearInterval(timerRef.current);
    const result = crossAnalyze(collected);
    addLog(`[X] LAN score: ${result.lanScore} | WAN score: ${result.wanScore} | connType: ${result.connType}`, "debug");
    result.patterns.forEach(p =>
      addLog(`[X] Pattern: ${p.id} (${p.confidence})`, p.confidence === "high" ? "ok" : "debug")
    );
    addLog(`[X] Health score: ${result.score}/100 — ${result.grade}`,
      result.score >= 70 ? "ok" : result.score >= 45 ? "warn" : "error");
    addLog("═══ HOÀN TẤT ═══", "ok");
    setAnalysis(result);
    setPhase("done");
  }, [addLog]);
  const runManual = () => {
    const ip = manualGW.trim();
    if (!isValidIP(ip)) { setManualErr("IP không hợp lệ. VD: 192.168.1.1"); return; }
    setManualErr("");
    run(ip);
  };
  const ni   = data.netInfo;
  const lan  = data.lan;
  const wan  = data.wan;
  const spd  = data.speed;
  const dns  = data.dns;
  const rt   = data.resTiming;
  const wan0 = wan?.[0];
  return (
    <div style={{
      minHeight: "100vh", background: "#04090f",
      backgroundImage: "radial-gradient(ellipse at 10% 5%, #071420 0%,transparent 50%)",
      color: "#a8c8d8", fontFamily: "'JetBrains Mono','Fira Code',monospace",
      padding: "22px 14px 40px",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.2} }
        * { box-sizing:border-box }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-thumb { background:#1a3040; border-radius:2px }
        details summary { list-style:none }
        details summary::-webkit-details-marker { display:none }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 8, letterSpacing: 4, color: "#1a2d3a", marginBottom: 5 }}>◈ ISP LAN DIAGNOSTIC</div>
        <h1 style={{
          fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: 4,
          background: "linear-gradient(100deg,#0088ff,#00ccaa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>NETPROBE</h1>
        <p style={{ fontSize: 8, color: "#1a3040", margin: "4px 0 0", letterSpacing: 1.5 }}>
          LAN · WAN · THROUGHPUT · CROSS-ANALYSIS
        </p>
      </div>
      {/* Controls */}
      <div style={{
        background: "#050c14", border: "1px solid #0a1c2a",
        borderRadius: 6, padding: "12px 14px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          {!busy ? (
            <button onClick={() => run()} style={BtnStyle("#0055aa","#0088ff")}>
              ⊞ AUTO SCAN + PHÂN TÍCH
            </button>
          ) : (
            <>
              <span style={{ fontSize: 10, color: "#0077cc", letterSpacing: 2, animation: "pulse 1.5s infinite" }}>
                ◉ Đang đo... {tick}s
              </span>
              <button onClick={() => { abortRef.current = true; clearInterval(timerRef.current); setPhase("idle"); }}
                style={BtnStyle("#550000","#ff4444")}>■ DỪNG</button>
            </>
          )}
          {phase === "done" && !busy && (
            <button onClick={() => run()} style={BtnStyle("#004422","#00aa55")}>↺ ĐO LẠI</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "#1e3040" }}>Hoặc nhập gateway:</span>
          <input value={manualGW} onChange={e => { setManualGW(e.target.value); setManualErr(""); }}
            onKeyDown={e => e.key === "Enter" && !busy && runManual()}
            placeholder="192.168.1.1" disabled={busy}
            style={{
              background: "#030810", border: `1px solid ${manualErr ? "#883333" : "#0a1c2a"}`,
              color: "#88bbcc", fontFamily: "inherit", fontSize: 10,
              padding: "4px 9px", borderRadius: 4, width: 130, outline: "none",
            }} />
          <button onClick={runManual} disabled={busy} style={BtnStyle("#003322","#00aa55")}>
            ▶ PROBE
          </button>
          {manualErr && <span style={{ fontSize: 9, color: "#ff4444" }}>{manualErr}</span>}
        </div>
        {/* Gateway list */}
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 8, color: "#1a3040", cursor: "pointer", letterSpacing: 1 }}>
            ▸ Danh sách {GATEWAYS.length} gateway ({scanHits.length > 0 ? `${scanHits.length} phản hồi` : "chưa scan"})
          </summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {GATEWAYS.map(g => {
              const hit = scanHits.find(h => h.ip === g.ip);
              return (
                <button key={g.ip} onClick={() => { setManualGW(g.ip); setManualErr(""); }}
                  title={g.hint}
                  style={{
                    background: hit ? "#062010" : "#050c14",
                    border: `1px solid ${hit ? "#00aa5540" : "#0a1c2a"}`,
                    color: hit ? "#44cc77" : "#2a4050",
                    fontSize: 9, padding: "2px 8px", borderRadius: 3,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {g.ip} {hit ? `(${hit.rtt.toFixed(0)}ms)` : ""}
                </button>
              );
            })}
          </div>
        </details>
      </div>
      {/* Score Banner */}
      {analysis && (
        <div style={{
          background: "#050c14", border: `1px solid ${analysis.gradeColor}25`,
          borderRadius: 7, padding: "14px 16px", marginBottom: 14,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: `0 0 24px ${analysis.gradeColor}10`,
        }}>
          <div>
            <div style={{ fontSize: 7, color: "#1a3040", letterSpacing: 3, marginBottom: 4 }}>HEALTH SCORE</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: analysis.gradeColor, lineHeight: 1 }}>
              {analysis.score}<span style={{ fontSize: 13, color: "#1a3040" }}>/100</span>
            </div>
            <div style={{ fontSize: 10, color: analysis.gradeColor, marginTop: 3, letterSpacing: 2 }}>
              {analysis.grade}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9 }}>
            <div style={{ color: "#1a3040", marginBottom: 4 }}>
              Kết nối: <span style={{ color: analysis.isWiFi ? "#ffaa00" : "#44cc77" }}>
                {analysis.connType === "wifi" ? "WiFi" : analysis.connType === "ethernet" ? "Dây LAN" : "Không xác định"}
              </span>
            </div>
            <div style={{ color: "#1a3040" }}>
              LAN: <span style={{ color: analysis.lanScore === "good" ? "#44cc77" : analysis.lanScore === "ok" ? "#88cc44" : analysis.lanScore === "warn" ? "#ffaa00" : "#ff4444" }}>
                {analysis.lanScore === "good" ? "Tốt" : analysis.lanScore === "ok" ? "Ổn" : analysis.lanScore === "warn" ? "Cần chú ý" : analysis.lanScore === "bad" ? "Có vấn đề" : "—"}
              </span>
            </div>
            <div style={{ color: "#1a3040" }}>
              WAN: <span style={{ color: analysis.wanScore === "good" ? "#44cc77" : analysis.wanScore === "ok" ? "#88cc44" : "#ffaa00" }}>
                {analysis.wanScore === "good" ? "Tốt" : analysis.wanScore === "ok" ? "Ổn" : analysis.wanScore === "warn" ? "Chậm" : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Engine Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {/* A: LAN */}
        <EngineCard title="LAN GATEWAY PROBE" icon="⬡" status={status.A || "idle"}>
          {lan?.ok ? (
            <>
              <div style={{ fontSize: 8, color: "#1a3040", marginBottom: 5 }}>→ {lan.ip}</div>
              <MetricBar label="avg RTT" value={lan.avg} max={100} unit="ms"
                color={lan.avg < 8 ? "#44cc77" : lan.avg < 30 ? "#ffcc44" : "#ff4444"} />
              <MetricBar label="jitter"  value={lan.jitter} max={30} unit="ms"
                color={lan.jitter < 3 ? "#44cc77" : lan.jitter < 10 ? "#ffcc44" : "#ff4444"} />
              <div style={{ display: "flex", gap: 10, fontSize: 8, marginTop: 4 }}>
                <span style={{ color: "#2a4050" }}>min <span style={{ color: "#44cc77" }}>{lan.min.toFixed(0)}ms</span></span>
                <span style={{ color: "#2a4050" }}>max <span style={{ color: "#ffcc44" }}>{lan.max.toFixed(0)}ms</span></span>
                <span style={{ color: "#2a4050" }}>loss <span style={{ color: lan.loss > 0 ? "#ff4444" : "#44cc77" }}>{lan.loss.toFixed(0)}%</span></span>
              </div>
              {/* Mini sparkline */}
              {lan.raw?.length > 2 && (
                <div style={{ marginTop: 6, height: 30 }}>
                  <ResponsiveContainer width="100%" height={30}>
                    <LineChart data={lan.raw.map((v,i) => ({ i, v }))}>
                      <Line type="monotone" dataKey="v" stroke="#0077cc" dot={false} strokeWidth={1} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 9, color: "#1a3040" }}>
              {status.A === "running" ? "Đang scan gateway..." : status.A === "error" ? "Không tìm thấy gateway" : "Chờ..."}
            </div>
          )}
        </EngineCard>
        {/* B: WAN */}
        <EngineCard title="WAN RTT (FETCH)" icon="⟁" status={status.B || "idle"}>
          {wan?.length ? wan.map(w => (
            <MetricBar key={w.id} label={w.label} value={w.avg} max={500} unit="ms"
              color={w.avg < 80 ? "#44cc77" : w.avg < 180 ? "#ffcc44" : "#ff4444"} />
          )) : (
            <div style={{ fontSize: 9, color: "#1a3040" }}>
              {status.B === "running" ? "Probe WAN endpoints..." : "Chờ..."}
            </div>
          )}
          {wan0 && (
            <div style={{ display: "flex", gap: 10, fontSize: 8, marginTop: 4 }}>
              <span style={{ color: "#2a4050" }}>jitter <span style={{ color: "#ffcc44" }}>{wan0.jitter.toFixed(0)}ms</span></span>
              <span style={{ color: "#2a4050" }}>loss <span style={{ color: wan0.loss > 0 ? "#ff4444" : "#44cc77" }}>{wan0.loss.toFixed(0)}%</span></span>
            </div>
          )}
        </EngineCard>
        {/* C: Network Info */}
        <EngineCard title="NETWORK INFO API" icon="◈" status={status.C || "idle"}>
          {ni ? (
            <>
              <MetricBar label="effectiveType" value={{ "slow-2g":1,"2g":2,"3g":3,"4g":4 }[ni.effectiveType]||0}
                max={4} unit={ni.effectiveType} color="#44cc77" />
              <MetricBar label="downlink" value={ni.downlink} max={100} unit="Mbps" color="#0088ff" />
              <MetricBar label="rtt (hint)" value={ni.rtt} max={300} unit="ms" color="#ffcc44" />
              <div style={{ fontSize: 8, color: "#2a4050", marginTop: 3 }}>
                type: <span style={{ color: "#4a7090" }}>{ni.type || "n/a"}</span>
                {ni.saveData && <span style={{ color: "#ffaa00", marginLeft: 6 }}>⬇ Save Data</span>}
              </div>
            </>
          ) : <div style={{ fontSize: 9, color: "#1a3040" }}>Không hỗ trợ (Firefox/Safari)</div>}
        </EngineCard>
        {/* D: Speed */}
        <EngineCard title="THROUGHPUT" icon="⬇" status={status.D || "idle"}>
          {spd?.length ? spd.map(s => (
            <MetricBar key={s.label} label={s.label} value={s.mbps} max={200} unit="Mbps"
              color={s.mbps > 20 ? "#44cc77" : s.mbps > 5 ? "#ffcc44" : "#ff4444"} />
          )) : (
            <div style={{ fontSize: 9, color: "#1a3040" }}>
              {status.D === "running" ? "Đang tải test payload..." : "Chờ..."}
            </div>
          )}
        </EngineCard>
        {/* E: DNS */}
        <EngineCard title="DNS TIMING" icon="◎" status={status.E || "idle"}>
          {dns ? (
            <>
              <MetricBar label="avg DNS lookup" value={dns.avg} max={300} unit="ms"
                color={dns.avg < 50 ? "#44cc77" : dns.avg < 150 ? "#ffcc44" : "#ff4444"} />
              {dns.results.map(r => (
                <div key={r.domain} style={{ display: "flex", justifyContent: "space-between", fontSize: 8, marginBottom: 2 }}>
                  <span style={{ color: "#2a4050" }}>{r.domain}</span>
                  <span style={{ color: "#4a7090" }}>{r.ms.toFixed(0)}ms</span>
                </div>
              ))}
            </>
          ) : <div style={{ fontSize: 9, color: "#1a3040" }}>{status.E === "running" ? "Đo DNS..." : "Chờ..."}</div>}
        </EngineCard>
        {/* F: Resource Timing */}
        <EngineCard title="PAGE LOAD TIMING" icon="⊙" status={rt ? "done" : "idle"}>
          {rt ? (
            <>
              <MetricBar label="DNS" value={rt.dns} max={200} unit="ms" color="#aa44ff" />
              <MetricBar label="TCP" value={rt.tcp} max={200} unit="ms" color="#44aaff" />
              <MetricBar label="TLS" value={rt.tls} max={200} unit="ms" color="#0088ff" />
              <MetricBar label="TTFB" value={rt.ttfb} max={400} unit="ms"
                color={rt.ttfb < 100 ? "#44cc77" : "#ffcc44"} />
            </>
          ) : <div style={{ fontSize: 9, color: "#1a3040" }}>Navigation timing không khả dụng</div>}
        </EngineCard>
      </div>
      {/* RTT Chart */}
      <div style={{ background: "#050c14", border: "1px solid #0a1c2a", borderRadius: 5, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 8, color: "#1a3040", letterSpacing: 2, marginBottom: 6 }}>
          RTT SAMPLES
          <span style={{ marginLeft: 10, color: "#0088ff" }}>● LAN</span>
          {wan0 && <span style={{ marginLeft: 8, color: "#ffaa00" }}>avg WAN {wan0.avg.toFixed(0)}ms</span>}
        </div>
        <ResponsiveContainer width="100%" height={65}>
          <LineChart data={chart.filter(d => d.lan != null)} margin={{ top: 2, right: 4, bottom: 0, left: -22 }}>
            <XAxis dataKey="t" hide />
            <YAxis tick={{ fontSize: 8, fill: "#1a3040", fontFamily: "monospace" }} />
            {wan0 && <Line type="monotone" data={[{ t:0,wan:wan0.avg },{ t:chart.length,wan:wan0.avg }]}
              dataKey="wan" stroke="#ffaa0040" strokeDasharray="3 3" dot={false} strokeWidth={1} />}
            <Line type="monotone" dataKey="lan" stroke="#0088ff" dot={false} strokeWidth={1.5} connectNulls />
            <Tooltip contentStyle={{ background:"#060e16", border:"1px solid #0a2030", fontSize:9, fontFamily:"monospace" }}
              formatter={v => [`${v}ms`]} />
          </LineChart>
        </ResponsiveContainer>
        {probeSamples.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {probeSamples.map((s, i) => (
              <span key={i} style={{
                fontSize: 8, padding: "1px 5px", borderRadius: 2,
                background: !s.ok ? "#1c0606" : "#061810",
                color: !s.ok ? "#ff4444" : "#44cc77",
              }}>
                {s.rtt != null ? `${s.rtt.toFixed(0)}` : "×"}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* ── Analysis Section ── */}
      {analysis && (
        <div>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "#1a2d3a", marginBottom: 10 }}>
            ──── PHÂN TÍCH & GỢI Ý ─────────────────────────────────────
          </div>
          {/* Patterns */}
          {analysis.patterns.map(p => (
            <div key={p.id} onClick={() => setOpenPat(openPat === p.id ? null : p.id)}
              style={{
                background: "#050c14", border: `1px solid ${CONF_COLOR[p.confidence]}20`,
                borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`,
                borderRadius: 5, padding: "10px 12px", marginBottom: 8, cursor: "pointer",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 8, color: CONF_COLOR[p.confidence], letterSpacing: 1, marginRight: 8 }}>
                    {CONF_LABEL[p.confidence].toUpperCase()}
                  </span>
                  <div style={{ fontSize: 10, color: "#88aabb", marginTop: 3, lineHeight: 1.5 }}>{p.summary}</div>
                </div>
                <span style={{ fontSize: 8, color: "#1a3040", marginLeft: 8 }}>{openPat === p.id ? "▲" : "▼"}</span>
              </div>
              {openPat === p.id && p.evidence.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #0a1c2a" }}>
                  <div style={{ fontSize: 8, color: "#1a3040", letterSpacing: 1, marginBottom: 4 }}>DỮ LIỆU CƠ SỞ</div>
                  {p.evidence.map((e, i) => (
                    <div key={i} style={{ fontSize: 9, color: "#3a5a6a", marginBottom: 2 }}>· {e}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {/* Hints */}
          {analysis.hints.length > 0 && (
            <>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "#1a2d3a", marginTop: 14, marginBottom: 8 }}>
                GỢI Ý CÓ THỂ GIÚP CẢI THIỆN
              </div>
              {analysis.hints.map((h, i) => (
                <div key={i} onClick={() => setOpenHint(openHint === i ? null : i)}
                  style={{
                    background: "#050c14", border: "1px solid #0a1c2a",
                    borderRadius: 5, padding: "10px 12px", marginBottom: 7, cursor: "pointer",
                  }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[h.type] || "•"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#88aabb", lineHeight: 1.6 }}>{h.action}</div>
                      {openHint === i && (
                        <div style={{ fontSize: 9, color: "#3a5a6a", marginTop: 6, lineHeight: 1.6,
                          borderTop: "1px solid #0a1c2a", paddingTop: 6 }}>
                          Lý do gợi ý: {h.why}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 8, color: "#1a3040" }}>{openHint === i ? "▲" : "▼"}</span>
                  </div>
                </div>
              ))}
            </>
          )}
          {analysis.hints.length === 0 && analysis.patterns.some(p => p.id === "ALL_OK") && (
            <div style={{ textAlign: "center", padding: "16px", fontSize: 11, color: "#44cc77", letterSpacing: 1 }}>
              ✓ Không có gợi ý nào — các chỉ số đều trong ngưỡng bình thường
            </div>
          )}
          <div style={{ marginTop: 12, padding: "8px 10px", background: "#050c14", border: "1px solid #0a1c2a", borderRadius: 4, fontSize: 8, color: "#1a3040", lineHeight: 1.9 }}>
            <div style={{ color: "#1e3040", marginBottom: 2 }}>ℹ LƯU Ý</div>
            <div>Các gợi ý trên dựa trên dữ liệu đo được và mang tính tham khảo — không phải kết luận chắc chắn</div>
            <div>Đo lại nhiều lần ở các thời điểm khác nhau sẽ cho kết quả chính xác hơn</div>
            <div>Nếu vấn đề vẫn tiếp diễn sau khi đã thử các gợi ý, hãy liên hệ nhà cung cấp dịch vụ</div>
          </div>
        </div>
      )}
      {/* ── CONSOLE LOG ── */}
      <ConsoleLog logs={logs} logRef={logRef} />
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// CONSOLE LOG COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const LOG_STYLE = {
  info:  { color: "#5588aa", prefix: "·" },
  ok:    { color: "#44cc77", prefix: "✓" },
  warn:  { color: "#ffaa00", prefix: "⚠" },
  error: { color: "#ff4444", prefix: "✗" },
  debug: { color: "#334455", prefix: " " },
};
function ConsoleLog({ logs, logRef }) {
  const [open,    setOpen]    = useState(false);
  const [filter,  setFilter]  = useState("all"); // all | info | warn | error | debug
  const [search,  setSearch]  = useState("");
  const [copied,  setCopied]  = useState(false);
  const visible = logs.filter(l => {
    if (filter !== "all" && l.level !== filter) return false;
    if (search && !l.msg.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const copyAll = () => {
    const text = logs.map(l => `[${l.t}] ${LOG_STYLE[l.level]?.prefix} ${l.msg}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  };
  const counts = { warn: 0, error: 0 };
  logs.forEach(l => { if (l.level === "warn") counts.warn++; if (l.level === "error") counts.error++; });
  return (
    <div style={{ marginTop: 20 }}>
      {/* Header bar — always visible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: "#050c14", border: "1px solid #0a1c2a",
          borderRadius: open ? "6px 6px 0 0" : "6px",
          padding: "9px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2 }}>▸ CONSOLE LOG</span>
          <span style={{ fontSize: 9, color: "#1a3040" }}>{logs.length} dòng</span>
          {counts.warn > 0 && (
            <span style={{ fontSize: 8, color: "#ffaa00", border: "1px solid #ffaa0030",
              padding: "1px 5px", borderRadius: 3 }}>{counts.warn} warn</span>
          )}
          {counts.error > 0 && (
            <span style={{ fontSize: 8, color: "#ff4444", border: "1px solid #ff444430",
              padding: "1px 5px", borderRadius: 3 }}>{counts.error} error</span>
          )}
        </div>
        <span style={{ fontSize: 9, color: "#1a3040" }}>{open ? "▲ thu gọn" : "▼ mở rộng"}</span>
      </div>
      {open && (
        <div style={{ background: "#030810", border: "1px solid #0a1c2a", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
          {/* Toolbar */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
            padding: "7px 12px", borderBottom: "1px solid #0a1c2a",
          }}>
            {/* Filter buttons */}
            {["all","ok","info","warn","error","debug"].map(f => (
              <button key={f} onClick={e => { e.stopPropagation(); setFilter(f); }}
                style={{
                  background: filter === f ? "#0a1c2a" : "transparent",
                  border: `1px solid ${filter === f ? "#1a3a50" : "#0a1c2a"}`,
                  color: filter === f
                    ? (LOG_STYLE[f]?.color || "#88aabb")
                    : "#1a3040",
                  fontSize: 8, padding: "2px 7px", borderRadius: 3,
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: 1,
                }}>
                {f}
              </button>
            ))}
            {/* Search */}
            <input
              value={search}
              onChange={e => { e.stopPropagation(); setSearch(e.target.value); }}
              onClick={e => e.stopPropagation()}
              placeholder="tìm kiếm..."
              style={{
                background: "#030810", border: "1px solid #0a1c2a",
                color: "#5588aa", fontFamily: "inherit", fontSize: 9,
                padding: "2px 8px", borderRadius: 3, width: 110, outline: "none",
                marginLeft: "auto",
              }}
            />
            {/* Copy button */}
            <button onClick={e => { e.stopPropagation(); copyAll(); }}
              style={{
                background: "transparent", border: "1px solid #0a1c2a",
                color: copied ? "#44cc77" : "#2a4050",
                fontSize: 8, padding: "2px 8px", borderRadius: 3,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {copied ? "✓ copied" : "⎘ copy"}
            </button>
          </div>
          {/* Log body */}
          <div
            ref={logRef}
            style={{
              maxHeight: 240, overflowY: "auto",
              padding: "8px 12px",
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
            }}
          >
            {visible.length === 0 ? (
              <div style={{ fontSize: 9, color: "#1a2d3a", padding: "8px 0" }}>
                {logs.length === 0 ? "Chưa có log — bấm AUTO SCAN để bắt đầu" : "Không có kết quả khớp với bộ lọc"}
              </div>
            ) : (
              visible.map((l, i) => {
                const s = LOG_STYLE[l.level] || LOG_STYLE.info;
                return (
                  <div key={i} style={{
                    display: "flex", gap: 8, marginBottom: 2,
                    alignItems: "flex-start", lineHeight: 1.5,
                  }}>
                    <span style={{ color: "#122030", fontSize: 9, flexShrink: 0, paddingTop: 1 }}>{l.t}</span>
                    <span style={{ color: s.color, fontSize: 10, flexShrink: 0, paddingTop: 1, width: 10 }}>{s.prefix}</span>
                    <span style={{
                      fontSize: 10, color: s.color,
                      // highlight search term
                      ...(search && l.msg.toLowerCase().includes(search.toLowerCase())
                        ? { background: "#0a2a1a", borderRadius: 2, padding: "0 2px" } : {}),
                    }}>
                      {search
                        ? highlightMatch(l.msg, search)
                        : l.msg}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {/* Footer */}
          <div style={{
            padding: "5px 12px", borderTop: "1px solid #0a1c2a",
            fontSize: 8, color: "#1a2d3a",
            display: "flex", justifyContent: "space-between",
          }}>
            <span>Hiển thị {visible.length}/{logs.length} dòng</span>
            <span>
              {counts.warn + counts.error === 0 && logs.length > 0 && <span style={{ color: "#44cc7760", marginRight: 8 }}>✓ clean</span>}
              levels: ok · info · warn · error · debug
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
function highlightMatch(text, search) {
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: "#1a4a2a", borderRadius: 2 }}>{text.slice(idx, idx + search.length)}</span>
      {text.slice(idx + search.length)}
    </>
  );
}
function BtnStyle(border, text) {
  return {
    background: "transparent", border: `1px solid ${border}`,
    color: text, padding: "7px 16px", fontSize: 9, letterSpacing: 2,
    cursor: "pointer", borderRadius: 4, fontFamily: "inherit",
  };
}
