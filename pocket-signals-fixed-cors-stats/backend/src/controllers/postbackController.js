const db = require('../config/database');

class PostbackController {
  // Обробка постбека від Pocket Partners
  async handlePostback(req, res) {
    try {
      console.log('📨 Received postback:', req.body);
      console.log('📨 Query params:', req.query);

      // Отримуємо параметри з query string (як їх надсилає Pocket Partners)
      const {
        click_id,
        site_id,
        trader_id,
        cid,
        ac,
        sub_id1, // Telegram ID користувача
        sub_id2,
        sub_id3,
        sub_id4,
        sub_id5,
        country,
        device_type,
        os_version,
        browser,
        promo,
        link_type,
        date_time,
        sumdep,
        wdr_sum,
        status,
        commission
      } = req.query;

      // Визначаємо тип події з URL або параметрів
      const eventType = this.detectEventType(req.query);
      
      if (!click_id) {
        return res.status(400).json({ 
          error: 'Missing required parameter: click_id' 
        });
      }

      // Telegram ID з sub_id1
      const telegramId = sub_id1 ? parseInt(sub_id1) : null;

      // Створюємо або оновлюємо користувача
      const user = await this.upsertUser({
        telegram_id: telegramId,
        click_id,
        site_id,
        trader_id,
        country,
        device_type,
        os_version,
        browser,
        promo,
        link_type
      });

      // Зберігаємо подію
      await this.createUserEvent({
        user_id: user.id,
        event_type: eventType,
        amount: sumdep || wdr_sum || commission,
        status: status,
        event_data: {
          cid,
          ac,
          date_time,
          sub_id2,
          sub_id3,
          sub_id4,
          sub_id5,
          raw_query: req.query
        }
      });

      // Знаходимо активні ланцюжки для цієї події
      await this.triggerMessageChains(user.id, eventType);

      // Відповідаємо успіхом
      res.status(200).json({ 
        success: true, 
        message: 'Postback processed',
        user_id: user.id,
        event_type: eventType
      });

    } catch (error) {
      console.error('❌ Error processing postback:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }

  // Визначення типу події
  detectEventType(params) {
    const url = params.event || '';
    
    if (url.includes('reg') || params.event_type === 'registration') {
      return 'registration';
    }
    if (url.includes('email') || params.event_type === 'email_confirmed') {
      return 'email_confirmed';
    }
    if (url.includes('ftd') || params.event_type === 'ftd') {
      return 'ftd';
    }
    if (url.includes('deposit') || params.event_type === 'repeat_deposit') {
      return 'repeat_deposit';
    }
    if (url.includes('commission') || params.event_type === 'commission') {
      return 'commission';
    }
    if (url.includes('withdrawal') || params.event_type === 'withdrawal') {
      return 'withdrawal';
    }
    
    return 'unknown';
  }

  // Створення або оновлення користувача
  async upsertUser(userData) {
    const {
      telegram_id,
      click_id,
      site_id,
      trader_id,
      country,
      device_type,
      os_version,
      browser,
      promo,
      link_type
    } = userData;

    // Спочатку шукаємо по click_id
    const existingUser = await db.query(
      'SELECT * FROM users WHERE click_id = $1',
      [click_id]
    );

    if (existingUser.rows.length > 0) {
      // Оновлюємо існуючого користувача
      const result = await db.query(
        `UPDATE users SET 
          telegram_id = COALESCE($1, telegram_id),
          site_id = COALESCE($2, site_id),
          trader_id = COALESCE($3, trader_id),
          country = COALESCE($4, country),
          device_type = COALESCE($5, device_type),
          os_version = COALESCE($6, os_version),
          browser = COALESCE($7, browser),
          promo = COALESCE($8, promo),
          link_type = COALESCE($9, link_type),
          updated_at = CURRENT_TIMESTAMP
        WHERE click_id = $10
        RETURNING *`,
        [telegram_id, site_id, trader_id, country, device_type, 
         os_version, browser, promo, link_type, click_id]
      );
      return result.rows[0];
    } else {
      // Створюємо нового користувача
      const result = await db.query(
        `INSERT INTO users (
          telegram_id, click_id, site_id, trader_id, country,
          device_type, os_version, browser, promo, link_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [telegram_id, click_id, site_id, trader_id, country,
         device_type, os_version, browser, promo, link_type]
      );
      return result.rows[0];
    }
  }

  // Створення події користувача
  async createUserEvent(eventData) {
    const { user_id, event_type, amount, status, event_data } = eventData;

    const result = await db.query(
      `INSERT INTO user_events (
        user_id, event_type, amount, status, event_data
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [user_id, event_type, amount, status, JSON.stringify(event_data)]
    );

    return result.rows[0];
  }

  // Запуск ланцюжків повідомлень
  async triggerMessageChains(userId, eventType) {
    try {
      // Знаходимо всі активні ланцюжки для цього типу події
      const chains = await db.query(
        `SELECT * FROM message_chains 
         WHERE trigger_event = $1 AND is_active = true`,
        [eventType]
      );

      if (chains.rows.length === 0) {
        console.log(`ℹ️  No active chains found for event: ${eventType}`);
        return;
      }

      // Для кожного ланцюжка створюємо завдання в черзі
      for (const chain of chains.rows) {
        // Отримуємо всі кроки ланцюжка
        const steps = await db.query(
          `SELECT * FROM chain_steps 
           WHERE chain_id = $1 
           ORDER BY step_order ASC`,
          [chain.id]
        );

        // Додаємо кожен крок до черги з відповідною затримкою
        for (const step of steps.rows) {
          const scheduledAt = new Date();
          scheduledAt.setHours(scheduledAt.getHours() + step.delay_hours);

          await db.query(
            `INSERT INTO message_queue (
              user_id, chain_id, step_id, scheduled_at
            ) VALUES ($1, $2, $3, $4)`,
            [userId, chain.id, step.id, scheduledAt]
          );
        }

        console.log(`✅ Added ${steps.rows.length} messages to queue for chain: ${chain.name}`);
      }
    } catch (error) {
      console.error('❌ Error triggering message chains:', error);
    }
  }

  // Тестовий endpoint для перевірки
  async test(req, res) {
    res.json({ 
      status: 'ok',
      message: 'Postback endpoint is working',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new PostbackController();
