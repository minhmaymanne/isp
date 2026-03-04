// ═══════════════════════════════════════════════════════════════════════
//  NETPROBE — Measurement Engines (ALL REAL, NO MOCK)
// ═══════════════════════════════════════════════════════════════════════

import {
  GATEWAYS, TARGETS, TRACE_URLS, WAN_TARGETS,
  DL_SIZES, UL_SIZES, DNS_DOMAINS,
} from "./data.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Stats utilities ────────────────────────────────────────────────────
export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function jitterCalc(arr) {
  if (arr.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < arr.length; i++) sum += Math.abs(arr[i] - arr[i - 1]);
  return sum / (arr.length - 1);
}

export function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function computeStats(valid) {
  if (!valid.length) return { avg: 0, min: 0, max: 0, jitter: 0, p50: 0, p90: 0 };
  return {
    avg: +mean(valid).toFixed(1),
    min: +Math.min(...valid).toFixed(1),
    max: +Math.max(...valid).toFixed(1),
    jitter: +jitterCalc(valid).toFixed(1),
    p50: +percentile(valid, 50).toFixed(1),
    p90: +percentile(valid, 90).toFixed(1),
  };
}

// ── Probe utilities ────────────────────────────────────────────────────
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

export function imageProbe(url, timeout = 6000) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(-1); }, timeout);
    const done = () => { clearTimeout(timer); resolve(performance.now() - t0); };
    img.onload = done;
    img.onerror = done;
    img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now() + Math.random();
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine G — Cloudflare Trace
// ═══════════════════════════════════════════════════════════════════════
export async function fetchCFTrace() {
  const start = performance.now();
  for (const url of TRACE_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      const ms = performance.now() - start;
      const obj = {};
      text.split("\n").forEach(line => {
        const [k, ...v] = line.split("=");
        if (k && v.length) obj[k.trim()] = v.join("=").trim();
      });
      obj._ms = Math.round(ms);
      obj._url = url;
      return obj;
    } catch { continue; }
  }
  return { _failed: true, _error: "All trace endpoints unreachable" };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine H — GeoIP + ISP Identification
// ═══════════════════════════════════════════════════════════════════════
export async function fetchGeoIP() {
  // 1. Try ipapi.co (HTTPS, CORS OK)
  try {
    const res = await fetch("https://ipapi.co/json/", {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.ip) return {
        isp: d.org || d.asn || "Unknown",
        org: d.org || "",
        as: d.asn || "",
        asname: d.org || "",
        city: d.city || "",
        regionName: d.region || "",
        country: d.country_name || "",
        countryCode: d.country_code || "",
        lat: d.latitude,
        lon: d.longitude,
        mobile: false,
        proxy: false,
        hosting: false,
        query: d.ip,
        timezone: d.timezone || "",
      };
    }
  } catch {}

  // 2. Fallback: ipwho.is
  try {
    const res = await fetch("https://ipwho.is/", {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.success !== false) return {
        isp: d.connection?.isp || "Unknown",
        org: d.connection?.org || "",
        as: `AS${d.connection?.asn || ""}`,
        asname: d.connection?.org || "",
        city: d.city || "",
        regionName: d.region || "",
        country: d.country || "",
        countryCode: d.country_code || "",
        lat: d.latitude,
        lon: d.longitude,
        mobile: false,
        proxy: d.security?.proxy || false,
        hosting: d.security?.hosting || false,
        query: d.ip,
        timezone: d.timezone?.id || "",
      };
    }
  } catch {}

  return { _failed: true };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine Latency — Oscilloscope (24 samples)
// ═══════════════════════════════════════════════════════════════════════
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
      onSample?.(ms, i);
    } catch {
      samples.push(null);
      onSample?.(null, i);
    }
    await sleep(60);
  }

  const valid = samples.filter(s => s !== null);
  if (!valid.length) return { _failed: true };

  const sorted = [...valid].sort((a, b) => a - b);
  const trimmed = sorted.length > 4 ? sorted.slice(2, -2) : sorted;

  return {
    avg: +mean(trimmed).toFixed(1),
    jitter: +jitterCalc(trimmed).toFixed(1),
    min: +Math.min(...valid).toFixed(1),
    max: +Math.max(...valid).toFixed(1),
    p50: +percentile(valid, 50).toFixed(1),
    p90: +percentile(valid, 90).toFixed(1),
    raw: valid.map(v => +v.toFixed(1)),
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine D — Speed Test (Download + Upload)
// ═══════════════════════════════════════════════════════════════════════
export async function measureDownload(onProgress) {
  const samples = [];
  for (let si = 0; si < DL_SIZES.length; si++) {
    const size = DL_SIZES[si];
    const iterations = size <= 500000 ? 3 : 2;
    for (let i = 0; i < iterations; i++) {
      try {
        const t0 = performance.now();
        const res = await fetch(
          `https://speed.cloudflare.com/__down?bytes=${size}`,
          { cache: "no-store", signal: AbortSignal.timeout(15000) }
        );
        const buf = await res.arrayBuffer();
        const elapsed = performance.now() - t0;
        if (elapsed > 40) {
          const mbps = (buf.byteLength * 8) / (elapsed / 1000) / 1e6;
          samples.push(mbps);
        }
      } catch {}
    }
    onProgress?.({
      phase: "download",
      progress: (si + 1) / DL_SIZES.length,
      currentSamples: samples.length,
    });
  }
  return calculateSpeedResult(samples);
}

export async function measureUpload(onProgress) {
  const samples = [];
  for (let si = 0; si < UL_SIZES.length; si++) {
    const size = UL_SIZES[si];
    const iterations = size <= 500000 ? 3 : 2;
    for (let i = 0; i < iterations; i++) {
      try {
        const blob = new Blob([new ArrayBuffer(size)]);
        const t0 = performance.now();
        await fetch("https://speed.cloudflare.com/__up", {
          method: "POST", body: blob, cache: "no-store",
          signal: AbortSignal.timeout(15000),
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
      progress: (si + 1) / UL_SIZES.length,
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
    p90: +(samples[p90idx] || avg).toFixed(1),
    samples: samples.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine B — WAN RTT Multi-target
// ═══════════════════════════════════════════════════════════════════════
export async function probeWAN(onUpdate) {
  const results = [];
  for (const target of WAN_TARGETS) {
    const raw = [];
    for (let i = 0; i < 8; i++) {
      try {
        const t0 = performance.now();
        await fetch(target.url, {
          mode: "no-cors", cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        raw.push(performance.now() - t0);
      } catch { raw.push(null); }
      await sleep(200);
    }
    const valid = raw.filter(s => s !== null);
    const result = {
      ...target,
      ...computeStats(valid),
      loss: +((raw.length - valid.length) / raw.length * 100).toFixed(1),
      raw,
    };
    results.push(result);
    onUpdate?.(result);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine E — DNS Resolution Timing
// ═══════════════════════════════════════════════════════════════════════
export async function probeDNS() {
  const results = {};
  for (const domain of DNS_DOMAINS) {
    try {
      const t0 = performance.now();
      await fetch(`https://dns.google/resolve?name=${domain}&type=A&_=${Date.now()}`, {
        cache: "no-store", signal: AbortSignal.timeout(3000),
      });
      results[domain] = +(performance.now() - t0).toFixed(0);
    } catch {
      results[domain] = null;
    }
  }
  const valid = Object.values(results).filter(v => v !== null);
  return {
    avg: valid.length ? +mean(valid).toFixed(0) : null,
    domains: results,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine C — Network Info API
// ═══════════════════════════════════════════════════════════════════════
export function readNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return { _unsupported: true };
  return {
    type: conn.type || "unknown",
    effectiveType: conn.effectiveType || "unknown",
    downlink: conn.downlink || null,
    downlinkMax: conn.downlinkMax || null,
    rtt: conn.rtt || null,
    saveData: conn.saveData || false,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine F — Resource Timing
// ═══════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════
//  Engine I — International Target Reachability
// ═══════════════════════════════════════════════════════════════════════
export async function probeInternationalTargets(onTargetDone) {
  const results = {};
  for (const target of TARGETS) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const ms = await imageProbe(target.url, 7000);
      if (ms > 0) samples.push(ms);
      await sleep(80);
    }
    const valid = samples.filter(s => s > 0);
    results[target.id] = {
      avg: valid.length ? +mean(valid).toFixed(0) : null,
      jitter: valid.length > 1 ? +jitterCalc(valid).toFixed(0) : 0,
      loss: +(((5 - valid.length) / 5) * 100).toFixed(0),
      min: valid.length ? +Math.min(...valid).toFixed(0) : null,
      max: valid.length ? +Math.max(...valid).toFixed(0) : null,
    };
    onTargetDone?.(target.id, results[target.id]);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine A — LAN Gateway Probe
// ═══════════════════════════════════════════════════════════════════════
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
        if (ms < 1120) {
          onHit?.({ ip: gw.ip, ms, hint: gw.hint });
          return { ip: gw.ip, ms, hint: gw.hint };
        }
      } catch {
        const ms = performance.now();
        if (ms < 1100) {
          return { ip: gw.ip, ms, hint: gw.hint };
        }
      }
      return null;
    })
  );
  const alive = results
    .map(r => r.status === "fulfilled" ? r.value : null)
    .filter(Boolean)
    .sort((a, b) => a.ms - b.ms);
  return alive[0] || null;
}

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
    } catch {
      raw.push(null);
      onSample?.(null, i);
    }
    await sleep(350);
  }
  const valid = raw.filter(s => s !== null);
  return {
    ip,
    ...computeStats(valid),
    loss: +((raw.length - valid.length) / raw.length * 100).toFixed(1),
    raw,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Engine X — Buffer Bloat Test
// ═══════════════════════════════════════════════════════════════════════
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
  const loadGen = Array.from({ length: 6 }, () =>
    fetch("https://speed.cloudflare.com/__down?bytes=524288", { cache: "no-store" })
      .then(r => r.arrayBuffer())
      .catch(() => {})
  );

  for (let i = 0; i < 5; i++) {
    const ms = await imageProbe(`http://${gatewayIp}/`, 3000);
    if (ms > 0) loadProbes.push(ms);
    await sleep(300);
  }
  await Promise.allSettled(loadGen);

  const loadAvg = mean(loadProbes);
  const bloatRatio = idleAvg > 0 ? +(loadAvg / idleAvg).toFixed(2) : null;

  return { idleAvg: +idleAvg.toFixed(1), loadAvg: +loadAvg.toFixed(1), bloatRatio };
}
