import React from 'react';
import { Icon } from './Icons.jsx';

/**
 * Premium Monochrome Security Theft Alert Modal
 * High-priority serious automotive security warning layout:
 * - SECURITY ALERT
 * - Possible unauthorized movement
 * - Action buttons: [ VIEW LOCATION ], [ VIEW CAMERA ], [ SECURE VEHICLE ]
 */
export function SecurityAlertModal({ alert, onNavigate, onSecureVehicle, onDismiss }) {
  if (!alert) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#0d0d0f',
          border: '1px solid #ff453a',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 69, 58, 0.25)',
          textAlign: 'center',
        }}
      >
        {/* Warning Indicator Mark */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255, 69, 58, 0.15)',
            border: '1px solid #ff453a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
          }}
        >
          <Icon name="shield" size={24} color="#ff453a" />
        </div>

        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '0 0 12px 0' }}></div>

        <h3
          style={{
            fontFamily: 'Chakra Petch',
            fontSize: 20,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: 2,
            margin: '0 0 6px 0',
            textTransform: 'uppercase',
          }}
        >
          SECURITY ALERT
        </h3>

        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '0 0 14px 0' }}></div>

        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
          {alert.message || 'Possible unauthorized movement'}
        </p>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
          Location tracked · Drivetrain interlock active
        </p>

        {/* 3 Action Buttons matching spec */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary: VIEW LOCATION */}
          <button
            onClick={() => { onNavigate('location'); onDismiss(); }}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="mapPin" size={16} color="#000000" />
            <span>VIEW LOCATION</span>
          </button>

          {/* Secondary: VIEW CAMERA */}
          <button
            onClick={() => { onNavigate('camera'); onDismiss(); }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="camera" size={16} color="#ffffff" />
            <span>VIEW CAMERA</span>
          </button>

          {/* Danger/Security: SECURE VEHICLE */}
          <button
            onClick={() => {
              if (onSecureVehicle) onSecureVehicle();
              else onNavigate('security');
              onDismiss();
            }}
            className="btn-danger"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="lock" size={16} color="#ff453a" />
            <span>SECURE VEHICLE</span>
          </button>
        </div>

        <button
          onClick={onDismiss}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Silence Alarm & Dismiss
        </button>
      </div>
    </div>
  );
}

export default SecurityAlertModal;
