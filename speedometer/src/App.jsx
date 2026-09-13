import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { ArcSpeedometer } from './components/ArcSpeedometer.jsx';
import {
  NavigationMode,
  SAMPLE_NAVIGATION_DATA,
  normalizeNavigationUpdate,
  TFT_HARDWARE_CONNECTION_STATES,
} from './components/navigation/index.js';
import { VerticalGauge } from './components/VerticalGauge.jsx';
import {
  HighBeamIndicator,
  LowFuelIndicator,
  BatteryIndicator,
  ABSIndicator,
  TractionControlIndicator,
  SideStandIndicator,
} from './components/indicators/index.js';
import './cluster.css';

const SOCKET_URL = 'http://localhost:5000';
const SIMULATOR_URL = 'http://localhost:5005';
const DEVICE_ID = 'BIKE-4G-9021';

// Ensure only ECO, FUEL, or EV are ever displayed or processed on the TFT
export const mapRidingMode = (mode) => {
  if (!mode) return 'ECO';
  const upper = String(mode).toUpperCase();
  if (upper === 'SPORT' || upper === 'NORMAL' || upper === 'FUEL') return 'FUEL';
  if (upper === 'EV') return 'EV';
  return 'ECO';
};

export default function App() {
  // TFT Display Screen State: 'standby' | 'pin' | 'booting' | 'dashboard'
  const [screenState, setScreenState] = useState('dashboard');
  const screenStateRef = useRef(screenState);
  useEffect(() => {
    screenStateRef.current = screenState;
  }, [screenState]);
  // TFT View when in dashboard: 'speedometer' | 'map' (defaults to map to display base map)
  const [tftView, setTftView] = useState('map');
  const [bootStage, setBootStage] = useState(0); // 0: PIN Verified, 1: Safety Checks, 2: Vehicle Ready
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShaking, setPinShaking] = useState(false);
  const [socket, setSocket] = useState(null);

  // Real Hardware Connection State: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING'
  const [hardwareConnState, setHardwareConnState] = useState(TFT_HARDWARE_CONNECTION_STATES.CONNECTING);
  const lastPacketRef = useRef({ sessionId: null, sequence: null });
  const lastActivityTimeRef = useRef(Date.now());

  // Persistent Navigation State across view transitions (Ready for Mappls / Mobile App integration)
  const [navigationState, setNavigationState] = useState(SAMPLE_NAVIGATION_DATA);

  // Live Telemetry & Vehicle State
  const [telemetry, setTelemetry] = useState({
    vehicleState: 'SLEEP', // 'SLEEP' | 'WAKE' | 'RUNNING'
    speed: 0,
    rpm: 0,
    gear: 'N',
    engineTemp: 25,
    fuelLevel: 78,
    lowFuel: false,
    batteryPercentage: 85,
    batteryVoltage: 12.58,
    batteryStatus: 'NORMAL', // 'NORMAL' | 'LOW' | 'CRITICAL'
    absStatus: 'NORMAL', // 'NORMAL' | 'FAULT'
    tractionControlStatus: 'ACTIVE', // 'ACTIVE' | 'OFF' | 'INTERVENING'
    sideStandStatus: 'UP', // 'UP' | 'DOWN'
    sidestandDown: false,
    ridingMode: 'ECO',
    lock: true,
    headlight: false,
    highBeam: false,
    indicators: 'OFF',
    hazard: false,
  });

  const [showDiagnosticBar, setShowDiagnosticBar] = useState(false);

  const [theme, setTheme] = useState('MONOCHROME_LUXURY');
  const [unit, setUnit] = useState('KMH');
  const [clock24, setClock24] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
  const [currentDate, setCurrentDate] = useState(() => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase());
  
  // Real persistent Trip A and Odometer stored locally and synced with vehicle telemetry
  const [tripDistance, setTripDistance] = useState(() => {
    const saved = localStorage.getItem('apex_bike_trip_a');
    return saved !== null ? parseFloat(saved) : 124.6;
  });

  const [odometer, setOdometer] = useState(() => {
    const saved = localStorage.getItem('apex_bike_odometer');
    return saved !== null ? parseFloat(saved) : 12458.0;
  });

  // Dynamic Real-time EV & Fuel Range Estimation
  const [evConsumedKm, setEvConsumedKm] = useState(0);
  const [fuelConsumedKm, setFuelConsumedKm] = useState(0);

  // Temporary Throttle Simulation Controller (Press & Hold test: 0 -> 100 km/h)
  const [isThrottling, setIsThrottling] = useState(false);
  const [throttleSpeed, setThrottleSpeed] = useState(0);
  const throttleSpeedRef = useRef(0);

  // Stable animation loop: only runs when throttling OR while coasting down to 0
  useEffect(() => {
    if (!isThrottling && throttleSpeedRef.current <= 0) return;

    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      let current = throttleSpeedRef.current;
      if (isThrottling) {
        current = Math.min(100, current + 28.5 * dt);
      } else {
        current = Math.max(0, current - 24.0 * dt);
      }

      throttleSpeedRef.current = current;
      setThrottleSpeed(current);

      if (isThrottling || current > 0) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isThrottling]);

  // Keyboard support: hold Spacebar or ArrowUp to throttle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsThrottling(true);
        }
      }
      if (e.code === 'KeyM') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          setTftView((prev) => (prev === 'map' ? 'speedometer' : 'map'));
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        setIsThrottling(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Reset Trip A handler (resets only Trip A, strictly preserves ODO)
  const handleResetTripA = () => {
    setTripDistance(0.0);
    localStorage.setItem('apex_bike_trip_a', '0.0');
    console.log('[TFT Cluster] Trip A reset to 0.0 km');
  };

  // Real 24-Hour Clock & Date updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setClock24(`${hours}:${minutes}`);
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Trip A, ODO, and Range consumption based on live vehicle velocity (telemetry or throttle)
  useEffect(() => {
    const currentSpeed = throttleSpeedRef.current > 0 || isThrottling ? throttleSpeed : (telemetry.speed || 0);
    if (currentSpeed <= 0) return;

    const interval = setInterval(() => {
      const spd = throttleSpeedRef.current > 0 || isThrottling ? throttleSpeedRef.current : (telemetry.speed || 0);
      if (spd <= 0) return;

      const distDeltaKm = (spd * 0.1) / 3600;
      setTripDistance((prev) => {
        const next = Math.round((prev + distDeltaKm) * 100) / 100;
        localStorage.setItem('apex_bike_trip_a', next.toFixed(2));
        return next;
      });
      setOdometer((prev) => {
        const next = Math.round((prev + distDeltaKm) * 100) / 100;
        localStorage.setItem('apex_bike_odometer', next.toFixed(2));
        return next;
      });

      // Dynamic Range consumption based on active riding mode
      const currentMode = mapRidingMode(telemetry.ridingMode);
      if (currentMode === 'EV') {
        setEvConsumedKm((prev) => prev + distDeltaKm * 1.15);
      } else if (currentMode === 'FUEL') {
        setFuelConsumedKm((prev) => prev + distDeltaKm * 1.05);
      } else {
        // ECO mode: intelligent hybrid efficiency
        setEvConsumedKm((prev) => prev + distDeltaKm * 0.4);
        setFuelConsumedKm((prev) => prev + distDeltaKm * 0.6);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [telemetry.speed, isThrottling, throttleSpeed, telemetry.ridingMode]);

  // Set body theme class
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Real-time WebSocket connection to Cloud Gateway (single-flight persistent connection)
  useEffect(() => {
    setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.CONNECTING);
    const s = io(SOCKET_URL, { reconnectionDelay: 1000, transports: ['websocket', 'polling'] });
    setSocket(s);

    const markActivity = () => {
      lastActivityTimeRef.current = Date.now();
      setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.CONNECTED);
    };

    s.on('connect', () => {
      console.log('[TFT] SOCKET RECONNECTED to Cloud Telemetry Gateway');
      setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.CONNECTED);
      lastActivityTimeRef.current = Date.now();
      s.emit('join_device', DEVICE_ID);
    });

    s.on('disconnect', (reason) => {
      console.log('[TFT] SOCKET DISCONNECTED:', reason);
      setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.DISCONNECTED);
    });

    s.on('connect_error', () => {
      setHardwareConnState((prev) => (prev === TFT_HARDWARE_CONNECTION_STATES.CONNECTED ? TFT_HARDWARE_CONNECTION_STATES.RECONNECTING : prev));
    });

    if (s.io) {
      s.io.on('reconnect_attempt', () => {
        setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.RECONNECTING);
      });
    }

    s.on('tft_pong', () => {
      markActivity();
    });

    s.on('status_update', (data) => {
      markActivity();
      setTelemetry((prev) => ({
        ...prev,
        ...data,
        ridingMode: data.ridingMode ? mapRidingMode(data.ridingMode) : prev.ridingMode,
      }));

      // If remote command started or slept vehicle
      const curScreen = screenStateRef.current;
      if (data.vehicleState === 'RUNNING' && curScreen !== 'dashboard' && curScreen !== 'booting') {
        setScreenState('dashboard');
      } else if (data.vehicleState === 'SLEEP' && curScreen === 'dashboard') {
        setScreenState('standby');
      }
    });

    s.on('live_telemetry', (data) => {
      markActivity();
      setTelemetry((prev) => ({
        ...prev,
        ...data,
        ridingMode: data.ridingMode ? mapRidingMode(data.ridingMode) : prev.ridingMode,
      }));
      // If we are getting live engine telemetry, vehicle is running
      if (screenStateRef.current === 'standby' && (data.speed > 0 || data.rpm > 500)) {
        setScreenState('dashboard');
      }
    });

    s.on('heartbeat', (data) => {
      markActivity();
      setTelemetry((prev) => ({
        ...prev,
        vehicleState: data.vehicleState || (data.ignition ? 'RUNNING' : 'SLEEP'),
        batteryPercentage: data.batteryPercentage || prev.batteryPercentage,
      }));
    });

    s.on('navigation_update', (data) => {
      markActivity();
      console.log('[TFT NAV IN] Received navigation update:', data);

      // Display Deduplication Protection (Step 9 Requirement 17):
      // If the exact same session & sequence was already processed, avoid duplicate state dispatch
      if (
        data &&
        data.navigationSessionId &&
        data.navigationSessionId === lastPacketRef.current.sessionId &&
        data.sequence != null &&
        data.sequence === lastPacketRef.current.sequence
      ) {
        return;
      }

      setNavigationState((prev) => {
        const next = normalizeNavigationUpdate(data, prev);
        if (next === prev) {
          return prev;
        }

        lastPacketRef.current = {
          sessionId: data?.navigationSessionId || null,
          sequence: data?.sequence != null ? data.sequence : null,
        };

        if (data?.navigationStatus === 'STOPPED' || (!next.active && !next.isDestinationReached)) {
          setTftView('speedometer');
        } else if (next.isNavigating && !next.isDestinationReached) {
          setTftView('map');
        }
        return next;
      });
    });

    s.on('command_update', (cmd) => {
      markActivity();
      if (cmd.command === 'SET_RIDING_MODE' && cmd.status === 'SUCCESS' && cmd.details) {
        const match = cmd.details.match(/to (\w+)/);
        if (match) setTelemetry((prev) => ({ ...prev, ridingMode: mapRidingMode(match[1]) }));
      }
      if (cmd.command === 'SET_SPEEDOMETER_BRIGHTNESS' && cmd.status === 'SUCCESS') {
        // Handled
      }
      if (cmd.command === 'SET_SPEEDOMETER_THEME' && cmd.status === 'SUCCESS') {
        const themeMatch = cmd.details.match(/to (\w+)/);
        if (themeMatch) setTheme(themeMatch[1]);
      }
      if (cmd.command === 'SLEEP_VEHICLE' && cmd.status === 'SUCCESS') {
        setScreenState('standby');
      }
    });

    // Hardware connection watchdog (detects dead socket connections without network flooding)
    const watchdogInterval = setInterval(() => {
      if (s.connected) {
        const elapsed = Date.now() - lastActivityTimeRef.current;
        if (elapsed > 25000) {
          setHardwareConnState(TFT_HARDWARE_CONNECTION_STATES.RECONNECTING);
          s.emit('tft_ping', { deviceId: DEVICE_ID, timestamp: Date.now() });
        } else if (elapsed > 12000) {
          s.emit('tft_ping', { deviceId: DEVICE_ID, timestamp: Date.now() });
        }
      }
    }, 5000);

    return () => {
      clearInterval(watchdogInterval);
      s.disconnect();
    };
  }, []);

  // ===============================================
  // PIN KEYPAD & AUTHENTICATION HANDLERS
  // ===============================================
  const handleKeypadPress = (digit) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      setPinError('');
      if (newPin.length === 4) {
        verifyPinAndStart(newPin);
      }
    }
  };

  const handleKeypadDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const handleKeypadClear = () => {
    setPinInput('');
    setPinError('');
  };

  const verifyPinAndStart = async (pinToVerify) => {
    try {
      const res = await fetch(`${SIMULATOR_URL}/api/simulator/vehicle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Correct PIN! Begin short automotive startup animation
        setPinError('');
        setScreenState('booting');
        setBootStage(0); // PIN Verified

        setTimeout(() => {
          setBootStage(1); // Safety Checks
          setTimeout(() => {
            setBootStage(2); // Vehicle Ready
            setTimeout(() => {
              setScreenState('dashboard');
              setPinInput('');
            }, 600);
          }, 700);
        }, 500);
      } else {
        // Wrong PIN
        setPinShaking(true);
        setPinError(data.reason || 'Incorrect PIN. Try again.');
        setTimeout(() => {
          setPinShaking(false);
          setPinInput('');
        }, 600);
      }
    } catch (err) {
      // Fallback local verification if simulator port is busy
      if (pinToVerify === '1234') {
        setScreenState('booting');
        setTimeout(() => setScreenState('dashboard'), 1500);
        setPinInput('');
      } else {
        setPinShaking(true);
        setPinError('Invalid PIN (Default: 1234)');
        setTimeout(() => {
          setPinShaking(false);
          setPinInput('');
        }, 600);
      }
    }
  };

  // Lock and return TFT to Standby Screen
  const handleLockSleep = async () => {
    try {
      await fetch(`${SIMULATOR_URL}/api/simulator/vehicle/sleep`, { method: 'POST' });
    } catch (e) {
      console.warn('Simulator HTTP sleep failed:', e);
    }
    setScreenState('standby');
    setPinInput('');
    setTelemetry((prev) => ({
      ...prev,
      vehicleState: 'SLEEP',
      lock: true,
      speed: 0,
      rpm: 0,
    }));
  };

  const handleSelectRidingMode = (mode) => {
    const validMode = mapRidingMode(mode);
    setTelemetry((prev) => ({ ...prev, ridingMode: validMode }));
    if (socket) {
      socket.emit('send_command', {
        deviceId: DEVICE_ID,
        command: 'SET_RIDING_MODE',
        parameters: { mode: validMode },
      });
    }
  };

  const handleTftSelectDestination = (dest) => {
    console.log('[TFT NAV OUT] Selected destination on TFT:', dest);
    if (socket) {
      socket.emit('tft_destination_select', {
        deviceId: DEVICE_ID,
        destination: {
          name: dest.name,
          lat: Number(dest.lat),
          lng: Number(dest.lng),
        },
        timestamp: Date.now(),
      });
    }
    setNavigationState((prev) => ({
      ...prev,
      destination: {
        ...prev.destination,
        name: dest.name,
        lat: Number(dest.lat),
        lng: Number(dest.lng),
      },
      status: 'CALCULATING',
    }));
  };

  // Interactive Diagnostic Sensor Toggle (Click or hotkeys H, A, T, B, F, S, D)
  const toggleTelemetryIndicator = useCallback((key) => {
    setTelemetry((prev) => {
      switch (key) {
        case 'highBeam':
          return { ...prev, highBeam: !prev.highBeam };
        case 'absStatus':
          return { ...prev, absStatus: prev.absStatus === 'FAULT' ? 'NORMAL' : 'FAULT' };
        case 'tractionControlStatus':
          return {
            ...prev,
            tractionControlStatus: prev.tractionControlStatus === 'OFF' ? 'ACTIVE' : 'OFF',
          };
        case 'batteryStatus': {
          const isWarn = prev.batteryStatus === 'LOW' || prev.batteryPercentage < 20;
          return {
            ...prev,
            batteryStatus: isWarn ? 'NORMAL' : 'LOW',
            batteryPercentage: isWarn ? 85 : 12,
            batteryVoltage: isWarn ? 12.6 : 11.4,
          };
        }
        case 'lowFuel': {
          const isWarn = prev.lowFuel || prev.fuelLevel < 20;
          return {
            ...prev,
            lowFuel: !isWarn,
            fuelLevel: isWarn ? 78 : 9,
          };
        }
        case 'sideStandStatus': {
          const isDown = prev.sideStandStatus === 'DOWN' || prev.sidestandDown;
          return {
            ...prev,
            sideStandStatus: isDown ? 'UP' : 'DOWN',
            sidestandDown: !isDown,
          };
        }
        default:
          return prev;
      }
    });
  }, []);

  // Global Keyboard shortcuts for quick vehicle sensor toggling
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keystrokes when typing PIN
      if (screenState === 'pin') return;

      const k = e.key.toLowerCase();
      if (k === 'h') toggleTelemetryIndicator('highBeam');
      else if (k === 'a') toggleTelemetryIndicator('absStatus');
      else if (k === 't') toggleTelemetryIndicator('tractionControlStatus');
      else if (k === 'b') toggleTelemetryIndicator('batteryStatus');
      else if (k === 'f') toggleTelemetryIndicator('lowFuel');
      else if (k === 's') toggleTelemetryIndicator('sideStandStatus');
      else if (k === 'd') setShowDiagnosticBar((prev) => !prev);
      else if (k === 'm') setTftView((prev) => (prev === 'map' ? 'speedometer' : 'map'));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenState, toggleTelemetryIndicator]);

  // ===============================================
  // SCREEN 1: MINIMAL BEAUTIFUL STANDBY SCREEN
  // ===============================================
  if (screenState === 'standby') {
    return (
      <div className="standby-screen">
        {/* Top Status Bar */}
        <div className="standby-top-row">
          <div className="standby-brand">
            <div className="standby-logo-mark" style={{ width: 46, height: 46, minWidth: 46, padding: 0, overflow: 'hidden', background: 'transparent', border: 'none' }}>
              <img
                src="/brand-logo.png"
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span className="standby-brand-text">AEROVYN</span>
          </div>

          <div className="standby-status-pills">
            <div
              className="standby-pill"
              style={{
                color:
                  hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED
                    ? '#00f0ff'
                    : hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.RECONNECTING
                    ? '#ff9f0a'
                    : hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTING
                    ? '#ffd60a'
                    : '#ff453a',
              }}
            >
              <span>{hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED ? '●' : '○'}</span>{' '}
              {hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED ? '4G LTE' : `4G ${hardwareConnState}`}
            </div>
            <div className="standby-pill" style={{ color: '#30d158' }}>
              <span>◎</span> GPS READY
            </div>
            <div className="standby-pill" style={{ color: telemetry.lock ? '#30d158' : '#ff9f0a' }}>
              <span>{telemetry.lock ? '🔒' : '🔓'}</span> {telemetry.lock ? 'LOCKED' : 'UNLOCKED'}
            </div>
          </div>
        </div>

        {/* Center Clock, Date & Battery Hero */}
        <div className="standby-center-hero">
          <div className="standby-clock">{currentTime.slice(0, 5)}</div>
          <div className="standby-date">{currentDate}</div>

          <div className="standby-battery-gauge">
            <span style={{ fontSize: 16 }}>🔋</span>
            <span style={{ fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: 700, color: '#fff' }}>
              {telemetry.batteryPercentage || 85}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1 }}>BATTERY</span>
            <span style={{ fontSize: 11, color: '#30d158', fontFamily: 'JetBrains Mono' }}>
              ({telemetry.batteryVoltage || 12.58}V)
            </span>
          </div>
        </div>

        {/* Primary Touch CTA Button */}
        <div>
          <button
            className="standby-start-btn"
            onClick={() => setScreenState('pin')}
          >
            <span>START</span>
            <span style={{ fontSize: 26, fontWeight: 900 }}>➔</span>
          </button>
        </div>
      </div>
    );
  }

  // ===============================================
  // SCREEN 2: DEDICATED PIN AUTHENTICATION SCREEN
  // ===============================================
  if (screenState === 'pin') {
    return (
      <div className="pin-auth-screen">
        <div className="pin-header">
          <div className="pin-header-welcome">Welcome Back, Rider</div>
          <div className="pin-header-title">Enter PIN to Start Vehicle</div>
        </div>

        {/* Masked PIN Dots */}
        <div style={{ textAlign: 'center' }}>
          <div className={`pin-dots-container ${pinShaking ? 'shake' : ''}`}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`pin-dot ${pinInput.length > idx ? 'filled' : ''}`}
              />
            ))}
          </div>

          <div className="pin-error-msg">{pinError}</div>
        </div>

        {/* Numeric Keypad */}
        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className="keypad-btn"
              onClick={() => handleKeypadPress(String(num))}
            >
              {num}
            </button>
          ))}

          <button className="keypad-btn keypad-btn-action" onClick={handleKeypadClear}>
            CLEAR
          </button>

          <button className="keypad-btn" onClick={() => handleKeypadPress('0')}>
            0
          </button>

          <button className="keypad-btn keypad-btn-action" onClick={handleKeypadDelete}>
            DEL ⌫
          </button>
        </div>

        {/* Bottom Back Button */}
        <div className="pin-footer-row">
          <button className="pin-back-btn" onClick={() => setScreenState('standby')}>
            ← Back to Standby
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
            DEFAULT PIN: 1234
          </span>
        </div>
      </div>
    );
  }

  // ===============================================
  // SCREEN 3: SHORT AUTOMOTIVE STARTUP ANIMATION
  // ===============================================
  if (screenState === 'booting') {
    return (
      <div className="boot-screen">
        <div className="boot-logo-sweep" style={{ width: 140, height: 140, padding: 4, overflow: 'hidden', background: 'transparent', border: 'none', filter: 'drop-shadow(0 0 25px rgba(0, 240, 255, 0.5))' }}>
          <img
            src="/brand-logo.png"
            alt="AEROVYN Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ fontFamily: 'Chakra Petch', fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: 4, marginTop: 4, marginBottom: 12 }}>
          AEROVYN
        </div>

        <div className="boot-stage-title">
          {bootStage === 0 && 'PIN VERIFIED'}
          {bootStage === 1 && 'SYSTEM SAFETY CHECKS'}
          {bootStage === 2 && 'VEHICLE READY'}
        </div>

        <div className="boot-stage-sub">
          {bootStage === 0 && 'Cryptographic Token Accepted'}
          {bootStage === 1 && 'Stationary · Stand Up · Drivetrain Clear'}
          {bootStage === 2 && 'Engaging Contactors · Initializing TFT'}
        </div>

        <div className="boot-progress-bar">
          <div
            className="boot-progress-fill"
            style={{ width: bootStage === 0 ? '33%' : bootStage === 1 ? '70%' : '100%' }}
          ></div>
        </div>
      </div>
    );
  }

  // ===============================================
  // REAL VEHICLE STATUS & WARNING NORMALIZATION
  // ===============================================
  const isHighBeamActive = Boolean(telemetry.highBeam);

  const isLowFuelWarning =
    telemetry.lowFuel !== undefined
      ? Boolean(telemetry.lowFuel)
      : (telemetry.fuelLevel !== undefined && telemetry.fuelLevel < 20);

  const isLowFuelCritical = (telemetry.fuelLevel !== undefined && telemetry.fuelLevel < 10);

  const isBatteryWarning =
    telemetry.batteryStatus === 'LOW' ||
    telemetry.batteryStatus === 'CRITICAL' ||
    (telemetry.batteryPercentage !== undefined && telemetry.batteryPercentage < 20);

  const isBatteryCritical =
    telemetry.batteryStatus === 'CRITICAL' ||
    (telemetry.batteryPercentage !== undefined && telemetry.batteryPercentage < 10);

  const isAbsFault = telemetry.absStatus === 'FAULT';

  const isTcWarning =
    telemetry.tractionControlStatus === 'OFF' ||
    telemetry.tractionControlStatus === 'FAULT';

  const isSideStandDown =
    telemetry.sideStandStatus === 'DOWN' ||
    (telemetry.sideStandStatus === undefined && telemetry.sidestandDown === true);

  const isLeftIndicator = telemetry.indicators === 'LEFT' || telemetry.indicators === 'HAZARD' || telemetry.hazard;
  const isRightIndicator = telemetry.indicators === 'RIGHT' || telemetry.indicators === 'HAZARD' || telemetry.hazard;

  // Dynamically estimated EV and Fuel ranges (85% battery -> ~72 km, 78% fuel -> ~185 km)
  const batteryPct = telemetry.batteryPercentage !== undefined ? telemetry.batteryPercentage : 85;
  const fuelPct = telemetry.fuelLevel !== undefined ? telemetry.fuelLevel : 78;
  const evRange = Math.max(0, Math.round(batteryPct * 0.85 - evConsumedKm));
  const fuelRange = Math.max(0, Math.round(fuelPct * 2.372 - fuelConsumedKm));

  return (
    <div className="cluster-viewport">
      {/* Interactive Automotive Sensor Diagnostic Toolbar (Press 'D' or use dock button) */}
      {showDiagnosticBar && (
        <div className="cluster-diagnostic-toolbar">
          <span className="diag-title">ECU SENSORS</span>
          <button
            className={`diag-toggle-btn ${isHighBeamActive ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('highBeam')}
            title="Toggle High Beam Headlamp [H]"
          >
            BEAM {isHighBeamActive ? 'ON' : 'OFF'}
          </button>
          <button
            className={`diag-toggle-btn ${isAbsFault ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('absStatus')}
            title="Toggle ABS Fault Sensor [A]"
          >
            ABS {isAbsFault ? 'FAULT' : 'OK'}
          </button>
          <button
            className={`diag-toggle-btn ${isTcWarning ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('tractionControlStatus')}
            title="Toggle Traction Control [T]"
          >
            TC {isTcWarning ? 'OFF' : 'ACT'}
          </button>
          <button
            className={`diag-toggle-btn ${isBatteryWarning ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('batteryStatus')}
            title="Toggle 12V Battery Warning [B]"
          >
            BATT {isBatteryWarning ? 'LOW' : 'NORM'}
          </button>
          <button
            className={`diag-toggle-btn ${isLowFuelWarning ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('lowFuel')}
            title="Toggle Low Fuel Warning [F]"
          >
            FUEL {isLowFuelWarning ? 'LOW' : 'NORM'}
          </button>
          <button
            className={`diag-toggle-btn ${isSideStandDown ? 'active' : ''}`}
            onClick={() => toggleTelemetryIndicator('sideStandStatus')}
            title="Toggle Side Stand Safety Interlock [S]"
          >
            STAND {isSideStandDown ? 'DOWN' : 'UP'}
          </button>
          <button
            className="diag-close-btn"
            onClick={() => setShowDiagnosticBar(false)}
            title="Close diagnostic toolbar (Press D)"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Top Indicator Telltale Bar (Turn Signals & Navbar Information Ribbon) */}
      <div className="cluster-top-bar">
        {/* Left Turn Signal */}
        <div className={`indicator-signal ${isLeftIndicator ? 'active' : ''}`}>
          <span>◀</span>
          <span>TURN L</span>
        </div>

        {/* Central Navbar Display: CLOCK | ODO | TRIP A */}
        <div className="navbar-info-ribbon">
          {/* 1. CLOCK - Real-time Digital Clock */}
          <div className="navbar-info-item navbar-clock" title="Real-Time Clock">
            <span className="navbar-info-label">CLOCK</span>
            <span className="navbar-info-val">{clock24}</span>
          </div>

          <span className="navbar-info-divider">|</span>

          {/* 2. ODO - Persistent Total Odometer Reading */}
          <div className="navbar-info-item navbar-odo" title="Persistent Total Odometer">
            <span className="navbar-info-label">ODO</span>
            <span className="navbar-info-val">
              {Math.round(odometer).toLocaleString('en-US')} <span className="navbar-info-unit">km</span>
            </span>
          </div>

          <span className="navbar-info-divider">|</span>

          {/* 3. TRIP A - Independently Resettable Trip Meter */}
          <div
            className="navbar-info-item navbar-trip interactive-trip"
            onClick={handleResetTripA}
            title="Trip A Distance (Click to Reset)"
          >
            <span className="navbar-info-label">TRIP A</span>
            <span className="navbar-info-val">
              {tripDistance.toFixed(1)} <span className="navbar-info-unit">km</span>
            </span>
            <button
              className="navbar-trip-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleResetTripA();
              }}
              title="Reset Trip A independently"
            >
              RESET
            </button>
          </div>
        </div>

        {/* Right Turn Signal */}
        <div className={`indicator-signal ${isRightIndicator ? 'active' : ''}`}>
          <span>TURN R</span>
          <span>▶</span>
        </div>
      </div>

      {/* 2. Main Automotive Cockpit Centered Stage */}
      <div className="cluster-main-stage">
        <div className="tft-centered-cluster">
          {/* Secondary Vitals Bar Above Arc (No battery percentage display) */}
          <div className="cluster-vitals-strip">
            <div className="vital-item">
              <span
                className="vital-icon"
                style={{
                  color:
                    hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED
                      ? '#30d158'
                      : hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.RECONNECTING
                      ? '#ff9f0a'
                      : hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTING
                      ? '#ffd60a'
                      : '#ff453a',
                }}
              >
                {hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED ? '●' : '○'}
              </span>
              <span className="vital-val">
                {hardwareConnState === TFT_HARDWARE_CONNECTION_STATES.CONNECTED
                  ? '4G CONNECTED'
                  : `4G ${hardwareConnState}`}
              </span>
            </div>

            <div className="vital-mode-pill">
              <span className="vital-mode-label">DRIVE MODE:</span>
              <span className="vital-mode-val">{mapRidingMode(telemetry.ridingMode)}</span>
            </div>

            <div className="vital-item">
              <span className="vital-icon">🌡</span>
              <span className="vital-val">{telemetry.engineTemp || 25}°C COOLANT</span>
            </div>
          </div>

          {/* Symmetrical Automotive Cockpit Flank Layout: [Left Battery + EV Range] [Center Arc Speedometer] [Right Fuel + Fuel Range] */}
          <div className="tft-cockpit-flank-row">
            {/* LEFT: Vertical Segmented Battery Gauge + Separate EV Range */}
            <div className="flank-gauge-group group-left">
              <VerticalGauge
                type="battery"
                value={telemetry.batteryPercentage}
                isWarning={isBatteryWarning}
                isCritical={isBatteryCritical}
                side="left"
                onClick={() => toggleTelemetryIndicator('batteryStatus')}
              />
              <div className="tft-range-display range-ev" title="Estimated Remaining Electric Range">
                <span className="tft-range-label">EV RANGE</span>
                <span className="tft-range-val">{evRange} <span className="tft-range-unit">km</span></span>
              </div>
            </div>

            {/* CENTER: Arc Speedometer OR Mappls Navigation Mode */}
            {tftView === 'map' ? (
              <NavigationMode
                navigationData={navigationState}
                onExitNavigation={() => setTftView('speedometer')}
                onSelectDestination={handleTftSelectDestination}
              />
            ) : (
              <ArcSpeedometer
                speed={throttleSpeedRef.current > 0 || isThrottling ? throttleSpeed : (telemetry.speed || 0)}
                maxSpeed={telemetry.maxSpeed || 220}
                unit="KMH"
                isHighBeamActive={isHighBeamActive}
                isAbsFault={isAbsFault}
                isTcWarning={isTcWarning}
                tcStatus={telemetry.tractionControlStatus}
                isSideStandDown={isSideStandDown}
                onToggleIndicator={toggleTelemetryIndicator}
              />
            )}

            {/* RIGHT: Vertical Segmented Fuel Gauge + Separate Fuel Range */}
            <div className="flank-gauge-group group-right">
              <VerticalGauge
                type="fuel"
                value={telemetry.fuelLevel}
                isWarning={isLowFuelWarning}
                isCritical={isLowFuelCritical}
                side="right"
                onClick={() => toggleTelemetryIndicator('lowFuel')}
              />
              <div className="tft-range-display range-fuel" title="Estimated Remaining Fuel Range">
                <span className="tft-range-label">FUEL RANGE</span>
                <span className="tft-range-val">{fuelRange} <span className="tft-range-unit">km</span></span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Bottom Dock Bar */}
      <div className="cluster-bottom-dock">
        <div className="dock-item">
          <span style={{ color: 'var(--text-dim)' }}>DATE:</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>{currentDate}</span>
        </div>

        {/* Riding Mode Switcher - Strictly ECO, FUEL, EV */}
        <div className="mode-selector-dock">
          {['ECO', 'FUEL', 'EV'].map((m) => (
            <button
              key={m}
              className={`mode-btn-pill ${mapRidingMode(telemetry.ridingMode) === m ? 'active' : ''}`}
              onClick={() => handleSelectRidingMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Dedicated MAP Navigation Screen Toggle Button */}
        <button
          className={`tft-map-btn ${tftView === 'map' ? 'active-nav-btn' : ''}`}
          onClick={() => setTftView((prev) => (prev === 'map' ? 'speedometer' : 'map'))}
          title={tftView === 'map' ? "Switch to Speedometer Instrument Cluster (Press 'M')" : "Switch to Mappls Navigation Mode (Press 'M')"}
        >
          <span className="map-btn-icon">{tftView === 'map' ? '◷' : '◉'}</span>
          <span className="map-btn-text">{tftView === 'map' ? 'DASH' : 'MAP'}</span>
        </button>

        {/* Temporary Throttle Test Control Button (Press & Hold) */}
        <button
          className={`tft-throttle-btn ${isThrottling ? 'active' : ''}`}
          onMouseDown={() => setIsThrottling(true)}
          onMouseUp={() => setIsThrottling(false)}
          onMouseLeave={() => setIsThrottling(false)}
          onTouchStart={(e) => { e.preventDefault(); setIsThrottling(true); }}
          onTouchEnd={() => setIsThrottling(false)}
          onTouchCancel={() => setIsThrottling(false)}
          title="Press & Hold to Accelerate (0 → 100 km/h). Release to Decelerate."
        >
          <span className="throttle-btn-dot">●</span>
          <span className="throttle-btn-text">THROTTLE</span>
          {isThrottling && <span className="throttle-btn-badge">{Math.round(throttleSpeed)} KM/H</span>}
        </button>

        {/* Diagnostic Sensor Toggles Button */}
        <button
          className={`diag-toggle-btn ${showDiagnosticBar ? 'active' : ''}`}
          style={{ padding: '8px 14px', borderRadius: 20, fontSize: 11 }}
          onClick={() => setShowDiagnosticBar((prev) => !prev)}
          title="Toggle ECU Sensor Diagnostic Controls (Press 'D')"
        >
          ⚙ ECU SENSORS
        </button>

        {/* Dedicated TFT LOCK / SLEEP Button */}
        <button
          className="tft-lock-sleep-btn"
          onClick={handleLockSleep}
          title="Lock vehicle and enter low-power standby"
        >
          <span>🔒</span>
          <span>LOCK / SLEEP</span>
        </button>
      </div>
    </div>
  );
}
