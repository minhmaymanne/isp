import { useState, useRef } from "react";
// ─── STEP 1: WebRTC ICE → tìm local IP → suy ra gateway ──────────────────────
function discoverGateway() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pc.close();
      resolve({ ok: false, error: "timeout sau 6s", localIPs: [], gatewayIPs: [] });
    }, 6000);
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const ips = new Set();
    pc.createDataChannel("x");
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      // Trích IP từ SDP candidate string
      const found = e.candidate.candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/g);
      if (found) found.forEach((ip) => ips.add(ip));
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState !== "complete") return;
      clearTimeout(timeout);
      pc.close();
      const allIPs = [...ips].filter((ip) => ip !== "0.0.0.0");
      // Lọc private IP
      const localIPs = allIPs.filter((ip) =>
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      );
      // Suy ra gateway: thay octet cuối = 1
      const gatewayIPs = [
        ...new Set(
          localIPs.map((ip) => {
            const p = ip.split(".");
            return `${p[0]}.${p[1]}.${p[2]}.1`;
          })
        ),
      ];
      resolve({ ok: true, allIPs, localIPs, gatewayIPs });
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o));
  });
}
// ─── STEP 2: Probe gateway N lần, đo RTT mỗi lần ─────────────────────────────
async function probeGatewayRTT(gatewayIP, samples = 10, onResult) {
  const results = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    let status = "";
    try {
      // fetch đến router — Chrome 142+ sẽ show LNA popup lần đầu
      // no-cors: không cần đọc response, chỉ cần biết có phản hồi không
      // IP literal (192.168.x.x) → Chrome miễn mixed-content check tự động
      const res = await fetch(`http://${gatewayIP}/`, {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      const rtt = performance.now() - t0;
      status = "ok";
      results.push({ rtt, status });
      onResult?.({ i: i + 1, rtt, status });
    } catch (err) {
      const rtt = performance.now() - t0;
      if (err.name === "AbortError" || rtt >= 2000) {
        // Timeout thật → mất gói
        status = "timeout";
        results.push({ rtt: null, status });
        onResult?.({ i: i + 1, rtt: null, status });
      } else {
        // Connection refused / network error nhưng nhanh
        // → router phản hồi TCP RST → vẫn đo được RTT
        status = "refused";
        results.push({ rtt, status });
        onResult?.({ i: i + 1, rtt, status });
      }
    }
    // Nghỉ giữa các lần để không flood router
    if (i < samples - 1) await new Promise((r) => setTimeout(r, 400));
  }
  // Tính stats từ các mẫu có RTT hợp lệ
  const valid = results.filter((r) => r.rtt !== null).map((r) => r.rtt);
  const lost  = results.filter((r) => r.rtt === null).length;
  if (valid.length === 0) {
    return { ok: false, error: "Không nhận được phản hồi nào từ router" };
  }
  const avg    = valid.reduce((a, b) => a + b, 0) / valid.length;
  const min    = Math.min(...valid);
  const max    = Math.max(...valid);
  const jitter =
    valid.length > 1
      ? valid.slice(1).reduce((s, v, i) => s + Math.abs(v - valid[i]), 0) /
        (valid.length - 1)
      : 0;
  const loss = (lost / samples) * 100;
  return { ok: true, avg, min, max, jitter, loss, samples, valid: valid.length, results };
}
// ─── UI ───────────────────────────────────────────────────────────────────────
export default function LanProbeTest() {
  const [log, setLog]         = useState([]);
  const [phase, setPhase]     = useState("idle"); // idle | step1 | step2 | done | error
  const [discovery, setDisc]  = useState(null);
  const [probeResult, setRes] = useState(null);
  const [samples, setSamples] = useState([]);
  const running = useRef(false);
  const addLog = (msg, color = "#7aadcc") =>
    setLog((l) => [...l, { msg, color, t: new Date().toLocaleTimeString("vi") }]);
  const run = async () => {
    running.current = true;
    setLog([]); setDisc(null); setRes(null); setSamples([]);
    // ── Step 1
    setPhase("step1");
    addLog("▶ Bắt đầu WebRTC ICE gathering...");
    const disc = await discoverGateway();
    setDisc(disc);
    if (!disc.ok) {
      addLog(`✗ WebRTC thất bại: ${disc.error}`, "#ff6666");
      setPhase("error"); return;
    }
    addLog(`✓ Tìm thấy IP nội bộ: ${disc.localIPs.join(", ")}`, "#66ff99");
    addLog(`✓ Gateway ước tính: ${disc.gatewayIPs.join(", ")}`, "#66ff99");
    if (disc.gatewayIPs.length === 0) {
      addLog("✗ Không suy ra được gateway IP", "#ff6666");
      setPhase("error"); return;
    }
    const gw = disc.gatewayIPs[0];
    // ── Step 2
    setPhase("step2");
    addLog(`▶ Bắt đầu probe ${gw} × 10 lần...`);
    addLog(`ℹ Nếu Chrome hiện popup "Cho phép truy cập mạng nội bộ" → bấm Cho phép`, "#ffcc44");
    const result = await probeGatewayRTT(gw, 10, ({ i, rtt, status }) => {
      setSamples((s) => [...s, { i, rtt, status }]);
      const rttStr = rtt !== null ? `${rtt.toFixed(1)}ms` : "—";
      const icon   = status === "ok" ? "✓" : status === "refused" ? "↯" : "✗";
      const color  = status === "timeout" ? "#ff6666" : status === "refused" ? "#ffaa44" : "#66ff99";
      addLog(`  [${i}/10] ${icon} RTT: ${rttStr}  (${status})`, color);
    });
    setRes(result);
    setPhase("done");
    if (result.ok) {
      addLog("─────────────────────────────────");
      addLog(`avg:    ${result.avg.toFixed(2)} ms`, "#ffffff");
      addLog(`min:    ${result.min.toFixed(2)} ms`, "#66ff99");
      addLog(`max:    ${result.max.toFixed(2)} ms`, "#ffaa44");
      addLog(`jitter: ${result.jitter.toFixed(2)} ms`, "#aaddff");
      addLog(`loss:   ${result.loss.toFixed(0)}%`, result.loss > 0 ? "#ff6666" : "#66ff99");
    } else {
      addLog(`✗ ${result.error}`, "#ff6666");
    }
  };
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f14", color: "#c8dde8",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      padding: "32px 20px",
    }}>
      <h2 style={{ fontSize: 16, letterSpacing: 3, color: "#0099ff", marginBottom: 4 }}>
        LAN PROBE — TEST
      </h2>
      <p style={{ fontSize: 10, color: "#3a5060", marginBottom: 24, letterSpacing: 1 }}>
        WebRTC ICE Discovery → Gateway RTT Probe
      </p>
      {/* Controls */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={run}
          disabled={phase === "step1" || phase === "step2"}
          style={{
            background: "transparent",
            border: `1px solid ${phase === "step1" || phase === "step2" ? "#1a3a4a" : "#0088ff"}`,
            color:  phase === "step1" || phase === "step2" ? "#1a3a4a" : "#0088ff",
            padding: "9px 28px", fontSize: 11, letterSpacing: 2,
            cursor: phase === "step1" || phase === "step2" ? "not-allowed" : "pointer",
            borderRadius: 4, fontFamily: "inherit",
          }}
        >
          {phase === "step1" ? "◉ Step 1: Discovering..." :
           phase === "step2" ? "◉ Step 2: Probing..." :
           "▶ RUN TEST"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Log */}
        <div>
          <div style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2, marginBottom: 8 }}>
            CONSOLE LOG
          </div>
          <div style={{
            background: "#060c12", border: "1px solid #0f2030",
            borderRadius: 5, padding: "12px 14px", minHeight: 320,
            maxHeight: 420, overflowY: "auto",
          }}>
            {log.length === 0 && (
              <div style={{ color: "#1a3040", fontSize: 10 }}>Chưa có log. Bấm RUN TEST.</div>
            )}
            {log.map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: l.color, marginBottom: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a3040", marginRight: 8 }}>{l.t}</span>
                {l.msg}
              </div>
            ))}
          </div>
        </div>
        {/* Results */}
        <div>
          {/* Discovery */}
          <div style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2, marginBottom: 8 }}>
            STEP 1 — WebRTC DISCOVERY
          </div>
          <div style={{
            background: "#060c12", border: "1px solid #0f2030",
            borderRadius: 5, padding: "12px 14px", marginBottom: 12,
          }}>
            {!discovery ? (
              <div style={{ color: "#1a3040", fontSize: 10 }}>Chưa chạy</div>
            ) : (
              <>
                <Row label="Status"     value={discovery.ok ? "✓ OK" : `✗ ${discovery.error}`}
                  color={discovery.ok ? "#66ff99" : "#ff6666"} />
                <Row label="All IPs"    value={discovery.allIPs?.join(", ") || "—"} />
                <Row label="Local IPs"  value={discovery.localIPs?.join(", ") || "—"} color="#66ff99" />
                <Row label="Gateway(s)" value={discovery.gatewayIPs?.join(", ") || "—"} color="#ffcc44" />
              </>
            )}
          </div>
          {/* Probe samples */}
          <div style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2, marginBottom: 8 }}>
            STEP 2 — GATEWAY PROBE SAMPLES
          </div>
          <div style={{
            background: "#060c12", border: "1px solid #0f2030",
            borderRadius: 5, padding: "12px 14px", marginBottom: 12,
            minHeight: 100,
          }}>
            {samples.length === 0 ? (
              <div style={{ color: "#1a3040", fontSize: 10 }}>Chưa có mẫu</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {samples.map((s) => (
                  <div key={s.i} style={{
                    fontSize: 9, padding: "3px 7px", borderRadius: 3,
                    background: s.status === "timeout" ? "#2a0808"
                      : s.status === "refused" ? "#2a1a00" : "#082a12",
                    color: s.status === "timeout" ? "#ff6666"
                      : s.status === "refused" ? "#ffaa44" : "#66ff99",
                    border: `1px solid ${s.status === "timeout" ? "#ff666630"
                      : s.status === "refused" ? "#ffaa4430" : "#66ff9930"}`,
                  }}>
                    #{s.i} {s.rtt !== null ? `${s.rtt.toFixed(0)}ms` : "loss"}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Final stats */}
          {probeResult && (
            <>
              <div style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2, marginBottom: 8 }}>
                STEP 2 — FINAL STATS
              </div>
              <div style={{
                background: "#060c12",
                border: `1px solid ${probeResult.ok ? "#0f3020" : "#300f0f"}`,
                borderRadius: 5, padding: "12px 14px",
              }}>
                {probeResult.ok ? (
                  <>
                    <Row label="avg RTT" value={`${probeResult.avg.toFixed(2)} ms`}
                      color={probeResult.avg < 10 ? "#66ff99" : probeResult.avg < 50 ? "#ffcc44" : "#ff6666"} />
                    <Row label="min RTT" value={`${probeResult.min.toFixed(2)} ms`} color="#66ff99" />
                    <Row label="max RTT" value={`${probeResult.max.toFixed(2)} ms`} color="#ffaa44" />
                    <Row label="jitter"  value={`${probeResult.jitter.toFixed(2)} ms`}
                      color={probeResult.jitter < 5 ? "#66ff99" : "#ffcc44"} />
                    <Row label="loss"    value={`${probeResult.loss.toFixed(0)}%`}
                      color={probeResult.loss > 0 ? "#ff6666" : "#66ff99"} />
                    <Row label="samples" value={`${probeResult.valid}/${probeResult.samples} valid`} />
                    {/* Đánh giá sơ bộ */}
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a1820", borderRadius: 4 }}>
                      <div style={{ fontSize: 9, color: "#2a4a5a", marginBottom: 4 }}>NHẬN XÉT SƠ BỘ</div>
                      <div style={{ fontSize: 10, color: "#aabbcc", lineHeight: 1.7 }}>
                        {probeResult.avg < 5 && probeResult.jitter < 2
                          ? "✓ LAN rất ổn định. Kết nối dây hoặc WiFi gần router."
                          : probeResult.avg < 20 && probeResult.jitter < 8
                          ? "◉ LAN bình thường. Có thể có chút nhiễu."
                          : probeResult.avg < 50
                          ? "⚠ LAN hơi chậm. Kiểm tra dây mạng hoặc WiFi."
                          : "✗ LAN rất chậm. Router quá tải hoặc kết nối kém."}
                        {probeResult.loss > 5 && (
                          <span style={{ color: "#ff6666", display: "block", marginTop: 3 }}>
                            ⚠ Mất {probeResult.loss.toFixed(0)}% gói — đầu RJ45 hoặc cáp nghi vấn.
                          </span>
                        )}
                        {/* Ghi chú về status "refused" */}
                        {probeResult.results?.some(r => r.status === "refused") && (
                          <span style={{ color: "#ffaa44", display: "block", marginTop: 3 }}>
                            ↯ Router từ chối HTTP nhưng TCP vẫn phản hồi → RTT vẫn hợp lệ.
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#ff6666", fontSize: 10 }}>✗ {probeResult.error}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Ghi chú kỹ thuật */}
      <div style={{
        marginTop: 24, padding: "10px 14px",
        border: "1px solid #0f2030", borderRadius: 5,
        fontSize: 9, color: "#1a3040", lineHeight: 2,
      }}>
        <div style={{ color: "#2a4050", marginBottom: 3 }}>GHI CHÚ KỸ THUẬT</div>
        <div>▸ Step 1: RTCPeerConnection ICE gathering — không đi qua internet, chỉ dùng STUN để lấy IP</div>
        <div>▸ Step 2: fetch("http://192.168.x.1/") với mode=no-cors — IP literal nên không bị mixed content block</div>
        <div>▸ Chrome 142+: sẽ hiện popup LNA lần đầu tiên → user cần bấm "Cho phép"</div>
        <div>▸ status=ok: router trả 2xx/3xx | refused: TCP RST nhưng RTT vẫn đo được | timeout: mất gói</div>
      </div>
    </div>
  );
}
// Helper component
function Row({ label, value, color = "#7aadcc" }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      fontSize: 10, marginBottom: 5, fontFamily: "monospace",
    }}>
      <span style={{ color: "#3a5060" }}>{label}</span>
      <span style={{ color }}>{value || "—"}</span>
    </div>
  );
}
