import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type { 
  TelemetryReading, 
  HistoricalDataPoint, 
  SystemConfig, 
  SystemAlert,
  AILeakAnalysis,
  AIPrediction
} from './src/types';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json());

// --- In-Memory State & Physics Simulator ---
const defaultConfig: SystemConfig = {
  deviceId: 'ESP32_TANK_01',
  deviceName: 'Main Rooftop Cistern',
  tankHeightCm: 200,
  tankRadiusCm: 60,
  sensorOffsetCm: 15,
  pumpOnPercent: 20,
  pumpOffPercent: 95,
  pumpFlowRateLpm: 35,
  pumpPowerWatts: 750, // 0.75 kW pump
  electricityCostPerKWh: 0.16,
  autoMode: true,
  soundAlertsEnabled: true,
  pushNotificationsEnabled: true,
  leakDetectionThresholdLph: 15,
};

let currentConfig: SystemConfig = { ...defaultConfig };

// Calculate max volume from cylinder: V = pi * r^2 * h / 1000 (liters)
function calculateMaxVolume(heightCm: number, radiusCm: number): number {
  const vol = (Math.PI * Math.pow(radiusCm, 2) * heightCm) / 1000;
  return Math.round(vol);
}

let activeSimulatedLeakLph = 0; // 0 = no leak, >0 = simulated leak in L/hr
let isDeviceOnline = true;
let lastTelemetryReceivedTime = new Date().toISOString();

// Initial state
let currentTelemetry: TelemetryReading = {
  deviceId: currentConfig.deviceId,
  timestamp: new Date().toISOString(),
  waterPercentage: 68.5,
  distance_cm: Math.round(currentConfig.sensorOffsetCm + (currentConfig.tankHeightCm * (1 - 0.685))),
  waterVolumeLiters: Math.round(calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm) * 0.685),
  maxVolumeLiters: calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm),
  pumpState: 'OFF',
  flowRateLpm: 0,
  rssi: -58,
  batteryVoltage: 3.95,
  temperatureC: 24.2,
  isSimulated: true,
};

let activeAlerts: SystemAlert[] = [
  {
    id: 'alt_init_1',
    type: 'info',
    severity: 'info',
    title: 'System Initialized',
    message: 'ESP32 Telemetry monitor connected. Real-time water tracking active.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: true,
  }
];

// Generate 24h & 7d history for trends
function generateInitialHistory(): HistoricalDataPoint[] {
  const points: HistoricalDataPoint[] = [];
  const now = Date.now();
  const maxVol = currentTelemetry.maxVolumeLiters;

  // 24 points for past 24 hours
  let currentPct = 68.5;
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - i * 3600 * 1000);
    const hour = time.getHours();
    
    // Simulate typical consumption profile: higher at 7-9am and 6-9pm
    let consumption = 15;
    if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 21)) {
      consumption = 85 + Math.random() * 30;
    } else if (hour >= 1 && hour <= 5) {
      consumption = 2 + Math.random() * 5; // minimal night consumption
    } else {
      consumption = 30 + Math.random() * 20;
    }

    // Pump refill event if it dipped low
    let pumpActiveMins = 0;
    let pumpEnergy = 0;
    let pumpState: 'ON' | 'OFF' = 'OFF';

    if (currentPct < 25) {
      pumpActiveMins = 35;
      pumpEnergy = Number(((35 / 60) * (currentConfig.pumpPowerWatts / 1000)).toFixed(2));
      pumpState = 'ON';
      currentPct = Math.min(95, currentPct + 65);
    } else {
      const dropPct = (consumption / maxVol) * 100;
      currentPct = Math.max(12, currentPct - dropPct);
    }

    points.push({
      timestamp: time.toISOString(),
      label: `${hour.toString().padStart(2, '0')}:00`,
      waterPercentage: Number(currentPct.toFixed(1)),
      waterVolumeLiters: Math.round((currentPct / 100) * maxVol),
      consumptionLiters: Math.round(consumption),
      pumpMinutesActive: pumpActiveMins,
      pumpEnergyKWh: pumpEnergy,
      pumpState,
    });
  }
  return points;
}

let historyLogs: HistoricalDataPoint[] = generateInitialHistory();

// Background tick for realistic simulation updates every 3 seconds
setInterval(() => {
  if (!isDeviceOnline) return;

  const maxVol = calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm);
  currentTelemetry.maxVolumeLiters = maxVol;

  const hour = new Date().getHours();
  // Base consumption per second
  let consumptionLps = 0.02; // ~72 L/hr normal
  if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 21)) {
    consumptionLps = 0.06; // peak hours
  } else if (hour >= 1 && hour <= 5) {
    consumptionLps = 0.005; // night
  }

  // Add simulated leak if active
  if (activeSimulatedLeakLph > 0) {
    consumptionLps += activeSimulatedLeakLph / 3600;
  }

  let newVolume = currentTelemetry.waterVolumeLiters;
  let flowRate = 0;

  if (currentTelemetry.pumpState === 'ON') {
    const pumpFlowLps = currentConfig.pumpFlowRateLpm / 60;
    flowRate = currentConfig.pumpFlowRateLpm;
    newVolume += (pumpFlowLps - consumptionLps) * 3;

    // Check overflow cutoff
    const pct = (newVolume / maxVol) * 100;
    if (pct >= currentConfig.pumpOffPercent) {
      currentTelemetry.pumpState = 'OFF';
      addAlert({
        type: 'info',
        severity: 'info',
        title: 'Pump Auto-Cutoff Reached',
        message: `Tank reached target limit of ${currentConfig.pumpOffPercent}%. Pump stopped safely.`,
      });
    }
  } else {
    newVolume -= consumptionLps * 3;
    flowRate = 0;

    // Auto mode trigger
    const pct = (newVolume / maxVol) * 100;
    if (currentConfig.autoMode && pct <= currentConfig.pumpOnPercent) {
      currentTelemetry.pumpState = 'ON';
      addAlert({
        type: 'info',
        severity: 'info',
        title: 'Auto-Refill Activated',
        message: `Water level dipped below ${currentConfig.pumpOnPercent}%. Pump automatically switched ON.`,
      });
    }
  }

  // Bounds
  newVolume = Math.max(0, Math.min(maxVol, newVolume));
  const newPct = Number(((newVolume / maxVol) * 100).toFixed(1));
  const waterHeight = (newPct / 100) * currentConfig.tankHeightCm;
  const distance = Math.round(currentConfig.sensorOffsetCm + (currentConfig.tankHeightCm - waterHeight));

  currentTelemetry = {
    ...currentTelemetry,
    timestamp: new Date().toISOString(),
    waterPercentage: newPct,
    waterVolumeLiters: Math.round(newVolume),
    distance_cm: Math.max(0, distance),
    flowRateLpm: Number(flowRate.toFixed(1)),
    rssi: -55 - Math.floor(Math.random() * 6),
    temperatureC: Number((24.0 + Math.sin(Date.now() / 100000) * 1.5).toFixed(1)),
  };

  // Trigger threshold alerts
  if (newPct <= 15 && !activeAlerts.some(a => a.type === 'critical_low' && !a.read)) {
    addAlert({
      type: 'critical_low',
      severity: 'critical',
      title: 'Critical Low Water Level (<15%)',
      message: `Tank is at ${newPct}%. Immediate refill required to prevent run-dry damage!`,
      metricValue: `${newPct}%`,
    });
  }

  if (newPct >= 95 && !activeAlerts.some(a => a.type === 'overflow_risk' && !a.read)) {
    addAlert({
      type: 'overflow_risk',
      severity: 'warning',
      title: 'Tank Overflow Risk (>95%)',
      message: `Water level reached ${newPct}%. Check pump shutoff valve immediately.`,
      metricValue: `${newPct}%`,
    });
  }
}, 3000);

function addAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'read'>) {
  const newAlert: SystemAlert = {
    ...alert,
    id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  activeAlerts.unshift(newAlert);
  if (activeAlerts.length > 50) activeAlerts.pop();
}

// Lazy Gemini API Client with aistudio-build User-Agent
let genAI: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genAI) {
    genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAI;
}

// Resilient Gemini generator with retry, timeout, and model fallback for transient 503 spikes
async function generateWithGemini(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
) {
  const models = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API call timed out')), 9000)
        );
        const generatePromise = ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const is503OrUnavailable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
        const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');

        if ((is503OrUnavailable || isRateLimit) && attempt === 0) {
          // Brief pause before retry on transient surge
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break; // try fallback model
      }
    }
  }
  throw lastError;
}

// Deterministic telemetry calculations for leak analysis
function getDeterministicLeakAnalysis(): AILeakAnalysis {
  const isLeaking = activeSimulatedLeakLph > 0 || (currentTelemetry.pumpState === 'OFF' && activeSimulatedLeakLph > 10);
  return {
    leakDetected: isLeaking,
    confidenceScore: isLeaking ? 94 : 12,
    estimatedLossRateLph: isLeaking ? activeSimulatedLeakLph : 0,
    dropRatePercentPerHr: isLeaking ? Number(((activeSimulatedLeakLph / currentTelemetry.maxVolumeLiters) * 100).toFixed(2)) : 0.4,
    severity: isLeaking ? (activeSimulatedLeakLph > 30 ? 'critical' : 'moderate') : 'none',
    explanation: isLeaking
      ? `Telemetry analysis flagged a sustained drop rate of ${activeSimulatedLeakLph} L/h during standby periods while the pump was OFF. Pattern matches an underground pipe breach or faulty float valve.`
      : `Standby telemetry reveals nominal pressure retention. Drop rate of ~0.4%/hr aligns with normal static evaporation and standby line pressure.`,
    recommendedAction: isLeaking
      ? `Isolate the downstream distribution manifold and inspect the perimeter float valve and pump check-valve immediately.`
      : `No action required. System pressure and tank integrity are fully nominal.`,
    timestamp: new Date().toISOString(),
  };
}

// Deterministic calculations for predictive water & energy forecast
function getDeterministicForecast(): AIPrediction {
  const currentVol = currentTelemetry.waterVolumeLiters;
  const maxVol = currentTelemetry.maxVolumeLiters;
  const avgDailyCons = 550; // Litres
  const hourlyBurn = avgDailyCons / 24;
  const approxHoursLeft = currentVol > 0 ? Number((currentVol / hourlyBurn).toFixed(1)) : 0;
  const dryDate = new Date(Date.now() + approxHoursLeft * 3600 * 1000);

  return {
    hoursUntilDry: approxHoursLeft,
    predictedDryTimestamp: dryDate.toISOString(),
    suggestedRefillTime: '04:30 AM - 06:00 AM (Off-peak electricity window)',
    peakUsageWindow: '07:30 AM - 09:15 AM & 06:45 PM - 08:30 PM',
    dailyConsumptionEstimateLiters: avgDailyCons,
    smartScheduleAdvice: 'Schedule pre-dawn automated refill to capitalize on off-peak electricity tariffs and minimize municipal pressure fluctuations.',
    efficiencyScore: 88,
    insights: [
      `Current reserves will sustain normal household demand for approximately ${Math.floor(approxHoursLeft)} hours.`,
      `Refill trigger recommended before tank level falls under 20% (${Math.round(maxVol * 0.2)} L).`,
      `Running the pump between 4:00 AM - 6:00 AM avoids midday peak electricity surcharges and reduces evaporation loss.`,
    ],
  };
}

// Deterministic assistant knowledge replies
function getDeterministicChatReply(message: string, currentSystemState: any): string {
  const lower = message.toLowerCase();
  if (lower.includes('how much water') || lower.includes('usage') || lower.includes('use')) {
    return `Today your household consumed approximately ${currentSystemState.last24hConsumption}. The tank currently holds ${currentSystemState.waterVolume} (${currentSystemState.waterPercentage} capacity).`;
  }
  if (lower.includes('pump') || lower.includes('behaving') || lower.includes('motor')) {
    return `The pump is currently **${currentSystemState.pumpStatus}**. Over the last 24 hours, it has logged ${currentSystemState.pumpTotalRuntimeMinutes} minutes of active run-time, consuming ~${((currentSystemState.pumpTotalRuntimeMinutes / 60) * (currentConfig.pumpPowerWatts / 1000)).toFixed(2)} kWh. All mechanical parameters are nominal.`;
  }
  if (lower.includes('leak')) {
    if (activeSimulatedLeakLph > 0) {
      return `⚠️ Anomaly detected! Active loss rate of ${activeSimulatedLeakLph} L/h recorded during pump standby. We advise checking the main intake valve.`;
    }
    return `No leaks detected! Standby water drop rates are fully within normal parameters (< 0.5% / hour).`;
  }
  if (lower.includes('refill') || lower.includes('when') || lower.includes('dry')) {
    const hoursLeft = Number((currentTelemetry.waterVolumeLiters / (550 / 24)).toFixed(1));
    return `At current consumption rates, the tank has approximately **${hoursLeft} hours** of reserve remaining. We recommend triggering a refill when water levels drop below ${currentConfig.pumpOnPercent}% (~04:00 AM off-peak window).`;
  }
  return `Current Tank Telemetry: Level is at **${currentSystemState.waterPercentage}** (${currentSystemState.waterVolume}), Distance to water surface is ${currentSystemState.distanceToSurface}, Pump is **${currentSystemState.pumpStatus}**, and Hardware status is ${currentSystemState.hardwareConnection}. How else can I assist with your water management?`;
}

// --- API Endpoints ---

// 0. Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Smart Water Tank Server',
    deviceId: currentConfig.deviceId,
  });
});

// 1. Current Telemetry
app.get('/api/telemetry', (req, res) => {
  res.json({
    success: true,
    telemetry: currentTelemetry,
    isDeviceOnline,
    simulatedLeakLph: activeSimulatedLeakLph,
    lastReceived: lastTelemetryReceivedTime,
  });
});

// 2. Telemetry Ingestion from ESP32 / IoT Hardware
app.post('/api/telemetry', (req, res) => {
  try {
    const { waterPercentage, distance_cm, pumpState, deviceId, batteryVoltage, temperatureC } = req.body;
    
    if (waterPercentage === undefined && distance_cm === undefined) {
      return res.status(400).json({ error: 'Missing waterPercentage or distance_cm in payload' });
    }

    lastTelemetryReceivedTime = new Date().toISOString();
    isDeviceOnline = true;

    const maxVol = calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm);
    let pct = waterPercentage;
    if (pct === undefined && distance_cm !== undefined) {
      const waterHeight = Math.max(0, currentConfig.tankHeightCm - (distance_cm - currentConfig.sensorOffsetCm));
      pct = Math.min(100, Math.max(0, (waterHeight / currentConfig.tankHeightCm) * 100));
    }

    currentTelemetry = {
      ...currentTelemetry,
      deviceId: deviceId || currentConfig.deviceId,
      timestamp: lastTelemetryReceivedTime,
      waterPercentage: Number(pct.toFixed(1)),
      distance_cm: distance_cm ?? currentTelemetry.distance_cm,
      waterVolumeLiters: Math.round((pct / 100) * maxVol),
      maxVolumeLiters: maxVol,
      pumpState: pumpState || currentTelemetry.pumpState,
      batteryVoltage: batteryVoltage || currentTelemetry.batteryVoltage,
      temperatureC: temperatureC || currentTelemetry.temperatureC,
      isSimulated: false,
    };

    res.json({
      success: true,
      message: 'Telemetry ingested successfully',
      targetPumpState: currentTelemetry.pumpState,
      configSync: {
        tankHeightCm: currentConfig.tankHeightCm,
        pumpOnPercent: currentConfig.pumpOnPercent,
        pumpOffPercent: currentConfig.pumpOffPercent,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Historical Telemetry Logs
app.get('/api/telemetry/history', (req, res) => {
  const range = req.query.range === '7d' ? '7d' : '24h';
  if (range === '7d') {
    // Generate 7 daily aggregated points
    const sevenDays: HistoricalDataPoint[] = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const maxVol = currentTelemetry.maxVolumeLiters;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      const dayName = days[d.getDay()];
      const avgPct = 55 + Math.sin(i * 1.5) * 20;
      const dailyCons = 480 + Math.round(Math.random() * 140);
      const pumpMins = 75 + Math.round(Math.random() * 30);
      const energy = Number(((pumpMins / 60) * (currentConfig.pumpPowerWatts / 1000)).toFixed(2));

      sevenDays.push({
        timestamp: d.toISOString(),
        label: i === 0 ? 'Today' : dayName,
        waterPercentage: Number(avgPct.toFixed(1)),
        waterVolumeLiters: Math.round((avgPct / 100) * maxVol),
        consumptionLiters: dailyCons,
        pumpMinutesActive: pumpMins,
        pumpEnergyKWh: energy,
        pumpState: 'OFF',
      });
    }
    return res.json({ range: '7d', data: sevenDays });
  }

  res.json({ range: '24h', data: historyLogs });
});

// 4. Pump Control with Safety Verification
app.post('/api/pump/control', (req, res) => {
  const { state, force } = req.body;
  if (state !== 'ON' && state !== 'OFF') {
    return res.status(400).json({ error: 'State must be ON or OFF' });
  }

  // Safety validations
  if (state === 'ON') {
    if (currentTelemetry.waterPercentage >= currentConfig.pumpOffPercent && !force) {
      return res.status(400).json({ 
        error: `Safety lock: Tank is already above ${currentConfig.pumpOffPercent}%. Override requires manual confirmation to prevent overflow.` 
      });
    }
  }

  currentTelemetry.pumpState = state;
  currentTelemetry.flowRateLpm = state === 'ON' ? currentConfig.pumpFlowRateLpm : 0;

  addAlert({
    type: 'info',
    severity: 'info',
    title: `Pump Manually Switched ${state}`,
    message: `User triggered pump command: ${state}. System operating normally.`,
  });

  res.json({ success: true, pumpState: currentTelemetry.pumpState });
});

// 5. System Configuration
app.get('/api/config', (req, res) => {
  res.json({ success: true, config: currentConfig });
});

const updateConfigHandler = (req: express.Request, res: express.Response) => {
  currentConfig = { ...currentConfig, ...req.body };
  currentTelemetry.maxVolumeLiters = calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm);
  currentTelemetry.waterVolumeLiters = Math.round((currentTelemetry.waterPercentage / 100) * currentTelemetry.maxVolumeLiters);
  res.json({ success: true, config: currentConfig });
};

app.post('/api/config', updateConfigHandler);
app.put('/api/config', updateConfigHandler);

// 6. Alerts
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, alerts: activeAlerts });
});

app.post('/api/alerts/:id/ack', (req, res) => {
  const { id } = req.params;
  activeAlerts = activeAlerts.map(a => a.id === id ? { ...a, read: true } : a);
  res.json({ success: true, alerts: activeAlerts });
});

app.post('/api/alerts/clear', (req, res) => {
  activeAlerts = [];
  res.json({ success: true, alerts: [] });
});

// 7. Simulation controls
app.post('/api/simulation/toggle-leak', (req, res) => {
  const { leakRateLph } = req.body;
  activeSimulatedLeakLph = leakRateLph !== undefined ? leakRateLph : (activeSimulatedLeakLph > 0 ? 0 : 38);
  
  if (activeSimulatedLeakLph > 0) {
    addAlert({
      type: 'leak_detected',
      severity: 'warning',
      title: 'Simulated Water Leak Injected',
      message: `Active test leak of ${activeSimulatedLeakLph} L/h running on supply line.`,
      metricValue: `${activeSimulatedLeakLph} L/h`,
    });
  }

  res.json({ success: true, simulatedLeakLph: activeSimulatedLeakLph });
});

app.post('/api/simulation/toggle-device-status', (req, res) => {
  isDeviceOnline = !isDeviceOnline;
  if (!isDeviceOnline) {
    addAlert({
      type: 'device_offline',
      severity: 'critical',
      title: 'Hardware Sensor Offline',
      message: 'ESP32 IoT Node lost heartbeat. Check Wi-Fi connection and power supply.',
    });
  } else {
    addAlert({
      type: 'info',
      severity: 'info',
      title: 'Hardware Sensor Reconnected',
      message: 'ESP32 IoT Node telemetry stream restored.',
    });
  }
  res.json({ success: true, isDeviceOnline });
});

app.post('/api/simulation/reset', (req, res) => {
  activeSimulatedLeakLph = 0;
  isDeviceOnline = true;
  currentTelemetry.waterPercentage = 72;
  currentTelemetry.pumpState = 'OFF';
  currentTelemetry.flowRateLpm = 0;
  const maxVol = calculateMaxVolume(currentConfig.tankHeightCm, currentConfig.tankRadiusCm);
  currentTelemetry.waterVolumeLiters = Math.round(0.72 * maxVol);
  currentTelemetry.maxVolumeLiters = maxVol;
  historyLogs = generateInitialHistory();
  res.json({ success: true, telemetry: currentTelemetry });
});

// --- AI Layer Powered by Google AI Studio (Gemini 3.8 Flash) ---

// 8. Leak & Anomaly Detection
app.post('/api/ai/analyze-leak', async (req, res) => {
  const telemetryContext = {
    waterPercentage: currentTelemetry.waterPercentage,
    waterVolumeLiters: currentTelemetry.waterVolumeLiters,
    maxVolumeLiters: currentTelemetry.maxVolumeLiters,
    pumpState: currentTelemetry.pumpState,
    simulatedLeakLph: activeSimulatedLeakLph,
    recentTrend: historyLogs.slice(-6).map((h) => ({
      time: h.label,
      level: h.waterPercentage,
      consumedLiters: h.consumptionLiters,
      pumpState: h.pumpState,
    })),
    leakThresholdLph: currentConfig.leakDetectionThresholdLph,
  };

  const ai = getGeminiClient();

  if (!ai) {
    const fallback = getDeterministicLeakAnalysis();
    if (fallback.leakDetected) {
      addAlert({
        type: 'ai_warning',
        severity: fallback.severity === 'critical' ? 'critical' : 'warning',
        title: 'Suspected Water Leak',
        message: `${fallback.explanation} Recommended: ${fallback.recommendedAction}`,
        metricValue: `${fallback.estimatedLossRateLph} L/h`,
      });
    }
    return res.json({ success: true, analysis: fallback, mode: 'local_heuristic' });
  }

  try {
    const prompt = `You are a Smart Water Tank Telemetry AI expert analyzing IoT sensor data for leak and anomaly detection.
Analyze the following telemetry:
${JSON.stringify(telemetryContext, null, 2)}

Provide a strict JSON response matching this schema:
{
  "leakDetected": boolean,
  "confidenceScore": number (0-100),
  "estimatedLossRateLph": number,
  "dropRatePercentPerHr": number,
  "severity": "none" | "low" | "moderate" | "critical",
  "explanation": string (concise explanation of drop rates, pump state correlation, and anomalies),
  "recommendedAction": string (clear physical inspection or maintenance step)
}`;

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed: AILeakAnalysis = JSON.parse(response.text || '{}');
    parsed.timestamp = new Date().toISOString();

    if (parsed.leakDetected) {
      addAlert({
        type: 'ai_warning',
        severity: parsed.severity === 'critical' ? 'critical' : 'warning',
        title: 'Gemini AI: Suspected Water Leak',
        message: `${parsed.explanation} Recommended: ${parsed.recommendedAction}`,
        metricValue: `${parsed.estimatedLossRateLph} L/h`,
      });
    }

    return res.json({ success: true, analysis: parsed, mode: 'gemini_api' });
  } catch (err: any) {
    console.warn('Gemini leak analysis temporarily unavailable (using deterministic telemetry engine):', err?.message || err);
    // Graceful fallback prevents application failure during upstream 503 high demand spikes
    const fallback = getDeterministicLeakAnalysis();
    if (fallback.leakDetected) {
      addAlert({
        type: 'ai_warning',
        severity: fallback.severity === 'critical' ? 'critical' : 'warning',
        title: 'Telemetry Warning: Suspected Water Leak',
        message: `${fallback.explanation} Recommended: ${fallback.recommendedAction}`,
        metricValue: `${fallback.estimatedLossRateLph} L/h`,
      });
    }
    return res.json({ success: true, analysis: fallback, mode: 'deterministic_telemetry_model' });
  }
});

// 9. Predictive Refill & Run-Dry Warnings + Smart Scheduling
app.post('/api/ai/forecast', async (req, res) => {
  const ai = getGeminiClient();

  if (!ai) {
    const fallback = getDeterministicForecast();
    return res.json({ success: true, prediction: fallback, mode: 'local_heuristic' });
  }

  try {
    const currentVol = currentTelemetry.waterVolumeLiters;
    const maxVol = currentTelemetry.maxVolumeLiters;

    const prompt = `You are a Smart Water & Energy Resource Forecasting AI.
Given:
- Tank Capacity: ${maxVol} Liters
- Current Water Level: ${currentTelemetry.waterPercentage}% (${currentVol} Liters)
- Pump Flow Rate: ${currentConfig.pumpFlowRateLpm} L/min
- Pump Power: ${currentConfig.pumpPowerWatts} W
- Electricity Cost: $${currentConfig.electricityCostPerKWh} / kWh
- Recent History: ${JSON.stringify(historyLogs.slice(-12))}

Generate a predictive forecast and scheduling recommendation as a strict JSON object:
{
  "hoursUntilDry": number,
  "predictedDryTimestamp": string (ISO),
  "suggestedRefillTime": string,
  "peakUsageWindow": string,
  "dailyConsumptionEstimateLiters": number,
  "smartScheduleAdvice": string,
  "efficiencyScore": number (0-100),
  "insights": string[] (3 actionable bullet points)
}`;

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed: AIPrediction = JSON.parse(response.text || '{}');
    return res.json({ success: true, prediction: parsed, mode: 'gemini_api' });
  } catch (err: any) {
    console.warn('Gemini forecast temporarily unavailable (using deterministic prediction model):', err?.message || err);
    // Graceful fallback prevents application failure during upstream 503 high demand spikes
    const fallback = getDeterministicForecast();
    return res.json({ success: true, prediction: fallback, mode: 'deterministic_telemetry_model' });
  }
});

// 10. Natural Language Assistant Chat
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const currentSystemState = {
      device: currentConfig.deviceName,
      waterPercentage: `${currentTelemetry.waterPercentage}%`,
      waterVolume: `${currentTelemetry.waterVolumeLiters} / ${currentTelemetry.maxVolumeLiters} Liters`,
      distanceToSurface: `${currentTelemetry.distance_cm} cm`,
      pumpStatus: currentTelemetry.pumpState,
      pumpFlowRate: `${currentTelemetry.flowRateLpm} L/min`,
      simulatedLeak: activeSimulatedLeakLph > 0 ? `${activeSimulatedLeakLph} L/h` : 'None',
      hardwareConnection: isDeviceOnline ? 'Online (ESP32 via Wi-Fi)' : 'Offline',
      last24hConsumption: `${historyLogs.reduce((acc, curr) => acc + curr.consumptionLiters, 0)} Liters`,
      pumpTotalRuntimeMinutes: historyLogs.reduce((acc, curr) => acc + curr.pumpMinutesActive, 0),
    };

    const ai = getGeminiClient();

    if (!ai) {
      const reply = getDeterministicChatReply(message, currentSystemState);
      return res.json({
        success: true,
        reply,
        suggestedQuestions: [
          'How much water did we use today?',
          'Is the pump behaving normally?',
          'When will the tank run dry?',
          'Are there any leaks detected?',
        ],
      });
    }

    try {
      const systemPrompt = `You are "AquaBot", an intelligent Smart Water Tank & Resource Management Assistant integrated with an ESP32 IoT telemetry system.
Current real-time system state:
${JSON.stringify(currentSystemState, null, 2)}
System Configuration:
- Tank Height: ${currentConfig.tankHeightCm} cm
- Auto Mode: ${currentConfig.autoMode ? 'Enabled' : 'Disabled'}
- Auto Refill Threshold: ${currentConfig.pumpOnPercent}%
- Auto Cutoff: ${currentConfig.pumpOffPercent}%

Provide a concise, direct, professional answer with specific metrics. If the user asks about water usage, pump health, leaks, or scheduling, cite the exact numbers from the telemetry state.`;

      const response = await generateWithGemini(ai, {
        contents: message,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      return res.json({
        success: true,
        reply: response.text,
        suggestedQuestions: [
          'How much water did we use today?',
          'Is the pump behaving normally?',
          'When will the tank run dry?',
          'Suggest an energy-efficient refill schedule',
        ],
      });
    } catch (modelErr: any) {
      console.warn('Gemini chat temporarily unavailable (using deterministic conversational engine):', modelErr?.message || modelErr);
      const reply = getDeterministicChatReply(message, currentSystemState);
      return res.json({
        success: true,
        reply,
        suggestedQuestions: [
          'How much water did we use today?',
          'Is the pump behaving normally?',
          'When will the tank run dry?',
          'Are there any leaks detected?',
        ],
      });
    }
  } catch (err: any) {
    console.error('Fatal chat endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. ESP32 Arduino C++ Code Generator
app.get('/api/hardware/arduino-code', (req, res) => {
  const code = `/*
  Smart Water Tank & Resource Management ESP32 Node
  Hardware: ESP32 DevKit v1 + Ultrasonic Sensor (JSN-SR04T / HC-SR04) + Relay Module
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverEndpoint = "${process.env.APP_URL || 'https://your-app-domain.com'}/api/telemetry";

// Pin Configurations
#define TRIG_PIN 5
#define ECHO_PIN 18
#define RELAY_PIN 23  // Controls water pump relay

// Calibration Constants
const float TANK_HEIGHT_CM = ${currentConfig.tankHeightCm}.0;
const float SENSOR_OFFSET_CM = ${currentConfig.sensorOffsetCm}.0;
const float PUMP_ON_PERCENT = ${currentConfig.pumpOnPercent}.0;
const float PUMP_OFF_PERCENT = ${currentConfig.pumpOffPercent}.0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Pump OFF initially

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected. IP: " + WiFi.localIP().toString());
}

float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float distance = measureDistanceCm();
    if (distance > 0) {
      float waterHeight = TANK_HEIGHT_CM - (distance - SENSOR_OFFSET_CM);
      if (waterHeight < 0) waterHeight = 0;
      if (waterHeight > TANK_HEIGHT_CM) waterHeight = TANK_HEIGHT_CM;
      
      float waterPercentage = (waterHeight / TANK_HEIGHT_CM) * 100.0;
      bool pumpActive = digitalRead(RELAY_PIN) == HIGH;

      // Send Telemetry to Server
      HTTPClient http;
      http.begin(serverEndpoint);
      http.addHeader("Content-Type", "application/json");

      StaticJsonDocument<256> doc;
      doc["deviceId"] = "${currentConfig.deviceId}";
      doc["distance_cm"] = distance;
      doc["waterPercentage"] = waterPercentage;
      doc["pumpState"] = pumpActive ? "ON" : "OFF";
      doc["batteryVoltage"] = 3.95;

      String requestBody;
      serializeJson(doc, requestBody);
      int httpResponseCode = http.POST(requestBody);

      if (httpResponseCode > 0) {
        String response = http.getString();
        StaticJsonDocument<256> resDoc;
        deserializeJson(resDoc, response);
        const char* targetState = resDoc["targetPumpState"];
        if (targetState && strcmp(targetState, "ON") == 0) {
          digitalWrite(RELAY_PIN, HIGH);
        } else if (targetState && strcmp(targetState, "OFF") == 0) {
          digitalWrite(RELAY_PIN, LOW);
        }
      }
      http.end();
    }
  }
  delay(3000); // 3-second telemetry interval
}
`;
  res.type('text/plain').send(code);
});

// Start Server and mount Vite middleware
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Water Tank Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
