// Chạy backend ở máy local:  cd backend && node server.js   (Node >= 18, không cần npm install)
import { createServer } from 'node:http';
import { loadEnv, envInt } from './lib/env.js';

loadEnv();
const { routes } = await import('./lib/handlers.js');
const { cors, sendJSON } = await import('./lib/http.js');

const PORT = envInt('PORT', 3001);

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '') || '/';
  const handler = routes[path];
  if (handler) return handler(req, res);
  cors(req, res);
  if (path === '/') return sendJSON(res, 200, { ok: true, message: 'Backend đang chạy', routes: Object.keys(routes) });
  return sendJSON(res, 404, { ok: false, error: 'Không tìm thấy đường dẫn' });
}).listen(PORT, () => {
  console.log(`✅ Backend chạy tại http://localhost:${PORT}`);
  console.log(`   Kiểm tra: http://localhost:${PORT}/api/health`);
});
