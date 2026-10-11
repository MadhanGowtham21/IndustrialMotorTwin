/**
 * Machine Learning Backend Controller & Live Status Modal
 * Configured for the live production Render FastAPI service:
 * https://industrialmotortwin.onrender.com
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
  Globe,
} from 'lucide-react';
import {
  fastApiService,
  FastApiStatus,
  DEFAULT_RENDER_FASTAPI_URL,
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
  const [urlInput, setUrlInput] = useState(status.url || DEFAULT_RENDER_FASTAPI_URL);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; ping: number; msg: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(urlInput);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetRenderCloud = async () => {
    setUrlInput(DEFAULT_RENDER_FASTAPI_URL);
    fastApiService.setMode('LIVE_FASTAPI_RENDER', DEFAULT_RENDER_FASTAPI_URL);
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(DEFAULT_RENDER_FASTAPI_URL);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetLocalBackend = async () => {
    setUrlInput(DEFAULT_BACKEND_API_URL);
    fastApiService.setMode('LIVE_BACKEND_API', DEFAULT_BACKEND_API_URL);
    setIsTesting(true);
    setTestResult(null);
    const res = await fastApiService.testConnection(DEFAULT_BACKEND_API_URL);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSetInAppMode = () => {
    fastApiService.setMode('IN_APP_ML');
  };

  const isRenderCloud = status.mode === 'LIVE_FASTAPI_RENDER';
  const isLocalBackend = status.mode === 'LIVE_BACKEND_API';
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
                Connected: {status.url}
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
                Live Inference Backend Status
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
                  {isRenderCloud
                    ? isOnline
                      ? 'RENDER CLOUD FASTAPI (LIVE & VERIFIED)'
                      : 'RENDER CLOUD (CONNECTING / RETRYING)'
                    : isLocalBackend
                    ? 'LOCAL BACKEND API (/api)'
                    : 'IN-APP CLIENT ML ENGINE'}
                </span>
              </div>
            </div>

            {isOnline && status.lastPingMs !== null && (
              <div className="text-right font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-md">
                <span>Ping: {status.lastPingMs} ms</span>
              </div>
            )}
          </div>

          {/* Render Cloud Live Service Card */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-600/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Primary Production Service (Render Cloud)</span>
              </div>
              <a
                href="https://industrialmotortwin.onrender.com/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <span>Interactive Swagger API Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Service URL:</span>
              </div>
              <button
                onClick={handleSetRenderCloud}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Set Active Live Backend</span>
              </button>
            </div>
            <div className="text-xs font-mono text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 break-all">
              https://industrialmotortwin.onrender.com
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your FastAPI microservice is live and serving predictions directly from Render over HTTPS with full CORS enabled.
            </p>
          </div>

          {/* 3 Backend Modes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Inference Mode Selection
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Render Cloud FastAPI (Primary) */}
              <button
                onClick={handleSetRenderCloud}
                className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isRenderCloud
                    ? 'bg-cyan-950/60 border-cyan-500/90 text-white shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-300">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Render Cloud</span>
                  </div>
                  {isRenderCloud && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Live FastAPI at <code>industrialmotortwin.onrender.com</code>.
                </div>
              </button>

              {/* Option 2: Local Backend API */}
              <button
                onClick={handleSetLocalBackend}
                className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isLocalBackend
                    ? 'bg-cyan-950/60 border-cyan-500/90 text-white shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Same-Origin API</span>
                  </div>
                  {isLocalBackend && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Built-in local route at <code>/api/v1/predict/anomaly</code>.
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
                  Client-side TypeScript statistical & decision matrix engine.
                </div>
              </button>
            </div>
          </div>

          {/* Custom URL & Ping Test */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Active Service URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="https://industrialmotortwin.onrender.com"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Ping'}</span>
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
                      ? 'Inference requests are streaming successfully to the live FastAPI service.'
                      : 'Ensure the endpoint is accessible and responsive.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Active: {status.url}
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
