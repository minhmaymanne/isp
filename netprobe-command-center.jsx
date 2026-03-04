import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════
//  NETPROBE COMMAND CENTER — Chơi Công Nghệ
//  Cyberpunk Network Operations Center • speed.ccn.vn
// ═══════════════════════════════════════════════════════════════════════

/* ── MOCK DATA ── */
const MOCK = {
  trace: { ip:"113.161.72.xxx", colo:"HAN", loc:"VN", tls:"TLSv1.3", http:"h3", warp:"off", sni:"plaintext", kex:"X25519MLKEM768", _ms:12 },
  geo: { isp:"Viettel Group", org:"Viettel CHT", as:"AS7552", city:"Hà Nội", regionName:"Hà Nội", country:"Vietnam", countryCode:"VN", lat:21.0285, lon:105.8542, mobile:false, proxy:false, hosting:false },
  latency: { avg:14.2, jitter:2.8, min:9.1, max:28.4, p50:13.2, p90:19.7, raw:[15.2,12.1,18.3,9.1,14.7,16.2,11.8,13.4,28.4,14.1,12.8,15.6,13.9,11.2,16.8,14.3,12.7,19.7,13.1,15.4,14.8,12.3,17.1,13.6] },
  dl: { mbps:247.3, p90:289.1, samples:18 },
  ul: { mbps:118.6, p90:142.3, samples:12 },
  dns: { avg:8, domains:{ "cloudflare.com":4, "google.com":12, "facebook.com":9 } },
  targets: {
    cf:{avg:12,jitter:2,loss:0,min:9,max:18},
    google:{avg:24,jitter:4,loss:0,min:18,max:35},
    fb:{avg:31,jitter:5,loss:0,min:22,max:48},
    yt:{avg:28,jitter:3,loss:0,min:21,max:38},
    aws:{avg:45,jitter:6,loss:0,min:32,max:62},
    gh:{avg:89,jitter:12,loss:0,min:68,max:128},
    tt:{avg:22,jitter:3,loss:0,min:16,max:31},
    shopee:{avg:18,jitter:2,loss:0,min:14,max:26},
    wiki:{avg:72,jitter:8,loss:0,min:58,max:98},
    lazada:{avg:35,jitter:5,loss:0,min:28,max:52},
    gcloud:{avg:42,jitter:7,loss:0,min:30,max:68},
    steam:{avg:56,jitter:9,loss:0,min:40,max:82},
  },
  score: 91,
};

const TARGETS_META = [
  {id:"cf",name:"Cloudflare",icon:"☁️",cat:"CDN",region:"HAN"},
  {id:"google",name:"Google",icon:"🔍",cat:"Search",region:"SIN"},
  {id:"fb",name:"Facebook",icon:"📘",cat:"Social",region:"HKG"},
  {id:"yt",name:"YouTube",icon:"▶️",cat:"Stream",region:"SIN"},
  {id:"aws",name:"AWS",icon:"🟧",cat:"Cloud",region:"SIN"},
  {id:"gh",name:"GitHub",icon:"🐙",cat:"Dev",region:"NRT"},
  {id:"tt",name:"TikTok",icon:"🎵",cat:"Social",region:"SIN"},
  {id:"shopee",name:"Shopee",icon:"🛒",cat:"Commerce",region:"SGN"},
  {id:"wiki",name:"Wikipedia",icon:"📚",cat:"Info",region:"SIN"},
  {id:"lazada",name:"Lazada",icon:"🛍️",cat:"Commerce",region:"SIN"},
  {id:"gcloud",name:"GCP",icon:"☁️",cat:"Cloud",region:"SIN"},
  {id:"steam",name:"Steam",icon:"🎮",cat:"Gaming",region:"NRT"},
];

const PHASES = [
  {id:"boot",name:"SYSTEM BOOT"},
  {id:"trace",name:"CF TRACE"},
  {id:"geo",name:"GEOLOCATION"},
  {id:"latency",name:"LATENCY"},
  {id:"download",name:"DOWNLOAD"},
  {id:"upload",name:"UPLOAD"},
  {id:"dns",name:"DNS"},
  {id:"targets",name:"TARGETS"},
  {id:"analysis",name:"ANALYSIS"},
  {id:"score",name:"SCORE"},
];

const BOOT_LINES = [
  "[BIOS] NetProbe Command Center v3.7.2",
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

function grade(s){
  if(s>=92) return {g:"S+",c:"#00ffd5",l:"EXCEPTIONAL"};
  if(s>=80) return {g:"A",c:"#00e676",l:"EXCELLENT"};
  if(s>=65) return {g:"B",c:"#c6ff00",l:"GOOD"};
  if(s>=50) return {g:"C",c:"#ffd600",l:"FAIR"};
  return {g:"D",c:"#ff1744",l:"POOR"};
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ═══════════════════════════════════════════════════
//  CANVAS: HEX GRID + PARTICLES + DATA RAIN
// ═══════════════════════════════════════════════════
function CommandCanvas({phase}){
  const ref=useRef(null);
  const frameRef=useRef(0);
  const particles=useRef([]);
  const streams=useRef([]);

  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    let W,H;
    const resize=()=>{W=c.width=window.innerWidth;H=c.height=window.innerHeight;};
    resize();

    const N=55;
    particles.current=Array.from({length:N},()=>({
      x:Math.random()*W,y:Math.random()*H,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
      r:Math.random()*1.2+.3,life:Math.random(),
    }));

    const cols=Math.floor(W/20);
    streams.current=Array.from({length:cols},()=>({
      y:Math.random()*H*2-H,speed:Math.random()*1.5+.8,
      len:Math.floor(Math.random()*12+4),
    }));

    let running=true;
    const active=phase==="running"||phase==="done";

    const draw=(t)=>{
      if(!running)return;
      ctx.clearRect(0,0,W,H);

      // Vignette
      const vg=ctx.createRadialGradient(W/2,H/2,W*.15,W/2,H/2,W*.75);
      vg.addColorStop(0,"transparent");
      vg.addColorStop(1,"rgba(0,0,0,.5)");
      ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

      // Hex grid
      const sz=42;const h=sz*Math.sqrt(3);
      for(let row=-1;row<H/h+1;row++){
        for(let col=-1;col<W/(sz*1.5)+1;col++){
          const x=col*sz*1.5;
          const y=row*h+(col%2?h/2:0);
          const pulse=Math.sin(t*.0008+col*.25+row*.18)*.5+.5;
          ctx.strokeStyle=active&&pulse>.88?`rgba(0,255,213,${pulse*.05})`:(active?"rgba(0,180,216,.025)":"rgba(0,180,216,.012)");
          ctx.lineWidth=.5;
          ctx.beginPath();
          for(let i=0;i<6;i++){
            const a=Math.PI/3*i-Math.PI/6;
            const px=x+sz*.42*Math.cos(a),py=y+sz*.42*Math.sin(a);
            i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
          }
          ctx.closePath();ctx.stroke();
        }
      }

      // Data rain
      if(active){
        ctx.font="9px 'IBM Plex Mono',monospace";
        for(const s of streams.current){
          s.y+=s.speed;if(s.y>H+200)s.y=-80;
          const x=streams.current.indexOf(s)*20;
          for(let i=0;i<s.len;i++){
            const cy=s.y-i*13;if(cy<-13||cy>H+13)continue;
            const alpha=i===0?.45:Math.max(0,(1-i/s.len)*.12);
            ctx.fillStyle=i===0?`rgba(0,255,213,${alpha})`:`rgba(0,180,216,${alpha})`;
            ctx.fillText(String.fromCharCode(0x30A0+Math.floor(Math.random()*96)),x,cy);
          }
        }
      }

      // Particles + connections
      const ps=particles.current;
      for(const p of ps){
        p.x+=p.vx*(active?2:1);p.y+=p.vy*(active?2:1);
        if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      }
      for(let i=0;i<ps.length;i++){
        for(let j=i+1;j<ps.length;j++){
          const dx=ps[i].x-ps[j].x,dy=ps[i].y-ps[j].y,d2=dx*dx+dy*dy;
          if(d2<14000){
            const a=(1-d2/14000)*(active?.07:.025);
            ctx.beginPath();ctx.moveTo(ps[i].x,ps[i].y);ctx.lineTo(ps[j].x,ps[j].y);
            ctx.strokeStyle=`rgba(0,255,213,${a})`;ctx.lineWidth=.4;ctx.stroke();
          }
        }
      }
      for(const p of ps){
        const glow=Math.sin(t*.003+p.life*10)*.4+.6;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r*glow,0,Math.PI*2);
        ctx.fillStyle=`rgba(0,255,213,${glow*(active?.2:.08)})`;ctx.fill();
      }

      frameRef.current=requestAnimationFrame(draw);
    };
    frameRef.current=requestAnimationFrame(draw);
    window.addEventListener("resize",resize);
    return()=>{running=false;cancelAnimationFrame(frameRef.current);window.removeEventListener("resize",resize);};
  },[phase]);

  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}/>;
}

// ═══════════════════════════════════════════════════
//  RADAR SWEEP with Score
// ═══════════════════════════════════════════════════
function RadarSweep({size=250,score,active}){
  const g=score!=null?grade(score):{c:"#00b4d8",g:"—",l:"SCANNING"};
  const [disp,setDisp]=useState(0);
  const [sweep,setSweep]=useState(0);

  useEffect(()=>{
    if(!active&&score==null)return;
    const i=setInterval(()=>setSweep(p=>(p+2.5)%360),30);
    return()=>clearInterval(i);
  },[active,score]);

  useEffect(()=>{
    if(score==null){setDisp(0);return;}
    let c=0;const i=setInterval(()=>{c++;if(c>score){clearInterval(i);return;}setDisp(c);},22);
    return()=>clearInterval(i);
  },[score]);

  const r=size/2-22,cx=size/2,cy=size/2;

  return(
    <div style={{position:"relative",width:size,height:size}}>
      <div style={{position:"absolute",inset:-35,borderRadius:"50%",background:`radial-gradient(circle,${g.c}08 0%,transparent 55%)`,filter:"blur(35px)"}}/>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="rg"><stop offset="0%" stopColor={g.c} stopOpacity=".12"/><stop offset="100%" stopColor={g.c} stopOpacity="0"/></radialGradient>
          <filter id="gl"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {[.25,.5,.75,1].map((f,i)=><circle key={i} cx={cx} cy={cy} r={r*f} fill="none" stroke="rgba(0,180,216,.05)" strokeWidth=".5" strokeDasharray={i<3?"2 5":"none"}/>)}
        {[0,45,90,135].map(a=><line key={a} x1={cx+Math.cos(a*Math.PI/180)*r*.12} y1={cy+Math.sin(a*Math.PI/180)*r*.12} x2={cx+Math.cos(a*Math.PI/180)*r} y2={cy+Math.sin(a*Math.PI/180)*r} stroke="rgba(0,180,216,.035)" strokeWidth=".5"/>)}
        {active&&<><line x1={cx} y1={cy} x2={cx+Math.cos(sweep*Math.PI/180)*r} y2={cy+Math.sin(sweep*Math.PI/180)*r} stroke={g.c} strokeWidth="1" opacity=".35" filter="url(#gl)"/>
          <path d={`M${cx},${cy} L${cx+Math.cos(sweep*Math.PI/180)*r},${cy+Math.sin(sweep*Math.PI/180)*r} A${r},${r} 0 0,0 ${cx+Math.cos((sweep-35)*Math.PI/180)*r},${cy+Math.sin((sweep-35)*Math.PI/180)*r} Z`} fill="url(#rg)" opacity=".5"/></>}
        {score!=null&&(()=>{const pct=disp/100,sA=-90,eA=sA+pct*360,sR=sA*Math.PI/180,eR=eA*Math.PI/180,rr=r+7;
          return <path d={`M${cx+rr*Math.cos(sR)},${cy+rr*Math.sin(sR)} A${rr},${rr} 0 ${pct>.5?1:0},1 ${cx+rr*Math.cos(eR)},${cy+rr*Math.sin(eR)}`} fill="none" stroke={g.c} strokeWidth="3" strokeLinecap="round" filter="url(#gl)" opacity=".8"/>;})()}
        {Array.from({length:60}).map((_,i)=>{const a=(i*6-90)*Math.PI/180,m=i%5===0;return <line key={i} x1={cx+(r+(m?10:12))*Math.cos(a)} y1={cy+(r+(m?10:12))*Math.sin(a)} x2={cx+(r+(m?18:15))*Math.cos(a)} y2={cy+(r+(m?18:15))*Math.sin(a)} stroke={m?"rgba(0,255,213,.12)":"rgba(0,180,216,.05)"} strokeWidth={m?1:.5}/>;
        })}
        {active&&TARGETS_META.slice(0,8).map((t,i)=>{const a=(i*45+sweep*.25)*Math.PI/180,d=r*(.25+Math.sin(i*2.1)*.35);return <circle key={i} cx={cx+d*Math.cos(a)} cy={cy+d*Math.sin(a)} r="2.5" fill={g.c} opacity={Math.sin(sweep*.025+i)*.35+.25} filter="url(#gl)"/>;
        })}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        {score!=null?<>
          <div style={{fontSize:12,fontWeight:800,color:g.c,letterSpacing:8,fontFamily:"var(--ff-display)",textShadow:`0 0 25px ${g.c}40`}}>{g.g}</div>
          <div style={{fontSize:54,fontWeight:900,fontFamily:"var(--ff-display)",color:"#e0f7fa",lineHeight:1,textShadow:`0 0 40px ${g.c}20`}}>{disp}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,.18)",letterSpacing:4,marginTop:2}}>/ 100</div>
          <div style={{fontSize:9,color:g.c,fontWeight:600,marginTop:8,letterSpacing:3}}>{g.l}</div>
        </>:active?<div style={{fontSize:10,color:"#00ffd5",fontFamily:"var(--ff-display)",animation:"pulse 1.5s ease infinite",letterSpacing:5}}>SCANNING</div>
        :<div style={{fontSize:8,color:"rgba(255,255,255,.06)",letterSpacing:4}}>STANDBY</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  CIRCULAR SPEED GAUGE
// ═══════════════════════════════════════════════════
function SpeedGauge({value,max,label,unit,color="#00ffd5",size=135}){
  const [anim,setAnim]=useState(0);
  useEffect(()=>{if(value==null)return;let f=0;const i=setInterval(()=>{f+=max/55;if(f>=value){setAnim(value);clearInterval(i);return;}setAnim(f);},22);return()=>clearInterval(i);},[value,max]);

  const r=size/2-14,cx=size/2,cy=size/2,startA=140,endA=400,range=endA-startA;
  const pct=clamp((anim||0)/max,0,1),valA=startA+pct*range;
  const arc=(f,t,R)=>{const fr=f*Math.PI/180,tr=t*Math.PI/180;return `M${cx+R*Math.cos(fr)},${cy+R*Math.sin(fr)} A${R},${R} 0 ${t-f>180?1:0},1 ${cx+R*Math.cos(tr)},${cy+R*Math.sin(tr)}`;};

  return(
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size}>
        <defs><linearGradient id={`sg${label}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color}/><stop offset="100%" stopColor={color} stopOpacity=".3"/></linearGradient></defs>
        <path d={arc(startA,endA,r)} fill="none" stroke="rgba(255,255,255,.03)" strokeWidth="5" strokeLinecap="round"/>
        {Array.from({length:21}).map((_,i)=>{const a=(startA+i*(range/20))*Math.PI/180,m=i%5===0;return <line key={i} x1={cx+(r-5)*Math.cos(a)} y1={cy+(r-5)*Math.sin(a)} x2={cx+(r+(m?5:2))*Math.cos(a)} y2={cy+(r+(m?5:2))*Math.sin(a)} stroke={m?"rgba(255,255,255,.1)":"rgba(255,255,255,.03)"} strokeWidth={m?1:.5}/>;
        })}
        {pct>0&&<path d={arc(startA,valA,r)} fill="none" stroke={`url(#sg${label})`} strokeWidth="5" strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color}40)`}}/>}
        {pct>0&&(()=>{const a=valA*Math.PI/180;return <circle cx={cx+r*Math.cos(a)} cy={cy+r*Math.sin(a)} r="4" fill={color} style={{filter:`drop-shadow(0 0 8px ${color})`}}/>;})()}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:8}}>
        <div style={{fontSize:26,fontWeight:900,fontFamily:"var(--ff-display)",color:"#e0f7fa",textShadow:`0 0 15px ${color}25`}}>{value!=null?Math.round(anim):"—"}</div>
        <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:2}}>{unit}</div>
        <div style={{fontSize:9,color,fontWeight:700,letterSpacing:3,marginTop:3}}>{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  OSCILLOSCOPE
// ═══════════════════════════════════════════════════
function Oscilloscope({data=[],color="#00ffd5",height=65,label,active}){
  const [noise,setNoise]=useState([]);
  useEffect(()=>{if(!active)return;const i=setInterval(()=>setNoise(Array.from({length:40},()=>Math.random()*30+10)),100);return()=>clearInterval(i);},[active]);
  const d=data.length>0?data:noise;if(!d.length)return null;
  const mx=Math.max(...d)*1.2||1;
  const pts=d.map((v,i)=>[(i/(d.length-1||1))*100,height-((v/mx)*(height-8))-4]);

  return(
    <div>
      {label&&<div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:2,marginBottom:4}}>{label}</div>}
      <div style={{background:"rgba(0,0,0,.35)",borderRadius:3,border:"1px solid rgba(0,180,216,.06)",padding:3,position:"relative",overflow:"hidden"}}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{width:"100%",height,display:"block"}}>
          {[.25,.5,.75].map(f=><line key={f} x1="0" y1={height*f} x2="100" y2={height*f} stroke="rgba(0,180,216,.03)" strokeWidth=".3"/>)}
          <defs><linearGradient id={`of${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
          <polygon points={[`0,${height}`,...pts.map(p=>p.join(","))    ,`100,${height}`].join(" ")} fill={`url(#of${color.slice(1)})`}/>
          <polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{filter:`drop-shadow(0 0 4px ${color}50)`}}/>
          {pts.length>0&&<circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="1.8" fill={color} style={{filter:`drop-shadow(0 0 5px ${color})`}}/>}
        </svg>
        {active&&<div style={{position:"absolute",top:0,bottom:0,width:2,background:`linear-gradient(180deg,transparent,${color}35,transparent)`,animation:"oscScan 2s linear infinite"}}/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  HUD PANEL
// ═══════════════════════════════════════════════════
function HudPanel({children,title,icon,status,accent="#00b4d8",delay=0,span,glow}){
  const cs=10;
  const Corner=({pos})=>{
    const s={position:"absolute",width:cs,height:cs};
    const b=`1.5px solid ${accent}35`;
    if(pos==="tl") return <div style={{...s,top:-1,left:-1,borderTop:b,borderLeft:b}}/>;
    if(pos==="tr") return <div style={{...s,top:-1,right:-1,borderTop:b,borderRight:b}}/>;
    if(pos==="bl") return <div style={{...s,bottom:-1,left:-1,borderBottom:b,borderLeft:b}}/>;
    return <div style={{...s,bottom:-1,right:-1,borderBottom:b,borderRight:b}}/>;
  };

  return(
    <div style={{position:"relative",background:"rgba(4,10,20,.72)",backdropFilter:"blur(12px) saturate(1.2)",border:`1px solid ${accent}10`,borderRadius:2,overflow:"hidden",animation:`hudIn .5s ease ${delay}s both`,gridColumn:span?`span ${span}`:"auto",boxShadow:glow?`0 0 25px ${accent}06, inset 0 0 20px ${accent}03`:"none"}}>
      <Corner pos="tl"/><Corner pos="tr"/><Corner pos="bl"/><Corner pos="br"/>
      {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {icon&&<span style={{fontSize:13,filter:`drop-shadow(0 0 3px ${accent}35)`}}>{icon}</span>}
          <span style={{fontSize:10,fontWeight:700,color:accent,letterSpacing:3,fontFamily:"var(--ff-display)"}}>{title}</span>
        </div>
        {status&&<div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:status==="done"?"#00e676":status==="active"?"#00ffd5":"rgba(255,255,255,.08)",boxShadow:status==="active"?`0 0 6px #00ffd5`:"none",animation:status==="active"?"pulse .8s infinite":"none"}}/>
          <span style={{fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2,fontFamily:"var(--ff-display)"}}>{status.toUpperCase()}</span>
        </div>}
      </div>}
      <div style={{padding:"10px 16px 16px"}}>{children}</div>
      {glow&&<div style={{position:"absolute",bottom:0,left:"10%",right:"10%",height:1,background:`linear-gradient(90deg,transparent,${accent}25,transparent)`}}/>}
    </div>
  );
}

// ── Metric ──
function M({l,v,u,q,s}){
  const c=q==="good"?"#00ffd5":q==="ok"?"#c6ff00":q==="warn"?"#ffd600":q==="bad"?"#ff1744":null;
  return(<div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",padding:`${s?3:5}px 0`,borderBottom:"1px solid rgba(255,255,255,.03)"}}>
    <span style={{fontSize:s?9:11,color:"rgba(255,255,255,.45)",fontWeight:500}}>{l}</span>
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{fontSize:s?12:14,fontWeight:700,color:"#f0f8ff",fontFamily:"var(--ff-display)"}}>{v??"—"}</span>
      {u&&<span style={{fontSize:8,color:"rgba(255,255,255,.25)"}}>{u}</span>}
      {c&&<span style={{width:5,height:5,borderRadius:"50%",background:c,boxShadow:`0 0 5px ${c}`}}/>}
    </div>
  </div>);
}

// ── Target Grid ──
function TargetGrid({targets,activeId}){
  return(<div className="np-targets-grid">
    {TARGETS_META.map(t=>{
      const r=targets?.[t.id],isA=activeId===t.id;
      const lc=!r?"rgba(255,255,255,.05)":r.avg<50?"#00ffd5":r.avg<100?"#c6ff00":r.avg<200?"#ffd600":"#ff9100";
      return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:3,background:isA?"rgba(0,255,213,.04)":"rgba(255,255,255,.01)",border:`1px solid ${isA?"rgba(0,255,213,.15)":r?"rgba(255,255,255,.04)":"rgba(255,255,255,.02)"}`,transition:"all .3s",position:"relative",overflow:"hidden"}}>
        {isA&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(0,255,213,.05),transparent)",animation:"targetScan .8s linear infinite"}}/>}
        <span style={{fontSize:15,position:"relative",zIndex:1}}>{t.icon}</span>
        <div style={{flex:1,position:"relative",zIndex:1,minWidth:0}}>
          <div style={{fontSize:10,fontWeight:600,color:r?"rgba(255,255,255,.6)":"rgba(255,255,255,.15)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,.2)"}}>{t.cat} • {t.region}</div>
        </div>
        <div style={{position:"relative",zIndex:1,textAlign:"right"}}>
          {isA?<span style={{fontSize:9,color:"#00ffd5",animation:"pulse .5s infinite"}}>●●●</span>
          :r?<><div style={{fontSize:13,fontWeight:800,color:lc,fontFamily:"var(--ff-display)"}}>{r.avg}</div><div style={{fontSize:7,color:"rgba(255,255,255,.2)"}}>ms</div></>
          :<div style={{fontSize:8,color:"rgba(255,255,255,.06)"}}>—</div>}
        </div>
      </div>);
    })}
  </div>);
}

// ── Finding Card ──
function FindingCard({icon,title,desc,severity,delay=0}){
  const sc=severity==="good"?"#00ffd5":severity==="info"?"#00b4d8":severity==="warn"?"#ffd600":"#ff1744";
  return(<div style={{padding:"14px 16px",borderRadius:3,position:"relative",overflow:"hidden",background:`linear-gradient(135deg,${sc}05,transparent)`,border:`1px solid ${sc}15`,animation:`hudIn .4s ease ${delay}s both`}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:sc,boxShadow:`0 0 8px ${sc}40`}}/>
    <div style={{display:"flex",alignItems:"start",gap:10,paddingLeft:8}}>
      <span style={{fontSize:18,filter:`drop-shadow(0 0 4px ${sc}40)`,flexShrink:0,marginTop:1}}>{icon}</span>
      <div><div style={{fontSize:13,fontWeight:700,color:sc,marginBottom:4,lineHeight:1.3}}>{title}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.65)",lineHeight:1.8}}>{desc}</div></div>
    </div>
  </div>);
}

// ── Phase Timeline ──
function PhaseTimeline({phases,currentIdx}){
  return(<div style={{display:"flex",alignItems:"center",gap:0,overflow:"hidden",padding:"0 2px"}}>
    {phases.map((p,i)=>{
      const done=i<currentIdx,act=i===currentIdx;
      const c=done?"#00ffd5":act?"#00b4d8":"rgba(255,255,255,.04)";
      return(<div key={p.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <div style={{width:"100%",height:2,background:done?c:act?`linear-gradient(90deg,${c},transparent)`:"rgba(255,255,255,.02)",borderRadius:1,transition:"all .5s",boxShadow:act?`0 0 6px ${c}35`:"none"}}/>
        <div style={{fontSize:7,color:done||act?c:"rgba(255,255,255,.06)",letterSpacing:1,textAlign:"center",fontFamily:"var(--ff-display)",whiteSpace:"nowrap"}}>{p.name}</div>
      </div>);
    })}
  </div>);
}

// ── Boot Terminal ──
function BootTerminal({lines}){
  const [vis,setVis]=useState([]);
  const [cur,setCur]=useState(true);
  const ref=useRef(null);
  useEffect(()=>{let i=0;const t=setInterval(()=>{if(i>=lines.length){clearInterval(t);return;}setVis(p=>[...p,lines[i]]);i++;},120);const c=setInterval(()=>setCur(p=>!p),350);return()=>{clearInterval(t);clearInterval(c);};},[]);
  useEffect(()=>{ref.current?.scrollTo(0,99999);},[vis]);

  return(<div ref={ref} style={{background:"rgba(0,4,12,.92)",border:"1px solid rgba(0,180,216,.12)",borderRadius:3,padding:"12px 14px",maxHeight:260,overflow:"auto",fontFamily:"var(--ff-mono)",fontSize:9,lineHeight:1.8,color:"rgba(0,255,213,.65)",boxShadow:"0 0 40px rgba(0,255,213,.02), inset 0 0 50px rgba(0,0,0,.5)"}}>
    {vis.map((l,i)=>{
      const isL=i===vis.length-1,ok=typeof l==="string"&&(l.includes("nominal")||l.includes("ready")||l.includes("loaded")||l.includes("available"));
      return(<div key={i} style={{opacity:isL?1:.45,color:ok?"#00e676":"rgba(0,255,213,.55)"}}>
        <span style={{color:"rgba(255,255,255,.08)",marginRight:6}}>{String(i+1).padStart(2,"0")}</span>{l}{isL&&cur&&<span style={{color:"#00ffd5",marginLeft:2}}>█</span>}
      </div>);
    })}
  </div>);
}

// ═══════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════
export default function App(){
  const [phase,setPhase]=useState("idle");
  const [phaseIdx,setPhaseIdx]=useState(-1);
  const [elapsed,setElapsed]=useState(0);
  const [booted,setBooted]=useState(false);
  const [showTrace,setShowTrace]=useState(false);
  const [showGeo,setShowGeo]=useState(false);
  const [showLatency,setShowLatency]=useState(false);
  const [latProg,setLatProg]=useState([]);
  const [showDl,setShowDl]=useState(false);
  const [showUl,setShowUl]=useState(false);
  const [showDns,setShowDns]=useState(false);
  const [targetsDone,setTargetsDone]=useState({});
  const [scanTarget,setScanTarget]=useState(null);
  const [showAnalysis,setShowAnalysis]=useState(false);
  const [showScore,setShowScore]=useState(false);
  const [logs,setLogs]=useState([]);
  const timerRef=useRef(null);

  const addLog=(msg,level="info")=>setLogs(p=>[...p,{t:Date.now(),msg,level}].slice(-45));

  useEffect(()=>{
    if(phase==="running"||phase==="booting"){timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000);}else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[phase]);

  const sl=ms=>new Promise(r=>setTimeout(r,ms));

  const run=useCallback(async()=>{
    setPhase("booting");setPhaseIdx(0);setElapsed(0);
    setBooted(false);setShowTrace(false);setShowGeo(false);setShowLatency(false);setLatProg([]);
    setShowDl(false);setShowUl(false);setShowDns(false);setTargetsDone({});setScanTarget(null);
    setShowAnalysis(false);setShowScore(false);setLogs([]);
    addLog("Initiating boot sequence...","sys");
    await sl(2200);setBooted(true);setPhase("running");

    setPhaseIdx(1);addLog("Acquiring Cloudflare edge trace...","net");await sl(500);setShowTrace(true);
    addLog(`CF PoP: ${MOCK.trace.colo} — Hà Nội — ${MOCK.trace._ms}ms`,"ok");
    addLog(`Protocol: ${MOCK.trace.http} / ${MOCK.trace.tls} / ML-KEM-768`,"ok");await sl(1000);

    setPhaseIdx(2);addLog("Resolving geolocation...","net");await sl(300);setShowGeo(true);
    addLog(`ISP: ${MOCK.geo.isp} (${MOCK.geo.as})`,"ok");await sl(700);

    setPhaseIdx(3);addLog("Latency oscilloscope — 24 samples...","net");
    for(let i=0;i<MOCK.latency.raw.length;i++){setLatProg(p=>[...p,MOCK.latency.raw[i]]);await sl(85);}
    setShowLatency(true);addLog(`Latency: avg=${MOCK.latency.avg}ms jitter=${MOCK.latency.jitter}ms p90=${MOCK.latency.p90}ms`,"ok");await sl(350);

    setPhaseIdx(4);addLog("Download bandwidth — 6 payload sizes...","net");await sl(2200);setShowDl(true);
    addLog(`Download: ${MOCK.dl.mbps} Mbps (P90: ${MOCK.dl.p90})`,"ok");await sl(300);

    setPhaseIdx(5);addLog("Upload bandwidth — 4 payload sizes...","net");await sl(1600);setShowUl(true);
    addLog(`Upload: ${MOCK.ul.mbps} Mbps (P90: ${MOCK.ul.p90})`,"ok");await sl(300);

    setPhaseIdx(6);addLog("DNS resolution timing...","net");await sl(600);setShowDns(true);
    addLog(`DNS: avg ${MOCK.dns.avg}ms`,"ok");await sl(200);

    setPhaseIdx(7);addLog(`Scanning ${TARGETS_META.length} targets...`,"net");
    for(const t of TARGETS_META){
      setScanTarget(t.id);await sl(200);
      setTargetsDone(p=>({...p,[t.id]:MOCK.targets[t.id]}));
      addLog(`${t.icon} ${t.name}: ${MOCK.targets[t.id]?.avg}ms via ${t.region}`,"ok");
    }
    setScanTarget(null);await sl(250);

    setPhaseIdx(8);addLog("Cross-analysis engine — 12 rules...","sys");await sl(1000);setShowAnalysis(true);
    addLog("Analysis: 6 findings","ok");await sl(250);

    setPhaseIdx(9);addLog("Computing score...","sys");await sl(700);setShowScore(true);
    addLog(`Score: ${MOCK.score}/100 — ${grade(MOCK.score).g}`,"ok");
    addLog("═══ SCAN COMPLETE ═══","sys");
    setPhase("done");
  },[]);

  const fmtT=s=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const g=showScore?grade(MOCK.score):{c:"#00b4d8"};

  return(
    <div style={{"--ff-display":"'Orbitron',monospace","--ff-mono":"'IBM Plex Mono','Fira Code',monospace",minHeight:"100vh",background:"#010610",color:"#c8e6f0",fontFamily:"var(--ff-mono)",position:"relative",overflow:"hidden"}}>
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
        @keyframes dataFlow{0%{background-position:200% 0}100%{background-position:-200% 0}}
        body{overflow-x:hidden;background:#010610}button{font-family:inherit;cursor:pointer}
        .np-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px;align-items:start}
        .np-c3{grid-column:span 3}.np-c4{grid-column:span 4}.np-c6{grid-column:span 6}.np-c12{grid-column:span 12}
        .np-findings{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
        .np-targets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:6px}
        @media(max-width:768px){
          .np-grid{grid-template-columns:1fr !important;gap:10px}
          .np-c3,.np-c4,.np-c6,.np-c12{grid-column:span 1 !important}
          .np-findings{grid-template-columns:1fr !important}
          .np-targets-grid{grid-template-columns:repeat(2,1fr) !important}
        }
      `}</style>

      <CommandCanvas phase={phase}/>
      {/* Scanlines */}
      <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.025) 2px,rgba(0,0,0,.025) 4px)"}}/>
      {/* Noise */}
      <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",opacity:.025,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"}}/>

      <div style={{position:"relative",zIndex:2,maxWidth:1100,margin:"0 auto",padding:"0 12px 40px"}}>
        {/* HEADER */}
        <header style={{padding:"20px 0 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <div style={{width:5,height:5,background:"#00ffd5",borderRadius:"50%",boxShadow:"0 0 8px #00ffd5",animation:phase==="running"?"pulse .7s infinite":"none"}}/>
              <span style={{fontSize:9,letterSpacing:5,color:"rgba(255,255,255,.2)",fontWeight:600}}>SPEED.CCN.VN</span>
            </div>
            <h1 style={{fontSize:20,fontWeight:900,fontFamily:"var(--ff-display)",letterSpacing:10,lineHeight:1.2,background:"linear-gradient(135deg,#00ffd5 0%,#00b4d8 50%,#7c4dff 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 15px rgba(0,255,213,.12))",position:"relative"}}>
              NETPROBE
              {phase==="running"&&<span aria-hidden style={{position:"absolute",left:2,top:0,background:"linear-gradient(135deg,#ff1744,#7c4dff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"glitchClip 2s infinite linear alternate-reverse",opacity:.1}}>NETPROBE</span>}
            </h1>
            <div style={{fontSize:9,color:"rgba(255,255,255,.12)",letterSpacing:2}}>NETWORK OPERATIONS CENTER • CHƠI CÔNG NGHỆ</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {(phase==="running"||phase==="done")&&<div style={{fontSize:18,fontFamily:"var(--ff-display)",color:phase==="done"?g.c:"#00b4d8",fontWeight:700,letterSpacing:3,textShadow:`0 0 8px ${phase==="done"?g.c:"#00b4d8"}25`}}>{fmtT(elapsed)}</div>}
            {phase==="idle"?<button onClick={run} style={{background:"transparent",border:"1px solid rgba(0,255,213,.2)",borderRadius:3,padding:"12px 32px",animation:"borderPulse 3s ease infinite"}}>
              <span style={{color:"#00ffd5",fontSize:12,fontWeight:700,fontFamily:"var(--ff-display)",letterSpacing:6}}>▶ ENGAGE</span>
            </button>:phase==="done"?<button onClick={run} style={{background:"transparent",border:`1px solid ${g.c}25`,borderRadius:3,padding:"8px 24px",color:g.c,fontSize:10,fontFamily:"var(--ff-display)",letterSpacing:4}}>↻ RE-SCAN</button>:null}
          </div>
        </header>

        {/* TIMELINE */}
        {(phase==="running"||phase==="done")&&phaseIdx>=0&&<div style={{marginBottom:14,animation:"hudIn .3s ease both"}}><PhaseTimeline phases={PHASES} currentIdx={phase==="done"?PHASES.length:phaseIdx}/></div>}

        {/* BOOT */}
        {phase==="booting"&&!booted&&<div style={{maxWidth:580,margin:"30px auto",animation:"hudIn .3s ease both"}}><BootTerminal lines={BOOT_LINES}/></div>}

        {/* MAIN GRID */}
        {(booted||phase==="done")&&(
          <div className="np-grid">

            {/* INFO BADGES */}
            {showTrace&&<div className="np-c3" style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:3,background:"rgba(0,255,213,.02)",border:"1px solid rgba(0,255,213,.06)"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#00ffd5",boxShadow:"0 0 6px #00ffd5"}}/>
                <div><div style={{fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2}}>PUBLIC IP</div>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:"var(--ff-display)",color:"#f0f8ff"}}>{MOCK.trace.ip}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:3,background:"rgba(227,25,55,.03)",border:"1px solid rgba(227,25,55,.12)"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#e31937",boxShadow:"0 0 6px #e31937"}}/>
                <div><div style={{fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2}}>ISP</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#e31937"}}>{MOCK.geo.isp}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>Tier 1 • {MOCK.geo.as}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:3,background:"rgba(0,230,118,.03)",border:"1px solid rgba(0,230,118,.12)"}}>
                <span style={{fontSize:16}}>🇻🇳</span>
                <div><div style={{fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2}}>CF EDGE</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#00e676"}}>HAN — Hà Nội</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>Optimal ✓</div></div>
              </div>
              {showGeo&&<div style={{padding:"10px 14px",borderRadius:3,background:"rgba(255,255,255,.01)",border:"1px solid rgba(255,255,255,.04)"}}>
                <div style={{fontSize:8,color:"rgba(255,255,255,.2)",letterSpacing:2,marginBottom:4}}>GEOLOCATION</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{MOCK.geo.city}, {MOCK.geo.regionName}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,.2)",marginTop:2}}>{MOCK.geo.lat}°N, {MOCK.geo.lon}°E</div>
              </div>}
            </div>}

            {/* RADAR */}
            <div className={showTrace?"np-c6":"np-c12"} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
              <RadarSweep size={230} score={showScore?MOCK.score:null} active={phase==="running"}/>
              {showScore&&<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",width:"100%",animation:"hudIn .5s ease .2s both"}}>
                {[{i:"🎬",l:"STREAMING",ok:true,d:"4K Ultra HD"},{i:"🎮",l:"GAMING",ok:true,d:"Competitive"},{i:"📹",l:"VIDEO CALL",ok:true,d:"HD Quality"},{i:"☁️",l:"CLOUD",ok:true,d:"Fast Upload"}].map((v,k)=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:3,background:v.ok?"rgba(0,255,213,.03)":"rgba(255,23,68,.03)",border:`1px solid ${v.ok?"rgba(0,255,213,.1)":"rgba(255,23,68,.1)"}`,flex:"1 1 110px",minWidth:110}}>
                    <span style={{fontSize:18}}>{v.i}</span>
                    <div><div style={{fontSize:10,fontWeight:700,color:v.ok?"#00ffd5":"#ff1744",letterSpacing:1}}>{v.l}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{v.d}</div></div>
                  </div>
                ))}
              </div>}
            </div>

            {/* CF TRACE */}
            {showTrace&&<div className="np-c3">
              <HudPanel title="CF TRACE" icon="☁️" status="done" accent="#f48118" delay={.1}>
                <M l="Protocol" v="HTTP/3 QUIC" q="good"/>
                <M l="TLS" v="1.3" q="good"/>
                <M l="KEX" v="ML-KEM-768" q="good"/>
                <M l="SNI" v="Plaintext ⚠" q="warn"/>
                <M l="WARP" v="Off" q="ok"/>
                <M l="Trace RTT" v={MOCK.trace._ms} u="ms" q="good"/>
              </HudPanel>
            </div>}

            {/* LATENCY */}
            {(latProg.length>0||showLatency)&&<div className="np-c6">
              <HudPanel title="LATENCY OSCILLOSCOPE" icon="◎" status={showLatency?"done":"active"} accent="#00ffd5" glow={showLatency} delay={.15}>
                <Oscilloscope data={showLatency?MOCK.latency.raw:latProg} color="#00ffd5" height={60}
                  label={showLatency?`${MOCK.latency.raw.length} SAMPLES`:`SAMPLING ${latProg.length}/24`}
                  active={!showLatency}/>
                {showLatency&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
                  {[{v:MOCK.latency.avg,l:"AVG ms",c:"#00ffd5"},{v:MOCK.latency.jitter,l:"JITTER ms",c:"#c6ff00"},{v:MOCK.latency.p90,l:"P90 ms",c:"#00b4d8"}].map(s=>(
                    <div key={s.l} style={{textAlign:"center"}}>
                      <div style={{fontSize:22,fontWeight:900,fontFamily:"var(--ff-display)",color:s.c,textShadow:`0 0 10px ${s.c}25`}}>{s.v}</div>
                      <div style={{fontSize:8,color:"rgba(255,255,255,.2)",letterSpacing:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>}
              </HudPanel>
            </div>}

            {/* SPEED */}
            {(showDl||showUl||phaseIdx===4||phaseIdx===5)&&<div className="np-c6">
              <HudPanel title="BANDWIDTH" icon="⚡" status={showUl?"done":"active"} accent="#7c4dff" glow={showDl&&showUl} delay={.2}>
                <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <SpeedGauge value={showDl?MOCK.dl.mbps:null} max={400} label="DOWNLOAD" unit="Mbps" color="#00ffd5" size={132}/>
                  <SpeedGauge value={showUl?MOCK.ul.mbps:null} max={200} label="UPLOAD" unit="Mbps" color="#7c4dff" size={132}/>
                </div>
                {showDl&&showUl&&<div style={{display:"flex",justifyContent:"center",gap:20,marginTop:8}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>P90↓ {MOCK.dl.p90} Mbps</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>P90↑ {MOCK.ul.p90} Mbps</div>
                </div>}
              </HudPanel>
            </div>}

            {/* DNS + SECURITY + CONNECTION */}
            {showDns&&<>{[
              {t:"DNS",i:"🔗",a:"#c6ff00",c:<>{Object.entries(MOCK.dns.domains).map(([d,v])=><M key={d} l={d} v={v} u="ms" q={v<10?"good":"ok"} s/>)}<M l="Average" v={MOCK.dns.avg} u="ms" q="good"/></>},
              {t:"SECURITY",i:"🔐",a:"#ffd600",c:<><M l="TLS" v="1.3" q="good" s/><M l="Post-Quantum" v="ML-KEM ✦" q="good" s/><M l="QUIC/H3" v="Active" q="good" s/><M l="ECH/SNI" v="Plain" q="warn" s/><M l="DNSSEC" v="Valid" q="good" s/></>},
              {t:"CONNECTION",i:"📡",a:"#00e676",c:<><M l="Type" v="FTTH Fiber" q="good" s/><M l="Proxy" v="None ✓" q="good" s/><M l="Network" v="Residential" q="good" s/><M l="Timezone" v="UTC+7" s/></>},
            ].map((p,idx)=>(
              <div key={p.t} className="np-c4">
                <HudPanel title={p.t} icon={p.i} status="done" accent={p.a} delay={.25+idx*.04}>{p.c}</HudPanel>
              </div>
            ))}</>}

            {/* TARGETS */}
            {(Object.keys(targetsDone).length>0||scanTarget)&&<div className="np-c12">
              <HudPanel title="INTERNATIONAL TARGETS" icon="🌐" status={scanTarget?"active":"done"} accent="#00b4d8" glow={!scanTarget&&Object.keys(targetsDone).length>0} delay={.3}>
                <TargetGrid targets={targetsDone} activeId={scanTarget}/>
                {!scanTarget&&Object.keys(targetsDone).length>0&&<div style={{display:"flex",gap:20,marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.03)",justifyContent:"center",flexWrap:"wrap"}}>
                  {[{l:"REACHABLE",v:`${Object.keys(targetsDone).length}/${TARGETS_META.length}`,c:"#00ffd5"},{l:"AVG LATENCY",v:`${Math.round(Object.values(targetsDone).reduce((a,r)=>a+r.avg,0)/Object.keys(targetsDone).length)}ms`,c:"#00b4d8"},{l:"PACKET LOSS",v:"0%",c:"#00e676"}].map(s=>(
                    <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:8,color:"rgba(255,255,255,.2)",letterSpacing:2,marginBottom:2}}>{s.l}</div><div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:"var(--ff-display)",textShadow:`0 0 10px ${s.c}25`}}>{s.v}</div></div>
                  ))}
                </div>}
              </HudPanel>
            </div>}

            {/* ANALYSIS */}
            {showAnalysis&&<div className="np-c12">
              <HudPanel title="CROSS-ANALYSIS" icon="🔬" accent={g.c} glow delay={.35}>
                <div className="np-findings">
                  <FindingCard icon="✅" title="Routing tối ưu — HAN PoP" desc="Traffic kết nối trực tiếp tới Cloudflare Hà Nội. Tuyến ngắn nhất cho user miền Bắc VN." severity="good" delay={.1}/>
                  <FindingCard icon="⚡" title="Post-Quantum Key Exchange" desc="ML-KEM-768 đang hoạt động — bảo vệ trước máy tính lượng tử. Tiêu chuẩn cao nhất hiện tại." severity="good" delay={.15}/>
                  <FindingCard icon="🔓" title="SNI chưa mã hóa" desc="ISP có thể thấy domain bạn truy cập. Bật WARP hoặc ECH (Firefox) để mã hóa SNI." severity="warn" delay={.2}/>
                  <FindingCard icon="🎯" title="Kết nối xuất sắc" desc={`${MOCK.dl.mbps} ↓ / ${MOCK.ul.mbps} ↑ Mbps, latency ${MOCK.latency.avg}ms. Gaming competitive, 4K streaming, video call HD.`} severity="good" delay={.25}/>
                  <FindingCard icon="🌏" title="International: Perfect" desc={`${TARGETS_META.length} targets reachable, avg <60ms. Cable path healthy, no throttling.`} severity="good" delay={.3}/>
                  <FindingCard icon="📊" title="Jitter thấp, ổn định cao" desc={`Jitter ${MOCK.latency.jitter}ms — kết nối ổn định cho VoIP, live streaming, gaming.`} severity="info" delay={.35}/>
                </div>
              </HudPanel>
            </div>}

            {/* CONSOLE */}
            {logs.length>0&&<div className="np-c12">
              <HudPanel title="SYSTEM CONSOLE" icon="⌘" status={phase==="done"?"done":"active"} accent="#00b4d8" delay={.4}>
                <div style={{maxHeight:160,overflow:"auto",fontSize:10,lineHeight:2,fontFamily:"var(--ff-mono)"}}>
                  {logs.map((l,i)=>(
                    <div key={i} style={{color:l.level==="ok"?"rgba(0,230,118,.55)":l.level==="sys"?"rgba(0,180,216,.45)":"rgba(255,255,255,.25)",borderBottom:"1px solid rgba(255,255,255,.015)",padding:"1px 0"}}>
                      <span style={{color:"rgba(255,255,255,.1)",marginRight:8,fontFamily:"var(--ff-display)",fontSize:8}}>{new Date(l.t).toLocaleTimeString("en",{hour12:false})}</span>{l.msg}
                    </div>
                  ))}
                </div>
              </HudPanel>
            </div>}
          </div>
        )}

        {/* IDLE */}
        {phase==="idle"&&<div style={{textAlign:"center",padding:"70px 20px",animation:"hudIn .5s ease both"}}>
          <div style={{fontSize:50,marginBottom:12,filter:"drop-shadow(0 0 15px rgba(0,255,213,.08))"}}>◎</div>
          <div style={{fontSize:12,fontFamily:"var(--ff-display)",color:"rgba(0,255,213,.3)",letterSpacing:8,marginBottom:8}}>SYSTEMS NOMINAL</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.2)",letterSpacing:1,maxWidth:440,margin:"0 auto",lineHeight:2}}>
            Phân tích toàn diện chất lượng mạng ISP Việt Nam — 10 engines, 12 analysis patterns, Cloudflare Edge Network.
          </div>
        </div>}

        <footer style={{textAlign:"center",marginTop:32,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.015)"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,.1)",letterSpacing:4,fontFamily:"var(--ff-display)"}}>NETPROBE • CHƠI CÔNG NGHỆ • speed.ccn.vn</div>
        </footer>
      </div>
    </div>
  );
}
