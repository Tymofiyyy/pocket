const db = require('../config/database');

class UserController {
  // Отримати всіх користувачів з пагінацією
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      // Запит з пошуком
      let query = `
        SELECT 
          u.*,
          COUNT(DISTINCT ue.id) as events_count,
          COALESCE(SUM(CASE WHEN ue.event_type IN ('ftd', 'repeat_deposit') THEN ue.amount ELSE 0 END), 0) as total_deposits
        FROM users u
        LEFT JOIN user_events ue ON u.id = ue.user_id
      `;

      const params = [];
      if (search) {
        query += ` WHERE CAST(u.telegram_id AS TEXT) LIKE $1 
                   OR u.click_id LIKE $1 
                   OR u.trader_id LIKE $1`;
        params.push(`%${search}%`);
      }

      query += ` GROUP BY u.id 
                 ORDER BY u.first_seen_at DESC 
                 LIMIT $${params.length + 1} 
                 OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      // Загальна кількість
      let countQuery = 'SELECT COUNT(*) FROM users';
      const countParams = [];
      if (search) {
        countQuery += ` WHERE CAST(telegram_id AS TEXT) LIKE $1 
                        OR click_id LIKE $1 
                        OR trader_id LIKE $1`;
        countParams.push(`%${search}%`);
      }
      
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Отримати одного користувача з подіями
  async getOne(req, res) {
    try {
      const { id } = req.params;

      // Користувач
      const userResult = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Події користувача
      const eventsResult = await db.query(
        'SELECT * FROM user_events WHERE user_id = $1 ORDER BY received_at DESC',
        [id]
      );

      // Відправлені повідомлення
      const messagesResult = await db.query(
        `SELECT 
          ml.*,
          mc.name as chain_name,
          ta.phone_number as account_phone
         FROM message_logs ml
         LEFT JOIN message_chains mc ON ml.chain_id = mc.id
         LEFT JOIN telegram_accounts ta ON ml.telegram_account_id = ta.id
         WHERE ml.user_id = $1
         ORDER BY ml.sent_at DESC`,
        [id]
      );

      res.json({
        user: userResult.rows[0],
        events: eventsResult.rows,
        messages: messagesResult.rows
      });
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Статистика користувачів
  async getStats(req, res) {
    try {
      // Загальна кількість
      const totalResult = await db.query('SELECT COUNT(*) FROM users');
      
      // З Telegram ID
      const withTelegramResult = await db.query(
        'SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL'
      );

      // FTD
      const ftdResult = await db.query(
        `SELECT COUNT(DISTINCT user_id) 
         FROM user_events 
         WHERE event_type = 'ftd'`
      );

      // Загальна сума депозитів
      const depositsResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM user_events
         WHERE event_type IN ('ftd', 'repeat_deposit')`
      );

      // Нові за сьогодні
      const todayResult = await db.query(
        `SELECT COUNT(*) FROM users 
         WHERE DATE(first_seen_at) = CURRENT_DATE`
      );

      res.json({
        total_users: parseInt(totalResult.rows[0].count),
        with_telegram: parseInt(withTelegramResult.rows[0].count),
        ftd_users: parseInt(ftdResult.rows[0].count),
        total_deposits: parseFloat(depositsResult.rows[0].total),
        new_today: parseInt(todayResult.rows[0].count)
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new UserController();
