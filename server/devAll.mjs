import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadServerEnv } from './loadEnvFile.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const collabServerPath = join(rootDir, 'server', 'startCollabServer.mjs');
const viteBinPath = join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

loadServerEnv();

// Local development starts with useful community content without affecting deployment data.
process.env.COMMUNITY_DEMO_SEED ??= 'true';

if (!existsSync(viteBinPath)) {
  console.error('[dev:all] Vite 실행 파일을 찾지 못했습니다. 먼저 npm install 상태를 확인해 주세요.');
  process.exit(1);
}

let shuttingDown = false;
const children = [];

function spawnChild(label, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(
      `[dev:all] ${label} 종료${signal ? ` (signal: ${signal})` : ` (code: ${code ?? 0})`}`
    );
    shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`[dev:all] ${label} 실행 실패:`, error);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 150);
}

process.on('SIGINT', () => {
  if (!shuttingDown) {
    shuttingDown = true;
    shutdown(0);
  }
});

process.on('SIGTERM', () => {
  if (!shuttingDown) {
    shuttingDown = true;
    shutdown(0);
  }
});

console.log('[dev:all] 협업 서버와 프론트 dev 서버를 함께 시작합니다.');

spawnChild('collab-server', process.execPath, ['--watch', collabServerPath]);
spawnChild('vite-dev', process.execPath, [viteBinPath, '--host', '0.0.0.0', '--configLoader', 'native']);
