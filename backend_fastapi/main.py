"""
MotorTwin AI - Industrial Predictive Maintenance FastAPI Microservice
Runs on http://127.0.0.1:8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import time

app = FastAPI(
    title="MotorTwin AI Inference Engine",
    description="Industrial Motor Predictive Maintenance & Anomaly Detection API",
    version="2.4.2"
)

# Enable CORS for web browser client access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryPayload(BaseModel):
    temperatureC: float = Field(..., description="Stator temperature in °C")
    accelX: float = Field(0.0, description="X-axis acceleration in g")
    accelY: float = Field(0.0, description="Y-axis acceleration in g")
    accelZ: float = Field(1.0, description="Z-axis acceleration in g")
    mpuOK: bool = Field(True, description="MPU-6050 sensor health")
    rpm: float = Field(0.0, description="Measured rotor RPM")
    voltageV: float = Field(12.0, description="DC/busbar supply voltage in V")
    currentA: float = Field(0.0, description="Line current in A")
    soundState: float = Field(0.0, description="Acoustic sensor level")
    motorRunning: bool = Field(True, description="Commanded motor running state")
    motorPWM: int = Field(0, description="PWM drive value (0-255)")
    updatedAt: int = Field(0, description="Timestamp ms")

class FeatureContribution(BaseModel):
    feature: str
    measuredValue: float
    unit: str
    nominalRange: list[float]
    divergencePercent: float
    isOutlier: bool
    weight: float

class DiagnosisResponse(BaseModel):
    anomalyDetected: bool
    anomalyScore: float
    statusText: str
    predictedClass: str
    confidence: int
    severity: str
    modelVersion: str
    timestamp: int
    evidenceSummary: str
    possibleCauses: list[str]
    recommendedActions: list[str]
    featureContributions: list[FeatureContribution]
    affectedComponent: str
    backendSource: str

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "MotorTwin AI FastAPI Microservice",
        "version": "2.4.2",
        "algorithm": "ISO 10816 + Multivariate Isolation Baseline",
        "timestamp": int(time.time() * 1000)
    }

@app.post("/api/v1/predict/anomaly", response_model=DiagnosisResponse)
def predict_anomaly(payload: TelemetryPayload):
    timestamp = int(time.time() * 1000)
    
    # 1. Sensor check
    if not payload.mpuOK:
        return DiagnosisResponse(
            anomalyDetected=True,
            anomalyScore=0.95,
            statusText="Anomaly Detected",
            predictedClass="Sensor Failure / Missing Data",
            confidence=98,
            severity="CRITICAL",
            modelVersion="FastAPI-Py3.10-v2.4.2",
            timestamp=timestamp,
            evidenceSummary="FastAPI backend verified MPU-6050 sensor bus dropped (mpuOK=False).",
            possibleCauses=[
                "I2C wiring disconnect on ESP32 breadboard",
                "Sensor power rail drop below 3.0V",
                "Mechanical vibration dislodged accelerometer"
            ],
            recommendedActions=[
                "Check I2C SDA/SCL pull-up resistors",
                "Reboot ESP32 firmware",
                "Verify sensor address 0x68 on I2C bus"
            ],
            featureContributions=[
                FeatureContribution(
                    feature="MPU Sensor Bus",
                    measuredValue=0.0,
                    unit="FLAG",
                    nominalRange=[1.0, 1.0],
                    divergencePercent=100.0,
                    isOutlier=True,
                    weight=1.0
                )
            ],
            affectedComponent="drive_bearing",
            backendSource="Live FastAPI Server (http://127.0.0.1:8000)"
        )

    # 2. Compute vibration RMS
    vib_g = float(np.sqrt(payload.accelX**2 + payload.accelY**2 + payload.accelZ**2))
    
    # 3. Baseline norms
    norms = {
        "vibrationG": {"mean": 0.35, "std": 0.18, "min": 0.05, "max": 1.80, "unit": "g"},
        "temperatureC": {"mean": 42.0, "std": 6.0, "min": 20.0, "max": 70.0, "unit": "°C"},
        "rpm": {"mean": 1750.0, "std": 80.0, "min": 800.0, "max": 3200.0, "unit": "RPM"},
        "currentA": {"mean": 1.60, "std": 0.45, "min": 0.20, "max": 3.80, "unit": "A"},
        "voltageV": {"mean": 12.0, "std": 0.4, "min": 10.8, "max": 13.8, "unit": "V"}
    }

    # Features
    features: list[FeatureContribution] = []
    
    def add_feat(name, val, key):
        cfg = norms[key]
        diff = val - cfg["mean"]
        div_pct = round((diff / cfg["mean"]) * 100, 1)
        z = abs(diff / cfg["std"])
        w = round(min(1.0, z / 3.0), 2)
        outlier = val < cfg["min"] or val > cfg["max"]
        features.append(FeatureContribution(
            feature=name,
            measuredValue=round(val, 2),
            unit=cfg["unit"],
            nominalRange=[cfg["min"], cfg["max"]],
            divergencePercent=div_pct,
            isOutlier=outlier,
            weight=w
        ))

    add_feat("Vibration Magnitude", vib_g, "vibrationG")
    add_feat("Stator Temperature", payload.temperatureC, "temperatureC")
    add_feat("Rotor Speed", payload.rpm, "rpm")
    add_feat("Line Current", payload.currentA, "currentA")
    add_feat("Supply Voltage", payload.voltageV, "voltageV")

    # Multivariate anomaly distance
    z_scores = [
        abs((vib_g - norms["vibrationG"]["mean"]) / norms["vibrationG"]["std"]),
        abs((payload.temperatureC - norms["temperatureC"]["mean"]) / norms["temperatureC"]["std"]),
        abs((payload.rpm - norms["rpm"]["mean"]) / norms["rpm"]["std"]) if payload.motorRunning else 0.0,
        abs((payload.currentA - norms["currentA"]["mean"]) / norms["currentA"]["std"]),
        abs((payload.voltageV - norms["voltageV"]["mean"]) / norms["voltageV"]["std"])
    ]
    raw_dist = float(np.sqrt(np.mean(np.square(z_scores))))
    anomaly_score = float(round(1.0 / (1.0 + np.exp(-1.3 * (raw_dist - 2.0))), 3))

    # Fault classification
    predicted_class = "Normal Operation"
    severity = "NOMINAL"
    confidence = 94
    evidence_summary = "All mechanical and electrical parameters operate within calibrated baseline envelope."
    possible_causes = ["Nominal continuous industrial runtime conditions."]
    recommended_actions = ["Maintain standard routine preventive maintenance inspection cycle."]
    affected_component = "none"

    if payload.motorRunning and payload.motorPWM > 40 and payload.rpm < 120 and payload.currentA > 2.8:
        predicted_class = "Possible Stall"
        severity = "CRITICAL"
        confidence = 96
        evidence_summary = f"FastAPI ML: Commanded speed at PWM {payload.motorPWM} with high current ({payload.currentA:.2f}A) but locked rotor ({payload.rpm:.0f} RPM)."
        possible_causes = ["Mechanical rotor lockup or shaft jam", "Driven load seizure", "Severe bearing brinelling"]
        recommended_actions = ["De-energize motor supply immediately", "Check mechanical coupling freedom", "Inspect driven gearbox"]
        affected_component = "rotor_shaft"
    elif payload.temperatureC >= 70.0:
        predicted_class = "Overtemperature"
        severity = "CRITICAL" if payload.temperatureC >= 85.0 else "WARNING"
        confidence = int(min(98, 75 + (payload.temperatureC - 70) * 1.5))
        evidence_summary = f"FastAPI ML: Stator core temp ({payload.temperatureC:.1f}°C) exceeds Class B limit (70.0°C)."
        possible_causes = ["Blocked cooling fan duct", "Sustained overload", "Winding insulation deterioration"]
        recommended_actions = ["Clear airflow passages on cowl", "Verify phase current against FLA nameplate"]
        affected_component = "stator"
    elif vib_g >= 1.8:
        predicted_class = "Abnormal Vibration"
        severity = "CRITICAL" if vib_g >= 3.2 else "WARNING"
        confidence = int(min(97, 78 + (vib_g - 1.8) * 10))
        evidence_summary = f"FastAPI ML: Vibration magnitude reached {vib_g:.2f}g, exceeding ISO 10816 Zone B limit."
        possible_causes = ["Rotor dynamic unbalance", "Drive-end bearing race flaking", "Loose foundation mounting bolts"]
        recommended_actions = ["Conduct vibration spectral FFT analysis", "Check mounting foot bolt torque"]
        affected_component = "drive_bearing"
    elif payload.currentA >= 3.8:
        predicted_class = "Overcurrent"
        severity = "CRITICAL" if payload.currentA >= 5.0 else "WARNING"
        confidence = 92
        evidence_summary = f"FastAPI ML: Line current ({payload.currentA:.2f}A) exceeds continuous rating of 3.80A."
        possible_causes = ["Driven mechanical load overload", "Stator winding turn-to-turn fault"]
        recommended_actions = ["Perform Megger 500V DC insulation test", "Measure winding resistance balance"]
        affected_component = "stator"
    elif payload.voltageV < 10.8 or payload.voltageV > 13.8:
        predicted_class = "Abnormal Supply Voltage"
        severity = "CRITICAL" if (payload.voltageV < 9.5 or payload.voltageV > 15.0) else "WARNING"
        confidence = 90
        evidence_summary = f"FastAPI ML: Supply voltage measured at {payload.voltageV:.2f}V (nominal 12.0V)."
        possible_causes = ["DC power supply regulation drift", "Loose supply terminal connection"]
        recommended_actions = ["Measure voltage at terminal box with digital multimeter", "Check terminal screw torque"]
        affected_component = "terminal_box"
    elif anomaly_score >= 0.65:
        predicted_class = "Unknown Anomaly"
        severity = "WARNING"
        confidence = int(anomaly_score * 100)
        evidence_summary = f"FastAPI ML: Multivariate distance score ({anomaly_score:.3f}) indicates out-of-distribution pattern."
        possible_causes = ["Compound electromechanical degradation", "Transitory load disturbance"]
        recommended_actions = ["Log trend telemetry and monitor closely"]
        affected_component = "general"

    anomaly_detected = severity != "NOMINAL"
    status_text = "Anomaly Detected" if anomaly_detected else "Normal Pattern"

    return DiagnosisResponse(
        anomalyDetected=anomaly_detected,
        anomalyScore=anomaly_score,
        statusText=status_text,
        predictedClass=predicted_class,
        confidence=confidence,
        severity=severity,
        modelVersion="FastAPI-Py3.10-v2.4.2",
        timestamp=timestamp,
        evidenceSummary=evidence_summary,
        possibleCauses=possible_causes,
        recommendedActions=recommended_actions,
        featureContributions=features,
        affectedComponent=affected_component,
        backendSource="Live FastAPI Server (http://127.0.0.1:8000)"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
