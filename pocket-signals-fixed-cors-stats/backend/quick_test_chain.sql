-- ШВИДКИЙ ТЕСТ: Простий ланцюжок для реєстрації
-- Відразу після виконання спробуй надіслати тестовий постбек!

-- 1. Створюємо ланцюжок
INSERT INTO message_chains (name, trigger_event, is_active)
VALUES ('Тест: Вітання', 'registration', true);

-- 2. Додаємо одне просте повідомлення (відразу, без затримки)
INSERT INTO chain_steps (chain_id, step_order, delay_hours, message_type, message_text)
VALUES (
  (SELECT id FROM message_chains WHERE name = 'Тест: Вітання'),
  1,
  0,  -- 0 годин = відразу
  'text',
  '🎉 Привіт! Це тестове повідомлення з автоматичної розсилки Pocket Partners!

Якщо ти отримав це повідомлення - значить все працює ідеально! ✅'
);

-- 3. Перевіряємо що створилось
SELECT 
  mc.id as chain_id,
  mc.name,
  mc.trigger_event,
  cs.id as step_id,
  cs.delay_hours,
  cs.message_text
FROM message_chains mc
JOIN chain_steps cs ON mc.id = cs.chain_id
WHERE mc.name = 'Тест: Вітання';

-- Тепер надішли тестовий постбек:
-- http://localhost:3000/api/postback?click_id=test123&sub_id1=834685407&event=registration
