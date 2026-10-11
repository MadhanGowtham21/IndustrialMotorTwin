/**
 * Component Telemetry & CAD Inspector Panel
 * Displays detailed physical specs, maintenance tolerances, and live sensor correlation.
 */

import React from 'react';
import { X, Wrench, ShieldCheck, AlertCircle, Thermometer, Activity, Gauge } from 'lucide-react';
import { MotorComponentInfo, Esp32SensorData, AiDiagnosisResult } from '../types/telemetry';

interface ComponentInspectorModalProps {
  componentId: string | null;
  onClose: () => void;
  sensorData: Esp32SensorData | null;
  aiDiagnosis: AiDiagnosisResult | null;
}

const MOTOR_COMPONENTS: Record<string, MotorComponentInfo> = {
  stator: {
    id: 'stator',
    name: 'Stator Core & Copper Windings',
    category: 'Electromagnetic Assembly',
    material: 'Silicon Steel Laminations (M400-50A) & Class H Enameled Copper',
    ratedLimit: 'Class B 130°C / Class F 155°C Rise Limit',
    currentStress: 'Thermal dissipation via external longitudinal fins',
    healthPercentage: 94,
    lastInspection: '42 days ago (Megger 2.4 GΩ @ 500V DC)',
    notes: 'Three-phase delta configuration with internal PT100 thermal sensors embedded in stator slot wedges.',
  },
  drive_bearing: {
    id: 'drive_bearing',
    name: 'Drive-End (DE) Deep-Groove Ball Bearing',
    category: 'Mechanical Support & Tribology',
    material: 'High-Carbon Chromium Steel (AISI 52100 / 100Cr6)',
    ratedLimit: 'ISO 10816-3 Zone A/B (< 1.80 mm/s RMS / 1.8g)',
    currentStress: 'Radial load from output coupling & belt dynamic tension',
    healthPercentage: 88,
    lastInspection: '18 days ago (Polyurea grease replenishment 15g)',
    notes: 'Monitored by MPU-6050 3-axis accelerometer affixed directly to the drive-end bearing bracket flange.',
  },
  rotor_shaft: {
    id: 'rotor_shaft',
    name: 'Squirrel-Cage Rotor & Hardened Shaft',
    category: 'Rotating Assembly',
    material: 'Die-cast Aluminum Conductor Bars & AISI 4140 Quenched Steel',
    ratedLimit: 'Max continuous mechanical speed 3,600 RPM (ISO 1940 G2.5 Balance)',
    currentStress: 'Torsional shear torque transmission to driven load',
    healthPercentage: 97,
    lastInspection: '60 days ago (Laser dial runout check < 0.02mm)',
    notes: 'Dynamically balanced rotor with DIN 6885 standard feather keyway on drive-end extension.',
  },
  terminal_box: {
    id: 'terminal_box',
    name: 'Cast Iron Terminal Junction Box',
    category: 'Electrical Connection & Insulation',
    material: 'NEMA 4X / IP66 Cast Iron Enclosure with Neoprene Gasket',
    ratedLimit: '600V AC Rated Isolation / 25A Continuous Terminal Blocks',
    currentStress: 'Vibration-induced fastener torque relaxation & moisture seal',
    healthPercentage: 99,
    lastInspection: '30 days ago (Torque audit 4.2 N·m)',
    notes: 'Accommodates 3-phase supply leads, auxiliary temperature sensor wiring, and grounding stud.',
  },
  cooling_fan: {
    id: 'cooling_fan',
    name: 'Bi-Directional Cooling Fan & Shroud',
    category: 'Thermal Management / Ventilation',
    material: 'Glass-Reinforced Polypropylene (GF-PP) & Sheet Steel Cowl',
    ratedLimit: 'Min air volume 145 CFM @ 1800 RPM',
    currentStress: 'Aerodynamic drag & airborne particulate accumulation',
    healthPercentage: 92,
    lastInspection: '12 days ago (Air intake grille dust vacuuming)',
    notes: 'Driven directly from non-drive-end (NDE) shaft extension; airflow directed over stator fins.',
  },
};

export const ComponentInspectorModal: React.FC<ComponentInspectorModalProps> = ({
  componentId,
  onClose,
  sensorData,
  aiDiagnosis,
}) => {
  if (!componentId) return null;

  const info = MOTOR_COMPONENTS[componentId] || {
    id: componentId,
    name: 'Motor Assembly Subsystem',
    category: 'Integrated Component',
    material: 'Industrial Engineering Alloy',
    ratedLimit: 'Factory Standard',
    currentStress: 'Nominal duty cycle',
    healthPercentage: 95,
    lastInspection: 'Routine schedule',
    notes: 'Component actively monitored under continuous SCADA telemetry.',
  };

  const isAffectedByFault = aiDiagnosis?.affectedComponent === componentId;
  const currentTemp = sensorData?.temperatureC ?? 0;
  const currentRpm = sensorData?.rpm ?? 0;
  const currentVib = sensorData
    ? Math.sqrt(
        sensorData.accelX * sensorData.accelX +
        sensorData.accelY * sensorData.accelY +
        sensorData.accelZ * sensorData.accelZ
      ).toFixed(2)
    : '0.00';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">{info.name}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{info.category}</span>
                <span aria-hidden="true">·</span>
                <span>Part ID: {info.id.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Fault Banner if component is actively flagged */}
          {isAffectedByFault && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-950/40 border border-rose-800/70 rounded-lg">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-rose-200">AI Anomaly Flagged for This Component</h4>
                <p className="text-xs text-rose-300/90 mt-0.5">{aiDiagnosis?.evidenceSummary}</p>
              </div>
            </div>
          )}

          {/* Live Telemetry Correlation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Live Sensor Correlation
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Temperature</span>
                </div>
                <div className="text-base font-mono font-semibold text-white tabular-nums">
                  {currentTemp.toFixed(1)} °C
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Rating: 130°C Max</div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vibration</span>
                </div>
                <div className="text-base font-mono font-semibold text-white tabular-nums">
                  {currentVib} g
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">ISO Limit: 1.80g</div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Speed</span>
                </div>
                <div className="text-base font-mono font-semibold text-white tabular-nums">
                  {currentRpm} RPM
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Rated: 1800 RPM</div>
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Engineering Specification
            </h4>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg divide-y divide-slate-800 text-xs">
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-400">Construction Material</span>
                <span className="text-slate-200 font-medium text-right max-w-xs">{info.material}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-400">Design Limit / Standard</span>
                <span className="text-slate-200 font-mono text-right">{info.ratedLimit}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-400">Current Operational Stress</span>
                <span className="text-slate-300 text-right">{info.currentStress}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-400">Component Health Index</span>
                <span className="font-mono font-semibold text-emerald-400">{info.healthPercentage}% Nominal</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-slate-400">Last Maintenance Audit</span>
                <span className="text-slate-300">{info.lastInspection}</span>
              </div>
            </div>
          </div>

          {/* Engineering Maintenance Notes */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-lg">
            <h5 className="text-xs font-semibold text-slate-300 mb-1">Maintenance Engineering Log</h5>
            <p className="text-xs text-slate-400 leading-relaxed">{info.notes}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
