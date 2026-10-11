/**
 * Interactive Simulation Engine for Industrial Motor Digital Twin
 * Simulates physical dynamics, electrical loads, and sensor noise for fault injection.
 */

import { Esp32SensorData } from '../types/telemetry';

export type SimulationPreset =
  | 'NOMINAL_RUN'
  | 'BEARING_IMBALANCE'
  | 'STATOR_OVERHEAT'
  | 'LOCKED_ROTOR_STALL'
  | 'VOLTAGE_BROWNOUT'
  | 'SENSOR_FAULT';

export interface SimulationStateConfig {
  preset: SimulationPreset;
  motorRunning: boolean;
  targetRpm: number;
  motorPWM: number;
  temperatureC: number;
  vibrationIntensity: number; // multiplier for accel
  voltageV: number;
  currentA: number;
  soundState: number;
  mpuOK: boolean;
  accelBiasX: number;
  accelBiasY: number;
  accelBiasZ: number;
}

const DEFAULT_CONFIGS: Record<SimulationPreset, SimulationStateConfig> = {
  NOMINAL_RUN: {
    preset: 'NOMINAL_RUN',
    motorRunning: true,
    targetRpm: 1780,
    motorPWM: 190,
    temperatureC: 41.5,
    vibrationIntensity: 0.3,
    voltageV: 12.05,
    currentA: 1.55,
    soundState: 22,
    mpuOK: true,
    accelBiasX: 0.08,
    accelBiasY: 0.12,
    accelBiasZ: 0.98,
  },
  BEARING_IMBALANCE: {
    preset: 'BEARING_IMBALANCE',
    motorRunning: true,
    targetRpm: 1720,
    motorPWM: 195,
    temperatureC: 54.0,
    vibrationIntensity: 2.45,
    voltageV: 11.95,
    currentA: 2.10,
    soundState: 88,
    mpuOK: true,
    accelBiasX: 1.45,
    accelBiasY: 1.82,
    accelBiasZ: 1.15,
  },
  STATOR_OVERHEAT: {
    preset: 'STATOR_OVERHEAT',
    motorRunning: true,
    targetRpm: 1650,
    motorPWM: 210,
    temperatureC: 78.5,
    vibrationIntensity: 0.55,
    voltageV: 11.85,
    currentA: 3.40,
    soundState: 45,
    mpuOK: true,
    accelBiasX: 0.22,
    accelBiasY: 0.31,
    accelBiasZ: 1.02,
  },
  LOCKED_ROTOR_STALL: {
    preset: 'LOCKED_ROTOR_STALL',
    motorRunning: true,
    targetRpm: 0,
    motorPWM: 230,
    temperatureC: 68.0,
    vibrationIntensity: 0.15,
    voltageV: 11.10,
    currentA: 4.85,
    soundState: 62,
    mpuOK: true,
    accelBiasX: 0.05,
    accelBiasY: 0.06,
    accelBiasZ: 1.00,
  },
  VOLTAGE_BROWNOUT: {
    preset: 'VOLTAGE_BROWNOUT',
    motorRunning: true,
    targetRpm: 1150,
    motorPWM: 180,
    temperatureC: 46.0,
    vibrationIntensity: 0.60,
    voltageV: 9.60,
    currentA: 2.95,
    soundState: 35,
    mpuOK: true,
    accelBiasX: 0.25,
    accelBiasY: 0.20,
    accelBiasZ: 0.96,
  },
  SENSOR_FAULT: {
    preset: 'SENSOR_FAULT',
    motorRunning: true,
    targetRpm: 1780,
    motorPWM: 190,
    temperatureC: 42.0,
    vibrationIntensity: 0.0,
    voltageV: 12.00,
    currentA: 1.50,
    soundState: 0,
    mpuOK: false,
    accelBiasX: 0.0,
    accelBiasY: 0.0,
    accelBiasZ: 0.0,
  },
};

export class IndustrialSimulationEngine {
  private config: SimulationStateConfig = { ...DEFAULT_CONFIGS.NOMINAL_RUN };
  private currentRpm = 1780;
  private currentTemp = 41.5;
  private phase = 0;

  public setPreset(preset: SimulationPreset) {
    this.config = { ...DEFAULT_CONFIGS[preset] };
  }

  public setCustomConfig(patch: Partial<SimulationStateConfig>) {
    this.config = { ...this.config, ...patch };
  }

  public getConfig(): SimulationStateConfig {
    return { ...this.config };
  }

  public step(): Esp32SensorData {
    this.phase += 0.2;
    const cfg = this.config;

    // Smooth physics transition for RPM
    const target = cfg.motorRunning ? cfg.targetRpm : 0;
    this.currentRpm += (target - this.currentRpm) * 0.15;
    if (this.currentRpm < 5) this.currentRpm = 0;

    // Smooth thermal inertia transition
    this.currentTemp += (cfg.temperatureC - this.currentTemp) * 0.05;

    // Gaussian-like noise
    const noise = () => (Math.random() - 0.5) * 2;

    const rpmNoise = cfg.motorRunning && this.currentRpm > 0 ? noise() * 12 : 0;
    const tempNoise = noise() * 0.15;
    const voltNoise = noise() * 0.04;
    const currNoise = cfg.motorRunning ? noise() * 0.05 : 0;

    // Simulated sinusoidal motor vibration harmonics + random shock
    const vibBase = cfg.motorRunning ? Math.sin(this.phase * 3.5) * cfg.vibrationIntensity * 0.3 : 0.02;
    const shockX = (noise() * cfg.vibrationIntensity * 0.4);
    const shockY = (noise() * cfg.vibrationIntensity * 0.4);
    const shockZ = (noise() * cfg.vibrationIntensity * 0.2);

    const accelX = cfg.mpuOK ? Number((cfg.accelBiasX + vibBase + shockX).toFixed(3)) : 0;
    const accelY = cfg.mpuOK ? Number((cfg.accelBiasY + vibBase + shockY).toFixed(3)) : 0;
    const accelZ = cfg.mpuOK ? Number((cfg.accelBiasZ + shockZ).toFixed(3)) : 0;

    return {
      temperatureC: Number((this.currentTemp + tempNoise).toFixed(1)),
      accelX,
      accelY,
      accelZ,
      mpuOK: cfg.mpuOK,
      rpm: Math.max(0, Math.round(this.currentRpm + rpmNoise)),
      voltageV: Number(Math.max(0, cfg.voltageV + voltNoise).toFixed(2)),
      currentA: cfg.motorRunning ? Number(Math.max(0, cfg.currentA + currNoise).toFixed(2)) : 0.05,
      soundState: cfg.soundState,
      motorRunning: cfg.motorRunning && this.currentRpm > 10,
      motorPWM: cfg.motorPWM,
      updatedAt: Date.now(),
    };
  }
}

export const industrialSimulationEngine = new IndustrialSimulationEngine();
