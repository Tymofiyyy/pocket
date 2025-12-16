# Pocket Signals - Telegram Bot

Модуль для автоматичної розсилки повідомлень через Telegram.

## Функції

- ✅ Підключення кількох Telegram акаунтів
- ✅ Рандомний вибір акаунта для відправки
- ✅ Відправка текстових повідомлень
- ✅ Відправка зображень
- ✅ Відправка зображень з текстом
- ✅ Обробка черги повідомлень
- ✅ Автоматичні повторні спроби при помилках
- ✅ Перевірка умов перед відправкою
- ✅ Логування всіх відправлень

## Встановлення

```bash
cd telegram-bot
npm install
```

## Налаштування

1. Створіть `.env` файл:

```bash
cp .env.example .env
```

2. Заповніть дані бази (ті самі що і в backend):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pocket_signals
DB_USER=postgres
DB_PASSWORD=your_password

QUEUE_CHECK_INTERVAL=*/5 * * * *
```

## Отримання API credentials

1. Перейдіть на https://my.telegram.org
2. Увійдіть з вашим номером телефону
3. Перейдіть в "API development tools"
4. Створіть новий додаток
5. Скопіюйте **api_id** та **api_hash**

## Авторизація акаунтів

Запустіть скрипт авторизації:

```bash
npm run auth
```

Введіть:
- Номер телефону (з кодом країни, наприклад +380123456789)
- API ID
- API Hash
- Код підтвердження з Telegram
- Пароль (якщо увімкнена 2FA)

Акаунт буде збережений в базі даних і готовий до використання.

Ви можете додати кілька акаунтів - вони будуть використовуватись рандомно.

## Запуск бота

**Режим розробки:**
```bash
npm run dev
```

**Продакшн:**
```bash
npm start
```

## Як це працює

1. **Backend** додає повідомлення в чергу (`message_queue`)
2. **Telegram Bot** перевіряє чергу кожні 5 хвилин (або за вашим розкладом)
3. Для кожного повідомлення:
   - Перевіряє умови (якщо є)
   - Вибирає рандомний Telegram акаунт
   - Відправляє повідомлення
   - Логує результат
4. При помилці - робить до 3 спроб з затримкою

## Структура

```
telegram-bot/
├── index.js              - Головний файл
├── auth.js               - Авторизація акаунтів
├── telegramManager.js    - Керування Telegram клієнтами
├── queueProcessor.js     - Обробка черги повідомлень
├── database.js           - Підключення до БД
└── sessions/             - Сесії Telegram (автоматично)
```

## Типи повідомлень

### Текст
```javascript
message_type: 'text'
message_text: 'Привіт! Дякую за реєстрацію!'
```

### Зображення
```javascript
message_type: 'image'
image_url: 'https://example.com/image.jpg'
```

### Зображення з текстом
```javascript
message_type: 'text_with_image'
message_text: 'Подивись на це!'
image_url: 'https://example.com/image.jpg'
```

## Умови відправки

Можна додати умови в `conditions` (JSON):

```json
{
  "min_deposit": 100,
  "event_type": "ftd"
}
```

Повідомлення відправиться тільки якщо:
- Сума депозитів >= 100
- Була подія типу "ftd"

## Моніторинг

Всі відправлені повідомлення логуються в таблицю `message_logs`:

```sql
SELECT 
  ml.*,
  u.telegram_id,
  ta.phone_number as account
FROM message_logs ml
JOIN users u ON ml.user_id = u.id
LEFT JOIN telegram_accounts ta ON ml.telegram_account_id = ta.id
ORDER BY ml.sent_at DESC;
```

## Troubleshooting

### "No active Telegram clients available"
- Запустіть `npm run auth` для додавання акаунтів

### "User ... not found"
- Перевірте чи правильний telegram_id в базі
- Telegram ID має бути числом (наприклад: 123456789)

### Повідомлення не відправляються
- Перевірте чи є записи в `message_queue` зі статусом 'pending'
- Перевірте чи правильно працює cron (логи)
- Перевірте чи `scheduled_at` вже настав

## Корисні SQL запити

**Переглянути чергу:**
```sql
SELECT * FROM message_queue WHERE status = 'pending' ORDER BY scheduled_at;
```

**Переглянути логи:**
```sql
SELECT * FROM message_logs ORDER BY sent_at DESC LIMIT 10;
```

**Статистика:**
```sql
SELECT 
  status, 
  COUNT(*) as count 
FROM message_logs 
GROUP BY status;
```
