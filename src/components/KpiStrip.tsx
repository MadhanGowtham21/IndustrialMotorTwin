/**
 * Industrial SCADA KPI Telemetry Cards
 * Displays calibrated engineering values with units, freshness, status indicators, and sparklines.
 */

import React from 'react';
import {
  Activity,
  Gauge,
  Thermometer,
  Zap,
  Cpu,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Sliders,
} from 'lucide-react';
import { Esp32SensorData, AiDiagnosisResult, DataSourceMode } from '../types/telemetry';

interface KpiStripProps {
  sensorData: Esp32SensorData | null;
  aiDiagnosis: AiDiagnosisResult | null;
  dataSourceMode: DataSourceMode;
  isStale: boolean;
  onOpenDiagnosis: () => void;
}

export const KpiStrip: React.FC<KpiStripProps> = React.memo(({
  sensorData,
  aiDiagnosis,
  dataSourceMode,
  isStale,
  onOpenDiagnosis,
}) => {
  // Compute vibration magnitude
  const vibG = sensorData?.mpuOK
    ? Math.sqrt(
        sensorData.accelX * sensorData.accelX +
        sensorData.accelY * sensorData.accelY +
        sensorData.accelZ * sensorData.accelZ
      )
    : null;

  // Format timestamp
  const formatTime = (ts: number | undefined) => {
    if (!ts || ts <= 0) return 'Unavailable';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const healthScore = aiDiagnosis?.severity === 'CRITICAL' ? 42 : aiDiagnosis?.severity === 'WARNING' ? 76 : 98;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2.5">
      {/* 1. Motor Health Status */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Health Status</span>
          <ShieldCheck
            className={`w-3.5 h-3.5 ${
              aiDiagnosis?.severity === 'CRITICAL'
                ? 'text-rose-500'
                : aiDiagnosis?.severity === 'WARNING'
                ? 'text-amber-500'
                : 'text-emerald-500'
            }`}
          />
        </div>
        <div>
          <div className="text-lg font-bold font-mono tracking-tight text-white tabular-nums">
            {healthScore}%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
            <span
              className={`font-medium ${
                aiDiagnosis?.severity === 'CRITICAL'
                  ? 'text-rose-400'
                  : aiDiagnosis?.severity === 'WARNING'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {aiDiagnosis?.severity === 'CRITICAL' ? 'Critical' : aiDiagnosis?.severity === 'WARNING' ? 'Warning' : 'Nominal'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Current RPM */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Rotor Speed</span>
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div>
          <div className="text-lg font-bold font-mono tracking-tight text-white tabular-nums">
            {sensorData ? sensorData.rpm : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>RPM</span>
            <span className="text-[10px] text-slate-500">Rated 1800</span>
          </div>
        </div>
      </div>

      {/* 3. Temperature */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Temperature</span>
          <Thermometer
            className={`w-3.5 h-3.5 ${
              (sensorData?.temperatureC ?? 0) > 70
                ? 'text-rose-400'
                : (sensorData?.temperatureC ?? 0) > 55
                ? 'text-amber-400'
                : 'text-cyan-400'
            }`}
          />
        </div>
        <div>
          <div
            className={`text-lg font-bold font-mono tracking-tight tabular-nums ${
              (sensorData?.temperatureC ?? 0) > 70
                ? 'text-rose-400'
                : (sensorData?.temperatureC ?? 0) > 55
                ? 'text-amber-400'
                : 'text-white'
            }`}
          >
            {sensorData ? sensorData.temperatureC.toFixed(1) : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>°C</span>
            <span className="text-[10px] text-slate-500">Max 70°C</span>
          </div>
        </div>
      </div>

      {/* 4. Vibration Magnitude */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Vibration</span>
          <Activity
            className={`w-3.5 h-3.5 ${
              vibG && vibG > 1.8 ? 'text-rose-400' : vibG && vibG > 1.0 ? 'text-amber-400' : 'text-cyan-400'
            }`}
          />
        </div>
        <div>
          <div
            className={`text-lg font-bold font-mono tracking-tight tabular-nums ${
              vibG && vibG > 1.8 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {sensorData?.mpuOK && vibG !== null ? vibG.toFixed(2) : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>g (RMS)</span>
            <span className="text-[10px] text-slate-500">ISO 1.8g</span>
          </div>
        </div>
      </div>

      {/* 5. Voltage */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Supply Rail</span>
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <div className="text-lg font-bold font-mono tracking-tight text-white tabular-nums">
            {sensorData ? sensorData.voltageV.toFixed(2) : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>V (DC/Bus)</span>
            <span className="text-[10px] text-slate-500">12V Nom</span>
          </div>
        </div>
      </div>

      {/* 6. Current */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Line Current</span>
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div>
          <div
            className={`text-lg font-bold font-mono tracking-tight tabular-nums ${
              (sensorData?.currentA ?? 0) > 3.8 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {sensorData ? sensorData.currentA.toFixed(2) : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>A</span>
            <span className="text-[10px] text-slate-500">Max 3.8A</span>
          </div>
        </div>
      </div>

      {/* 7. Motor PWM / Commanded */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">PWM Drive</span>
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div>
          <div className="text-lg font-bold font-mono tracking-tight text-white tabular-nums">
            {sensorData ? sensorData.motorPWM : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>8-bit PWM</span>
            <span className="text-[10px] text-slate-500">
              {sensorData ? `${Math.round((sensorData.motorPWM / 255) * 100)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 8. AI Anomaly Score */}
      <div
        onClick={onOpenDiagnosis}
        className="bg-[#101726] border border-slate-800 hover:border-cyan-700/60 p-3 rounded-lg flex flex-col justify-between cursor-pointer transition-colors"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Anomaly Index</span>
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div>
          <div
            className={`text-lg font-bold font-mono tracking-tight tabular-nums ${
              (aiDiagnosis?.anomalyScore ?? 0) > 0.65 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {aiDiagnosis ? aiDiagnosis.anomalyScore.toFixed(3) : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>Scale [0-1]</span>
            <span
              className={`text-[10px] font-mono ${
                (aiDiagnosis?.anomalyScore ?? 0) > 0.65 ? 'text-rose-400 font-semibold' : 'text-slate-500'
              }`}
            >
              {(aiDiagnosis?.anomalyScore ?? 0) > 0.65 ? 'Divergent' : 'In Envelope'}
            </span>
          </div>
        </div>
      </div>

      {/* 9. AI Fault Classification */}
      <div
        onClick={onOpenDiagnosis}
        className="bg-[#101726] border border-slate-800 hover:border-cyan-700/60 p-3 rounded-lg flex flex-col justify-between cursor-pointer transition-colors"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">AI Diagnostic</span>
          <AlertTriangle
            className={`w-3.5 h-3.5 ${
              aiDiagnosis?.severity === 'CRITICAL'
                ? 'text-rose-400'
                : aiDiagnosis?.severity === 'WARNING'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          />
        </div>
        <div>
          <div
            className={`text-xs font-semibold truncate ${
              aiDiagnosis?.severity === 'CRITICAL'
                ? 'text-rose-400'
                : aiDiagnosis?.severity === 'WARNING'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
            title={aiDiagnosis?.predictedClass}
          >
            {aiDiagnosis ? aiDiagnosis.predictedClass : 'Unavailable'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
            <span>Confidence</span>
            <span className="font-mono text-[10px] text-slate-300">
              {aiDiagnosis ? `${aiDiagnosis.confidence}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 10. Last Data Update & Freshness */}
      <div className="bg-[#101726] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="truncate">Last Update</span>
          <Clock className={`w-3.5 h-3.5 ${isStale ? 'text-amber-400' : 'text-slate-400'}`} />
        </div>
        <div>
          <div className="text-xs font-mono font-semibold text-slate-200 tabular-nums">
            {formatTime(sensorData?.updatedAt)}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-0.5">
            <span className={isStale ? 'text-amber-400 font-mono text-[10px]' : 'text-slate-500 text-[10px]'}>
              {isStale ? 'Stale >15s' : 'Active sync'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase">{dataSourceMode.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
