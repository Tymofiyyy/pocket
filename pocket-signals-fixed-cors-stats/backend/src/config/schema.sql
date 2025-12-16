-- Таблиця для Telegram акаунтів
CREATE TABLE IF NOT EXISTS telegram_accounts (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    api_id VARCHAR(50) NOT NULL,
    api_hash VARCHAR(100) NOT NULL,
    session_string TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця для користувачів з постбеків
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    click_id VARCHAR(255) UNIQUE NOT NULL,
    site_id VARCHAR(255),
    trader_id VARCHAR(255),
    country VARCHAR(10),
    device_type VARCHAR(50),
    os_version VARCHAR(50),
    browser VARCHAR(50),
    promo VARCHAR(100),
    link_type VARCHAR(100),
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_click_id ON users(click_id);

-- Таблиця для подій користувачів (депозити, виводи, комісії)
CREATE TABLE IF NOT EXISTS user_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'registration', 'email_confirmed', 'ftd', 'repeat_deposit', 'commission', 'withdrawal'
    amount DECIMAL(10, 2), -- для депозитів, виводів, комісій
    status VARCHAR(50), -- для виводів: 'new', 'cancelled', 'processed'
    event_data JSONB, -- додаткові дані з постбека
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);

-- Таблиця для ланцюжків повідомлень
CREATE TABLE IF NOT EXISTS message_chains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(50) NOT NULL, -- 'registration', 'ftd', etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця для кроків ланцюжка
CREATE TABLE IF NOT EXISTS chain_steps (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER REFERENCES message_chains(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    delay_hours INTEGER DEFAULT 0, -- затримка перед відправкою
    message_type VARCHAR(20) NOT NULL, -- 'text', 'image', 'text_with_image'
    message_text TEXT,
    image_url TEXT,
    conditions JSONB, -- умови для відправки (напр., депозит > 100)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chain_steps_chain_id ON chain_steps(chain_id);

-- Таблиця для логів відправлених повідомлень
CREATE TABLE IF NOT EXISTS message_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    chain_id INTEGER REFERENCES message_chains(id) ON DELETE SET NULL,
    step_id INTEGER REFERENCES chain_steps(id) ON DELETE SET NULL,
    telegram_account_id INTEGER REFERENCES telegram_accounts(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'pending'
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);

-- Таблиця для черги відправки повідомлень
CREATE TABLE IF NOT EXISTS message_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    chain_id INTEGER REFERENCES message_chains(id) ON DELETE CASCADE,
    step_id INTEGER REFERENCES chain_steps(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled ON message_queue(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_message_queue_user_id ON message_queue(user_id);
