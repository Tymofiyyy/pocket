const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const db = require('./database');
const fs = require('fs');
const path = require('path');

class TelegramManager {
  constructor() {
    this.clients = new Map(); // Map<accountId, TelegramClient>
    this.sessionsDir = path.join(__dirname, 'sessions');
    
    // Створюємо директорію для сесій якщо не існує
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  // Ініціалізація всіх активних акаунтів
  async initializeAccounts() {
    try {
      console.log('🔄 Initializing Telegram accounts...');
      
      const result = await db.query(
        'SELECT * FROM telegram_accounts WHERE is_active = true'
      );

      if (result.rows.length === 0) {
        console.log('⚠️  No active Telegram accounts found');
        return;
      }

      for (const account of result.rows) {
        await this.connectAccount(account);
      }

      console.log(`✅ Initialized ${this.clients.size} Telegram accounts`);
    } catch (error) {
      console.error('❌ Error initializing accounts:', error);
    }
  }

  // Підключення одного акаунта
  async connectAccount(account) {
    try {
      const { id, phone_number, api_id, api_hash, session_string } = account;

      console.log(`📱 Connecting account: ${phone_number}`);

      const session = new StringSession(session_string || '');
      const client = new TelegramClient(session, parseInt(api_id), api_hash, {
        connectionRetries: 5,
      });

      await client.connect();

      // Перевіряємо чи авторизовані
      const isAuthorized = await client.isUserAuthorized();
      
      if (!isAuthorized) {
        console.log(`⚠️  Account ${phone_number} is not authorized. Please run auth.js`);
        return false;
      }

      // Зберігаємо клієнта
      this.clients.set(id, client);

      // Якщо session_string змінився, оновлюємо в БД
      const newSession = client.session.save();
      if (newSession !== session_string) {
        await db.query(
          'UPDATE telegram_accounts SET session_string = $1 WHERE id = $2',
          [newSession, id]
        );
      }

      console.log(`✅ Account ${phone_number} connected successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Error connecting account ${account.phone_number}:`, error);
      return false;
    }
  }

  // Отримання рандомного активного клієнта
  getRandomClient() {
    const clientIds = Array.from(this.clients.keys());
    
    if (clientIds.length === 0) {
      throw new Error('No active Telegram clients available');
    }

    const randomId = clientIds[Math.floor(Math.random() * clientIds.length)];
    return {
      id: randomId,
      client: this.clients.get(randomId)
    };
  }

  // Отримання конкретного клієнта
  getClient(accountId) {
    return this.clients.get(accountId);
  }

  // Надсилання текстового повідомлення
  async sendTextMessage(telegramId, text, accountId = null) {
    try {
      let client, clientId;

      if (accountId) {
        client = this.getClient(accountId);
        clientId = accountId;
        if (!client) {
          throw new Error(`Account ${accountId} not found`);
        }
      } else {
        const randomClient = this.getRandomClient();
        client = randomClient.client;
        clientId = randomClient.id;
      }

      console.log(`📤 Sending text message to ${telegramId} using account ${clientId}`);

      await client.sendMessage(telegramId, { message: text });

      console.log(`✅ Message sent successfully`);
      return { success: true, accountId: clientId };

    } catch (error) {
      console.error('❌ Error sending text message:', error);
      throw error;
    }
  }

  // Надсилання зображення
  async sendImage(telegramId, imageUrl, caption = '', accountId = null) {
    try {
      let client, clientId;

      if (accountId) {
        client = this.getClient(accountId);
        clientId = accountId;
        if (!client) {
          throw new Error(`Account ${accountId} not found`);
        }
      } else {
        const randomClient = this.getRandomClient();
        client = randomClient.client;
        clientId = randomClient.id;
      }

      console.log(`📤 Sending image to ${telegramId} using account ${clientId}`);
      console.log(`📷 Image URL: ${imageUrl}`);

      // Підготовка файлу для відправки
      let file;
      
      console.log(`📷 Processing image URL/path: ${imageUrl}`);
      
      // Перевіряємо чи це абсолютний шлях Windows (наприклад G:\Projects\...)
      if (imageUrl.match(/^[A-Z]:\\/i) || imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
        // Це локальний абсолютний шлях
        console.log(`💾 Detected absolute file path`);
        
        if (fs.existsSync(imageUrl)) {
          file = imageUrl;
          console.log(`✅ Found file at absolute path: ${imageUrl}`);
        } else {
          throw new Error(`File not found at absolute path: ${imageUrl}`);
        }
      } else if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1')) {
        // Конвертуємо localhost URL в локальний шлях
        const filename = imageUrl.split('/uploads/').pop();
        
        // Шукаємо файл в кількох можливих місцях
        const possiblePaths = [
          path.join(__dirname, '..', 'backend', 'uploads', filename),  // Linux/Mac
          path.join(__dirname, '..', '..', 'backend', 'uploads', filename), // На випадок іншої структури
          path.join(process.cwd(), '..', 'backend', 'uploads', filename), // Відносно поточної директорії
          path.join(process.cwd(), 'uploads', filename), // В поточній директорії
        ];
        
        console.log(`🔄 Converting localhost URL to local path`);
        console.log(`📁 Searching for file: ${filename}`);
        
        let foundPath = null;
        for (const testPath of possiblePaths) {
          console.log(`   Checking: ${testPath}`);
          if (fs.existsSync(testPath)) {
            foundPath = testPath;
            break;
          }
        }
        
        if (foundPath) {
          file = foundPath;
          console.log(`✅ Found local file at: ${foundPath}`);
        } else {
          console.log(`❌ File not found in any of the checked locations`);
          console.log(`Current working directory: ${process.cwd()}`);
          console.log(`Script directory: ${__dirname}`);
          throw new Error(`Local file not found: ${filename}. Checked ${possiblePaths.length} locations.`);
        }
      } else if (imageUrl.startsWith('http')) {
        // Зовнішній URL - завантажуємо через axios
        console.log(`🌐 Downloading from external URL`);
        const axios = require('axios');
        const response = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 10000 // 10 секунд таймаут
        });
        file = Buffer.from(response.data);
        console.log(`✅ Downloaded ${response.data.length} bytes`);
      } else if (fs.existsSync(imageUrl)) {
        // Прямий шлях до файлу (відносний)
        file = imageUrl;
        console.log(`✅ Using direct file path: ${imageUrl}`);
      } else {
        throw new Error(`Invalid image URL or file path: ${imageUrl}`);
      }

      // Відправка файлу
      await client.sendFile(telegramId, {
        file: file,
        caption: caption
      });

      console.log(`✅ Image sent successfully to ${telegramId}`);
      return { success: true, accountId: clientId };

    } catch (error) {
      console.error('❌ Error sending image:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  }

  // Надсилання зображення з текстом
  async sendImageWithText(telegramId, imageUrl, text, accountId = null) {
    return await this.sendImage(telegramId, imageUrl, text, accountId);
  }

  // Перевірка чи існує користувач в Telegram
  async checkUserExists(telegramId) {
    try {
      const randomClient = this.getRandomClient();
      const entity = await randomClient.client.getEntity(telegramId);
      return entity !== null;
    } catch (error) {
      console.error(`User ${telegramId} not found:`, error.message);
      return false;
    }
  }

  // Відключення всіх клієнтів
  async disconnectAll() {
    console.log('🔌 Disconnecting all Telegram clients...');
    
    for (const [id, client] of this.clients) {
      try {
        await client.disconnect();
        console.log(`✅ Disconnected account ${id}`);
      } catch (error) {
        console.error(`❌ Error disconnecting account ${id}:`, error);
      }
    }
    
    this.clients.clear();
    console.log('✅ All clients disconnected');
  }
}

module.exports = new TelegramManager();
