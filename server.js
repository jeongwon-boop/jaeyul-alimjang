require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── DB 연결 풀 ──────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'schedule_db',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4'
});

// ── 헬퍼 ───────────────────────────────────────────────────
function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

// ── GET /api/projects ─ 전체 로드 ──────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id AS p_id, p.name AS p_name, p.color, p.manager, p.description,
        t.id AS t_id, t.\`order\`, t.name AS t_name, t.category,
        t.assignee, t.start_date, t.end_date, t.progress, t.status
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      ORDER BY p.created_at ASC, t.\`order\` ASC
    `);

    const projectMap = new Map();
    for (const row of rows) {
      if (!projectMap.has(row.p_id)) {
        projectMap.set(row.p_id, {
          id: row.p_id, name: row.p_name,
          color: row.color, manager: row.manager,
          description: row.description, tasks: []
        });
      }
      if (row.t_id) {
        projectMap.get(row.p_id).tasks.push({
          id:        row.t_id,
          order:     row.order,
          name:      row.t_name,
          category:  row.category,
          assignee:  row.assignee,
          startDate: toDateStr(row.start_date),
          endDate:   toDateStr(row.end_date),
          progress:  row.progress,
          status:    row.status
        });
      }
    }
    res.json([...projectMap.values()]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/projects ─ 프로젝트 생성 ────────────────────
app.post('/api/projects', async (req, res) => {
  const { id, name, color, manager, description } = req.body;
  try {
    await pool.query(
      'INSERT INTO projects (id, name, color, manager, description) VALUES (?, ?, ?, ?, ?)',
      [id, name, color || '#3b82f6', manager || '', description || '']
    );
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/projects/:id ─ 프로젝트 수정 ─────────────────
app.put('/api/projects/:id', async (req, res) => {
  const { name, color, manager, description } = req.body;
  try {
    await pool.query(
      'UPDATE projects SET name=?, color=?, manager=?, description=? WHERE id=?',
      [name, color, manager || '', description || '', req.params.id]
    );
    res.json({ id: req.params.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/projects/:id ─ 프로젝트 삭제 (cascade) ────
app.delete('/api/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=?', [req.params.id]);
    res.json({ id: req.params.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/projects/:pId/tasks ─ 업무 생성 ─────────────
app.post('/api/projects/:pId/tasks', async (req, res) => {
  const { id, order, name, category, assignee, startDate, endDate, progress, status } = req.body;
  try {
    await pool.query(
      'INSERT INTO tasks (id, project_id, `order`, name, category, assignee, start_date, end_date, progress, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, req.params.pId, order ?? 0, name, category || '기획',
       assignee || '', startDate || null, endDate || null, progress ?? 0, status || '대기']
    );
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/projects/:pId/tasks/:tId ─ 업무 부분 수정 ──
app.patch('/api/projects/:pId/tasks/:tId', async (req, res) => {
  const colMap = {
    name: 'name', category: 'category', assignee: 'assignee',
    startDate: 'start_date', endDate: 'end_date',
    progress: 'progress', status: 'status', order: '`order`'
  };
  const sets = [], vals = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in req.body) {
      sets.push(`${col} = ?`);
      vals.push(req.body[key] === '' ? null : req.body[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  vals.push(req.params.tId, req.params.pId);
  try {
    await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
      vals
    );
    res.json({ id: req.params.tId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/projects/:pId/tasks/:tId ─ 업무 삭제 ──────
app.delete('/api/projects/:pId/tasks/:tId', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id=? AND project_id=?',
      [req.params.tId, req.params.pId]);
    res.json({ id: req.params.tId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/projects/:pId/tasks/reorder ─ 순서 일괄 저장 ─
app.put('/api/projects/:pId/tasks/reorder', async (req, res) => {
  const { order } = req.body; // string[]
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < order.length; i++) {
      await conn.query(
        'UPDATE tasks SET `order`=? WHERE id=? AND project_id=?',
        [i, order[i], req.params.pId]
      );
    }
    await conn.commit();
    res.json({ updated: order.length });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ── 서버 시작 ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📋 일정관리 앱: http://localhost:${PORT}/schedule.html`);
});
