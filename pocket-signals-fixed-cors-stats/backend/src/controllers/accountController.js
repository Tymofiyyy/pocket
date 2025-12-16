const db = require('../config/database');

class AccountController {
  // Отримати всі акаунти
  async getAll(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          id,
          phone_number,
          api_id,
          is_active,
          created_at,
          updated_at,
          (session_string IS NOT NULL AND session_string != '') as is_authorized
        FROM telegram_accounts
        ORDER BY created_at DESC
      `);

      res.json({ accounts: result.rows });
    } catch (error) {
      console.error('Error getting accounts:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Додати новий акаунт
  async create(req, res) {
    try {
      const { phone_number, api_id, api_hash } = req.body;

      if (!phone_number || !api_id || !api_hash) {
        return res.status(400).json({ 
          error: 'phone_number, api_id, and api_hash are required' 
        });
      }

      // Перевіряємо чи не існує вже такий номер
      const existing = await db.query(
        'SELECT id FROM telegram_accounts WHERE phone_number = $1',
        [phone_number]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Account with this phone number already exists' 
        });
      }

      const result = await db.query(
        `INSERT INTO telegram_accounts (phone_number, api_id, api_hash)
         VALUES ($1, $2, $3)
         RETURNING id, phone_number, api_id, is_active, created_at`,
        [phone_number, api_id, api_hash]
      );

      res.status(201).json({
        message: 'Account added. Please authorize it using telegram-bot/auth.js',
        account: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Оновити акаунт
  async update(req, res) {
    try {
      const { id } = req.params;
      const { phone_number, api_id, api_hash, is_active } = req.body;

      const result = await db.query(
        `UPDATE telegram_accounts
         SET phone_number = COALESCE($1, phone_number),
             api_id = COALESCE($2, api_id),
             api_hash = COALESCE($3, api_hash),
             is_active = COALESCE($4, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, phone_number, api_id, is_active`,
        [phone_number, api_id, api_hash, is_active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        message: 'Account updated successfully',
        account: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Видалити акаунт
  async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM telegram_accounts WHERE id = $1 RETURNING phone_number',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({ 
        message: 'Account deleted successfully',
        phone_number: result.rows[0].phone_number
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Статистика відправлень по акаунтам
  async getStats(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          ta.id,
          ta.phone_number,
          ta.is_active,
          COUNT(ml.id) as messages_sent,
          COUNT(CASE WHEN ml.status = 'sent' THEN 1 END) as messages_success,
          COUNT(CASE WHEN ml.status = 'failed' THEN 1 END) as messages_failed,
          MAX(ml.sent_at) as last_used
        FROM telegram_accounts ta
        LEFT JOIN message_logs ml ON ta.id = ml.telegram_account_id
        GROUP BY ta.id, ta.phone_number, ta.is_active
        ORDER BY messages_sent DESC
      `);

      res.json({ stats: result.rows });
    } catch (error) {
      console.error('Error getting account stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AccountController();
