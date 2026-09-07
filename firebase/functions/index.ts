/**
 * Firebase Cloud Functions for Smart Water Tank & Resource Management
 * Stack: Firebase Functions v2 (TypeScript) + Firebase Admin + Google Gen AI SDK
 */

import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * 1. Telemetry Ingestion & Real-Time Alert Triggers
 * Validates incoming sensor payload from ESP32, writes to Firestore,
 * and dispatches Firebase Cloud Messaging (FCM) notifications on safety breaches.
 */
export const onTelemetryIngest = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { deviceId, distance_cm, waterPercentage, pumpState, batteryVoltage, temperatureC } = req.body;

    if (!deviceId || waterPercentage === undefined) {
      res.status(400).json({ error: "Missing required fields: deviceId and waterPercentage" });
      return;
    }

    // Fetch device config
    const configSnap = await db.collection("system_config").doc(deviceId).get();
    const config = configSnap.data() || {
      pumpOnPercent: 20,
      pumpOffPercent: 95,
      tankHeightCm: 200,
      tankRadiusCm: 60,
      pumpFlowRateLpm: 35,
    };

    // Calculate volume: V = pi * r^2 * h / 1000
    const maxVolume = Math.round((Math.PI * Math.pow(config.tankRadiusCm, 2) * config.tankHeightCm) / 1000);
    const currentVolume = Math.round((waterPercentage / 100) * maxVolume);

    // Save to telemetry_logs
    const logRef = await db.collection("telemetry_logs").add({
      deviceId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      waterPercentage: Number(waterPercentage),
      distance_cm: Number(distance_cm || 0),
      waterVolumeLiters: currentVolume,
      pumpState: pumpState || "OFF",
      batteryVoltage: batteryVoltage || 3.95,
      temperatureC: temperatureC || 24.0,
    });

    // Update latest device heartbeat
    await db.collection("devices").doc(deviceId).set({
      lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
      status: "online",
      latestReading: {
        waterPercentage,
        distance_cm,
        pumpState,
        waterVolumeLiters: currentVolume,
      },
    }, { merge: true });

    // Safety Alert Checks (<15% Critical Low or >95% Overflow Risk)
    if (waterPercentage <= 15) {
      await triggerPushAlert(deviceId, {
        type: "critical_low",
        severity: "critical",
        title: "Critical Low Water Level (<15%)",
        body: `Tank level dropped to ${waterPercentage}%. Urgent refill required!`,
        metricValue: `${waterPercentage}%`,
      });
    } else if (waterPercentage >= 95) {
      await triggerPushAlert(deviceId, {
        type: "overflow_risk",
        severity: "warning",
        title: "Tank Overflow Warning (>95%)",
        body: `Water reached ${waterPercentage}%. Verifying pump auto-shutoff.`,
        metricValue: `${waterPercentage}%`,
      });
    }

    // Determine target pump state
    let targetPumpState = pumpState;
    if (config.autoMode) {
      if (waterPercentage <= config.pumpOnPercent) {
        targetPumpState = "ON";
      } else if (waterPercentage >= config.pumpOffPercent) {
        targetPumpState = "OFF";
      }
    }

    res.status(200).json({
      success: true,
      logId: logRef.id,
      targetPumpState,
    });
  } catch (error: any) {
    console.error("Telemetry ingestion failed:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to send Firebase Cloud Messaging (FCM) Push Notifications
 */
async function triggerPushAlert(
  deviceId: string,
  alert: { type: string; severity: string; title: string; body: string; metricValue?: string }
) {
  // 1. Record alert in Firestore
  const alertRef = await db.collection("alerts").add({
    deviceId,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.body,
    metricValue: alert.metricValue || null,
    read: false,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Broadcast via Firebase Cloud Messaging topic
  try {
    const message: admin.messaging.Message = {
      topic: `tank_${deviceId}`,
      notification: {
        title: alert.title,
        body: alert.body,
      },
      data: {
        alertId: alertRef.id,
        deviceId,
        severity: alert.severity,
      },
    };
    await messaging.send(message);
  } catch (fcmError) {
    console.error("FCM broadcast error:", fcmError);
  }
}

/**
 * 2. Scheduled Gemini Anomaly & Leak Detection Cloud Function
 * Runs every night at 3:00 AM to inspect standby drop rates (when pump is OFF)
 * and analyze potential pipe leaks or abnormal consumption spikes.
 */
export const generateDailyAnomalyReport = onSchedule("0 3 * * *", async (event) => {
  const devicesSnap = await db.collection("devices").get();

  for (const doc of devicesSnap.docs) {
    const deviceId = doc.id;
    
    // Fetch last 12 hours of telemetry logs
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000);
    const logsSnap = await db.collection("telemetry_logs")
      .where("deviceId", "==", deviceId)
      .where("timestamp", ">=", twelveHoursAgo)
      .orderBy("timestamp", "asc")
      .get();

    const logs = logsSnap.docs.map(d => d.data());

    if (logs.length < 5) continue;

    // Send telemetry context to Google AI Studio Gemini API
    const prompt = `You are an industrial fluid IoT diagnostic AI.
Analyze the following night telemetry stream for device "${deviceId}":
${JSON.stringify(logs, null, 2)}

Look specifically for nighttime continuous water level drops while the pump is OFF.
Output valid JSON in this exact structure:
{
  "leakDetected": boolean,
  "confidenceScore": number (0-100),
  "estimatedLossRateLph": number,
  "explanation": string,
  "recommendedAction": string
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const analysis = JSON.parse(response.text || "{}");

      if (analysis.leakDetected && analysis.confidenceScore > 75) {
        await triggerPushAlert(deviceId, {
          type: "leak_detected",
          severity: "critical",
          title: "Gemini AI: Suspected Pipe Leak Detected",
          body: `${analysis.explanation} Suggested action: ${analysis.recommendedAction}`,
          metricValue: `${analysis.estimatedLossRateLph} L/h`,
        });
      }
    } catch (err) {
      console.error(`AI analysis failed for ${deviceId}:`, err);
    }
  }
});

/**
 * 3. Callable Cloud Function: Natural Language Aqua Assistant
 * Interrogates Firestore telemetry in real-time and answers user queries via Gemini.
 */
export const askAquaAI = onCall(async (request) => {
  const { query, deviceId } = request.data;
  if (!query || !deviceId) {
    throw new HttpsError("invalid-argument", "Query and deviceId are required.");
  }

  // Get current device telemetry
  const deviceDoc = await db.collection("devices").doc(deviceId).get();
  const latestLogs = await db.collection("telemetry_logs")
    .where("deviceId", "==", deviceId)
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();

  const logs = latestLogs.docs.map(d => d.data());

  const prompt = `You are AquaBot, an intelligent assistant for a Smart Water Tank IoT System.
Device Status: ${JSON.stringify(deviceDoc.data())}
Recent Telemetry: ${JSON.stringify(logs)}

User Query: "${query}"
Answer clearly, citing actual numbers from the sensor state where appropriate.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
  });

  return {
    reply: response.text,
  };
});
