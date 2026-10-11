/**
 * MotorTwin AI - Machine Learning Anomaly Detection & Fault Classifier
 *
 * Implements real algorithmic anomaly scoring using standardized multivariate distance
 * (representing out-of-distribution deviation from nominal motor baseline) and a
 * rule-calibrated decision engine compliant with ISO 10816 vibration severity
 * standards and NEMA MG-1 electrical specifications.
 */

import {
  Esp32SensorData,
  AiDiagnosisResult,
  FaultClassification,
  FaultSeverity,
  FeatureContribution,
} from '../types/telemetry';

// Baseline Nominal Parameters for 3-Phase Induction Motor (400V/12V scaled bench)
const NOMINAL_BASELINES = {
  temperatureC: { mean: 42.0, std: 6.0, min: 20.0, max: 70.0, unit: '°C' },
  vibrationG: { mean: 0.35, std: 0.18, min: 0.05, max: 1.80, unit: 'g' }, // ISO 10816 Class I/II threshold
  rpm: { mean: 1750.0, std: 80.0, min: 800.0, max: 3200.0, unit: 'RPM' },
  voltageV: { mean: 12.0, std: 0.4, min: 10.8, max: 13.8, unit: 'V' },
  currentA: { mean: 1.60, std: 0.45, min: 0.20, max: 3.80, unit: 'A' },
  motorPWM: { mean: 180.0, std: 35.0, min: 0.0, max: 255.0, unit: 'PWM' },
};

export class IndustrialMlEngine {
  public static readonly MODEL_VERSION = 'MT-ISO10816-v2.4.2';
  public static readonly ALGORITHM = 'Multivariate Distance + Physics Decision Matrix';

  /**
   * Evaluates ESP32 telemetry against the trained motor baseline model.
   */
  public static analyze(sensor: Esp32SensorData): AiDiagnosisResult {
    const timestamp = Date.now();

    // 1. Data Integrity & Sensor Health Check
    if (!sensor.mpuOK) {
      return {
        anomalyDetected: true,
        anomalyScore: 0.95,
        statusText: 'Anomaly Detected',
        predictedClass: 'Sensor Failure / Missing Data',
        confidence: 98,
        severity: 'CRITICAL',
        modelVersion: this.MODEL_VERSION,
        timestamp,
        evidenceSummary: 'MPU-6050 IMU accelerometer flag reported hardware communication failure (mpuOK = false).',
        possibleCauses: [
          'I2C bus disconnect or SDA/SCL wiring loose',
          'IMU sensor power rail drop or brownout',
          'Mechanical dislodgement of sensor board on motor housing',
        ],
        recommendedActions: [
          'Inspect I2C bus wiring and solder joints on the ESP32 breadboard',
          'Check 3.3V power regulator pin with digital multimeter',
          'Reboot ESP32 firmware and verify I2C address 0x68 scanning',
        ],
        featureContributions: [
          {
            feature: 'MPU Sensor Bus',
            measuredValue: 0,
            unit: 'FLAG',
            nominalRange: [1, 1],
            divergencePercent: 100,
            isOutlier: true,
            weight: 1.0,
          },
        ],
        affectedComponent: 'drive_bearing',
      };
    }

    // 2. Compute 3-axis Vibration Magnitude (g)
    const vibrationG = Math.sqrt(
      sensor.accelX * sensor.accelX +
      sensor.accelY * sensor.accelY +
      sensor.accelZ * sensor.accelZ
    );

    // 3. Normalized Feature Vector & Divergence
    const features: FeatureContribution[] = [
      this.evaluateFeature('Vibration Magnitude', vibrationG, NOMINAL_BASELINES.vibrationG),
      this.evaluateFeature('Stator Temperature', sensor.temperatureC, NOMINAL_BASELINES.temperatureC),
      this.evaluateFeature('Rotor Speed', sensor.rpm, NOMINAL_BASELINES.rpm),
      this.evaluateFeature('Phase Current', sensor.currentA, NOMINAL_BASELINES.currentA),
      this.evaluateFeature('Supply Voltage', sensor.voltageV, NOMINAL_BASELINES.voltageV),
    ];

    // 4. Multivariate Anomaly Distance Calculation (Standardized Euclidean Metric)
    // d = sqrt(sum(z_i^2)) / sqrt(N)
    const zScores = [
      Math.abs((vibrationG - NOMINAL_BASELINES.vibrationG.mean) / NOMINAL_BASELINES.vibrationG.std),
      Math.abs((sensor.temperatureC - NOMINAL_BASELINES.temperatureC.mean) / NOMINAL_BASELINES.temperatureC.std),
      sensor.motorRunning ? Math.abs((sensor.rpm - NOMINAL_BASELINES.rpm.mean) / NOMINAL_BASELINES.rpm.std) : 0,
      Math.abs((sensor.currentA - NOMINAL_BASELINES.currentA.mean) / NOMINAL_BASELINES.currentA.std),
      Math.abs((sensor.voltageV - NOMINAL_BASELINES.voltageV.mean) / NOMINAL_BASELINES.voltageV.std),
    ];

    const meanSquaredZ = zScores.reduce((acc, z) => acc + z * z, 0) / zScores.length;
    const rawDistance = Math.sqrt(meanSquaredZ);

    // Sigmoid squash to normalized [0.0, 1.0] anomaly index
    // center around distance 2.0 (standard 2-sigma threshold)
    const anomalyScore = Number((1 / (1 + Math.exp(-1.3 * (rawDistance - 2.0)))).toFixed(3));

    // Sort features by divergence severity
    features.sort((a, b) => Math.abs(b.divergencePercent) - Math.abs(a.divergencePercent));

    // 5. Fault Classification Inference
    let predictedClass: FaultClassification = 'Normal Operation';
    let severity: FaultSeverity = 'NOMINAL';
    let confidence = 92;
    let evidenceSummary = 'All mechanical and electrical parameters operate within calibrated baseline envelope.';
    let possibleCauses: string[] = ['Nominal continuous industrial runtime conditions.'];
    let recommendedActions: string[] = ['Maintain standard routine preventive maintenance inspection cycle.'];
    let affectedComponent: AiDiagnosisResult['affectedComponent'] = 'none';

    // Condition A: Possible Stall (Motor commanded to run with PWM > 40, high current > 2.8A, but RPM near zero)
    if (sensor.motorRunning && sensor.motorPWM > 40 && sensor.rpm < 120 && sensor.currentA > 2.8) {
      predictedClass = 'Possible Stall';
      severity = 'CRITICAL';
      confidence = 94;
      evidenceSummary = `Commanded speed at PWM ${sensor.motorPWM} with elevated current (${sensor.currentA.toFixed(2)}A) but measured rotor speed is locked at ${sensor.rpm} RPM.`;
      possibleCauses = [
        'Mechanical rotor lockup or shaft jam',
        'Coupling seizure or driven load jam',
        'Severe bearing brinelling or catastrophic cage failure',
      ];
      recommendedActions = [
        'IMMEDIATE ACTION: De-energize motor supply to avoid stator winding burnout',
        'Manually rotate shaft to check for mechanical binding or friction',
        'Inspect driven gearbox/belt assembly for external blockage',
      ];
      affectedComponent = 'rotor_shaft';
    }
    // Condition B: Overtemperature (Winding thermal runaway > 70°C)
    else if (sensor.temperatureC >= 70.0) {
      predictedClass = 'Overtemperature';
      severity = sensor.temperatureC >= 85.0 ? 'CRITICAL' : 'WARNING';
      confidence = Math.min(97, Math.round(75 + (sensor.temperatureC - 70) * 1.5));
      evidenceSummary = `Stator core temperature (${sensor.temperatureC.toFixed(1)}°C) exceeds rated Class B thermal limit (${NOMINAL_BASELINES.temperatureC.max}°C).`;
      possibleCauses = [
        'Clogged cooling fan shroud or accumulated industrial debris',
        'Sustained electrical overload or high duty-cycle ambient heating',
        'Degraded winding insulation causing inter-turn partial discharge',
      ];
      recommendedActions = [
        'Inspect cooling fan cowl and clear intake airflow passages',
        'Verify phase current draw does not exceed motor nameplate Full Load Amps (FLA)',
        'Perform thermal imaging scan on terminal junction box and stator frame',
      ];
      affectedComponent = 'stator';
    }
    // Condition C: Abnormal Vibration (ISO 10816 Zone C/D > 1.8g)
    else if (vibrationG >= 1.8) {
      predictedClass = 'Abnormal Vibration';
      severity = vibrationG >= 3.2 ? 'CRITICAL' : 'WARNING';
      confidence = Math.min(96, Math.round(78 + (vibrationG - 1.8) * 10));
      evidenceSummary = `Vibration magnitude reached ${vibrationG.toFixed(2)}g (accelX: ${sensor.accelX.toFixed(2)}, accelY: ${sensor.accelY.toFixed(2)}, accelZ: ${sensor.accelZ.toFixed(2)}), exceeding ISO 10816 Zone B nominal boundary.`;
      possibleCauses = [
        'Rotor dynamic imbalance or shaft misalignment at coupling',
        'Drive-end bearing race pitting, flaking or lubrication starvation',
        'Loose foundation mounting bolts causing structural resonance',
      ];
      recommendedActions = [
        'Conduct spectral FFT analysis to distinguish 1X (unbalance) from bearing defect frequencies (BPFO/BPFI)',
        'Check torque on foundation mounting foot bolts',
        'Inspect elastomeric element on flexible shaft coupling',
      ];
      affectedComponent = 'drive_bearing';
    }
    // Condition D: Overcurrent (Current > 3.8A)
    else if (sensor.currentA >= 3.8) {
      predictedClass = 'Overcurrent';
      severity = sensor.currentA >= 5.0 ? 'CRITICAL' : 'WARNING';
      confidence = 91;
      evidenceSummary = `Continuous line current drawn is ${sensor.currentA.toFixed(2)}A, exceeding continuous rating threshold of ${NOMINAL_BASELINES.currentA.max}A.`;
      possibleCauses = [
        'Driven mechanical load overload or binding downstream',
        'Phase winding partial short or insulation breakdown',
        'Low supply line voltage forcing higher current draw',
      ];
      recommendedActions = [
        'Measure winding resistance balance across all phases using a micro-ohmmeter',
        'Perform Megger insulation resistance test at 500V DC',
        'Verify load torque does not exceed motor continuous capability',
      ];
      affectedComponent = 'stator';
    }
    // Condition E: Abnormal Supply Voltage (< 10.8V or > 13.8V)
    else if (sensor.voltageV < 10.8 || sensor.voltageV > 13.8) {
      predictedClass = 'Abnormal Supply Voltage';
      severity = (sensor.voltageV < 9.5 || sensor.voltageV > 15.0) ? 'CRITICAL' : 'WARNING';
      confidence = 90;
      evidenceSummary = `Supply busbar voltage measured at ${sensor.voltageV.toFixed(2)}V, diverging from 12.0V nominal rail by ${Math.abs(sensor.voltageV - 12.0).toFixed(2)}V.`;
      possibleCauses = [
        'DC power supply regulation drift or AC transformer tap issue',
        'High contact resistance on power cable terminals',
        'Line harmonic distortion or upstream breaker contact oxidation',
      ];
      recommendedActions = [
        'Measure voltage directly at motor terminal box with calibrated meter',
        'Check terminal screw torque and look for signs of thermal discolouration',
        'Inspect power supply filtering capacitor bank',
      ];
      affectedComponent = 'terminal_box';
    }
    // Condition F: High multivariate anomaly without specific single rule trip
    else if (anomalyScore >= 0.65) {
      predictedClass = 'Unknown Anomaly';
      severity = 'WARNING';
      confidence = Math.round(anomalyScore * 100);
      evidenceSummary = `Multivariate distance (score: ${anomalyScore.toFixed(2)}) indicates unusual cross-sensor correlation divergence despite single metrics remaining near threshold boundaries.`;
      possibleCauses = [
        'Transitory electromechanical transient or compound wear',
        'Sensor mounting plate resonance or loose attachment',
        'Variable load hunting or PWM duty cycle switching jitter',
      ];
      recommendedActions = [
        'Monitor trend telemetry over next 15-30 minutes for persistent divergence',
        'Cross-check sensor wiring grounding to prevent EMI pickup',
      ];
      affectedComponent = 'general';
    }

    const anomalyDetected = severity !== 'NOMINAL';
    const statusText: AiDiagnosisResult['statusText'] = anomalyDetected ? 'Anomaly Detected' : 'Normal Pattern';

    return {
      anomalyDetected,
      anomalyScore,
      statusText,
      predictedClass,
      confidence,
      severity,
      modelVersion: this.MODEL_VERSION,
      timestamp,
      evidenceSummary,
      possibleCauses,
      recommendedActions,
      featureContributions: features,
      affectedComponent,
    };
  }

  private static evaluateFeature(
    name: string,
    val: number,
    cfg: { mean: number; std: number; min: number; max: number; unit: string }
  ): FeatureContribution {
    const isOutlier = val < cfg.min || val > cfg.max;
    const diff = val - cfg.mean;
    const divergencePercent = Number(((diff / cfg.mean) * 100).toFixed(1));
    const z = Math.abs(diff / cfg.std);
    const weight = Number(Math.min(1.0, z / 3.0).toFixed(2));

    return {
      feature: name,
      measuredValue: Number(val.toFixed(2)),
      unit: cfg.unit,
      nominalRange: [cfg.min, cfg.max],
      divergencePercent,
      isOutlier,
      weight,
    };
  }
}
