-- Міграція: Додавання поля image_url до chain_steps (якщо його немає)
-- Дата: 2025-12-13

-- Перевіряємо чи існує колонка image_url
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='chain_steps' 
        AND column_name='image_url'
    ) THEN
        -- Додаємо колонку якщо її немає
        ALTER TABLE chain_steps ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Column image_url added to chain_steps';
    ELSE
        RAISE NOTICE 'Column image_url already exists in chain_steps';
    END IF;
END $$;

-- Можна також додати коментар до колонки
COMMENT ON COLUMN chain_steps.image_url IS 'URL зображення, що зберігається в /uploads/ або зовнішнє посилання';

-- Вивести всі колонки таблиці для перевірки
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chain_steps'
ORDER BY ordinal_position;
