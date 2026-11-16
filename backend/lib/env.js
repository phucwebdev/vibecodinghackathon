// Nạp biến môi trường từ backend/.env (không cần thư viện dotenv).
// Trên Vercel, biến được khai báo trong Project Settings → Environment Variables nên file này bỏ qua.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv(file = join(root, '.env')) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export const env = (key, fallback = '') => (process.env[key] ?? '').trim() || fallback;
export const envInt = (key, fallback) => {
  const n = parseInt(env(key), 10);
  return Number.isFinite(n) ? n : fallback;
};
