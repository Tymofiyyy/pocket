const db = require('./database');
const telegramManager = require('./telegramManager');

class MessageQueueProcessor {
  constructor() {
    this.isProcessing = false;
  }

  // Основний метод обробки черги
  async processQueue() {
    if (this.isProcessing) {
      console.log('⏳ Queue processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      console.log('\n🔄 Starting queue processing...');

      // Знаходимо всі повідомлення які потрібно відправити
      const result = await db.query(`
        SELECT 
          mq.*,
          u.telegram_id,
          cs.message_type,
          cs.message_text,
          cs.image_url,
          cs.conditions
        FROM message_queue mq
        JOIN users u ON mq.user_id = u.id
        JOIN chain_steps cs ON mq.step_id = cs.id
        WHERE mq.status = 'pending'
          AND mq.scheduled_at <= NOW()
        ORDER BY mq.scheduled_at ASC
        LIMIT 50
      `);

      if (result.rows.length === 0) {
        console.log('✅ No messages in queue');
        this.isProcessing = false;
        return;
      }

      console.log(`📬 Found ${result.rows.length} messages to send`);

      // Обробляємо кожне повідомлення
      for (const message of result.rows) {
        await this.processMessage(message);
        
        // Затримка між повідомленнями (щоб не флудити)
        await this.sleep(2000);
      }

      console.log('✅ Queue processing completed\n');

    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Обробка одного повідомлення
  async processMessage(message) {
    const {
      id: queueId,
      user_id,
      telegram_id,
      chain_id,
      step_id,
      message_type,
      message_text,
      image_url,
      conditions
    } = message;

    try {
      console.log(`\n📤 Processing message ${queueId} for user ${telegram_id}`);

      // Перевіряємо чи є Telegram ID
      if (!telegram_id) {
        throw new Error('User has no Telegram ID');
      }

      // Перевіряємо умови (якщо є)
      if (conditions) {
        const conditionsMet = await this.checkConditions(user_id, conditions);
        if (!conditionsMet) {
          console.log('⏭️  Conditions not met, skipping message');
          await this.updateQueueStatus(queueId, 'skipped', 'Conditions not met');
          return;
        }
      }

      // Оновлюємо статус на "processing"
      await this.updateQueueStatus(queueId, 'processing');

      let result;
      let accountId;

      // Відправляємо повідомлення залежно від типу
      switch (message_type) {
        case 'text':
          result = await telegramManager.sendTextMessage(telegram_id, message_text);
          accountId = result.accountId;
          break;

        case 'image':
          result = await telegramManager.sendImage(telegram_id, image_url);
          accountId = result.accountId;
          break;

        case 'text_with_image':
          result = await telegramManager.sendImageWithText(telegram_id, image_url, message_text);
          accountId = result.accountId;
          break;

        default:
          throw new Error(`Unknown message type: ${message_type}`);
      }

      // Логуємо успішну відправку
      await this.logMessage(user_id, chain_id, step_id, accountId, 'sent');

      // Оновлюємо статус черги
      await this.updateQueueStatus(queueId, 'completed');

      console.log(`✅ Message sent successfully to ${telegram_id}`);

    } catch (error) {
      console.error(`❌ Error sending message ${queueId}:`, error.message);

      // Логуємо помилку
      await this.logMessage(user_id, chain_id, step_id, null, 'failed', error.message);

      // Оновлюємо статус черги
      const attempts = message.attempts + 1;
      
      if (attempts >= 3) {
        // Після 3 спроб - позначаємо як failed
        await this.updateQueueStatus(queueId, 'failed', error.message);
      } else {
        // Інакше - ставимо назад в чергу з затримкою
        const nextAttempt = new Date();
        nextAttempt.setMinutes(nextAttempt.getMinutes() + (attempts * 5)); // 5, 10, 15 хвилин

        await db.query(
          `UPDATE message_queue 
           SET status = 'pending', 
               attempts = $1, 
               scheduled_at = $2
           WHERE id = $3`,
          [attempts, nextAttempt, queueId]
        );
        
        console.log(`🔄 Message rescheduled for ${nextAttempt.toISOString()}`);
      }
    }
  }

  // Перевірка умов
  async checkConditions(userId, conditions) {
    try {
      // Парсимо JSON умови
      const cond = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;

      // Наприклад: { "min_deposit": 100, "event_type": "ftd" }
      if (cond.min_deposit) {
        const result = await db.query(
          `SELECT SUM(amount) as total 
           FROM user_events 
           WHERE user_id = $1 
             AND event_type IN ('ftd', 'repeat_deposit')
             AND amount IS NOT NULL`,
          [userId]
        );

        const total = parseFloat(result.rows[0]?.total || 0);
        if (total < cond.min_deposit) {
          return false;
        }
      }

      if (cond.event_type) {
        const result = await db.query(
          `SELECT COUNT(*) as count 
           FROM user_events 
           WHERE user_id = $1 AND event_type = $2`,
          [userId, cond.event_type]
        );

        if (result.rows[0].count === 0) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('❌ Error checking conditions:', error);
      return true; // Якщо помилка в умовах - відправляємо повідомлення
    }
  }

  // Оновлення статусу в черзі
  async updateQueueStatus(queueId, status, errorMessage = null) {
    await db.query(
      `UPDATE message_queue 
       SET status = $1, 
           attempts = attempts + 1
       WHERE id = $2`,
      [status, queueId]
    );
  }

  // Логування відправленого повідомлення
  async logMessage(userId, chainId, stepId, accountId, status, errorMessage = null) {
    await db.query(
      `INSERT INTO message_logs 
       (user_id, chain_id, step_id, telegram_account_id, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, chainId, stepId, accountId, status, errorMessage]
    );
  }

  // Допоміжний метод для затримки
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Очистка старих записів з черги (completed/failed старше 7 днів)
  async cleanupOldMessages() {
    try {
      const result = await db.query(
        `DELETE FROM message_queue 
         WHERE status IN ('completed', 'failed', 'skipped')
           AND created_at < NOW() - INTERVAL '7 days'`
      );

      if (result.rowCount > 0) {
        console.log(`🗑️  Cleaned up ${result.rowCount} old messages from queue`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old messages:', error);
    }
  }
}

module.exports = new MessageQueueProcessor();
