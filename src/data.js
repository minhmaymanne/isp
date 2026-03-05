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

// ── Grouped international targets ─────────────────────────────────────
export const TARGET_GROUPS = [
  { id: "shopping", name: "MUA SẮM", icon: "🛒", accent: "#ff6d00", targets: [
    { id: "shopee",     name: "Shopee",      url: "https://shopee.vn/favicon.ico",                 icon: "🛒" },
    { id: "lazada",     name: "Lazada",      url: "https://www.lazada.vn/favicon.ico",              icon: "🛍️" },
    { id: "tiktokshop", name: "TikTok Shop", url: "https://www.tiktok.com/favicon.ico",            icon: "🎵" },
    { id: "tiki",       name: "Tiki",        url: "https://tiki.vn/favicon.ico",                   icon: "📦" },
    { id: "grab",       name: "Grab",        url: "https://www.grab.com/favicon.ico",              icon: "🚗" },
    { id: "sendo",      name: "Sendo",       url: "https://www.sendo.vn/favicon.ico",              icon: "🏪" },
  ]},
  { id: "social", name: "MẠNG XÃ HỘI", icon: "💬", accent: "#2979ff", targets: [
    { id: "fb",       name: "Facebook",    url: "https://www.facebook.com/favicon.ico",           icon: "📘" },
    { id: "insta",    name: "Instagram",   url: "https://www.instagram.com/favicon.ico",          icon: "📸" },
    { id: "zalo",     name: "Zalo",        url: "https://zalo.me/favicon.ico",                   icon: "💙" },
    { id: "telegram", name: "Telegram",    url: "https://telegram.org/favicon.ico",              icon: "✈️" },
    { id: "x",        name: "X (Twitter)", url: "https://x.com/favicon.ico",                    icon: "✖️" },
    { id: "discord",  name: "Discord",     url: "https://discord.com/favicon.ico",               icon: "🎮" },
    { id: "whatsapp", name: "WhatsApp",    url: "https://web.whatsapp.com/favicon.ico",          icon: "📞" },
  ]},
  { id: "cloud", name: "CLOUD", icon: "☁️", accent: "#00e5ff", targets: [
    { id: "aws",    name: "AWS",          url: "https://aws.amazon.com/favicon.ico",            icon: "🟧" },
    { id: "gcloud", name: "Google Cloud",  url: "https://cloud.google.com/favicon.ico",         icon: "☁️" },
    { id: "azure",  name: "Azure",        url: "https://azure.microsoft.com/favicon.ico",       icon: "🔷" },
    { id: "cf",     name: "Cloudflare",   url: "https://cloudflare.com/favicon.ico",            icon: "🟠" },
    { id: "do",     name: "DigitalOcean",  url: "https://www.digitalocean.com/favicon.ico",     icon: "🌊" },
    { id: "icloud", name: "iCloud",       url: "https://www.icloud.com/favicon.ico",            icon: "🍎" },
    { id: "vercel", name: "Vercel",       url: "https://vercel.com/favicon.ico",                icon: "▲" },
  ]},
  { id: "ai", name: "AI", icon: "🤖", accent: "#ea80fc", targets: [
    { id: "chatgpt",   name: "ChatGPT",    url: "https://chatgpt.com/favicon.ico",               icon: "🧠" },
    { id: "claude",    name: "Claude",     url: "https://claude.ai/favicon.ico",                 icon: "🟤" },
    { id: "gemini",    name: "Gemini",     url: "https://gemini.google.com/favicon.ico",         icon: "💎" },
    { id: "grok",      name: "Grok",       url: "https://grok.com/favicon.ico",                  icon: "⚡" },
    { id: "copilot",   name: "Copilot",    url: "https://copilot.microsoft.com/favicon.ico",     icon: "🤝" },
    { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/favicon.ico",        icon: "🔮" },
    { id: "deepseek",  name: "DeepSeek",   url: "https://www.deepseek.com/favicon.ico",          icon: "🐋" },
  ]},
  { id: "media", name: "MEDIA", icon: "🎬", accent: "#ff1744", targets: [
    { id: "yt",        name: "YouTube",    url: "https://www.youtube.com/favicon.ico",           icon: "▶️" },
    { id: "netflix",   name: "Netflix",    url: "https://www.netflix.com/favicon.ico",           icon: "🎬" },
    { id: "spotify",   name: "Spotify",    url: "https://www.spotify.com/favicon.ico",           icon: "🎵" },
    { id: "soundcloud", name: "SoundCloud", url: "https://soundcloud.com/favicon.ico",           icon: "🔊" },
    { id: "twitch",    name: "Twitch",     url: "https://www.twitch.tv/favicon.ico",             icon: "📺" },
    { id: "tt_media",  name: "TikTok",     url: "https://www.tiktok.com/favicon.ico",            icon: "🎶" },
  ]},
  { id: "gaming", name: "GAMING", icon: "🎮", accent: "#76ff03", targets: [
    { id: "lienquan",  name: "Liên Quân",     urls: ["http://45.119.241.228", "http://103.200.120.105", "https://lienquan.garena.vn/favicon.ico"], icon: "⚔️" },
    { id: "pubgm",     name: "PUBG Mobile",   urls: ["http://14.160.26.174", "https://pubgmobile.vn/favicon.ico"],              icon: "🔫" },
    { id: "freefire",  name: "Free Fire",     urls: ["http://203.205.28.29", "https://ff.garena.vn/favicon.ico"],               icon: "🔥" },
    { id: "wildrift",  name: "Tốc Chiến",     urls: ["http://103.200.120.105", "https://wildrift.leagueoflegends.com/favicon.ico"], icon: "🏆" },
    { id: "vltk",      name: "Võ Lâm TK",     urls: ["http://115.84.177.20", "https://volam.vn/favicon.ico"],                   icon: "🗡️" },
  ]},
  { id: "dev", name: "DEV TOOLS", icon: "🐙", accent: "#b388ff", targets: [
    { id: "gh",            name: "GitHub",        url: "https://github.com/favicon.ico",                icon: "🐙" },
    { id: "gitlab",        name: "GitLab",        url: "https://gitlab.com/favicon.ico",                icon: "🦊" },
    { id: "npm",           name: "npm",           url: "https://www.npmjs.com/favicon.ico",             icon: "📦" },
    { id: "docker",        name: "Docker Hub",    url: "https://hub.docker.com/favicon.ico",            icon: "🐳" },
    { id: "stackoverflow", name: "StackOverflow", url: "https://stackoverflow.com/favicon.ico",         icon: "📚" },
    { id: "netlify",       name: "Netlify",       url: "https://www.netlify.com/favicon.ico",           icon: "🌐" },
  ]},
  { id: "search", name: "TÌM KIẾM", icon: "🔍", accent: "#ffab00", targets: [
    { id: "google", name: "Google",     url: "https://www.google.com/favicon.ico",            icon: "🔍" },
    { id: "bing",   name: "Bing",       url: "https://www.bing.com/favicon.ico",              icon: "🅱️" },
    { id: "wiki",   name: "Wikipedia",  url: "https://en.wikipedia.org/favicon.ico",          icon: "📚" },
    { id: "ddg",    name: "DuckDuckGo", url: "https://duckduckgo.com/favicon.ico",            icon: "🦆" },
    { id: "yahoo",  name: "Yahoo",      url: "https://www.yahoo.com/favicon.ico",             icon: "🟣" },
    { id: "baidu",  name: "Baidu",      url: "https://www.baidu.com/favicon.ico",             icon: "🐾" },
  ]},
];

// Flat list for engine iteration
export const TARGETS = TARGET_GROUPS.flatMap(g => g.targets);

// Scan scope presets — maps usage profile to relevant target groups
export const SCAN_SCOPES = [
  { id: "full",   label: "Đầy đủ",     icon: "🔬", desc: "Quét tất cả 8 nhóm ứng dụng",           groups: null },
  { id: "game",   label: "Chơi game",   icon: "🎮", desc: "Gaming, Cloud, Mạng xã hội, Tìm kiếm",  groups: ["gaming", "cloud", "social", "search"] },
  { id: "work",   label: "Làm việc",    icon: "💼", desc: "Cloud, Dev Tools, AI, Tìm kiếm",         groups: ["cloud", "dev", "ai", "search"] },
  { id: "fun",    label: "Giải trí",    icon: "🎬", desc: "Media, Mua sắm, Mạng xã hội, Gaming",   groups: ["media", "shopping", "social", "gaming"] },
  { id: "social", label: "Mạng xã hội", icon: "💬", desc: "Mạng xã hội, Media, Mua sắm, AI",       groups: ["social", "media", "shopping", "ai"] },
];

export const CONN_TYPES = [
  { id: "lan",  label: "LAN",         icon: "🔌", desc: "Cáp mạng Ethernet" },
  { id: "wifi", label: "Wi-Fi",       icon: "📶", desc: "Mạng không dây" },
  { id: "cell", label: "4G/5G LTE",   icon: "📡", desc: "Dữ liệu di động" },
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
  { match: ["viettel"], as: ["AS7552","AS131429"],
    name: "Viettel", fullName: "Tập đoàn Công nghiệp - Viễn thông Quân đội",
    color: "#e31937", tier: 1, type: "FTTH / 4G / 5G",
    desc: "Nhà mạng lớn nhất Việt Nam — hạ tầng cáp quang toàn quốc" },
  { match: ["vnpt", "vinaphone"], as: ["AS45899","AS131380","AS45903"],
    name: "VNPT", fullName: "Tập đoàn Bưu chính Viễn thông Việt Nam",
    color: "#0066b3", tier: 1, type: "FTTH / 4G",
    desc: "Nhà mạng quốc doanh — backbone Internet Việt Nam" },
  { match: ["fpt"], as: ["AS18403"],
    name: "FPT Telecom", fullName: "Công ty Cổ phần Viễn thông FPT",
    color: "#f37021", tier: 1, type: "FTTH / 4G",
    desc: "ISP tư nhân hàng đầu — peering quốc tế tốt" },
  { match: ["cmc"], as: ["AS131173","AS38731"],
    name: "CMC Telecom", fullName: "Công ty Cổ phần Hạ tầng Viễn thông CMC",
    color: "#00a651", tier: 2, type: "FTTH / Leased Line",
    desc: "Chuyên doanh nghiệp — data center & cloud" },
  { match: ["mobifone"], as: ["AS131405"],
    name: "Mobifone", fullName: "Tổng Công ty Viễn thông MobiFone",
    color: "#005baa", tier: 2, type: "4G / 5G",
    desc: "Nhà mạng di động quốc doanh" },
  { match: ["spt", "saigon"], as: ["AS7643"],
    name: "SPT", fullName: "Công ty Cổ phần Dịch vụ Bưu chính Viễn thông Sài Gòn",
    color: "#ff6600", tier: 2, type: "FTTH / ADSL",
    desc: "ISP khu vực TP.HCM" },
  { match: ["netnam"], as: ["AS9902"],
    name: "NetNam", fullName: "Công ty TNHH Thương mại & Dịch vụ NetNam",
    color: "#0099cc", tier: 2, type: "FTTH / Leased Line",
    desc: "ISP chuyên hosting & data center" },
  { match: ["vietnamobile", "vn mobile"], as: ["AS135963"],
    name: "Vietnamobile", fullName: "Công ty Cổ phần Viễn thông Di động Vietnamobile",
    color: "#e6007e", tier: 2, type: "4G",
    desc: "Nhà mạng di động tư nhân" },
  { match: ["vietinfo", "gtd"], as: ["AS38247"],
    name: "GTD (VietInfo)", fullName: "Công ty Cổ phần Viễn thông GTD",
    color: "#6a1b9a", tier: 3, type: "Leased Line",
    desc: "ISP doanh nghiệp" },
];

export function detectISP(ispString, asString) {
  const lower = (ispString || "").toLowerCase();
  const asLower = (asString || "").toUpperCase();
  // Match by ISP name
  for (const isp of ISP_DB) {
    if (isp.match.some(m => lower.includes(m))) return isp;
  }
  // Match by AS number
  if (asLower) {
    for (const isp of ISP_DB) {
      if (isp.as?.some(a => asLower.includes(a))) return isp;
    }
  }
  return { name: ispString || "Unknown ISP", fullName: ispString || "", color: "#666", tier: 0, type: "N/A", desc: "" };
}

// ── Vietnamese city/province mapping ──────────────────────────────────
export const VN_LOCATIONS = {
  "hanoi": "Hà Nội", "ha noi": "Hà Nội",
  "ho chi minh city": "TP. Hồ Chí Minh", "ho chi minh": "TP. Hồ Chí Minh",
  "hcmc": "TP. Hồ Chí Minh", "saigon": "TP. Hồ Chí Minh", "thanh pho ho chi minh": "TP. Hồ Chí Minh",
  "da nang": "Đà Nẵng", "danang": "Đà Nẵng",
  "hai phong": "Hải Phòng", "haiphong": "Hải Phòng",
  "can tho": "Cần Thơ", "cantho": "Cần Thơ",
  "bien hoa": "Biên Hòa", "dong nai": "Đồng Nai",
  "vung tau": "Vũng Tàu", "ba ria - vung tau": "Bà Rịa - Vũng Tàu",
  "nha trang": "Nha Trang", "khanh hoa": "Khánh Hòa",
  "hue": "Huế", "thua thien hue": "Thừa Thiên Huế",
  "da lat": "Đà Lạt", "lam dong": "Lâm Đồng",
  "quy nhon": "Quy Nhơn", "binh dinh": "Bình Định",
  "buon ma thuot": "Buôn Ma Thuột", "dak lak": "Đắk Lắk",
  "thai nguyen": "Thái Nguyên", "bac ninh": "Bắc Ninh",
  "vinh": "Vinh", "nghe an": "Nghệ An",
  "thanh hoa": "Thanh Hóa", "nam dinh": "Nam Định",
  "ha long": "Hạ Long", "quang ninh": "Quảng Ninh",
  "phan thiet": "Phan Thiết", "binh thuan": "Bình Thuận",
  "long xuyen": "Long Xuyên", "an giang": "An Giang",
  "rach gia": "Rạch Giá", "kien giang": "Kiên Giang",
  "my tho": "Mỹ Tho", "tien giang": "Tiền Giang",
  "bac giang": "Bắc Giang", "phu tho": "Phú Thọ",
  "hai duong": "Hải Dương", "hung yen": "Hưng Yên",
  "ninh binh": "Ninh Bình", "ha tinh": "Hà Tĩnh",
  "quang nam": "Quảng Nam", "quang ngai": "Quảng Ngãi",
  "binh duong": "Bình Dương", "thu dau mot": "Thủ Dầu Một",
  "long an": "Long An", "tay ninh": "Tây Ninh",
  "lao cai": "Lào Cai", "dien bien": "Điện Biên",
  "son la": "Sơn La", "yen bai": "Yên Bái",
  "lang son": "Lạng Sơn", "cao bang": "Cao Bằng",
  "ha giang": "Hà Giang", "tuyen quang": "Tuyên Quang",
  "vinh phuc": "Vĩnh Phúc", "bac kan": "Bắc Kạn",
};

export function vietnamizeCity(city, region) {
  if (!city && !region) return null;
  const c = (city || "").toLowerCase().trim();
  const r = (region || "").toLowerCase().trim();
  return VN_LOCATIONS[c] || VN_LOCATIONS[r] || city || region || null;
}

// ── Country flag emoji lookup ─────────────────────────────────────────
export function countryFlag(code) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

// ── Vietnamese country names ──────────────────────────────────────────
const COUNTRY_VI = {
  VN: "Việt Nam", SG: "Singapore", TH: "Thái Lan", HK: "Hồng Kông",
  JP: "Nhật Bản", KR: "Hàn Quốc", TW: "Đài Loan", PH: "Philippines",
  ID: "Indonesia", MY: "Malaysia", IN: "Ấn Độ", AU: "Úc",
  US: "Hoa Kỳ", GB: "Anh Quốc", DE: "Đức", FR: "Pháp",
  NL: "Hà Lan", CN: "Trung Quốc", CA: "Canada", RU: "Nga",
  KH: "Campuchia", LA: "Lào", MM: "Myanmar",
};
export function countryNameVI(code) {
  return COUNTRY_VI[code?.toUpperCase()] || null;
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
  { id: "boot",     name: "KHỞI ĐỘNG",   icon: "⚡" },
  { id: "identify", name: "NHẬN DIỆN",   icon: "🔍" },
  { id: "speed",    name: "TỐC ĐỘ",     icon: "⚡" },
  { id: "dns",      name: "DNS",          icon: "🔗" },
  { id: "targets",  name: "ỨNG DỤNG",    icon: "🌐" },
  { id: "analysis", name: "PHÂN TÍCH",   icon: "🔬" },
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
