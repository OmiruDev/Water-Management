import React, { useState } from 'react';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Code, 
  Copy, 
  Check, 
  Terminal, 
  Play, 
  RotateCcw, 
  Droplet, 
  Zap, 
  ExternalLink 
} from 'lucide-react';
import type { TelemetryReading, SystemConfig } from '../types';

interface HardwareSimulatorProps {
  telemetry: TelemetryReading;
  config: SystemConfig;
  isOnline: boolean;
  simulatedLeakLph: number;
  onToggleOnline: () => void;
  onToggleLeak: (rate?: number) => void;
  onResetSimulation: () => void;
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({
  telemetry,
  config,
  isOnline,
  simulatedLeakLph,
  onToggleOnline,
  onToggleLeak,
  onResetSimulation,
}) => {
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [arduinoCode, setArduinoCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  const webhookEndpoint = `${window.location.origin}/api/telemetry`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleOpenCode = async () => {
    setShowCodeModal(true);
    setIsLoadingCode(true);
    try {
      const res = await fetch('/api/hardware/arduino-code');
      const text = await res.text();
      setArduinoCode(text);
    } catch (err) {
      console.error('Failed to fetch code', err);
    } finally {
      setIsLoadingCode(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(arduinoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div id="hardware-simulator-card" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(15,23,42,0.4)] space-y-5 backdrop-blur-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-100">ESP32 IoT Node & Hardware Integration</h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isOnline 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Direct sensor telemetry ingestion endpoint and real-time physical simulation runner
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCode}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span>ESP32 Arduino C++</span>
          </button>

          <button
            type="button"
            onClick={onResetSimulation}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-xs font-medium text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Reset telemetry to 72% default level"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Webhook & Connection Endpoint Banner */}
      <div className="bg-slate-950/80 border border-slate-800 text-white p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-[11px] font-mono text-blue-400 font-semibold flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>POST /api/telemetry (Live HTTP / Wi-Fi Ingestion)</span>
          </div>
          <p className="text-slate-400 text-xs max-w-xl">
            Real ESP32 microcontrollers send JSON payload: <code className="text-amber-400 font-mono">{"{ waterPercentage, distance_cm, pumpState }"}</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={copyWebhook}
          className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 font-medium flex items-center gap-1.5 shrink-0 transition-all shadow-[0_0_12px_rgba(59,130,246,0.2)] cursor-pointer"
        >
          {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedWebhook ? 'Copied!' : 'Copy Ingest URL'}</span>
        </button>
      </div>

      {/* Hardware Node Simulation Quick Controls */}
      <div>
        <span className="text-xs font-bold text-slate-200 uppercase tracking-widest block mb-3">
          Interactive Hardware Sandbox Controls
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Toggle Node Connection */}
          <button
            type="button"
            onClick={onToggleOnline}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              isOnline 
                ? 'bg-slate-950/60 hover:bg-rose-950/20 border-slate-800 hover:border-rose-500/40' 
                : 'bg-rose-950/20 border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-100">
                {isOnline ? 'Disconnect Wi-Fi' : 'Reconnect Wi-Fi'}
              </span>
              {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-rose-400" />}
            </div>
            <p className="text-[11px] text-slate-400">
              {isOnline ? 'Simulate sensor power loss or timeout' : 'Restore live packet heartbeat'}
            </p>
          </button>

          {/* Toggle Simulated Pipe Leak */}
          <button
            type="button"
            onClick={() => onToggleLeak(simulatedLeakLph > 0 ? 0 : 38)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              simulatedLeakLph > 0
                ? 'bg-rose-950/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'bg-slate-950/60 hover:bg-amber-950/20 border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-100">
                {simulatedLeakLph > 0 ? 'Stop Leak Test' : 'Inject 38 L/h Leak'}
              </span>
              <Droplet className={`w-4 h-4 ${simulatedLeakLph > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
            <p className="text-[11px] text-slate-400">
              {simulatedLeakLph > 0 ? 'Active anomaly running on pipe manifold' : 'Tests Gemini leak diagnostic engine'}
            </p>
          </button>

          {/* Reset Demo */}
          <button
            type="button"
            onClick={onResetSimulation}
            className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-left transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-100">Normalize Telemetry</span>
              <RotateCcw className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-[11px] text-slate-400">
              Sets tank to nominal 72% fill level with pump in standby
            </p>
          </button>
        </div>
      </div>

      {/* Arduino Code Inspection Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-950/90 border-b border-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">ESP32 Firmware Source (tank_monitor.ino)</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCode}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 flex-1 overflow-y-auto font-mono text-xs text-slate-300">
              {isLoadingCode ? (
                <div className="text-slate-400 p-8 text-center">Loading firmware sketch...</div>
              ) : (
                <pre className="whitespace-pre-wrap">{arduinoCode}</pre>
              )}
            </div>

            <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Ready for Arduino IDE / PlatformIO with ESP32 board definitions</span>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
