import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Zap, X, Check, Clock } from 'lucide-react';
import type { TelemetryReading, SystemConfig, PumpState } from '../types';

interface PumpSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryReading;
  config: SystemConfig;
  onConfirmPumpChange: (targetState: PumpState, durationMinutes?: number) => Promise<void>;
}

export const PumpSafetyModal: React.FC<PumpSafetyModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  config,
  onConfirmPumpChange,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(0); // 0 = until auto-cutoff
  const [safetyChecked, setSafetyChecked] = useState(false);

  if (!isOpen) return null;

  const currentPumpState = telemetry.pumpState;
  const targetState: PumpState = currentPumpState === 'ON' ? 'OFF' : 'ON';
  const isTurningOn = targetState === 'ON';
  const isHighWater = telemetry.waterPercentage >= config.pumpOffPercent;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmPumpChange(targetState, selectedDuration > 0 ? selectedDuration : undefined);
      onClose();
    } catch (err) {
      console.error('Failed to change pump state', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="pump-safety-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="pump-safety-modal-content" 
        className="bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
          isTurningOn 
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' 
            : 'bg-slate-950/80 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              isTurningOn ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-red-500/20 border-red-500/40 text-red-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate">
                {isTurningOn ? 'Manual Override: Start Pump' : 'Stop Water Pump Relay'}
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">
                ESP32 Hardware Relay Interlock (Pin 23)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Current State Indicator */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block uppercase font-mono text-[10px]">Current Tank Level</span>
              <span className="text-base sm:text-lg font-mono font-bold text-slate-100 mt-0.5 block">
                {telemetry.waterPercentage}% <span className="text-xs text-slate-400 font-normal">({telemetry.waterVolumeLiters.toLocaleString()} L)</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block uppercase font-mono text-[10px]">Cutoff Setpoint</span>
              <span className="text-base sm:text-lg font-mono font-bold text-amber-400 mt-0.5 block">{config.pumpOffPercent}%</span>
            </div>
          </div>

          {/* Warning Message if Tank is Full */}
          {isTurningOn && isHighWater && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-200">Warning: Overflow Risk</span>
                Water level is currently at {telemetry.waterPercentage}%, which is at or above the programmed cutoff setpoint of {config.pumpOffPercent}%. Turning on the pump now may cause tank overflow.
              </div>
            </div>
          )}

          {isTurningOn && !isHighWater && (
            <div className="text-xs text-slate-400 space-y-2">
              <p>
                Initiating manual pump activation will energize the ESP32 relay switch (Pin 23).
                The pump will deliver approximately <strong className="text-slate-200 font-mono">{config.pumpFlowRateLpm} L/min</strong> drawing <strong className="text-slate-200 font-mono">{config.pumpPowerWatts}W</strong>.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 p-3 rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Safety lock will automatically trip if water reaches {config.pumpOffPercent}%.</span>
              </div>
            </div>
          )}

          {/* Duration Selector for Manual Run */}
          {isTurningOn && (
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Auto-Shutoff Timer</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Until Cutoff', mins: 0 },
                  { label: '15 Mins', mins: 15 },
                  { label: '30 Mins', mins: 30 },
                  { label: '45 Mins', mins: 45 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    type="button"
                    onClick={() => setSelectedDuration(item.mins)}
                    className={`py-2 px-1 text-xs font-medium rounded-xl border transition-all cursor-pointer min-h-[38px] ${
                      selectedDuration === item.mins
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stop Explanation if turning OFF */}
          {!isTurningOn && (
            <div className="text-xs text-slate-400">
              Stopping the pump immediately cuts power to the intake motor. The check-valve will seat, preventing water back-siphonage into the municipal or borehole supply.
            </div>
          )}

          {/* Safety Checkbox for Starting */}
          {isTurningOn && (
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                id="safety-interlock-checkbox"
                type="checkbox"
                checked={safetyChecked}
                onChange={(e) => setSafetyChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-300 font-medium">
                I verify that the discharge valves are open and the intake supply is active to prevent dry-run cavitation damage.
              </span>
            </label>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-center cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            id="confirm-pump-override-btn"
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || (isTurningOn && !safetyChecked)}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-tight rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px] ${
              isTurningOn
                ? safetyChecked 
                  ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
            }`}
          >
            {isSubmitting ? (
              <span>Transmitting command...</span>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{isTurningOn ? 'Authorize & Energize Pump' : 'Stop Pump Immediately'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
