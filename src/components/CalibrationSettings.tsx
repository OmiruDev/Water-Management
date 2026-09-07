import React, { useState } from 'react';
import { Sliders, Save, CheckCircle2, RotateCcw, Cpu, Calculator, Info } from 'lucide-react';
import type { SystemConfig } from '../types';

interface CalibrationSettingsProps {
  config: SystemConfig;
  onSaveConfig: (updated: Partial<SystemConfig>) => Promise<void>;
}

export const CalibrationSettings: React.FC<CalibrationSettingsProps> = ({
  config,
  onSaveConfig,
}) => {
  const [form, setForm] = useState<SystemConfig>({ ...config });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if prop changes
  React.useEffect(() => {
    setForm({ ...config });
  }, [config]);

  // Derived cylinder volume in Liters: V = pi * r^2 * h / 1000
  const calculatedVolumeLiters = Math.round(
    (Math.PI * Math.pow(form.tankRadiusCm, 2) * form.tankHeightCm) / 1000
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveConfig(form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save configuration', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="calibration-settings-card" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(15,23,42,0.4)] space-y-6 backdrop-blur-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-100">Physical Calibration & Setpoints</h3>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                ESP32 SYNC READY
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure geometry, sensor ultrasonic acoustic offsets, and relay trip levels
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Synced to ESP32 Firmware!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Physical Tank Geometry */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>1. Tank Geometry & Volumetric Sizing</span>
            </span>
            <div className="text-xs text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/30 font-mono">
              Max Capacity: <strong className="text-slate-100 font-bold">{calculatedVolumeLiters.toLocaleString()} L</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                TANK_HEIGHT_CM
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.tankHeightCm}
                  onChange={(e) => setForm({ ...form, tankHeightCm: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">cm</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Base to top rim</span>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                TANK_RADIUS_CM
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="20"
                  max="500"
                  value={form.tankRadiusCm}
                  onChange={(e) => setForm({ ...form, tankRadiusCm: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">cm</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Half diameter (r)</span>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                SENSOR_OFFSET_CM
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.sensorOffsetCm}
                  onChange={(e) => setForm({ ...form, sensorOffsetCm: Number(e.target.value) })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">cm</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Transducer dead-zone</span>
            </div>
          </div>
        </div>

        {/* Section 2: Automation Setpoints */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>2. Automation Thresholds & Setpoints</span>
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={form.autoMode}
                onChange={(e) => setForm({ ...form, autoMode: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto Pump Relay Logic</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <label className="text-xs font-mono text-emerald-400 block mb-1">
                PUMP_ON_PERCENT (Auto Refill Trigger)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={form.pumpOnPercent}
                  onChange={(e) => setForm({ ...form, pumpOnPercent: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">%</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block">
                Relay turns ON when level drops to {form.pumpOnPercent}% (~{Math.round((form.pumpOnPercent / 100) * calculatedVolumeLiters)} L).
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <label className="text-xs font-mono text-amber-400 block mb-1">
                PUMP_OFF_PERCENT (Auto Cutoff Safety)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="60"
                  max="99"
                  value={form.pumpOffPercent}
                  onChange={(e) => setForm({ ...form, pumpOffPercent: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-amber-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">%</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block">
                Relay trips OFF when level reaches {form.pumpOffPercent}% (~{Math.round((form.pumpOffPercent / 100) * calculatedVolumeLiters)} L).
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Pump Ratings & Power Tariffs */}
        <div className="pt-2 border-t border-slate-800/80">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest block mb-3">
            3. Motor Ratings & Utility Economics
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                Pump Flow Rate (L/min)
              </label>
              <input
                type="number"
                min="5"
                max="200"
                value={form.pumpFlowRateLpm}
                onChange={(e) => setForm({ ...form, pumpFlowRateLpm: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                Motor Power Rating (Watts)
              </label>
              <input
                type="number"
                min="100"
                max="5000"
                value={form.pumpPowerWatts}
                onChange={(e) => setForm({ ...form, pumpPowerWatts: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                Electricity Tariff ($ / kWh)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="2"
                value={form.electricityCostPerKWh}
                onChange={(e) => setForm({ ...form, electricityCostPerKWh: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit & Reset Bar */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...config })}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Reset Form
          </button>
          <button
            id="save-calibration-button"
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded-xl text-xs font-bold uppercase tracking-tight shadow-[0_0_15px_rgba(59,130,246,0.2)] flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Syncing...' : 'Save & Sync Calibration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
