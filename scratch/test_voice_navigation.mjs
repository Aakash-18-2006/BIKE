/**
 * test_voice_navigation.mjs - Unit & Simulation Test for Voice Navigation Engine
 */
import {
  VoiceNavigationController,
  formatDistanceVoiceAnnouncement,
  isSpeechSupported,
} from '../mobile-app/src/utils/voiceNavigation.js';

// Setup Mock SpeechSynthesis environment
const spokenHistory = [];
let isCancelled = false;

globalThis.window = {
  speechSynthesis: {
    speak: (utterance) => {
      spokenHistory.push(utterance.text);
    },
    cancel: () => {
      isCancelled = true;
    },
    getVoices: () => [
      { name: 'Google English (India)', lang: 'en-IN', default: true },
      { name: 'Google US English', lang: 'en-US', default: false },
    ],
  },
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
  },
};

async function runVoiceTests() {
  console.log('=== [TEST] Starting Voice Navigation Engine Test Suite ===\n');

  // Test 1: Speech Support Detection
  console.log('--- 1. Testing Speech Synthesis Detection ---');
  if (!isSpeechSupported()) throw new Error('Speech synthesis should be supported in mock environment');
  console.log('✔ Speech synthesis is properly detected');

  // Test 2: Distance Voice Formatting
  console.log('\n--- 2. Testing Spoken Phrase Formatting ---');
  const phrase500 = formatDistanceVoiceAnnouncement('Turn right onto MG Road', 'right', 'MG Road', 500);
  console.log('500m phrase:', phrase500);
  if (!phrase500.includes('500 meters') || !phrase500.includes('Turn right')) {
    throw new Error(`Unexpected 500m phrase: ${phrase500}`);
  }

  const phrase200 = formatDistanceVoiceAnnouncement('Turn left onto Hosur Road', 'left', 'Hosur Road', 200);
  console.log('200m phrase:', phrase200);
  if (!phrase200.includes('200 meters') || !phrase200.includes('Turn left')) {
    throw new Error(`Unexpected 200m phrase: ${phrase200}`);
  }

  const phraseUturn = formatDistanceVoiceAnnouncement('Make a U-turn onto Outer Ring Road', 'uturn', 'Outer Ring Road', 50);
  console.log('50m U-turn phrase:', phraseUturn);
  if (!phraseUturn.includes('50 meters') || !phraseUturn.includes('Make a U-turn')) {
    throw new Error(`Unexpected U-turn phrase: ${phraseUturn}`);
  }
  console.log('✔ Natural spoken phrase formatting verified');

  // Test 3: Controller Lifecycle: Start Navigation
  console.log('\n--- 3. Testing Start Navigation Announcement ---');
  const controller = new VoiceNavigationController();
  spokenHistory.length = 0;

  controller.announceStart('Continue straight on Kasturba Road');
  if (spokenHistory.length !== 1 || !spokenHistory[0].includes('Navigation started')) {
    throw new Error(`Expected start announcement, got: ${spokenHistory[0]}`);
  }
  console.log('✔ Spoken start instruction:', spokenHistory[0]);

  // Test 4: Distance Thresholds & Duplicate Prevention
  console.log('\n--- 4. Testing Distance Thresholds & Duplicate Prevention ---');
  spokenHistory.length = 0;

  // Telemetry: 600m away (no announcement yet)
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 600,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 0) throw new Error('Should not announce above 550m');

  // Telemetry: 500m away -> 500m threshold announced
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 500,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 1 || !spokenHistory[0].includes('500 meters')) {
    throw new Error(`Expected 500m announcement, got: ${spokenHistory[0]}`);
  }
  console.log('✔ 500m announcement triggered:', spokenHistory[0]);

  // Telemetry: 480m, 450m, 420m -> MUST NOT REPEAT 500m
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 480,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 450,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 1) {
    throw new Error(`Repeated announcement detected! Count: ${spokenHistory.length}`);
  }
  console.log('✔ Verified 500m threshold is NOT repeated on subsequent GPS ticks');

  // Telemetry: 200m away -> 200m threshold announced
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 200,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 2 || !spokenHistory[1].includes('200 meters')) {
    throw new Error(`Expected 200m announcement, got: ${spokenHistory[1]}`);
  }
  console.log('✔ 200m announcement triggered:', spokenHistory[1]);

  // Telemetry: 180m, 150m -> MUST NOT REPEAT 200m
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 180,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 2) throw new Error('200m repeated!');

  // Telemetry: 50m away -> 50m threshold announced
  controller.update({
    activeStepIndex: 0,
    distanceToNextTurn: 50,
    currentStep: { instruction: 'Turn right onto MG Road', turnDirection: 'right', roadName: 'MG Road' },
  });
  if (spokenHistory.length !== 3 || !spokenHistory[2].includes('50 meters')) {
    throw new Error(`Expected 50m announcement, got: ${spokenHistory[2]}`);
  }
  console.log('✔ 50m announcement triggered:', spokenHistory[2]);

  // Test 5: Step Advancement
  console.log('\n--- 5. Testing Step Advancement (Next Maneuver) ---');
  // Rider completes turn and enters stepIndex: 1
  controller.update({
    activeStepIndex: 1,
    distanceToNextTurn: 1200,
    currentStep: { instruction: 'Continue straight on Outer Ring Road', turnDirection: 'straight', roadName: 'Outer Ring Road' },
  });
  if (spokenHistory.length !== 4 || !spokenHistory[3].includes('Continue straight on Outer Ring Road')) {
    throw new Error(`Expected step 1 maneuver instruction, got: ${spokenHistory[3]}`);
  }
  console.log('✔ Step advancement announcement:', spokenHistory[3]);

  // Test 6: Destination Reached
  console.log('\n--- 6. Testing Destination Arrival ---');
  controller.update({
    activeStepIndex: 2,
    distanceToNextTurn: 0,
    isDestinationReached: true,
    currentStep: { instruction: 'Arrived at destination' },
  });
  const lastSpoken = spokenHistory[spokenHistory.length - 1];
  if (!lastSpoken.includes('arrived at your destination')) {
    throw new Error(`Expected arrival announcement, got: ${lastSpoken}`);
  }
  console.log('✔ Destination arrival announcement:', lastSpoken);

  // Subsequent updates after arrival must not speak
  const countAtArrival = spokenHistory.length;
  controller.update({
    activeStepIndex: 2,
    distanceToNextTurn: 0,
    isDestinationReached: true,
    currentStep: { instruction: 'Arrived at destination' },
  });
  if (spokenHistory.length !== countAtArrival) {
    throw new Error('Spoke after arrival!');
  }
  console.log('✔ No further turn announcements after arrival verified');

  // Test 7: Stop Navigation & Cancel
  console.log('\n--- 7. Testing Stop Navigation & Cancel ---');
  isCancelled = false;
  controller.reset();
  if (!isCancelled) throw new Error('Expected speech cancellation on reset');
  console.log('✔ Speech cancelled on navigation stop');

  // Test 8: Voice Mute / Unmute
  console.log('\n--- 8. Testing Voice Enable / Disable (Mute) ---');
  spokenHistory.length = 0;
  controller.setEnabled(false);
  controller.announceStart('Test instruction when muted');
  if (spokenHistory.length !== 0) throw new Error('Spoke while muted!');
  console.log('✔ Mute successfully silenced announcements');

  controller.setEnabled(true);
  controller.announceStart('Test instruction when unmuted');
  if (spokenHistory.length !== 1) throw new Error('Failed to speak after unmute!');
  console.log('✔ Unmute successfully restored announcements');

  // Test 9: Robustness when SpeechSynthesis is unavailable
  console.log('\n--- 9. Testing Safe Fallback without Speech Synthesis ---');
  const originalSynth = globalThis.window.speechSynthesis;
  globalThis.window.speechSynthesis = undefined;

  try {
    const headlessController = new VoiceNavigationController();
    headlessController.announceStart('Headless test');
    headlessController.update({
      activeStepIndex: 0,
      distanceToNextTurn: 200,
      currentStep: { instruction: 'Test' },
    });
    headlessController.announceArrival();
    headlessController.reset();
    console.log('✔ Safe fallback verified: no crash when SpeechSynthesis is undefined');
  } finally {
    globalThis.window.speechSynthesis = originalSynth;
  }

  console.log('\n==================================================');
  console.log('🎉 ALL 9 VOICE NAVIGATION TESTS PASSED PERFECTLY!');
  console.log('==================================================\n');
}

runVoiceTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
