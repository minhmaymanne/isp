import { useState, useEffect, useRef, useCallback } from "react";
import { TARGETS, TARGET_GROUPS, SCAN_SCOPES, CONN_TYPES, COLO_MAP, PHASES, BOOT_LINES, detectISP, vietnamizeCity, countryFlag, countryNameVI } from "./data.js";
import {
  fetchCFTrace, fetchGeoIP, measureLatency,
  measureDownload, measureUpload, probeWAN,
  probeDNS, readNetworkInfo, readResourceTiming,
  probeInternationalTargets, scanGateways, probeGateway,
  bufferBloatTest, mean,
} from "./engines.js";
import { crossAnalyze, calculateScore, computeVerdicts } from "./analysis.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function gradeOf(s) {
  if (s >= 92) return { g: "S+", c: "#00ffd5", l: "EXCEPTIONAL" };
  if (s >= 80) return { g: "A", c: "#00e676", l: "EXCELLENT" };
  if (s >= 65) return { g: "B", c: "#c6ff00", l: "GOOD" };
  if (s >= 50) return { g: "C", c: "#ffd600", l: "FAIR" };
  return { g: "D", c: "#ff1744", l: "POOR" };
}

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS: HEX GRID + PARTICLES + DATA RAIN
// ═══════════════════════════════════════════════════════════════════════
function CommandCanvas({ phase }) {
  const ref = useRef(null);
  const frameRef = useRef(0);
  const particles = useRef([]);
  const streams = useRef([]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let W, H;
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    const N = 55;
    particles.current = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.2 + .3, life: Math.random(),
    }));
    const cols = Math.floor(W / 20);
    streams.current = Array.from({ length: cols }, () => ({
      y: Math.random() * H * 2 - H, speed: Math.random() * 1.5 + .8,
      len: Math.floor(Math.random() * 12 + 4),
    }));
    let running = true;
    const active = phase === "running" || phase === "done";
    const draw = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H / 2, W * .15, W / 2, H / 2, W * .75);
      vg.addColorStop(0, "transparent"); vg.addColorStop(1, "rgba(0,0,0,.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const sz = 42, h = sz * Math.sqrt(3);
      for (let row = -1; row < H / h + 1; row++) {
        for (let col = -1; col < W / (sz * 1.5) + 1; col++) {
          const x = col * sz * 1.5, y = row * h + (col % 2 ? h / 2 : 0);
          const pulse = Math.sin(t * .0008 + col * .25 + row * .18) * .5 + .5;
          ctx.strokeStyle = active && pulse > .88 ? `rgba(0,255,213,${pulse * .05})` : (active ? "rgba(0,180,216,.025)" : "rgba(0,180,216,.012)");
          ctx.lineWidth = .5; ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i - Math.PI / 6;
            const px = x + sz * .42 * Math.cos(a), py = y + sz * .42 * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.stroke();
        }
      }
      if (active) {
        ctx.font = "9px 'IBM Plex Mono',monospace";
        for (const s of streams.current) {
          s.y += s.speed; if (s.y > H + 200) s.y = -80;
          const x = streams.current.indexOf(s) * 20;
          for (let i = 0; i < s.len; i++) {
            const cy = s.y - i * 13; if (cy < -13 || cy > H + 13) continue;
            const alpha = i === 0 ? .45 : Math.max(0, (1 - i / s.len) * .12);
            ctx.fillStyle = i === 0 ? `rgba(0,255,213,${alpha})` : `rgba(0,180,216,${alpha})`;
            ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), x, cy);
          }
        }
      }
      const ps = particles.current;
      for (const p of ps) { p.x += p.vx * (active ? 2 : 1); p.y += p.vy * (active ? 2 : 1); if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; }
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d2 = dx * dx + dy * dy;
          if (d2 < 14000) { const a = (1 - d2 / 14000) * (active ? .07 : .025); ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.strokeStyle = `rgba(0,255,213,${a})`; ctx.lineWidth = .4; ctx.stroke(); }
        }
      }
      for (const p of ps) { const glow = Math.sin(t * .003 + p.life * 10) * .4 + .6; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * glow, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,255,213,${glow * (active ? .2 : .08)})`; ctx.fill(); }
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { running = false; cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); };
  }, [phase]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ═══════════════════════════════════════════════════════════════════════
//  RADAR SWEEP
// ═══════════════════════════════════════════════════════════════════════
function RadarSweep({ size = 250, score, active }) {
  const g = score != null ? gradeOf(score) : { c: "#00b4d8", g: "—", l: "SCANNING" };
  const [disp, setDisp] = useState(0);
  const [sweep, setSweep] = useState(0);
  useEffect(() => { if (!active && score == null) return; const i = setInterval(() => setSweep(p => (p + 2.5) % 360), 30); return () => clearInterval(i); }, [active, score]);
  useEffect(() => { if (score == null) { setDisp(0); return; } let c = 0; const i = setInterval(() => { c++; if (c > score) { clearInterval(i); return; } setDisp(c); }, 22); return () => clearInterval(i); }, [score]);
  const r = size / 2 - 22, cx = size / 2, cy = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ position: "absolute", inset: -35, borderRadius: "50%", background: `radial-gradient(circle,${g.c}08 0%,transparent 55%)`, filter: "blur(35px)" }} />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="rg"><stop offset="0%" stopColor={g.c} stopOpacity=".12" /><stop offset="100%" stopColor={g.c} stopOpacity="0" /></radialGradient>
          <filter id="gl"><feGaussianBlur stdDeviation="3" result="g" /><feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[.25, .5, .75, 1].map((f, i) => <circle key={i} cx={cx} cy={cy} r={r * f} fill="none" stroke="rgba(0,180,216,.05)" strokeWidth=".5" strokeDasharray={i < 3 ? "2 5" : "none"} />)}
        {[0, 45, 90, 135].map(a => <line key={a} x1={cx + Math.cos(a * Math.PI / 180) * r * .12} y1={cy + Math.sin(a * Math.PI / 180) * r * .12} x2={cx + Math.cos(a * Math.PI / 180) * r} y2={cy + Math.sin(a * Math.PI / 180) * r} stroke="rgba(0,180,216,.035)" strokeWidth=".5" />)}
        {active && <><line x1={cx} y1={cy} x2={cx + Math.cos(sweep * Math.PI / 180) * r} y2={cy + Math.sin(sweep * Math.PI / 180) * r} stroke={g.c} strokeWidth="1" opacity=".35" filter="url(#gl)" />
          <path d={`M${cx},${cy} L${cx + Math.cos(sweep * Math.PI / 180) * r},${cy + Math.sin(sweep * Math.PI / 180) * r} A${r},${r} 0 0,0 ${cx + Math.cos((sweep - 35) * Math.PI / 180) * r},${cy + Math.sin((sweep - 35) * Math.PI / 180) * r} Z`} fill="url(#rg)" opacity=".5" /></>}
        {score != null && (() => { const pct = disp / 100, sA = -90, eA = sA + pct * 360, sR = sA * Math.PI / 180, eR = eA * Math.PI / 180, rr = r + 7; return <path d={`M${cx + rr * Math.cos(sR)},${cy + rr * Math.sin(sR)} A${rr},${rr} 0 ${pct > .5 ? 1 : 0},1 ${cx + rr * Math.cos(eR)},${cy + rr * Math.sin(eR)}`} fill="none" stroke={g.c} strokeWidth="3" strokeLinecap="round" filter="url(#gl)" opacity=".8" />; })()}
        {Array.from({ length: 60 }).map((_, i) => { const a = (i * 6 - 90) * Math.PI / 180, m = i % 5 === 0; return <line key={i} x1={cx + (r + (m ? 10 : 12)) * Math.cos(a)} y1={cy + (r + (m ? 10 : 12)) * Math.sin(a)} x2={cx + (r + (m ? 18 : 15)) * Math.cos(a)} y2={cy + (r + (m ? 18 : 15)) * Math.sin(a)} stroke={m ? "rgba(0,255,213,.12)" : "rgba(0,180,216,.05)"} strokeWidth={m ? 1 : .5} />; })}
        {active && TARGETS.slice(0, 8).map((t, i) => { const a = (i * 45 + sweep * .25) * Math.PI / 180, d = r * (.25 + Math.sin(i * 2.1) * .35); return <circle key={i} cx={cx + d * Math.cos(a)} cy={cy + d * Math.sin(a)} r="2.5" fill={g.c} opacity={Math.sin(sweep * .025 + i) * .35 + .25} filter="url(#gl)" />; })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {score != null ? <>
          <div style={{ fontSize: 12, fontWeight: 800, color: g.c, letterSpacing: 8, fontFamily: "var(--ff-display)", textShadow: `0 0 25px ${g.c}40` }}>{g.g}</div>
          <div style={{ fontSize: 54, fontWeight: 900, fontFamily: "var(--ff-display)", color: "#e0f7fa", lineHeight: 1, textShadow: `0 0 40px ${g.c}20` }}>{disp}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,.18)", letterSpacing: 4, marginTop: 2 }}>/ 100</div>
          <div style={{ fontSize: 9, color: g.c, fontWeight: 600, marginTop: 8, letterSpacing: 3 }}>{g.l}</div>
        </> : active ? <div style={{ fontSize: 10, color: "#00ffd5", fontFamily: "var(--ff-display)", animation: "pulse 1.5s ease infinite", letterSpacing: 5 }}>SCANNING</div>
          : <div style={{ fontSize: 8, color: "rgba(255,255,255,.06)", letterSpacing: 4 }}>STANDBY</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SPEED GAUGE
// ═══════════════════════════════════════════════════════════════════════
function SpeedGauge({ value, max, label, unit, color = "#00ffd5", size = 135 }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { if (value == null) return; let f = 0; const i = setInterval(() => { f += max / 55; if (f >= value) { setAnim(value); clearInterval(i); return; } setAnim(f); }, 22); return () => clearInterval(i); }, [value, max]);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, startA = 140, endA = 400, range = endA - startA;
  const pct = clamp((anim || 0) / max, 0, 1), valA = startA + pct * range;
  const arc = (f, t, R) => { const fr = f * Math.PI / 180, tr = t * Math.PI / 180; return `M${cx + R * Math.cos(fr)},${cy + R * Math.sin(fr)} A${R},${R} 0 ${t - f > 180 ? 1 : 0},1 ${cx + R * Math.cos(tr)},${cy + R * Math.sin(tr)}`; };
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id={`sg${label}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color} stopOpacity=".3" /></linearGradient></defs>
        <path d={arc(startA, endA, r)} fill="none" stroke="rgba(255,255,255,.03)" strokeWidth="5" strokeLinecap="round" />
        {Array.from({ length: 21 }).map((_, i) => { const a = (startA + i * (range / 20)) * Math.PI / 180, m = i % 5 === 0; return <line key={i} x1={cx + (r - 5) * Math.cos(a)} y1={cy + (r - 5) * Math.sin(a)} x2={cx + (r + (m ? 5 : 2)) * Math.cos(a)} y2={cy + (r + (m ? 5 : 2)) * Math.sin(a)} stroke={m ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.03)"} strokeWidth={m ? 1 : .5} />; })}
        {pct > 0 && <path d={arc(startA, valA, r)} fill="none" stroke={`url(#sg${label})`} strokeWidth="5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />}
        {pct > 0 && (() => { const a = valA * Math.PI / 180; return <circle cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="4" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />; })()}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 8 }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "var(--ff-display)", color: "#e0f7fa", textShadow: `0 0 15px ${color}25` }}>{value != null ? Math.round(anim) : "—"}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.25)", letterSpacing: 2 }}>{unit}</div>
        <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: 3, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  OSCILLOSCOPE
// ═══════════════════════════════════════════════════════════════════════
function Oscilloscope({ data = [], color = "#00ffd5", height = 65, label, active }) {
  const [noise, setNoise] = useState([]);
  useEffect(() => { if (!active) return; const i = setInterval(() => setNoise(Array.from({ length: 40 }, () => Math.random() * 30 + 10)), 100); return () => clearInterval(i); }, [active]);
  const d = data.length > 0 ? data : noise; if (!d.length) return null;
  const mx = Math.max(...d) * 1.2 || 1;
  const pts = d.map((v, i) => [(i / (d.length - 1 || 1)) * 100, height - ((v / mx) * (height - 8)) - 4]);
  return (
    <div>
      {label && <div style={{ fontSize: 9, color: "rgba(255,255,255,.25)", letterSpacing: 2, marginBottom: 4 }}>{label}</div>}
      <div style={{ background: "rgba(0,0,0,.35)", borderRadius: 3, border: "1px solid rgba(0,180,216,.06)", padding: 3, position: "relative", overflow: "hidden" }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
          {[.25, .5, .75].map(f => <line key={f} x1="0" y1={height * f} x2="100" y2={height * f} stroke="rgba(0,180,216,.03)" strokeWidth=".3" />)}
          <defs><linearGradient id={`of${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <polygon points={[`0,${height}`, ...pts.map(p => p.join(",")), `100,${height}`].join(" ")} fill={`url(#of${color.slice(1)})`} />
          <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${color}50)` }} />
          {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />}
        </svg>
        {active && <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: `linear-gradient(180deg,transparent,${color}35,transparent)`, animation: "oscScan 2s linear infinite" }} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  HUD PANEL + METRIC
// ═══════════════════════════════════════════════════════════════════════
function HudPanel({ children, title, icon, status, accent = "#00b4d8", delay = 0, span, glow }) {
  const cs = 10;
  const Corner = ({ pos }) => {
    const s = { position: "absolute", width: cs, height: cs };
    const b = `1.5px solid ${accent}35`;
    if (pos === "tl") return <div style={{ ...s, top: -1, left: -1, borderTop: b, borderLeft: b }} />;
    if (pos === "tr") return <div style={{ ...s, top: -1, right: -1, borderTop: b, borderRight: b }} />;
    if (pos === "bl") return <div style={{ ...s, bottom: -1, left: -1, borderBottom: b, borderLeft: b }} />;
    return <div style={{ ...s, bottom: -1, right: -1, borderBottom: b, borderRight: b }} />;
  };
  return (
    <div style={{ position: "relative", background: "rgba(4,10,20,.72)", backdropFilter: "blur(12px) saturate(1.2)", border: `1px solid ${accent}10`, borderRadius: 2, overflow: "hidden", animation: `hudIn .5s ease ${delay}s both`, gridColumn: span ? `span ${span}` : "auto", boxShadow: glow ? `0 0 25px ${accent}06, inset 0 0 20px ${accent}03` : "none" }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {title && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon && <span style={{ fontSize: 13, filter: `drop-shadow(0 0 3px ${accent}35)` }}>{icon}</span>}
          <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: 3, fontFamily: "var(--ff-display)" }}>{title}</span>
        </div>
        {status && <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: status === "done" ? "#00e676" : status === "active" ? "#00ffd5" : "rgba(255,255,255,.08)", boxShadow: status === "active" ? "0 0 6px #00ffd5" : "none", animation: status === "active" ? "pulse .8s infinite" : "none" }} />
          <span style={{ fontSize: 8, color: "rgba(255,255,255,.25)", letterSpacing: 2, fontFamily: "var(--ff-display)" }}>{status.toUpperCase()}</span>
        </div>}
      </div>}
      <div style={{ padding: "10px 16px 16px" }}>{children}</div>
      {glow && <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: `linear-gradient(90deg,transparent,${accent}25,transparent)` }} />}
    </div>
  );
}

function M({ l, v, u, q, s }) {
  const c = q === "good" ? "#00ffd5" : q === "ok" ? "#c6ff00" : q === "warn" ? "#ffd600" : q === "bad" ? "#ff1744" : null;
  return (<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: `${s ? 4 : 6}px 0`, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
    <span style={{ fontSize: s ? 10 : 11, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>{l}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: s ? 12 : 14, fontWeight: 700, color: c || "#f0f8ff", fontFamily: "var(--ff-display)", textShadow: c ? `0 0 6px ${c}30` : "none" }}>{v ?? "—"}</span>
      {u && <span style={{ fontSize: 9, color: "rgba(255,255,255,.35)" }}>{u}</span>}
      {c && <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}`, display: "inline-block" }} />}
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════
//  TARGET GRID + FINDING CARD + PHASE TIMELINE + BOOT TERMINAL
// ═══════════════════════════════════════════════════════════════════════
function TargetGrid({ targets, activeId, groups }) {
  return (<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {(groups || TARGET_GROUPS).map(group => {
      const groupDone = group.targets.filter(t => targets?.[t.id]).length;
      const groupTotal = group.targets.length;
      const groupActive = group.targets.some(t => t.id === activeId);
      return (<div key={group.id} className="np-tg-group">
        {/* Group header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>{group.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: group.accent, letterSpacing: 3, fontFamily: "var(--ff-display)" }}>{group.name}</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${group.accent}30, transparent)` }} />
          {groupDone > 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,.3)", fontFamily: "var(--ff-display)" }}>{groupDone}/{groupTotal}</span>}
          {groupActive && <span style={{ fontSize: 8, color: group.accent, animation: "pulse .6s infinite" }}>SCANNING</span>}
        </div>
        {/* Apps grid */}
        <div className="np-tg-apps">
          {group.targets.map(t => {
            const r = targets?.[t.id], isA = activeId === t.id;
            const lc = !r ? "rgba(255,255,255,.06)" : r.avg == null ? "#ff5252" : r.avg < 50 ? "#00ffd5" : r.avg < 100 ? "#c6ff00" : r.avg < 200 ? "#ffd600" : "#ff9100";
            const qLabel = !r ? null : r.avg == null ? "TIMEOUT" : r.avg < 30 ? "Tuyệt vời" : r.avg < 80 ? "Tốt" : r.avg < 150 ? "Khá" : r.avg < 300 ? "Chậm" : "Rất chậm";
            return (<div key={t.id} className={`np-tg-app${isA ? " np-tg-active" : ""}${r ? " np-tg-done" : ""}`} style={{ "--tg-accent": isA ? group.accent : lc }}>
              {isA && <div className="np-tg-glow" style={{ "--glow-color": group.accent }} />}
              {r && !isA && <div className="np-tg-done-glow" style={{ "--done-color": lc }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", zIndex: 2 }}>
                {r?.favicon ? <img src={r.favicon} alt="" width="18" height="18" style={{ borderRadius: 3, objectFit: "contain", filter: isA ? "brightness(1.3)" : "none", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = ""; }} /> : null}
                <span style={{ fontSize: r?.favicon ? 0 : 14, width: r?.favicon ? 0 : 18, height: 18, display: r?.favicon ? "none" : "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: r ? 1 : .25, filter: isA ? "brightness(1.4)" : "none" }}>{r ? t.icon : "◌"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: r ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  {r && qLabel && <div style={{ fontSize: 7, fontWeight: 600, color: lc, letterSpacing: 1 }}>{qLabel}</div>}
                </div>
                <div style={{ textAlign: "right", minWidth: 28 }}>
                  {isA ? <span className="np-tg-scanning" style={{ color: group.accent }}>●●●</span>
                    : r ? <><div style={{ fontSize: 14, fontWeight: 900, color: lc, fontFamily: "var(--ff-display)", textShadow: `0 0 8px ${lc}40` }}>{r.avg ?? "✕"}</div><div style={{ fontSize: 6, color: "rgba(255,255,255,.25)", letterSpacing: 1 }}>MS</div></>
                      : <div style={{ fontSize: 9, color: "rgba(255,255,255,.06)" }}>—</div>}
                </div>
              </div>
            </div>);
          })}
        </div>
      </div>);
    })}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════
//  PRE-SCAN MODAL — Connection type + Scan scope selector
// ═══════════════════════════════════════════════════════════════════════
function PreScanModal({ onConfirm, onCancel }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("np_prefs") || "null"); } catch { return null; } })();
  const [conn, setConn] = useState(saved?.conn || "wifi");
  const [scope, setScope] = useState(saved?.scope || "full");
  return (<div className="np-modal-overlay" onClick={onCancel}>
    <div className="np-modal" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#00ffd5", fontFamily: "var(--ff-display)", fontWeight: 800, marginBottom: 4 }}>NETPROBE</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.25)", letterSpacing: 2 }}>CẤU HÌNH PHÂN TÍCH</div>
      </div>

      {/* Connection Type */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.3)", letterSpacing: 3, marginBottom: 8, fontFamily: "var(--ff-display)" }}>LOẠI KẾT NỐI</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {CONN_TYPES.map(ct => (
            <button key={ct.id} onClick={() => setConn(ct.id)} className={`np-opt-btn${conn === ct.id ? " np-opt-active" : ""}`} style={{ "--opt-accent": conn === ct.id ? "#00ffd5" : "rgba(255,255,255,.08)" }}>
              <span style={{ fontSize: 20 }}>{ct.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--ff-display)", letterSpacing: 1 }}>{ct.label}</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,.25)" }}>{ct.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scan Scope */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.3)", letterSpacing: 3, marginBottom: 8, fontFamily: "var(--ff-display)" }}>PHẠM VI PHÂN TÍCH</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {SCAN_SCOPES.map(sc => {
            const active = scope === sc.id;
            const groupCount = sc.groups ? sc.groups.length : TARGET_GROUPS.length;
            const targetCount = sc.groups ? TARGET_GROUPS.filter(g => sc.groups.includes(g.id)).flatMap(g => g.targets).length : TARGETS.length;
            return (<button key={sc.id} onClick={() => setScope(sc.id)} className={`np-scope-btn${active ? " np-scope-active" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{sc.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,.5)" }}>{sc.label}</div>
                  <div style={{ fontSize: 8, color: active ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.2)" }}>{sc.desc}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: active ? "#00ffd5" : "rgba(255,255,255,.15)", fontFamily: "var(--ff-display)" }}>{targetCount}</div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,.15)", letterSpacing: 1 }}>APPS</div>
                </div>
              </div>
              {active && sc.groups && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                {TARGET_GROUPS.filter(g => sc.groups.includes(g.id)).map(g => (
                  <span key={g.id} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 3, background: `${g.accent}18`, color: g.accent, letterSpacing: 1, fontFamily: "var(--ff-display)" }}>{g.icon} {g.name}</span>
                ))}
              </div>}
            </button>);
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 4, color: "rgba(255,255,255,.35)", fontSize: 10, fontFamily: "var(--ff-display)", letterSpacing: 2, cursor: "pointer" }}>HỦY</button>
        <button onClick={() => onConfirm(conn, scope)} className="np-engage-btn">
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--ff-display)", letterSpacing: 4 }}>▶ ENGAGE</span>
        </button>
      </div>
    </div>
  </div>);
}

function FindingCard({ icon, title, desc, severity, delay = 0 }) {
  const sc = severity === "good" ? "#00ffd5" : severity === "info" ? "#00b4d8" : severity === "warn" ? "#ffd600" : "#ff1744";
  return (<div style={{ padding: "14px 16px", borderRadius: 3, position: "relative", overflow: "hidden", background: `linear-gradient(135deg,${sc}05,transparent)`, border: `1px solid ${sc}15`, animation: `hudIn .4s ease ${delay}s both` }}>
    <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: sc, boxShadow: `0 0 8px ${sc}40` }} />
    <div style={{ display: "flex", alignItems: "start", gap: 10, paddingLeft: 8 }}>
      <span style={{ fontSize: 18, filter: `drop-shadow(0 0 4px ${sc}40)`, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div><div style={{ fontSize: 13, fontWeight: 700, color: sc, marginBottom: 4, lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", lineHeight: 1.8 }}>{desc}</div></div>
    </div>
  </div>);
}

function PhaseTimeline({ phases, currentIdx, progress }) {
  return (<div className="np-phase-bar">
    {phases.map((p, i) => {
      const done = i < currentIdx, act = i === currentIdx;
      const c = done ? "#00ffd5" : act ? "#00b4d8" : "rgba(255,255,255,.06)";
      return (<div key={p.id} className={`np-phase-item${act ? " np-phase-active" : ""}${done ? " np-phase-done" : ""}`}>
        <div className="np-phase-dot" style={{ background: done ? "#00ffd5" : act ? "#00b4d8" : "rgba(255,255,255,.06)", boxShadow: act ? "0 0 10px #00b4d8, 0 0 20px rgba(0,180,216,.3)" : done ? "0 0 6px rgba(0,255,213,.3)" : "none" }}>
          {done ? "✓" : p.icon}
        </div>
        <span className="np-phase-label" style={{ color: c }}>{p.name}</span>
        {act && <div className="np-phase-glow" />}
      </div>);
    })}
    {/* Progress bar */}
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,.02)", borderRadius: 1 }}>
      <div style={{ height: "100%", width: `${progress || 0}%`, background: "linear-gradient(90deg, #00ffd5, #00b4d8)", borderRadius: 1, transition: "width .5s ease", boxShadow: "0 0 8px rgba(0,255,213,.3)" }} />
    </div>
  </div>);
}

function BootTerminal({ lines }) {
  const [vis, setVis] = useState([]);
  const [cur, setCur] = useState(true);
  const ref = useRef(null);
  useEffect(() => { let i = 0; const t = setInterval(() => { if (i >= lines.length) { clearInterval(t); return; } setVis(p => [...p, lines[i]]); i++; }, 120); const c = setInterval(() => setCur(p => !p), 350); return () => { clearInterval(t); clearInterval(c); }; }, [lines]);
  useEffect(() => { ref.current?.scrollTo(0, 99999); }, [vis]);
  return (<div ref={ref} style={{ background: "rgba(0,4,12,.92)", border: "1px solid rgba(0,180,216,.12)", borderRadius: 3, padding: "12px 14px", maxHeight: 260, overflow: "auto", fontFamily: "var(--ff-mono)", fontSize: 9, lineHeight: 1.8, color: "rgba(0,255,213,.65)", boxShadow: "0 0 40px rgba(0,255,213,.02), inset 0 0 50px rgba(0,0,0,.5)" }}>
    {vis.map((l, i) => {
      const isL = i === vis.length - 1, ok = typeof l === "string" && (l.includes("nominal") || l.includes("ready") || l.includes("loaded") || l.includes("available"));
      return (<div key={i} style={{ opacity: isL ? 1 : .45, color: ok ? "#00e676" : "rgba(0,255,213,.55)" }}>
        <span style={{ color: "rgba(255,255,255,.08)", marginRight: 6 }}>{String(i + 1).padStart(2, "0")}</span>{l}{isL && cur && <span style={{ color: "#00ffd5", marginLeft: 2 }}>█</span>}
      </div>);
    })}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN APP — Real Engines Orchestration
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  const [phase, setPhase] = useState("idle");
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [booted, setBooted] = useState(false);

  // Data states
  const [trace, setTrace] = useState(null);
  const [geo, setGeo] = useState(null);
  const [ispInfo, setIspInfo] = useState(null);
  const [coloInfo, setColoInfo] = useState(null);
  const [latencyData, setLatencyData] = useState(null);
  const [latProg, setLatProg] = useState([]);
  const [dlData, setDlData] = useState(null);
  const [ulData, setUlData] = useState(null);
  const [dnsData, setDnsData] = useState(null);
  const [targetsDone, setTargetsDone] = useState({});
  const [scanTarget, setScanTarget] = useState(null);
  const [gwData, setGwData] = useState(null);
  const [bloatData, setBloatData] = useState(null);
  const [findings, setFindings] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  const [logs, setLogs] = useState([]);

  // UI visibility
  const [showTrace, setShowTrace] = useState(false);
  const [showGeo, setShowGeo] = useState(false);
  const [showLatency, setShowLatency] = useState(false);
  const [showDl, setShowDl] = useState(false);
  const [showUl, setShowUl] = useState(false);
  const [showDns, setShowDns] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showPreScan, setShowPreScan] = useState(false);
  const [connType, setConnType] = useState(null);
  const [scanScope, setScanScope] = useState(null);
  const [activeGroups, setActiveGroups] = useState(TARGET_GROUPS);
  const [scanProgress, setScanProgress] = useState(0);

  const timerRef = useRef(null);
  const addLog = useCallback((msg, level = "info") => setLogs(p => [...p, { t: Date.now(), msg, level }].slice(-60)), []);

  useEffect(() => {
    if (phase === "running" || phase === "booting") { timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleEngage = useCallback(() => {
    // If we have saved prefs, start directly without modal
    try {
      const saved = JSON.parse(localStorage.getItem("np_prefs") || "null");
      if (saved?.conn && saved?.scope) {
        const scopeDef = SCAN_SCOPES.find(s => s.id === saved.scope);
        const groups = scopeDef?.groups ? TARGET_GROUPS.filter(g => scopeDef.groups.includes(g.id)) : TARGET_GROUPS;
        setConnType(saved.conn); setScanScope(saved.scope); setActiveGroups(groups);
        run(saved.conn, groups);
        return;
      }
    } catch {}
    setShowPreScan(true);
  }, []);
  const handleOpenSettings = useCallback(() => setShowPreScan(true), []);
  const handlePreScanConfirm = useCallback((conn, scopeId) => {
    setShowPreScan(false);
    try { localStorage.setItem("np_prefs", JSON.stringify({ conn, scope: scopeId })); } catch {}
    setConnType(conn); setScanScope(scopeId);
    const scopeDef = SCAN_SCOPES.find(s => s.id === scopeId);
    const groups = scopeDef?.groups ? TARGET_GROUPS.filter(g => scopeDef.groups.includes(g.id)) : TARGET_GROUPS;
    setActiveGroups(groups);
    run(conn, groups);
  }, []);

  const run = useCallback(async (conn, groups) => {
    const scopeTargets = (groups || TARGET_GROUPS).flatMap(g => g.targets);
    // Reset all
    setPhase("booting"); setPhaseIdx(0); setElapsed(0); setBooted(false);
    setTrace(null); setGeo(null); setIspInfo(null); setColoInfo(null);
    setLatencyData(null); setLatProg([]); setDlData(null); setUlData(null);
    setDnsData(null); setTargetsDone({}); setScanTarget(null);
    setGwData(null); setBloatData(null);
    setFindings(null); setScoreData(null); setVerdicts(null);
    setShowTrace(false); setShowGeo(false); setShowLatency(false);
    setShowDl(false); setShowUl(false); setShowDns(false);
    setShowAnalysis(false); setShowScore(false); setLogs([]);
    addLog("Initiating boot sequence...", "sys");
    const connLabel = CONN_TYPES.find(c => c.id === conn)?.label || conn;
    addLog(`Kết nối: ${connLabel} • Targets: ${scopeTargets.length} apps`, "sys");
    setScanProgress(0);
    await sleep(2200); setBooted(true); setPhase("running");
    const collected = {};

    // ═══ Phase 1: CF Trace + GeoIP ═══
    setPhaseIdx(1); setScanProgress(5); addLog("Acquiring Cloudflare edge trace...", "net");
    const traceRes = await fetchCFTrace();
    collected.trace = traceRes; setTrace(traceRes);
    if (!traceRes._failed) {
      const ci = COLO_MAP[traceRes.colo]; setColoInfo(ci);
      setShowTrace(true);
      addLog(`CF PoP: ${traceRes.colo}${ci ? ` — ${ci.city}` : ""} — ${traceRes._ms}ms`, "ok");
      addLog(`Protocol: ${traceRes.http || "?"} / ${traceRes.tls || "?"} / ${traceRes.kex || "?"}`, "ok");
    } else {
      setShowTrace(true);
      addLog("CF Trace failed — using fallback data", "warn");
    }

    // GeoIP (still phase 1 - NHẬN DIỆN)
    setScanProgress(10); addLog("Resolving geolocation...", "net");
    const geoRes = await fetchGeoIP(traceRes);
    collected.geo = geoRes; setGeo(geoRes);
    if (!geoRes._failed) {
      const isp = detectISP(geoRes.isp || geoRes.org || "", geoRes.as || geoRes._asRaw || "");
      setIspInfo(isp); setShowGeo(true);
      addLog(`ISP: ${isp.name} (${geoRes.as || "?"})`, "ok");
      addLog(`Location: ${geoRes.city || "?"}, ${geoRes.country || geoRes.countryCode || "?"}`, "ok");
      if (geoRes._source) addLog(`GeoIP source: ${geoRes._source}`, "sys");
    } else {
      setShowGeo(true);
      addLog("GeoIP: tất cả API đều thất bại", "warn");
    }

    // ═══ Phase 2: Tốc độ (Latency + DL + UL) ═══
    setPhaseIdx(2); setScanProgress(18); addLog("Latency oscilloscope — 24 samples...", "net");
    const latRes = await measureLatency((ms, i) => {
      if (ms != null) setLatProg(p => [...p, ms]);
    });
    collected.latency = latRes; setLatencyData(latRes); setShowLatency(true);
    if (!latRes._failed) {
      addLog(`Latency: avg=${latRes.avg}ms jitter=${latRes.jitter}ms p90=${latRes.p90}ms`, "ok");
    } else { addLog("Latency measurement failed", "warn"); }

    // Download (still phase 2)
    setScanProgress(30); addLog("Download bandwidth test...", "net");
    const dlRes = await measureDownload(p => {
      addLog(`Download sampling... ${Math.round(p.progress * 100)}%`, "net");
    });
    collected.download = dlRes; setDlData(dlRes); setShowDl(true);
    addLog(`Download: ${dlRes.mbps} Mbps (P90: ${dlRes.p90}, ${dlRes.samples} samples)`, "ok");

    // Upload (still phase 2)
    setScanProgress(45); addLog("Upload bandwidth test...", "net");
    const ulRes = await measureUpload(p => {
      addLog(`Upload sampling... ${Math.round(p.progress * 100)}%`, "net");
    });
    collected.upload = ulRes; setUlData(ulRes); setShowUl(true);
    addLog(`Upload: ${ulRes.mbps} Mbps (P90: ${ulRes.p90}, ${ulRes.samples} samples)`, "ok");

    // ═══ Phase 3: DNS ═══
    setPhaseIdx(3); setScanProgress(55); addLog("DNS resolution timing...", "net");
    const dnsRes = await probeDNS();
    collected.dns = dnsRes; setDnsData(dnsRes); setShowDns(true);
    addLog(`DNS: avg ${dnsRes.avg}ms`, "ok");

    // ═══ Phase 4: ỨNG DỤNG ═══
    setPhaseIdx(4); setScanProgress(60); addLog(`Scanning ${scopeTargets.length} targets...`, "net");
    const targetsRes = await probeInternationalTargets((id, result) => {
      setTargetsDone(p => ({ ...p, [id]: result }));
      setScanTarget(id);
      const t = scopeTargets.find(x => x.id === id);
      addLog(`${t?.icon || "•"} ${t?.name || id}: ${result.avg ?? "timeout"}ms`, "ok");
    }, scopeTargets);
    collected.targets = targetsRes;
    setScanTarget(null);

    // Gateway + Bloat (optional)
    setScanProgress(85); addLog("Gateway probe (may skip on HTTPS)...", "net");
    try {
      const gw = await scanGateways();
      if (gw) {
        addLog(`Gateway found: ${gw.ip} (${gw.hint})`, "ok");
        const gwRes = await probeGateway(gw.ip);
        collected.gateway = gwRes; setGwData(gwRes);
        addLog(`Gateway RTT: avg=${gwRes.avg}ms jitter=${gwRes.jitter}ms`, "ok");
        const bloatRes = await bufferBloatTest(gw.ip);
        collected.bloat = bloatRes; setBloatData(bloatRes);
        if (!bloatRes._skipped) {
          addLog(`Buffer bloat: ${bloatRes.bloatRatio}x (${bloatRes.idleAvg}ms → ${bloatRes.loadAvg}ms)`, bloatRes.bloatRatio > 2 ? "warn" : "ok");
        }
      } else {
        addLog("No gateway detected (HTTPS mixed content block)", "warn");
      }
    } catch {
      addLog("Gateway probe skipped", "warn");
    }

    // ═══ Phase 5: PHÂN TÍCH ═══
    setPhaseIdx(5); setScanProgress(90); addLog("Cross-analysis engine — 12 rules...", "sys");
    const analysisRes = crossAnalyze(collected);
    setFindings(analysisRes);
    addLog(`Analysis: ${analysisRes.length} findings`, "ok");

    const verdictsRes = computeVerdicts(collected);
    setVerdicts(verdictsRes); setShowAnalysis(true);

    // Score (still phase 5)
    setScanProgress(95); addLog("Computing score...", "sys");
    await sleep(300);
    const scoreRes = calculateScore(collected);
    collected.score = scoreRes;
    setScoreData(scoreRes); setShowScore(true);
    addLog(`Score: ${scoreRes.value}/100 — ${scoreRes.grade} (${scoreRes.label})`, "ok");
    setScanProgress(100);
    addLog("═══ SCAN COMPLETE ═══", "sys");
    setPhase("done");
  }, [addLog]);

  const fmtT = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const g = showScore && scoreData ? gradeOf(scoreData.value) : { c: "#00b4d8" };

  return (
    <div style={{ "--ff-display": "'Orbitron',monospace", "--ff-mono": "'IBM Plex Mono','Fira Code',monospace", minHeight: "100vh", background: "#010610", color: "#c8e6f0", fontFamily: "var(--ff-mono)", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,180,216,.12);border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes hudIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes glitchClip{0%{clip-path:inset(40% 0 61% 0)}20%{clip-path:inset(92% 0 1% 0)}40%{clip-path:inset(43% 0 1% 0)}60%{clip-path:inset(25% 0 58% 0)}80%{clip-path:inset(54% 0 7% 0)}100%{clip-path:inset(58% 0 43% 0)}}
        @keyframes borderPulse{0%,100%{border-color:rgba(0,255,213,.08)}50%{border-color:rgba(0,255,213,.25)}}
        @keyframes targetScan{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes oscScan{0%{left:-2px}100%{left:calc(100% + 2px)}}
        @keyframes dnsBarShimmer{0%{transform:translateX(-200%)}50%{transform:translateX(200%)}100%{transform:translateX(200%)}}
        body{overflow-x:hidden;background:#010610}button{font-family:inherit;cursor:pointer}
        .np-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px;align-items:start}
        .np-c3{grid-column:span 3}.np-c4{grid-column:span 4}.np-c6{grid-column:span 6}.np-c12{grid-column:span 12}
        .np-findings{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
        .np-targets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:6px}
        /* ── Target Group App Cards ── */
        .np-tg-apps{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:5px}
        .np-tg-app{position:relative;padding:7px 10px;border-radius:6px;background:rgba(255,255,255,.012);border:1px solid rgba(255,255,255,.03);transition:all .4s ease;overflow:hidden;cursor:default}
        .np-tg-app.np-tg-done{background:rgba(255,255,255,.025);border-color:color-mix(in srgb,var(--tg-accent) 25%,transparent)}
        .np-tg-app.np-tg-active{border-color:transparent;background:rgba(255,255,255,.03)}
        /* Spinning conic gradient border for active scan */
        .np-tg-glow{position:absolute;inset:-2px;border-radius:8px;z-index:1;pointer-events:none;background:conic-gradient(from var(--glow-angle,0deg),transparent 0%,var(--glow-color) 10%,transparent 20%,transparent 40%,var(--glow-color) 50%,transparent 60%,transparent 80%,var(--glow-color) 90%,transparent 100%);animation:glowSpin 1.2s linear infinite;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;padding:2px}
        @keyframes glowSpin{0%{--glow-angle:0deg}100%{--glow-angle:360deg}}
        @property --glow-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
        /* Subtle glow for completed items */
        .np-tg-done-glow{position:absolute;inset:0;border-radius:6px;z-index:0;pointer-events:none;box-shadow:inset 0 0 12px color-mix(in srgb,var(--done-color) 8%,transparent),0 0 6px color-mix(in srgb,var(--done-color) 5%,transparent);opacity:0;animation:doneGlowIn .6s ease forwards}
        @keyframes doneGlowIn{to{opacity:1}}
        .np-tg-scanning{font-size:10px;animation:pulse .45s infinite;font-weight:900;letter-spacing:2px}
        /* ── Phase Timeline Bar ── */
        .np-phase-bar{display:flex;align-items:center;gap:4px;position:relative;padding:8px 4px 14px}
        .np-phase-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;z-index:1}
        .np-phase-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .5s;color:rgba(255,255,255,.8)}
        .np-phase-done .np-phase-dot{font-size:10px;color:#fff}
        .np-phase-label{font-size:9px;letter-spacing:2px;font-family:var(--ff-display);font-weight:700;text-align:center;transition:all .5s}
        .np-phase-active .np-phase-label{text-shadow:0 0 12px currentColor}
        .np-phase-glow{position:absolute;top:-4px;width:34px;height:34px;border-radius:50%;background:rgba(0,180,216,.15);filter:blur(8px);animation:pulse 1.2s ease infinite;pointer-events:none}
        @keyframes phaseGlow{0%,100%{box-shadow:0 0 8px rgba(0,180,216,.3)}50%{box-shadow:0 0 20px rgba(0,180,216,.6)}}
        .np-id-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .np-id-card{padding:14px 16px;border-radius:4px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);position:relative;transition:all .3s}
        .np-id-card:hover{background:rgba(255,255,255,.03);border-color:rgba(0,255,213,.1)}
        .np-id-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:10px}
        .np-id-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.45);letter-spacing:3px;font-family:var(--ff-display);margin-bottom:6px}
        .np-id-value{font-size:15px;font-weight:800;color:#f0f8ff;font-family:var(--ff-display);margin-bottom:4px;line-height:1.3}
        .np-id-sub{font-size:11px;color:rgba(255,255,255,.45);line-height:1.6;margin-top:2px}
        .np-id-desc{font-size:10px;color:rgba(255,255,255,.35);line-height:1.5;margin-top:6px;font-style:italic;border-top:1px solid rgba(255,255,255,.04);padding-top:6px}
        .np-id-tag{font-size:8px;padding:2px 6px;border-radius:3px;background:rgba(0,180,216,.1);color:rgba(0,180,216,.7);margin-top:5px;display:inline-block;letter-spacing:1px;border:1px solid rgba(0,180,216,.15)}
        .np-id-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
        .np-badge{font-size:9px;padding:3px 8px;border-radius:3px;background:rgba(0,180,216,.08);color:rgba(0,180,216,.7);border:1px solid rgba(0,180,216,.12);font-family:var(--ff-display);letter-spacing:1px;white-space:nowrap}
        .np-id-rows{display:flex;flex-direction:column;gap:0}
        .np-id-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px}
        .np-id-row span:first-child{color:rgba(255,255,255,.5);font-weight:500}
        .np-id-row span:last-child{color:rgba(255,255,255,.7);font-weight:600;text-align:right}
        /* ── Pre-scan Modal ── */
        .np-modal-overlay{position:fixed;inset:0;z-index:100;background:rgba(1,6,16,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:fadeIn .25s ease}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .np-modal{background:linear-gradient(160deg,rgba(10,16,36,.98),rgba(5,10,25,.98));border:1px solid rgba(0,255,213,.1);border-radius:10px;padding:24px;max-width:420px;width:92%;max-height:90vh;overflow-y:auto;animation:modalSlide .3s ease;box-shadow:0 0 60px rgba(0,255,213,.05),0 0 2px rgba(0,255,213,.15)}
        @keyframes modalSlide{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        .np-opt-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:6px;cursor:pointer;transition:all .25s;color:#fff}
        .np-opt-btn:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}
        .np-opt-btn.np-opt-active{background:rgba(0,255,213,.06);border-color:rgba(0,255,213,.3);box-shadow:0 0 12px rgba(0,255,213,.08)}
        .np-scope-btn{display:flex;flex-direction:column;padding:10px 12px;background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.04);border-radius:6px;cursor:pointer;transition:all .25s;color:#fff;text-align:left}
        .np-scope-btn:hover{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.08)}
        .np-scope-btn.np-scope-active{background:rgba(0,255,213,.04);border-color:rgba(0,255,213,.2);box-shadow:0 0 12px rgba(0,255,213,.06)}
        .np-engage-btn{flex:2;padding:10px;background:linear-gradient(135deg,rgba(0,255,213,.12),rgba(0,180,216,.12));border:1px solid rgba(0,255,213,.3);border-radius:4px;color:#00ffd5;cursor:pointer;transition:all .3s;position:relative;overflow:hidden}
        .np-engage-btn:hover{background:linear-gradient(135deg,rgba(0,255,213,.18),rgba(0,180,216,.18));border-color:rgba(0,255,213,.5);box-shadow:0 0 20px rgba(0,255,213,.1)}
        @media(max-width:768px){
          .np-grid{grid-template-columns:1fr !important;gap:10px}
          .np-c3,.np-c4,.np-c6,.np-c12{grid-column:span 1 !important}
          .np-findings{grid-template-columns:1fr !important}
          .np-targets-grid{grid-template-columns:repeat(2,1fr) !important}
          .np-tg-apps{grid-template-columns:repeat(2,1fr) !important}
          .np-id-grid{grid-template-columns:1fr !important}
        }
        @media(min-width:769px) and (max-width:1024px){
          .np-id-grid{grid-template-columns:repeat(2,1fr) !important}
        }
      `}</style>

      {showPreScan && <PreScanModal onConfirm={handlePreScanConfirm} onCancel={() => setShowPreScan(false)} />}
      <CommandCanvas phase={phase} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.025) 2px,rgba(0,0,0,.025) 4px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", opacity: .025, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1100, margin: "0 auto", padding: "0 12px 40px" }}>
        {/* HEADER */}
        <header style={{ padding: "20px 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ width: 5, height: 5, background: "#00ffd5", borderRadius: "50%", boxShadow: "0 0 8px #00ffd5", animation: phase === "running" ? "pulse .7s infinite" : "none" }} />
              <span style={{ fontSize: 9, letterSpacing: 5, color: "rgba(255,255,255,.2)", fontWeight: 600 }}>SPEED.CCN.VN</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--ff-display)", letterSpacing: 10, lineHeight: 1.2, background: "linear-gradient(135deg,#00ffd5 0%,#00b4d8 50%,#7c4dff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 15px rgba(0,255,213,.12))", position: "relative" }}>
              NETPROBE
              {phase === "running" && <span aria-hidden="true" style={{ position: "absolute", left: 2, top: 0, background: "linear-gradient(135deg,#ff1744,#7c4dff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "glitchClip 2s infinite linear alternate-reverse", opacity: .1 }}>NETPROBE</span>}
            </h1>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.12)", letterSpacing: 2 }}>NETWORK OPERATIONS CENTER</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {(phase === "running" || phase === "done") && <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 18, fontFamily: "var(--ff-display)", color: phase === "done" ? g.c : "#00b4d8", fontWeight: 700, letterSpacing: 3, textShadow: `0 0 8px ${phase === "done" ? g.c : "#00b4d8"}25` }}>{fmtT(elapsed)}</div>
                {phase === "running" && <div style={{ fontSize: 14, fontFamily: "var(--ff-display)", color: "#00ffd5", fontWeight: 800, letterSpacing: 1, textShadow: "0 0 10px rgba(0,255,213,.3)" }}>{scanProgress}%</div>}
              </div>}
              {phase === "idle" ? <button onClick={handleEngage} style={{ background: "transparent", border: "1px solid rgba(0,255,213,.2)", borderRadius: 3, padding: "12px 32px", animation: "borderPulse 3s ease infinite" }}>
                <span style={{ color: "#00ffd5", fontSize: 12, fontWeight: 700, fontFamily: "var(--ff-display)", letterSpacing: 6 }}>▶ ENGAGE</span>
              </button> : phase === "done" ? <button onClick={handleEngage} style={{ background: "transparent", border: `1px solid ${g.c}25`, borderRadius: 3, padding: "8px 24px", color: g.c, fontSize: 10, fontFamily: "var(--ff-display)", letterSpacing: 4 }}>↻ RE-SCAN</button> : null}
            </div>
            {(phase === "idle" || phase === "done") && <button onClick={handleOpenSettings} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 3, padding: "5px 14px", color: "rgba(255,255,255,.35)", fontSize: 9, fontFamily: "var(--ff-display)", letterSpacing: 2, cursor: "pointer", transition: "all .2s" }}>⚙ TÙY CHỌN</button>}
          </div>
        </header>

        {/* TIMELINE */}
        {(phase === "running" || phase === "done") && phaseIdx >= 0 && <div style={{ marginBottom: 14, animation: "hudIn .3s ease both" }}><PhaseTimeline phases={PHASES} currentIdx={phase === "done" ? PHASES.length : phaseIdx} progress={scanProgress} /></div>}

        {/* BOOT */}
        {phase === "booting" && !booted && <div style={{ maxWidth: 580, margin: "30px auto", animation: "hudIn .3s ease both" }}><BootTerminal lines={BOOT_LINES} /></div>}

        {/* MAIN GRID */}
        {(booted || phase === "done") && (
          <div className="np-grid">
            {/* RADAR */}
            <div className="np-c6" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <RadarSweep size={230} score={showScore ? scoreData?.value : null} active={phase === "running"} />
              {showScore && verdicts && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", width: "100%", animation: "hudIn .5s ease .2s both" }}>
                {Object.values(verdicts).map((v, k) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 3, background: v.ok ? "rgba(0,255,213,.03)" : "rgba(255,23,68,.03)", border: `1px solid ${v.ok ? "rgba(0,255,213,.1)" : "rgba(255,23,68,.1)"}`, flex: "1 1 110px", minWidth: 110 }}>
                    <span style={{ fontSize: 18 }}>{v.icon}</span>
                    <div><div style={{ fontSize: 10, fontWeight: 700, color: v.ok ? "#00ffd5" : "#ff1744", letterSpacing: 1 }}>{v.label}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)" }}>{v.detail}</div></div>
                  </div>
                ))}
              </div>}
            </div>

            {/* LATENCY */}
            {(latProg.length > 0 || showLatency) && <div className="np-c6">
              <HudPanel title="LATENCY OSCILLOSCOPE" icon="◎" status={showLatency ? "done" : "active"} accent="#00ffd5" glow={showLatency} delay={.08}>
                <Oscilloscope data={showLatency && latencyData?.raw ? latencyData.raw : latProg} color="#00ffd5" height={60}
                  label={showLatency ? `${latencyData?.raw?.length || 0} SAMPLES` : `SAMPLING ${latProg.length}/24`}
                  active={!showLatency} />
                {showLatency && latencyData && !latencyData._failed && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
                  {[{ v: latencyData.avg, l: "AVG ms", c: "#00ffd5" }, { v: latencyData.jitter, l: "JITTER ms", c: "#c6ff00" }, { v: latencyData.p90, l: "P90 ms", c: "#00b4d8" }].map(s => (
                    <div key={s.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--ff-display)", color: s.c, textShadow: `0 0 10px ${s.c}25` }}>{s.v}</div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,.2)", letterSpacing: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>}
              </HudPanel>
            </div>}

            {/* SPEED */}
            {(showDl || showUl || phaseIdx === 4 || phaseIdx === 5) && <div className="np-c6">
              <HudPanel title="BANDWIDTH" icon="⚡" status={showUl ? "done" : "active"} accent="#7c4dff" glow={showDl && showUl} delay={.12}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <SpeedGauge value={showDl ? dlData?.p90 : null} max={500} label="DOWNLOAD" unit="Mbps" color="#00ffd5" size={132} />
                  <SpeedGauge value={showUl ? ulData?.p90 : null} max={200} label="UPLOAD" unit="Mbps" color="#7c4dff" size={132} />
                </div>
                {showDl && showUl && <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="np-badge" style={{ background: "rgba(0,255,213,.08)", color: "#00ffd5", borderColor: "rgba(0,255,213,.15)" }}>AVG↓ {dlData?.mbps} Mbps</span>
                  <span className="np-badge" style={{ background: "rgba(124,77,255,.08)", color: "#b388ff", borderColor: "rgba(124,77,255,.15)" }}>AVG↑ {ulData?.mbps} Mbps</span>
                </div>}
              </HudPanel>
            </div>}

            {/* DNS */}
            {showDns && <div className="np-c6">
              <HudPanel title="DNS RESOLUTION" icon="🔗" status="done" accent="#c6ff00" glow delay={.16}>
                {/* Animated bar chart */}
                {dnsData?.domains && (() => {
                  const entries = Object.entries(dnsData.domains);
                  const maxVal = Math.max(...entries.map(([, v]) => v?.ms ?? 0), 1);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {entries.map(([d, data], i) => {
                        const v = data?.ms;
                        const pct = v != null ? (v / maxVal) * 100 : 0;
                        const c = v == null ? "rgba(255,255,255,.1)" : v < 30 ? "#00ffd5" : v < 80 ? "#c6ff00" : "#ffd600";
                        return (
                          <div key={d} style={{ animation: `hudIn .4s ease ${.1 + i * .08}s both` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>{d}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: "var(--ff-display)", textShadow: `0 0 8px ${c}30` }}>{v ?? "—"}</span>
                                <span style={{ fontSize: 8, color: "rgba(255,255,255,.25)" }}>ms</span>
                              </div>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.03)", overflow: "hidden", position: "relative" }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${c}90, ${c})`, transition: "width 1.2s cubic-bezier(.4,0,.2,1)", boxShadow: `0 0 8px ${c}30, inset 0 1px 0 rgba(255,255,255,.15)`, position: "relative" }}>
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 60%, rgba(255,255,255,.15) 80%, transparent 100%)", animation: "dnsBarShimmer 2s ease infinite" }} />
                              </div>
                            </div>
                            {/* Resolver breakdown */}
                            {data?.resolvers && <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                              {data.resolvers.map(r => (
                                <span key={r.resolver} style={{ fontSize: 8, color: r.ms != null ? (r.ms < 30 ? "rgba(0,255,213,.4)" : r.ms < 80 ? "rgba(198,255,0,.4)" : "rgba(255,214,0,.4)") : "rgba(255,255,255,.1)", letterSpacing: .5 }}>{r.resolver} {r.ms ?? "✕"}ms</span>
                              ))}
                            </div>}
                          </div>
                        );
                      })}
                      {/* Average summary */}
                      <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(198,255,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.45)", letterSpacing: 2, fontFamily: "var(--ff-display)" }}>TRUNG BÌNH</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--ff-display)", color: dnsData.avg != null ? (dnsData.avg < 30 ? "#00ffd5" : dnsData.avg < 80 ? "#c6ff00" : "#ffd600") : "rgba(255,255,255,.2)", textShadow: dnsData.avg != null ? `0 0 12px ${dnsData.avg < 30 ? "#00ffd5" : "#c6ff00"}25` : "none" }}>{dnsData.avg ?? "—"}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,.25)" }}>ms</span>
                          {dnsData.avg != null && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dnsData.avg < 30 ? "#00ffd5" : dnsData.avg < 80 ? "#c6ff00" : "#ffd600", boxShadow: `0 0 6px ${dnsData.avg < 30 ? "#00ffd5" : "#c6ff00"}`, display: "inline-block" }} />}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </HudPanel>
            </div>}

            {/* ══════ NHẬN DIỆN MẠNG — Network Identity Panel ══════ */}
            {showTrace && <div className="np-c12">
              <HudPanel title="NHẬN DIỆN MẠNG" icon="🔍" status={showGeo ? "done" : "active"} accent="#00ffd5" glow={showGeo} delay={.2}>
                <div className="np-id-grid">
                  {/* ── Địa chỉ IP ── */}
                  <div className="np-id-card">
                    <div className="np-id-icon" style={{ background: "rgba(0,255,213,.08)" }}>🌐</div>
                    <div className="np-id-label">ĐỊA CHỈ IP</div>
                    <div className="np-id-value" style={{ color: "#00ffd5" }}>{trace?.ip || "—"}</div>
                    <div className="np-id-badges">
                      <span className="np-badge" style={{ background: "rgba(0,255,213,.1)", color: "#00ffd5", borderColor: "rgba(0,255,213,.2)" }}>{geo?.ipType ? geo.ipType.toUpperCase() : "IPv4"}</span>
                      <span className="np-badge" style={trace?.visit_scheme === "https" ? { background: "rgba(0,230,118,.1)", color: "#00e676", borderColor: "rgba(0,230,118,.2)" } : {}}>{trace?.visit_scheme === "https" ? "🔒 HTTPS" : "HTTP"}</span>
                    </div>
                    {geo?._source && <div className="np-id-tag">via {geo._source}</div>}
                  </div>

                  {/* ── Nhà mạng (ISP) ── */}
                  <div className="np-id-card" style={{ borderColor: `${ispInfo?.color || "#666"}18` }}>
                    <div className="np-id-icon" style={{ background: `${ispInfo?.color || "#666"}15` }}>
                      <span style={{ fontSize: 16 }}>📡</span>
                    </div>
                    <div className="np-id-label">NHÀ MẠNG</div>
                    <div className="np-id-value" style={{ color: ispInfo?.color || "#f0f8ff" }}>{ispInfo?.name || geo?.isp || "—"}</div>
                    {ispInfo?.fullName && <div className="np-id-sub">{ispInfo.fullName}</div>}
                    {(geo?.as || geo?._asRaw) && <div className="np-id-badges" style={{ marginTop: 4 }}>
                      <span className="np-badge" style={{ background: `${ispInfo?.color || "#666"}15`, color: `${ispInfo?.color || "#aaa"}`, borderColor: `${ispInfo?.color || "#666"}25` }}>{geo?.as || geo?._asRaw}</span>
                      {geo?.asname && geo.asname !== (geo?.isp || "") && <span className="np-badge">{geo.asname}</span>}
                    </div>}
                    {ispInfo?.tier > 0 && <div className="np-id-badges">
                      <span className="np-badge" style={{ background: `${ispInfo.color}20`, color: ispInfo.color, borderColor: `${ispInfo.color}30` }}>Tier {ispInfo.tier}</span>
                      {ispInfo.type && <span className="np-badge">{ispInfo.type}</span>}
                    </div>}
                    {ispInfo?.desc && <div className="np-id-desc">{ispInfo.desc}</div>}
                    {geo?.org && geo.org !== (geo?.isp || "") && <div className="np-id-sub">Tổ chức: <strong style={{ color: "rgba(255,255,255,.6)" }}>{geo.org}</strong></div>}
                  </div>

                  {/* ── Vị trí ── */}
                  <div className="np-id-card">
                    <div className="np-id-icon" style={{ background: "rgba(0,230,118,.08)" }}>
                      <span style={{ fontSize: 18 }}>{geo?.countryCode ? countryFlag(geo.countryCode) : "📍"}</span>
                    </div>
                    <div className="np-id-label">VỊ TRÍ</div>
                    <div className="np-id-value" style={{ color: "#00e676" }}>
                      {vietnamizeCity(geo?.city, geo?.regionName) || geo?.city || "—"}
                    </div>
                    {geo?.regionName && geo.regionName !== geo?.city && <div className="np-id-sub">
                      {vietnamizeCity(geo.regionName) || geo.regionName}{geo?.regionCode ? ` (${geo.regionCode})` : ""}
                    </div>}
                    <div className="np-id-badges" style={{ marginTop: 4 }}>
                      <span className="np-badge" style={{ background: "rgba(0,230,118,.1)", color: "#00e676", borderColor: "rgba(0,230,118,.2)" }}>{geo?.countryCode ? countryFlag(geo.countryCode) : "🌐"} {countryNameVI(geo?.countryCode) || geo?.country || "—"}</span>
                    </div>
                    {geo?.lat != null && <div className="np-id-sub" style={{ fontSize: 10 }}>{Number(geo.lat).toFixed(4)}°N, {Number(geo.lon).toFixed(4)}°E</div>}
                    {geo?.zip && <div className="np-id-sub" style={{ fontSize: 10 }}>Mã vùng: {geo.zip}</div>}
                    {geo?.timezone && <div className="np-id-badges">
                      <span className="np-badge">🕐 {geo.timezone}{geo?.utcOffset ? ` (${geo.utcOffset})` : ""}</span>
                    </div>}
                  </div>

                  {/* ── Cloudflare Edge ── */}
                  <div className="np-id-card">
                    <div className="np-id-icon" style={{ background: coloInfo?.vn ? "rgba(0,230,118,.08)" : "rgba(255,214,0,.08)" }}>☁️</div>
                    <div className="np-id-label">CLOUDFLARE EDGE</div>
                    <div className="np-id-value" style={{ color: coloInfo?.vn ? "#00e676" : coloInfo?.nearby ? "#c6ff00" : "#ffd600" }}>
                      {trace?.colo || "?"}{coloInfo ? ` — ${coloInfo.city}` : ""}
                    </div>
                    <div className="np-id-sub">{coloInfo?.flag || "🌐"} {coloInfo?.vn ? "PoP Việt Nam — Routing tối ưu ✓" : coloInfo?.nearby ? "PoP lân cận — Routing chấp nhận" : "PoP xa — Routing chưa tối ưu ⚠"}</div>
                    {trace?._ms && <div className="np-id-sub">Trace RTT: <strong style={{ color: trace._ms < 50 ? "#00ffd5" : "#ffd600" }}>{trace._ms}ms</strong></div>}
                    <div className="np-id-badges">
                      <span className="np-badge" style={trace?.http === "h3" ? { background: "rgba(0,255,213,.12)", color: "#00ffd5", borderColor: "rgba(0,255,213,.2)" } : {}}>{trace?.http === "h3" ? "HTTP/3 QUIC" : trace?.http === "h2" ? "HTTP/2" : trace?.http || "?"}</span>
                      <span className="np-badge">{trace?.tls || "?"}</span>
                    </div>
                  </div>

                  {/* ── Bảo mật kết nối ── */}
                  <div className="np-id-card">
                    <div className="np-id-icon" style={{ background: "rgba(255,214,0,.08)" }}>🔐</div>
                    <div className="np-id-label">BẢO MẬT KẾT NỐI</div>
                    <div className="np-id-rows">
                      <div className="np-id-row"><span>Mã hóa TLS</span><span style={{ color: trace?.tls?.includes("1.3") ? "#00ffd5" : "#ffd600" }}>{trace?.tls || "?"}</span></div>
                      <div className="np-id-row"><span>Key Exchange</span><span style={{ color: trace?.kex?.includes("MLKEM") ? "#00ffd5" : "rgba(255,255,255,.5)" }}>{trace?.kex || "?"}</span></div>
                      <div className="np-id-row"><span>Post-Quantum</span><span style={{ color: trace?.kex?.includes("MLKEM") ? "#00ffd5" : "#ffd600" }}>{trace?.kex?.includes("MLKEM") ? "✓ ML-KEM bảo vệ" : "✗ Chưa hỗ trợ"}</span></div>
                      <div className="np-id-row"><span>SNI (Server Name)</span><span style={{ color: trace?.sni === "plaintext" ? "#ffd600" : "#00ffd5" }}>{trace?.sni === "plaintext" ? "⚠ Lộ domain" : trace?.sni === "encrypted" ? "✓ Đã mã hóa" : trace?.sni || "?"}</span></div>
                      <div className="np-id-row"><span>WARP VPN</span><span style={{ color: trace?.warp === "on" || trace?.warp === "plus" ? "#00ffd5" : "rgba(255,255,255,.3)" }}>{trace?.warp === "on" ? "✓ Bật" : trace?.warp === "plus" ? "✓ WARP+" : "✗ Tắt"}</span></div>
                      <div className="np-id-row"><span>Gateway</span><span>{trace?.gateway === "on" ? "✓ Active" : "✗ Off"}</span></div>
                    </div>
                  </div>

                  {/* ── Loại kết nối ── */}
                  <div className="np-id-card">
                    <div className="np-id-icon" style={{ background: "rgba(0,180,216,.08)" }}>📶</div>
                    <div className="np-id-label">LOẠI KẾT NỐI</div>
                    <div className="np-id-rows">
                      <div className="np-id-row"><span>Mạng</span><span style={{ color: "#00ffd5" }}>{(() => { const ni = readNetworkInfo(); return ni._unsupported ? "N/A" : (ni.type === "wifi" ? "WiFi" : ni.type === "ethernet" ? "Cáp LAN" : ni.type === "cellular" ? "Di động (4G/5G)" : ni.type || "?"); })()}</span></div>
                      <div className="np-id-row"><span>Loại mạng</span><span style={{ color: geo?.hosting ? "#ffd600" : geo?.mobile ? "#00b4d8" : "#00e676" }}>{geo?.hosting ? "⚠ Hosting/DC" : geo?.mobile ? "📱 Di động" : "🏠 Dân dụng"}</span></div>
                      <div className="np-id-row"><span>Proxy</span><span style={{ color: geo?.proxy ? "#ff1744" : "#00e676" }}>{geo?.proxy ? "⚠ Phát hiện proxy" : "✓ Không proxy"}</span></div>
                      {geo?.vpn !== undefined && <div className="np-id-row"><span>VPN</span><span style={{ color: geo.vpn ? "#ffd600" : "#00e676" }}>{geo.vpn ? "⚠ Phát hiện VPN" : "✓ Không VPN"}</span></div>}
                      {geo?.tor !== undefined && <div className="np-id-row"><span>Tor</span><span style={{ color: geo.tor ? "#ff1744" : "#00e676" }}>{geo.tor ? "⚠ Mạng Tor" : "✓ Không Tor"}</span></div>}
                      {geo?._domain && <div className="np-id-row"><span>Domain ISP</span><span>{geo._domain}</span></div>}
                    </div>
                  </div>
                </div>
              </HudPanel>
            </div>}

            {/* TARGETS */}
            {(Object.keys(targetsDone).length > 0 || scanTarget) && <div className="np-c12">
              <HudPanel title="INTERNATIONAL TARGETS" icon="🌐" status={scanTarget ? "active" : "done"} accent="#00b4d8" glow={!scanTarget && Object.keys(targetsDone).length > 0} delay={.3}>
                {/* Connection type + scope badge */}
                {connType && <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="np-badge" style={{ color: "#00ffd5", borderColor: "rgba(0,255,213,.15)" }}>{CONN_TYPES.find(c => c.id === connType)?.icon} {CONN_TYPES.find(c => c.id === connType)?.label}</span>
                  <span className="np-badge" style={{ color: "#00b4d8", borderColor: "rgba(0,180,216,.15)" }}>{SCAN_SCOPES.find(s => s.id === scanScope)?.icon} {SCAN_SCOPES.find(s => s.id === scanScope)?.label}</span>
                </div>}
                <TargetGrid targets={targetsDone} activeId={scanTarget} groups={activeGroups} />
                {!scanTarget && Object.keys(targetsDone).length > 0 && <>
                  {/* Per-group summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.03)" }}>
                    {activeGroups.map(grp => {
                      const gVals = grp.targets.map(t => targetsDone[t.id]).filter(r => r?.avg > 0);
                      const gAvg = gVals.length ? Math.round(gVals.reduce((a, r) => a + r.avg, 0) / gVals.length) : null;
                      const gColor = gAvg == null ? "rgba(255,255,255,.15)" : gAvg < 50 ? "#00ffd5" : gAvg < 100 ? "#c6ff00" : gAvg < 200 ? "#ffd600" : "#ff9100";
                      return (<div key={grp.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,.015)", border: `1px solid ${grp.accent}15` }}>
                        <span style={{ fontSize: 12 }}>{grp.icon}</span>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,.35)", flex: 1, letterSpacing: 1, fontFamily: "var(--ff-display)" }}>{grp.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: gColor, fontFamily: "var(--ff-display)", textShadow: `0 0 8px ${gColor}30` }}>{gAvg ?? "—"}</span>
                        <span style={{ fontSize: 7, color: "rgba(255,255,255,.2)" }}>ms</span>
                      </div>);
                    })}
                  </div>
                  {/* Overall summary */}
                  <div style={{ display: "flex", gap: 20, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.03)", justifyContent: "center", flexWrap: "wrap" }}>
                    {(() => {
                      const vals = Object.values(targetsDone).filter(t => t.avg > 0);
                      const reachable = vals.length;
                      const avgLat = reachable > 0 ? Math.round(vals.reduce((a, t) => a + t.avg, 0) / reachable) : 0;
                      const totalLoss = reachable > 0 ? Math.round(vals.reduce((a, t) => a + (t.loss || 0), 0) / reachable) : 0;
                      return [
                        { l: "REACHABLE", v: `${reachable}/${TARGETS.length}`, c: "#00ffd5" },
                        { l: "AVG LATENCY", v: `${avgLat}ms`, c: "#00b4d8" },
                        { l: "AVG LOSS", v: `${totalLoss}%`, c: "#00e676" },
                      ];
                    })().map(s => (
                      <div key={s.l} style={{ textAlign: "center" }}><div style={{ fontSize: 8, color: "rgba(255,255,255,.2)", letterSpacing: 2, marginBottom: 2 }}>{s.l}</div><div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: "var(--ff-display)", textShadow: `0 0 10px ${s.c}25` }}>{s.v}</div></div>
                    ))}
                  </div>
                </>}
              </HudPanel>
            </div>}

            {/* ANALYSIS */}
            {showAnalysis && findings && <div className="np-c12">
              <HudPanel title="CROSS-ANALYSIS" icon="🔬" accent={g.c} glow delay={.35}>
                <div className="np-findings">
                  {findings.map((f, i) => (
                    <FindingCard key={f.id} icon={f.icon} title={f.title} desc={f.desc} severity={f.severity} delay={.1 + i * .05} />
                  ))}
                </div>
              </HudPanel>
            </div>}

            {/* CONSOLE */}
            {logs.length > 0 && <div className="np-c12">
              <HudPanel title="SYSTEM CONSOLE" icon="⌘" status={phase === "done" ? "done" : "active"} accent="#00b4d8" delay={.4}>
                <div style={{ maxHeight: 160, overflow: "auto", fontSize: 10, lineHeight: 2, fontFamily: "var(--ff-mono)" }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ color: l.level === "ok" ? "rgba(0,230,118,.55)" : l.level === "sys" ? "rgba(0,180,216,.45)" : l.level === "warn" ? "rgba(255,214,0,.55)" : "rgba(255,255,255,.25)", borderBottom: "1px solid rgba(255,255,255,.015)", padding: "1px 0" }}>
                      <span style={{ color: "rgba(255,255,255,.1)", marginRight: 8, fontFamily: "var(--ff-display)", fontSize: 8 }}>{new Date(l.t).toLocaleTimeString("en", { hour12: false })}</span>{l.msg}
                    </div>
                  ))}
                </div>
              </HudPanel>
            </div>}
          </div>
        )}

        {/* IDLE */}
        {phase === "idle" && <div style={{ textAlign: "center", padding: "70px 20px", animation: "hudIn .5s ease both" }}>
          <div style={{ fontSize: 50, marginBottom: 12, filter: "drop-shadow(0 0 15px rgba(0,255,213,.08))" }}>◎</div>
          <div style={{ fontSize: 12, fontFamily: "var(--ff-display)", color: "rgba(0,255,213,.3)", letterSpacing: 8, marginBottom: 8 }}>SYSTEMS NOMINAL</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", letterSpacing: 1, maxWidth: 440, margin: "0 auto", lineHeight: 2 }}>
            10 measurement engines • 12 analysis patterns • Cloudflare Edge Network
          </div>
          {connType && <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
            <span className="np-badge" style={{ color: "#00ffd5", borderColor: "rgba(0,255,213,.15)", background: "rgba(0,255,213,.06)" }}>{CONN_TYPES.find(c => c.id === connType)?.icon} {CONN_TYPES.find(c => c.id === connType)?.label}</span>
            <span className="np-badge" style={{ color: "#00b4d8", borderColor: "rgba(0,180,216,.15)", background: "rgba(0,180,216,.06)" }}>{SCAN_SCOPES.find(s => s.id === scanScope)?.icon} {SCAN_SCOPES.find(s => s.id === scanScope)?.label}</span>
          </div>}
        </div>}

        <footer style={{ textAlign: "center", marginTop: 32, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.015)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.1)", letterSpacing: 4, fontFamily: "var(--ff-display)" }}>NETPROBE COMMAND CENTER • v4.0</div>
        </footer>
      </div>
    </div>
  );
}
