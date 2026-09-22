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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* 1. Usable Water Volume */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider sm:tracking-widest truncate">Water In Tank</span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-lg sm:text-2xl font-mono font-bold text-slate-100 tracking-tight">
            {telemetry.waterVolumeLiters.toLocaleString()} <span className="text-[10px] sm:text-xs font-mono font-normal text-slate-400">L</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex flex-col xs:flex-row xs:items-center justify-between gap-0.5">
            <span>Max: {telemetry.maxVolumeLiters.toLocaleString()} L</span>
            <span className="text-slate-500 font-mono hidden sm:inline">{(telemetry.maxVolumeLiters - telemetry.waterVolumeLiters).toLocaleString()} L deficit</span>
          </div>
        </div>
        {/* Fill bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2.5 sm:mt-3 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_#38bdf8]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 2. Ultrasonic Sensor Distance */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider sm:tracking-widest truncate">Air Gap Distance</span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-lg sm:text-2xl font-mono font-bold text-slate-100 tracking-tight">
            {telemetry.distance_cm} <span className="text-[10px] sm:text-xs font-mono font-normal text-slate-400">cm</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex flex-col xs:flex-row xs:items-center justify-between gap-0.5">
            <span>Tank H: {config.tankHeightCm}cm</span>
            <span className="text-slate-500 font-mono hidden sm:inline">Offset: {config.sensorOffsetCm}cm</span>
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 font-mono truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8] shrink-0" />
          <span className="truncate">Echo: {((telemetry.distance_cm * 2) / 0.0343 / 1000).toFixed(1)} ms</span>
        </div>
      </div>

      {/* 3. Pump & Hydraulic Inflow */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider sm:tracking-widest truncate">Inflow Rate</span>
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center shrink-0 ${
            isPumpActive 
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-lg sm:text-2xl font-mono font-bold text-slate-100 tracking-tight flex items-baseline gap-1">
            <span>{isPumpActive ? config.pumpFlowRateLpm : 0}</span>
            <span className="text-[10px] sm:text-xs font-mono font-normal text-slate-400">L/min</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span className="truncate">{isPumpActive ? `${config.pumpPowerWatts}W` : '0W Standby'}</span>
            <span className={`font-mono text-[10px] sm:text-xs font-bold ${isPumpActive ? 'text-blue-400' : 'text-slate-500'}`}>
              {isPumpActive ? 'FILLING' : 'IDLE'}
            </span>
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span className="truncate">2,850 RPM</span>
          <span className="truncate">${config.electricityCostPerKWh}/kWh</span>
        </div>
      </div>

      {/* 4. ESP32 Telemetry Link Diagnostics */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(15,23,42,0.4)] flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider sm:tracking-widest truncate">Hardware Signal</span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-lg sm:text-2xl font-mono font-bold text-slate-100 tracking-tight flex items-center gap-1.5 sm:gap-2">
            <span>{isOnline ? 'Active' : 'Offline'}</span>
            <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>RSSI: {telemetry.rssi} dBm</span>
            <span>{telemetry.batteryVoltage ?? 3.95}V</span>
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1 truncate">
            <Thermometer className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{telemetry.temperatureC ?? 24.2}°C</span>
          </span>
          <span className="text-[9px] sm:text-[10px] text-slate-500 truncate">Wi-Fi 2.4G</span>
        </div>
      </div>
    </div>
  );
};
