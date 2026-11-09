import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'dev:server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(npm, ['run', 'dev:client'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
  child.on('error', (error) => {
    console.error('Could not start a development process:', error.message);
    stop(1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
