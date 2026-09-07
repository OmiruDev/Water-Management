import React from 'react';
import { Droplet, Gauge, Activity, Radio, BatteryMedium, Thermometer, ShieldCheck } from 'lucide-react';
import type { TelemetryReading, SystemConfig } from '../types';

interface TelemetryCardsProps {
  telemetry: TelemetryReading;
  config: SystemConfig;
  isOnline: boolean;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({
  telemetry,
  config,
  isOnline,
}) => {
  const percent = telemetry.waterPercentage;
  const isPumpActive = telemetry.pumpState === 'ON';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Usable Water Volume */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Water In Tank</span>
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Droplet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-mono font-bold text-slate-100 tracking-tight">
            {telemetry.waterVolumeLiters.toLocaleString()} <span className="text-xs font-mono font-normal text-slate-400">L</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Max: {telemetry.maxVolumeLiters.toLocaleString()} L</span>
            <span className="text-slate-500 font-mono">{(telemetry.maxVolumeLiters - telemetry.waterVolumeLiters).toLocaleString()} L deficit</span>
          </div>
        </div>
        {/* Fill bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_#38bdf8]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 2. Ultrasonic Sensor Distance */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Air Gap Distance</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-mono font-bold text-slate-100 tracking-tight">
            {telemetry.distance_cm} <span className="text-xs font-mono font-normal text-slate-400">cm</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Tank H: {config.tankHeightCm} cm</span>
            <span className="text-slate-500 font-mono">Offset: {config.sensorOffsetCm} cm</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
          <span>Echo: {((telemetry.distance_cm * 2) / 0.0343 / 1000).toFixed(1)} ms TOF</span>
        </div>
      </div>

      {/* 3. Pump & Hydraulic Inflow */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hydraulic Inflow</span>
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
            isPumpActive 
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}>
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-mono font-bold text-slate-100 tracking-tight flex items-baseline gap-1.5">
            <span>{isPumpActive ? config.pumpFlowRateLpm : 0}</span>
            <span className="text-xs font-mono font-normal text-slate-400">L/min</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>{isPumpActive ? `${config.pumpPowerWatts}W Motor Active` : '0W Standby'}</span>
            <span className={`font-mono text-xs font-bold ${isPumpActive ? 'text-blue-400' : 'text-slate-500'}`}>
              {isPumpActive ? 'FILLING' : 'IDLE'}
            </span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>2,850 RPM</span>
          <span>${config.electricityCostPerKWh}/kWh</span>
        </div>
      </div>

      {/* 4. ESP32 Telemetry Link Diagnostics */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hardware Signal</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-mono font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>{isOnline ? 'Active' : 'Offline'}</span>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>RSSI: {telemetry.rssi} dBm</span>
            <span>Bat: {telemetry.batteryVoltage ?? 3.95}V</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-slate-500" />
            <span>{telemetry.temperatureC ?? 24.2}°C</span>
          </span>
          <span className="text-[10px] text-slate-500">Wi-Fi 2.4GHz</span>
        </div>
      </div>
    </div>
  );
};
