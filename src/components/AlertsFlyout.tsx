/**
 * Incident Alert & Anomaly Event Log Flyout
 */

import React from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle, ShieldAlert, Check } from 'lucide-react';
import { IncidentAlert } from '../types/telemetry';

interface AlertsFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: IncidentAlert[];
  onAcknowledge: (id: string) => void;
  onClearAll: () => void;
}

export const AlertsFlyout: React.FC<AlertsFlyoutProps> = ({
  isOpen,
  onClose,
  alerts,
  onAcknowledge,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#0f172a] border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Incident & Anomaly Logs</h3>
          <span className="text-xs font-mono text-slate-400">({alerts.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Strip */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/30 text-xs">
        <span className="text-slate-400">Automated SCADA Trigger</span>
        {alerts.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-slate-400 hover:text-rose-400 transition-colors text-[11px]"
          >
            Clear Log History
          </button>
        )}
      </div>

      {/* Alert Items List */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        {alerts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
            <CheckCircle className="w-8 h-8 text-emerald-500/70 mb-2" />
            <p className="text-sm font-medium text-slate-300">Zero Active Alarms</p>
            <p className="text-xs text-slate-500 mt-0.5">All monitored channels operate within nominal envelopes.</p>
          </div>
        ) : (
          alerts.map(a => {
            const isCritical = a.severity === 'CRITICAL';
            return (
              <div
                key={a.id}
                className={`p-3.5 rounded-lg border text-xs space-y-1.5 transition-all ${
                  a.acknowledged
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-60'
                    : isCritical
                    ? 'bg-rose-950/40 border-rose-800/70'
                    : 'bg-amber-950/40 border-amber-800/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    {isCritical ? (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>{a.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-slate-300 leading-snug">{a.detail}</p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                  <span className="font-mono text-slate-400">Sensor: {a.sensor}</span>
                  {!a.acknowledged ? (
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <Check className="w-3 h-3" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="text-slate-500 font-mono">ACKNOWLEDGED</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
