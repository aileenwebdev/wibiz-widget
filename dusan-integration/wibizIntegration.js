/**
 * Wibiz.ai — Subscriber Data Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop this file into your routes/ folder and mount it in your Express app.
 *
 * SETUP (2 steps):
 *
 * 1. Add to your .env:
 *      WIBIZ_API_KEY=<the key you agreed with Wibiz>
 *
 * 2. In your main app.js / server.js, add:
 *      const wibiz = require('./routes/wibizIntegration');
 *      app.use('/api/wibiz', wibiz);
 *
 * That's it. No new service, no new database, no new dependencies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router  = express.Router();

// Use your existing pg Pool — import it however your project exposes it.
// Example: const pool = require('../db');
// ↓ TODO: replace this line with how you import your pg Pool
const pool = require('../db');

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.WIBIZ_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── GET /api/wibiz/subscriber/:id ───────────────────────────────────────────
// Returns a single subscriber's current data. Called by Wibiz mid-conversation.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriber/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        s.<TODO: subscriber id column>         AS subscriber_id,
        s.<TODO: email column>                 AS email,
        s.<TODO: full name column>             AS full_name,
        s.<TODO: status column>                AS status,
        s.<TODO: created at column>            AS account_created,

        -- Most recent challenge only (stage / funded / balance)
        c.<TODO: stage column>                 AS current_stage,
        c.<TODO: is funded column>             AS is_funded,
        c.<TODO: balance column>               AS balance,

        -- Total amount spent across all payments
        COALESCE(p.total_spent, 0)             AS amount_spent

      FROM <TODO: subscribers table> s

      -- Most recent challenge
      LEFT JOIN LATERAL (
        SELECT
          <TODO: stage column>,
          <TODO: is funded column>,
          <TODO: balance column>
        FROM <TODO: challenges table>
        WHERE <TODO: challenge subscriber fk> = s.<TODO: subscriber id column>
        ORDER BY <TODO: challenge created at column> DESC
        LIMIT 1
      ) c ON true

      -- Total spend
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(<TODO: payment amount column>), 0) AS total_spent
        FROM <TODO: payments table>
        WHERE <TODO: payment subscriber fk> = s.<TODO: subscriber id column>
      ) p ON true

      WHERE s.<TODO: subscriber id column> = $1
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
// Paginated list of all subscribers. Used for the initial bulk sync and the
// 15-minute background sync on Wibiz's side.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscribers', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 100);
  const offset = (parseInt(req.query.page) || 0) * limit;

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `
        SELECT
          s.<TODO: subscriber id column>         AS subscriber_id,
          s.<TODO: email column>                 AS email,
          s.<TODO: full name column>             AS full_name,
          s.<TODO: status column>                AS status,
          s.<TODO: created at column>            AS account_created,

          c.<TODO: stage column>                 AS current_stage,
          c.<TODO: is funded column>             AS is_funded,
          c.<TODO: balance column>               AS balance,

          COALESCE(p.total_spent, 0)             AS amount_spent

        FROM <TODO: subscribers table> s

        LEFT JOIN LATERAL (
          SELECT
            <TODO: stage column>,
            <TODO: is funded column>,
            <TODO: balance column>
          FROM <TODO: challenges table>
          WHERE <TODO: challenge subscriber fk> = s.<TODO: subscriber id column>
          ORDER BY <TODO: challenge created at column> DESC
          LIMIT 1
        ) c ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(<TODO: payment amount column>), 0) AS total_spent
          FROM <TODO: payments table>
          WHERE <TODO: payment subscriber fk> = s.<TODO: subscriber id column>
        ) p ON true

        ORDER BY s.<TODO: subscriber id column>
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM <TODO: subscribers table>`),
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
