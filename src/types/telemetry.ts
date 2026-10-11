/**
 * Industrial Motor Digital Twin Telemetry & AI Model Types
 */

export interface Esp32SensorData {
  temperatureC: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  mpuOK: boolean;
  rpm: number;
  voltageV: number;
  currentA: number;
  soundState: number;
  motorRunning: boolean;
  motorPWM: number; // 0-255 or 0-100%
  updatedAt: number; // Unix timestamp ms
}

export type DataSourceMode = 'LIVE_ESP32' | 'SIMULATED' | 'HISTORICAL_PLAYBACK';

export type FaultSeverity = 'NOMINAL' | 'WARNING' | 'CRITICAL';

export type FaultClassification =
  | 'Normal Operation'
  | 'Abnormal Vibration'
  | 'Overtemperature'
  | 'Overcurrent'
  | 'Abnormal Supply Voltage'
  | 'Possible Stall'
  | 'Sensor Failure / Missing Data'
  | 'Unknown Anomaly';

export interface FeatureContribution {
  feature: string;
  measuredValue: number;
  unit: string;
  nominalRange: [number, number];
  divergencePercent: number; // e.g. +45% above nominal
  isOutlier: boolean;
  weight: number; // 0-1 relative importance in decision
}

export interface AiDiagnosisResult {
  anomalyDetected: boolean;
  anomalyScore: number; // 0.0 - 1.0 (Isolation Forest / Multivariate distance)
  statusText: 'Normal Pattern' | 'Anomaly Detected' | 'Insufficient Data';
  predictedClass: FaultClassification;
  confidence: number; // 0 - 100%
  severity: FaultSeverity;
  modelVersion: string;
  timestamp: number;
  evidenceSummary: string;
  possibleCauses: string[];
  recommendedActions: string[];
  featureContributions: FeatureContribution[];
  affectedComponent: 'stator' | 'rotor_shaft' | 'drive_bearing' | 'terminal_box' | 'cooling_fan' | 'general' | 'none';
  backendSource?: string;
}

export interface MotorComponentInfo {
  id: string;
  name: string;
  category: string;
  material: string;
  ratedLimit: string;
  currentStress: string;
  healthPercentage: number;
  lastInspection: string;
  notes: string;
}

export interface TelemetryHistoryPoint {
  timestamp: number;
  timeStr: string;
  temperatureC: number;
  rpm: number;
  vibrationG: number;
  voltageV: number;
  currentA: number;
  motorPWM: number;
  isAnomaly?: boolean;
}

export interface IncidentAlert {
  id: string;
  timestamp: number;
  severity: FaultSeverity;
  title: string;
  detail: string;
  sensor: string;
  acknowledged: boolean;
}
