/**
 * Industrial Firebase Realtime Database Service for ESP32 Motor Telemetry
 * Connects directly to /motor/latest at the industrial RTDB cluster via
 * clean, short-lived HTTP REST polling with AbortController timeouts to ensure
 * network idle compatibility and zero connection hangs.
 */

import { Esp32SensorData } from '../types/telemetry';

export const DEFAULT_RTDB_URL = 'https://industrialmotortwin-default-rtdb.asia-southeast1.firebasedatabase.app';
export const DEFAULT_RTDB_PATH = 'motor/latest';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'UNREACHABLE';

export interface RtdbStatus {
  state: ConnectionState;
  url: string;
  path: string;
  lastPingMs: number | null;
  lastUpdateTimestamp: number | null;
  errorMessage: string | null;
  isRealHardwareOnline: boolean;
}

class FirebaseRtdbService {
  private currentUrl: string = DEFAULT_RTDB_URL;
  private currentPath: string = DEFAULT_RTDB_PATH;
  private dataCallback: ((data: Esp32SensorData) => void) | null = null;
  private statusCallback: ((status: RtdbStatus) => void) | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private activeAbortController: AbortController | null = null;
  private lastUpdate: number | null = null;
  private currentStatus: RtdbStatus = {
    state: 'DISCONNECTED',
    url: DEFAULT_RTDB_URL,
    path: DEFAULT_RTDB_PATH,
    lastPingMs: null,
    lastUpdateTimestamp: null,
    errorMessage: null,
    isRealHardwareOnline: false,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('motortwin_rtdb_url');
      if (savedUrl) this.currentUrl = savedUrl;
    }
  }

  public getStatus(): RtdbStatus {
    return { ...this.currentStatus };
  }

  public setConfig(url: string, path: string = DEFAULT_RTDB_PATH) {
    this.currentUrl = url.trim().replace(/\/+$/, '');
    this.currentPath = path.trim().replace(/^\/+/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('motortwin_rtdb_url', this.currentUrl);
    }
    this.connect();
  }

  public onData(cb: (data: Esp32SensorData) => void) {
    this.dataCallback = cb;
  }

  public onStatusChange(cb: (status: RtdbStatus) => void) {
    this.statusCallback = cb;
  }

  private updateStatus(patch: Partial<RtdbStatus>) {
    this.currentStatus = { ...this.currentStatus, ...patch };
    if (this.statusCallback) {
      this.statusCallback({ ...this.currentStatus });
    }
  }

  public connect() {
    this.disconnect();
    this.updateStatus({ state: 'CONNECTING', errorMessage: null });

    // Initial immediate poll
    this.pollLatestData();

    // Regular polling at a calm, non-blocking 3-second cadence
    this.pollInterval = setInterval(() => {
      this.pollLatestData();
    }, 3000);

    // Periodically verify sensor data freshness (> 30s is considered stale)
    this.connectionCheckInterval = setInterval(() => {
      if (this.lastUpdate) {
        const ageMs = Date.now() - this.lastUpdate;
        const isHardwareStillOnline = ageMs < 30000;
        if (this.currentStatus.isRealHardwareOnline !== isHardwareStillOnline) {
          this.updateStatus({ isRealHardwareOnline: isHardwareStillOnline });
        }
      }
    }, 4000);
  }

  private async pollLatestData() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    const ctrl = new AbortController();
    this.activeAbortController = ctrl;
    const timeoutId = setTimeout(() => ctrl.abort(), 4000);

    const endpoint = `${this.currentUrl}/${this.currentPath}.json`;
    const t0 = performance.now();

    try {
      const res = await fetch(endpoint, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);
      const ping = Math.round(performance.now() - t0);

      if (res.ok) {
        const raw = await res.json();
        if (raw && typeof raw === 'object') {
          const parsed = this.normalizeSensorData(raw);
          this.lastUpdate = Date.now();
          this.updateStatus({
            state: 'CONNECTED',
            lastPingMs: ping,
            lastUpdateTimestamp: this.lastUpdate,
            errorMessage: null,
            isRealHardwareOnline: this.isFresh(parsed.updatedAt),
          });
          if (this.dataCallback) {
            this.dataCallback(parsed);
          }
        } else {
          this.updateStatus({
            state: 'CONNECTED',
            lastPingMs: ping,
            errorMessage: 'Node /motor/latest is empty',
            isRealHardwareOnline: false,
          });
        }
      } else {
        this.updateStatus({
          state: 'ERROR',
          errorMessage: `HTTP ${res.status}: ${res.statusText}`,
          isRealHardwareOnline: false,
        });
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (ctrl.signal.aborted) return; // intentional abort
      const msg = err instanceof Error ? err.message : String(err);
      this.updateStatus({
        state: 'UNREACHABLE',
        errorMessage: msg,
        isRealHardwareOnline: false,
      });
    } finally {
      if (this.activeAbortController === ctrl) {
        this.activeAbortController = null;
      }
    }
  }

  public disconnect() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    this.updateStatus({ state: 'DISCONNECTED', isRealHardwareOnline: false });
  }

  private isFresh(timestampMs: number | undefined): boolean {
    if (!timestampMs || timestampMs <= 0) return false;
    const now = Date.now();
    return Math.abs(now - timestampMs) < 30000;
  }

  private normalizeSensorData(raw: Record<string, unknown>): Esp32SensorData {
    return {
      temperatureC: typeof raw.temperatureC === 'number' ? raw.temperatureC : Number(raw.temperatureC ?? 0),
      accelX: typeof raw.accelX === 'number' ? raw.accelX : Number(raw.accelX ?? 0),
      accelY: typeof raw.accelY === 'number' ? raw.accelY : Number(raw.accelY ?? 0),
      accelZ: typeof raw.accelZ === 'number' ? raw.accelZ : Number(raw.accelZ ?? 1.0),
      mpuOK: raw.mpuOK === true || raw.mpuOK === 'true' || raw.mpuOK === 1,
      rpm: typeof raw.rpm === 'number' ? raw.rpm : Number(raw.rpm ?? 0),
      voltageV: typeof raw.voltageV === 'number' ? raw.voltageV : Number(raw.voltageV ?? 0),
      currentA: typeof raw.currentA === 'number' ? raw.currentA : Number(raw.currentA ?? 0),
      soundState: typeof raw.soundState === 'number' ? raw.soundState : Number(raw.soundState ?? 0),
      motorRunning: raw.motorRunning === true || raw.motorRunning === 'true' || raw.motorRunning === 1,
      motorPWM: typeof raw.motorPWM === 'number' ? raw.motorPWM : Number(raw.motorPWM ?? 0),
      updatedAt: typeof raw.updatedAt === 'number' && raw.updatedAt > 0 ? raw.updatedAt : Date.now(),
    };
  }
}

export const firebaseRtdbService = new FirebaseRtdbService();
