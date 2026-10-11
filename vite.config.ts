import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function computeDiagnosis(sensor: any) {
  const timestamp = Date.now();
  if (sensor.mpuOK === false || sensor.mpuOK === 'false') {
    return {
      anomalyDetected: true,
      anomalyScore: 0.95,
      statusText: 'Anomaly Detected',
      predictedClass: 'Sensor Failure / Missing Data',
      confidence: 98,
      severity: 'CRITICAL',
      modelVersion: 'MotorTwin-Backend-v2.4.2',
      timestamp,
      evidenceSummary: 'Backend verified MPU-6050 sensor bus dropped or unreadable (mpuOK = false).',
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
      backendSource: 'Live Backend API (/api/v1/predict/anomaly)',
    };
  }

  const ax = Number(sensor.accelX || 0);
  const ay = Number(sensor.accelY || 0);
  const az = Number(sensor.accelZ !== undefined ? sensor.accelZ : 1.0);
  const vibG = Math.sqrt(ax * ax + ay * ay + az * az);
  const temp = Number(sensor.temperatureC || 0);
  const rpm = Number(sensor.rpm || 0);
  const curr = Number(sensor.currentA || 0);
  const volt = Number(sensor.voltageV || 12.0);
  const pwm = Number(sensor.motorPWM || 0);
  const running = Boolean(sensor.motorRunning);

  const norms: Record<string, { mean: number; std: number; min: number; max: number; unit: string }> = {
    vib: { mean: 0.35, std: 0.18, min: 0.05, max: 1.80, unit: 'g' },
    temp: { mean: 42.0, std: 6.0, min: 20.0, max: 70.0, unit: '°C' },
    rpm: { mean: 1750.0, std: 80.0, min: 800.0, max: 3200.0, unit: 'RPM' },
    curr: { mean: 1.60, std: 0.45, min: 0.20, max: 3.80, unit: 'A' },
    volt: { mean: 12.0, std: 0.4, min: 10.8, max: 13.8, unit: 'V' },
  };

  const makeFeat = (name: string, val: number, cfg: any) => {
    const diff = val - cfg.mean;
    const div = Number(((diff / cfg.mean) * 100).toFixed(1));
    const z = Math.abs(diff / cfg.std);
    return {
      feature: name,
      measuredValue: Number(val.toFixed(2)),
      unit: cfg.unit,
      nominalRange: [cfg.min, cfg.max],
      divergencePercent: div,
      isOutlier: val < cfg.min || val > cfg.max,
      weight: Number(Math.min(1.0, z / 3.0).toFixed(2)),
    };
  };

  const features = [
    makeFeat('Vibration Magnitude', vibG, norms.vib),
    makeFeat('Stator Temperature', temp, norms.temp),
    makeFeat('Rotor Speed', rpm, norms.rpm),
    makeFeat('Phase Current', curr, norms.curr),
    makeFeat('Supply Voltage', volt, norms.volt),
  ].sort((a, b) => Math.abs(b.divergencePercent) - Math.abs(a.divergencePercent));

  const zScores = [
    Math.abs((vibG - norms.vib.mean) / norms.vib.std),
    Math.abs((temp - norms.temp.mean) / norms.temp.std),
    running ? Math.abs((rpm - norms.rpm.mean) / norms.rpm.std) : 0,
    Math.abs((curr - norms.curr.mean) / norms.curr.std),
    Math.abs((volt - norms.volt.mean) / norms.volt.std),
  ];
  const rawDist = Math.sqrt(zScores.reduce((a, z) => a + z * z, 0) / zScores.length);
  const anomalyScore = Number((1 / (1 + Math.exp(-1.3 * (rawDist - 2.0)))).toFixed(3));

  let predictedClass = 'Normal Operation';
  let severity: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
  let confidence = 94;
  let evidenceSummary = 'All mechanical and electrical parameters operate within calibrated baseline envelope.';
  let possibleCauses = ['Nominal continuous industrial runtime conditions.'];
  let recommendedActions = ['Maintain standard routine preventive maintenance inspection cycle.'];
  let affectedComponent: any = 'none';

  if (running && pwm > 40 && rpm < 120 && curr > 2.8) {
    predictedClass = 'Possible Stall';
    severity = 'CRITICAL';
    confidence = 95;
    evidenceSummary = `Backend ML: Commanded speed at PWM ${pwm} with elevated current (${curr.toFixed(2)}A) but locked rotor at ${rpm} RPM.`;
    possibleCauses = ['Mechanical rotor lockup or shaft jam', 'Coupling seizure or driven load jam', 'Severe bearing cage breakdown'];
    recommendedActions = ['De-energize motor supply immediately', 'Manually rotate shaft to check for binding', 'Inspect driven gearbox'];
    affectedComponent = 'rotor_shaft';
  } else if (temp >= 70.0) {
    predictedClass = 'Overtemperature';
    severity = temp >= 85.0 ? 'CRITICAL' : 'WARNING';
    confidence = Math.min(97, Math.round(75 + (temp - 70) * 1.5));
    evidenceSummary = `Backend ML: Stator core temperature (${temp.toFixed(1)}°C) exceeds Class B limit (70.0°C).`;
    possibleCauses = ['Clogged cooling cowl', 'Sustained electrical overload', 'Degraded winding insulation'];
    recommendedActions = ['Clear intake airflow passages', 'Verify phase current against nameplate FLA', 'Perform thermal scan'];
    affectedComponent = 'stator';
  } else if (vibG >= 1.8) {
    predictedClass = 'Abnormal Vibration';
    severity = vibG >= 3.2 ? 'CRITICAL' : 'WARNING';
    confidence = Math.min(96, Math.round(78 + (vibG - 1.8) * 10));
    evidenceSummary = `Backend ML: Vibration magnitude reached ${vibG.toFixed(2)}g, exceeding ISO 10816 Zone B limit.`;
    possibleCauses = ['Rotor unbalance or misalignment at coupling', 'Drive-end bearing race pitting', 'Loose mounting bolts'];
    recommendedActions = ['Conduct vibration FFT spectral analysis', 'Check foundation foot bolt torque', 'Inspect shaft coupling'];
    affectedComponent = 'drive_bearing';
  } else if (curr >= 3.8) {
    predictedClass = 'Overcurrent';
    severity = curr >= 5.0 ? 'CRITICAL' : 'WARNING';
    confidence = 91;
    evidenceSummary = `Backend ML: Continuous current (${curr.toFixed(2)}A) exceeds continuous rating (3.80A).`;
    possibleCauses = ['Driven mechanical load overload', 'Phase winding partial short', 'Low supply line voltage'];
    recommendedActions = ['Measure winding resistance balance across phases', 'Perform Megger 500V DC insulation test'];
    affectedComponent = 'stator';
  } else if (volt < 10.8 || volt > 13.8) {
    predictedClass = 'Abnormal Supply Voltage';
    severity = volt < 9.5 || volt > 15.0 ? 'CRITICAL' : 'WARNING';
    confidence = 90;
    evidenceSummary = `Backend ML: Supply voltage measured at ${volt.toFixed(2)}V (diverging from 12.0V nominal).`;
    possibleCauses = ['DC power supply regulation drift', 'High contact resistance on terminal screws', 'Line harmonic distortion'];
    recommendedActions = ['Measure voltage directly at motor terminal box', 'Check terminal screw torque'];
    affectedComponent = 'terminal_box';
  } else if (anomalyScore >= 0.65) {
    predictedClass = 'Unknown Anomaly';
    severity = 'WARNING';
    confidence = Math.round(anomalyScore * 100);
    evidenceSummary = `Backend ML: Multivariate distance score (${anomalyScore.toFixed(3)}) indicates unusual correlation divergence.`;
    possibleCauses = ['Transitory electromechanical transient', 'Sensor plate resonance', 'PWM switching noise'];
    recommendedActions = ['Monitor trend telemetry over next 15-30 minutes', 'Check shielding on sensor cable'];
    affectedComponent = 'general';
  }

  const anomalyDetected = severity !== 'NOMINAL';
  const statusText = anomalyDetected ? 'Anomaly Detected' : 'Normal Pattern';

  return {
    anomalyDetected,
    anomalyScore,
    statusText,
    predictedClass,
    confidence,
    severity,
    modelVersion: 'MotorTwin-Backend-v2.4.2',
    timestamp,
    evidenceSummary,
    possibleCauses,
    recommendedActions,
    featureContributions: features,
    affectedComponent,
    backendSource: 'Live Backend API (/api/v1/predict/anomaly)',
  };
}

function backendApiPlugin(): Plugin {
  return {
    name: 'motortwin-backend-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        if (url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              status: 'online',
              service: 'MotorTwin AI Live ML Backend Service',
              version: '2.4.2',
              algorithm: 'ISO 10816 + Multivariate Isolation Baseline',
              timestamp: Date.now(),
            })
          );
          return;
        }

        if (url === '/api/v1/predict/anomaly' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}');
              const result = computeDiagnosis(payload);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/fastapi': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/fastapi/, ''),
        },
      },
    },
  };
});
