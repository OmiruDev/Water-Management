import React from 'react';
import { Waves, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, Wifi, Zap } from 'lucide-react';
import type { TelemetryReading, SystemConfig, PumpState } from '../types';

interface WaterTankGaugeProps {
  telemetry: TelemetryReading;
  config: SystemConfig;
  isOnline: boolean;
  onOpenPumpModal: () => void;
}

export const WaterTankGauge: React.FC<WaterTankGaugeProps> = ({
  telemetry,
  config,
  isOnline,
  onOpenPumpModal,
}) => {
  const percentage = Math.min(100, Math.max(0, telemetry.waterPercentage));
  const isLow = percentage <= 15;
  const isHigh = percentage >= 95;
  const isPumpOn = telemetry.pumpState === 'ON';

  // Status color badge logic
  const getLevelColor = () => {
    if (isLow) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (isHigh) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  };

  return (
    <div id="water-tank-gauge-card" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(30,58,138,0.15)] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden backdrop-blur-sm">
      {/* Top accent glow line from Immersive UI */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

      {/* Ambient background glow */}
      {isPumpOn && (
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      )}
      {isLow && (
        <div className="absolute top-0 left-0 w-80 h-80 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Visual Tank Cylinder */}
      <div className="relative flex flex-col items-center shrink-0">
        {/* Sensor representation at top */}
        <div className="flex flex-col items-center mb-2">
          <div className="bg-slate-900/90 text-slate-300 px-3 py-1 rounded-full text-[10px] font-mono font-medium flex items-center gap-2 shadow-xs border border-slate-700/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-ping" />
            <span className="tracking-wide">HC-SR04 ULTRASONIC SENSOR</span>
          </div>
          {/* Simulated acoustic beam ray */}
          <div className="w-0.5 h-3 border-l border-dashed border-blue-400/60 my-0.5" />
        </div>

        {/* Outer Cylinder Frame - Styled to match Immersive UI specification */}
        <div className="relative w-48 sm:w-52 h-80 border-4 border-slate-700 rounded-[3rem] p-2 shadow-[0_0_50px_rgba(30,58,138,0.25)] bg-slate-950/80 overflow-hidden flex flex-col justify-end">
          {/* Calibrated Level Tick Marks */}
          <div className="absolute inset-y-0 right-3 flex flex-col justify-between py-6 text-[9px] font-mono font-bold text-slate-500 pointer-events-none z-20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-slate-600" />
              <span>100%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-slate-700" />
              <span>75%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-slate-700" />
              <span>50%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-slate-700" />
              <span>25%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-rose-500" />
              <span className="text-rose-400 font-bold">15%</span>
            </div>
          </div>

          {/* Setpoint Threshold Guides */}
          <div 
            className="absolute left-0 right-0 border-b border-dashed border-amber-400/60 z-20 pointer-events-none"
            style={{ bottom: `${config.pumpOffPercent}%` }}
            title={`Pump Cutoff (${config.pumpOffPercent}%)`}
          >
            <span className="text-[8px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded-r">
              CUTOFF {config.pumpOffPercent}%
            </span>
          </div>

          <div 
            className="absolute left-0 right-0 border-b border-dashed border-blue-400/60 z-20 pointer-events-none"
            style={{ bottom: `${config.pumpOnPercent}%` }}
            title={`Auto Refill (${config.pumpOnPercent}%)`}
          >
            <span className="text-[8px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.2 rounded-r">
              REFILL {config.pumpOnPercent}%
            </span>
          </div>

          {/* Liquid Container Filling dynamically */}
          <div
            className="w-full relative transition-all duration-1000 ease-out flex flex-col justify-start rounded-b-[2.5rem] shadow-[inset_0_0_30px_rgba(0,0,0,0.4)]"
            style={{
              height: `${percentage}%`,
              background: isLow 
                ? 'linear-gradient(180deg, #f43f5e 0%, #be123c 100%)' 
                : 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 40%, #1d4ed8 100%)',
            }}
          >
            {/* Soft highlight reflection line */}
            <div className="absolute top-1 left-2 right-2 h-1 bg-white/30 rounded-full blur-xs pointer-events-none" />

            {/* Animated Wave Crest */}
            <div className="absolute -top-3 left-0 w-[200%] h-6 opacity-70 overflow-hidden pointer-events-none">
              <svg 
                className={`w-full h-full ${isPumpOn ? 'animate-water-wave-fast' : 'animate-water-wave'}`} 
                viewBox="0 0 1200 120" 
                preserveAspectRatio="none"
              >
                <path 
                  d="M0,0 C150,90 350,-40 500,45 C650,130 900,-20 1200,30 L1200,120 L0,120 Z" 
                  fill={isLow ? '#f43f5e' : '#60a5fa'} 
                />
              </svg>
            </div>

            {/* Bubble effects when pump is running */}
            {isPumpOn && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full absolute bottom-4 left-1/4 animate-bounce" />
                <div className="w-2 h-2 bg-white/70 rounded-full absolute bottom-8 left-2/4 animate-ping" />
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full absolute bottom-12 left-3/4 animate-bounce" />
              </div>
            )}
          </div>

          {/* Centered Large Capacity Metric - from Immersive UI */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
            <span className="text-5xl sm:text-6xl font-black text-white drop-shadow-lg tracking-tight">
              {percentage}<span className="text-2xl font-bold opacity-70">%</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mt-1">
              Capacity
            </span>
            <span className="text-[11px] font-mono text-slate-300 mt-1 bg-slate-950/60 px-2.5 py-0.5 rounded-full border border-slate-700/60">
              {telemetry.waterVolumeLiters.toLocaleString()} / {telemetry.maxVolumeLiters.toLocaleString()} L
            </span>
          </div>
        </div>

        {/* Tank Base Leg Feet */}
        <div className="flex justify-between w-40 mt-1.5 px-4">
          <div className="w-4 h-2.5 bg-slate-800 rounded-b-md border-b border-slate-700" />
          <div className="w-4 h-2.5 bg-slate-800 rounded-b-md border-b border-slate-700" />
        </div>
      </div>

      {/* Right Column: Live Status Badges & Quick Action */}
      <div className="flex-1 w-full flex flex-col justify-between h-full gap-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-400" />
                <span>Live Tank Telemetry</span>
              </h2>
              <p className="text-xs text-slate-400">
                Node ID: <span className="font-mono text-slate-200">{config.deviceId}</span> ({config.deviceName})
              </p>
            </div>

            {/* Hardware Online Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-400'}`} />
              <span>{isOnline ? 'ESP32 ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>

          {/* Status Metric Pills Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Water Level Badge */}
            <div className={`p-4 rounded-2xl border ${getLevelColor()} flex flex-col`}>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Water Level</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-mono font-black">{percentage}%</span>
              </div>
              <span className="text-[11px] mt-1 opacity-90">
                {isLow ? 'Critical Refill Needed' : isHigh ? 'Near Tank Full' : 'Optimal Level'}
              </span>
            </div>

            {/* Distance to Surface */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 flex flex-col text-slate-300">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Air Gap Distance</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-mono font-bold text-slate-100">{telemetry.distance_cm}</span>
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">Offset: {config.sensorOffsetCm} cm</span>
            </div>

            {/* Pump State Badge */}
            <div className={`p-4 rounded-2xl border flex flex-col ${
              isPumpOn 
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Pump State</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isPumpOn ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-2xl font-mono font-black">{isPumpOn ? 'RUNNING' : 'IDLE'}</span>
              </div>
              <span className="text-[11px] mt-1 text-slate-400">
                {isPumpOn ? `${config.pumpFlowRateLpm} L/min inflow` : 'Solenoid Closed'}
              </span>
            </div>
          </div>
        </div>

        {/* Pump Override & Safety Action Strip */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isPumpOn ? 'bg-blue-600/20 border border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse' : 'bg-slate-800/80 text-slate-400 border border-slate-700'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 uppercase tracking-tight flex items-center gap-2">
                <span>Manual Pump Override</span>
                {config.autoMode && (
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-500/30">
                    AUTO ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isPumpOn 
                  ? 'Pump is actively drawing power. Safety cutoff enabled.' 
                  : 'Interlocked security override to prevent dry-run or overflow.'}
              </p>
            </div>
          </div>

          <button
            id="pump-override-button"
            type="button"
            onClick={onOpenPumpModal}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tight transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              isPumpOn 
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
            }`}
          >
            <span>{isPumpOn ? 'Emergency Stop Pump' : 'Manual Override'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
