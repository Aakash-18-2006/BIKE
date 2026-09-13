import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function CameraScreen() {
  const { motorcycle, token, status, showToast } = useBike();
  const [cameraStatus, setCameraStatus] = useState({
    deviceStatus: 'CONNECTING',
    cameraType: 'DUAL',
    activeFacing: 'FRONT',
    storageCapacity: 64000,
    storageUsed: 21450,
    storagePercentage: 34,
    isRecording: false,
    recordingDuration: 0,
    isLiveStreaming: false,
  });

  const [activeFacing, setActiveFacing] = useState('FRONT');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [frameSrc, setFrameSrc] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [events, setEvents] = useState([]);
  const [previewMedia, setPreviewMedia] = useState(null);
  const streamIntervalRef = useRef(null);

  // WEBCAM STATE & REFS
  const [cameraSource, setCameraSource] = useState('BIKE'); // 'BIKE' | 'WEBCAM'
  const [webcamError, setWebcamError] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const webcamStreamRef = useRef(null);
  const webcamVideoRef = useRef(null);

  const RAW_BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL)
    || 'http://localhost:5000';
  const BACKEND_BASE = RAW_BACKEND_URL.replace(/\/+$/, '');
  const API_BASE = BACKEND_BASE.endsWith('/api') ? BACKEND_BASE : `${BACKEND_BASE}/api`;

  // Stop all webcam tracks completely and release hardware
  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      try {
        const tracks = webcamStreamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (err) {
        console.warn('Error stopping webcam tracks:', err);
      }
      webcamStreamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  }, []);

  // Request browser webcam video (no audio/microphone)
  const startWebcam = useCallback(async () => {
    stopWebcam();
    setWebcamError(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setWebcamError('Webcam unavailable');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, // Do NOT request microphone/audio
      });
      webcamStreamRef.current = stream;
      setIsWebcamActive(true);
      setWebcamError(null);

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Webcam stream request error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setWebcamError('Camera permission denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setWebcamError('No camera detected');
      } else {
        setWebcamError('Webcam unavailable');
      }
      setIsWebcamActive(false);
    }
  }, [stopWebcam]);

  // Switch between Existing Bike Camera and Device Webcam
  const handleSelectSource = useCallback((source) => {
    if (source === cameraSource) return;

    if (source === 'WEBCAM') {
      setCameraSource('WEBCAM');
      startWebcam();
    } else {
      stopWebcam();
      setCameraSource('BIKE');
      setWebcamError(null);
    }
  }, [cameraSource, startWebcam, stopWebcam]);

  // Attach stream to video element when DOM mounts/renders
  useEffect(() => {
    if (cameraSource === 'WEBCAM' && isWebcamActive && webcamStreamRef.current && webcamVideoRef.current) {
      if (webcamVideoRef.current.srcObject !== webcamStreamRef.current) {
        webcamVideoRef.current.srcObject = webcamStreamRef.current;
        webcamVideoRef.current.play().catch(() => {});
      }
    }
  }, [cameraSource, isWebcamActive]);

  // Release camera hardware on screen unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  // 1. Fetch initial Camera status & events
  useEffect(() => {
    if (motorcycle?._id) {
      fetchCameraStatus();
      fetchCameraEvents();
    }
  }, [motorcycle?._id]);

  // 2. Continuous real-time video frame fetcher when active in BIKE mode
  useEffect(() => {
    if (cameraSource !== 'BIKE') return;
    if (!motorcycle?._id || !token) return;

    // Start fetching live video frames from TCU camera gateway
    setIsLiveConnected(true);
    const fetchFrame = async () => {
      try {
        const frameUrl = `${API_BASE}/motorcycles/${motorcycle._id}/camera/frame?facing=${activeFacing}&t=${Date.now()}`;
        const res = await fetch(frameUrl);
        if (res.ok) {
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          setFrameSrc(objUrl);
          setIsLiveConnected(true);
        } else {
          setIsLiveConnected(false);
        }
      } catch (err) {
        setIsLiveConnected(false);
      }
    };

    fetchFrame();
    // 10 FPS low-latency automotive stream
    streamIntervalRef.current = setInterval(fetchFrame, 100);

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, [motorcycle?._id, activeFacing, token, cameraSource]);

  // Recording timer
  useEffect(() => {
    let timer;
    if (cameraStatus.isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [cameraStatus.isRecording]);

  const fetchCameraStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/camera/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status) {
        setCameraStatus(data.status);
      }
    } catch (e) {
      console.warn('Failed to fetch camera status:', e);
    }
  };

  const fetchCameraEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/camera/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (e) {
      console.warn('Failed to fetch camera events:', e);
    }
  };

  const handleSnapshot = async () => {
    setIsCapturing(true);

    // Webcam mode snapshot capture from video frame
    if (cameraSource === 'WEBCAM') {
      try {
        if (webcamVideoRef.current && isWebcamActive) {
          const video = webcamVideoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          const snapEvent = {
            _id: 'snap_' + Date.now(),
            eventType: 'WEBCAM SNAPSHOT',
            mediaType: 'IMAGE',
            mediaReference: 'Webcam live snapshot',
            dataUrl,
            timestamp: new Date().toISOString(),
            metadata: { cameraFacing: 'WEBCAM', triggerSource: 'PHONE_CAMERA' },
          };
          setEvents((prev) => [snapEvent, ...prev]);
          showToast('Webcam snapshot captured', 'success');
        } else {
          showToast(webcamError || 'Webcam feed not ready', 'error');
        }
      } catch (err) {
        showToast('Snapshot capture failed', 'error');
      } finally {
        setTimeout(() => setIsCapturing(false), 250);
      }
      return;
    }

    // Existing Bike camera snapshot logic
    try {
      const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/camera/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ facing: activeFacing }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Snapshot captured (${activeFacing})`, 'success');
        fetchCameraEvents();
        fetchCameraStatus();
      } else {
        showToast(data.error || 'Snapshot failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTimeout(() => setIsCapturing(false), 250);
    }
  };

  const handleToggleRecord = async () => {
    try {
      if (!cameraStatus.isRecording) {
        const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/camera/record/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ facing: activeFacing }),
        });
        const data = await res.json();
        if (res.ok) {
          setCameraStatus((prev) => ({ ...prev, isRecording: true, deviceStatus: 'RECORDING' }));
          showToast('Video recording started', 'success');
        }
      } else {
        const res = await fetch(`${API_BASE}/motorcycles/${motorcycle._id}/camera/record/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok) {
          setCameraStatus((prev) => ({ ...prev, isRecording: false, deviceStatus: 'ONLINE' }));
          showToast(`Recording saved (${data.duration || 0}s)`, 'success');
          fetchCameraEvents();
          fetchCameraStatus();
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Determine connection status text & color
  let displayStatus = 'CAMERA ONLINE';
  let badgeColor = 'badge-green';

  if (cameraSource === 'WEBCAM') {
    if (webcamError) {
      displayStatus = webcamError.toUpperCase();
      badgeColor = 'badge-red';
    } else if (isWebcamActive) {
      displayStatus = 'WEBCAM LIVE';
      badgeColor = 'badge-green';
    } else {
      displayStatus = 'STARTING WEBCAM...';
      badgeColor = '';
    }
  } else {
    if (!status.isOnline) {
      displayStatus = 'CAMERA OFFLINE';
      badgeColor = 'badge-red';
    } else if (cameraStatus.isRecording) {
      displayStatus = 'RECORDING';
      badgeColor = 'badge-red';
    } else if (cameraStatus.storagePercentage >= 98) {
      displayStatus = 'STORAGE FULL';
      badgeColor = 'badge-red';
    } else if (!isLiveConnected) {
      displayStatus = 'STANDBY';
      badgeColor = '';
    }
  }

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div>
      <div className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 20, color: '#ffffff', fontWeight: 800 }}>BIKE CAMERA</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automotive Dual-Lens Dashcam & Device Feed</p>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-subtle)', color: '#ffffff', fontWeight: 700 }}>
          {displayStatus}
        </span>
      </div>

      {/* Camera Source Selector Option */}
      <div
        id="camera-source-selector"
        className="card"
        style={{
          padding: '10px 14px',
          marginBottom: 14,
          background: '#0c0c0e',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Camera Source
          </span>
          <span style={{ fontSize: 12, fontFamily: 'Chakra Petch', fontWeight: 800, color: '#ffffff' }}>
            {cameraSource === 'WEBCAM' ? '🎥 Device Webcam (Live)' : '📱 Existing Camera (Bike)'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.6)', padding: 3, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <button
            id="btn-source-existing"
            onClick={() => handleSelectSource('BIKE')}
            style={{
              background: cameraSource === 'BIKE' ? '#ffffff' : 'transparent',
              color: cameraSource === 'BIKE' ? '#000000' : '#8e8e93',
              border: 'none',
              borderRadius: 9,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'Chakra Petch',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
            }}
          >
            <span>📱</span>
            <span>Existing Camera</span>
          </button>
          <button
            id="btn-source-webcam"
            onClick={() => handleSelectSource('WEBCAM')}
            style={{
              background: cameraSource === 'WEBCAM' ? '#ffffff' : 'transparent',
              color: cameraSource === 'WEBCAM' ? '#000000' : '#8e8e93',
              border: 'none',
              borderRadius: 9,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'Chakra Petch',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
            }}
          >
            <span>🎥</span>
            <span>Webcam</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport Card */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          background: '#050507',
          border: (cameraStatus.isRecording && cameraSource === 'BIKE') ? '2px solid #ff453a' : '1px solid var(--border-subtle)',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.9)',
          borderRadius: 20,
        }}
      >
        {/* Shutter flash animation */}
        {isCapturing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 30, opacity: 0.8 }}></div>
        )}

        {/* Viewport Frame */}
        <div style={{ width: '100%', height: 230, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08080a', overflow: 'hidden' }}>
          {cameraSource === 'WEBCAM' ? (
            webcamError ? (
              <div style={{ textAlign: 'center', color: '#ff453a', padding: 20, zIndex: 10 }}>
                <Icon name="camera" size={36} color="#ff453a" />
                <div style={{ fontSize: 13, marginTop: 10, fontFamily: 'Chakra Petch', fontWeight: 800, color: '#ff453a' }}>
                  {webcamError}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  <button
                    onClick={startWebcam}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontFamily: 'Chakra Petch',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => handleSelectSource('BIKE')}
                    style={{
                      background: '#ffffff',
                      border: 'none',
                      color: '#000000',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontFamily: 'Chakra Petch',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Back to Existing Camera
                  </button>
                </div>
              </div>
            ) : (
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#000000',
                }}
              />
            )
          ) : isLiveConnected && frameSrc ? (
            <img
              src={frameSrc}
              alt="Motorcycle Camera Stream"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <Icon name="camera" size={36} color="#636366" />
              <div style={{ fontSize: 12, marginTop: 8, fontFamily: 'JetBrains Mono', color: '#8e8e93' }}>
                {status.isOnline ? 'CONNECTING TO CAMERA...' : 'CAMERA OFFLINE'}
              </div>
            </div>
          )}

          {/* Top Live Overlay Bar */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              right: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 20,
            }}
          >
            {/* Live Indicator */}
            {cameraSource === 'WEBCAM' ? (
              <div
                style={{
                  background: 'rgba(0,0,0,0.8)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isWebcamActive ? '#30d158' : '#ff453a', boxShadow: isWebcamActive ? '0 0 8px #30d158' : 'none' }}></span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
                  ● {isWebcamActive ? 'WEBCAM LIVE' : 'WEBCAM'}
                </span>
              </div>
            ) : isLiveConnected ? (
              <div
                style={{
                  background: 'rgba(0,0,0,0.8)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff', boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)' }}></span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>
                  ● LIVE
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                  {formatTimer(recordingSeconds || 24)}
                </span>
              </div>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.8)', padding: '4px 10px', borderRadius: 12, fontSize: 10, color: '#8e8e93' }}>
                STANDBY
              </div>
            )}

            {/* Controls right: Lens switcher for Bike Camera, or Back/Close for Webcam */}
            {cameraSource === 'WEBCAM' ? (
              <button
                id="btn-webcam-back"
                onClick={() => handleSelectSource('BIKE')}
                title="Return to Existing Camera"
                style={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  borderRadius: 12,
                  padding: '4px 12px',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'Chakra Petch',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span>✕</span>
                <span>Back to Camera</span>
              </button>
            ) : (
              /* Lens Switcher (FRONT / REAR) - Monochrome */
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.85)', padding: 3, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setActiveFacing('FRONT')}
                  style={{
                    background: activeFacing === 'FRONT' ? '#ffffff' : 'transparent',
                    color: activeFacing === 'FRONT' ? '#000000' : '#8e8e93',
                    border: 'none',
                    borderRadius: 8,
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'Chakra Petch',
                  }}
                >
                  FRONT
                </button>
                <button
                  onClick={() => setActiveFacing('REAR')}
                  style={{
                    background: activeFacing === 'REAR' ? '#ffffff' : 'transparent',
                    color: activeFacing === 'REAR' ? '#000000' : '#8e8e93',
                    border: 'none',
                    borderRadius: 8,
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'Chakra Petch',
                  }}
                >
                  REAR
                </button>
              </div>
            )}
          </div>

          {/* Active Recording Badge */}
          {cameraStatus.isRecording && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: '#ff453a',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'JetBrains Mono',
                zIndex: 20,
              }}
            >
              <span className="dot-pulse"></span>
              <span>REC {formatTimer(recordingSeconds)}</span>
            </div>
          )}

          {/* Bottom Telemetry HUD Watermark */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              fontSize: 10,
              fontFamily: 'JetBrains Mono',
              color: 'rgba(255, 255, 255, 0.65)',
              zIndex: 20,
              textAlign: 'right',
            }}
          >
            <div>{status.speed || 0} KM/H · {status.gps?.latitude?.toFixed(4) || '12.9716'} N</div>
          </div>
        </div>

        {/* Shutter & Recording Controls Bar */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', background: '#0a0a0c', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Status info left */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>STORAGE</span>
            <span style={{ fontSize: 11, color: '#ffffff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{cameraStatus.storagePercentage}% USED</span>
          </div>

          {/* Center Circular Shutter Trigger: [ ● ] */}
          <button
            className="camera-shutter-btn"
            onClick={handleSnapshot}
            disabled={isCapturing}
            title="Capture Instant Snapshot [ ● ]"
          >
            <div className="camera-shutter-dot"></div>
          </button>

          {/* Record Button right */}
          <button
            onClick={handleToggleRecord}
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              border: cameraStatus.isRecording ? '1px solid #ff453a' : '1px solid var(--border-subtle)',
              background: cameraStatus.isRecording ? '#ff453a' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: cameraStatus.isRecording ? 2 : '50%', background: cameraStatus.isRecording ? '#ffffff' : '#ff453a' }}></span>
            <span>{cameraStatus.isRecording ? 'STOP' : 'REC'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Status Diagnostics Card */}
      <div className="card">
        <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Chakra Petch', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>TCU Camera Diagnostics</span>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#8e8e93' }}>
            {cameraStatus.resolution || '1080p@30fps'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
          <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CAMERA</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>ONLINE</div>
          </div>

          <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>4G SIGNAL</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8e8e93', marginTop: 2 }}>GOOD (-72dBm)</div>
          </div>

          <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>STORAGE</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: cameraStatus.storagePercentage > 85 ? '#ff9f0a' : '#fff', marginTop: 2 }}>
              {cameraStatus.storagePercentage || 34}%
            </div>
          </div>
        </div>

        {/* Storage Bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>eMMC Memory: {((cameraStatus.storageUsed || 21450) / 1000).toFixed(1)} GB used</span>
            <span>Capacity: 64 GB</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${cameraStatus.storagePercentage || 34}%`,
                background: '#ffffff',
                borderRadius: 2,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Captured Events & Gallery Section */}
      <div className="card">
        <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'Chakra Petch', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Camera Events & Gallery</span>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#ffffff', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 10 }}>
            {events.length} CAPTURES
          </span>
        </div>

        {events.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((evt) => (
              <div
                key={evt._id || evt.eventId}
                onClick={() => setPreviewMedia(evt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: evt.eventType === 'UNAUTHORIZED_ACCESS'
                    ? 'rgba(255, 69, 58, 0.1)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: evt.eventType === 'UNAUTHORIZED_ACCESS'
                    ? '1px solid rgba(255, 69, 58, 0.3)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: '#161619',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Icon
                    name={evt.mediaType === 'VIDEO' ? 'video' : 'camera'}
                    size={20}
                    color={evt.eventType === 'UNAUTHORIZED_ACCESS' ? '#ff453a' : '#ffffff'}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: evt.eventType === 'UNAUTHORIZED_ACCESS' ? '#ff453a' : '#fff' }}>
                      {evt.eventType === 'UNAUTHORIZED_ACCESS' ? '🚨 SECURITY TAMPER SNAP' : evt.eventType}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {evt.mediaReference || 'Snapshot frame'} · Lens: {evt.metadata?.cameraFacing || 'FRONT'}
                    {evt.duration ? ` · ${evt.duration}s` : ''}
                  </div>
                </div>

                <span style={{ fontSize: 13, color: '#8e8e93' }}>➔</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            No snapshots recorded yet. Tap [ ● ] to capture a live road frame.
          </div>
        )}
      </div>

      {/* Full-screen Media Preview Modal */}
      {previewMedia && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 400, background: '#0d0d0f', borderRadius: 20, border: '1px solid var(--border-contrast)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {previewMedia.eventType}
              </span>
              <button
                onClick={() => setPreviewMedia(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Media Image / Video Preview */}
            <div style={{ width: '100%', height: 220, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={previewMedia.dataUrl || `${API_BASE}/motorcycles/${motorcycle?._id}/camera/frame?facing=${previewMedia.metadata?.cameraFacing || 'FRONT'}&t=${Date.now()}`}
                alt="Captured Snapshot"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>FILE: {previewMedia.mediaReference}</div>
                <div>TIME: {new Date(previewMedia.timestamp).toLocaleString()}</div>
                <div>LENS: {previewMedia.metadata?.cameraFacing || 'FRONT'} HD CAMERA</div>
                <div>SOURCE: {previewMedia.metadata?.triggerSource || 'USER_APP'}</div>
              </div>

              <button
                className="btn-primary"
                onClick={() => setPreviewMedia(null)}
                style={{ marginTop: 14 }}
              >
                CLOSE PREVIEW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
