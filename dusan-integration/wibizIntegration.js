/**
 * Wibiz.ai — Subscriber Data Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop this file into your routes/ folder and mount it in your Express app.
 *
 * SETUP (2 steps):
 *
 * 1. Add to your .env:
 *      WIBIZ_API_KEY=<key agreed with Wibiz — keep this secret>
 *
 * 2. In your main app.js / server.js add:
 *      const wibiz = require('./routes/wibizIntegration');
 *      app.use('/api/wibiz', wibiz);
 *
 * ── CONFIRM THESE BEFORE DEPLOYING ──────────────────────────────────────────
 * Lines marked /* confirm: ... */ may need to match your actual table/column
 * names. Everything else is based on what you already shared with us.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router  = express.Router();

// Import your existing pg Pool — adjust the path to match your project
const pool = require('../db'); /* confirm: path to your pg pool */

// ─── Auth ─────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.WIBIZ_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── GET /api/wibiz/subscriber/:id ───────────────────────────────────────────
// Single subscriber — called by the Wibiz chatbot mid-conversation
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriber/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        s.subscriberId                           AS subscriber_id,
        s.full_name,
        s.account_status                         AS status,
        s.account_created,

        -- Most recent active challenge
        c.stage                                  AS current_stage,
        c.is_funded,
        c.balance,

        -- Total amount spent
        COALESCE(p.total_spent, 0)               AS amount_spent

      FROM users s                               /* confirm: subscribers table name */

      -- Most recent challenge for this subscriber
      LEFT JOIN LATERAL (
        SELECT stage, is_funded, balance
        FROM challenges                          /* confirm: challenges/evaluations table name */
        WHERE subscriber_id = s.subscriberId    /* confirm: foreign key column name */
        ORDER BY created_at DESC
        LIMIT 1
      ) c ON true

      -- Sum of all payments
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS total_spent
        FROM payments                            /* confirm: payments/orders/transactions table name */
        WHERE subscriber_id = s.subscriberId    /* confirm: foreign key column name */
      ) p ON true

      WHERE s.subscriberId = $1
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[wibiz] GET /subscriber error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/wibiz/subscribers?page=0&limit=100 ─────────────────────────────
// Paginated list — used by the Wibiz bulk sync (runs every 15 min)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscribers', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 100, 100);
  const offset = (parseInt(req.query.page) || 0) * limit;

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `
        SELECT
          s.subscriberId                         AS subscriber_id,
          s.full_name,
          s.account_status                       AS status,
          s.account_created,

          c.stage                                AS current_stage,
          c.is_funded,
          c.balance,

          COALESCE(p.total_spent, 0)             AS amount_spent

        FROM users s                             /* confirm: subscribers table name */

        LEFT JOIN LATERAL (
          SELECT stage, is_funded, balance
          FROM challenges                        /* confirm: challenges table name */
          WHERE subscriber_id = s.subscriberId  /* confirm: foreign key column name */
          ORDER BY created_at DESC
          LIMIT 1
        ) c ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount), 0) AS total_spent
          FROM payments                          /* confirm: payments table name */
          WHERE subscriber_id = s.subscriberId  /* confirm: foreign key column name */
        ) p ON true

        ORDER BY s.subscriberId
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM users`), /* confirm: subscribers table name */
    ]);

    res.json({
      data:  rows,
      total: parseInt(countRows[0].count),
      page:  parseInt(req.query.page) || 0,
      limit,
    });
  } catch (err) {
    console.error('[wibiz] GET /subscribers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
