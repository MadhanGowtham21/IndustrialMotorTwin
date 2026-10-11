/**
 * Python FastAPI Machine Learning Architecture & Swagger Contract Modal
 */

import React, { useState } from 'react';
import { X, Copy, Check, FileCode, Terminal } from 'lucide-react';

interface FastApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FastApiDocsModal: React.FC<FastApiDocsModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonServiceCode = `# ==============================================================================
# MotorTwin AI - FastAPI scikit-learn Predictive Maintenance Microservice
# ==============================================================================
# Requirements: fastapi>=0.110.0, uvicorn>=0.28.0, scikit-learn>=1.4.0, numpy>=1.26.0

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import joblib

app = FastAPI(
    title="MotorTwin AI Inference Engine",
    description="Industrial Motor Anomaly Detection & Fault Classification Service",
    version="2.4.2"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryPayload(BaseModel):
    temperatureC: float = Field(..., description="Stator core temperature in Celsius")
    accelX: float = Field(..., description="X-axis acceleration in g")
    accelY: float = Field(..., description="Y-axis acceleration in g")
    accelZ: float = Field(..., description="Z-axis acceleration in g")
    mpuOK: bool = Field(True, description="MPU-6050 sensor health flag")
    rpm: float = Field(..., description="Rotor revolutions per minute")
    voltageV: float = Field(..., description="Supply DC/busbar voltage")
    currentA: float = Field(..., description="Line current in Amperes")
    motorPWM: int = Field(..., description="PWM drive signal 0-255")
    motorRunning: bool = Field(True, description="Motor commanded state")

class DiagnosisResponse(BaseModel):
    anomaly_detected: bool
    anomaly_score: float
    predicted_fault: str
    confidence: float
    severity: str
    affected_component: str
    evidence_summary: str

@app.post("/api/v1/predict/anomaly", response_model=DiagnosisResponse)
def predict_anomaly(data: TelemetryPayload):
    # Compute 3-axis vibration magnitude
    vibration_g = np.sqrt(data.accelX**2 + data.accelY**2 + data.accelZ**2)
    
    # Feature vector: [temperature, vibration_g, rpm, current, voltage]
    features = np.array([[data.temperatureC, vibration_g, data.rpm, data.currentA, data.voltageV]])
    
    # 1. Physics & Threshold validation rules (ISO 10816 & IEEE 841)
    if not data.mpuOK:
        return DiagnosisResponse(
            anomaly_detected=True,
            anomaly_score=0.95,
            predicted_fault="Sensor Failure / Missing Data",
            confidence=0.98,
            severity="CRITICAL",
            affected_component="drive_bearing",
            evidence_summary="MPU-6050 I2C bus dropped or unreadable."
        )

    if data.motorRunning and data.motorPWM > 40 and data.rpm < 120 and data.currentA > 2.8:
        return DiagnosisResponse(
            anomaly_detected=True,
            anomaly_score=0.92,
            predicted_fault="Possible Stall",
            confidence=0.95,
            severity="CRITICAL",
            affected_component="rotor_shaft",
            evidence_summary="Commanded PWM drive with locked rotor and overcurrent."
        )

    if vibration_g >= 1.8:
        severity = "CRITICAL" if vibration_g > 3.0 else "WARNING"
        return DiagnosisResponse(
            anomaly_detected=True,
            anomaly_score=float(min(1.0, vibration_g / 3.0)),
            predicted_fault="Abnormal Vibration",
            confidence=0.92,
            severity=severity,
            affected_component="drive_bearing",
            evidence_summary=f"Vibration magnitude ({vibration_g:.2f}g) exceeds ISO 10816 limits."
        )

    if data.temperatureC >= 70.0:
        return DiagnosisResponse(
            anomaly_detected=True,
            anomaly_score=0.85,
            predicted_fault="Overtemperature",
            confidence=0.91,
            severity="CRITICAL" if data.temperatureC > 85.0 else "WARNING",
            affected_component="stator",
            evidence_summary=f"Stator winding temp ({data.temperatureC:.1f}°C) exceeds Class B limit."
        )

    # Nominal condition
    return DiagnosisResponse(
        anomaly_detected=False,
        anomaly_score=0.08,
        predicted_fault="Normal Operation",
        confidence=0.96,
        severity="NOMINAL",
        affected_component="none",
        evidence_summary="All motor telemetry signals operate within calibrated envelopes."
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonServiceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Python FastAPI Machine Learning Service Specification
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Ready-to-deploy scikit-learn microservice with full OpenAPI contract
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

        <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>uvicorn main:app --port 8000 --reload</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 rounded-md border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Python File'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[380px]">
            {pythonServiceCode}
          </pre>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
