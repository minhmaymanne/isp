// ═══════════════════════════════════════════════════════════════════════
//  NETPROBE — Cross-Analysis Engine + Scoring + Verdicts
// ═══════════════════════════════════════════════════════════════════════

import { COLO_MAP, detectISP, THRESHOLDS as TH } from "./data.js";

// ═══════════════════════════════════════════════════════════════════════
//  Cross-Analyzer — 12 Pattern Rules
// ═══════════════════════════════════════════════════════════════════════
export function crossAnalyze(data) {
  const { trace, geo, latency, download, upload, dns, targets, gateway, bloat } = data;
  const findings = [];

  const colo = trace?.colo || "";
  const coloInfo = COLO_MAP[colo];
  const sni = trace?.sni || "";
  const kex = trace?.kex || "";
  const http = trace?.http || "";
  const warp = trace?.warp || "";
  const lat = latency?.avg || 999;
  const jit = latency?.jitter || 999;
  const dl = download?.mbps || 0;
  const ul = upload?.mbps || 0;

  // P1: Routing optimal
  if (coloInfo?.vn) {
    findings.push({
      id: "ROUTING_OPTIMAL", icon: "✅", severity: "good",
      title: `Routing tối ưu — ${colo} PoP`,
      desc: `Traffic kết nối trực tiếp tới Cloudflare ${coloInfo.city}. Tuyến ngắn nhất cho user Việt Nam.`,
    });
  }

  // P2: Routing suboptimal
  if (colo && !coloInfo?.vn && (geo?.countryCode === "VN" || trace?.loc === "VN")) {
    findings.push({
      id: "ROUTING_SUBOPTIMAL", icon: "🔀", severity: "warn",
      title: `Routing qua ${coloInfo?.city || colo}`,
      desc: `ISP đang route traffic qua ${coloInfo?.city || colo} thay vì PoP Việt Nam. Có thể tăng độ trễ 10-40ms.`,
    });
  }

  // P3: SNI plaintext
  if (sni === "plaintext") {
    findings.push({
      id: "SNI_PLAINTEXT", icon: "🔓", severity: "warn",
      title: "SNI chưa mã hóa",
      desc: "ISP có thể thấy domain bạn truy cập. Bật WARP hoặc ECH (Firefox) để mã hóa SNI.",
    });
  }

  // P4: Post-quantum
  if (kex.includes("MLKEM") || kex.includes("mlkem")) {
    findings.push({
      id: "POST_QUANTUM", icon: "⚡", severity: "good",
      title: "Post-Quantum Key Exchange",
      desc: `${kex} đang hoạt động — bảo vệ trước máy tính lượng tử. Tiêu chuẩn cao nhất hiện tại.`,
    });
  }

  // P5: HTTP legacy
  if (http === "http/1.1") {
    findings.push({
      id: "HTTP_LEGACY", icon: "🐌", severity: "warn",
      title: "HTTP/1.1 Legacy",
      desc: "Kết nối chưa dùng HTTP/2 hoặc QUIC. Có thể do ISP hoặc cấu hình DNS chưa hỗ trợ.",
    });
  } else if (http === "h3") {
    findings.push({
      id: "HTTP3_ACTIVE", icon: "🚀", severity: "good",
      title: "HTTP/3 QUIC Active",
      desc: "Đang sử dụng giao thức mới nhất — multiplexing không head-of-line blocking.",
    });
  }

  // P6: WARP active
  if (warp === "on" || warp === "plus") {
    findings.push({
      id: "WARP_ACTIVE", icon: "🛡️", severity: "good",
      title: `WARP ${warp === "plus" ? "+" : ""} đang hoạt động`,
      desc: "Traffic được mã hóa và tối ưu routing qua Cloudflare network.",
    });
  }

  // P7: LAN issue
  if (gateway && !gateway._skipped && gateway.avg > TH.lan.avgWarn) {
    findings.push({
      id: "LAN_ISSUE", icon: "🔌", severity: "warn",
      title: `LAN RTT cao: ${gateway.avg}ms`,
      desc: `RTT đến gateway ${gateway.ip} cao bất thường (bình thường < ${TH.lan.avgGood}ms). Kiểm tra cáp mạng/WiFi.`,
    });
  }

  // P8: Buffer bloat
  if (bloat && !bloat._skipped && bloat.bloatRatio > TH.bloat.noticeable) {
    const sev = bloat.bloatRatio > TH.bloat.severe ? "error" : "warn";
    findings.push({
      id: "BUFFER_BLOAT", icon: "📦", severity: sev,
      title: `Buffer Bloat: ${bloat.bloatRatio}x`,
      desc: `Latency tăng ${bloat.bloatRatio}x khi có tải (${bloat.idleAvg}ms → ${bloat.loadAvg}ms). Router buffer quá lớn — gây lag khi tải nặng.`,
    });
  }

  // P9: High jitter
  if (jit > TH.jitter.warn) {
    findings.push({
      id: "HIGH_JITTER", icon: "📊", severity: "warn",
      title: `Jitter cao: ${jit}ms`,
      desc: `Kết nối dao động không đều — ảnh hưởng video call, game online. Thử đổi từ WiFi sang dây LAN.`,
    });
  } else if (jit <= TH.jitter.good) {
    findings.push({
      id: "LOW_JITTER", icon: "📊", severity: "good",
      title: `Jitter thấp: ${jit}ms`,
      desc: `Kết nối ổn định — phù hợp VoIP, live streaming, gaming competitive.`,
    });
  }

  // P10: Low bandwidth
  if (dl < TH.download.warn && dl > 0) {
    findings.push({
      id: "LOW_BANDWIDTH", icon: "⬇️", severity: "warn",
      title: `Download thấp: ${dl} Mbps`,
      desc: `Tốc độ tải dưới ${TH.download.warn} Mbps. Kiểm tra gói cước ISP hoặc thiết bị đang share băng thông.`,
    });
  }

  // P11: International throttle
  if (targets && Object.keys(targets).length > 0) {
    const total = Object.keys(targets).length;
    const slow = Object.values(targets).filter(t => t.avg > 200).length;
    if (slow / total > 0.4) {
      findings.push({
        id: "INTL_THROTTLE", icon: "🌐", severity: "warn",
        title: "Nhiều target quốc tế chậm",
        desc: `${slow}/${total} targets có latency >200ms. ISP có thể throttle traffic quốc tế hoặc tuyến cáp biển bị ảnh hưởng.`,
      });
    }
  }

  // P12: Excellent
  if (dl >= 50 && lat <= 40 && jit <= TH.jitter.ok) {
    findings.push({
      id: "EXCELLENT", icon: "🎯", severity: "good",
      title: "Kết nối xuất sắc",
      desc: `${dl} ↓ / ${ul} ↑ Mbps, latency ${lat}ms. Gaming competitive, 4K streaming, video call HD.`,
    });
  }

  // International summary
  if (targets && Object.keys(targets).length > 0) {
    const total = Object.keys(targets).length;
    const reachable = Object.values(targets).filter(t => t.avg > 0).length;
    const avgLat = Math.round(Object.values(targets).filter(t => t.avg > 0).reduce((a, t) => a + t.avg, 0) / (reachable || 1));
    if (reachable === total && avgLat < 100) {
      findings.push({
        id: "INTL_PERFECT", icon: "🌏", severity: "good",
        title: `International: ${reachable}/${total} reachable`,
        desc: `Tất cả targets đều reachable, avg ${avgLat}ms. Tuyến cáp biển hoạt động tốt.`,
      });
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════
//  Scoring System — Weighted 0-100
// ═══════════════════════════════════════════════════════════════════════
export function calculateScore(data) {
  let score = 0;
  const dl = data.download?.mbps || 0;
  const ul = data.upload?.mbps || 0;
  const lat = data.latency?.avg || 999;
  const jit = data.latency?.jitter || 999;

  // Download: 25%
  const dlScore = dl >= 200 ? 100 : dl >= 100 ? 90 : dl >= 50 ? 75
    : dl >= 25 ? 60 : dl >= 10 ? 45 : dl > 0 ? 20 : 0;
  score += dlScore * 0.25;

  // Upload: 15%
  const ulScore = ul >= 100 ? 100 : ul >= 50 ? 90 : ul >= 25 ? 75
    : ul >= 10 ? 60 : ul > 0 ? 30 : 0;
  score += ulScore * 0.15;

  // Latency: 28%
  const latScore = lat <= 15 ? 100 : lat <= 25 ? 90 : lat <= 40 ? 80
    : lat <= 60 ? 65 : lat <= 100 ? 50 : lat <= 150 ? 35 : 15;
  score += latScore * 0.28;

  // Jitter: 12%
  const jitScore = jit <= 3 ? 100 : jit <= 8 ? 85 : jit <= 15 ? 65
    : jit <= 25 ? 45 : 20;
  score += jitScore * 0.12;

  // International: 20%
  const targets = data.targets || {};
  const total = Object.keys(targets).length || 1;
  const reachable = Object.values(targets).filter(t => t.avg > 0).length;
  score += (reachable / total * 100) * 0.20;

  const value = Math.round(score);
  return { value, ...getGrade(value) };
}

function getGrade(score) {
  if (score >= 92) return { grade: "S+", label: "Xuất sắc", color: "#00ffd5" };
  if (score >= 80) return { grade: "A",  label: "Tốt",      color: "#00e676" };
  if (score >= 65) return { grade: "B",  label: "Khá",      color: "#c6ff00" };
  if (score >= 50) return { grade: "C",  label: "Trung bình", color: "#ffd600" };
  if (score >= 35) return { grade: "D",  label: "Kém",      color: "#ff9100" };
  return { grade: "F", label: "Rất kém", color: "#ff1744" };
}

// ═══════════════════════════════════════════════════════════════════════
//  Use-case Verdicts
// ═══════════════════════════════════════════════════════════════════════
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
      detail: dl >= 50 ? "4K Ultra HD" : dl >= 25 ? "1080p HD" : dl >= 5 ? "SD Only" : "Buffering",
    },
    gaming: {
      ok: lat <= 50 && jit <= 15,
      label: "GAMING",
      icon: "🎮",
      detail: lat <= 30 && jit <= 8 ? "Competitive" : lat <= 50 ? "Casual OK" : "High Lag",
    },
    videoCall: {
      ok: dl >= 5 && ul >= 3 && lat <= 150,
      label: "VIDEO CALL",
      icon: "📹",
      detail: ul >= 10 && dl >= 10 ? "HD Quality" : "SD Quality",
    },
    cloud: {
      ok: ul >= 10 && dl >= 25,
      label: "CLOUD",
      icon: "☁️",
      detail: ul >= 50 ? "Fast Sync" : ul >= 10 ? "Standard" : "Slow Upload",
    },
  };
}
