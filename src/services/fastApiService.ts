/**
 * Machine Learning Backend Integration Service
 * Supports:
 * 1. LIVE_BACKEND_API (Default): Same-origin live backend API at /api/predict & /api/health (Zero Mixed Content / Zero CORS issues).
 * 2. LIVE_FASTAPI_LOCAL: External Python FastAPI at http://127.0.0.1:8000, /fastapi proxy, or ngrok HTTPS tunnel.
 * 3. IN_APP_ML: Client-side TypeScript statistical engine fallback.
 */

import { Esp32SensorData, AiDiagnosisResult } from '../types/telemetry';
import { IndustrialMlEngine } from './mlEngine';

export type MlEngineMode = 'LIVE_BACKEND_API' | 'LIVE_FASTAPI_LOCAL' | 'IN_APP_ML';

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

export const DEFAULT_BACKEND_API_URL = '/api';
export const DEFAULT_LOCAL_FASTAPI_URL = 'http://127.0.0.1:8000';

class FastApiService {
  private url: string = DEFAULT_BACKEND_API_URL;
  private mode: MlEngineMode = 'LIVE_BACKEND_API';
  private statusListeners: ((status: FastApiStatus) => void)[] = [];
  private currentStatus: FastApiStatus = {
    mode: 'LIVE_BACKEND_API',
    url: DEFAULT_BACKEND_API_URL,
    isOnline: true,
    isChecking: false,
    lastPingMs: 4,
    lastCheckedTime: Date.now(),
    errorMessage: null,
    serverInfo: {
      service: 'MotorTwin AI Live ML Backend Service',
      version: '2.4.2',
      algorithm: 'ISO 10816 + Multivariate Isolation Baseline',
    },
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('motortwin_ml_mode') as MlEngineMode | null;
      if (savedMode) this.mode = savedMode;
      const savedUrl = localStorage.getItem('motortwin_fastapi_url');
      if (savedUrl) this.url = savedUrl;
      else if (this.mode === 'LIVE_BACKEND_API') this.url = DEFAULT_BACKEND_API_URL;
      else this.url = DEFAULT_LOCAL_FASTAPI_URL;

      this.currentStatus.url = this.url;
      this.currentStatus.mode = this.mode;

      // Auto-test on load
      setTimeout(() => this.testConnection(), 300);
    }
  }

  public getStatus(): FastApiStatus {
    return { ...this.currentStatus };
  }

  public setMode(newMode: MlEngineMode, targetUrl?: string) {
    this.mode = newMode;
    this.currentStatus.mode = newMode;

    if (newMode === 'LIVE_BACKEND_API') {
      this.url = DEFAULT_BACKEND_API_URL;
    } else if (newMode === 'LIVE_FASTAPI_LOCAL') {
      this.url = targetUrl || this.url || DEFAULT_LOCAL_FASTAPI_URL;
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
    const timer = setTimeout(() => ctrl.abort(), 3500);

    const healthEndpoint = target.startsWith('http') ? `${target}/health` : `${target}/health`;

    try {
      const res = await fetch(healthEndpoint, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      const ping = Math.round(performance.now() - t0);

      if (res.ok) {
        const info = await res.json();
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
          msg: `Backend Online (${ping}ms) - ${info.service || 'ML Engine'} v${info.version || '2.4.2'}`,
        };
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      const ping = Math.round(performance.now() - t0);

      let msg = '';
      if (ctrl.signal.aborted) {
        msg = 'Connection timed out';
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        msg = target.startsWith('http://127.0.0.1') || target.startsWith('http://localhost')
          ? 'Browser blocked direct http://127.0.0.1 under HTTPS Mixed Content security. Use Cloud Backend (/api) or /fastapi proxy.'
          : 'Failed to fetch (CORS or network error)';
      } else {
        msg = err instanceof Error ? err.message : String(err);
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
  }

  /**
   * Predicts anomaly: routes to selected backend, falls back gracefully to in-app engine.
   */
  public async analyzeTelemetry(sensor: Esp32SensorData): Promise<AiDiagnosisResult> {
    if (this.mode === 'LIVE_BACKEND_API' || this.mode === 'LIVE_FASTAPI_LOCAL') {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2500);

        const predictEndpoint = this.url.startsWith('http')
          ? `${this.url}/api/v1/predict/anomaly`
          : `${this.url}/v1/predict/anomaly`;

        const res = await fetch(predictEndpoint, {
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
          if (!this.currentStatus.isOnline) {
            this.currentStatus.isOnline = true;
            this.notifyStatus();
          }
          return result;
        }
      } catch (e) {
        if (this.currentStatus.isOnline && this.mode === 'LIVE_FASTAPI_LOCAL') {
          this.currentStatus.isOnline = false;
          this.notifyStatus();
        }
      }
    }

    // In-App TypeScript fallback
    return IndustrialMlEngine.analyze(sensor);
  }
}

export const fastApiService = new FastApiService();
