/**
 * Firebase Realtime Database & ESP32 Hardware Diagnostics Modal
 * Allows operators to verify RTDB connectivity, adjust endpoints, inspect raw packets, and test latency.
 */

import React, { useState } from 'react';
import {
  X,
  Database,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Cpu,
} from 'lucide-react';
import {
  firebaseRtdbService,
  RtdbStatus,
  DEFAULT_RTDB_URL,
  DEFAULT_RTDB_PATH,
} from '../services/firebaseRtdb';
import { Esp32SensorData } from '../types/telemetry';

interface FirebaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: RtdbStatus;
  latestRawData: Esp32SensorData | null;
}

export const FirebaseSettingsModal: React.FC<FirebaseSettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  latestRawData,
}) => {
  const [urlInput, setUrlInput] = useState(status.url || DEFAULT_RTDB_URL);
  const [pathInput, setPathInput] = useState(status.path || DEFAULT_RTDB_PATH);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; ping: number; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveAndReconnect = () => {
    firebaseRtdbService.setConfig(urlInput, pathInput);
  };

  const handleTestProbe = async () => {
    setIsTesting(true);
    setTestResult(null);
    const t0 = performance.now();
    try {
      const endpoint = `${urlInput.replace(/\/+$/, '')}/${pathInput.replace(/^\/+/, '')}.json`;
      const res = await fetch(endpoint);
      const ping = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          ping,
          msg: data ? 'Node reachable with valid JSON payload.' : 'Node reachable (empty/null payload).',
        });
      } else {
        setTestResult({
          ok: false,
          ping,
          msg: `HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        ping: Math.round(performance.now() - t0),
        msg: `Connection probe failed: ${e.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isConnected = status.state === 'CONNECTED';
  const isHardwareLive = status.isRealHardwareOnline;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Firebase Realtime Database & ESP32 Configuration
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Hardware pipeline and telemetry ingestion diagnostics
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Status Banners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Firebase RTDB Cluster
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500 ring-2 ring-rose-500/30'
                    }`}
                  />
                  <span className="text-sm font-semibold text-white font-mono">
                    {status.state}
                  </span>
                </div>
              </div>
              {status.lastPingMs !== null && (
                <div className="text-right font-mono text-xs text-slate-400">
                  <span className="text-cyan-400 font-semibold">{status.lastPingMs} ms</span> latency
                </div>
              )}
            </div>

            <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  ESP32 Hardware Stream
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isHardwareLive ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-amber-500 ring-2 ring-amber-500/30'
                    }`}
                  />
                  <span className="text-sm font-semibold text-white font-mono">
                    {isHardwareLive ? 'LIVE TRANSMITTING' : 'IDLE / DISCONNECTED'}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                {isHardwareLive ? (
                  <span className="text-emerald-400 font-mono">Active</span>
                ) : (
                  <span className="text-amber-400 font-mono">&gt;15s silent</span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Firebase Realtime Database URL
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="https://your-project-rtdb.firebaseio.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Sensor Telemetry Node Path
              </label>
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="motor/latest"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestProbe}
              disabled={isTesting}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Probe...' : 'Test Connection'}</span>
            </button>

            <button
              onClick={handleSaveAndReconnect}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white rounded-lg transition-colors"
            >
              Apply & Reconnect
            </button>
          </div>

          {/* Test Probe Output */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">{testResult.msg}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Roundtrip ping: {testResult.ping} ms</div>
              </div>
            </div>
          )}

          {/* Raw JSON Packet Inspector */}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Latest Ingested Payload (/motor/latest)
            </span>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto max-h-[160px]">
              {latestRawData ? JSON.stringify(latestRawData, null, 2) : 'No packet received yet.'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
