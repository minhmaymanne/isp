import { useState, useRef } from "react";
// ─── COMMON GATEWAY FALLBACK LIST ─────────────────────────────────────────────
// Nếu WebRTC không cho local IP (do mDNS ẩn), thử các gateway phổ biến
const COMMON_GATEWAYS = [
  "192.168.1.1",   // TP-Link, ASUS, D-Link phổ biến nhất
  "192.168.0.1",   // Linksys, nhiều ISP VN
  "192.168.2.1",   // Apple Airport
  "10.0.0.1",      // Một số ISP VN, Viettel
  "10.0.0.138",    // Một số modem Viettel
  "192.168.100.1", // Một số modem cáp
  "172.16.0.1",    // Corporate networks
];
// ─── STEP 1: WebRTC ICE Discovery (có xử lý mDNS) ────────────────────────────
function discoverLocalNetwork() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const result = {
      ipv4s: [],        // IP số thực (nếu Chrome cho phép)
      mdnsNames: [],    // *.local mDNS names (Chrome ẩn IP)
      publicIP: null,   // srflx = IP WAN
    };
    const timeout = setTimeout(() => {
      pc.close();
      resolve({ ok: true, ...result, timedOut: true });
    }, 5000);
    pc.createDataChannel("x");
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const cand = e.candidate.candidate;
      // Lấy tất cả IP dạng số
      const ips = cand.match(/(\d{1,3}(?:\.\d{1,3}){3})/g) || [];
      ips.forEach((ip) => {
        if (ip === "0.0.0.0") return;
        const isPrivate =
          ip.startsWith("192.168.") ||
          ip.startsWith("10.")      ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
        if (isPrivate && !result.ipv4s.includes(ip)) {
          result.ipv4s.push(ip);
        } else if (!isPrivate && !result.publicIP) {
          result.publicIP = ip;
        }
      });
      // Lấy mDNS names (Chrome ẩn local IP thành *.local)
      const mdns = cand.match(/([a-f0-9-]+\.local)/gi) || [];
      mdns.forEach((name) => {
        if (!result.mdnsNames.includes(name)) result.mdnsNames.push(name);
      });
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState !== "complete") return;
      clearTimeout(timeout);
      pc.close();
      // Suy ra gateway từ IP tìm được
      const gatewayIPs = [
        ...new Set(
          result.ipv4s.map((ip) => {
            const p = ip.split(".");
            return `${p[0]}.${p[1]}.${p[2]}.1`;
          })
        ),
      ];
      resolve({ ok: true, ...result, gatewayIPs });
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o));
  });
}
// ─── STEP 2a: Quick-scan gateway candidates (timeout ngắn, song song) ─────────
// Thử fetch nhanh nhiều IP cùng lúc để tìm cái nào phản hồi
async function scanGateways(candidates, onFound) {
  const QUICK_TIMEOUT = 1500; // ms
  const results = await Promise.allSettled(
    candidates.map(async (ip) => {
      const t0 = performance.now();
      try {
        await fetch(`http://${ip}/`, {
          mode: "no-cors",
          cache: "no-store",
          signal: AbortSignal.timeout(QUICK_TIMEOUT),
        });
        const rtt = performance.now() - t0;
        onFound?.({ ip, rtt, status: "ok" });
        return { ip, rtt, status: "ok" };
      } catch (err) {
        const rtt = performance.now() - t0;
        if (rtt < QUICK_TIMEOUT - 50) {
          // Phản hồi nhanh = router có đó (TCP RST)
          onFound?.({ ip, rtt, status: "refused" });
          return { ip, rtt, status: "refused" };
        }
        return { ip, rtt: null, status: "timeout" };
      }
    })
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value.rtt !== null)
    .map((r) => r.value)
    .sort((a, b) => a.rtt - b.rtt); // sắp xếp theo RTT tăng dần
}
// ─── STEP 2b: Probe gateway chính xác (nhiều mẫu) ────────────────────────────
async function probeGatewayRTT(ip, samples, onSample) {
  const raw = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    try {
      await fetch(`http://${ip}/`, {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      const rtt = performance.now() - t0;
      raw.push(rtt);
      onSample?.({ i: i + 1, rtt, status: "ok" });
    } catch {
      const rtt = performance.now() - t0;
      if (rtt < 1950) {
        raw.push(rtt);
        onSample?.({ i: i + 1, rtt, status: "refused" });
      } else {
        onSample?.({ i: i + 1, rtt: null, status: "timeout" });
      }
    }
    if (i < samples - 1) await new Promise((r) => setTimeout(r, 400));
  }
  if (!raw.length) return { ok: false };
  const avg = raw.reduce((a, b) => a + b, 0) / raw.length;
  const jitter =
    raw.length > 1
      ? raw.slice(1).reduce((s, v, i) => s + Math.abs(v - raw[i]), 0) / (raw.length - 1)
      : 0;
  return {
    ok: true, ip,
    avg, min: Math.min(...raw), max: Math.max(...raw),
    jitter, loss: ((samples - raw.length) / samples) * 100,
    raw,
  };
}
// ─── UI ───────────────────────────────────────────────────────────────────────
export default function LanProbeTest() {
  const [log, setLog]       = useState([]);
  const [phase, setPhase]   = useState("idle");
  const [disc, setDisc]     = useState(null);
  const [scanRes, setScan]  = useState([]);
  const [probeRes, setProbe]= useState(null);
  const [samples, setSamples] = useState([]);
  const addLog = (msg, color = "#6699bb") =>
    setLog((l) => [...l, { msg, color, t: new Date().toLocaleTimeString("vi") }]);
  const run = async () => {
    setLog([]); setDisc(null); setScan([]); setProbe(null); setSamples([]);
    // ── STEP 1: WebRTC
    setPhase("step1");
    addLog("▶ STEP 1 — WebRTC ICE gathering...");
    const d = await discoverLocalNetwork();
    setDisc(d);
    let gatewayCandidates = [];
    if (d.ipv4s.length > 0) {
      addLog(`✓ Local IPv4: ${d.ipv4s.join(", ")}`, "#66ff99");
      addLog(`✓ Gateway guess: ${d.gatewayIPs.join(", ")}`, "#66ff99");
      gatewayCandidates = [...d.gatewayIPs, ...COMMON_GATEWAYS];
    } else if (d.mdnsNames.length > 0) {
      addLog(`ℹ Chrome ẩn IP bằng mDNS: ${d.mdnsNames[0]}`, "#ffcc44");
      addLog(`→ Không lấy được IP thực, chuyển sang scan phổ biến`, "#ffcc44");
      gatewayCandidates = COMMON_GATEWAYS;
    } else {
      addLog(`ℹ Không lấy được local IP, scan danh sách phổ biến`, "#ffcc44");
      gatewayCandidates = COMMON_GATEWAYS;
    }
    if (d.publicIP) addLog(`ℹ Public IP (WAN): ${d.publicIP}`, "#4488aa");
    // ── STEP 2a: Quick scan
    setPhase("scan");
    addLog(`\n▶ STEP 2a — Quick scan ${gatewayCandidates.length} gateway candidates...`);
    addLog(`ℹ Nếu Chrome hỏi "Cho phép truy cập mạng nội bộ?" → bấm Cho phép`, "#ffcc44");
    const found = [];
    const scanResults = await scanGateways(gatewayCandidates, ({ ip, rtt, status }) => {
      found.push({ ip, rtt, status });
      setScan([...found]);
      addLog(
        `  ${status === "ok" ? "✓" : "↯"} ${ip} → ${rtt.toFixed(0)}ms (${status})`,
        status === "ok" ? "#66ff99" : "#ffaa44"
      );
    });
    if (scanResults.length === 0) {
      addLog("✗ Không tìm thấy gateway nào phản hồi", "#ff6666");
      addLog("  Có thể: bị Chrome chặn, hoặc cần cấp quyền LNA", "#ff6666");
      setPhase("done"); return;
    }
    const bestGW = scanResults[0].ip;
    addLog(`\n✓ Gateway tốt nhất: ${bestGW} (${scanResults[0].rtt.toFixed(0)}ms)`, "#66ff99");
    // ── STEP 2b: Probe chính xác
    setPhase("probe");
    addLog(`\n▶ STEP 2b — Probe ${bestGW} × 10 mẫu...`);
    const result = await probeGatewayRTT(bestGW, 10, ({ i, rtt, status }) => {
      setSamples((s) => [...s, { i, rtt, status }]);
      const rttStr = rtt != null ? `${rtt.toFixed(1)}ms` : "loss";
      const icon   = { ok: "✓", refused: "↯", timeout: "✗" }[status];
      const color  = { ok: "#66ff99", refused: "#ffaa44", timeout: "#ff6666" }[status];
      addLog(`  [${i}/10] ${icon} ${rttStr} (${status})`, color);
    });
    setProbe(result);
    setPhase("done");
    if (result.ok) {
      addLog("\n──────────── KẾT QUẢ ────────────");
      addLog(`avg    ${result.avg.toFixed(2)} ms`, "#ffffff");
      addLog(`min    ${result.min.toFixed(2)} ms`, "#66ff99");
      addLog(`max    ${result.max.toFixed(2)} ms`, "#ffaa44");
      addLog(`jitter ${result.jitter.toFixed(2)} ms`, "#aaddff");
      addLog(`loss   ${result.loss.toFixed(0)}%`,
        result.loss > 0 ? "#ff6666" : "#66ff99");
    }
  };
  const phaseLabel = {
    idle:  "▶ RUN TEST",
    step1: "◉ Step 1: WebRTC...",
    scan:  "◉ Step 2a: Scanning...",
    probe: "◉ Step 2b: Probing...",
    done:  "▶ CHẠY LẠI",
  };
  const busy = ["step1","scan","probe"].includes(phase);
  return (
    <div style={{
      minHeight: "100vh", background: "#080e14", color: "#b8ccd8",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      padding: "28px 18px",
    }}>
      <h2 style={{ fontSize: 15, letterSpacing: 3, color: "#0099ff", marginBottom: 2 }}>
        LAN PROBE — TEST v2
      </h2>
      <p style={{ fontSize: 9, color: "#2a4050", marginBottom: 20, letterSpacing: 1 }}>
        WebRTC ICE → Gateway Scan → RTT Probe
      </p>
      <button onClick={run} disabled={busy} style={{
        background: "transparent",
        border: `1px solid ${busy ? "#1a3040" : "#0077cc"}`,
        color: busy ? "#1a3040" : "#0088ff",
        padding: "9px 26px", fontSize: 10, letterSpacing: 2,
        cursor: busy ? "not-allowed" : "pointer",
        borderRadius: 4, fontFamily: "inherit", marginBottom: 20,
      }}>
        {phaseLabel[phase]}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Log */}
        <div>
          <Label>CONSOLE LOG</Label>
          <Box minHeight={400} maxHeight={500}>
            {log.length === 0
              ? <Muted>Chưa có log — bấm RUN TEST</Muted>
              : log.map((l, i) => (
                <div key={i} style={{ fontSize: 10, color: l.color, marginBottom: 2, lineHeight: 1.5 }}>
                  <span style={{ color: "#1a2d3a", marginRight: 6 }}>{l.t}</span>
                  {l.msg}
                </div>
              ))
            }
          </Box>
        </div>
        <div>
          {/* WebRTC Discovery */}
          <Label>STEP 1 — WebRTC DISCOVERY</Label>
          <Box minHeight={90} style={{ marginBottom: 10 }}>
            {!disc ? <Muted>Chưa chạy</Muted> : (
              <>
                <Row label="Local IPv4"  value={disc.ipv4s.join(", ") || "—"} color="#66ff99" />
                <Row label="mDNS names"  value={disc.mdnsNames.join(", ") || "—"} color="#ffcc44" />
                <Row label="Public IP"   value={disc.publicIP || "—"} color="#4488aa" />
                <Row label="Gateway(s)"  value={disc.gatewayIPs?.join(", ") || "—"} color="#ffcc44" />
              </>
            )}
          </Box>
          {/* Scan results */}
          <Label>STEP 2a — GATEWAY SCAN</Label>
          <Box minHeight={80} style={{ marginBottom: 10 }}>
            {scanRes.length === 0
              ? <Muted>Chưa có</Muted>
              : scanRes.map((s) => (
                <div key={s.ip} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 10, marginBottom: 4,
                  color: s.status === "ok" ? "#66ff99" : "#ffaa44",
                }}>
                  <span>{s.status === "ok" ? "✓" : "↯"} {s.ip}</span>
                  <span>{s.rtt.toFixed(0)}ms <span style={{ color: "#2a4050" }}>({s.status})</span></span>
                </div>
              ))
            }
          </Box>
          {/* Probe samples */}
          <Label>STEP 2b — PROBE SAMPLES</Label>
          <Box minHeight={60} style={{ marginBottom: 10 }}>
            {samples.length === 0 ? <Muted>Chưa có</Muted> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {samples.map((s) => (
                  <span key={s.i} style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 3,
                    background: s.status === "timeout" ? "#200808"
                      : s.status === "refused" ? "#201400" : "#082010",
                    color: s.status === "timeout" ? "#ff6666"
                      : s.status === "refused" ? "#ffaa44" : "#66ff99",
                  }}>
                    #{s.i} {s.rtt != null ? `${s.rtt.toFixed(0)}ms` : "loss"}
                  </span>
                ))}
              </div>
            )}
          </Box>
          {/* Final stats */}
          {probeRes && (
            <>
              <Label>FINAL STATS — {probeRes.ip}</Label>
              <Box>
                {probeRes.ok ? (
                  <>
                    <Row label="avg RTT" value={`${probeRes.avg.toFixed(2)} ms`}
                      color={probeRes.avg < 5 ? "#66ff99" : probeRes.avg < 30 ? "#ffcc44" : "#ff6666"} />
                    <Row label="min"    value={`${probeRes.min.toFixed(2)} ms`} color="#66ff99" />
                    <Row label="max"    value={`${probeRes.max.toFixed(2)} ms`} color="#ffaa44" />
                    <Row label="jitter" value={`${probeRes.jitter.toFixed(2)} ms`}
                      color={probeRes.jitter < 3 ? "#66ff99" : "#ffcc44"} />
                    <Row label="loss"   value={`${probeRes.loss.toFixed(0)}%`}
                      color={probeRes.loss > 0 ? "#ff6666" : "#66ff99"} />
                    <div style={{
                      marginTop: 10, padding: "8px", background: "#060e18",
                      borderRadius: 4, fontSize: 10, color: "#88aabb", lineHeight: 1.7,
                    }}>
                      {probeRes.avg < 5 && probeRes.jitter < 2
                        ? "✓ LAN rất ổn định"
                        : probeRes.avg < 20
                        ? "◉ LAN bình thường, có thể có chút nhiễu"
                        : probeRes.avg < 80
                        ? "⚠ LAN hơi chậm — kiểm tra dây/WiFi"
                        : "✗ LAN rất chậm — router quá tải hoặc cáp kém"}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#ff6666", fontSize: 10 }}>✗ Không đo được</div>
                )}
              </Box>
            </>
          )}
        </div>
      </div>
      {/* Notes */}
      <div style={{
        marginTop: 20, padding: "10px 12px", border: "1px solid #0f2030",
        borderRadius: 5, fontSize: 9, color: "#1a3040", lineHeight: 2,
      }}>
        <div style={{ color: "#2a4050", marginBottom: 2 }}>GHI CHÚ</div>
        <div>▸ Chrome mới ẩn local IP bằng mDNS → code tự fallback sang scan danh sách gateway phổ biến</div>
        <div>▸ Chrome 142+: sẽ hiện popup "Cho phép truy cập mạng nội bộ" → cần bấm Cho phép để đo được</div>
        <div>▸ status=refused vẫn hợp lệ: router trả TCP RST nhanh → RTT đo được từ thời gian kết nối</div>
      </div>
    </div>
  );
}
// ─── UI helpers ───────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <div style={{ fontSize: 8, color: "#1a3040", letterSpacing: 2, marginBottom: 6 }}>{children}</div>
);
const Muted = ({ children }) => (
  <div style={{ color: "#1a2d3a", fontSize: 10 }}>{children}</div>
);
const Box = ({ children, minHeight, maxHeight, style }) => (
  <div style={{
    background: "#050c14", border: "1px solid #0d1e2c",
    borderRadius: 5, padding: "10px 12px",
    minHeight, maxHeight, overflowY: maxHeight ? "auto" : undefined,
    marginBottom: 10, ...style,
  }}>
    {children}
  </div>
);
const Row = ({ label, value, color = "#6699bb" }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
    <span style={{ color: "#2a4050" }}>{label}</span>
    <span style={{ color }}>{value || "—"}</span>
  </div>
);
