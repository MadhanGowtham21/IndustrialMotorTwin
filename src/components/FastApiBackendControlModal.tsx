/**
 * Machine Learning Backend Controller & Live Status Modal
 * Handles same-origin Cloud Backend API (/api), local Python FastAPI, and in-app engine.
 */

import React, { useState } from 'react';
import {
  X,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  Zap,
  Cpu,
  ShieldCheck,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  fastApiService,
  FastApiStatus,
  DEFAULT_BACKEND_API_URL,
  DEFAULT_LOCAL_FASTAPI_URL,
} from '../services/fastApiService';

interface FastApiBackendControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: FastApiStatus;
}

export const FastApiBackendControlModal: React.FC<FastApiBackendControlModalProps> = ({
  isOpen,
  onClose,
  status,
}) => {
  const [urlInput, setUrlInput] = useState(status.url || DEFAULT_BACKEND_API_URL);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; ping: number; msg: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const startCommand = `python3 -m uvicorn backend_fastapi.main:app --host 127.0.0.1 --port 8000 --reload`;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(urlInput);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetCloudBackend = async () => {
    setUrlInput(DEFAULT_BACKEND_API_URL);
    fastApiService.setMode('LIVE_BACKEND_API', DEFAULT_BACKEND_API_URL);
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(DEFAULT_BACKEND_API_URL);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetFastApiProxy = async () => {
    const proxyUrl = '/fastapi';
    setUrlInput(proxyUrl);
    fastApiService.setMode('LIVE_FASTAPI_LOCAL', proxyUrl);
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(proxyUrl);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetCustomUrl = async () => {
    fastApiService.setUrl(urlInput);
    fastApiService.setMode('LIVE_FASTAPI_LOCAL', urlInput);
    await handleTestConnection();
  };

  const handleSetInAppMode = () => {
    fastApiService.setMode('IN_APP_ML');
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(startCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const isCloudBackend = status.mode === 'LIVE_BACKEND_API';
  const isLocalFastApi = status.mode === 'LIVE_FASTAPI_LOCAL';
  const isInApp = status.mode === 'IN_APP_ML';
  const isOnline = status.isOnline;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Machine Learning Backend Controller
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                Active Endpoint: {status.url}
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

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Active Status Banner */}
          <div className="p-4 rounded-xl border bg-slate-900/80 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Current Inference Pipeline
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline
                      ? 'bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse'
                      : 'bg-amber-400 ring-2 ring-amber-500/30'
                  }`}
                />
                <span className="text-sm font-bold font-mono text-white">
                  {isCloudBackend
                    ? 'LIVE BACKEND API (/api/v1/predict/anomaly) - ACTIVE'
                    : isLocalFastApi
                    ? isOnline
                      ? 'LOCAL PYTHON FASTAPI SERVER - LIVE'
                      : 'LOCAL FASTAPI - OFFLINE (FALLBACK ACTIVE)'
                    : 'IN-APP CLIENT ML ENGINE'}
                </span>
              </div>
            </div>

            {isOnline && status.lastPingMs !== null && (
              <div className="text-right font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-md">
                <span>Latency: {status.lastPingMs} ms</span>
              </div>
            )}
          </div>

          {/* Explanation Callout for Mixed Content */}
          <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-lg flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white">Why did direct http://127.0.0.1 fail?</span>
              <p className="text-slate-400 leading-relaxed">
                Because this application runs over secure <strong>HTTPS</strong>, web browsers block unencrypted{' '}
                <code>http://127.0.0.1:8000</code> calls due to browser Mixed Content & Private Network Access policies.
                Use the <strong>Live Backend API</strong> below (runs on the same origin without port 8000) or our same-origin <code>/fastapi</code> proxy tunnel.
              </p>
            </div>
          </div>

          {/* 3 Backend Modes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Choose Backend Mode
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Live Cloud Backend API (Recommended) */}
              <button
                onClick={handleSetCloudBackend}
                className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isCloudBackend
                    ? 'bg-cyan-950/60 border-cyan-500/90 text-white shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Live Backend API</span>
                  </div>
                  {isCloudBackend && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Zero setup required. Same-origin HTTP API at <code>/api</code>.
                </div>
              </button>

              {/* Option 2: Python FastAPI via Proxy / Tunnel */}
              <button
                onClick={handleSetFastApiProxy}
                className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isLocalFastApi && urlInput === '/fastapi'
                    ? 'bg-cyan-950/60 border-cyan-500/90 text-white shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Python Proxy Tunnel</span>
                  </div>
                  {isLocalFastApi && urlInput === '/fastapi' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Routes via <code>/fastapi</code> to local port 8000 (bypasses browser CORS).
                </div>
              </button>

              {/* Option 3: In-App Client Engine */}
              <button
                onClick={handleSetInAppMode}
                className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isInApp
                    ? 'bg-slate-800 border-slate-600 text-white shadow-lg ring-1 ring-slate-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>In-App Engine</span>
                  </div>
                  {isInApp && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Client-side ISO 10816 + Multivariate statistical distance engine.
                </div>
              </button>
            </div>
          </div>

          {/* Custom URL & Ping Test */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                API Endpoint Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="/api or /fastapi or https://your-tunnel.ngrok.app"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Pinging...' : 'Test Connection'}</span>
                </button>
                <button
                  onClick={handleSetCustomUrl}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white rounded-lg transition-colors shrink-0"
                >
                  Set Live
                </button>
              </div>
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs font-mono flex items-start gap-2.5 ${
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
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {testResult.ok
                      ? 'Real-time telemetry inference is executing successfully on the live backend.'
                      : 'Switch to Live Backend API (/api) for instant one-click verified connection.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Terminal Launch Command for Local Python */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>If running Python FastAPI locally on your laptop:</span>
              </div>
              <button
                onClick={handleCopyCommand}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
              >
                {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900 rounded border border-slate-800">
              {startCommand}
            </pre>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When running locally on port 8000, select the <strong>"Python Proxy Tunnel (/fastapi)"</strong> option above so your browser forwards requests through the app server without HTTPS Mixed Content blocks.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Backend: {isOnline ? 'Online (Connected)' : 'Fallback Active'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
