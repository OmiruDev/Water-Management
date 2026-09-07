import React, { useState } from 'react';
import { Database, Code, ShieldCheck, Copy, Check, FileJson, X, ExternalLink } from 'lucide-react';

interface SchemaAndFunctionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaAndFunctionsModal: React.FC<SchemaAndFunctionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'functions' | 'rules'>('schema');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const schemaContent = `{
  "collections": {
    "devices": {
      "description": "ESP32 IoT Node registry and tank status",
      "fields": {
        "deviceId": "string (PK, e.g. 'ESP32_TANK_01')",
        "deviceName": "string (e.g. 'Main Rooftop Cistern')",
        "ownerId": "string (Firebase Auth UID)",
        "ipAddress": "string",
        "firmwareVersion": "string",
        "lastHeartbeat": "timestamp",
        "status": "'online' | 'offline' | 'degraded'",
        "rssi": "number (dBm)"
      }
    },
    "telemetry_logs": {
      "description": "Time-series ultrasonic and pump electrical telemetry",
      "fields": {
        "deviceId": "string (FK -> devices)",
        "timestamp": "timestamp (Indexed DESC)",
        "waterPercentage": "number (0-100%)",
        "distance_cm": "number (TOF distance to fluid surface)",
        "waterVolumeLiters": "number (Calculated cylinder volume)",
        "pumpState": "'ON' | 'OFF'",
        "flowRateLpm": "number",
        "batteryVoltage": "number (V)",
        "temperatureC": "number"
      },
      "indices": [
        { "fields": ["deviceId", "timestamp"], "order": "DESC" }
      ]
    },
    "alerts": {
      "description": "Safety threshold trips, FCM notifications & Gemini warnings",
      "fields": {
        "id": "string",
        "deviceId": "string",
        "type": "'critical_low' | 'overflow_risk' | 'leak_detected' | 'device_offline'",
        "severity": "'critical' | 'warning' | 'info'",
        "title": "string",
        "message": "string",
        "metricValue": "string",
        "read": "boolean",
        "timestamp": "timestamp",
        "fcmMessageId": "string"
      }
    },
    "system_config": {
      "description": "Physical tank dimensions, sensor offset & pump calibration setpoints",
      "fields": {
        "deviceId": "string",
        "tankHeightCm": "number (e.g. 200)",
        "tankRadiusCm": "number (e.g. 60)",
        "sensorOffsetCm": "number (e.g. 15)",
        "pumpOnPercent": "number (Auto refill setpoint, e.g. 20%)",
        "pumpOffPercent": "number (Auto cutoff setpoint, e.g. 95%)",
        "pumpFlowRateLpm": "number (e.g. 35 L/min)",
        "pumpPowerWatts": "number (e.g. 750W)",
        "electricityCostPerKWh": "number (e.g. 0.16)",
        "autoMode": "boolean"
      }
    }
  }
}`;

  const cloudFunctionsCode = `/**
 * Firebase Cloud Functions v2 (TypeScript)
 * Integrates ESP32 Telemetry Ingestion, FCM Push Alerts, and Google AI Studio (Gemini 3.8 Flash)
 */

import { onRequest, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. ESP32 Telemetry Ingestion & Safety Alert Dispatcher
export const onTelemetryIngest = onRequest({ cors: true }, async (req, res) => {
  const { deviceId, distance_cm, waterPercentage, pumpState } = req.body;
  if (!deviceId || waterPercentage === undefined) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Persist to telemetry_logs
  await db.collection("telemetry_logs").add({
    deviceId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    waterPercentage: Number(waterPercentage),
    distance_cm: Number(distance_cm),
    pumpState: pumpState || "OFF",
  });

  // Evaluate Safety Alerts (<15% Critical Low or >95% Overflow Risk)
  if (waterPercentage <= 15) {
    await sendFCMAlert(deviceId, "Critical Low Water Level (<15%)", \`Level is at \${waterPercentage}%. Urgent refill needed!\`);
  } else if (waterPercentage >= 95) {
    await sendFCMAlert(deviceId, "Tank Overflow Hazard (>95%)", \`Water reached \${waterPercentage}%. Trip pump switch!\`);
  }

  res.status(200).json({ success: true, targetPumpState: pumpState });
});

// 2. Scheduled Gemini Anomaly & Night Leak Detection Cloud Function
export const generateDailyAnomalyReport = onSchedule("0 3 * * *", async () => {
  const logsSnap = await db.collection("telemetry_logs")
    .where("timestamp", ">=", new Date(Date.now() - 12 * 3600 * 1000))
    .orderBy("timestamp", "asc")
    .get();

  const logs = logsSnap.docs.map(d => d.data());

  const prompt = \`Analyze standby tank drawdown for leaks: \${JSON.stringify(logs)}\`;
  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
  });

  console.log("Daily Anomaly Report generated:", response.text);
});

async function sendFCMAlert(deviceId: string, title: string, body: string) {
  await messaging.send({
    topic: \`tank_\${deviceId}\`,
    notification: { title, body },
  });
}`;

  const securityRulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    match /devices/{deviceId} {
      allow read, write: if isAuthenticated();
    }

    match /telemetry_logs/{logId} {
      allow read: if isAuthenticated();
      // Validated telemetry insertion
      allow create: if request.resource.data.waterPercentage >= 0 
                    && request.resource.data.waterPercentage <= 100;
      allow update, delete: if false; // Immutable audit log
    }

    match /alerts/{alertId} {
      allow read, write: if isAuthenticated();
    }

    match /system_config/{configId} {
      allow read, write: if isAuthenticated();
    }
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950/90 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.2)]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Generated Firebase & Cloud Architecture</h3>
              <p className="text-xs text-slate-400">
                Production-ready Firestore Schemas, Cloud Functions v2, and Security Rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 bg-slate-950/60 flex items-center gap-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>1. Firestore Schema (JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('functions')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'functions'
                ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>2. Cloud Functions (TypeScript)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>3. Firestore Security Rules</span>
          </button>
        </div>

        {/* Code Content Body */}
        <div className="p-4 bg-slate-950 flex-1 overflow-y-auto font-mono text-xs text-slate-300 relative">
          <div className="absolute top-4 right-4 z-10">
            {activeTab === 'schema' && (
              <button
                type="button"
                onClick={() => handleCopy('schema', schemaContent)}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(59,130,246,0.2)] cursor-pointer"
              >
                {copied === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'schema' ? 'Copied!' : 'Copy Schema'}</span>
              </button>
            )}
            {activeTab === 'functions' && (
              <button
                type="button"
                onClick={() => handleCopy('functions', cloudFunctionsCode)}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(59,130,246,0.2)] cursor-pointer"
              >
                {copied === 'functions' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'functions' ? 'Copied!' : 'Copy Functions'}</span>
              </button>
            )}
            {activeTab === 'rules' && (
              <button
                type="button"
                onClick={() => handleCopy('rules', securityRulesCode)}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(59,130,246,0.2)] cursor-pointer"
              >
                {copied === 'rules' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'rules' ? 'Copied!' : 'Copy Rules'}</span>
              </button>
            )}
          </div>

          <pre className="whitespace-pre-wrap leading-relaxed">
            {activeTab === 'schema' && schemaContent}
            {activeTab === 'functions' && cloudFunctionsCode}
            {activeTab === 'rules' && securityRulesCode}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Files saved in repository under <code className="font-mono text-blue-400 font-semibold">/firebase/</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
