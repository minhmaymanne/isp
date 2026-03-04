# NETPROBE COMMAND CENTER — Implementation Plan
## speed.ccn.vn • Chơi Công Nghệ

> **Mục tiêu**: Xây dựng web app đo benchmark ISP thực tế cho người dùng Việt Nam. UI phong cách Cyberpunk Command Center. Tất cả dữ liệu phải là KẾT QUẢ THỰC từ measurement engines, KHÔNG dùng mock data.

---

## I. TỔNG QUAN DỰ ÁN

### Sản phẩm
Web app single-page chạy trên browser, đo toàn diện chất lượng mạng ISP:
- 10 measurement engines chạy tuần tự/song song
- Cross-analysis engine phát hiện 12+ patterns
- Scoring system 0-100 điểm
- UI cyberpunk NOC (Network Operations Center) với animations

### Tech Stack
```
Frontend:   React 18+ (Vite) + CSS-in-JS (inline styles, không Tailwind)
Fonts:      Orbitron (display) + IBM Plex Mono (data/body)
Hosting:    Cloudflare Pages
Backend:    Cloudflare Worker (GeoIP proxy)
Storage:    Cloudflare KV (test history, optional Phase 2)
Domain:     speed.ccn.vn → Cloudflare DNS
```

### Tham chiếu thiết kế
- **UI/UX**: File `netprobe-command-center.jsx` — cyberpunk aesthetic, animations, layout
- **Measurement engines**: File `netprobe.jsx` (6 engines) + `isp-v5.jsx` (CF trace, intl targets, buffer bloat, suggestions)
- **Design plan trước đó**: File `netprobe-design-plan.md` — chi tiết kỹ thuật từng engine

---

## II. PROJECT STRUCTURE

```
netprobe/
├── index.html
├── vite.config.js
├── package.json
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.jsx                         # Entry point
│   ├── App.jsx                          # Root component
│   │
│   ├── engines/                         # === CỐT LÕI: Measurement engines ===
│   │   ├── engineA_gateway.js           # LAN Gateway Probe
│   │   ├── engineB_wan.js               # WAN RTT Multi-target
│   │   ├── engineC_netinfo.js           # Navigator.connection API
│   │   ├── engineD_speed.js             # Download + Upload Speed Test
│   │   ├── engineE_dns.js               # DNS Resolution Timing
│   │   ├── engineF_restiming.js         # Resource Timing API
│   │   ├── engineG_cftrace.js           # Cloudflare Trace
│   │   ├── engineH_geoip.js            # GeoIP + ISP Identification
│   │   ├── engineI_intl.js             # International Target Reachability
│   │   ├── engineX_bloat.js            # Buffer Bloat Test
│   │   └── orchestrator.js             # Điều phối chạy engines theo sequence
│   │
│   ├── analysis/                        # === Phân tích & chấm điểm ===
│   │   ├── crossAnalyzer.js             # Pattern detection (12+ rules)
│   │   ├── scorer.js                    # Health score 0-100
│   │   ├── suggestions.js              # Gợi ý khắc phục tiếng Việt
│   │   └── verdicts.js                 # Use-case verdicts (gaming/stream/call)
│   │
│   ├── data/                            # === Databases tĩnh ===
│   │   ├── gateways.js                  # 14 gateway IP candidates
│   │   ├── coloMap.js                   # 30+ Cloudflare PoP mapping
│   │   ├── ispMap.js                    # ISP Việt Nam (Viettel/VNPT/FPT/CMC/Mobi)
│   │   ├── targets.js                   # 12 international targets
│   │   └── thresholds.js               # Tất cả ngưỡng đánh giá
│   │
│   ├── utils/                           # === Utilities ===
│   │   ├── probes.js                    # fetchProbe() + imageProbe()
│   │   ├── stats.js                     # avg, jitter, percentile, trimmed mean
│   │   └── format.js                    # formatMs, formatMbps, grade()
│   │
│   ├── hooks/                           # === React hooks ===
│   │   ├── useBenchmark.js              # Main orchestration hook
│   │   └── useTimer.js                  # Elapsed time tracker
│   │
│   ├── components/                      # === UI Components ===
│   │   ├── canvas/
│   │   │   └── CommandCanvas.jsx        # HexGrid + Particles + Data Rain
│   │   ├── hud/
│   │   │   ├── HudPanel.jsx             # Glassmorphism card với corner brackets
│   │   │   ├── RadarSweep.jsx           # Animated radar + score display
│   │   │   ├── SpeedGauge.jsx           # Circular arc speed gauge
│   │   │   └── Oscilloscope.jsx         # Real-time latency waveform
│   │   ├── layout/
│   │   │   ├── Header.jsx               # Logo + timer + controls
│   │   │   ├── PhaseTimeline.jsx        # 10-phase progress bar
│   │   │   └── Footer.jsx
│   │   ├── cards/
│   │   │   ├── InfoBadges.jsx           # IP, ISP, CF PoP, Location
│   │   │   ├── TraceCard.jsx            # CF Trace details
│   │   │   ├── LatencyCard.jsx          # Oscilloscope + stats
│   │   │   ├── BandwidthCard.jsx        # Download/Upload gauges
│   │   │   ├── DnsCard.jsx              # DNS timing
│   │   │   ├── SecurityCard.jsx         # TLS, KEX, SNI, WARP
│   │   │   ├── ConnectionCard.jsx       # Type, proxy, mobile flags
│   │   │   ├── TargetGrid.jsx           # 12 international targets
│   │   │   └── GatewayCard.jsx          # LAN probe results (nếu available)
│   │   ├── analysis/
│   │   │   ├── VerdictBadges.jsx        # Gaming/Streaming/VideoCall/Cloud
│   │   │   ├── FindingCard.jsx          # Analysis finding với severity
│   │   │   └── AnalysisPanel.jsx        # Container cho findings
│   │   ├── terminal/
│   │   │   ├── BootTerminal.jsx         # Boot sequence animation
│   │   │   └── ConsoleLog.jsx           # Live system console
│   │   └── common/
│   │       ├── Metric.jsx               # Label + value + unit + quality dot
│   │       └── ScanOverlay.jsx          # Scanlines + noise grain
│   │
│   └── styles/
│       └── keyframes.js                 # CSS keyframes export
│
├── workers/
│   └── geoip-proxy.js                  # Cloudflare Worker cho ip-api.com
│
└── wrangler.toml                        # CF Workers config
```

---

## III. MEASUREMENT ENGINES — CHI TIẾT IMPLEMENTATION

> **QUAN TRỌNG**: Đây là phần cốt lõi. Tất cả code đo lường phải trả về dữ liệu THỰC TẾ từ browser người dùng. Copy logic từ prototype, KHÔNG mock.

### Engine G — Cloudflare Trace
**File**: `engines/engineG_cftrace.js`

**Nguồn**: Lấy từ `isp-v5.jsx` hàm `fetchCFTrace()` + `parseCFTrace()`

```javascript
// Fallback chain — thử lần lượt, dùng endpoint đầu tiên thành công
const TRACE_URLS = [
  "https://1.1.1.1/cdn-cgi/trace",
  "https://one.one.one.one/cdn-cgi/trace",
  "https://cloudflare.com/cdn-cgi/trace",
  "https://www.cloudflare.com/cdn-cgi/trace",
];

export async function fetchCFTrace() {
  const start = performance.now();
  for (const url of TRACE_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      const ms = performance.now() - start;
      const data = parseCFTrace(text);
      data._ms = Math.round(ms);
      data._url = url;
      return data;
    } catch (e) { continue; }
  }
  // Tất cả fail → trả về object với _failed flag
  return { _failed: true, _error: "All trace endpoints unreachable" };
}

function parseCFTrace(text) {
  const obj = {};
  text.split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) obj[k.trim()] = v.join("=").trim();
  });
  return obj;
}
```

**Output**: `{ ip, colo, loc, tls, http, warp, sni, kex, gateway, rbi, ts, _ms, _url }`

**Lưu ý sandbox**: Nếu trong iframe/artifact, fetch có thể bị block. Khi deploy trên domain riêng (speed.ccn.vn) sẽ không gặp vấn đề này.

---

### Engine H — GeoIP + ISP Identification
**File**: `engines/engineH_geoip.js`

**Nguồn**: `isp-v5.jsx` hàm `detectNet()` + `netprobe-command-center.jsx` MOCK structure

```javascript
// Primary: ip-api.com qua Cloudflare Worker proxy (bypass CORS + HTTPS)
// Fallback: ipapi.co (HTTPS native, rate limit thấp hơn)
// Fallback 2: ipwho.is

export async function fetchGeoIP(ip) {
  // 1. Try Worker proxy (recommended cho production)
  try {
    const res = await fetch("/api/geoip");  // Worker endpoint
    if (res.ok) return await res.json();
  } catch (e) {}

  // 2. Fallback: ip-api.com trực tiếp (HTTP only, có thể bị block)
  try {
    const fields = "status,country,countryCode,regionName,city,isp,org,as,asname,mobile,proxy,hosting,query,lat,lon,timezone";
    const res = await fetch(`http://ip-api.com/json/${ip || ""}?fields=${fields}`);
    if (res.ok) {
      const d = await res.json();
      if (d.status === "success") return d;
    }
  } catch (e) {}

  // 3. Fallback: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) return await res.json();
  } catch (e) {}

  return { _failed: true };
}
```

**ISP Detection** (file `data/ispMap.js`):
```javascript
export const ISP_DB = [
  { match: ["viettel"], name: "Viettel", color: "#e31937", tier: 1 },
  { match: ["vnpt", "vinaphone"], name: "VNPT", color: "#0066b3", tier: 1 },
  { match: ["fpt"], name: "FPT Telecom", color: "#f37021", tier: 1 },
  { match: ["cmc"], name: "CMC Telecom", color: "#00a651", tier: 2 },
  { match: ["mobifone"], name: "Mobifone", color: "#005baa", tier: 2 },
  { match: ["spt", "saigon"], name: "SPT", color: "#ff6600", tier: 2 },
  { match: ["netnam"], name: "NetNam", color: "#0099cc", tier: 2 },
];

export function detectISP(ispString) {
  const lower = (ispString || "").toLowerCase();
  for (const isp of ISP_DB) {
    if (isp.match.some(m => lower.includes(m))) return isp;
  }
  return { name: ispString || "Unknown", color: "#666", tier: 0 };
}
```

**Output**: `{ isp, org, as, asname, city, regionName, country, countryCode, lat, lon, mobile, proxy, hosting, query }`

---

### Engine B — WAN RTT Multi-target
**File**: `engines/engineB_wan.js`

**Nguồn**: `netprobe.jsx` hàm `probeWAN()` — logic gần như nguyên bản

```javascript
const WAN_TARGETS = [
  { id: "cf1", label: "Cloudflare 1.1.1.1", url: "https://1.1.1.1/cdn-cgi/trace" },
  { id: "cfdns", label: "Cloudflare DNS", url: "https://cloudflare.com/cdn-cgi/trace" },
  { id: "gdns", label: "Google DNS", url: "https://dns.google/resolve?name=test.com&type=A" },
];

// Mỗi target: 8 samples, khoảng cách 200ms, timeout 4000ms
// Trả về: per-target { avg, min, max, jitter, loss, raw }
export async function probeWAN(onUpdate) {
  const results = [];
  for (const target of WAN_TARGETS) {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      try {
        const t0 = performance.now();
        await fetch(target.url, { mode: "no-cors", cache: "no-store",
          signal: AbortSignal.timeout(4000) });
        samples.push(performance.now() - t0);
      } catch { samples.push(null); }
      await sleep(200);
    }
    const valid = samples.filter(s => s !== null);
    const result = {
      ...target,
      ...computeStats(valid),
      loss: ((samples.length - valid.length) / samples.length * 100).toFixed(1),
      raw: samples,
    };
    results.push(result);
    onUpdate?.(result);
  }
  return results;
}
```

**Output**: `[{ id, label, avg, min, max, jitter, loss, raw }]`

---

### Engine D — Speed Test (Download + Upload)
**File**: `engines/engineD_speed.js`

**Nguồn**: `netprobe.jsx` hàm `probeSpeed()` + `netprobe-command-center.jsx` measurement logic

```javascript
const DL_SIZES = [100000, 500000, 1000000, 2000000, 5000000, 10000000]; // bytes
const UL_SIZES = [100000, 500000, 1000000, 2000000];

export async function measureDownload(onProgress) {
  const samples = [];
  for (const size of DL_SIZES) {
    const iterations = size <= 500000 ? 3 : 2;
    for (let i = 0; i < iterations; i++) {
      try {
        const t0 = performance.now();
        const res = await fetch(
          `https://speed.cloudflare.com/__down?bytes=${size}`,
          { cache: "no-store" }
        );
        const buf = await res.arrayBuffer();
        const elapsed = performance.now() - t0;
        if (elapsed > 40) { // Bỏ samples quá nhanh (cached)
          const mbps = (buf.byteLength * 8) / (elapsed / 1000) / 1e6;
          samples.push(mbps);
        }
      } catch {}
    }
    onProgress?.({
      phase: "download",
      progress: DL_SIZES.indexOf(size) / DL_SIZES.length,
      currentSamples: samples.length,
    });
  }
  return calculateSpeedResult(samples);
}

export async function measureUpload(onProgress) {
  const samples = [];
  for (const size of UL_SIZES) {
    const iterations = size <= 500000 ? 3 : 2;
    for (let i = 0; i < iterations; i++) {
      try {
        const blob = new Blob([new ArrayBuffer(size)]);
        const t0 = performance.now();
        await fetch("https://speed.cloudflare.com/__up", {
          method: "POST", body: blob, cache: "no-store",
        });
        const elapsed = performance.now() - t0;
        if (elapsed > 40) {
          const mbps = (size * 8) / (elapsed / 1000) / 1e6;
          samples.push(mbps);
        }
      } catch {}
    }
    onProgress?.({
      phase: "upload",
      progress: UL_SIZES.indexOf(size) / UL_SIZES.length,
      currentSamples: samples.length,
    });
  }
  return calculateSpeedResult(samples);
}

function calculateSpeedResult(samples) {
  if (!samples.length) return { mbps: 0, p90: 0, samples: 0 };
  samples.sort((a, b) => a - b);
  const p90idx = Math.floor(samples.length * 0.9);
  const topHalf = samples.slice(Math.floor(samples.length / 2));
  const avg = topHalf.reduce((a, b) => a + b, 0) / topHalf.length;
  return {
    mbps: +avg.toFixed(1),
    p90: +samples[p90idx]?.toFixed(1) || avg.toFixed(1),
    samples: samples.length,
  };
}
```

**Output**: `{ mbps, p90, samples }`

---

### Engine Latency — Latency Oscilloscope
**File**: Tích hợp trong `engineB_wan.js` hoặc riêng

**Nguồn**: `netprobe-command-center.jsx` hàm `measureLatency()`

```javascript
// 24 samples @ 60ms intervals → Cloudflare speed endpoint
// Live callback cho oscilloscope waveform
export async function measureLatency(onSample) {
  const samples = [];
  for (let i = 0; i < 24; i++) {
    try {
      const t0 = performance.now();
      await fetch("https://speed.cloudflare.com/__down?bytes=0", {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      const ms = performance.now() - t0;
      samples.push(ms);
      onSample?.(ms, i); // Live update cho oscilloscope
    } catch { samples.push(null); }
    await sleep(60);
  }

  const valid = samples.filter(s => s !== null);
  // Trim top 2 và bottom 2
  valid.sort((a, b) => a - b);
  const trimmed = valid.slice(2, -2);

  return {
    avg: +mean(trimmed).toFixed(1),
    jitter: +jitter(trimmed).toFixed(1),
    min: +Math.min(...valid).toFixed(1),
    max: +Math.max(...valid).toFixed(1),
    p50: +percentile(valid, 50).toFixed(1),
    p90: +percentile(valid, 90).toFixed(1),
    raw: valid.map(v => +v.toFixed(1)),
  };
}
```

**Output**: `{ avg, jitter, min, max, p50, p90, raw[] }`

---

### Engine I — International Target Reachability
**File**: `engines/engineI_intl.js`

**Nguồn**: `isp-v5.jsx` hàm `measureTarget()` + `fetchProbe()` + `imageProbe()`

```javascript
// 12 targets × 5 samples mỗi target
// Dual probe: fetchProbe (ưu tiên) → imageProbe (fallback)

import { TARGETS } from "../data/targets.js";
import { fetchProbe, imageProbe } from "../utils/probes.js";

export async function probeInternationalTargets(onTargetDone) {
  const results = {};
  for (const target of TARGETS) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      let ms = -1;
      // Try fetch probe first
      if (target.cors) {
        ms = await fetchProbe(target.url, 7000);
      }
      // Fallback to image probe
      if (ms <= 0) {
        ms = await imageProbe(target.url, 6000);
      }
      if (ms > 0) samples.push(ms);
      await sleep(100);
    }
    const valid = samples.filter(s => s > 0);
    results[target.id] = {
      avg: valid.length ? +mean(valid).toFixed(0) : null,
      jitter: valid.length > 1 ? +jitter(valid).toFixed(0) : 0,
      loss: +(((5 - valid.length) / 5) * 100).toFixed(0),
      min: valid.length ? +Math.min(...valid).toFixed(0) : null,
      max: valid.length ? +Math.max(...valid).toFixed(0) : null,
      samples: valid,
    };
    onTargetDone?.(target.id, results[target.id]);
  }
  return results;
}
```

**Probe utilities** (file `utils/probes.js`):
```javascript
// Fetch probe — HEAD request, no-cors mode
export async function fetchProbe(url, timeout = 7000) {
  try {
    const t0 = performance.now();
    await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    return performance.now() - t0;
  } catch { return -1; }
}

// Image probe — Image constructor hack (works even on CORS error)
export async function imageProbe(url, timeout = 6000) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(-1); }, timeout);
    const done = () => {
      clearTimeout(timer);
      resolve(performance.now() - t0);
    };
    // Cả onload VÀ onerror đều cho timing hợp lệ
    img.onload = done;
    img.onerror = done;
    img.src = url + (url.includes("?") ? "&" : "?")
      + "_t=" + Date.now() + Math.random();
  });
}
```

**Targets database** (file `data/targets.js`):
```javascript
export const TARGETS = [
  { id: "cf", name: "Cloudflare", url: "https://cloudflare.com/favicon.ico",
    cors: false, icon: "☁️", cat: "CDN", region: "HAN", crit: true },
  { id: "google", name: "Google", url: "https://www.google.com/favicon.ico",
    cors: false, icon: "🔍", cat: "Search", region: "SIN", crit: true },
  { id: "fb", name: "Facebook", url: "https://www.facebook.com/favicon.ico",
    cors: false, icon: "📘", cat: "Social", region: "HKG", crit: true },
  { id: "yt", name: "YouTube", url: "https://www.youtube.com/favicon.ico",
    cors: false, icon: "▶️", cat: "Stream", region: "SIN", crit: true },
  { id: "aws", name: "AWS", url: "https://aws.amazon.com/favicon.ico",
    cors: false, icon: "🟧", cat: "Cloud", region: "SIN", crit: true },
  { id: "shopee", name: "Shopee", url: "https://shopee.vn/favicon.ico",
    cors: false, icon: "🛒", cat: "Commerce", region: "SGN", crit: true },
  { id: "gh", name: "GitHub", url: "https://github.com/favicon.ico",
    cors: false, icon: "🐙", cat: "Dev", region: "NRT" },
  { id: "tt", name: "TikTok", url: "https://www.tiktok.com/favicon.ico",
    cors: false, icon: "🎵", cat: "Social", region: "SIN" },
  { id: "wiki", name: "Wikipedia", url: "https://en.wikipedia.org/favicon.ico",
    cors: false, icon: "📚", cat: "Info", region: "SIN" },
  { id: "lazada", name: "Lazada", url: "https://www.lazada.vn/favicon.ico",
    cors: false, icon: "🛍️", cat: "Commerce", region: "SIN" },
  { id: "gcloud", name: "GCP", url: "https://cloud.google.com/favicon.ico",
    cors: false, icon: "☁️", cat: "Cloud", region: "SIN" },
  { id: "steam", name: "Steam", url: "https://store.steampowered.com/favicon.ico",
    cors: false, icon: "🎮", cat: "Gaming", region: "NRT" },
];
```

---

### Engine A — LAN Gateway Probe
**File**: `engines/engineA_gateway.js`

**Nguồn**: `netprobe.jsx` hàm `scanGateways()` + `probeGateway()`

```javascript
import { GATEWAYS } from "../data/gateways.js";

// Scan 14 gateway candidates song song, tìm gateway sống
export async function scanGateways(onHit) {
  const results = await Promise.allSettled(
    GATEWAYS.map(async gw => {
      try {
        const t0 = performance.now();
        await fetch(`http://${gw.ip}/`, {
          mode: "no-cors", cache: "no-store",
          signal: AbortSignal.timeout(1200),
        });
        const ms = performance.now() - t0;
        // Nếu respond < timeout - 80ms → router tồn tại
        if (ms < 1120) {
          onHit?.({ ip: gw.ip, ms, hint: gw.hint });
          return { ip: gw.ip, ms, hint: gw.hint };
        }
      } catch {}
      return null;
    })
  );
  const alive = results
    .map(r => r.status === "fulfilled" ? r.value : null)
    .filter(Boolean)
    .sort((a, b) => a.ms - b.ms);
  return alive[0] || null; // Gateway nhanh nhất
}

// Probe gateway đã tìm được — 12 samples
export async function probeGateway(ip, samples = 12, onSample) {
  const raw = [];
  for (let i = 0; i < samples; i++) {
    try {
      const t0 = performance.now();
      await fetch(`http://${ip}/`, {
        mode: "no-cors", cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      const ms = performance.now() - t0;
      raw.push(ms);
      onSample?.(ms, i);
    } catch { raw.push(null); }
    await sleep(350);
  }
  const valid = raw.filter(s => s !== null);
  return {
    ip,
    ...computeStats(valid),
    loss: +(((raw.length - valid.length) / raw.length) * 100).toFixed(1),
    raw,
  };
}
```

**Gateway database** (file `data/gateways.js`):
```javascript
export const GATEWAYS = [
  { ip: "192.168.100.1", hint: "Modem DOCSIS (VNPT/Viettel/FPT)" },
  { ip: "192.168.1.1", hint: "Viettel / TP-Link / ASUS" },
  { ip: "192.168.0.1", hint: "VNPT / D-Link / Linksys" },
  { ip: "192.168.1.254", hint: "Modem ADSL/FTTH" },
  { ip: "10.0.0.1", hint: "Viettel (modem mới)" },
  { ip: "10.0.0.138", hint: "Viettel Huawei EchoLife" },
  { ip: "192.168.2.1", hint: "VNPT / Apple Airport" },
  { ip: "192.168.10.1", hint: "FPT Telecom" },
  { ip: "192.168.8.1", hint: "Huawei 4G router" },
  { ip: "192.168.3.1", hint: "Totolink / ZTE" },
  { ip: "192.168.43.1", hint: "Hotspot Android" },
  { ip: "172.20.10.1", hint: "Hotspot iPhone/iPad" },
  { ip: "192.168.88.1", hint: "MikroTik" },
  { ip: "172.16.0.1", hint: "Corporate / VPN" },
];
```

**Lưu ý**: Gateway probe gọi `http://` (không phải https), chỉ hoạt động khi page served qua HTTP hoặc trên localhost. Trên HTTPS production, mixed content sẽ bị block ở hầu hết browser. **Giải pháp**: Đặt gateway probe là optional, hiển thị message "LAN probe requires HTTP context" nếu bị block, hoặc bỏ qua engine này trên HTTPS.

---

### Engine X — Buffer Bloat Test
**File**: `engines/engineX_bloat.js`

**Nguồn**: `isp-v5.jsx` hàm `bufferBloatTest()`

```javascript
// Phase 1: Đo gateway latency khi idle (5 lần)
// Phase 2: Tạo tải (6 parallel downloads) + đo gateway latency (5 lần)
// So sánh: bloatRatio = loadAvg / idleAvg

export async function bufferBloatTest(gatewayIp) {
  if (!gatewayIp) return { _skipped: true, reason: "No gateway detected" };

  // Phase 1: Idle baseline
  const idle = [];
  for (let i = 0; i < 5; i++) {
    const ms = await imageProbe(`http://${gatewayIp}/`, 2000);
    if (ms > 0) idle.push(ms);
    await sleep(200);
  }
  const idleAvg = mean(idle);

  // Phase 2: Under load
  const loadProbes = [];
  // Tạo tải bằng 6 parallel downloads
  const loadGen = Array.from({ length: 6 }, () =>
    fetch(`https://speed.cloudflare.com/__down?bytes=524288`, { cache: "no-store" })
      .then(r => r.arrayBuffer())
      .catch(() => {})
  );

  // Đo gateway latency ĐỒNG THỜI với tải
  for (let i = 0; i < 5; i++) {
    const ms = await imageProbe(`http://${gatewayIp}/`, 3000);
    if (ms > 0) loadProbes.push(ms);
    await sleep(300);
  }
  await Promise.allSettled(loadGen); // Đợi load xong

  const loadAvg = mean(loadProbes);
  const bloatRatio = idleAvg > 0 ? +(loadAvg / idleAvg).toFixed(2) : null;

  return { idleAvg: +idleAvg.toFixed(1), loadAvg: +loadAvg.toFixed(1), bloatRatio };
}
```

**Lưu ý**: Buffer bloat test cần gateway IP từ Engine A. Nếu Engine A skip (HTTPS context), Engine X cũng skip.

---

### Engine E — DNS Timing
**File**: `engines/engineE_dns.js`

**Nguồn**: `netprobe.jsx` hàm `probeDNS()`

```javascript
const DNS_DOMAINS = ["cloudflare.com", "google.com", "facebook.com"];

export async function probeDNS() {
  const results = [];
  for (const domain of DNS_DOMAINS) {
    try {
      const t0 = performance.now();
      await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
        cache: "no-store",
      });
      results.push({ domain, ms: +(performance.now() - t0).toFixed(0) });
    } catch {
      results.push({ domain, ms: null });
    }
  }
  const valid = results.filter(r => r.ms !== null);
  return {
    avg: valid.length ? +mean(valid.map(r => r.ms)).toFixed(0) : null,
    results,
  };
}
```

---

### Engine C — Network Info API
**File**: `engines/engineC_netinfo.js`

**Nguồn**: `netprobe.jsx` hàm `readNetworkInfo()`

```javascript
export function readNetworkInfo() {
  const conn = navigator.connection
    || navigator.mozConnection
    || navigator.webkitConnection;
  if (!conn) return { _unsupported: true };
  return {
    type: conn.type || "unknown",           // wifi, ethernet, cellular
    effectiveType: conn.effectiveType,       // 4g, 3g, 2g
    downlink: conn.downlink,                 // estimated Mbps
    downlinkMax: conn.downlinkMax,
    rtt: conn.rtt,                           // estimated RTT ms
    saveData: conn.saveData,
  };
}
```

---

### Engine F — Resource Timing
**File**: `engines/engineF_restiming.js`

**Nguồn**: `netprobe.jsx` hàm `readResourceTiming()`

```javascript
export function readResourceTiming() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  if (!nav) return { _unsupported: true };
  return {
    dns: +(nav.domainLookupEnd - nav.domainLookupStart).toFixed(1),
    tcp: +(nav.connectEnd - nav.connectStart).toFixed(1),
    tls: nav.secureConnectionStart > 0
      ? +(nav.connectEnd - nav.secureConnectionStart).toFixed(1) : 0,
    ttfb: +(nav.responseStart - nav.requestStart).toFixed(1),
  };
}
```

---

## IV. ORCHESTRATOR — EXECUTION FLOW

**File**: `engines/orchestrator.js`

```javascript
export async function runBenchmark(callbacks) {
  const { onPhase, onLog, onData, onProgress, onComplete, signal } = callbacks;
  const data = {};

  // ═══ Phase 1: Instant APIs (parallel) ═══
  onPhase("trace"); onLog("Acquiring Cloudflare edge trace...", "net");
  const [trace, netInfo, resTiming] = await Promise.all([
    engineG.fetchCFTrace(),
    engineC.readNetworkInfo(),
    engineF.readResourceTiming(),
  ]);
  data.trace = trace; data.netInfo = netInfo; data.resTiming = resTiming;
  onData("trace", trace);
  onLog(`CF PoP: ${trace.colo} — ${trace._ms}ms`, "ok");

  // ═══ Phase 2: GeoIP (needs IP from trace) ═══
  onPhase("geo"); onLog("Resolving geolocation...", "net");
  data.geo = await engineH.fetchGeoIP(trace.ip);
  onData("geo", data.geo);
  onLog(`ISP: ${data.geo.isp} (${data.geo.as})`, "ok");

  // ═══ Phase 3: Latency oscilloscope ═══
  onPhase("latency"); onLog("Latency oscilloscope — 24 samples...", "net");
  data.latency = await measureLatency((ms, i) => {
    onData("latencySample", { ms, index: i });
    onProgress((i + 1) / 24 * 15 + 15); // 15-30%
  });
  onData("latency", data.latency);
  onLog(`Latency: avg=${data.latency.avg}ms jitter=${data.latency.jitter}ms`, "ok");

  // ═══ Phase 4: Download ═══
  onPhase("download"); onLog("Download bandwidth test...", "net");
  data.download = await engineD.measureDownload(p => {
    onProgress(p.progress * 20 + 35); // 35-55%
  });
  onData("download", data.download);
  onLog(`Download: ${data.download.mbps} Mbps`, "ok");

  // ═══ Phase 5: Upload ═══
  onPhase("upload"); onLog("Upload bandwidth test...", "net");
  data.upload = await engineD.measureUpload(p => {
    onProgress(p.progress * 12 + 58); // 58-70%
  });
  onData("upload", data.upload);
  onLog(`Upload: ${data.upload.mbps} Mbps`, "ok");

  // ═══ Phase 6: DNS ═══
  onPhase("dns"); onLog("DNS resolution timing...", "net");
  data.dns = await engineE.probeDNS();
  onData("dns", data.dns);

  // ═══ Phase 7: International Targets ═══
  onPhase("targets"); onLog(`Scanning ${TARGETS.length} targets...`, "net");
  data.targets = await engineI.probeInternationalTargets((id, result) => {
    onData("targetDone", { id, result });
    onLog(`${id}: ${result.avg}ms`, "ok");
  });
  onData("targets", data.targets);

  // ═══ Phase 8: Gateway + Buffer Bloat (optional, may skip on HTTPS) ═══
  onPhase("gateway"); onLog("Gateway probe...", "net");
  try {
    const gw = await engineA.scanGateways();
    if (gw) {
      data.gateway = await engineA.probeGateway(gw.ip);
      onData("gateway", data.gateway);
      // Buffer bloat
      data.bloat = await engineX.bufferBloatTest(gw.ip);
      onData("bloat", data.bloat);
    } else {
      onLog("No gateway detected (HTTPS context)", "warn");
    }
  } catch {
    onLog("Gateway probe skipped (mixed content block)", "warn");
  }

  // ═══ Phase 9: Cross-Analysis ═══
  onPhase("analysis"); onLog("Cross-analysis engine...", "sys");
  data.analysis = crossAnalyzer.analyze(data);
  data.suggestions = suggestions.generate(data);
  data.verdicts = verdicts.compute(data);
  onData("analysis", { analysis: data.analysis, suggestions: data.suggestions });

  // ═══ Phase 10: Score ═══
  onPhase("score"); onLog("Computing score...", "sys");
  data.score = scorer.calculate(data);
  onData("score", data.score);
  onLog(`Score: ${data.score.value}/100 — ${data.score.grade}`, "ok");

  onComplete(data);
  return data;
}
```

---

## V. CROSS-ANALYSIS ENGINE

**File**: `analysis/crossAnalyzer.js`

**Nguồn**: Merge từ `netprobe.jsx` hàm `crossAnalyze()` + `isp-v5.jsx` hàm `generateSuggestions()`

### Patterns phát hiện (12 rules)

| ID | Condition | Severity | Mô tả tiếng Việt |
|----|-----------|----------|-------------------|
| `ROUTING_OPTIMAL` | colo = HAN/SGN cho user VN | good | Routing tối ưu qua PoP Việt Nam |
| `ROUTING_SUBOPTIMAL` | colo ≠ HAN/SGN cho user VN | warn | ISP routing qua nước thứ ba |
| `SNI_PLAINTEXT` | sni = plaintext | warn | ISP thấy được domain truy cập |
| `POST_QUANTUM` | kex chứa "MLKEM" | good | Kết nối bảo vệ post-quantum |
| `HTTP_LEGACY` | http = http/1.1 | warn | Chưa dùng HTTP/2 hoặc QUIC |
| `WARP_ACTIVE` | warp = on/plus | good | WARP đang bảo vệ traffic |
| `LAN_ISSUE` | gateway avg > 30ms hoặc loss > 2% | warn | Vấn đề mạng nội bộ |
| `BUFFER_BLOAT` | bloatRatio > 2 | warn | Router buffer quá lớn |
| `HIGH_JITTER` | latency jitter > 15ms | warn | Kết nối không ổn định |
| `LOW_BANDWIDTH` | download < 25 Mbps | warn | Bandwidth thấp |
| `INTL_THROTTLE` | >40% targets avg > 200ms | warn | ISP có thể throttle quốc tế |
| `EXCELLENT` | score ≥ 80 + latency ≤ 40 + dl ≥ 50 | good | Kết nối xuất sắc |

### Output mỗi finding
```javascript
{
  id: "ROUTING_OPTIMAL",
  icon: "✅",
  severity: "good",          // good | info | warn | error
  title: "Routing tối ưu — HAN PoP",
  desc: "Traffic kết nối trực tiếp tới Cloudflare Hà Nội. Tuyến ngắn nhất cho user miền Bắc Việt Nam.",
}
```

---

## VI. SCORING SYSTEM

**File**: `analysis/scorer.js`

```javascript
export function calculateScore(data) {
  let score = 0;

  // Download: 25% weight
  const dl = data.download?.mbps || 0;
  const dlScore = dl >= 200 ? 100 : dl >= 100 ? 90 : dl >= 50 ? 75
    : dl >= 25 ? 60 : dl >= 10 ? 45 : 20;
  score += dlScore * 0.25;

  // Upload: 15% weight
  const ul = data.upload?.mbps || 0;
  const ulScore = ul >= 100 ? 100 : ul >= 50 ? 90 : ul >= 25 ? 75
    : ul >= 10 ? 60 : 30;
  score += ulScore * 0.15;

  // Latency: 28% weight
  const lat = data.latency?.avg || 999;
  const latScore = lat <= 15 ? 100 : lat <= 25 ? 90 : lat <= 40 ? 80
    : lat <= 60 ? 65 : lat <= 100 ? 50 : lat <= 150 ? 35 : 15;
  score += latScore * 0.28;

  // Jitter: 12% weight
  const jit = data.latency?.jitter || 999;
  const jitScore = jit <= 3 ? 100 : jit <= 8 ? 85 : jit <= 15 ? 65
    : jit <= 25 ? 45 : 20;
  score += jitScore * 0.12;

  // International reachability: 20% weight
  const targets = data.targets || {};
  const total = Object.keys(targets).length || 1;
  const reachable = Object.values(targets).filter(t => t.avg > 0).length;
  score += (reachable / total * 100) * 0.20;

  const value = Math.round(score);
  return { value, ...getGrade(value) };
}

function getGrade(score) {
  if (score >= 92) return { grade: "S+", label: "Xuất sắc", color: "#00ffd5" };
  if (score >= 80) return { grade: "A", label: "Tốt", color: "#00e676" };
  if (score >= 65) return { grade: "B", label: "Khá", color: "#c6ff00" };
  if (score >= 50) return { grade: "C", label: "Trung bình", color: "#ffd600" };
  if (score >= 35) return { grade: "D", label: "Kém", color: "#ff9100" };
  return { grade: "F", label: "Rất kém", color: "#ff1744" };
}
```

---

## VII. USE-CASE VERDICTS

**File**: `analysis/verdicts.js`

```javascript
export function computeVerdicts(data) {
  const dl = data.download?.mbps || 0;
  const ul = data.upload?.mbps || 0;
  const lat = data.latency?.avg || 999;
  const jit = data.latency?.jitter || 999;

  return {
    streaming: {
      ok: dl >= 25 && lat <= 100,
      label: "STREAMING",
      icon: "🎬",
      detail: dl >= 50 ? "4K Ultra HD" : dl >= 25 ? "1080p HD" : "SD only",
    },
    gaming: {
      ok: lat <= 50 && jit <= 15,
      label: "GAMING",
      icon: "🎮",
      detail: lat <= 30 ? "Competitive Ready" : lat <= 50 ? "Casual OK" : "High Lag",
    },
    videoCall: {
      ok: dl >= 5 && ul >= 3 && lat <= 150,
      label: "VIDEO CALL",
      icon: "📹",
      detail: ul >= 10 ? "HD Quality" : "SD Quality",
    },
    cloud: {
      ok: ul >= 10 && dl >= 25,
      label: "CLOUD",
      icon: "☁️",
      detail: ul >= 50 ? "Fast Sync" : "Standard Sync",
    },
  };
}
```

---

## VIII. UI COMPONENTS — DESIGN SPEC

### Visual Theme (copy từ prototype)
```
Background:      #010610 (deep space)
Text primary:    #f0f8ff (bright white-blue)
Text secondary:  rgba(255,255,255,.45) → .65
Accent cyan:     #00ffd5
Accent teal:     #00b4d8
Accent purple:   #7c4dff
Success:         #00e676
Warning:         #ffd600
Error:           #ff1744

Font display:    Orbitron (headers, scores, labels)
Font mono:       IBM Plex Mono (data, body text)

Cards:           rgba(4,10,20,.72) + backdrop-filter blur(12px)
                 HUD corner brackets (10px L-shaped borders)
                 Status LED dots (pulsing when active)
```

### Key Components (copy logic từ `netprobe-command-center.jsx`)

1. **CommandCanvas** — Full-screen canvas: hex grid, particle network, data rain (katakana)
2. **RadarSweep** — SVG radar với sweep beam, concentric rings, score arc, blip targets
3. **SpeedGauge** — Circular arc gauge, tick marks, animated needle
4. **Oscilloscope** — SVG polyline waveform, gradient fill, live scanning bar
5. **HudPanel** — Corner brackets, status LED, title bar, glow effect
6. **BootTerminal** — Typewriter effect, 15 boot lines, cursor blink
7. **PhaseTimeline** — 10-segment progress bar, sequential activation
8. **FindingCard** — Left severity bar, icon, title, description tiếng Việt
9. **TargetGrid** — Grid cards per target, scan animation, color-coded latency
10. **VerdictBadge** — OK/WARN state, icon, label, detail text
11. **ConsoleLog** — Timestamped log entries, color by level, auto-scroll

### Mobile Responsive
```css
@media (max-width: 768px) {
  /* Grid 12 cột → 1 cột dọc */
  .np-grid { grid-template-columns: 1fr; }
  .np-c3, .np-c4, .np-c6, .np-c12 { grid-column: span 1; }
  .np-findings { grid-template-columns: 1fr; }
  .np-targets-grid { grid-template-columns: repeat(2, 1fr); }
}
```

### Font Size Guidelines (Vietnamese readability)
- Finding card title: 13px, color: severity color
- Finding card description: 12px, color: rgba(255,255,255,.65)
- Metric label: 9-11px, color: rgba(255,255,255,.45)
- Metric value: 12-14px, color: #f0f8ff, font: Orbitron
- Target name: 10px, color: rgba(255,255,255,.6)
- Console log: 10px, line-height: 2

---

## IX. CLOUDFLARE WORKER — GEOIP PROXY

**File**: `workers/geoip-proxy.js`

```javascript
export default {
  async fetch(request, env) {
    // Lấy IP client từ Cloudflare header
    const clientIP = request.headers.get("CF-Connecting-IP");
    const fields = "status,country,countryCode,regionName,city,isp,org,as,asname,mobile,proxy,hosting,query,lat,lon,timezone";
    const url = `http://ip-api.com/json/${clientIP}?fields=${fields}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "s-maxage=300", // Cache 5 phút
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
```

**Deployment**:
```toml
# wrangler.toml
name = "netprobe-api"
main = "workers/geoip-proxy.js"
compatibility_date = "2024-12-01"
route = "speed.ccn.vn/api/*"
```

---

## X. EXECUTION PHASES & TIMING

```
User nhấn ▶ ENGAGE
│
├── Boot sequence (2.2s) — Terminal animation
│
├── Phase 1: CF Trace (0.5-1s)     ——— Instant
├── Phase 2: GeoIP (0.3-0.8s)      ——— Worker call
├── Phase 3: Latency (24 × 60ms = ~2s) ——— Live oscilloscope
├── Phase 4: Download (8-15s)       ——— 6 sizes × 2-3 iterations
├── Phase 5: Upload (5-10s)         ——— 4 sizes × 2-3 iterations
├── Phase 6: DNS (2-3s)             ——— 3 domains
├── Phase 7: Targets (12-20s)       ——— 12 targets × 5 samples
├── Phase 8: Gateway (optional 3-5s) ——— May skip on HTTPS
├── Phase 9: Analysis (<1s)         ——— Pattern detection
├── Phase 10: Score (<1s)           ——— Computation
│
└── DONE — Total: ~35-55s
```

Mỗi phase hoàn thành → UI card tương ứng hiện ra với animation `hudIn`.

---

## XI. STATE MANAGEMENT — useBenchmark Hook

```javascript
// hooks/useBenchmark.js
export function useBenchmark() {
  const [phase, setPhase] = useState("idle");    // idle | booting | running | done
  const [phaseId, setPhaseId] = useState(null);   // current phase ID
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);

  // Data — mỗi engine populate vào khi hoàn thành
  const [trace, setTrace] = useState(null);
  const [geo, setGeo] = useState(null);
  const [latency, setLatency] = useState(null);
  const [latencySamples, setLatencySamples] = useState([]);  // live oscilloscope
  const [download, setDownload] = useState(null);
  const [upload, setUpload] = useState(null);
  const [dns, setDns] = useState(null);
  const [targets, setTargets] = useState({});
  const [scanningTarget, setScanningTarget] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [bloat, setBloat] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [score, setScore] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  const [logs, setLogs] = useState([]);

  // Abort controller cho Stop button
  const abortRef = useRef(new AbortController());

  const run = useCallback(async () => {
    // Reset tất cả state
    // Gọi orchestrator.runBenchmark() với callbacks
    // Callbacks update từng piece of state khi engine hoàn thành
  }, []);

  return { phase, phaseId, elapsed, progress,
    trace, geo, latency, latencySamples,
    download, upload, dns, targets, scanningTarget,
    gateway, bloat, analysis, score, verdicts, logs,
    run, stop };
}
```

---

## XII. DEVELOPMENT PHASES

### Phase 1 — Core Infrastructure (1-2 ngày)
- [ ] Setup Vite + React project
- [ ] Implement utility functions (probes.js, stats.js, format.js)
- [ ] Implement Engine G (CF Trace) + Engine H (GeoIP) + Engine C (NetInfo)
- [ ] Implement orchestrator skeleton
- [ ] Basic UI: Header, BootTerminal, CommandCanvas
- [ ] Deploy bare project lên Cloudflare Pages

### Phase 2 — Measurement Engines (2-3 ngày)
- [ ] Engine Latency (oscilloscope)
- [ ] Engine D (Speed Download + Upload)
- [ ] Engine B (WAN RTT)
- [ ] Engine E (DNS)
- [ ] Engine F (Resource Timing)
- [ ] Engine I (International Targets)
- [ ] Wire tất cả vào orchestrator

### Phase 3 — Analysis + Scoring (1-2 ngày)
- [ ] Cross-analysis engine (12 patterns)
- [ ] Scorer (weighted calculation)
- [ ] Suggestions generator (tiếng Việt)
- [ ] Use-case verdicts

### Phase 4 — UI Polish (2-3 ngày)
- [ ] RadarSweep + SpeedGauge + Oscilloscope components
- [ ] HudPanel + FindingCard + TargetGrid
- [ ] PhaseTimeline + VerdictBadges
- [ ] ConsoleLog
- [ ] Staggered reveal animations
- [ ] Mobile responsive

### Phase 5 — Deploy & Optimize (1 ngày)
- [ ] Cloudflare Worker cho GeoIP proxy
- [ ] Domain setup speed.ccn.vn
- [ ] Performance optimization
- [ ] Error handling cho tất cả engines
- [ ] SEO meta tags

---

## XIII. KEY TECHNICAL NOTES

### CORS Workarounds
- `fetch(url, { mode: "no-cors" })` — chỉ đo timing, không đọc response
- `new Image().src = url` — đo qua onload/onerror timing (cả error cũng hợp lệ)
- Cloudflare Worker proxy — cho endpoints cần đọc response (ip-api.com)

### Accuracy Best Practices
- Đo nhiều lần (5-24 samples) + trimmed mean
- Jitter = mean absolute consecutive difference (chuẩn RFC)
- Speed = P90 percentile + median-to-top average (Cloudflare methodology)
- Loại bỏ requests quá nhanh (< 40ms, có thể cached)
- Buffer bloat so sánh idle vs loaded, không dùng absolute value

### Error Handling
Mỗi engine PHẢI có try-catch và trả về `{ _failed: true, _error: "..." }` nếu lỗi. UI hiển thị "SKIPPED" thay vì crash.

### Gateway Probe trên HTTPS
Mixed content (`http://192.168.x.x` từ `https://` page) bị block trên Chrome/Firefox. Đặt Gateway + Buffer Bloat engines là **optional** — skip gracefully nếu bị block.

---

## XIV. DATA MAP — CÁC FILE STATIC DATABASE

### coloMap.js — 30+ Cloudflare PoP
```javascript
export const COLO_MAP = {
  // Việt Nam (optimal)
  HAN: { city: "Hà Nội", flag: "🇻🇳", lat: 21.03, lon: 105.85, vn: true },
  SGN: { city: "TP.HCM", flag: "🇻🇳", lat: 10.82, lon: 106.63, vn: true },
  // Nearby (acceptable)
  SIN: { city: "Singapore", flag: "🇸🇬", lat: 1.35, lon: 103.82, nearby: true },
  BKK: { city: "Bangkok", flag: "🇹🇭", lat: 13.76, lon: 100.50, nearby: true },
  HKG: { city: "Hong Kong", flag: "🇭🇰", lat: 22.32, lon: 114.17, nearby: true },
  // ... thêm 25+ PoP khác (CGK, MNL, KUL, CAN, NRT, ICN, TPE, LAX, SJC, etc.)
};
```

### thresholds.js — Ngưỡng đánh giá
```javascript
export const THRESHOLDS = {
  latency: { good: 25, ok: 40, warn: 60, bad: 100 },
  jitter: { good: 5, ok: 10, warn: 20, bad: 30 },
  download: { good: 100, ok: 50, warn: 25, bad: 10 },
  upload: { good: 50, ok: 25, warn: 10, bad: 5 },
  dns: { good: 20, ok: 50, warn: 100 },
  lan: { avgGood: 8, avgWarn: 30, jitterGood: 3, lossWarn: 2 },
  bloat: { noticeable: 2, severe: 5 },
};
```

---

> **Tóm tắt**: Document này chứa đủ thông tin để Claude Code triển khai toàn bộ ứng dụng. Engines lấy logic từ 2 prototype thực tế (netprobe.jsx + isp-v5.jsx), UI lấy design từ netprobe-command-center.jsx. Tất cả measurements phải trả kết quả thực tế của người dùng, KHÔNG dùng mock data.
