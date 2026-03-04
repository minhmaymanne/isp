import { useState, useRef } from "react";

const COMMON_GATEWAYS = ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1", "192.168.88.1"];

// ─── STEP 1: WebRTC ICE → tìm local IP → suy ra gateway ──────────────────────
function discoverGateway() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const timeout = setTimeout(() => {
      pc.close();
      resolve({ ok: false, error: "timeout sau 6s", allIPs: [], localIPs: [], gatewayIPs: [] });
    }, 6000);
    const ips = new Set();
    pc.createDataChannel("x");
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const found = e.candidate.candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/g);
      if (found) found.forEach((ip) => ips.add(ip));
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState !== "complete") return;
      clearTimeout(timeout);
      pc.close();
      const allIPs = [...ips].filter((ip) => ip !== "0.0.0.0");
      const localIPs = allIPs.filter((ip) =>
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      );
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
      await fetch(`http://${gatewayIP}/`, {
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
        status = "timeout";
        results.push({ rtt: null, status });
        onResult?.({ i: i + 1, rtt: null, status });
      } else {
        status = "refused";
        results.push({ rtt, status });
        onResult?.({ i: i + 1, rtt, status });
      }
    }
    if (i < samples - 1) await new Promise((r) => setTimeout(r, 400));
  }
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
  const [phase, setPhase]     = useState("idle");
  const [discovery, setDisc]  = useState(null);
  const [probeResult, setRes] = useState(null);
  const [samples, setSamples] = useState([]);
  const [gatewayInput, setGatewayInput] = useState("192.168.1.1");
  const [mode, setMode]       = useState("manual"); // manual | auto
  const running = useRef(false);

  const addLog = (msg, color = "#7aadcc") =>
    setLog((l) => [...l, { msg, color, t: new Date().toLocaleTimeString("vi") }]);

  const runProbe = async (gw) => {
    setPhase("step2");
    setSamples([]);
    setRes(null);
    addLog(`▶ Probe ${gw} × 10 lần...`);
    addLog(`ℹ Chrome có thể hiện popup "Cho phép truy cập mạng nội bộ" → bấm Cho phép`, "#ffcc44");
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
    running.current = false;
  };

  const runManual = async () => {
    if (running.current) return;
    running.current = true;
    setLog([]); setDisc(null); setRes(null); setSamples([]);
    const gw = gatewayInput.trim();
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(gw)) {
      addLog("✗ IP không hợp lệ", "#ff6666");
      setPhase("error"); running.current = false; return;
    }
    addLog(`▶ Chế độ thủ công — Gateway: ${gw}`);
    setDisc({ ok: true, allIPs: [], localIPs: [], gatewayIPs: [gw], manual: true });
    await runProbe(gw);
  };

  const runAuto = async () => {
    if (running.current) return;
    running.current = true;
    setLog([]); setDisc(null); setRes(null); setSamples([]);
    // Step 1: WebRTC
    setPhase("step1");
    addLog("▶ WebRTC ICE gathering...");
    const disc = await discoverGateway();
    setDisc(disc);
    if (disc.ok) {
      addLog(`  Public IP: ${disc.allIPs.filter(ip => !disc.localIPs.includes(ip)).join(", ") || "—"}`, "#7aadcc");
      addLog(`  Local IPs: ${disc.localIPs.join(", ") || "(trình duyệt ẩn — dùng chế độ thủ công)"}`,
        disc.localIPs.length > 0 ? "#66ff99" : "#ffaa44");
    }
    let gw = null;
    if (disc.ok && disc.gatewayIPs.length > 0) {
      gw = disc.gatewayIPs[0];
      addLog(`✓ Gateway tìm được: ${gw}`, "#66ff99");
    } else {
      // Fallback: thử các gateway phổ biến
      addLog("⚠ Trình duyệt ẩn local IP. Thử gateway phổ biến...", "#ffcc44");
      for (const tryGw of COMMON_GATEWAYS) {
        addLog(`  Thử ${tryGw}...`, "#7aadcc");
        const t0 = performance.now();
        try {
          await fetch(`http://${tryGw}/`, {
            mode: "no-cors", cache: "no-store",
            signal: AbortSignal.timeout(1500),
          });
          gw = tryGw;
          addLog(`  ✓ ${tryGw} phản hồi sau ${(performance.now() - t0).toFixed(0)}ms`, "#66ff99");
          break;
        } catch (err) {
          const elapsed = performance.now() - t0;
          if (err.name !== "AbortError" && elapsed < 1500) {
            // TCP RST = router tồn tại
            gw = tryGw;
            addLog(`  ↯ ${tryGw} TCP RST sau ${elapsed.toFixed(0)}ms — router tồn tại`, "#ffaa44");
            break;
          }
          addLog(`  ✗ ${tryGw} timeout`, "#ff6666");
        }
      }
      if (gw) {
        setDisc((d) => ({ ...d, gatewayIPs: [gw], autoDetected: true }));
        addLog(`✓ Gateway phát hiện: ${gw}`, "#66ff99");
      } else {
        addLog("✗ Không tìm được gateway. Hãy dùng chế độ THỦ CÔNG.", "#ff6666");
        setPhase("error"); running.current = false; return;
      }
    }
    await runProbe(gw);
  };

  const isRunning = phase === "step1" || phase === "step2";
  const inputStyle = {
    background: "#060c12", border: "1px solid #0f2030", color: "#c8dde8",
    padding: "7px 12px", fontSize: 12, borderRadius: 4, fontFamily: "inherit",
    outline: "none", width: 160,
  };
  const btnBase = {
    background: "transparent", fontSize: 11, letterSpacing: 2,
    borderRadius: 4, fontFamily: "inherit", padding: "9px 22px",
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
      <p style={{ fontSize: 10, color: "#3a5060", marginBottom: 20, letterSpacing: 1 }}>
        Gateway RTT Probe — Đo độ trễ mạng nội bộ
      </p>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {[["manual", "THỦ CÔNG"], ["auto", "TỰ ĐỘNG"]].map(([m, label]) => (
          <button key={m} onClick={() => !isRunning && setMode(m)} style={{
            ...btnBase, padding: "6px 18px", fontSize: 9, letterSpacing: 2,
            border: `1px solid ${mode === m ? "#0088ff" : "#0f2030"}`,
            color: mode === m ? "#0088ff" : "#3a5060",
            cursor: isRunning ? "not-allowed" : "pointer",
            borderRadius: m === "manual" ? "4px 0 0 4px" : "0 4px 4px 0",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {mode === "manual" ? (
          <>
            <input
              value={gatewayInput}
              onChange={(e) => setGatewayInput(e.target.value)}
              placeholder="192.168.1.1"
              disabled={isRunning}
              style={{ ...inputStyle, opacity: isRunning ? 0.4 : 1 }}
              onKeyDown={(e) => e.key === "Enter" && runManual()}
            />
            {/* Quick buttons */}
            <div style={{ display: "flex", gap: 4 }}>
              {COMMON_GATEWAYS.map((ip) => (
                <button key={ip} onClick={() => { setGatewayInput(ip); }} disabled={isRunning}
                  style={{
                    ...btnBase, padding: "4px 8px", fontSize: 8, letterSpacing: 0,
                    border: `1px solid ${gatewayInput === ip ? "#0066cc" : "#0f2030"}`,
                    color: gatewayInput === ip ? "#0088ff" : "#2a4a5a",
                    cursor: isRunning ? "not-allowed" : "pointer",
                  }}>
                  {ip}
                </button>
              ))}
            </div>
            <button onClick={runManual} disabled={isRunning} style={{
              ...btnBase,
              border: `1px solid ${isRunning ? "#1a3a4a" : "#0088ff"}`,
              color: isRunning ? "#1a3a4a" : "#0088ff",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}>
              {isRunning ? "◉ Probing..." : "▶ PROBE"}
            </button>
          </>
        ) : (
          <button onClick={runAuto} disabled={isRunning} style={{
            ...btnBase,
            border: `1px solid ${isRunning ? "#1a3a4a" : "#0088ff"}`,
            color: isRunning ? "#1a3a4a" : "#0088ff",
            cursor: isRunning ? "not-allowed" : "pointer",
          }}>
            {phase === "step1" ? "◉ Discovering..." :
             phase === "step2" ? "◉ Probing..." :
             "▶ AUTO DETECT & PROBE"}
          </button>
        )}
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
              <div style={{ color: "#1a3040", fontSize: 10 }}>
                {mode === "manual"
                  ? "Nhập IP gateway rồi bấm PROBE."
                  : "Bấm AUTO DETECT & PROBE để bắt đầu."}
              </div>
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
            GATEWAY INFO
          </div>
          <div style={{
            background: "#060c12", border: "1px solid #0f2030",
            borderRadius: 5, padding: "12px 14px", marginBottom: 12,
          }}>
            {!discovery ? (
              <div style={{ color: "#1a3040", fontSize: 10 }}>Chưa chạy</div>
            ) : (
              <>
                <Row label="Mode" value={discovery.manual ? "Thủ công" : discovery.autoDetected ? "Auto-detect" : "WebRTC"} />
                <Row label="Gateway" value={discovery.gatewayIPs?.join(", ") || "—"} color="#ffcc44" />
                {discovery.localIPs?.length > 0 && (
                  <Row label="Local IPs" value={discovery.localIPs.join(", ")} color="#66ff99" />
                )}
                {discovery.allIPs?.filter(ip => !discovery.localIPs?.includes(ip)).length > 0 && (
                  <Row label="Public IP" value={discovery.allIPs.filter(ip => !discovery.localIPs?.includes(ip)).join(", ")} />
                )}
              </>
            )}
          </div>
          {/* Probe samples */}
          <div style={{ fontSize: 9, color: "#2a4a5a", letterSpacing: 2, marginBottom: 8 }}>
            PROBE SAMPLES
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
                FINAL STATS
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
        <div>▸ THỦ CÔNG: Nhập IP gateway (thường 192.168.1.1 hoặc 192.168.0.1) → probe trực tiếp</div>
        <div>▸ TỰ ĐỘNG: WebRTC ICE → nếu trình duyệt ẩn local IP → thử lần lượt các gateway phổ biến</div>
        <div>▸ fetch("http://gateway/") mode=no-cors — IP literal nên Chrome cho phép mixed-content</div>
        <div>▸ Chrome có thể hiện popup LNA (Local Network Access) → bấm "Cho phép" để tiếp tục</div>
        <div>▸ status: ok = HTTP response | refused = TCP RST (RTT vẫn hợp lệ) | timeout = mất gói</div>
      </div>
    </div>
  );
}

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
