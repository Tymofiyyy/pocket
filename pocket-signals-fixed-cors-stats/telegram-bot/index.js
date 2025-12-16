require('dotenv').config();
const cron = require('node-cron');
const telegramManager = require('./telegramManager');
const queueProcessor = require('./queueProcessor');

console.log('🚀 Pocket Signals - Telegram Bot Starting...\n');

// Ініціалізація
async function initialize() {
  try {
    // Підключаємо всі Telegram акаунти
    await telegramManager.initializeAccounts();

    if (telegramManager.clients.size === 0) {
      console.log('\n⚠️  WARNING: No Telegram accounts connected!');
      console.log('Please add accounts using auth.js\n');
    }

    // Запускаємо cron job для обробки черги
    const cronExpression = process.env.QUEUE_CHECK_INTERVAL || '*/5 * * * *';
    
    console.log(`\n⏰ Starting queue processor (${cronExpression})`);
    
    cron.schedule(cronExpression, async () => {
      await queueProcessor.processQueue();
    });

    // Також запускаємо одразу при старті
    console.log('\n🔄 Running initial queue check...');
    await queueProcessor.processQueue();

    // Очистка старих повідомлень раз на день о 3:00
    cron.schedule('0 3 * * *', async () => {
      console.log('\n🗑️  Running daily cleanup...');
      await queueProcessor.cleanupOldMessages();
    });

    console.log('\n✅ Bot is running and monitoring the queue!');
    console.log('Press Ctrl+C to stop\n');

  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  await telegramManager.disconnectAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down...');
  await telegramManager.disconnectAll();
  process.exit(0);
});

// Запускаємо бота
initialize();
