// ═══════════════════════════════════════════════════════════════════════
//  NETPROBE — Static Databases
// ═══════════════════════════════════════════════════════════════════════

export const GATEWAYS = [
  { ip: "192.168.100.1", hint: "Modem DOCSIS (VNPT/Viettel/FPT)" },
  { ip: "192.168.1.1",   hint: "Viettel / TP-Link / ASUS" },
  { ip: "192.168.0.1",   hint: "VNPT / D-Link / Linksys" },
  { ip: "192.168.1.254", hint: "Modem ADSL/FTTH" },
  { ip: "10.0.0.1",      hint: "Viettel (modem mới)" },
  { ip: "10.0.0.138",    hint: "Viettel Huawei EchoLife" },
  { ip: "192.168.2.1",   hint: "VNPT / Apple Airport" },
  { ip: "192.168.10.1",  hint: "FPT Telecom" },
  { ip: "192.168.8.1",   hint: "Huawei 4G router" },
  { ip: "192.168.3.1",   hint: "Totolink / ZTE" },
  { ip: "192.168.43.1",  hint: "Hotspot Android" },
  { ip: "172.20.10.1",   hint: "Hotspot iPhone/iPad" },
  { ip: "192.168.88.1",  hint: "MikroTik" },
  { ip: "172.16.0.1",    hint: "Corporate / VPN" },
];

export const TARGETS = [
  { id: "cf",     name: "Cloudflare", url: "https://cloudflare.com/favicon.ico",          icon: "☁️",  cat: "CDN",      region: "HAN", crit: true },
  { id: "google", name: "Google",     url: "https://www.google.com/favicon.ico",           icon: "🔍",  cat: "Search",   region: "SIN", crit: true },
  { id: "fb",     name: "Facebook",   url: "https://www.facebook.com/favicon.ico",         icon: "📘",  cat: "Social",   region: "HKG", crit: true },
  { id: "yt",     name: "YouTube",    url: "https://www.youtube.com/favicon.ico",          icon: "▶️",  cat: "Stream",   region: "SIN", crit: true },
  { id: "aws",    name: "AWS",        url: "https://aws.amazon.com/favicon.ico",           icon: "🟧",  cat: "Cloud",    region: "SIN", crit: true },
  { id: "shopee", name: "Shopee",     url: "https://shopee.vn/favicon.ico",                icon: "🛒",  cat: "Commerce", region: "SGN", crit: true },
  { id: "gh",     name: "GitHub",     url: "https://github.com/favicon.ico",               icon: "🐙",  cat: "Dev",      region: "NRT" },
  { id: "tt",     name: "TikTok",     url: "https://www.tiktok.com/favicon.ico",           icon: "🎵",  cat: "Social",   region: "SIN" },
  { id: "wiki",   name: "Wikipedia",  url: "https://en.wikipedia.org/favicon.ico",         icon: "📚",  cat: "Info",     region: "SIN" },
  { id: "lazada", name: "Lazada",     url: "https://www.lazada.vn/favicon.ico",            icon: "🛍️", cat: "Commerce", region: "SIN" },
  { id: "gcloud", name: "GCP",        url: "https://cloud.google.com/favicon.ico",         icon: "☁️",  cat: "Cloud",    region: "SIN" },
  { id: "steam",  name: "Steam",      url: "https://store.steampowered.com/favicon.ico",   icon: "🎮",  cat: "Gaming",   region: "NRT" },
];

export const COLO_MAP = {
  HAN: { city: "Hà Nội",     flag: "🇻🇳", vn: true },
  SGN: { city: "TP.HCM",     flag: "🇻🇳", vn: true },
  SIN: { city: "Singapore",  flag: "🇸🇬", nearby: true },
  BKK: { city: "Bangkok",    flag: "🇹🇭", nearby: true },
  HKG: { city: "Hong Kong",  flag: "🇭🇰", nearby: true },
  NRT: { city: "Tokyo",      flag: "🇯🇵" },
  KIX: { city: "Osaka",      flag: "🇯🇵" },
  ICN: { city: "Seoul",      flag: "🇰🇷" },
  TPE: { city: "Taipei",     flag: "🇹🇼" },
  MNL: { city: "Manila",     flag: "🇵🇭" },
  CGK: { city: "Jakarta",    flag: "🇮🇩" },
  KUL: { city: "Kuala Lumpur", flag: "🇲🇾" },
  BOM: { city: "Mumbai",     flag: "🇮🇳" },
  DEL: { city: "Delhi",      flag: "🇮🇳" },
  SYD: { city: "Sydney",     flag: "🇦🇺" },
  LAX: { city: "Los Angeles", flag: "🇺🇸" },
  SJC: { city: "San Jose",   flag: "🇺🇸" },
  SEA: { city: "Seattle",    flag: "🇺🇸" },
  ORD: { city: "Chicago",    flag: "🇺🇸" },
  IAD: { city: "Washington",  flag: "🇺🇸" },
  FRA: { city: "Frankfurt",  flag: "🇩🇪" },
  LHR: { city: "London",     flag: "🇬🇧" },
  CDG: { city: "Paris",      flag: "🇫🇷" },
  AMS: { city: "Amsterdam",  flag: "🇳🇱" },
  CAN: { city: "Guangzhou",  flag: "🇨🇳" },
  PVG: { city: "Shanghai",   flag: "🇨🇳" },
  DAD: { city: "Đà Nẵng",    flag: "🇻🇳", vn: true },
};

export const ISP_DB = [
  { match: ["viettel"],            name: "Viettel",       color: "#e31937", tier: 1 },
  { match: ["vnpt", "vinaphone"],  name: "VNPT",          color: "#0066b3", tier: 1 },
  { match: ["fpt"],                name: "FPT Telecom",   color: "#f37021", tier: 1 },
  { match: ["cmc"],                name: "CMC Telecom",   color: "#00a651", tier: 2 },
  { match: ["mobifone"],           name: "Mobifone",       color: "#005baa", tier: 2 },
  { match: ["spt", "saigon"],      name: "SPT",           color: "#ff6600", tier: 2 },
  { match: ["netnam"],             name: "NetNam",         color: "#0099cc", tier: 2 },
];

export function detectISP(ispString) {
  const lower = (ispString || "").toLowerCase();
  for (const isp of ISP_DB) {
    if (isp.match.some(m => lower.includes(m))) return isp;
  }
  return { name: ispString || "Unknown", color: "#666", tier: 0 };
}

export const THRESHOLDS = {
  latency: { good: 25, ok: 40, warn: 60, bad: 100 },
  jitter:  { good: 5, ok: 10, warn: 20, bad: 30 },
  download: { good: 100, ok: 50, warn: 25, bad: 10 },
  upload:  { good: 50, ok: 25, warn: 10, bad: 5 },
  dns:     { good: 20, ok: 50, warn: 100 },
  lan:     { avgGood: 8, avgWarn: 30, jitterGood: 3, lossWarn: 2 },
  bloat:   { noticeable: 2, severe: 5 },
};

export const WAN_TARGETS = [
  { id: "cf1",  label: "Cloudflare 1.1.1.1", url: "https://1.1.1.1/cdn-cgi/trace" },
  { id: "cfdns", label: "Cloudflare DNS",     url: "https://cloudflare.com/cdn-cgi/trace" },
  { id: "gdns", label: "Google DNS",          url: "https://dns.google/resolve?name=test.com&type=A" },
];

export const DL_SIZES = [100000, 500000, 1000000, 2000000, 5000000, 10000000];
export const UL_SIZES = [100000, 500000, 1000000, 2000000];
export const DNS_DOMAINS = ["cloudflare.com", "google.com", "facebook.com"];

export const TRACE_URLS = [
  "https://1.1.1.1/cdn-cgi/trace",
  "https://one.one.one.one/cdn-cgi/trace",
  "https://cloudflare.com/cdn-cgi/trace",
];

export const PHASES = [
  { id: "boot",     name: "SYSTEM BOOT" },
  { id: "trace",    name: "CF TRACE" },
  { id: "geo",      name: "GEOLOCATION" },
  { id: "latency",  name: "LATENCY" },
  { id: "download", name: "DOWNLOAD" },
  { id: "upload",   name: "UPLOAD" },
  { id: "dns",      name: "DNS" },
  { id: "targets",  name: "TARGETS" },
  { id: "analysis", name: "ANALYSIS" },
  { id: "score",    name: "SCORE" },
];

export const BOOT_LINES = [
  "[BIOS] NetProbe Command Center v4.0.0",
  "[BIOS] Initializing quantum-safe handshake...",
  "[KERN] Loading measurement engines: A B C D E F G H I X",
  "[KERN] Cloudflare Edge Network interface ready",
  "[NETD] Scanning gateway candidates: 14 addresses",
  "[NETD] Interface eth0: UP | MTU 1500 | QLEN 1000",
  "[CRYP] TLS 1.3 cipher suites loaded",
  "[CRYP] Post-quantum KEM: ML-KEM-768 available",
  "[TRAC] CF PoP database: 30 locations loaded",
  "[GEOD] ISP fingerprint DB: VN tier-1/tier-2 ready",
  "[PROB] Image probe + fetch probe engines ready",
  "[SPDT] Cloudflare speed endpoints configured",
  "[ANLZ] Cross-analysis patterns: 12 rules loaded",
  "[SCOR] Scoring algorithm v2.1 initialized",
  "[CORE] All systems nominal ■ READY TO ENGAGE",
];
