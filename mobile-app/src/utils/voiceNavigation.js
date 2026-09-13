/**
 * voiceNavigation.js - Real-Time Turn-by-Turn Voice Navigation Engine
 * 
 * Uses HTML5 SpeechSynthesis API (window.speechSynthesis, SpeechSynthesisUtterance)
 * to provide spoken navigation instructions for motorcycle riders.
 * 
 * Features:
 * - Start navigation greeting & initial instruction
 * - Distance-based threshold announcements (500m, 200m, 50m)
 * - Automatic turn-advancement announcements
 * - Duplicate prevention per step and threshold
 * - Destination arrival announcement
 * - English voice selection with preference for Indian English (en-IN)
 * - Safe non-blocking execution (failures never interrupt map, GPS, or WebSocket)
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Checks if Speech Synthesis is supported in the current environment
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Selects preferred English voice, prioritizing Indian English (en-IN)
 */
export function getPreferredVoice() {
  if (!isSpeechSupported()) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!Array.isArray(voices) || voices.length === 0) return null;

    // 1. Prefer English (India)
    const indianVoice = voices.find(
      (v) => v.lang && (v.lang === 'en-IN' || v.lang.replace('_', '-').toLowerCase() === 'en-in')
    );
    if (indianVoice) return indianVoice;

    // 2. Prefer any English dialect (en-US, en-GB, etc.)
    const englishVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith('en')
    );
    if (englishVoice) return englishVoice;

    // 3. Fallback to default
    const defaultVoice = voices.find((v) => v.default);
    return defaultVoice || voices[0] || null;
  } catch (e) {
    console.warn('[Voice Nav] Voice detection notice:', e);
    return null;
  }
}

/**
 * Safely speaks a text string using SpeechSynthesisUtterance
 */
export function speakText(text, options = {}) {
  if (!isSpeechSupported() || typeof window === 'undefined' || !window.speechSynthesis || !text) return;

  try {
    const synth = window.speechSynthesis;

    // Cancel any previous in-flight utterance so announcements do not queue up and lag behind real-time location
    if (typeof synth.cancel === 'function') {
      synth.cancel();
    }

    const cleanText = String(text).trim();
    if (!cleanText) return;

    const UtteranceConstructor = window.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
    if (!UtteranceConstructor) return;

    const utterance = new UtteranceConstructor(cleanText);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume !== undefined ? options.volume : 1.0;

    const voice = getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onerror = (event) => {
      // Speech errors should never break navigation
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('[Voice Nav] Speech playback notice:', event.error);
      }
    };

    if (typeof synth.speak === 'function') {
      synth.speak(utterance);
      console.log(`[Voice Nav Spoken] "${cleanText}"`);
    }
  } catch (err) {
    console.warn('[Voice Nav] Failed to speak instruction:', err);
  }
}

/**
 * Cancels any currently queued or active speech
 */
export function cancelSpeech() {
  if (!isSpeechSupported() || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    if (typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
      console.log('[Voice Nav] Speech cancelled');
    }
  } catch (e) {
    console.warn('[Voice Nav] Cancel notice:', e);
  }
}

/**
 * Formats natural spoken distance guidance for turns
 * e.g. "Turn right in 500 meters." or "In 200 meters, turn left onto MG Road."
 */
export function formatDistanceVoiceAnnouncement(instruction, maneuver, roadName, distanceMeters) {
  const distText = distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1)} kilometers`
    : `${distanceMeters} meters`;

  const m = String(maneuver || '').toLowerCase();
  const ins = String(instruction || '').trim();

  // "Turn right onto MG Road" -> "Turn right in 500 meters"
  if (/^turn\s+(right|left|sharp right|sharp left|slight right|slight left)/i.test(ins)) {
    const match = ins.match(/^(turn\s+[\w\s]+?)(?:\s+onto|\s+on|$)/i);
    const action = match ? match[1] : ins;
    return `${action} in ${distText}.`;
  }

  if (/^make a u-turn/i.test(ins) || m === 'uturn' || m === 'u_turn') {
    return `Make a U-turn in ${distText}.`;
  }

  if (/^enter roundabout/i.test(ins) || m === 'roundabout') {
    return `Enter roundabout in ${distText}.`;
  }

  if (/^continue straight/i.test(ins) || m === 'straight' || m === 'continue') {
    return `Continue straight for ${distText}.`;
  }

  if (m.includes('right') || m.includes('left')) {
    return `${ins || 'Turn'} in ${distText}.`;
  }

  return `In ${distText}, ${ins.toLowerCase()}.`;
}

/**
 * Formats Step 4 turn guidance stage voice announcements:
 * - 200m stage: "Turn left onto MG Road in 200 meters."
 * - 100m stage: "Turn left in 100 meters."
 * - 50m stage: "Turn left in 50 meters."
 * - NOW stage: "Turn left now."
 */
export function formatStageVoiceAnnouncement(instruction, maneuver, roadName, stage) {
  const ins = String(instruction || '').trim();
  const m = String(maneuver || '').toLowerCase();

  let action = 'Continue straight';
  const match = ins.match(/^(turn\s+[\w\s]+?|make\s+a\s+u-turn|enter\s+roundabout|take\s+the\s+exit|merge)(?:\s+onto|\s+on|$)/i);
  if (match) {
    action = match[1].trim();
  } else if (/^turn\s+/i.test(ins)) {
    action = ins;
  } else if (m.includes('left')) {
    action = m.includes('slight') ? 'Turn slight left' : (m.includes('sharp') ? 'Turn sharp left' : 'Turn left');
  } else if (m.includes('right')) {
    action = m.includes('slight') ? 'Turn slight right' : (m.includes('sharp') ? 'Turn sharp right' : 'Turn right');
  } else if (m.includes('uturn') || m === 'u_turn') {
    action = 'Make a U-turn';
  } else if (m.includes('roundabout')) {
    action = 'Enter roundabout';
  } else if (ins) {
    action = ins;
  }

  if (stage === 'NOW' || stage === 'now' || stage <= 15) {
    return `${action} now.`;
  }

  if (stage === '200m' || stage === 200) {
    if (roadName) {
      return `${action} onto ${roadName} in 200 meters.`;
    }
    return `${action} in 200 meters.`;
  }

  if (stage === '100m' || stage === 100) {
    return `${action} in 100 meters.`;
  }

  if (stage === '50m' || stage === 50) {
    return `${action} in 50 meters.`;
  }

  return `${action} in ${stage} meters.`;
}

/**
 * Voice Navigation Controller Class
 * Keeps track of announced steps and distance thresholds to strictly prevent duplicate speech
 */
export class VoiceNavigationController {
  constructor() {
    this.enabled = true;
    this.currentStepIndex = -1;
    this.announcedThresholds = new Set();
    this.hasAnnouncedStart = false;
    this.hasAnnouncedArrival = false;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (!this.enabled) {
      this.cancel();
    }
  }

  cancel() {
    cancelSpeech();
  }

  reset() {
    this.cancel();
    this.currentStepIndex = -1;
    this.announcedThresholds.clear();
    this.hasAnnouncedStart = false;
    this.hasAnnouncedArrival = false;
  }

  announceStart(firstInstruction) {
    this.reset();
    if (!this.enabled) return;
    this.hasAnnouncedStart = true;
    const text = firstInstruction
      ? `Navigation started. ${firstInstruction}.`
      : 'Navigation started. Follow the highlighted route.';
    speakText(text);
  }

  announceArrival() {
    if (!this.enabled || this.hasAnnouncedArrival) return;
    this.hasAnnouncedArrival = true;
    this.cancel();
    speakText('You have arrived at your destination.');
  }

  update(telemetry) {
    if (!this.enabled || !telemetry) return;

    // Reset voice announcement state if off-route or recalculating
    if (telemetry.isOffRoute || telemetry.offRoute || telemetry.isRerouting) {
      this.announcedThresholds.clear();
      return;
    }

    if (telemetry.isDestinationReached || telemetry.arrived) {
      this.announceArrival();
      return;
    }

    if (this.hasAnnouncedArrival) return;

    const stepIndex = telemetry.activeStepIndex ?? telemetry.currentStepIndex ?? 0;
    const distanceMeters = telemetry.distanceToTurn ?? telemetry.distanceToManeuver ?? 0;
    const instruction = telemetry.nextInstruction || telemetry.currentStep?.instruction || '';
    const maneuver = telemetry.nextManeuver || telemetry.currentStep?.normalizedManeuver || telemetry.currentStep?.turnDirection || '';
    const roadName = telemetry.nextRoadName || telemetry.currentStep?.roadName || '';

    // Step Advancement: when the rider enters a new maneuver step
    if (this.currentStepIndex !== stepIndex) {
      const prevStep = this.currentStepIndex;
      this.currentStepIndex = stepIndex;
      this.announcedThresholds.clear();

      // Announce new instruction on step advancement if rider is not already right at upcoming turn
      if (prevStep >= 0 && stepIndex > prevStep) {
        if (instruction && distanceMeters > 220) {
          speakText(instruction);
        }
      }
      this.hasAnnouncedStart = false;
    }

    // Step 4 Turn Guidance Distance Bands:
    // Stage 200m: distance <= 220m and > 100m
    if (distanceMeters <= 220 && distanceMeters > 100 && !this.announcedThresholds.has('200m')) {
      this.announcedThresholds.add('200m');
      console.log(`[MAPPLS VOICE] Announcing step ${stepIndex} stage 200m`);
      const text = formatStageVoiceAnnouncement(instruction, maneuver, roadName, '200m');
      speakText(text);
    }
    // Stage 100m: distance <= 100m and > 50m
    else if (distanceMeters <= 100 && distanceMeters > 50 && !this.announcedThresholds.has('100m')) {
      this.announcedThresholds.add('100m');
      console.log(`[MAPPLS VOICE] Announcing step ${stepIndex} stage 100m`);
      const text = formatStageVoiceAnnouncement(instruction, maneuver, roadName, '100m');
      speakText(text);
    }
    // Stage 50m: distance <= 50m and > 15m
    else if (distanceMeters <= 50 && distanceMeters > 15 && !this.announcedThresholds.has('50m')) {
      this.announcedThresholds.add('50m');
      console.log(`[MAPPLS VOICE] Announcing step ${stepIndex} stage 50m`);
      const text = formatStageVoiceAnnouncement(instruction, maneuver, roadName, '50m');
      speakText(text);
    }
    // Stage NOW: distance <= 15m
    else if (distanceMeters <= 15 && !this.announcedThresholds.has('NOW')) {
      this.announcedThresholds.add('NOW');
      console.log(`[MAPPLS VOICE] Announcing step ${stepIndex} stage NOW`);
      const text = formatStageVoiceAnnouncement(instruction, maneuver, roadName, 'NOW');
      speakText(text);
    }
  }
}

/**
 * Reusable React Hook for Voice Turn-by-Turn Navigation
 */
export function useVoiceNavigation(isNavigating, navTelemetry, isVoiceEnabled = true) {
  const controllerRef = useRef(null);

  if (!controllerRef.current) {
    controllerRef.current = new VoiceNavigationController();
  }

  // Sync voice enabled state
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setEnabled(isVoiceEnabled);
    }
  }, [isVoiceEnabled]);

  // Sync navigation telemetry updates
  useEffect(() => {
    if (!isNavigating) {
      if (controllerRef.current) {
        controllerRef.current.reset();
      }
      return;
    }

    if (controllerRef.current && navTelemetry) {
      controllerRef.current.update(navTelemetry);
    }
  }, [isNavigating, navTelemetry]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []);

  return controllerRef.current;
}
