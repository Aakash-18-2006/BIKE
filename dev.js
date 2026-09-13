// dev.js - Cross-platform runner to start all Smart Bike subsystems
const { spawn } = require('child_process');
const path = require('path');

console.log('================================================================');
console.log('  STARTING CONNECTED SMART MOTORCYCLE SUBSYSTEMS');
console.log('================================================================');
console.log('  1. Backend API & MQTT Broker  -> http://localhost:5000 (MQTT 1883)');
console.log('  2. Bike Simulator & TCU       -> http://localhost:5005');
console.log('  3. TFT Speedometer Cluster    -> http://localhost:5174');
console.log('  4. Mobile Application         -> http://localhost:3000');
console.log('================================================================\n');

const services = [
  {
    name: 'BACKEND',
    color: '\x1b[36m', // Cyan
    cmd: 'node',
    args: ['src/server.js'],
    cwd: path.resolve(__dirname, 'backend'),
  },
  {
    name: 'SIMULATOR',
    color: '\x1b[33m', // Yellow
    cmd: 'node',
    args: ['src/index.js'],
    cwd: path.resolve(__dirname, 'bike-simulator'),
  },
  {
    name: 'SPEEDOMETER',
    color: '\x1b[35m', // Magenta
    cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['vite', '--port', '5174', '--host'],
    cwd: path.resolve(__dirname, 'speedometer'),
  },
  {
    name: 'MOBILE',
    color: '\x1b[32m', // Green
    cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['vite', '--port', '3000', '--host'],
    cwd: path.resolve(__dirname, 'mobile-app'),
  },
];

const RESET = '\x1b[0m';
const procs = [];

services.forEach((s) => {
  const proc = spawn(s.cmd, s.args, {
    cwd: s.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  proc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n').filter((l) => l.trim().length > 0);
    lines.forEach((line) => {
      console.log(`${s.color}[${s.name}]${RESET} ${line}`);
    });
  });

  proc.stderr.on('data', (d) => {
    const lines = d.toString().split('\n').filter((l) => l.trim().length > 0);
    lines.forEach((line) => {
      console.error(`${s.color}[${s.name}]${RESET} ${line}`);
    });
  });

  proc.on('close', (code) => {
    console.log(`${s.color}[${s.name}]${RESET} Exited with code ${code}`);
  });

  procs.push(proc);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  procs.forEach((p) => {
    try {
      p.kill();
    } catch (e) {}
  });
  process.exit(0);
});
