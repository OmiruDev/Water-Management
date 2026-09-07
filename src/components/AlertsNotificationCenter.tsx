import React, { useState } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  WifiOff, 
  CheckCircle2, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { SystemAlert, AlertSeverity } from '../types';

interface AlertsNotificationCenterProps {
  alerts: SystemAlert[];
  onAcknowledgeAlert: (id: string) => void;
  onClearAlerts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const AlertsNotificationCenter: React.FC<AlertsNotificationCenterProps> = ({
  alerts,
  onAcknowledgeAlert,
  onClearAlerts,
  soundEnabled,
  onToggleSound,
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [pushStatus, setPushStatus] = useState<string>('idle');

  const unreadCount = alerts.filter((a) => !a.read).length;

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'critical') return a.severity === 'critical';
    if (filter === 'warning') return a.severity === 'warning';
    return true;
  });

  const requestBrowserPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop push notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setPushStatus('granted');
      new Notification('Smart Water Tank Alert Active', {
        body: 'FCM Push Notifications enabled for Critical Low (<15%) and Overflow risks.',
      });
    } else {
      setPushStatus('denied');
    }
  };

  const getAlertIcon = (type: string, severity: AlertSeverity) => {
    if (type === 'leak_detected' || type === 'ai_warning') {
      return <Sparkles className="w-4 h-4 text-indigo-600" />;
    }
    if (type === 'device_offline') {
      return <WifiOff className="w-4 h-4 text-rose-600" />;
    }
    if (severity === 'critical') {
      return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    }
    return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  };

  return (
    <div id="alerts-notification-center" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(15,23,42,0.4)] space-y-5 backdrop-blur-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)]">
              <Bell className="w-5 h-5" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-100">Alerts & FCM Notifications</h3>
              <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                FCM ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Low water (&lt;15%), overflow risk (&gt;95%), hardware offline, and Gemini leak alarms
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Audio Chime Toggle */}
          <button
            id="toggle-audio-alert-btn"
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Disable audio alerts' : 'Enable audio alerts'}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>

          {/* Browser Push Perm */}
          <button
            id="enable-browser-push-btn"
            type="button"
            onClick={requestBrowserPushPermission}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{pushStatus === 'granted' ? 'Push Enabled' : 'Enable Push'}</span>
          </button>

          {/* Clear all */}
          {alerts.length > 0 && (
            <button
              type="button"
              onClick={onClearAlerts}
              className="p-2 rounded-xl border border-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              title="Clear all alerts"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('critical')}
          className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'critical'
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold shadow-[0_0_10px_rgba(244,63,94,0.2)]'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-rose-400'
          }`}
        >
          Critical ({alerts.filter((a) => a.severity === 'critical').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('warning')}
          className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'warning'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-amber-400'
          }`}
        >
          Warnings ({alerts.filter((a) => a.severity === 'warning').length})
        </button>
      </div>

      {/* Alert Cards Feed */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 text-xs text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <span className="font-semibold block text-slate-200">No Active Alerts</span>
            All telemetry metrics and safety setpoints are operating within normal parameters.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                alert.read
                  ? 'bg-slate-950/40 border-slate-800/80 opacity-60'
                  : alert.severity === 'critical'
                  ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                  : alert.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 shrink-0 mt-0.5">
                  {getAlertIcon(alert.type, alert.severity)}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-100">{alert.title}</span>
                    {alert.metricValue && (
                      <span className="text-[10px] font-mono font-bold bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800 text-slate-300">
                        {alert.metricValue}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{alert.message}</p>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(alert.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {!alert.read && (
                <button
                  type="button"
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-slate-100 shrink-0 transition-all cursor-pointer"
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
