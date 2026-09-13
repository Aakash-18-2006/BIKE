/**
 * soundAlert.js - Synthesizes an audible warning siren using HTML5 Web Audio API
 * Works across desktop and mobile browsers without requiring external audio asset files.
 */
let audioCtx = null;
let sirenInterval = null;
let currentOscillator = null;

export function playWarningAlarmSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx = new AudioContext();
    }

    if (sirenInterval) {
      clearInterval(sirenInterval);
    }

    let isHigh = false;
    const playTone = () => {
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isHigh ? 1300 : 850, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.28);
      currentOscillator = osc;

      isHigh = !isHigh;
    };

    // Pulse 8 times (roughly 3 seconds of alert siren)
    let count = 0;
    playTone();
    sirenInterval = setInterval(() => {
      count++;
      if (count > 8) {
        clearInterval(sirenInterval);
        sirenInterval = null;
      } else {
        playTone();
      }
    }, 320);
  } catch (e) {
    console.warn('[Audio Alert] Sound playback skipped:', e.message);
  }
}

export function stopWarningAlarmSound() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

/**
 * Fires OS-level notification where permission is granted
 */
export function sendOsNotification(title, body) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          vibrate: [200, 100, 200, 100, 400],
        });
      } catch (e) {}
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}
