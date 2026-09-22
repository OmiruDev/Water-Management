import React, { useState, useEffect, useCallback } from 'react';
import { 
  Waves, 
  Activity, 
  Sparkles, 
  Bell, 
  Sliders, 
  Cpu, 
  Database, 
  RefreshCw, 
  Droplet,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Code
} from 'lucide-react';
import { WaterTankGauge } from './components/WaterTankGauge';
import { TelemetryCards } from './components/TelemetryCards';
import { PumpSafetyModal } from './components/PumpSafetyModal';
import { AnalyticsTrends } from './components/AnalyticsTrends';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { AquaChatBot } from './components/AquaChatBot';
import { AlertsNotificationCenter } from './components/AlertsNotificationCenter';
import { CalibrationSettings } from './components/CalibrationSettings';
import { HardwareSimulator } from './components/HardwareSimulator';
import { SchemaAndFunctionsModal } from './components/SchemaAndFunctionsModal';
import { 
  syncTelemetryToFirestore, 
  syncConfigToFirestore, 
  syncAlertToFirestore,
  acknowledgeFirestoreAlert, 
  clearFirestoreAlerts,
  onAuthStatus,
  getFirebaseConfigInfo
} from './lib/firebase';

import type { 
  TelemetryReading, 
  HistoricalDataPoint, 
  SystemConfig, 
  SystemAlert,
  AILeakAnalysis,
  AIPrediction,
  PumpState
} from './types';

// Fallback initial state
const defaultTelemetry: TelemetryReading = {
  deviceId: 'ESP32_TANK_01',
  timestamp: new Date().toISOString(),
  waterPercentage: 68.5,
  distance_cm: 78,
  waterVolumeLiters: 1548,
  maxVolumeLiters: 2262,
  pumpState: 'OFF',
  flowRateLpm: 0,
  rssi: -58,
  batteryVoltage: 3.95,
  temperatureC: 24.2,
  isSimulated: true,
};

const defaultConfig: SystemConfig = {
  deviceId: 'ESP32_TANK_01',
  deviceName: 'Main Rooftop Cistern',
  tankHeightCm: 200,
  tankRadiusCm: 60,
  sensorOffsetCm: 15,
  pumpOnPercent: 20,
  pumpOffPercent: 95,
  pumpFlowRateLpm: 35,
  pumpPowerWatts: 750,
  electricityCostPerKWh: 0.16,
  autoMode: true,
  soundAlertsEnabled: true,
  pushNotificationsEnabled: true,
  leakDetectionThresholdLph: 15,
};

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryReading>(defaultTelemetry);
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [simulatedLeakLph, setSimulatedLeakLph] = useState<number>(0);
  const [history24h, setHistory24h] = useState<HistoricalDataPoint[]>([]);
  const [history7d, setHistory7d] = useState<HistoricalDataPoint[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [leakAnalysis, setLeakAnalysis] = useState<AILeakAnalysis | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [lastFirestoreSync, setLastFirestoreSync] = useState<Date>(new Date());

  // Modals & Navigation
  const [isPumpModalOpen, setIsPumpModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'ai' | 'alerts' | 'settings' | 'hardware'>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio synthesizer for alerts
  const playAlertChime = (severity: 'critical' | 'warning' | 'info') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = severity === 'critical' ? 880 : severity === 'warning' ? 659.25 : 440;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio context blocked by autoplay policy until user gesture
    }
  };

  // 1. Fetch live telemetry stream
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      const data = await res.json();
      if (data.success) {
        setTelemetry(data.telemetry);
        setIsOnline(data.isDeviceOnline);
        setSimulatedLeakLph(data.simulatedLeakLph);
        
        // Sync live telemetry reading into Firestore
        syncTelemetryToFirestore(data.telemetry, data.isDeviceOnline);
        setLastFirestoreSync(new Date());
      }
    } catch (err) {
      console.error('Failed to poll telemetry:', err);
    }
  }, []);

  // 2. Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const [res24, res7] = await Promise.all([
        fetch('/api/telemetry/history?range=24h'),
        fetch('/api/telemetry/history?range=7d')
      ]);
      const data24 = await res24.json();
      const data7 = await res7.json();
      if (data24.data) setHistory24h(data24.data);
      if (data7.data) setHistory7d(data7.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  // 3. Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success && data.alerts) {
        // If new critical alert arrived, play chime
        const unreadCritical = data.alerts.find((a: SystemAlert) => a.severity === 'critical' && !a.read);
        if (unreadCritical && alerts.length > 0 && !alerts.some(a => a.id === unreadCritical.id)) {
          playAlertChime('critical');
        }
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, [alerts]);

  // 4. Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }, []);

  // 5. Run AI Diagnostics (Gemini 3.8 Flash)
  const runAiDiagnostics = async () => {
    setIsAiLoading(true);
    try {
      const [leakRes, forecastRes] = await Promise.all([
        fetch('/api/ai/analyze-leak', { method: 'POST' }),
        fetch('/api/ai/forecast', { method: 'POST' }),
      ]);
      const leakData = await leakRes.json();
      const forecastData = await forecastRes.json();

      if (leakData.success) {
        setLeakAnalysis(leakData.analysis);
      }
      if (forecastData.success) {
        setPrediction(forecastData.prediction);
      }
    } catch (err) {
      console.error('Failed AI analysis:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initial load & interval polling
  useEffect(() => {
    fetchTelemetry();
    fetchConfig();
    fetchHistory();
    fetchAlerts();
    runAiDiagnostics();

    const unsubAuth = onAuthStatus((user) => {
      setFirebaseUser(user);
      setIsFirestoreConnected(true);
    });

    const interval = setInterval(() => {
      fetchTelemetry();
      fetchAlerts();
    }, 2500);

    return () => {
      clearInterval(interval);
      unsubAuth();
    };
  }, []);

  // Actions
  const handleConfirmPumpChange = async (targetState: PumpState, durationMinutes?: number) => {
    const res = await fetch('/api/pump/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: targetState, durationMinutes, force: true }),
    });
    const data = await res.json();
    if (data.success) {
      const updatedTelemetry = {
        ...telemetry,
        pumpState: data.pumpState,
        flowRateLpm: data.pumpState === 'ON' ? config.pumpFlowRateLpm : 0,
      };
      setTelemetry(updatedTelemetry);
      syncTelemetryToFirestore(updatedTelemetry, isOnline);
      playAlertChime('info');
      fetchAlerts();
    }
  };

  const handleSaveConfig = async (updated: Partial<SystemConfig>) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    if (data.success) {
      setConfig(data.config);
      syncConfigToFirestore(data.config);
      fetchTelemetry();
    }
  };

  const handleToggleLeak = async (rate?: number) => {
    const res = await fetch('/api/simulation/toggle-leak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leakRateLph: rate }),
    });
    const data = await res.json();
    if (data.success) {
      setSimulatedLeakLph(data.simulatedLeakLph);
      fetchAlerts();
      runAiDiagnostics();
    }
  };

  const handleToggleOnline = async () => {
    const res = await fetch('/api/simulation/toggle-device-status', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setIsOnline(data.isDeviceOnline);
      syncTelemetryToFirestore(telemetry, data.isDeviceOnline);
      fetchAlerts();
    }
  };

  const handleResetSimulation = async () => {
    const res = await fetch('/api/simulation/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setTelemetry(data.telemetry);
      setSimulatedLeakLph(0);
      setIsOnline(true);
      syncTelemetryToFirestore(data.telemetry, true);
      fetchHistory();
      fetchAlerts();
      runAiDiagnostics();
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/ack`, { method: 'POST' });
    acknowledgeFirestoreAlert(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const handleClearAlerts = async () => {
    await fetch('/api/alerts/clear', { method: 'POST' });
    clearFirestoreAlerts();
    setAlerts([]);
  };

  const unreadAlertCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col antialiased selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Application Navigation Bar - Immersive UI */}
      <header className="bg-[#020617]/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600/20 border border-blue-500/50 text-blue-400 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] shrink-0">
              <Waves className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <h1 className="text-base sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent truncate">
                  H2O SENSE PRO
                </h1>
                <span className="hidden sm:inline-block text-[10px] bg-blue-500/10 text-blue-400 font-mono font-bold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-widest shrink-0">
                  ESP32 • Gemini AI
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 tracking-wider sm:tracking-widest uppercase font-medium truncate">
                Autonomous Resource Management
              </p>
            </div>
          </div>

          {/* Quick Hardware & System Status Badges */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* ESP32 Hardware Status Badge */}
            <div className="hidden sm:flex bg-slate-900/80 border border-slate-700/80 px-3.5 py-1.5 rounded-lg items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`} />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ESP32 Node</span>
                <span className="text-[11px] font-mono text-slate-200">
                  {isOnline ? 'ONLINE : 192.168.1.42' : 'OFFLINE : TIMEOUT'}
                </span>
              </div>
            </div>

            {/* Firebase Cloud Firestore Status Badge */}
            <div 
              title="Real-time Firestore Database Connected (Project: massive-skein-st8c4)"
              className="hidden lg:flex bg-slate-900/80 border border-slate-700/80 px-3 py-1.5 rounded-lg items-center gap-2.5"
            >
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cloud Firestore</span>
                  <span className="text-[8px] bg-amber-500/20 text-amber-300 font-mono px-1 rounded border border-amber-500/30">ACTIVE</span>
                </div>
                <span className="text-[10px] font-mono text-slate-300">
                  massive-skein-st8c4
                </span>
              </div>
            </div>

            {/* Manual Pump Override Trigger Button */}
            <button
              id="top-manual-override-btn"
              type="button"
              onClick={() => setIsPumpModalOpen(true)}
              className="bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] group min-h-[38px]"
            >
              <span className="text-xs font-bold text-blue-400 uppercase tracking-tight group-hover:text-blue-300 whitespace-nowrap">
                Pump Control
              </span>
            </button>

            {/* View Architecture & Schema Modal Button */}
            <button
              id="open-schema-modal-btn"
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden md:inline">Architecture</span>
            </button>

            {/* Simulated Leak Active Warning Banner */}
            {simulatedLeakLph > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-tight animate-pulse shrink-0">
                <Droplet className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Leak: </span>{simulatedLeakLph} L/h
              </div>
            )}

            {/* Notification Bell with Badge */}
            <button
              id="top-nav-alerts-button"
              type="button"
              onClick={() => setActiveTab('alerts')}
              className="relative p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_#ef4444]">
                  {unreadAlertCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-xs font-semibold border-t border-slate-800/80">
          {[
            { id: 'dashboard', label: 'Telemetry Overview', icon: Waves },
            { id: 'analytics', label: 'Trends & Analytics', icon: Activity },
            { id: 'ai', label: 'Gemini AI Insight', icon: Sparkles },
            { id: 'alerts', label: `Alerts (${unreadAlertCount})`, icon: Bell },
            { id: 'settings', label: 'Calibration & Setpoints', icon: Sliders },
            { id: 'hardware', label: 'ESP32 Node & Sandbox', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 border border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-bold'
                    : 'bg-slate-900/40 border border-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Primary Visual Gauge & Override Controls */}
            <WaterTankGauge
              telemetry={telemetry}
              config={config}
              isOnline={isOnline}
              onOpenPumpModal={() => setIsPumpModalOpen(true)}
            />

            {/* Glancable Diagnostics Cards */}
            <TelemetryCards
              telemetry={telemetry}
              config={config}
              isOnline={isOnline}
            />

            {/* Split Row: Trends Preview & Natural Language AquaBot */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnalyticsTrends
                history24h={history24h}
                history7d={history7d}
                config={config}
              />
              <AquaChatBot telemetry={telemetry} />
            </div>

            {/* AI Insights Layer */}
            <AIInsightsPanel
              telemetry={telemetry}
              config={config}
              leakAnalysis={leakAnalysis}
              prediction={prediction}
              simulatedLeakLph={simulatedLeakLph}
              isLoading={isAiLoading}
              onRefreshAI={runAiDiagnostics}
              onToggleSimulatedLeak={handleToggleLeak}
            />
          </div>
        )}

        {/* TAB 2: HISTORICAL TRENDS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <AnalyticsTrends
              history24h={history24h}
              history7d={history7d}
              config={config}
            />
            {/* Additional details card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Average Daily Inflow</span>
                <div className="text-2xl font-mono font-bold text-slate-100 mt-1">
                  1,480 <span className="text-xs font-normal text-slate-400">Liters</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Supplied via automated pump refills during off-peak windows.
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Water Turnover Frequency</span>
                <div className="text-2xl font-mono font-bold text-blue-400 mt-1">
                  1.6 <span className="text-xs font-normal text-slate-400">Days</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Prevents stagnation and bacterial biofilm growth in the cistern.
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Estimated Monthly Power</span>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                  $14.20 <span className="text-xs font-normal text-slate-400">USD</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Optimized with off-peak electrical tariff schedule recommendations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AI INTELLIGENCE & LEAK SCAN */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <AIInsightsPanel
              telemetry={telemetry}
              config={config}
              leakAnalysis={leakAnalysis}
              prediction={prediction}
              simulatedLeakLph={simulatedLeakLph}
              isLoading={isAiLoading}
              onRefreshAI={runAiDiagnostics}
              onToggleSimulatedLeak={handleToggleLeak}
            />
            {/* Embedded Natural Language Chat */}
            <AquaChatBot telemetry={telemetry} />
          </div>
        )}

        {/* TAB 4: ALERTS & NOTIFICATIONS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <AlertsNotificationCenter
              alerts={alerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onClearAlerts={handleClearAlerts}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
            />
          </div>
        )}

        {/* TAB 5: CALIBRATION & SETPOINTS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <CalibrationSettings
              config={config}
              onSaveConfig={handleSaveConfig}
            />
          </div>
        )}

        {/* TAB 6: ESP32 HARDWARE INTEGRATION & SANDBOX */}
        {activeTab === 'hardware' && (
          <div className="space-y-6">
            <HardwareSimulator
              telemetry={telemetry}
              config={config}
              isOnline={isOnline}
              simulatedLeakLph={simulatedLeakLph}
              onToggleOnline={handleToggleOnline}
              onToggleLeak={handleToggleLeak}
              onResetSimulation={handleResetSimulation}
            />
          </div>
        )}
      </main>

      {/* Safety Confirmation Modal for Manual Pump Override */}
      <PumpSafetyModal
        isOpen={isPumpModalOpen}
        onClose={() => setIsPumpModalOpen(false)}
        telemetry={telemetry}
        config={config}
        onConfirmPumpChange={handleConfirmPumpChange}
      />

      {/* Architecture & Cloud Functions Inspector Modal */}
      <SchemaAndFunctionsModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />

      {/* Immersive UI Footer */}
      <footer className="border-t border-slate-800/80 bg-[#020617] py-4 mt-6 sm:mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center sm:gap-6 text-slate-400 w-full sm:w-auto">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Temp</span>
              <span className="text-xs font-mono text-slate-200">{telemetry.temperatureC}°C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Battery</span>
              <span className="text-xs font-mono text-slate-200">{telemetry.batteryVoltage}V</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Signal</span>
              <span className="text-xs font-mono text-emerald-400">{telemetry.rssi} dBm</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Node</span>
              <span className="text-xs font-mono text-slate-300 truncate">{config.deviceId}</span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="text-xs text-slate-400 hover:text-blue-400 font-medium transition-colors cursor-pointer truncate"
            >
              Firestore Schema & Cloud Functions
            </button>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <div className="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-red-500/20 shrink-0">
              System Armed
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
