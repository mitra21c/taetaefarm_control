require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const net = require('net');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { app, ensureDatabase, initDb } = require('./app');

const PORT = process.env.PORT || 3001;

function getWindowsHostIP() {
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : '127.0.0.1';
  } catch { return '127.0.0.1'; }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let tcpSocket = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'connect') {
      if (tcpSocket) { tcpSocket.destroy(); tcpSocket = null; }
      let { ip, port } = msg;
      if (ip === 'localhost' || ip === '127.0.0.1') ip = getWindowsHostIP();
      tcpSocket = new net.Socket();
      tcpSocket.connect(Number(port), ip, () => ws.send(JSON.stringify({ type: 'connected', ip, port })));
      tcpSocket.on('data', d => ws.send(JSON.stringify({ type: 'data', data: d.toString() })));
      tcpSocket.on('error', e => { ws.send(JSON.stringify({ type: 'error', message: e.message })); tcpSocket = null; });
      tcpSocket.on('close', () => { ws.send(JSON.stringify({ type: 'disconnected' })); tcpSocket = null; });
    } else if (msg.type === 'send') {
      if (tcpSocket && !tcpSocket.destroyed) tcpSocket.write(msg.data);
    } else if (msg.type === 'disconnect') {
      if (tcpSocket) { tcpSocket.destroy(); tcpSocket = null; }
    }
  });
  ws.on('close', () => { if (tcpSocket) tcpSocket.destroy(); });
});

ensureDatabase()
  .then(() => initDb())
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`API 서버: http://0.0.0.0:${PORT}`);
      console.log(`Windows 호스트 IP (WSL2): ${getWindowsHostIP()}`);
    });
  })
  .catch(err => {
    console.error('DB 초기화 실패:', err.message);
    process.exit(1);
  });
