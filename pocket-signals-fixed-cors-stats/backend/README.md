# Pocket Signals Backend

Backend для автоматизації Telegram розсилки через постбеки Pocket Partners.

## Крок 1: Налаштування

### 1. Встановлення залежностей

```bash
cd backend
npm install
```

### 2. Налаштування бази даних

Створіть PostgreSQL базу даних:

```bash
# Підключіться до PostgreSQL
psql -U postgres

# Створіть базу даних
CREATE DATABASE pocket_signals;

# Вийдіть
\q
```

Виконайте SQL схему:

```bash
psql -U postgres -d pocket_signals -f src/config/schema.sql
```

### 3. Налаштування .env файлу

Скопіюйте `.env.example` в `.env` та заповніть дані:

```bash
cp .env.example .env
```

Відредагуйте `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=pocket_signals
DB_USER=postgres
DB_PASSWORD=your_password

WEBHOOK_SECRET=your_secret_key
```

### 4. Запуск сервера

**Режим розробки (з auto-reload):**
```bash
npm run dev
```

**Продакшн режим:**
```bash
npm start
```

## Тестування

### 1. Перевірка здоров'я сервера

```bash
curl http://localhost:3000/health
```

### 2. Тест postback endpoint

```bash
curl http://localhost:3000/api/test
```

### 3. Тестовий постбек з параметрами

```bash
curl "http://localhost:3000/api/postback?click_id=test123&sub_id1=123456789&event=registration&trader_id=TR001"
```

## Налаштування Pocket Partners

В Pocket Partners в URL постбека вкажіть:

```
http://your-server.com/api/postback?event=reg&click_id={click_id}&sub_id1={sub_id1}&trader_id={trader_id}&sumdep={sumdep}
```

Де:
- `{click_id}` - унікальний ідентифікатор кліку
- `{sub_id1}` - Telegram ID користувача
- `{trader_id}` - ID трейдера
- `{sumdep}` - сума депозиту (для відповідних подій)

## Структура API

### Endpoints

- `GET /` - Інформація про API
- `GET /health` - Перевірка роботи сервера
- `GET /api/test` - Тест postback endpoint
- `POST /api/postback` - Прийом постбеків
- `GET /api/postback` - Прийом постбеків (альтернативний метод)

## База даних

### Таблиці

1. **telegram_accounts** - Telegram акаунти для розсилки
2. **users** - Користувачі з постбеків
3. **user_events** - Події користувачів (реєстрація, депозити тощо)
4. **message_chains** - Ланцюжки повідомлень
5. **chain_steps** - Кроки ланцюжків
6. **message_logs** - Логи відправлених повідомлень
7. **message_queue** - Черга повідомлень для відправки

## Наступні кроки

- [ ] Створити API для адмін-панелі
- [ ] Інтегрувати Telegram (Telethon)
- [ ] Створити планувальник для черги повідомлень
- [ ] Додати frontend адмін-панель
