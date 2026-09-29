// ============================================================
//  server.js — Personal Expense Tracker Backend
//  Run with: node server.js
//  Runs on:  http://localhost:3000
// ============================================================

const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());


// ============================================================
//  DATABASE CONNECTION — change YOUR_PASSWORD
// ============================================================
const db = mysql.createConnection({
  host:     'localhost',
  user:     'root',
  password: 'root',    // ← Change this to your MySQL root password
  database: 'personal_expense_tracker'
});

db.connect(err => {
  if (err) {
    console.error('❌ Could not connect to MySQL:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL — Personal Expense Tracker');
});


// ============================================================
//  ROUTE 1: GET /categories
//  Returns all expense categories
// ============================================================
app.get('/categories', (req, res) => {
  db.query('SELECT * FROM categories ORDER BY label', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  ROUTE 2: GET /expenses
//  Returns all expenses joined with category info
//  Optional filter: ?month=2025-05
// ============================================================
app.get('/expenses', (req, res) => {
  let sql = `
    SELECT
      e.id,
      e.name,
      e.amount,
      e.category_code,
      e.is_needed,
      e.note,
      DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
      e.created_at,
      c.label AS category_label,
      c.emoji AS category_emoji,
      c.color AS category_color
    FROM expenses e
    JOIN categories c ON e.category_code = c.code
  `;
  const params = [];
  if (req.query.month) {
    sql += ' WHERE DATE_FORMAT(e.expense_date, "%Y-%m") = ?';
    params.push(req.query.month);
  }
  sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  ROUTE 3: POST /expenses
//  Adds a new expense
//  Also checks if budget is exceeded and logs alert if so
// ============================================================
app.post('/expenses', (req, res) => {
  const { name, amount, category_code, is_needed, note, expense_date } = req.body;

  // Validation
  if (!name || !amount || !category_code || !is_needed || !expense_date)
    return res.status(400).json({ error: 'All fields except note are required.' });
  if (amount <= 0)
    return res.status(400).json({ error: 'Amount must be greater than 0.' });
  if (!['yes', 'no', 'maybe'].includes(is_needed))
    return res.status(400).json({ error: 'is_needed must be yes, no, or maybe.' });

  const month = expense_date.slice(0, 7); // e.g. '2025-05'

  // Step 1: Insert the expense
  const insertSql = `
    INSERT INTO expenses (name, amount, category_code, is_needed, note, expense_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(insertSql, [name, amount, category_code, is_needed, note || '', expense_date], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const newExpenseId = result.insertId;

    // Step 2: Check current month total and budget
    const checkSql = `
      SELECT
        COALESCE(ms.total_amount, 0)  AS total_spent,
        COALESCE(b.monthly_limit, 0)  AS budget_limit
      FROM
        (SELECT 1) dummy
        LEFT JOIN monthly_summary ms ON ms.month_year = ?
        LEFT JOIN budget b ON b.month_year = ?
    `;
    db.query(checkSql, [month, month], (err2, rows) => {
      if (err2) return res.json({ message: 'Expense added!', id: newExpenseId, budgetStatus: null });

      const totalSpent  = parseFloat(rows[0].total_spent)  || 0;
      const budgetLimit = parseFloat(rows[0].budget_limit) || 0;

      // No budget set for this month — just return success
      if (budgetLimit === 0) {
        return res.json({ message: 'Expense added!', id: newExpenseId, budgetStatus: 'no_budget' });
      }

      const pctUsed    = Math.round((totalSpent / budgetLimit) * 100);
      const exceededBy = totalSpent - budgetLimit;

      // Budget exceeded — log alert and warn user
      if (totalSpent > budgetLimit) {
        const alertSql = `
          INSERT INTO budget_alerts (month_year, expense_name, expense_amount, total_after, budget_limit, exceeded_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.query(alertSql, [month, name, amount, totalSpent, budgetLimit, exceededBy], () => {});

        return res.json({
          message:      'Expense added!',
          id:           newExpenseId,
          budgetStatus: 'exceeded',
          totalSpent,
          budgetLimit,
          exceededBy,
          pctUsed,
          expenseName:  name,
          expenseAmount: amount
        });
      }

      // Budget close to limit (80% or more used) — warn user
      if (pctUsed >= 80) {
        return res.json({
          message:      'Expense added!',
          id:           newExpenseId,
          budgetStatus: 'warning',
          totalSpent,
          budgetLimit,
          pctUsed,
          remaining:    budgetLimit - totalSpent
        });
      }

      // All good
      return res.json({
        message:      'Expense added!',
        id:           newExpenseId,
        budgetStatus: 'ok',
        totalSpent,
        budgetLimit,
        pctUsed,
        remaining:    budgetLimit - totalSpent
      });
    });
  });
});


// ============================================================
//  ROUTE 4: DELETE /expenses/:id
//  Deletes one expense — trigger auto-updates monthly_summary
// ============================================================
app.delete('/expenses/:id', (req, res) => {
  db.query('DELETE FROM expenses WHERE id = ?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Expense not found.' });
    res.json({ message: 'Expense deleted!' });
  });
});


// ============================================================
//  ROUTE 5: GET /budget/:month
//  Returns budget for a specific month (e.g. 2025-05)
// ============================================================
app.get('/budget/:month', (req, res) => {
  db.query('SELECT * FROM budget WHERE month_year = ?', [req.params.month], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0] || null);
  });
});


// ============================================================
//  ROUTE 6: POST /budget
//  Set or update the monthly budget for a given month
// ============================================================
app.post('/budget', (req, res) => {
  const { month_year, monthly_limit } = req.body;

  if (!month_year || !monthly_limit)
    return res.status(400).json({ error: 'month_year and monthly_limit are required.' });
  if (monthly_limit <= 0)
    return res.status(400).json({ error: 'Budget must be greater than 0.' });

  const sql = `
    INSERT INTO budget (month_year, monthly_limit)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)
  `;
  db.query(sql, [month_year, monthly_limit], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Budget saved!', month_year, monthly_limit });
  });
});


// ============================================================
//  ROUTE 7: GET /summary
//  Returns monthly summary with budget info joined
// ============================================================
app.get('/summary', (req, res) => {
  const sql = `
    SELECT
      ms.*,
      COALESCE(b.monthly_limit, 0) AS budget_limit,
      CASE
        WHEN b.monthly_limit IS NULL OR b.monthly_limit = 0 THEN NULL
        ELSE ROUND((ms.total_amount / b.monthly_limit) * 100, 1)
      END AS pct_used
    FROM monthly_summary ms
    LEFT JOIN budget b ON ms.month_year = b.month_year
    ORDER BY ms.month_year DESC
    LIMIT 12
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  ROUTE 8: GET /waste
//  Returns only unnecessary + reducible expenses
// ============================================================
app.get('/waste', (req, res) => {
  const sql = `
    SELECT
      e.id, e.name, e.amount, e.is_needed, e.note,
      DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
      c.label AS category_label, c.emoji AS category_emoji,
      (e.amount * 12) AS yearly_projection
    FROM expenses e
    JOIN categories c ON e.category_code = c.code
    WHERE e.is_needed IN ('no', 'maybe')
    ORDER BY e.amount DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  ROUTE 9: GET /audit
//  Returns audit log
// ============================================================
app.get('/audit', (req, res) => {
  db.query('SELECT * FROM expense_audit_log ORDER BY action_time DESC LIMIT 50', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  ROUTE 10: GET /alerts
//  Returns budget alert history
// ============================================================
app.get('/alerts', (req, res) => {
  db.query('SELECT * FROM budget_alerts ORDER BY alert_time DESC LIMIT 50', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


// ============================================================
//  START SERVER
// ============================================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop.`);
});
