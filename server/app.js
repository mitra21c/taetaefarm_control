require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const { SolapiMessageService } = require('solapi');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const ENCRYPTION_KEY = 'mitra21c';
const JWT_SECRET = 'taetaefarm_ctrl_jwt_2024';

const SOLAPI_API_KEY    = process.env.SOLAPI_API_KEY    ?? 'NCSXUJAHXFOKGSPJ';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET ?? 'TZY3FGZNCBUUQH9KRWRPP32T5UJSP04J';
const SOLAPI_SENDER     = process.env.SOLAPI_SENDER     ?? '01052570412';

let solapiService = null;
function getSolapi() {
  if (!SOLAPI_API_SECRET || !SOLAPI_SENDER) return null;
  if (!solapiService) solapiService = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);
  return solapiService;
}

function encrypt(text) { return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString(); }
function decrypt(ciphertext) { return CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8); }

// ── DB ─────────────────────────────────────────────────────────
const dbBase = {
  server: process.env.DB_SERVER || 'orikio.iptime.org',
  port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '@swe7410',
  options: { encrypt: false, trustServerCertificate: true },
};
const dbConfig = { ...dbBase, database: 'taetae_ctrl_db' };

async function ensureDatabase() {
  const masterPool = await sql.connect({ ...dbBase, database: 'master' });
  const check = await masterPool.request()
    .query("SELECT name FROM sys.databases WHERE name = 'taetae_ctrl_db'");
  if (check.recordset.length === 0) {
    await masterPool.request().query('CREATE DATABASE taetae_ctrl_db');
    console.log('taetae_ctrl_db 생성 완료');
  }
  await masterPool.close();
}

let pool;
async function getPool() {
  if (!pool || !pool.connected) pool = await sql.connect(dbConfig);
  return pool;
}

async function initDb() {
  const db = await getPool();
  const tables = [
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
     CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(50) NOT NULL,
       phone VARCHAR(20) NOT NULL, email VARCHAR(100) NOT NULL, pass VARCHAR(500) NOT NULL DEFAULT '',
       role VARCHAR(20) NOT NULL DEFAULT 'user', [use] VARCHAR(1) NOT NULL DEFAULT 'N',
       created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='farm_info' AND xtype='U')
     CREATE TABLE farm_info (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL,
       description NVARCHAR(500) DEFAULT '', [use] VARCHAR(1) NOT NULL DEFAULT 'Y',
       created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='farm_images' AND xtype='U')
     CREATE TABLE farm_images (id INT IDENTITY(1,1) PRIMARY KEY, farm_id INT NOT NULL,
       filename NVARCHAR(200) NOT NULL, url NVARCHAR(500) NOT NULL, created_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='plc_info' AND xtype='U')
     CREATE TABLE plc_info (id INT IDENTITY(1,1) PRIMARY KEY, farm_id INT NOT NULL, name NVARCHAR(100) NOT NULL,
       description NVARCHAR(500) DEFAULT '', ip VARCHAR(50) DEFAULT '', port INT DEFAULT 502,
       [use] VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='plc_add_info' AND xtype='U')
     CREATE TABLE plc_add_info (id INT IDENTITY(1,1) PRIMARY KEY, plc_id INT NOT NULL, name NVARCHAR(100) NOT NULL,
       address VARCHAR(50) DEFAULT '', data_type VARCHAR(10) NOT NULL DEFAULT 'Word',
       [use] VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='plc_ctrl_info' AND xtype='U')
     CREATE TABLE plc_ctrl_info (id INT IDENTITY(1,1) PRIMARY KEY, plc_add_id INT NOT NULL, name NVARCHAR(100) NOT NULL,
       description NVARCHAR(500) DEFAULT '', value NVARCHAR(200) DEFAULT '',
       [use] VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sequence_grp_info' AND xtype='U')
     CREATE TABLE sequence_grp_info (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL,
       description NVARCHAR(500) DEFAULT '', [use] VARCHAR(1) NOT NULL DEFAULT 'Y',
       created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sequence_info' AND xtype='U')
     CREATE TABLE sequence_info (id INT IDENTITY(1,1) PRIMARY KEY, grp_id INT NOT NULL, plc_ctrl_id INT NOT NULL,
       name NVARCHAR(100) NOT NULL, description NVARCHAR(500) DEFAULT '', start_gap INT NOT NULL DEFAULT 0,
       [use] VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='schedule_info' AND xtype='U')
     CREATE TABLE schedule_info (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL,
       farm_id INT DEFAULT NULL, plc_id INT DEFAULT NULL, plc_add_id INT DEFAULT NULL, ctrl_id INT DEFAULT NULL,
       exec_datetime DATETIME NOT NULL, repeat_type VARCHAR(20) NOT NULL DEFAULT 'none',
       is_sequence VARCHAR(1) NOT NULL DEFAULT 'N', seq_grp_id INT DEFAULT NULL,
       [use] VARCHAR(1) NOT NULL DEFAULT 'Y', created_at DATETIME NOT NULL DEFAULT GETDATE(), modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='crop_prices' AND xtype='U')
     CREATE TABLE crop_prices (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(50) NOT NULL,
       weight NVARCHAR(100) NOT NULL DEFAULT '', price INT NOT NULL DEFAULT 0,
       available VARCHAR(1) NOT NULL DEFAULT 'Y',
       modified_at DATETIME NOT NULL DEFAULT GETDATE())`,
  ];
  for (const q of tables) await db.request().query(q);

  const cropCheck = await db.request().query("SELECT COUNT(*) AS cnt FROM crop_prices");
  if (cropCheck.recordset[0].cnt === 0) {
    for (const name of ['블루베리', '태추', '대봉', '울금']) {
      await db.request().input('name', sql.NVarChar, name)
        .query("INSERT INTO crop_prices (name) VALUES (@name)");
    }
    console.log('crop_prices 기본 데이터 생성 완료');
  }

  const userCheck = await db.request().query('SELECT COUNT(*) AS cnt FROM users');
  if (userCheck.recordset[0].cnt === 0) {
    await db.request()
      .input('name', sql.NVarChar, '김민창').input('phone', sql.VarChar, '010-5257-0412')
      .input('email', sql.VarChar, 'mitra21c@naver.com').input('pass', sql.VarChar, encrypt('Rlaalsckd77!'))
      .input('role', sql.VarChar, 'admin').input('use', sql.VarChar, 'Y')
      .query('INSERT INTO users (name,phone,email,pass,role,[use]) VALUES (@name,@phone,@email,@pass,@role,@use)');
    console.log('기본 admin 계정 생성 완료');
  }
  console.log('DB 초기화 완료');
}

// ── 미들웨어 ────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// 이미지 업로드 (로컬: uploads/, Vercel: /tmp/uploads/)
const UPLOAD_DIR = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: '인증이 필요합니다.' });
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ message: '토큰이 만료되었습니다.' }); }
}
function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  next();
}
function managerMiddleware(req, res, next) {
  if (!['admin', 'manager'].includes(req.user?.role)) return res.status(403).json({ message: '권한이 없습니다.' });
  next();
}

// ── AUTH ────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: '이메일과 비밀번호를 입력해 주세요.' });
  try {
    const db = await getPool();
    const result = await db.request().input('email', sql.VarChar, email.trim().toLowerCase())
      .query('SELECT * FROM users WHERE LOWER(email) = @email');
    if (!result.recordset.length) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const user = result.recordset[0];
    let storedPlain;
    try { storedPlain = decrypt(user.pass); } catch { return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' }); }
    if (storedPlain !== password) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    if (user.role !== 'admin' && user.use !== 'Y') return res.status(403).json({ message: '관리자 승인 대기 중입니다.' });
    const payload = { sub: String(user.id), email: user.email, name: user.name, role: user.role };
    const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ sub: String(user.id) }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ message: '서버 오류: ' + err.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) return res.status(400).json({ message: '모든 항목을 입력해 주세요.' });
  try {
    const db = await getPool();
    await db.request().input('name', sql.NVarChar, name.trim()).input('phone', sql.VarChar, phone.trim())
      .input('email', sql.VarChar, email.trim().toLowerCase()).input('pass', sql.VarChar, encrypt(password))
      .input('role', sql.VarChar, 'user').input('use', sql.VarChar, 'N')
      .query('INSERT INTO users (name,phone,email,pass,role,[use]) VALUES (@name,@phone,@email,@pass,@role,@use)');
    res.json({ message: '정상적으로 입력이 되었습니다.' });
  } catch (err) { console.error(err); res.status(500).json({ message: '에러가 발생하였습니다.' }); }
});

app.post('/api/auth/check-duplicate', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: '전화번호를 입력해 주세요.' });
  try {
    const db = await getPool();
    const result = await db.request().input('phone', sql.VarChar, phone.replace(/-/g, ''))
      .query('SELECT TOP 1 id FROM users WHERE REPLACE(phone,\'-\',\'\')=@phone');
    res.json({ isDuplicate: result.recordset.length > 0 });
  } catch { res.status(500).json({ message: '서버 오류' }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken 없음' });
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    const db = await getPool();
    const result = await db.request().input('id', sql.Int, Number(payload.sub)).query('SELECT * FROM users WHERE id=@id');
    if (!result.recordset.length) return res.status(401).json({ message: '사용자 없음' });
    const user = result.recordset[0];
    const accessToken = jwt.sign({ sub: String(user.id), email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ accessToken });
  } catch { res.status(401).json({ message: '토큰 갱신 실패' }); }
});

// ── USERS ───────────────────────────────────────────────────────
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try { const db = await getPool(); const r = await db.request().query('SELECT id,name,phone,email,role,[use],created_at,modified_at FROM users ORDER BY id'); res.json(r.recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { role, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('role', sql.VarChar, role).input('use', sql.VarChar, use).query('UPDATE users SET role=@role,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM users WHERE id=@id'); res.json({ message: '삭제 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── FARM INFO ───────────────────────────────────────────────────
app.get('/api/farm-info', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM farm_info ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/farm-info', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, description, use } = req.body;
  try { const db = await getPool(); await db.request().input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('use', sql.VarChar, use||'Y').query('INSERT INTO farm_info (name,description,[use]) VALUES (@name,@desc,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/farm-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, description, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('use', sql.VarChar, use||'Y').query('UPDATE farm_info SET name=@name,description=@desc,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/farm-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const check = await db.request().input('id', sql.Int, Number(req.params.id)).query('SELECT TOP 1 id FROM plc_info WHERE farm_id=@id');
    if (check.recordset.length) return res.status(409).json({ message: '해당 농장을 사용하는 PLC 정보가 있습니다.' });
    await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM farm_info WHERE id=@id');
    res.json({ message: '성공적으로 삭제 하였습니다.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── FARM IMAGES ─────────────────────────────────────────────────
app.get('/api/farm-info/:id/images', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().input('id', sql.Int, Number(req.params.id)).query('SELECT * FROM farm_images WHERE farm_id=@id ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/farm-info/:id/images', authMiddleware, managerMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '이미지를 선택해 주세요.' });
  try {
    const db = await getPool(); const url = `/uploads/${req.file.filename}`;
    await db.request().input('farm_id', sql.Int, Number(req.params.id)).input('filename', sql.NVarChar, req.file.originalname).input('url', sql.NVarChar, url).query('INSERT INTO farm_images (farm_id,filename,url) VALUES (@farm_id,@filename,@url)');
    res.json({ message: '업로드 완료', url });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/farm-info/:id/images/:imgId', authMiddleware, managerMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request().input('id', sql.Int, Number(req.params.imgId)).query('SELECT filename FROM farm_images WHERE id=@id');
    if (!r.recordset.length) return res.status(404).json({ message: '없음' });
    await db.request().input('id', sql.Int, Number(req.params.imgId)).query('DELETE FROM farm_images WHERE id=@id');
    const fp = path.join(UPLOAD_DIR, r.recordset[0].filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    res.json({ message: '삭제 완료' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PLC INFO ────────────────────────────────────────────────────
app.get('/api/plc-info', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM plc_info ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/plc-info', authMiddleware, managerMiddleware, async (req, res) => {
  const { farm_id, name, description, ip, port, use } = req.body;
  try { const db = await getPool(); await db.request().input('farm_id', sql.Int, Number(farm_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('ip', sql.VarChar, ip||'').input('port', sql.Int, Number(port)||502).input('use', sql.VarChar, use||'Y').query('INSERT INTO plc_info (farm_id,name,description,ip,port,[use]) VALUES (@farm_id,@name,@desc,@ip,@port,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/plc-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { farm_id, name, description, ip, port, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('farm_id', sql.Int, Number(farm_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('ip', sql.VarChar, ip||'').input('port', sql.Int, Number(port)||502).input('use', sql.VarChar, use||'Y').query('UPDATE plc_info SET farm_id=@farm_id,name=@name,description=@desc,ip=@ip,port=@port,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/plc-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const check = await db.request().input('id', sql.Int, Number(req.params.id)).query('SELECT TOP 1 id FROM plc_add_info WHERE plc_id=@id');
    if (check.recordset.length) return res.status(409).json({ message: '해당 PLC를 사용하는 Address 정보가 있습니다.' });
    await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM plc_info WHERE id=@id');
    res.json({ message: '성공적으로 삭제 하였습니다.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PLC ADD INFO ────────────────────────────────────────────────
app.get('/api/plc-add-info', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM plc_add_info ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/plc-add-info', authMiddleware, managerMiddleware, async (req, res) => {
  const { plc_id, name, address, data_type, use } = req.body;
  try { const db = await getPool(); await db.request().input('plc_id', sql.Int, Number(plc_id)).input('name', sql.NVarChar, name).input('address', sql.VarChar, address||'').input('data_type', sql.VarChar, data_type||'Word').input('use', sql.VarChar, use||'Y').query('INSERT INTO plc_add_info (plc_id,name,address,data_type,[use]) VALUES (@plc_id,@name,@address,@data_type,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/plc-add-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { plc_id, name, address, data_type, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('plc_id', sql.Int, Number(plc_id)).input('name', sql.NVarChar, name).input('address', sql.VarChar, address||'').input('data_type', sql.VarChar, data_type||'Word').input('use', sql.VarChar, use||'Y').query('UPDATE plc_add_info SET plc_id=@plc_id,name=@name,address=@address,data_type=@data_type,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/plc-add-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM plc_add_info WHERE id=@id'); res.json({ message: '성공적으로 삭제 하였습니다.' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PLC CTRL INFO ───────────────────────────────────────────────
app.get('/api/plc-ctrl-info', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM plc_ctrl_info ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/plc-ctrl-info', authMiddleware, managerMiddleware, async (req, res) => {
  const { plc_add_id, name, description, value, use } = req.body;
  try { const db = await getPool(); await db.request().input('plc_add_id', sql.Int, Number(plc_add_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('value', sql.NVarChar, value||'').input('use', sql.VarChar, use||'Y').query('INSERT INTO plc_ctrl_info (plc_add_id,name,description,value,[use]) VALUES (@plc_add_id,@name,@desc,@value,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/plc-ctrl-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { plc_add_id, name, description, value, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('plc_add_id', sql.Int, Number(plc_add_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('value', sql.NVarChar, value||'').input('use', sql.VarChar, use||'Y').query('UPDATE plc_ctrl_info SET plc_add_id=@plc_add_id,name=@name,description=@desc,value=@value,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/plc-ctrl-info/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM plc_ctrl_info WHERE id=@id'); res.json({ message: '성공적으로 삭제 하였습니다.' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SEQUENCE GRP ────────────────────────────────────────────────
app.get('/api/sequence-grp', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM sequence_grp_info ORDER BY id')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/sequence-grp', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, description, use } = req.body;
  try { const db = await getPool(); await db.request().input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('use', sql.VarChar, use||'Y').query('INSERT INTO sequence_grp_info (name,description,[use]) VALUES (@name,@desc,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/sequence-grp/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, description, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('use', sql.VarChar, use||'Y').query('UPDATE sequence_grp_info SET name=@name,description=@desc,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/sequence-grp/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM sequence_grp_info WHERE id=@id'); res.json({ message: '성공적으로 삭제 하였습니다.' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SEQUENCE INFO ───────────────────────────────────────────────
app.get('/api/sequence', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM sequence_info ORDER BY grp_id,start_gap')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/sequence', authMiddleware, managerMiddleware, async (req, res) => {
  const { grp_id, plc_ctrl_id, name, description, start_gap, use } = req.body;
  try { const db = await getPool(); await db.request().input('grp_id', sql.Int, Number(grp_id)).input('plc_ctrl_id', sql.Int, Number(plc_ctrl_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('start_gap', sql.Int, Number(start_gap)||0).input('use', sql.VarChar, use||'Y').query('INSERT INTO sequence_info (grp_id,plc_ctrl_id,name,description,start_gap,[use]) VALUES (@grp_id,@plc_ctrl_id,@name,@desc,@start_gap,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/sequence/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { grp_id, plc_ctrl_id, name, description, start_gap, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('grp_id', sql.Int, Number(grp_id)).input('plc_ctrl_id', sql.Int, Number(plc_ctrl_id)).input('name', sql.NVarChar, name).input('desc', sql.NVarChar, description||'').input('start_gap', sql.Int, Number(start_gap)||0).input('use', sql.VarChar, use||'Y').query('UPDATE sequence_info SET grp_id=@grp_id,plc_ctrl_id=@plc_ctrl_id,name=@name,description=@desc,start_gap=@start_gap,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/sequence/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM sequence_info WHERE id=@id'); res.json({ message: '성공적으로 삭제 하였습니다.' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SCHEDULE ────────────────────────────────────────────────────
// 시퀀스 그룹 일정 일괄 생성 (POST /api/schedule/sequence-batch)
app.post('/api/schedule/sequence-batch', authMiddleware, managerMiddleware, async (req, res) => {
  const { seq_grp_id, exec_datetime, repeat_type, use } = req.body;
  if (!seq_grp_id || !exec_datetime) return res.status(400).json({ message: '시퀀스 그룹과 실행 일시를 입력해 주세요.' });
  try {
    const db = await getPool();
    const seqs = (await db.request().input('grp_id', sql.Int, Number(seq_grp_id))
      .query("SELECT * FROM sequence_info WHERE grp_id=@grp_id AND [use]='Y' ORDER BY start_gap")).recordset;
    if (!seqs.length) return res.status(400).json({ message: '해당 그룹에 활성화된 시퀀스가 없습니다.' });
    const base = new Date(exec_datetime);
    for (const s of seqs) {
      const execTime = new Date(base.getTime() + s.start_gap * 60 * 1000);
      await db.request()
        .input('name', sql.NVarChar, s.name)
        .input('exec_datetime', sql.DateTime, execTime)
        .input('repeat_type', sql.VarChar, repeat_type || 'none')
        .input('seq_grp_id', sql.Int, Number(seq_grp_id))
        .input('ctrl_id', sql.Int, s.plc_ctrl_id)
        .input('use', sql.VarChar, use || 'Y')
        .query('INSERT INTO schedule_info (name,exec_datetime,repeat_type,is_sequence,seq_grp_id,ctrl_id,[use]) VALUES (@name,@exec_datetime,@repeat_type,\'Y\',@seq_grp_id,@ctrl_id,@use)');
    }
    res.json({ message: `${seqs.length}개 시퀀스 일정이 추가되었습니다.` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 시퀀스 그룹 일정 일괄 업데이트 (PATCH /api/schedule/sequence-batch/:grpId)
app.patch('/api/schedule/sequence-batch/:grpId', authMiddleware, managerMiddleware, async (req, res) => {
  const { exec_datetime, repeat_type, use } = req.body;
  const grpId = Number(req.params.grpId);
  if (!exec_datetime) return res.status(400).json({ message: '실행 일시를 입력해 주세요.' });
  try {
    const db = await getPool();
    const seqs = (await db.request().input('grp_id', sql.Int, grpId)
      .query("SELECT * FROM sequence_info WHERE grp_id=@grp_id AND [use]='Y' ORDER BY start_gap")).recordset;
    if (!seqs.length) return res.status(400).json({ message: '해당 그룹에 활성화된 시퀀스가 없습니다.' });
    const base = new Date(exec_datetime);
    for (const s of seqs) {
      const execTime = new Date(base.getTime() + s.start_gap * 60 * 1000);
      await db.request()
        .input('grp_id', sql.Int, grpId)
        .input('ctrl_id', sql.Int, s.plc_ctrl_id)
        .input('exec_datetime', sql.DateTime, execTime)
        .input('repeat_type', sql.VarChar, repeat_type || 'none')
        .input('use', sql.VarChar, use || 'Y')
        .query('UPDATE schedule_info SET exec_datetime=@exec_datetime,repeat_type=@repeat_type,[use]=@use,modified_at=GETDATE() WHERE seq_grp_id=@grp_id AND ctrl_id=@ctrl_id');
    }
    res.json({ message: '시퀀스 일정이 업데이트되었습니다.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/schedule', async (req, res) => {
  try { const db = await getPool(); res.json((await db.request().query('SELECT * FROM schedule_info ORDER BY exec_datetime')).recordset); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.post('/api/schedule', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, farm_id, plc_id, plc_add_id, ctrl_id, exec_datetime, repeat_type, is_sequence, seq_grp_id, use } = req.body;
  try { const db = await getPool(); await db.request().input('name', sql.NVarChar, name).input('farm_id', sql.Int, farm_id||null).input('plc_id', sql.Int, plc_id||null).input('plc_add_id', sql.Int, plc_add_id||null).input('ctrl_id', sql.Int, ctrl_id||null).input('exec_datetime', sql.DateTime, new Date(exec_datetime)).input('repeat_type', sql.VarChar, repeat_type||'none').input('is_sequence', sql.VarChar, is_sequence||'N').input('seq_grp_id', sql.Int, seq_grp_id||null).input('use', sql.VarChar, use||'Y').query('INSERT INTO schedule_info (name,farm_id,plc_id,plc_add_id,ctrl_id,exec_datetime,repeat_type,is_sequence,seq_grp_id,[use]) VALUES (@name,@farm_id,@plc_id,@plc_add_id,@ctrl_id,@exec_datetime,@repeat_type,@is_sequence,@seq_grp_id,@use)'); res.json({ message: '추가 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.patch('/api/schedule/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { name, farm_id, plc_id, plc_add_id, ctrl_id, exec_datetime, repeat_type, is_sequence, seq_grp_id, use } = req.body;
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).input('name', sql.NVarChar, name).input('farm_id', sql.Int, farm_id||null).input('plc_id', sql.Int, plc_id||null).input('plc_add_id', sql.Int, plc_add_id||null).input('ctrl_id', sql.Int, ctrl_id||null).input('exec_datetime', sql.DateTime, new Date(exec_datetime)).input('repeat_type', sql.VarChar, repeat_type||'none').input('is_sequence', sql.VarChar, is_sequence||'N').input('seq_grp_id', sql.Int, seq_grp_id||null).input('use', sql.VarChar, use||'Y').query('UPDATE schedule_info SET name=@name,farm_id=@farm_id,plc_id=@plc_id,plc_add_id=@plc_add_id,ctrl_id=@ctrl_id,exec_datetime=@exec_datetime,repeat_type=@repeat_type,is_sequence=@is_sequence,seq_grp_id=@seq_grp_id,[use]=@use,modified_at=GETDATE() WHERE id=@id'); res.json({ message: '수정 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete('/api/schedule/:id', authMiddleware, managerMiddleware, async (req, res) => {
  try { const db = await getPool(); await db.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM schedule_info WHERE id=@id'); res.json({ message: '삭제 완료' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── SMS ─────────────────────────────────────────────────────────
app.post('/api/sms/send', authMiddleware, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ message: '수신인과 메시지를 입력해 주세요.' });
  const solapi = getSolapi();
  if (!solapi) return res.status(503).json({ message: 'Solapi 설정 없음' });
  try { await solapi.sendOne({ to: to.replace(/-/g, ''), from: SOLAPI_SENDER, text }); res.json({ message: '전송 완료' }); }
  catch (err) { res.status(500).json({ message: '전송 실패: ' + err.message }); }
});
app.post('/api/sms/send-all', authMiddleware, adminMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: '메시지를 입력해 주세요.' });
  const solapi = getSolapi();
  if (!solapi) return res.status(503).json({ message: 'Solapi 설정 없음' });
  try {
    const db = await getPool();
    const users = (await db.request().query("SELECT name,phone FROM users WHERE [use]='Y' AND phone IS NOT NULL AND phone!=''")).recordset;
    if (!users.length) return res.json({ history: [], message: '전송 대상 없음' });
    await solapi.sendMany(users.map(u => ({ to: u.phone.replace(/-/g, ''), from: SOLAPI_SENDER, text })));
    res.json({ history: users });
  } catch (err) { res.status(500).json({ message: '전송 실패: ' + err.message }); }
});

// ── 작물 가격 ────────────────────────────────────────────────────
app.get('/api/crop-prices', authMiddleware, managerMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query('SELECT * FROM crop_prices ORDER BY id');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/crop-prices/:id', authMiddleware, managerMiddleware, async (req, res) => {
  const { id } = req.params;
  const { weight, price, available } = req.body;
  try {
    const db = await getPool();
    await db.request()
      .input('id', sql.Int, Number(id))
      .input('weight', sql.NVarChar, weight ?? '')
      .input('price', sql.Int, Number(price) || 0)
      .input('available', sql.VarChar, available === 'Y' ? 'Y' : 'N')
      .query('UPDATE crop_prices SET weight=@weight, price=@price, available=@available, modified_at=GETDATE() WHERE id=@id');
    const result = await db.request().input('id', sql.Int, Number(id))
      .query('SELECT * FROM crop_prices WHERE id=@id');
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── 개발자 모드 ─────────────────────────────────────────────────
app.get('/api/dev/tables', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(
      "SELECT name FROM sys.objects WHERE type='U' ORDER BY name"
    );
    res.json(result.recordset.map(r => r.name));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/dev/table/:tableName', authMiddleware, adminMiddleware, async (req, res) => {
  const { tableName } = req.params;
  try {
    const db = await getPool();
    const check = await db.request()
      .input('tname', sql.NVarChar, tableName)
      .query("SELECT name FROM sys.objects WHERE type='U' AND name=@tname");
    if (!check.recordset.length) return res.status(404).json({ message: '테이블을 찾을 수 없습니다.' });
    const result = await db.request().query(`SELECT TOP 500 * FROM [${tableName}] ORDER BY (SELECT NULL)`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = { app, ensureDatabase, initDb };
