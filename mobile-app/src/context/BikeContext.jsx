import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { playWarningAlarmSound, stopWarningAlarmSound, sendOsNotification } from '../utils/soundAlert.js';
import { tftNavigationBridge } from '../services/tftNavigationBridge.js';

const BikeContext = createContext();

const RAW_BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
  || 'http://localhost:5000';

const BACKEND_BASE = RAW_BACKEND_URL.replace(/\/+$/, '');
const API_BASE = BACKEND_BASE.endsWith('/api') ? BACKEND_BASE : `${BACKEND_BASE}/api`;
const SOCKET_URL = BACKEND_BASE.endsWith('/api') ? BACKEND_BASE.slice(0, -4) : BACKEND_BASE;
const SIMULATOR_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SIMULATOR_URL) || 'http://localhost:5005';

export function BikeProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [motorcycle, setMotorcycle] = useState(null);
  const [status, setStatus] = useState({
    isOnline: false,
    vehicleState: 'SLEEP', // 'SLEEP' | 'WAKE' | 'RUNNING'
    ignition: false,
    lock: true,
    alarmArmed: true,
    alarmTriggered: false,
    ridingMode: 'NORMAL',
    headlight: false,
    highBeam: false,
    indicators: 'OFF',
    hazard: false,
    horn: false,
    speed: 0,
    rpm: 0,
    fuelLevel: 75,
    engineTemp: 25,
    batteryPercentage: 84,
    batteryVoltage: 12.58,
    powerMode: 'LOW_POWER_STANDBY',
    gps: { latitude: 12.9716, longitude: 77.5946, speed: 0, heading: 0, accuracy: 3.0 },
    updatedAt: new Date().toISOString(),
  });

  const [commandStates, setCommandStates] = useState({});
  const [securityEvents, setSecurityEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [theftAlert, setTheftAlert] = useState(null);
  const [securityModeActive, setSecurityModeActive] = useState(true);
  const [rides, setRides] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [speedometerSettings, setSpeedometerSettings] = useState({
    unit: 'KMH',
    theme: 'CYBER_NEON',
    brightness: 90,
  });
  const [geofence, setGeofence] = useState(null);
  const [socket, setSocket] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const lastNavPacketRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. WebSocket initialization
  useEffect(() => {
    const s = io(SOCKET_URL, { reconnectionDelay: 1000, transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => {
      console.log('[App WebSocket] Connected to Cloud Gateway');
      const devId = motorcycle?.deviceId || 'BIKE-4G-9021';
      s.emit('join_device', devId);

      // If active navigation was running before reconnect, re-send latest snapshot to ensure TFT sync
      const snapshot = tftNavigationBridge.getLatestSnapshot() || lastNavPacketRef.current;
      if (snapshot && snapshot.isNavigating && !snapshot.isDestinationReached) {
        s.emit('navigation_update', {
          ...snapshot,
          deviceId: devId,
          bikeId: motorcycle?._id,
        });
        console.log(`[TFT] SNAPSHOT SENT on reconnect: session=${snapshot.navigationSessionId} seq=${snapshot.sequence}`);
      }
    });

    s.on('status_update', (newStatus) => {
      setStatus((prev) => ({ ...prev, ...newStatus, isOnline: true }));
    });

    s.on('heartbeat', (data) => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        vehicleState: data.vehicleState || (data.ignition ? 'RUNNING' : 'SLEEP'),
        ignition: data.ignition,
        powerMode: data.powerMode,
        batteryPercentage: data.batteryPercentage,
        updatedAt: new Date().toISOString(),
      }));
    });

    s.on('live_telemetry', (telemetry) => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        vehicleState: telemetry.vehicleState || 'RUNNING',
        ignition: true,
        powerMode: 'FULL_POWER',
        speed: telemetry.speed,
        rpm: telemetry.rpm,
        engineTemp: telemetry.engineTemp,
        fuelLevel: telemetry.fuelLevel,
        gear: telemetry.gear,
        batteryPercentage: telemetry.batteryPercentage,
        headlight: telemetry.headlight,
        highBeam: telemetry.highBeam,
        indicators: telemetry.indicators,
        ridingMode: telemetry.ridingMode || prev.ridingMode,
        gps: telemetry.gps || prev.gps,
        updatedAt: new Date().toISOString(),
      }));
    });

    s.on('command_update', (cmd) => {
      console.log('[App WebSocket] Command update:', cmd);
      setCommandStates((prev) => ({
        ...prev,
        [cmd.command]: {
          state: cmd.status,
          commandId: cmd.commandId,
          details: cmd.details || cmd.errorReason,
          timestamp: Date.now(),
        },
      }));

      if (cmd.status === 'SUCCESS') {
        showToast(`${cmd.command} executed successfully`, 'success');
      } else if (cmd.status === 'FAILED' || cmd.status === 'TIMEOUT' || cmd.status === 'BIKE_OFFLINE') {
        showToast(`${cmd.command}: ${cmd.status}`, 'error');
      }
    });

    s.on('security_alert', (evt) => {
      showToast(`SECURITY ALERT: ${evt.eventType}`, 'error');
      setSecurityEvents((prev) => [evt, ...prev]);
      setTheftAlert(evt);
      playWarningAlarmSound();
      sendOsNotification(`⚠ SECURITY ALERT: ${evt.eventType}`, evt.message || 'Suspicious vehicle activity detected.');
      setStatus((prev) => ({ ...prev, theftDetected: true, alarmTriggered: true }));
    });

    return () => s.disconnect();
  }, [motorcycle?.deviceId]);

  const [destinations, setDestinations] = useState({ saved: [], recent: [] });

  // 2. Initial Auth / Data Load
  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
      fetchBikes(token);
      fetchSavedDestinations(token);
    }
  }, [token]);

  const fetchCurrentUser = async (activeToken) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken || token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) setUser(data.user);
      } else if (res.status === 401) {
        logout();
      }
    } catch (err) {
      console.warn('[App Auth] Session check notice:', err.message);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        await fetchBikes(data.token);
        await fetchSavedDestinations(data.token);
        showToast('Rider authenticated successfully', 'success');
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid credentials' };
    } catch (err) {
      return { success: false, error: err.message || 'Cannot connect to backend server on port 5000' };
    }
  };

  const register = async (name, email, password, phone) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        await fetchBikes(data.token);
        await fetchSavedDestinations(data.token);
        showToast('Rider account and motorcycle paired successfully', 'success');
        return { success: true };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err) {
      return { success: false, error: err.message || 'Cannot connect to backend server on port 5000' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setMotorcycle(null);
    setDestinations({ saved: [], recent: [] });
    showToast('Signed out of AEROVYN', 'info');
  };

  const fetchSavedDestinations = async (activeToken) => {
    try {
      const res = await fetch(`${API_BASE}/navigation/destinations`, {
        headers: { Authorization: `Bearer ${activeToken || token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDestinations({ saved: data.saved || [], recent: data.recent || [] });
      }
    } catch (err) {
      console.warn('[Navigation] Notice fetching destinations:', err.message);
    }
  };

  const saveDestination = async (destData) => {
    try {
      const res = await fetch(`${API_BASE}/navigation/destinations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(destData),
      });
      const data = await res.json();
      if (res.ok) {
        fetchSavedDestinations();
        showToast('Destination saved', 'success');
        return { success: true, destination: data.destination };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteDestination = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/navigation/destinations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchSavedDestinations();
        showToast('Destination removed', 'info');
        return { success: true };
      }
    } catch (err) {
      console.warn('[Navigation] Notice deleting destination:', err.message);
    }
  };

  const fetchBikes = async (overrideToken) => {
    const activeToken = overrideToken || token;
    try {
      const res = await fetch(`${API_BASE}/motorcycles`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (res.ok && data.motorcycles?.length > 0) {
        const bike = data.motorcycles[0];
        setMotorcycle(bike);
        fetchBikeDetails(bike._id, activeToken);
      }
    } catch (err) {
      console.error('Failed to fetch bikes:', err);
    }
  };

  const fetchBikeDetails = async (bikeId, activeToken) => {
    const authHeaders = { Authorization: `Bearer ${activeToken || token}` };
    try {
      const stRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/status`, { headers: authHeaders });
      const stData = await stRes.json();
      if (stData.status) setStatus(stData.status);

      const rdRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/rides`, { headers: authHeaders });
      const rdData = await rdRes.json();
      if (rdData.rides) setRides(rdData.rides);

      const statsRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/statistics`, { headers: authHeaders });
      const statsData = await statsRes.json();
      if (statsData.statistics) setStatistics(statsData.statistics);

      const secRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/security/events`, { headers: authHeaders });
      const secData = await secRes.json();
      if (secData.events) setSecurityEvents(secData.events);

      const setRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/speedometer-settings`, { headers: authHeaders });
      const setData = await setRes.json();
      if (setData.settings) setSpeedometerSettings(setData.settings);

      const geoRes = await fetch(`${API_BASE}/motorcycles/${bikeId}/geofence`, { headers: authHeaders });
      const geoData = await geoRes.json();
      if (geoData.geofence) setGeofence(geoData.geofence);

      const notifRes = await fetch(`${API_BASE}/notifications`, { headers: authHeaders });
      const notifData = await notifRes.json();
      if (notifData.notifications) setNotifications(notifData.notifications);
    } catch (err) {
      console.error('Error fetching bike details:', err);
    }
  };

  // Remote Command Dispatcher with strict finite states
  const sendRemoteCommand = async (commandName, parameters = {}) => {
    if (!motorcycle) return;

    if (!status.isOnline) {
      setCommandStates((prev) => ({
        ...prev,
        [commandName]: { state: 'BIKE_OFFLINE', details: 'Motorcycle IoT controller is offline' },
      }));
      showToast('Cannot send command: Bike is OFFLINE', 'error');
      return;
    }

    setCommandStates((prev) => ({
      ...prev,
      [commandName]: { state: 'SENDING', details: 'Transmitting via Cloud API...' },
    }));

    try {
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command: commandName, parameters }),
      });

      const data = await res.json();

      if (!res.ok) {
        const finalState = data.command?.status || 'FAILED';
        setCommandStates((prev) => ({
          ...prev,
          [commandName]: { state: finalState, details: data.error || 'Execution failed' },
        }));
        showToast(data.error || 'Command failed', 'error');
        return;
      }

      setCommandStates((prev) => ({
        ...prev,
        [commandName]: { state: 'SUCCESS', details: data.message },
      }));

      fetchBikeDetails(motorcycle._id, token);
    } catch (err) {
      setCommandStates((prev) => ({
        ...prev,
        [commandName]: { state: 'FAILED', details: err.message },
      }));
      showToast(err.message, 'error');
    }
  };

  // Keyless vehicle start and sleep helpers
  const startVehicleWithPin = async (pin = '1234') => {
    return sendRemoteCommand('START_VEHICLE', { pin });
  };

  const sleepVehicle = async () => {
    return sendRemoteCommand('SLEEP_VEHICLE');
  };

  const simulateTamperAlert = async () => {
    try {
      await fetch(`${SIMULATOR_URL}/api/simulator/tamper`, { method: 'POST' });
      showToast('Physical vibration sensor triggered!', 'warning');
    } catch (err) {
      showToast('Simulator bridge unavailable', 'error');
    }
  };

  const dismissTheftAlert = () => {
    stopWarningAlarmSound();
    setTheftAlert(null);
  };

  const secureVehicle = async () => {
    if (!motorcycle?._id) return;
    try {
      showToast('Dispatched emergency [SECURE VEHICLE]...', 'warning');
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/security/secure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Vehicle secured', 'success');
      } else {
        showToast(data.error || 'Failed to secure vehicle', 'error');
      }
      return data;
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleSecurityMode = async (active) => {
    if (!motorcycle?._id) return;
    try {
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/security/mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (data.success) {
        setSecurityModeActive(data.securityActive);
        showToast(data.securityActive ? 'SECURITY MODE: ACTIVE' : 'SECURITY MODE: DISARMED', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /**
   * Transmits real-time navigation telemetry packet to server & paired TFT
   */
  const sendNavigationUpdate = useCallback((navData) => {
    // Ensure packet has session headers
    const enrichedPacket = (!navData.navigationSessionId || navData.sequence == null)
      ? tftNavigationBridge.buildPacket(navData)
      : navData;

    lastNavPacketRef.current = enrichedPacket;
    tftNavigationBridge.setLatestSnapshot(enrichedPacket);

    const devId = motorcycle?.deviceId || 'BIKE-4G-9021';
    const packet = {
      ...enrichedPacket,
      deviceId: devId,
      bikeId: motorcycle?._id,
    };
    if (socket && socket.connected) {
      socket.emit('navigation_update', packet);
      console.log(`[Mobile Nav Sync] Sent navigation_update (${packet.navigationStatus || (packet.isNavigating ? 'NAVIGATING' : 'STOPPED')}) [session=${packet.navigationSessionId}, seq=${packet.sequence}]: ${packet.instruction || packet.maneuver || ''} [${packet.distanceToTurn ?? 0}m]`);
    } else {
      console.warn('[Mobile Nav Sync] Socket not yet connected, queued for reconnect');
    }
  }, [socket, motorcycle]);

  return (
    <BikeContext.Provider
      value={{
        token,
        user,
        motorcycle,
        status,
        commandStates,
        securityEvents,
        notifications,
        rides,
        statistics,
        speedometerSettings,
        geofence,
        toastMessage,
        socket,
        tftNavigationBridge,
        sendNavigationUpdate,
        login,
        register,
        logout,
        sendRemoteCommand,
        startVehicleWithPin,
        sleepVehicle,
        simulateTamperAlert,
        fetchBikeDetails,
        setSpeedometerSettings,
        showToast,
        theftAlert,
        dismissTheftAlert,
        secureVehicle,
        toggleSecurityMode,
        securityModeActive,
        destinations,
        fetchSavedDestinations,
        saveDestination,
        deleteDestination,
      }}
    >
      {children}
    </BikeContext.Provider>
  );
}

export function useBike() {
  return useContext(BikeContext);
}
