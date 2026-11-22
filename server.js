import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['--import=tsx/esm', 'server.ts'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

child.on('error', (error) => {
  console.error('Failed to start server.ts:', error);
  process.exit(1);
});