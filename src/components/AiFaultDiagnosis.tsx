/**
 * AI Predictive Maintenance & Explainable Anomaly Detection Panel
 * Displays model version, anomaly score, feature divergence breakdown, root causes, and inspection actions.
 */

import React, { useState } from 'react';
import {
  Cpu,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  FileCode,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { AiDiagnosisResult, DataSourceMode } from '../types/telemetry';

interface AiFaultDiagnosisProps {
  diagnosis: AiDiagnosisResult | null;
  dataSourceMode: DataSourceMode;
  onOpenFastApiDocs: () => void;
  onOpenFastApiControl?: () => void;
}

export const AiFaultDiagnosis: React.FC<AiFaultDiagnosisProps> = React.memo(({
  diagnosis,
  dataSourceMode,
  onOpenFastApiDocs,
  onOpenFastApiControl,
}) => {
  const [activeTab, setActiveTab] = useState<'explanation' | 'features' | 'actions' | 'api'>('explanation');

  if (!diagnosis) {
    return (
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 shadow-xl flex items-center justify-center min-h-[300px]">
        <div className="text-center text-slate-500">
          <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Waiting for model telemetry...</p>
        </div>
      </div>
    );
  }

  const isCritical = diagnosis.severity === 'CRITICAL';
  const isWarning = diagnosis.severity === 'WARNING';
  const isNominal = diagnosis.severity === 'NOMINAL';

  const severityColor = isCritical
    ? 'text-rose-400 border-rose-800/80 bg-rose-950/40'
    : isWarning
    ? 'text-amber-400 border-amber-800/80 bg-amber-950/40'
    : 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40';

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span>AI Fault Detection & Explainability Engine</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <span>Model: {diagnosis.modelVersion}</span>
              <span aria-hidden="true">·</span>
              <span className={diagnosis.backendSource ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                Source: {diagnosis.backendSource?.includes('render.com') ? 'Render Cloud FastAPI' : diagnosis.backendSource ? 'Live Backend' : 'In-App ML'}
              </span>
            </div>
          </div>
        </div>

        {/* Severity Badge & Backend Switch */}
        <div className="flex items-center gap-2">
          {onOpenFastApiControl && (
            <button
              onClick={onOpenFastApiControl}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-800/60 bg-cyan-950/40 hover:bg-cyan-900/50 text-[11px] font-mono text-cyan-300 transition-colors"
              title="Configure live FastAPI endpoint"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>FastAPI Backend</span>
            </button>
          )}
          <div className={`px-3 py-1 rounded-lg border text-xs font-mono font-semibold flex items-center gap-1.5 ${severityColor}`}>
            {isCritical ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : isWarning ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{diagnosis.statusText.toUpperCase()} ({diagnosis.severity})</span>
          </div>
        </div>
      </div>

      {/* Primary Diagnostic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
        {/* Classification */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Predicted Fault Class
          </span>
          <div className="text-base font-bold text-white mt-1 leading-snug">
            {diagnosis.predictedClass}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
            <span>Class Confidence:</span>
            <span className="text-cyan-400 font-semibold">{diagnosis.confidence}%</span>
          </div>
        </div>

        {/* Anomaly Score */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            <span>Multivariate Anomaly Score</span>
            <span className="text-[10px] text-slate-500 lowercase">non-calibrated raw index</span>
          </div>
          <div className="text-base font-bold font-mono text-white mt-1 tabular-nums">
            {diagnosis.anomalyScore.toFixed(3)}{' '}
            <span className="text-xs font-normal text-slate-400">/ 1.000</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, diagnosis.anomalyScore * 100)}%` }}
            />
          </div>
        </div>

        {/* Affected Hardware Component */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Localized CAD Component
          </span>
          <div className="text-base font-bold text-cyan-300 mt-1 capitalize font-mono">
            {diagnosis.affectedComponent.replace('_', ' ')}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Targeted 3D Digital Twin element highlighted
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2 mb-3">
        <button
          onClick={() => setActiveTab('explanation')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'explanation'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sensor Evidence & Root Causes
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'features'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Feature Divergence Matrix
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'actions'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Recommended Inspection Plan
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'api'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Python FastAPI Contract
        </button>
      </div>

      {/* Tab Content */}
      <div className="text-xs space-y-3">
        {activeTab === 'explanation' && (
          <div className="space-y-3">
            {/* Sensor Evidence */}
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg">
              <span className="font-semibold text-slate-300 block mb-1">Algorithmic Evidence Summary:</span>
              <p className="text-slate-300 leading-relaxed font-mono">{diagnosis.evidenceSummary}</p>
            </div>

            {/* Possible Causes */}
            <div>
              <span className="font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider text-[11px]">
                Potential Physical Failure Mechanisms:
              </span>
              <ul className="space-y-1.5">
                {diagnosis.possibleCauses.map((cause, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left font-mono">
              <thead className="bg-slate-900 text-[11px] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Feature Signal</th>
                  <th className="p-2.5 text-right">Measured</th>
                  <th className="p-2.5 text-right">Nominal Envelope</th>
                  <th className="p-2.5 text-right">Divergence</th>
                  <th className="p-2.5 text-right">Decision Influence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {diagnosis.featureContributions.map((feat, idx) => (
                  <tr key={idx} className={feat.isOutlier ? 'bg-rose-950/20' : ''}>
                    <td className="p-2.5 font-sans font-medium flex items-center gap-1.5">
                      {feat.isOutlier && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                      <span>{feat.feature}</span>
                    </td>
                    <td className="p-2.5 text-right font-semibold text-white tabular-nums">
                      {feat.measuredValue} {feat.unit}
                    </td>
                    <td className="p-2.5 text-right text-slate-400 tabular-nums">
                      [{feat.nominalRange[0]} – {feat.nominalRange[1]}] {feat.unit}
                    </td>
                    <td
                      className={`p-2.5 text-right tabular-nums font-semibold ${
                        feat.divergencePercent > 0 ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {feat.divergencePercent > 0 ? `+${feat.divergencePercent}%` : `${feat.divergencePercent}%`}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-cyan-400">
                      {Math.round(feat.weight * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-2">
            <span className="font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider text-[11px]">
              Prescribed Reliability Engineering Work Orders:
            </span>
            <div className="space-y-2">
              {diagnosis.recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 bg-slate-900/70 border border-slate-800 rounded-lg"
                >
                  <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200 leading-snug">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>Python FastAPI Machine Learning Microservice Contract</span>
                </span>
                <button
                  onClick={onOpenFastApiDocs}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                >
                  <span>Open API Spec</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-slate-400 leading-relaxed">
                The client implements multivariate distance calculation in TypeScript. When deploying
                the production scikit-learn service, launch <code>uvicorn app:api --port 8000</code>.
                Target endpoint: <code>POST /api/v1/predict/anomaly</code>.
              </p>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`POST /api/v1/predict/anomaly
Payload:
{
  "temperatureC": 42.5,
  "accelX": 0.12, "accelY": 0.15, "accelZ": 1.02,
  "rpm": 1780,
  "voltageV": 12.05,
  "currentA": 1.65,
  "motorPWM": 180
}
Returns:
{
  "anomaly_score": 0.12,
  "predicted_fault": "Normal Operation",
  "confidence": 0.94,
  "features_importance": { "vibration_rms": 0.35, "temperature": 0.28 }
}`}
            </pre>
          </div>
        )}
      </div>

      {/* Footnote Warning */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span>*Isolation Forest score measures statistical divergence, not calibrated failure probability.</span>
        <span>Decision tree rules compliant with ISO 10816 & IEEE 841.</span>
      </div>
    </div>
  );
});
