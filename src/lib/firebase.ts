import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User, type Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { TelemetryReading, SystemConfig, SystemAlert } from '../types';

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Custom firestore database ID from applet config
export const db: Firestore = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth: Auth = getAuth(app);

let currentUser: User | null = null;
let isAuthReady = false;
const authListeners: Array<(user: User | null) => void> = [];

// Initialize Anonymous Auth to satisfy Firestore security rules
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAuthReady = true;
  authListeners.forEach((cb) => cb(user));
});

export async function ensureAuth(): Promise<User | null> {
  if (currentUser) return currentUser;
  try {
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    return cred.user;
  } catch (err) {
    console.warn('Firebase anonymous sign-in error:', err);
    return null;
  }
}

// Auto-trigger auth on load
ensureAuth().catch(() => {});

export function onAuthStatus(callback: (user: User | null) => void): () => void {
  authListeners.push(callback);
  if (isAuthReady) {
    callback(currentUser);
  }
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

export function getFirebaseConfigInfo() {
  return {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    authDomain: firebaseConfig.authDomain,
  };
}

/**
 * Sync telemetry document in Firestore: `devices/{deviceId}`
 */
export async function syncTelemetryToFirestore(reading: TelemetryReading, isOnline: boolean): Promise<void> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'devices', reading.deviceId);
    await setDoc(docRef, {
      ...reading,
      isOnline,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Also push to time-series `telemetry_logs`
    const logsRef = collection(db, 'telemetry_logs');
    await setDoc(doc(logsRef), {
      deviceId: reading.deviceId,
      waterPercentage: reading.waterPercentage,
      waterVolumeLiters: reading.waterVolumeLiters,
      distance_cm: reading.distance_cm,
      pumpState: reading.pumpState,
      batteryVoltage: reading.batteryVoltage,
      rssi: reading.rssi,
      timestamp: reading.timestamp || new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore telemetry write failed (offline or permission):', err);
  }
}

/**
 * Subscribe to real-time telemetry from Firestore
 */
export function subscribeToFirestoreTelemetry(
  deviceId: string,
  onData: (reading: Partial<TelemetryReading>, isOnline: boolean) => void
): Unsubscribe {
  const docRef = doc(db, 'devices', deviceId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      onData(data as Partial<TelemetryReading>, data.isOnline ?? true);
    }
  }, (err) => {
    console.warn('Firestore telemetry snapshot subscription error:', err);
  });
}

/**
 * Sync System Configuration: `system_config/default`
 */
export async function syncConfigToFirestore(config: SystemConfig): Promise<void> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'system_config', 'default');
    await setDoc(docRef, {
      ...config,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore config write error:', err);
  }
}

/**
 * Subscribe to Firestore System Config
 */
export function subscribeToFirestoreConfig(
  onConfig: (config: SystemConfig) => void
): Unsubscribe {
  const docRef = doc(db, 'system_config', 'default');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as SystemConfig;
      onConfig(data);
    }
  }, (err) => {
    console.warn('Firestore config subscription error:', err);
  });
}

/**
 * Sync Alert to Firestore: `alerts/{alertId}`
 */
export async function syncAlertToFirestore(alert: SystemAlert): Promise<void> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'alerts', alert.id);
    await setDoc(docRef, {
      ...alert,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore alert sync error:', err);
  }
}

/**
 * Acknowledge alert in Firestore
 */
export async function acknowledgeFirestoreAlert(alertId: string): Promise<void> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'alerts', alertId);
    await updateDoc(docRef, {
      read: true,
      acknowledgedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore alert acknowledge error:', err);
  }
}

/**
 * Clear all alerts in Firestore
 */
export async function clearFirestoreAlerts(): Promise<void> {
  try {
    await ensureAuth();
    const colRef = collection(db, 'alerts');
    const snap = await getDocs(colRef);
    const deletes = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);
  } catch (err) {
    console.warn('Firestore clear alerts error:', err);
  }
}

/**
 * Subscribe to real-time alerts in Firestore
 */
export function subscribeToFirestoreAlerts(
  onAlerts: (alerts: SystemAlert[]) => void
): Unsubscribe {
  const colRef = collection(db, 'alerts');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const list: SystemAlert[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as SystemAlert);
    });
    if (list.length > 0) {
      onAlerts(list);
    }
  }, (err) => {
    console.warn('Firestore alerts subscription error:', err);
  });
}
