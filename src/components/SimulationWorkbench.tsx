/**
 * Interactive Simulation Workbench & Fault Injection Testbench
 * Enables industrial test technicians and predictive maintenance engineers to simulate
 * complex failure modes, calibrate anomaly thresholds, and test digital twin responses.
 */

import React from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Thermometer,
  Gauge,
  Radio,
  Flame,
  AlertOctagon,
  Power,
  Settings2,
} from 'lucide-react';
import {
  SimulationPreset,
  SimulationStateConfig,
  industrialSimulationEngine,
} from '../services/simulationEngine';
import { DataSourceMode } from '../types/telemetry';

interface SimulationWorkbenchProps {
  dataSourceMode: DataSourceMode;
  onSetDataSourceMode: (mode: DataSourceMode) => void;
  onPresetSelect: (preset: SimulationPreset) => void;
  activePreset: SimulationPreset;
}

export const SimulationWorkbench: React.FC<SimulationWorkbenchProps> = ({
  dataSourceMode,
  onSetDataSourceMode,
  onPresetSelect,
  activePreset,
}) => {
  const [config, setConfig] = React.useState<SimulationStateConfig>(industrialSimulationEngine.getConfig());

  const handleUpdate = (patch: Partial<SimulationStateConfig>) => {
    industrialSimulationEngine.setCustomConfig(patch);
    setConfig(industrialSimulationEngine.getConfig());
  };

  const handlePreset = (preset: SimulationPreset) => {
    onPresetSelect(preset);
    industrialSimulationEngine.setPreset(preset);
    setConfig(industrialSimulationEngine.getConfig());
  };

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-5">
      {/* Header & Source Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Simulation & Fault Injection Testbench
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Inject mechanical, electrical, and sensor failures to validate AI detection in real time
            </p>
          </div>
        </div>

        {/* Live vs Simulation Mode Segmented Toggle */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => onSetDataSourceMode('LIVE_ESP32')}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
              dataSourceMode === 'LIVE_ESP32'
                ? 'bg-emerald-700 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIVE ESP32 RTDB
          </button>
          <button
            onClick={() => onSetDataSourceMode('SIMULATED')}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
              dataSourceMode === 'SIMULATED'
                ? 'bg-cyan-700 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DIGITAL TWIN SIM
          </button>
        </div>
      </div>

      {/* Preset Fault Injections Grid */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
          Failure Scenario Presets
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Preset 1: Nominal Run */}
          <button
            onClick={() => handlePreset('NOMINAL_RUN')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'NOMINAL_RUN'
                ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Power className="w-3.5 h-3.5" />
              <span>Nominal Run</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">1780 RPM · 41°C · Low Vib</div>
          </button>

          {/* Preset 2: Bearing Imbalance */}
          <button
            onClick={() => handlePreset('BEARING_IMBALANCE')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'BEARING_IMBALANCE'
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Activity className="w-3.5 h-3.5" />
              <span>Bearing Imbalance</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">High 2.5g vibration spike</div>
          </button>

          {/* Preset 3: Stator Overheat */}
          <button
            onClick={() => handlePreset('STATOR_OVERHEAT')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'STATOR_OVERHEAT'
                ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <Flame className="w-3.5 h-3.5" />
              <span>Stator Overheat</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">78°C+ thermal runaway</div>
          </button>

          {/* Preset 4: Locked Rotor / Stall */}
          <button
            onClick={() => handlePreset('LOCKED_ROTOR_STALL')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'LOCKED_ROTOR_STALL'
                ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Locked Rotor Stall</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">0 RPM · 4.8A overcurrent</div>
          </button>

          {/* Preset 5: Voltage Brownout */}
          <button
            onClick={() => handlePreset('VOLTAGE_BROWNOUT')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'VOLTAGE_BROWNOUT'
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Zap className="w-3.5 h-3.5" />
              <span>Voltage Brownout</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">9.6V sag · RPM drop</div>
          </button>

          {/* Preset 6: MPU Sensor Disconnect */}
          <button
            onClick={() => handlePreset('SENSOR_FAULT')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              activePreset === 'SENSOR_FAULT'
                ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <Radio className="w-3.5 h-3.5" />
              <span>MPU Sensor Fault</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">mpuOK=false · I2C drop</div>
          </button>
        </div>
      </div>

      {/* Manual Calibration & Dynamic Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80">
        {/* Speed & Motor State */}
        <div className="space-y-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Rotor Speed & Drive</span>
            <button
              onClick={() => handleUpdate({ motorRunning: !config.motorRunning })}
              className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                config.motorRunning ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.motorRunning ? 'RUNNING' : 'STOPPED'}
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Target Speed</span>
              <span className="font-mono text-white tabular-nums">{config.targetRpm} RPM</span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="50"
              value={config.targetRpm}
              onChange={e => handleUpdate({ targetRpm: Number(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Drive PWM</span>
              <span className="font-mono text-white tabular-nums">{config.motorPWM}</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              step="5"
              value={config.motorPWM}
              onChange={e => handleUpdate({ motorPWM: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Thermal & Vibration Dynamics */}
        <div className="space-y-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Thermal & Vibration Dynamics</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Stator Temperature</span>
              <span className="font-mono text-white tabular-nums">{config.temperatureC.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={config.temperatureC}
              onChange={e => handleUpdate({ temperatureC: Number(e.target.value) })}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Vibration Multiplier</span>
              <span className="font-mono text-white tabular-nums">{config.vibrationIntensity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={config.vibrationIntensity}
              onChange={e =>
                handleUpdate({
                  vibrationIntensity: Number(e.target.value),
                  accelBiasX: Number(e.target.value) * 0.6,
                  accelBiasY: Number(e.target.value) * 0.8,
                })
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* Electrical & Sensor Health */}
        <div className="space-y-3 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Electrical Bus & IMU Bus</span>
            <button
              onClick={() => handleUpdate({ mpuOK: !config.mpuOK })}
              className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                config.mpuOK ? 'bg-emerald-600 text-white' : 'bg-rose-700 text-white'
              }`}
            >
              MPU: {config.mpuOK ? 'OK' : 'DISCONNECT'}
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Supply Voltage</span>
              <span className="font-mono text-white tabular-nums">{config.voltageV.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min="8.0"
              max="16.0"
              step="0.2"
              value={config.voltageV}
              onChange={e => handleUpdate({ voltageV: Number(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Line Current</span>
              <span className="font-mono text-white tabular-nums">{config.currentA.toFixed(2)} A</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="6.0"
              step="0.1"
              value={config.currentA}
              onChange={e => handleUpdate({ currentA: Number(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
