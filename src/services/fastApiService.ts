/**
 * Machine Learning Backend Integration Service
 * Configured with live production Render FastAPI microservice:
 * https://industrialmotortwin.onrender.com
 * Supports:
 * 1. LIVE_FASTAPI_RENDER (Default): Live Render Cloud FastAPI service.
 * 2. LIVE_BACKEND_API: Same-origin local /api backend.
 * 3. LIVE_FASTAPI_LOCAL: Local Python FastAPI at http://127.0.0.1:8000.
 * 4. IN_APP_ML: Client-side TypeScript statistical engine fallback.
 */

import { Esp32SensorData, AiDiagnosisResult } from '../types/telemetry';
import { IndustrialMlEngine } from './mlEngine';

export type MlEngineMode = 'LIVE_FASTAPI_RENDER' | 'LIVE_BACKEND_API' | 'LIVE_FASTAPI_LOCAL' | 'IN_APP_ML';

export interface FastApiStatus {
  mode: MlEngineMode;
  url: string;
  isOnline: boolean;
  isChecking: boolean;
  lastPingMs: number | null;
  lastCheckedTime: number | null;
  errorMessage: string | null;
  serverInfo: {
    service?: string;
    version?: string;
    algorithm?: string;
  } | null;
}

export const DEFAULT_RENDER_FASTAPI_URL = 'https://industrialmotortwin.onrender.com';
export const DEFAULT_BACKEND_API_URL = '/api';
export const DEFAULT_LOCAL_FASTAPI_URL = 'http://127.0.0.1:8000';

class FastApiService {
  private url: string = DEFAULT_RENDER_FASTAPI_URL;
  private mode: MlEngineMode = 'LIVE_FASTAPI_RENDER';
  private statusListeners: ((status: FastApiStatus) => void)[] = [];
  private currentStatus: FastApiStatus = {
    mode: 'LIVE_FASTAPI_RENDER',
    url: DEFAULT_RENDER_FASTAPI_URL,
    isOnline: true,
    isChecking: false,
    lastPingMs: null,
    lastCheckedTime: Date.now(),
    errorMessage: null,
    serverInfo: {
      service: 'MotorTwin AI FastAPI Microservice',
      version: '2.4.2',
      algorithm: 'ISO 10816 + Multivariate Isolation Baseline',
    },
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('motortwin_ml_mode') as MlEngineMode | null;
      const savedUrl = localStorage.getItem('motortwin_fastapi_url');

      // Clean up any stale localhost references from prior sessions
      if (savedUrl && (savedUrl.includes('127.0.0.1') || savedUrl.includes('localhost'))) {
        localStorage.removeItem('motortwin_fastapi_url');
        localStorage.setItem('motortwin_ml_mode', 'LIVE_FASTAPI_RENDER');
        this.url = DEFAULT_RENDER_FASTAPI_URL;
        this.mode = 'LIVE_FASTAPI_RENDER';
      } else if (savedUrl) {
        this.url = savedUrl;
        if (savedMode) this.mode = savedMode;
      } else {
        this.url = DEFAULT_RENDER_FASTAPI_URL;
        this.mode = 'LIVE_FASTAPI_RENDER';
      }

      this.currentStatus.url = this.url;
      this.currentStatus.mode = this.mode;

      // Probe live connection on startup
      setTimeout(() => this.testConnection(), 150);
    }
  }

  public getStatus(): FastApiStatus {
    return { ...this.currentStatus };
  }

  public setMode(newMode: MlEngineMode, targetUrl?: string) {
    this.mode = newMode;
    this.currentStatus.mode = newMode;

    if (newMode === 'LIVE_FASTAPI_RENDER') {
      this.url = DEFAULT_RENDER_FASTAPI_URL;
    } else if (newMode === 'LIVE_BACKEND_API') {
      this.url = DEFAULT_BACKEND_API_URL;
    } else if (newMode === 'LIVE_FASTAPI_LOCAL') {
      this.url = targetUrl || DEFAULT_LOCAL_FASTAPI_URL;
    }

    this.currentStatus.url = this.url;
    if (typeof window !== 'undefined') {
      localStorage.setItem('motortwin_ml_mode', newMode);
      localStorage.setItem('motortwin_fastapi_url', this.url);
    }
    this.notifyStatus();
    this.testConnection();
  }

  public setUrl(newUrl: string) {
    this.url = newUrl.trim().replace(/\/+$/, '');
    this.currentStatus.url = this.url;
    if (typeof window !== 'undefined') {
      localStorage.setItem('motortwin_fastapi_url', this.url);
    }
    this.notifyStatus();
  }

  public onStatusChange(listener: (status: FastApiStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener({ ...this.currentStatus });
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private notifyStatus() {
    for (const listener of this.statusListeners) {
      listener({ ...this.currentStatus });
    }
  }

  /**
   * Health check probe to the selected backend endpoint
   */
  public async testConnection(customUrl?: string): Promise<{ ok: boolean; ping: number; msg: string }> {
    const target = (customUrl || this.url).trim().replace(/\/+$/, '');
    this.currentStatus.isChecking = true;
    this.notifyStatus();

    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    const healthEndpoints = [
      `${target}/health`,
      `${target}/`,
      ...(target.includes('render.com') ? ['/render-fastapi/health', '/render-fastapi/'] : []),
    ];

    let lastError: unknown = null;

    for (const ep of healthEndpoints) {
      try {
        const res = await fetch(ep, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        const ping = Math.round(performance.now() - t0);

        if (res.ok) {
          const info = await res.json().catch(() => ({ status: 'online' }));
          this.currentStatus = {
            ...this.currentStatus,
            isOnline: true,
            isChecking: false,
            lastPingMs: ping,
            lastCheckedTime: Date.now(),
            errorMessage: null,
            serverInfo: info,
          };
          this.notifyStatus();
          return {
            ok: true,
            ping,
            msg: `FastAPI Online (${ping}ms) - ${info.service || 'Render Cloud'} v${info.version || '2.4.2'}`,
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    clearTimeout(timer);
    const ping = Math.round(performance.now() - t0);

    let msg = '';
    if (ctrl.signal.aborted) {
      msg = 'Connection timed out';
    } else if (lastError instanceof TypeError && (lastError as Error).message.includes('Failed to fetch')) {
      msg = target.startsWith('http://127.0.0.1') || target.startsWith('http://localhost')
        ? 'Browser blocked direct http://127.0.0.1 under HTTPS Mixed Content security. Use Render Cloud.'
        : 'Network or CORS unreachable. Falling back to local ML.';
    } else {
      msg = lastError instanceof Error ? lastError.message : String(lastError || 'Service unreachable');
    }

    this.currentStatus = {
      ...this.currentStatus,
      isOnline: false,
      isChecking: false,
      lastPingMs: ping,
      lastCheckedTime: Date.now(),
      errorMessage: msg,
      serverInfo: null,
    };
    this.notifyStatus();
    return { ok: false, ping, msg };
  }

  /**
   * Predicts anomaly: routes to live FastAPI service, with proxy and in-app fallback.
   */
  public async analyzeTelemetry(sensor: Esp32SensorData): Promise<AiDiagnosisResult> {
    if (this.mode === 'LIVE_FASTAPI_RENDER' || this.mode === 'LIVE_BACKEND_API' || this.mode === 'LIVE_FASTAPI_LOCAL') {
      const endpoints = [
        this.url.startsWith('http') ? `${this.url}/api/v1/predict/anomaly` : `${this.url}/v1/predict/anomaly`,
        ...(this.mode === 'LIVE_FASTAPI_RENDER' ? ['/render-fastapi/api/v1/predict/anomaly'] : []),
        '/api/v1/predict/anomaly',
      ];

      for (const endpoint of endpoints) {
        try {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 3500);

          const res = await fetch(endpoint, {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(sensor),
          });
          clearTimeout(timeout);

          if (res.ok) {
            const result: AiDiagnosisResult = await res.json();
            result.backendSource = this.url.includes('render.com')
              ? 'Render Cloud FastAPI (https://industrialmotortwin.onrender.com)'
              : result.backendSource || this.url;

            if (!this.currentStatus.isOnline) {
              this.currentStatus.isOnline = true;
              this.notifyStatus();
            }
            return result;
          }
        } catch {
          // Try next endpoint in sequence
        }
      }
    }

    // In-App TypeScript fallback
    return IndustrialMlEngine.analyze(sensor);
  }
}

export const fastApiService = new FastApiService();
