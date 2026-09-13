import React from 'react';
import { useBike } from '../context/BikeContext.jsx';

export function SplashScreen({ onFinish }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
      padding: 30,
      background: '#000000',
    }}>
      <div style={{
        width: 170,
        height: 170,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        filter: 'drop-shadow(0 0 35px rgba(212, 175, 55, 0.45))',
      }}>
        <img
          src="/brand-logo.png"
          alt="AEROVYN Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      <h1 style={{
        fontFamily: 'Chakra Petch',
        fontSize: 32,
        fontWeight: 700,
        letterSpacing: 2,
        color: '#ffffff',
        textTransform: 'uppercase',
      }}>
        AEROVYN
      </h1>
      <p style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        letterSpacing: 3,
        marginTop: 6,
        textTransform: 'uppercase',
      }}>
        Smart IoT Motorcycle System
      </p>

      <div style={{ marginTop: 40, width: '100%' }}>
        <button className="btn-primary" onClick={onFinish} style={{ width: '100%', padding: '14px' }}>
          ENTER COCKPIT
        </button>
      </div>

      <div style={{
        marginTop: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'JetBrains Mono',
      }}>
        <span className="dot-pulse" style={{ color: '#ffffff' }}></span>
        <span>LTE ONLINE · STANDBY GUARD READY</span>
      </div>
    </div>
  );
}

export function LoginScreen({ onSwitchToRegister, onLoginSuccess }) {
  const [email, setEmail] = React.useState('demo@smartbike.io');
  const [password, setPassword] = React.useState('Password123!');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { login } = useBike();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (res && res.success) {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setError(res?.error || 'Invalid email or password');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 8px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 26, color: '#ffffff', letterSpacing: 1 }}>RIDER LOGIN</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Access your connected motorcycle telemetry</p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 59, 48, 0.12)',
          border: '1px solid rgba(255, 59, 48, 0.4)',
          color: '#ff3b30',
          padding: 12,
          borderRadius: 10,
          fontSize: 12,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Email Address</label>
          <input
            className="input-field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 12, width: '100%', padding: '13px' }}>
          {loading ? 'AUTHENTICATING...' : 'SECURE LOGIN'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={onSwitchToRegister}
          style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
        >
          New rider? Register motorcycle pairing →
        </button>
      </div>
    </div>
  );
}

export function RegisterScreen({ onSwitchToLogin, onRegisterSuccess }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { register } = useBike();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await register(name, email, password, phone);
      if (res && res.success) {
        if (onRegisterSuccess) onRegisterSuccess();
      } else {
        setError(res?.error || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 8px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 26, color: '#ffffff', letterSpacing: 1 }}>CREATE ACCOUNT</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Pair your LTE Smart Motorcycle</p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 59, 48, 0.12)',
          border: '1px solid rgba(255, 59, 48, 0.4)',
          color: '#ff3b30',
          padding: 12,
          borderRadius: 10,
          fontSize: 12,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Rider Full Name</label>
          <input
            className="input-field"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Alex Mercer"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Email Address</label>
          <input
            className="input-field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="alex@smartbike.io"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Phone Number (Optional)</label>
          <input
            className="input-field"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 382-9012"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Min 6 characters"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 12, width: '100%', padding: '13px' }}>
          {loading ? 'CREATING...' : 'REGISTER & PAIR'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={onSwitchToLogin}
          style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Already registered? Log in here →
        </button>
      </div>
    </div>
  );
}
