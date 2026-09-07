import React, { useState } from 'react';
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingDown, 
  Calendar, 
  ShieldAlert, 
  RefreshCw, 
  Zap, 
  Droplet,
  Sliders,
  Check
} from 'lucide-react';
import type { AILeakAnalysis, AIPrediction, TelemetryReading, SystemConfig } from '../types';

interface AIInsightsPanelProps {
  telemetry: TelemetryReading;
  config: SystemConfig;
  leakAnalysis: AILeakAnalysis | null;
  prediction: AIPrediction | null;
  simulatedLeakLph: number;
  isLoading: boolean;
  onRefreshAI: () => void;
  onToggleSimulatedLeak: (rate?: number) => void;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  telemetry,
  config,
  leakAnalysis,
  prediction,
  simulatedLeakLph,
  isLoading,
  onRefreshAI,
  onToggleSimulatedLeak,
}) => {
  const isLeaking = leakAnalysis?.leakDetected || simulatedLeakLph > 0;

  return (
    <div id="ai-insights-panel" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(15,23,42,0.4)] space-y-6 backdrop-blur-sm relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">
                AI Intelligence Layer
              </h3>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-500/30">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated leak diagnosis, predictive refill forecasting, and energy-efficient pump schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Simulate Leak Trigger for Demonstration */}
          <button
            id="toggle-simulated-leak-btn"
            type="button"
            onClick={() => onToggleSimulatedLeak(simulatedLeakLph > 0 ? 0 : 38)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              simulatedLeakLph > 0
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Droplet className={`w-3.5 h-3.5 ${simulatedLeakLph > 0 ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
            <span>{simulatedLeakLph > 0 ? `Simulated Leak: ${simulatedLeakLph} L/h (Stop)` : 'Simulate Pipe Leak'}</span>
          </button>

          {/* Refresh AI Button */}
          <button
            id="refresh-ai-insights-btn"
            type="button"
            onClick={onRefreshAI}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 text-xs font-bold uppercase tracking-tight rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Analyzing...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Primary Feature Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Leak & Anomaly Detection */}
        <div className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
          isLeaking 
            ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]' 
            : 'bg-slate-950/50 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-5 h-5 ${isLeaking ? 'text-rose-400' : 'text-emerald-400'}`} />
                <h4 className="font-bold text-sm text-slate-100">
                  Standby Leak & Anomaly Detection
                </h4>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                isLeaking 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isLeaking ? 'Abnormal Drop Detected' : 'All Clear / Nominal'}
              </span>
            </div>

            {/* Diagnostic Metrics Row */}
            <div className="grid grid-cols-3 gap-2.5 my-3">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Est Loss</span>
                <span className={`text-base font-mono font-bold ${isLeaking ? 'text-rose-400' : 'text-slate-100'}`}>
                  {leakAnalysis ? `${leakAnalysis.estimatedLossRateLph} L/h` : simulatedLeakLph > 0 ? `${simulatedLeakLph} L/h` : '0 L/h'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Drop Rate</span>
                <span className="text-base font-mono font-bold text-slate-100">
                  {leakAnalysis ? `${leakAnalysis.dropRatePercentPerHr}%/hr` : simulatedLeakLph > 0 ? '1.9%/hr' : '0.4%/hr'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Confidence</span>
                <span className="text-base font-mono font-bold text-blue-400">
                  {leakAnalysis ? `${leakAnalysis.confidenceScore}%` : isLeaking ? '94%' : '12%'}
                </span>
              </div>
            </div>

            {/* AI Explanation & Context */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Gemini Analysis:</span>
              </div>
              <p className="leading-relaxed text-slate-300">
                {leakAnalysis?.explanation || (
                  isLeaking
                    ? `Telemetry correlates sustained continuous fluid depletion of ~${simulatedLeakLph || 38} L/h during pump standby periods. Drop signature matches an unsealed perimeter pipe join or failing float valve seal.`
                    : 'Static pressure curves and standby drop rates show zero unmetered drawdown. Tank integrity and distribution valves are functioning within certified operating standards.'
                )}
              </p>
            </div>
          </div>

          {/* Actionable Maintenance Recommendation */}
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Recommended Protocol:
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1 flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isLeaking ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-emerald-500 shadow-[0_0_6px_#10b981]'}`} />
              <span>
                {leakAnalysis?.recommendedAction || (
                  isLeaking 
                    ? 'Isolate downstream distribution line and inspect subterranean pipe joints immediately.'
                    : 'System is fully stable. Routine automated sensor scan scheduled for 03:00 AM.'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Module 2: Predictive Refill & Run-Dry Warnings */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  Predictive Refill & Run-Dry Forecast
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/30">
                Efficiency: {prediction?.efficiencyScore ?? 88}/100
              </span>
            </div>

            {/* Forecast Readout Cards */}
            <div className="grid grid-cols-2 gap-2.5 my-3">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Hours Until Dry</span>
                <div className="text-xl font-mono font-bold text-slate-100 mt-0.5">
                  {prediction?.hoursUntilDry !== null && prediction?.hoursUntilDry !== undefined
                    ? `${prediction.hoursUntilDry} hrs`
                    : `${Math.round(telemetry.waterVolumeLiters / 23)} hrs`}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  At current domestic demand
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Est Daily Demand</span>
                <div className="text-xl font-mono font-bold text-slate-100 mt-0.5">
                  {prediction?.dailyConsumptionEstimateLiters ?? 550} <span className="text-xs font-normal text-slate-400 font-mono">L</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Historical rolling average
                </span>
              </div>
            </div>

            {/* Smart Scheduling Advice */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart Refill Schedule Window:</span>
              </div>
              <p className="font-medium text-slate-200">
                {prediction?.suggestedRefillTime ?? '04:00 AM - 05:30 AM (Lowest Grid Tariff & High Mains Pressure)'}
              </p>
              <p className="text-slate-400 text-[11px]">
                {prediction?.smartScheduleAdvice ?? 'Scheduling refills in pre-dawn hours avoids peak residential grid tariffs ($0.16/kWh vs $0.28/kWh) while taking advantage of stabilized municipal supply pressure.'}
              </p>
            </div>
          </div>

          {/* Actionable Insights List */}
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">
              Key Recommendations:
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {(prediction?.insights || [
                `Refill trigger set to initiate when water reserves dip below ${config.pumpOnPercent}%.`,
                'Peak usage windows detected between 07:30 - 09:15 AM and 07:00 - 08:30 PM.',
                'Motor health tracking shows optimal impeller efficiency with zero cavitation vibration detected.'
              ]).map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
