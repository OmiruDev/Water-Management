import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Calendar, Clock, Zap, DollarSign, TrendingDown, ArrowUpRight } from 'lucide-react';
import type { HistoricalDataPoint, SystemConfig } from '../types';

interface AnalyticsTrendsProps {
  history24h: HistoricalDataPoint[];
  history7d: HistoricalDataPoint[];
  config: SystemConfig;
}

export const AnalyticsTrends: React.FC<AnalyticsTrendsProps> = ({
  history24h,
  history7d,
  config,
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d'>('24h');
  const [activeMetric, setActiveMetric] = useState<'waterLevel' | 'consumption' | 'pump'>('waterLevel');

  const currentData = timeRange === '24h' ? history24h : history7d;

  // Aggregate stats
  const totalConsumption = currentData.reduce((acc, curr) => acc + (curr.consumptionLiters || 0), 0);
  const totalPumpMins = currentData.reduce((acc, curr) => acc + (curr.pumpMinutesActive || 0), 0);
  const totalEnergyKWh = currentData.reduce((acc, curr) => acc + (curr.pumpEnergyKWh || 0), 0);
  const estimatedCost = Number((totalEnergyKWh * config.electricityCostPerKWh).toFixed(2));
  const avgHourlyConsumption = timeRange === '24h' 
    ? Math.round(totalConsumption / (currentData.length || 1)) 
    : Math.round(totalConsumption / 7);

  return (
    <div id="analytics-trends-container" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(15,23,42,0.4)] space-y-6 backdrop-blur-sm relative overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <span>Usage Trends & Analytics</span>
          </h3>
          <p className="text-xs text-slate-400">
            Telemetry ingestion logs, volumetric draw-downs, and pump electrical duty cycles
          </p>
        </div>

        {/* Range Selector & View Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric View Tabs */}
          <div className="bg-slate-950/80 border border-slate-800 p-1 rounded-xl flex items-center text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveMetric('waterLevel')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetric === 'waterLevel' 
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Level %
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('consumption')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetric === 'consumption' 
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Volume (L)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('pump')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMetric === 'pump' 
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pump & Energy
            </button>
          </div>

          {/* Time Window (24h / 7d) */}
          <div className="bg-slate-950/80 border border-slate-800 p-1 rounded-xl flex items-center text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setTimeRange('24h')}
              className={`px-2.5 py-1.5 rounded-lg transition-all font-mono cursor-pointer ${
                timeRange === '24h' 
                  ? 'bg-blue-600 text-white font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24H
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1.5 rounded-lg transition-all font-mono cursor-pointer ${
                timeRange === '7d' 
                  ? 'bg-blue-600 text-white font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7D
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 sm:p-4 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-slate-400 truncate block">Total Consumed</span>
          <div className="text-lg sm:text-xl font-mono font-bold text-slate-100 mt-1 truncate">
            {totalConsumption.toLocaleString()} <span className="text-xs font-normal text-slate-400">L</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5 block truncate">
            ~{avgHourlyConsumption} L/{timeRange === '24h' ? 'hr' : 'day'}
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 sm:p-4 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-slate-400 truncate block">Pump Run-Time</span>
          <div className="text-lg sm:text-xl font-mono font-bold text-blue-400 mt-1 flex items-baseline gap-1 truncate">
            <span>{(totalPumpMins / 60).toFixed(1)}h</span>
            <span className="text-xs font-normal text-slate-400">({totalPumpMins}m)</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-mono mt-0.5 block truncate">
            Duty: {((totalPumpMins / (timeRange === '24h' ? 1440 : 10080)) * 100).toFixed(1)}%
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 sm:p-4 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-slate-400 truncate block">Power Consumed</span>
          <div className="text-lg sm:text-xl font-mono font-bold text-amber-400 mt-1 flex items-baseline gap-1 truncate">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span>{totalEnergyKWh.toFixed(2)}</span>
            <span className="text-xs font-normal text-slate-400">kWh</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5 block truncate">
            {config.pumpPowerWatts}W Motor
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 sm:p-4 min-w-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-slate-400 truncate block">Energy Cost</span>
          <div className="text-lg sm:text-xl font-mono font-bold text-emerald-400 mt-1 flex items-baseline gap-1 truncate">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span>${estimatedCost}</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5 block truncate">
            ${config.electricityCostPerKWh}/kWh
          </span>
        </div>
      </div>

      {/* Main Interactive Recharts Stage */}
      <div className="h-64 sm:h-72 w-full min-w-0 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'waterLevel' ? (
            <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="waterLevelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
                unit="%" 
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as HistoricalDataPoint;
                    return (
                      <div className="bg-slate-950/95 text-slate-100 p-3 rounded-xl shadow-2xl text-xs space-y-1 border border-slate-800 font-mono">
                        <div className="font-bold text-blue-400">{label}</div>
                        <div>Level: <span className="font-semibold text-white">{data.waterPercentage}%</span></div>
                        <div>Volume: <span className="font-semibold text-slate-200">{data.waterVolumeLiters.toLocaleString()} L</span></div>
                        {data.pumpState === 'ON' && (
                          <div className="text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Pump Active</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="waterPercentage" 
                name="Water Level %" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#waterLevelGradient)" 
              />
            </AreaChart>
          ) : activeMetric === 'consumption' ? (
            <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
                unit="L" 
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as HistoricalDataPoint;
                    return (
                      <div className="bg-slate-950/95 text-slate-100 p-3 rounded-xl shadow-2xl text-xs space-y-1 border border-slate-800 font-mono">
                        <div className="font-bold text-blue-400">{label}</div>
                        <div>Consumed: <span className="font-semibold text-white">{data.consumptionLiters} Liters</span></div>
                        <div>End Level: <span className="font-semibold text-slate-300">{data.waterPercentage}%</span></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="consumptionLiters" 
                name="Consumption (L)" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]} 
              />
            </BarChart>
          ) : (
            <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false} 
                unit="m" 
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as HistoricalDataPoint;
                    return (
                      <div className="bg-slate-950/95 text-slate-100 p-3 rounded-xl shadow-2xl text-xs space-y-1 border border-slate-800 font-mono">
                        <div className="font-bold text-blue-400">{label}</div>
                        <div>Active Time: <span className="font-semibold text-white">{data.pumpMinutesActive} mins</span></div>
                        <div>Energy: <span className="font-semibold text-amber-400">{data.pumpEnergyKWh} kWh</span></div>
                        <div>Est Cost: <span className="font-semibold text-emerald-400">${(data.pumpEnergyKWh * config.electricityCostPerKWh).toFixed(3)}</span></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="pumpMinutesActive" 
                name="Pump Active Mins" 
                stroke="#10b981" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: '#10b981' }} 
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Analytics Insights Bar */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
          <span>Peak Usage Windows: <strong className="text-slate-200">07:30 - 09:00 AM</strong> & <strong className="text-slate-200">07:00 - 08:30 PM</strong></span>
        </div>
        <div className="font-mono text-slate-500 text-[11px]">
          Sample Rate: 1 pkt / 3s • Ingestion: Realtime
        </div>
      </div>
    </div>
  );
};
