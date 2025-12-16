require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const db = require('./database');

console.log('🔐 Telegram Account Authorization\n');

async function authorizeAccount() {
  let client = null;
  
  try {
    // Питаємо дані акаунта
    console.log('Enter account details:');
    const phoneNumber = await input.text('Phone number (with country code, e.g., +380123456789): ');
    const apiId = await input.text('API ID: ');
    const apiHash = await input.text('API Hash: ');

    // Перевіряємо чи існує такий акаунт в БД
    const existing = await db.query(
      'SELECT * FROM telegram_accounts WHERE phone_number = $1',
      [phoneNumber]
    );

    let session = '';
    if (existing.rows.length > 0 && existing.rows[0].session_string) {
      console.log('\n✅ Found existing session for this account');
      session = existing.rows[0].session_string;
    }

    // Створюємо клієнта
    const stringSession = new StringSession(session);
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    console.log('\n📱 Connecting to Telegram...');
    
    // Стартуємо клієнта з обробкою всіх можливих випадків
    await client.start({
      phoneNumber: async () => {
        console.log('\n📞 Using phone number:', phoneNumber);
        return phoneNumber;
      },
      
      phoneCode: async () => {
        console.log('\n📨 Telegram sent you a verification code');
        const code = await input.text('Enter the code you received: ');
        return code;
      },
      
      password: async () => {
        console.log('\n🔒 This account has Two-Factor Authentication (2FA) enabled');
        const pwd = await input.text('Enter your 2FA password: ');
        return pwd;
      },
      
      onError: (err) => {
        console.error('❌ Authentication Error:', err.message);
        throw err;
      },
    });

    console.log('\n✅ Successfully connected!');

    // Перевіряємо чи авторизовані
    const isAuth = await client.isUserAuthorized();
    if (!isAuth) {
      throw new Error('Authorization failed - client is not authorized');
    }

    // Отримуємо інформацію про акаунт
    const me = await client.getMe();
    console.log('\n👤 Account info:');
    console.log(`   Name: ${me.firstName} ${me.lastName || ''}`);
    console.log(`   Username: @${me.username || 'N/A'}`);
    console.log(`   ID: ${me.id}`);
    console.log(`   Phone: ${me.phone}`);

    // Зберігаємо session string
    const sessionString = client.session.save();
    console.log('\n💾 Session saved');

    // Зберігаємо в БД
    if (existing.rows.length > 0) {
      // Оновлюємо існуючий
      await db.query(
        `UPDATE telegram_accounts 
         SET api_id = $1, api_hash = $2, session_string = $3, is_active = true, updated_at = NOW()
         WHERE phone_number = $4`,
        [apiId, apiHash, sessionString, phoneNumber]
      );
      console.log('✅ Account updated in database');
    } else {
      // Створюємо новий
      await db.query(
        `INSERT INTO telegram_accounts (phone_number, api_id, api_hash, session_string, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [phoneNumber, apiId, apiHash, sessionString]
      );
      console.log('✅ Account saved to database');
    }

    // Відключаємось
    await client.disconnect();
    console.log('🔌 Disconnected from Telegram');
    
    console.log('\n✨ Authorization complete!');
    console.log('You can now use this account for sending messages.\n');

    // Питаємо чи додати ще один акаунт
    const addAnother = await input.confirm('Add another account? (y/n): ');
    if (addAnother) {
      await authorizeAccount();
    } else {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error during authorization:');
    console.error('   Message:', error.message);
    
    if (error.message.includes('PASSWORD_HASH_INVALID')) {
      console.error('   → Wrong 2FA password! Please try again.');
    } else if (error.message.includes('PHONE_CODE_INVALID')) {
      console.error('   → Wrong verification code! Please try again.');
    } else if (error.message.includes('PHONE_NUMBER_INVALID')) {
      console.error('   → Invalid phone number format! Use format: +380123456789');
    } else if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
      console.error('   → 2FA password is required but not provided!');
    }
    
    // Закриваємо клієнт якщо він відкритий
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {
        // Ігноруємо помилки при закритті
      }
    }
    
    const retry = await input.confirm('\nTry again? (y/n): ');
    if (retry) {
      await authorizeAccount();
    } else {
      console.log('\n👋 Goodbye!');
      process.exit(1);
    }
  }
}

// Головна функція
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Telegram Account Authorization Helper');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('This script will help you authorize Telegram accounts.');
  console.log('\n📋 You will need:');
  console.log('   1. Phone number (with country code, e.g., +380123456789)');
  console.log('   2. API ID and API Hash');
  console.log('      → Get from: https://my.telegram.org/apps');
  console.log('   3. Verification code (will be sent to Telegram)');
  console.log('   4. 2FA password (if Two-Factor Auth is enabled)\n');
  
  console.log('💡 Tips:');
  console.log('   - You can add multiple accounts');
  console.log('   - Sessions are saved securely in database');
  console.log('   - If 2FA is not enabled, just skip password step\n');
  
  const proceed = await input.confirm('Ready to start? (y/n): ');
  
  if (proceed) {
    await authorizeAccount();
  } else {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  }
}

// Обробка помилок на рівні процесу
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted by user. Goodbye!');
  process.exit(0);
});

// Запускаємо
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
