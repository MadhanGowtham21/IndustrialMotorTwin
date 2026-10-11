/**
 * Sensor Trend Analytics & SCADA Historian
 * Time-series charts using Recharts for Temperature, Speed, Vibration, Voltage, Current, and PWM.
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Download, Sliders, Activity, Thermometer, Zap, Gauge, AlertCircle } from 'lucide-react';
import { TelemetryHistoryPoint } from '../types/telemetry';

interface SensorChartsProps {
  historyData: TelemetryHistoryPoint[];
  onExportCsv: () => void;
}

type MetricKey = 'temperatureC' | 'rpm' | 'vibrationG' | 'voltageV' | 'currentA' | 'motorPWM';

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  stroke: string;
  nominalMin: number;
  nominalMax: number;
  criticalLimit: number;
}

const METRICS: MetricConfig[] = [
  {
    key: 'temperatureC',
    label: 'Stator Temperature',
    unit: '°C',
    stroke: '#38bdf8', // cyan
    nominalMin: 20,
    nominalMax: 70,
    criticalLimit: 75,
  },
  {
    key: 'rpm',
    label: 'Rotor Speed',
    unit: 'RPM',
    stroke: '#34d399', // emerald
    nominalMin: 1200,
    nominalMax: 2000,
    criticalLimit: 3200,
  },
  {
    key: 'vibrationG',
    label: 'Vibration RMS',
    unit: 'g',
    stroke: '#fbbf24', // amber
    nominalMin: 0.1,
    nominalMax: 1.8,
    criticalLimit: 2.5,
  },
  {
    key: 'currentA',
    label: 'Line Current',
    unit: 'A',
    stroke: '#a78bfa', // purple
    nominalMin: 0.5,
    nominalMax: 3.8,
    criticalLimit: 4.5,
  },
  {
    key: 'voltageV',
    label: 'Busbar Voltage',
    unit: 'V',
    stroke: '#f472b6', // pink
    nominalMin: 10.8,
    nominalMax: 13.8,
    criticalLimit: 14.5,
  },
  {
    key: 'motorPWM',
    label: 'Drive PWM',
    unit: 'PWM',
    stroke: '#818cf8', // indigo
    nominalMin: 0,
    nominalMax: 255,
    criticalLimit: 255,
  },
];

export const SensorCharts: React.FC<SensorChartsProps> = React.memo(({ historyData, onExportCsv }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('temperatureC');
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('15m');
  const [showThresholds, setShowThresholds] = useState(true);

  // Filter history based on time range (mock scale or actual sample points)
  const filteredData = React.useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    const pointsCount = timeRange === '15m' ? 30 : timeRange === '1h' ? 60 : timeRange === '6h' ? 120 : 180;
    return historyData.slice(-pointsCount);
  }, [historyData, timeRange]);

  const activeConfig = METRICS.find(m => m.key === selectedMetric) || METRICS[0];

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Sensor Trend Analytics & Telemetry Historian</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time calibrated signal logs with ISO threshold boundary overlays
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {(['15m', '1h', '6h', '24h'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Toggle Threshold Lines */}
          <button
            onClick={() => setShowThresholds(!showThresholds)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
              showThresholds
                ? 'bg-slate-800 border-slate-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ISO Bounds
          </button>

          {/* CSV Export */}
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 my-4">
        {METRICS.map(m => {
          const isSelected = selectedMetric === m.key;
          const latestVal = filteredData.length > 0 ? filteredData[filteredData.length - 1][m.key] : null;

          return (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/20'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="text-[11px] font-medium text-slate-400 truncate">{m.label}</div>
              <div className="text-sm font-mono font-bold text-white mt-1 tabular-nums">
                {latestVal !== null && latestVal !== undefined ? `${latestVal}` : '--'}{' '}
                <span className="text-[10px] font-normal text-slate-400 font-sans">{m.unit}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Chart Area */}
      <div className="h-[280px] w-full pt-2">
        {filteredData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-lg">
            <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">Insufficient Telemetry History</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Waiting for incoming sensor packets from Firebase RTDB or Simulation Engine to populate trend graph.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timeStr"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={{ stroke: '#334155' }}
                unit={` ${activeConfig.unit}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                itemStyle={{ color: activeConfig.stroke }}
                formatter={(val: any) => [`${val} ${activeConfig.unit}`, activeConfig.label]}
              />

              {/* Threshold Lines */}
              {showThresholds && (
                <>
                  <ReferenceLine
                    y={activeConfig.nominalMax}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: `Warn: ${activeConfig.nominalMax}${activeConfig.unit}`,
                      fill: '#f59e0b',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={activeConfig.criticalLimit}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Max: ${activeConfig.criticalLimit}${activeConfig.unit}`,
                      fill: '#ef4444',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                </>
              )}

              <Line
                type="monotone"
                dataKey={activeConfig.key}
                stroke={activeConfig.stroke}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Footer with Statistical Range Summary */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80 mt-2 font-mono">
        <div className="flex items-center gap-3">
          <span>Active Metric: {activeConfig.label}</span>
          <span className="text-slate-600">|</span>
          <span>
            Nominal Envelope: [{activeConfig.nominalMin} – {activeConfig.nominalMax}] {activeConfig.unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Samples Logged: {filteredData.length}</span>
        </div>
      </div>
    </div>
  );
});
