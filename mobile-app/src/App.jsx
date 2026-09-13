import React, { useState } from 'react';
import { BikeProvider, useBike } from './context/BikeContext.jsx';
import { Icon } from './components/common/Icons.jsx';
import { SplashScreen, LoginScreen, RegisterScreen } from './screens/AuthScreens.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { LiveStatusScreen, LocationScreen } from './screens/LiveAndLocationScreens.jsx';
import { RemoteControlsScreen } from './screens/RemoteControlsScreen.jsx';
import { NavigationScreen, RideStatsScreen, RideHistoryScreen } from './screens/RidesAndNavScreens.jsx';
import { SecurityScreen, NotificationsScreen } from './screens/SecurityAndAlertScreens.jsx';
import { SpeedometerSettingsScreen, ProfileScreen, AppSettingsScreen } from './screens/SettingsScreens.jsx';
import { CameraScreen } from './screens/CameraScreen.jsx';
import { SecurityAlertModal } from './components/common/SecurityAlertModal.jsx';

function MainShell() {
  const { token, toastMessage, theftAlert, dismissTheftAlert, secureVehicle } = useBike();
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [menuOpen, setMenuOpen] = useState(false);

  // If splash was clicked, advance to dashboard or login
  const handleSplashFinish = () => {
    if (token) setCurrentScreen('dashboard');
    else setCurrentScreen('auth');
  };

  // Screens directory definition
  const screens = [
    { id: 'dashboard', name: 'Home Dashboard', icon: 'home', group: 'Core' },
    { id: 'camera', name: 'Bike Camera', icon: 'camera', group: 'Hardware' },
    { id: 'telemetry', name: 'Live Telemetry', icon: 'activity', group: 'Core' },
    { id: 'controls', name: 'Remote Controls', icon: 'zap', group: 'Core' },
    { id: 'location', name: 'Bike Location', icon: 'mapPin', group: 'Drive' },
    { id: 'navigation', name: 'Route Navigation', icon: 'navigation', group: 'Drive' },
    { id: 'stats', name: 'Ride Statistics', icon: 'activity', group: 'History' },
    { id: 'history', name: 'Ride History', icon: 'compass', group: 'History' },
    { id: 'security', name: 'Security & Alarm', icon: 'shield', group: 'Security' },
    { id: 'notifications', name: 'Notifications', icon: 'bell', group: 'Security' },
    { id: 'speedometer', name: 'Speedometer Settings', icon: 'gauge', group: 'Settings' },
    { id: 'profile', name: 'Rider Profile', icon: 'user', group: 'Settings' },
    { id: 'settings', name: 'App Settings', icon: 'settings', group: 'Settings' },
  ];

  // Automatically advance to dashboard when token is acquired
  React.useEffect(() => {
    if (token && (currentScreen === 'auth' || currentScreen === 'splash')) {
      setCurrentScreen('dashboard');
    }
  }, [token, currentScreen]);

  const renderScreenContent = () => {
    if (currentScreen === 'splash') {
      return <SplashScreen onFinish={handleSplashFinish} />;
    }

    if (currentScreen === 'auth' || !token) {
      return authMode === 'login' ? (
        <LoginScreen
          onSwitchToRegister={() => setAuthMode('register')}
          onLoginSuccess={() => setCurrentScreen('dashboard')}
        />
      ) : (
        <RegisterScreen
          onSwitchToLogin={() => setAuthMode('login')}
          onRegisterSuccess={() => setCurrentScreen('dashboard')}
        />
      );
    }

    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen onNavigate={setCurrentScreen} />;
      case 'telemetry':
        return <LiveStatusScreen />;
      case 'controls':
        return <RemoteControlsScreen />;
      case 'location':
        return <LocationScreen onNavigate={setCurrentScreen} />;
      case 'navigation':
        return <NavigationScreen onNavigate={setCurrentScreen} onBack={() => setCurrentScreen('dashboard')} />;
      case 'stats':
        return <RideStatsScreen />;
      case 'history':
        return <RideHistoryScreen />;
      case 'security':
        return <SecurityScreen onNavigate={setCurrentScreen} />;
      case 'camera':
        return <CameraScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'speedometer':
        return <SpeedometerSettingsScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'settings':
        return <AppSettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setCurrentScreen} />;
    }
  };

  const isAuthOrSplash = currentScreen === 'splash' || currentScreen === 'auth' || !token;

  return (
    <div className="app-container">
      <div className="device-frame">
        {/* Phone Notch & Clock Header */}
        <div className="phone-notch-bar">
          <span>9:41</span>
          <div className="phone-notch-island"></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#00f0ff', fontFamily: 'JetBrains Mono' }}>4G</span>
            <Icon name="battery" size={14} color="#30d158" />
          </div>
        </div>

        {/* Global Security Theft Alert Modal */}
        <SecurityAlertModal
          alert={theftAlert}
          onNavigate={setCurrentScreen}
          onSecureVehicle={secureVehicle}
          onDismiss={dismissTheftAlert}
        />

        {/* Global Floating Toast */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: 48,
              left: 16,
              right: 16,
              zIndex: 100,
              padding: '10px 14px',
              borderRadius: 12,
              background:
                toastMessage.type === 'error'
                  ? 'rgba(255, 69, 58, 0.95)'
                  : toastMessage.type === 'success'
                  ? 'rgba(48, 209, 88, 0.95)'
                  : 'rgba(0, 240, 255, 0.95)',
              color: toastMessage.type === 'error' ? '#fff' : '#040810',
              fontWeight: 700,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.2s ease',
              pointerEvents: 'none',
            }}
          >
            <span>{toastMessage.msg}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>NOW</span>
          </div>
        )}

        {/* Screen Selector Drawer Toggle */}
        {!isAuthOrSplash && (
          <div style={{ padding: '6px 16px 0 16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#00f0ff',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Screens ({screens.length})</span>
              <span>{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        )}

        {/* Modal 15-Screen Quick Switcher */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 76,
              left: 16,
              right: 16,
              bottom: 80,
              background: 'rgba(9, 12, 19, 0.98)',
              border: '1px solid var(--border-glow)',
              borderRadius: 20,
              zIndex: 80,
              padding: 16,
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                ALL 15 APPLICATION SCREENS
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {screens.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setCurrentScreen(sc.id);
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: currentScreen === sc.id ? '1px solid #00f0ff' : '1px solid var(--border-subtle)',
                    background: currentScreen === sc.id ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: currentScreen === sc.id ? '#00f0ff' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <Icon name={sc.icon} size={16} color={currentScreen === sc.id ? '#00f0ff' : '#8492a6'} />
                  <span>{sc.name}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Special Screens:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setCurrentScreen('splash'); setMenuOpen(false); }}
                  style={{ flex: 1, padding: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}
                >
                  1. Splash Screen
                </button>
                <button
                  onClick={() => { setCurrentScreen('auth'); setAuthMode('login'); setMenuOpen(false); }}
                  style={{ flex: 1, padding: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}
                >
                  2. Login Screen
                </button>
                <button
                  onClick={() => { setCurrentScreen('auth'); setAuthMode('register'); setMenuOpen(false); }}
                  style={{ flex: 1, padding: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}
                >
                  3. Register Screen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Screen Content */}
        <div className={`screen-scroll-container ${currentScreen === 'navigation' ? 'nav-fullscreen' : ''}`}>
          {renderScreenContent()}
        </div>

        {/* Bottom Navigation Dock */}
        {!isAuthOrSplash && (
          <div className="bottom-nav">
            <button
              className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('dashboard')}
            >
              <Icon name="home" size={20} />
              <span>Home</span>
            </button>

            <button
              className={`nav-item ${currentScreen === 'location' || currentScreen === 'navigation' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('navigation')}
            >
              <Icon name="mapPin" size={20} />
              <span>Maps</span>
            </button>

            <button
              className={`nav-item ${currentScreen === 'camera' || currentScreen === 'telemetry' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('camera')}
            >
              <Icon name="camera" size={20} />
              <span>Camera</span>
            </button>

            <button
              className={`nav-item ${currentScreen === 'security' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('security')}
            >
              <Icon name="shield" size={20} />
              <span>Security</span>
            </button>

            <button
              className={`nav-item ${currentScreen === 'profile' || currentScreen === 'stats' || currentScreen === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('profile')}
            >
              <Icon name="user" size={20} />
              <span>Profile</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BikeProvider>
      <MainShell />
    </BikeProvider>
  );
}
