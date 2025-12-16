const db = require('../config/database');

class StatsController {
  // Загальна статистика
  async getOverview(req, res) {
    try {
      console.log('📊 Getting overview stats...');
      
      // Користувачі
      console.log('   Getting users stats...');
      const usersStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN telegram_id IS NOT NULL THEN 1 END) as with_telegram,
          COUNT(CASE WHEN DATE(first_seen_at) = CURRENT_DATE THEN 1 END) as today
        FROM users
      `);
      console.log('   Users:', usersStats.rows[0]);

      // Події
      console.log('   Getting events stats...');
      const eventsStats = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM user_events
        GROUP BY event_type
      `);
      console.log('   Events:', eventsStats.rows);

      // Повідомлення
      console.log('   Getting messages stats...');
      const messagesStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN DATE(sent_at) = CURRENT_DATE THEN 1 END) as today
        FROM message_logs
      `);
      console.log('   Messages:', messagesStats.rows[0]);

      // Черга
      console.log('   Getting queue stats...');
      const queueStats = await db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM message_queue
        GROUP BY status
      `);
      console.log('   Queue:', queueStats.rows);

      // Ланцюжки
      console.log('   Getting chains stats...');
      const chainsStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active
        FROM message_chains
      `);
      console.log('   Chains:', chainsStats.rows[0]);

      const response = {
        users: usersStats.rows[0],
        events: eventsStats.rows,
        messages: messagesStats.rows[0],
        queue: queueStats.rows,
        chains: chainsStats.rows[0]
      };
      
      console.log('✅ Overview stats ready');
      res.json(response);
    } catch (error) {
      console.error('❌ Error getting overview:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Статистика по днях (останні 30 днів)
  async getDailyStats(req, res) {
    try {
      const { days = 30 } = req.query;

      const result = await db.query(`
        SELECT 
          DATE(date) as date,
          COALESCE(registrations, 0) as registrations,
          COALESCE(ftd, 0) as ftd,
          COALESCE(deposits_sum, 0) as deposits_sum,
          COALESCE(messages_sent, 0) as messages_sent
        FROM generate_series(
          CURRENT_DATE - INTERVAL '${days} days',
          CURRENT_DATE,
          '1 day'::interval
        ) date
        LEFT JOIN (
          SELECT 
            DATE(first_seen_at) as date,
            COUNT(*) as registrations
          FROM users
          WHERE first_seen_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(first_seen_at)
        ) u ON DATE(date) = u.date
        LEFT JOIN (
          SELECT 
            DATE(received_at) as date,
            COUNT(CASE WHEN event_type = 'ftd' THEN 1 END) as ftd,
            SUM(CASE WHEN event_type IN ('ftd', 'repeat_deposit') THEN amount ELSE 0 END) as deposits_sum
          FROM user_events
          WHERE received_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(received_at)
        ) e ON DATE(date) = e.date
        LEFT JOIN (
          SELECT 
            DATE(sent_at) as date,
            COUNT(*) as messages_sent
          FROM message_logs
          WHERE sent_at >= CURRENT_DATE - INTERVAL '${days} days'
            AND status = 'sent'
          GROUP BY DATE(sent_at)
        ) m ON DATE(date) = m.date
        ORDER BY date DESC
      `);

      res.json({ daily: result.rows });
    } catch (error) {
      console.error('Error getting daily stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Останні логи повідомлень
  async getRecentLogs(req, res) {
    try {
      const { limit = 50, status } = req.query;

      let query = `
        SELECT 
          ml.*,
          u.telegram_id,
          u.click_id,
          mc.name as chain_name,
          ta.phone_number as account_phone
        FROM message_logs ml
        LEFT JOIN users u ON ml.user_id = u.id
        LEFT JOIN message_chains mc ON ml.chain_id = mc.id
        LEFT JOIN telegram_accounts ta ON ml.telegram_account_id = ta.id
      `;

      const params = [];
      if (status) {
        query += ' WHERE ml.status = $1';
        params.push(status);
      }

      query += ' ORDER BY ml.sent_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await db.query(query, params);

      res.json({ logs: result.rows });
    } catch (error) {
      console.error('Error getting logs:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Статистика по ланцюжках
  async getChainStats(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          mc.id,
          mc.name,
          mc.trigger_event,
          mc.is_active,
          COUNT(DISTINCT mq.user_id) as users_in_queue,
          COUNT(DISTINCT ml.user_id) as users_messaged,
          COUNT(CASE WHEN ml.status = 'sent' THEN 1 END) as messages_sent,
          COUNT(CASE WHEN ml.status = 'failed' THEN 1 END) as messages_failed
        FROM message_chains mc
        LEFT JOIN message_queue mq ON mc.id = mq.chain_id AND mq.status = 'pending'
        LEFT JOIN message_logs ml ON mc.id = ml.chain_id
        GROUP BY mc.id, mc.name, mc.trigger_event, mc.is_active
        ORDER BY messages_sent DESC
      `);

      res.json({ chain_stats: result.rows });
    } catch (error) {
      console.error('Error getting chain stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new StatsController();
