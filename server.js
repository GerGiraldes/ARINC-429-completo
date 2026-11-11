// ARINC 429 completo - Node.js + Express + MySQL
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const { codificar, decodificar } = require('./arinc429');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'arinc_app',
  password: process.env.DB_PASS || 'arinc123',
  database: process.env.DB_NAME || 'ARINC429_completo',
});

// ---------- Puerto serie (opcional) ----------
// Ejemplo: SERIAL_PORT=/dev/ttyUSB0 npm start   (en Windows: SERIAL_PORT=COM3)
let puerto = null;
if (process.env.SERIAL_PORT) {
  try {
    const { SerialPort } = require('serialport');
    puerto = new SerialPort({ path: process.env.SERIAL_PORT, baudRate: Number(process.env.BAUD || 9600) });
    puerto.on('open', () => console.log('Puerto serie abierto:', process.env.SERIAL_PORT));
    puerto.on('error', e => console.log('Error de puerto serie:', e.message));
  } catch (e) { console.log('No se pudo abrir el puerto serie:', e.message); }
}
function enviarSerie(hex, bin) {
  if (!puerto || !puerto.isOpen) return false;
  puerto.write(`${hex};${bin}\n`);
  return true;
}

const err = (res, e, code = 400) => res.status(code).json({ error: e.message || e });

// ---------- CRUD instrumentos ----------
app.get('/api/instrumentos', async (req, res) => {
  try { const [r] = await db.query('SELECT * FROM instrumentos ORDER BY ins_id'); res.json(r); }
  catch (e) { err(res, e, 500); }
});

app.post('/api/instrumentos', async (req, res) => {
  const { ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad } = req.body;
  if (!ins_nombre || !ins_label) return err(res, 'Faltan nombre o label');
  if (Number(ins_minimo) >= Number(ins_maximo)) return err(res, 'El minimo tiene que ser menor que el maximo');
  try {
    const [r] = await db.query(
      'INSERT INTO instrumentos (ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad) VALUES (?,?,?,?,?)',
      [ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad || null]);
    res.status(201).json({ ins_id: r.insertId });
  } catch (e) { err(res, e); }
});

app.put('/api/instrumentos/:id', async (req, res) => {
  const { ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad } = req.body;
  if (Number(ins_minimo) >= Number(ins_maximo)) return err(res, 'El minimo tiene que ser menor que el maximo');
  try {
    const [r] = await db.query(
      'UPDATE instrumentos SET ins_nombre=?, ins_label=?, ins_minimo=?, ins_maximo=?, ins_unidad=? WHERE ins_id=?',
      [ins_nombre, ins_label, ins_minimo, ins_maximo, ins_unidad || null, req.params.id]);
    if (!r.affectedRows) return err(res, 'No existe', 404);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/instrumentos/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM instrumentos WHERE ins_id=?', [req.params.id]);
    if (!r.affectedRows) return err(res, 'No existe', 404);
    res.json({ ok: true });
  } catch (e) { err(res, 'No se puede borrar: el instrumento tiene envios'); }
});

// ---------- CRUD envios ----------
async function getInstrumento(id) {
  const [r] = await db.query('SELECT * FROM instrumentos WHERE ins_id=?', [id]);
  if (!r.length) throw new Error('El instrumento no existe');
  return r[0];
}
function armarCodigo(ins, valor) {
  return codificar({ label: ins.ins_label, minimo: ins.ins_minimo, maximo: ins.ins_maximo, valor });
}

app.get('/api/envios', async (req, res) => {
  try {
    const [r] = await db.query(`
      SELECT e.*, i.ins_nombre, i.ins_label, i.ins_minimo, i.ins_maximo, i.ins_unidad
      FROM envios e INNER JOIN instrumentos i ON i.ins_id = e.ins_id
      ORDER BY e.env_id DESC`);
    // verificacion: decodifica cada codigo guardado
    res.json(r.map(e => ({
      ...e,
      verificacion: decodificar(parseInt(e.env_codigo_hex, 16), { minimo: e.ins_minimo, maximo: e.ins_maximo }),
    })));
  } catch (e) { err(res, e, 500); }
});

app.post('/api/envios', async (req, res) => {
  try {
    const ins = await getInstrumento(req.body.ins_id);
    const c = armarCodigo(ins, req.body.env_valor);   // valida que este entre min y max
    const [r] = await db.query(
      'INSERT INTO envios (ins_id, env_valor, env_codigo_bin, env_codigo_hex) VALUES (?,?,?,?)',
      [ins.ins_id, req.body.env_valor, c.bin, c.hex]);
    const serie = enviarSerie(c.hex, c.bin);
    res.status(201).json({ env_id: r.insertId, ...c, serie });
  } catch (e) { err(res, e); }
});

app.put('/api/envios/:id', async (req, res) => {
  try {
    const ins = await getInstrumento(req.body.ins_id);
    const c = armarCodigo(ins, req.body.env_valor);
    const [r] = await db.query(
      'UPDATE envios SET ins_id=?, env_valor=?, env_codigo_bin=?, env_codigo_hex=? WHERE env_id=?',
      [ins.ins_id, req.body.env_valor, c.bin, c.hex, req.params.id]);
    if (!r.affectedRows) return err(res, 'No existe', 404);
    res.json({ ...c, serie: enviarSerie(c.hex, c.bin) });
  } catch (e) { err(res, e); }
});

app.delete('/api/envios/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM envios WHERE env_id=?', [req.params.id]);
    if (!r.affectedRows) return err(res, 'No existe', 404);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// reenviar un codigo al puerto serie
app.post('/api/envios/:id/serie', async (req, res) => {
  try {
    const [r] = await db.query('SELECT * FROM envios WHERE env_id=?', [req.params.id]);
    if (!r.length) return err(res, 'No existe', 404);
    res.json({ serie: enviarSerie(r[0].env_codigo_hex, r[0].env_codigo_bin) });
  } catch (e) { err(res, e); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ARINC 429 en http://localhost:${PORT}`));
