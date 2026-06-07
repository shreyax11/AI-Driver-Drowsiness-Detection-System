import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Brain,
  Camera,
  Eye,
  Gauge,
  Headphones,
  RadioTower,
  ShieldCheck,
  Truck,
  Volume2,
} from "lucide-react";
import "./main.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const initialMetrics = {
  risk_score: 18,
  state: "attentive",
  ear: 0.29,
  mar: 0.18,
  blink_rate: 14,
  yawn_count: 0,
  head_tilt: 0,
  attention: 96,
  fps: 24,
  alerts_today: 0,
  trip_minutes: 0,
  source: "simulated",
  alert_level: "normal",
  alerts: [],
};

function statusColor(level) {
  if (level === "critical") return "#ff4d6d";
  if (level === "warning") return "#ffbe4d";
  return "#38e8ff";
}

function useMetrics() {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    let timer;
    async function poll() {
      try {
        const response = await fetch(`${API_URL}/metrics`);
        const next = await response.json();
        setMetrics({ ...initialMetrics, ...next });
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
        setMetrics((prev) => simulate(prev));
      }
    }
    poll();
    timer = window.setInterval(poll, 900);
    return () => window.clearInterval(timer);
  }, []);

  return { metrics, backendOnline };
}

function simulate(prev) {
  const t = Date.now() / 1000;
  const fatigue = Math.sin(t / 5) > 0.52 ? 1 : 0;
  const yawn = Math.sin(t / 8) > 0.78 ? 1 : 0;
  const risk = Math.round(18 + fatigue * 54 + yawn * 16 + ((Math.sin(t) + 1) / 2) * 12);
  const alert_level = risk > 70 ? "critical" : risk > 45 ? "warning" : "normal";
  const state = risk > 70 ? "drowsy" : risk > 45 ? "fatigue warning" : "attentive";
  const alert =
    risk > 58 && (!prev.alerts?.[0] || Date.now() / 1000 - prev.alerts[0].timestamp > 4)
      ? [{ level: alert_level, title: "Fatigue pattern detected", message: `${state} | risk ${risk}%`, timestamp: Date.now() / 1000 }, ...(prev.alerts || [])].slice(0, 8)
      : prev.alerts || [];

  return {
    ...prev,
    risk_score: risk,
    state,
    ear: +(0.31 - fatigue * 0.12).toFixed(3),
    mar: +(0.2 + yawn * 0.31).toFixed(3),
    blink_rate: Math.round(13 + fatigue * 11),
    yawn_count: prev.yawn_count + (yawn && Date.now() % 5 === 0 ? 1 : 0),
    head_tilt: +(Math.sin(t / 2) * 10).toFixed(1),
    attention: Math.max(0, 100 - risk + 8),
    fps: 24,
    alerts_today: alert.length,
    trip_minutes: prev.trip_minutes,
    source: "frontend simulation",
    alert_level,
    alerts: alert,
  };
}

function useAudioAlert(level) {
  const lastLevel = useRef("normal");
  useEffect(() => {
    if (level === "normal" || level === lastLevel.current) {
      lastLevel.current = level;
      return;
    }
    lastLevel.current = level;
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = level === "critical" ? 880 : 560;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.22);
    if ("speechSynthesis" in window && level === "critical") {
      speechSynthesis.speak(new SpeechSynthesisUtterance("Drowsiness detected. Please stay alert."));
    }
  }, [level]);
}

function App() {
  const { metrics, backendOnline } = useMetrics();
  useAudioAlert(metrics.alert_level);
  const color = statusColor(metrics.alert_level);
  const videoUrl = useMemo(() => `${API_URL}/video-feed`, []);

  return (
    <main className="min-h-screen bg-ink text-slate-100">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan">AI ROAD SAFETY SYSTEM</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal md:text-4xl">Driver Drowsiness Command Center</h1>
          </div>
          <div className="flex items-center gap-3 rounded border border-line bg-panel px-4 py-3">
            <RadioTower className={backendOnline ? "text-cyan" : "text-amber-300"} size={20} />
            <div>
              <p className="text-xs text-slate-400">Telemetry</p>
              <p className="text-sm font-medium">{backendOnline ? "Backend online" : "Demo simulation"}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="glass-panel overflow-hidden rounded-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Camera className="text-cyan" size={19} />
                <span className="text-sm font-semibold">Live Driver Feed</span>
              </div>
              <span className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">{metrics.source}</span>
            </div>
            <div className="relative aspect-video bg-black">
              {backendOnline ? (
                <img className="h-full w-full object-cover" src={videoUrl} alt="Live webcam stream" />
              ) : (
                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#1f2b44,#080b12_65%)]">
                  <div className="relative h-64 w-64 rounded-full border border-cyan/30">
                    <div className="absolute left-1/2 top-16 h-24 w-40 -translate-x-1/2 rounded-full border border-slate-500/60" />
                    <div className="absolute left-20 top-24 h-5 w-5 rounded-full bg-cyan shadow-[0_0_24px_#38e8ff]" />
                    <div className="absolute right-20 top-24 h-5 w-5 rounded-full bg-cyan shadow-[0_0_24px_#38e8ff]" />
                    <div className="absolute left-1/2 top-40 h-7 w-20 -translate-x-1/2 rounded-b-full border-b-2 border-violet" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 rounded border border-line bg-black/70 px-3 py-2 backdrop-blur">
                <p className="text-xs text-slate-400">Driver state</p>
                <p className="text-lg font-semibold capitalize" style={{ color }}>{metrics.state}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Risk Level</p>
                <h2 className="mt-1 text-3xl font-semibold" style={{ color }}>{metrics.risk_score}%</h2>
              </div>
              <div className="meter grid h-28 w-28 place-items-center rounded-full" style={{ "--value": metrics.risk_score, "--meter-color": color }}>
                <div className="grid h-20 w-20 place-items-center rounded-full bg-panel text-lg font-semibold">{metrics.risk_score}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric icon={Eye} label="EAR" value={metrics.ear} />
              <Metric icon={Activity} label="MAR" value={metrics.mar} />
              <Metric icon={Brain} label="Attention" value={`${metrics.attention}%`} />
              <Metric icon={Gauge} label="FPS" value={metrics.fps} />
            </div>
            <div className="mt-5 rounded border border-line bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Headphones size={18} className="text-violet" />
                Multi-level Alert System
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Browser beep alerts and text-to-speech warnings activate when fatigue or drowsiness crosses the configured thresholds.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <Stat icon={Eye} label="Blink Rate" value={`${metrics.blink_rate}/min`} />
          <Stat icon={Volume2} label="Yawns" value={metrics.yawn_count} />
          <Stat icon={Truck} label="Trip Time" value={`${metrics.trip_minutes}m`} />
          <Stat icon={ShieldCheck} label="Alerts Today" value={metrics.alerts_today} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-panel rounded-lg p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="text-amber-300" size={19} /> Alert History</h3>
            <div className="mt-4 space-y-3">
              {(metrics.alerts || []).length ? metrics.alerts.map((alert, index) => (
                <div key={`${alert.timestamp}-${index}`} className="rounded border border-line bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{alert.title}</p>
                    <span className="text-xs uppercase" style={{ color: statusColor(alert.level) }}>{alert.level}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{alert.message}</p>
                </div>
              )) : <p className="rounded border border-line bg-slate-950/50 p-4 text-sm text-slate-400">No fatigue events recorded in the current trip.</p>}
            </div>
          </div>
          <div className="glass-panel rounded-lg p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><BellRing className="text-cyan" size={19} /> Safety Insights</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Insight label="Eye closure" value={metrics.ear < 0.21 ? "Elevated" : "Stable"} />
              <Insight label="Head posture" value={Math.abs(metrics.head_tilt) > 12 ? "Distracted" : "Aligned"} />
              <Insight label="Fatigue trend" value={metrics.risk_score > 45 ? "Rising" : "Controlled"} />
            </div>
            <div className="mt-5 h-32 rounded border border-line bg-[linear-gradient(135deg,rgba(56,232,255,.12),rgba(142,108,255,.12))] p-4">
              <div className="flex h-full items-end gap-2">
                {[32, 44, 28, 54, 46, 69, 58, metrics.risk_score].map((bar, index) => (
                  <div key={index} className="flex-1 rounded-t bg-cyan/70" style={{ height: `${bar}%`, background: index > 5 ? color : undefined }} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded border border-line bg-slate-950/50 p-3">
      <Icon className="text-cyan" size={18} />
      <p className="mt-2 text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <Icon className="text-violet" size={21} />
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Insight({ label, value }) {
  return (
    <div className="rounded border border-line bg-slate-950/50 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
