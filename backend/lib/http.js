// Tiện ích HTTP dùng chung cho server local (node:http) và Vercel Functions.
import { env } from './env.js';

export function cors(req, res) {
  const allow = env('CORS_ORIGIN', '*'); // VD: https://ten-app.vercel.app,http://127.0.0.1:5500
  const origin = req.headers.origin || '';
  if (allow === '*') res.setHeader('Access-Control-Allow-Origin', '*');
  else if (allow.split(',').map((s) => s.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Vercel đã parse sẵn req.body; node:http thì tự đọc stream.
export async function readBody(req, limit = 1_000_000) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Dữ liệu gửi lên quá lớn'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch {
    throw Object.assign(new Error('Body phải là JSON hợp lệ'), { status: 400 });
  }
}
