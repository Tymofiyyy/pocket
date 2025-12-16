// Конфігурація
const API_URL = 'http://localhost:3000/api';

let stepCounter = 1;

// Перевірка статусу API
async function checkApiStatus() {
    try {
        const response = await fetch(`${API_URL.replace('/api', '')}/health`);
        if (response.ok) {
            document.getElementById('api-status').className = 'online';
            document.getElementById('api-status').textContent = '🟢 API Online';
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        document.getElementById('api-status').className = 'offline';
        document.getElementById('api-status').textContent = '🔴 API Offline';
    }
}

// Перемикання табів
function switchTab(tabName) {
    // Ховаємо всі таби
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Знімаємо активний клас з кнопок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показуємо потрібний таб
    document.getElementById(tabName).classList.add('active');
    
    // Активуємо відповідну кнопку табу
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Завантажуємо дані для таба
    loadTabData(tabName);
}

// Завантаження даних для таба
async function loadTabData(tabName) {
    switch(tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'chains':
            await loadChains();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'accounts':
            await loadAccounts();
            break;
        case 'logs':
            await loadLogs();
            break;
    }
}

// ============================================
// Dashboard
// ============================================
async function loadDashboard() {
    try {
        console.log('📊 Loading dashboard...');
        console.log('API URL:', `${API_URL}/stats/overview`);
        
        const response = await fetch(`${API_URL}/stats/overview`);
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dashboard data:', data);
        
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Всього користувачів</h3>
                <div class="value">${data.users.total}</div>
            </div>
            <div class="stat-card">
                <h3>З Telegram ID</h3>
                <div class="value">${data.users.with_telegram}</div>
            </div>
            <div class="stat-card">
                <h3>Нових сьогодні</h3>
                <div class="value">${data.users.today}</div>
            </div>
            <div class="stat-card">
                <h3>Повідомлень відправлено</h3>
                <div class="value">${data.messages.sent}</div>
            </div>
            <div class="stat-card">
                <h3>Повідомлень сьогодні</h3>
                <div class="value">${data.messages.today}</div>
            </div>
            <div class="stat-card">
                <h3>Активних ланцюжків</h3>
                <div class="value">${data.chains.active}</div>
            </div>
        `;
    } catch (error) {
        console.error('❌ Error loading dashboard:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #dc3545;">
                <h3>⚠️ Помилка завантаження даних</h3>
                <p>${error.message}</p>
                <p style="font-size: 12px; color: #666;">Перевір консоль браузера для деталей</p>
                <button onclick="loadDashboard()" style="margin-top: 10px; padding: 8px 16px;">Спробувати знову</button>
            </div>
        `;
    }
}

// ============================================
// Chains (Ланцюжки)
// ============================================
async function loadChains() {
    try {
        const response = await fetch(`${API_URL}/chains`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const chainsList = document.getElementById('chains-list');
        
        if (!data.chains || data.chains.length === 0) {
            chainsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <p style="font-size: 18px; margin-bottom: 10px;">🔗 Немає створених ланцюжків</p>
                    <p>Створи перший ланцюжок натиснувши кнопку вище</p>
                </div>
            `;
            return;
        }
        
        let html = '<table><thead><tr><th>Назва</th><th>Подія</th><th>Кроків</th><th>Статус</th><th>Дії</th></tr></thead><tbody>';
        
        data.chains.forEach(chain => {
            const statusBadge = chain.is_active 
                ? '<span class="badge badge-success">Активний</span>' 
                : '<span class="badge badge-danger">Неактивний</span>';
            
            html += `
                <tr>
                    <td><strong>${chain.name}</strong></td>
                    <td>${translateEvent(chain.trigger_event)}</td>
                    <td>${chain.steps_count || 0}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn" style="padding: 6px 12px; font-size: 14px;" onclick="viewChain(${chain.id})">Переглянути</button>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteChain(${chain.id})">Видалити</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        chainsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading chains:', error);
        document.getElementById('chains-list').innerHTML = `
            <div style="padding: 20px; background: #fee; border-left: 4px solid #e74c3c; border-radius: 8px;">
                <strong>❌ Помилка завантаження ланцюжків</strong>
                <p style="margin-top: 10px; color: #666;">${error.message}</p>
            </div>
        `;
    }
}

function translateEvent(event) {
    const translations = {
        'registration': 'Реєстрація',
        'email_confirmed': 'Email підтверджено',
        'ftd': 'Перший депозит',
        'repeat_deposit': 'Повторний депозит',
        'commission': 'Комісія',
        'withdrawal': 'Вивід'
    };
    return translations[event] || event;
}

async function viewChain(chainId) {
    try {
        const response = await fetch(`${API_URL}/chains/${chainId}`);
        const data = await response.json();
        
        let stepsHtml = '';
        data.steps.forEach(step => {
            stepsHtml += `
                <div class="chain-step">
                    <div class="step-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="step-number">${step.step_order}</div>
                            <strong>${step.message_type}</strong>
                        </div>
                        <span>Затримка: ${step.delay_hours}г</span>
                    </div>
                    <p>${step.message_text || 'Зображення'}</p>
                    ${step.image_url ? `<p><small>🖼️ ${step.image_url}</small></p>` : ''}
                </div>
            `;
        });
        
        alert(`Ланцюжок: ${data.chain.name}\n\nПодія: ${translateEvent(data.chain.trigger_event)}\n\nКроків: ${data.steps.length}\n\nДеталі дивіться в консолі (F12)`);
        console.log('Chain details:', data);
    } catch (error) {
        console.error('Error viewing chain:', error);
        alert('Помилка завантаження ланцюжка');
    }
}

async function deleteChain(chainId) {
    if (!confirm('Ви впевнені що хочете видалити цей ланцюжок?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/chains/${chainId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Ланцюжок видалено');
            loadChains();
        } else {
            throw new Error('Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting chain:', error);
        alert('Помилка видалення ланцюжка');
    }
}

// ============================================
// Users (Користувачі)
// ============================================
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users?limit=50`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const usersList = document.getElementById('users-list');
        
        if (!data.users || data.users.length === 0) {
            usersList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <p style="font-size: 18px; margin-bottom: 10px;">📭 Немає користувачів</p>
                    <p>Користувачі з'являться після першого постбека</p>
                </div>
            `;
            return;
        }
        
        let html = '<table><thead><tr><th>Telegram ID</th><th>Click ID</th><th>Trader ID</th><th>Події</th><th>Депозитів</th><th>Дата реєстрації</th></tr></thead><tbody>';
        
        data.users.forEach(user => {
            html += `
                <tr>
                    <td>${user.telegram_id || '—'}</td>
                    <td><small>${user.click_id}</small></td>
                    <td>${user.trader_id || '—'}</td>
                    <td>${user.events_count || 0}</td>
                    <td>$${parseFloat(user.total_deposits || 0).toFixed(2)}</td>
                    <td>${new Date(user.first_seen_at).toLocaleDateString('uk-UA')}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        usersList.innerHTML = html;
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-list').innerHTML = `
            <div style="padding: 20px; background: #fee; border-left: 4px solid #e74c3c; border-radius: 8px;">
                <strong>❌ Помилка завантаження користувачів</strong>
                <p style="margin-top: 10px; color: #666;">${error.message}</p>
                <p style="margin-top: 10px; color: #666;">Перевір чи запущений backend</p>
            </div>
        `;
    }
}

// ============================================
// Accounts (Telegram акаунти)
// ============================================
async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/accounts`);
        const data = await response.json();
        
        const accountsList = document.getElementById('accounts-list');
        
        if (data.accounts.length === 0) {
            accountsList.innerHTML = '<p>Немає доданих акаунтів. Додайте перший!</p>';
            return;
        }
        
        let html = '<table><thead><tr><th>Телефон</th><th>API ID</th><th>Авторизований</th><th>Статус</th><th>Дії</th></tr></thead><tbody>';
        
        data.accounts.forEach(account => {
            const authBadge = account.is_authorized 
                ? '<span class="badge badge-success">Так</span>' 
                : '<span class="badge badge-warning">Ні</span>';
            
            const statusBadge = account.is_active 
                ? '<span class="badge badge-success">Активний</span>' 
                : '<span class="badge badge-danger">Неактивний</span>';
            
            html += `
                <tr>
                    <td>${account.phone_number}</td>
                    <td>${account.api_id}</td>
                    <td>${authBadge}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 14px;" onclick="deleteAccount(${account.id})">Видалити</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        accountsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading accounts:', error);
        document.getElementById('accounts-list').innerHTML = '<p style="color: red;">Помилка завантаження акаунтів</p>';
    }
}

async function deleteAccount(accountId) {
    if (!confirm('Ви впевнені що хочете видалити цей акаунт?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Акаунт видалено');
            loadAccounts();
        } else {
            throw new Error('Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Помилка видалення акаунта');
    }
}

// ============================================
// Logs (Логи)
// ============================================
async function loadLogs() {
    try {
        const response = await fetch(`${API_URL}/logs?limit=100`);
        const data = await response.json();
        
        const logsList = document.getElementById('logs-list');
        
        if (data.logs.length === 0) {
            logsList.innerHTML = '<p>Немає логів</p>';
            return;
        }
        
        let html = '<table><thead><tr><th>Час</th><th>Telegram ID</th><th>Ланцюжок</th><th>Акаунт</th><th>Статус</th><th>Помилка</th></tr></thead><tbody>';
        
        data.logs.forEach(log => {
            let statusBadge;
            if (log.status === 'sent') {
                statusBadge = '<span class="badge badge-success">Відправлено</span>';
            } else if (log.status === 'failed') {
                statusBadge = '<span class="badge badge-danger">Помилка</span>';
            } else {
                statusBadge = '<span class="badge badge-info">Очікує</span>';
            }
            
            html += `
                <tr>
                    <td>${new Date(log.sent_at).toLocaleString('uk-UA')}</td>
                    <td>${log.telegram_id || '—'}</td>
                    <td>${log.chain_name || '—'}</td>
                    <td>${log.account_phone || '—'}</td>
                    <td>${statusBadge}</td>
                    <td>${log.error_message || '—'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        logsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logs-list').innerHTML = '<p style="color: red;">Помилка завантаження логів</p>';
    }
}

// ============================================
// Модальні вікна
// ============================================
function openCreateChainModal() {
    document.getElementById('createChainModal').classList.add('active');
    document.getElementById('steps-list').innerHTML = '';
    stepCounter = 1;
}

function openCreateAccountModal() {
    document.getElementById('createAccountModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Додавання кроку до ланцюжка
function addStep() {
    const stepsList = document.getElementById('steps-list');
    const stepNumber = stepCounter++;
    
    const stepHtml = `
        <div class="chain-step" id="step-${stepNumber}">
            <div class="step-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="step-number">${stepNumber}</div>
                    <strong>Крок ${stepNumber}</strong>
                </div>
                <button type="button" class="btn btn-danger remove-step-btn" data-step="${stepNumber}" style="padding: 4px 8px; font-size: 12px;">Видалити</button>
            </div>
            <div class="form-group">
                <label>Затримка (годин)</label>
                <input type="number" class="step-delay" min="0" value="0" placeholder="0" onkeypress="if(event.key==='Enter'){event.preventDefault();return false;}">
            </div>
            <div class="form-group">
                <label>Тип повідомлення</label>
                <select class="step-type" data-step="${stepNumber}">
                    <option value="text">Текст</option>
                    <option value="image">Зображення</option>
                    <option value="text_with_image">Текст + Зображення</option>
                </select>
            </div>
            <div class="form-group">
                <label>Текст повідомлення</label>
                <textarea class="step-text" placeholder="Введіть текст повідомлення..." onkeypress="if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();return false;}"></textarea>
            </div>
            <div class="form-group" id="image-field-${stepNumber}" style="display: none;">
                <label>Зображення</label>
                <div class="image-drop-zone" data-step="${stepNumber}">
                    <input type="file" id="file-input-${stepNumber}" class="step-image-file" accept="image/*" style="display: none;">
                    <p>📸 Перетягни зображення сюди або натисни для вибору</p>
                    <small style="color: #666;">PNG, JPG, GIF, WebP (макс. 5MB)</small>
                </div>
                <small style="color: #666; display: block; margin-top: 10px;">Або введи URL:</small>
                <input type="url" class="step-image-url" placeholder="https://example.com/image.jpg" style="margin-top: 5px;" data-step="${stepNumber}">
                <div class="image-preview-${stepNumber}" style="margin-top: 10px; display: none;">
                    <img style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <button type="button" class="remove-image-btn" data-step="${stepNumber}" style="margin-top: 10px;">Видалити зображення</button>
                </div>
                <input type="hidden" class="step-image" value="">
            </div>
        </div>
    `;
    
    stepsList.insertAdjacentHTML('beforeend', stepHtml);
    
    // Додаємо event listeners після створення елемента
    setupStepEventListeners(stepNumber);
}

// Налаштування всіх event listeners для кроку
function setupStepEventListeners(stepNumber) {
    console.log('🔧 Setting up event listeners for step:', stepNumber);
    const stepElement = document.getElementById(`step-${stepNumber}`);
    if (!stepElement) {
        console.error('❌ Step element not found:', stepNumber);
        return;
    }
    
    // Remove step button
    const removeBtn = stepElement.querySelector('.remove-step-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            console.log('🗑️ Remove step clicked:', stepNumber);
            e.preventDefault();
            e.stopPropagation();
            removeStep(stepNumber);
        });
    }
    
    // Type select change
    const typeSelect = stepElement.querySelector('.step-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            console.log('🔀 Type changed for step:', stepNumber);
            toggleImageField(stepNumber);
        });
    }
    
    // Drop zone click to select file
    const dropZone = stepElement.querySelector('.image-drop-zone');
    if (dropZone) {
        console.log('✅ Drop zone found, adding listeners');
        
        dropZone.addEventListener('click', (e) => {
            console.log('👆 Drop zone clicked for step:', stepNumber);
            e.preventDefault();
            e.stopPropagation();
            const fileInput = document.getElementById(`file-input-${stepNumber}`);
            if (fileInput) {
                console.log('📂 Opening file picker');
                fileInput.click();
            } else {
                console.error('❌ File input not found');
            }
        });
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragOver(e);
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragLeave(e);
        });
        
        dropZone.addEventListener('drop', (e) => {
            console.log('💧 Drop event in listener for step:', stepNumber);
            e.preventDefault();
            e.stopPropagation();
            handleDrop(e, stepNumber);
        });
    } else {
        console.error('❌ Drop zone not found for step:', stepNumber);
    }
    
    // File input change
    const fileInput = document.getElementById(`file-input-${stepNumber}`);
    if (fileInput) {
        console.log('✅ File input found');
        fileInput.addEventListener('change', async (e) => {
            console.log('📎 File selected via picker for step:', stepNumber);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (e.target.files.length > 0) {
                console.log('📄 Selected file:', e.target.files[0].name);
                await handleImageUpload(stepNumber, e.target);
            }
            return false;
        }, true);
    } else {
        console.error('❌ File input not found');
    }
    
    // URL input change
    const urlInput = stepElement.querySelector('.step-image-url');
    if (urlInput) {
        urlInput.addEventListener('change', (e) => {
            console.log('🔗 URL input changed for step:', stepNumber);
            handleUrlInput(stepNumber, e.target);
        });
        
        // Запобігаємо submit форми при натисканні Enter
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleUrlInput(stepNumber, e.target);
                return false;
            }
        });
    }
    
    // Remove image button
    const removeImageBtn = stepElement.querySelector('.remove-image-btn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', (e) => {
            console.log('🗑️ Remove image clicked for step:', stepNumber);
            e.preventDefault();
            e.stopPropagation();
            removeImage(stepNumber);
        });
    }
    
    console.log('✅ Event listeners setup complete for step:', stepNumber);
}

function removeStep(stepNumber) {
    document.getElementById(`step-${stepNumber}`).remove();
}

function toggleImageField(stepNumber) {
    const stepElement = document.getElementById(`step-${stepNumber}`);
    const typeSelect = stepElement.querySelector('.step-type');
    const imageField = document.getElementById(`image-field-${stepNumber}`);
    
    if (typeSelect.value === 'image' || typeSelect.value === 'text_with_image') {
        imageField.style.display = 'block';
    } else {
        imageField.style.display = 'none';
    }
}

// Обробка завантаження зображення
async function handleImageUpload(stepNumber, input) {
    const file = input.files[0];
    if (!file) return;

    await uploadImage(stepNumber, file);
}

// Drag & Drop обробники
function handleDragOver(event) {
    console.log('🟡 handleDragOver called');
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    console.log('🟠 handleDragLeave called');
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event, stepNumber) {
    console.log('🔵 handleDrop called for step:', stepNumber);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');

    const files = event.dataTransfer.files;
    console.log('📁 Files dropped:', files.length);
    if (files.length > 0) {
        console.log('📄 File:', files[0].name, files[0].type, files[0].size);
        uploadImage(stepNumber, files[0]);
    }
}

// Обробник для URL поля
function handleUrlInput(stepNumber, input) {
    const url = input.value.trim();
    if (!url) return;

    const stepElement = document.getElementById(`step-${stepNumber}`);
    const preview = stepElement.querySelector(`.image-preview-${stepNumber}`);
    const img = preview.querySelector('img');
    const hiddenInput = stepElement.querySelector('.step-image');
    const dropZone = stepElement.querySelector('.image-drop-zone');

    // Показуємо превью
    img.src = url;
    preview.style.display = 'block';
    hiddenInput.value = url;
    if (dropZone) dropZone.style.display = 'none';
}

// Завантаження зображення на сервер
async function uploadImage(stepNumber, file) {
    console.log('📤 uploadImage called for step:', stepNumber, 'file:', file?.name);
    
    // Перевірка типу файлу
    if (!file.type.startsWith('image/')) {
        console.error('❌ Invalid file type:', file.type);
        alert('Будь ласка, виберіть зображення');
        return;
    }

    // Перевірка розміру (5MB)
    if (file.size > 5 * 1024 * 1024) {
        console.error('❌ File too large:', file.size);
        alert('Зображення занадто велике. Максимум 5MB');
        return;
    }

    try {
        // ВСТАНОВЛЮЄМО ПРАПОРЕЦЬ ЗАВАНТАЖЕННЯ
        isUploading = true;
        console.log('🚀 isUploading = true');
        
        console.log('📸 Creating preview...');
        // Показуємо превью
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('✅ Preview loaded');
            const preview = document.querySelector(`.image-preview-${stepNumber}`);
            const img = preview.querySelector('img');
            img.src = e.target.result;
            preview.style.display = 'block';
            
            // Ховаємо drop zone
            const dropZone = preview.previousElementSibling.previousElementSibling;
            if (dropZone && dropZone.classList.contains('image-drop-zone')) {
                dropZone.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);

        console.log('☁️ Uploading to server...');
        // Завантажуємо на сервер використовуючи XMLHttpRequest замість fetch
        // Це запобігає будь-якій navigation поведінці браузера
        
        const uploadPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.onload = function() {
                console.log('📡 Server response status:', xhr.status);
                console.log('📡 Response headers:', xhr.getAllResponseHeaders());
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        console.log('✅ Upload successful:', data);
                        resolve(data);
                    } catch (e) {
                        console.error('❌ JSON parse error:', e);
                        console.error('Response text:', xhr.responseText);
                        reject(new Error('Неправильна відповідь сервера'));
                    }
                } else {
                    console.error('❌ Server error:', xhr.status, xhr.responseText);
                    reject(new Error('Помилка завантаження'));
                }
            };
            
            xhr.onerror = function() {
                console.error('❌ Network error');
                reject(new Error('Помилка мережі'));
            };
            
            xhr.ontimeout = function() {
                console.error('❌ Timeout');
                reject(new Error('Тайм-аут завантаження'));
            };
            
            const formData = new FormData();
            formData.append('image', file);
            
            xhr.open('POST', `${API_URL}/upload`, true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.timeout = 30000; // 30 секунд
            xhr.send(formData);
        });
        
        const data = await uploadPromise;
        console.log('✅ Upload successful:', data);
        
        // Зберігаємо абсолютний шлях до файлу замість URL (для Windows сумісності)
        const stepElement = document.getElementById(`step-${stepNumber}`);
        const hiddenInput = stepElement.querySelector('.step-image');
        hiddenInput.value = data.absolutePath || data.fullUrl;

        console.log('💾 Image path saved:', hiddenInput.value);
        
        // ЗНІМАЄМО ПРАПОРЕЦЬ ЗАВАНТАЖЕННЯ
        isUploading = false;
        console.log('✅ isUploading = false');
    } catch (error) {
        console.error('❌ Upload error:', error);
        alert('Помилка завантаження зображення: ' + error.message);
        
        // ЗНІМАЄМО ПРАПОРЕЦЬ НАВІТЬ ПРИ ПОМИЛЦІ
        isUploading = false;
        console.log('❌ isUploading = false (error)');
    }
}

// Видалення зображення
function removeImage(stepNumber) {
    const stepElement = document.getElementById(`step-${stepNumber}`);
    const preview = stepElement.querySelector(`.image-preview-${stepNumber}`);
    const hiddenInput = stepElement.querySelector('.step-image');
    const fileInput = stepElement.querySelector('.step-image-file');
    const urlInput = stepElement.querySelector('.step-image-url');
    const dropZone = stepElement.querySelector('.image-drop-zone');
    
    // Очищуємо
    preview.style.display = 'none';
    preview.querySelector('img').src = '';
    hiddenInput.value = '';
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (dropZone) dropZone.style.display = 'block';
}

// Створення ланцюжка
// Створення ланцюжка
async function createChain() {
    const name = document.getElementById('chain-name').value;
    const triggerEvent = document.getElementById('chain-event').value;
    
    if (!name.trim()) {
        alert('Введіть назву ланцюжка!');
        return;
    }
    
    // Збираємо кроки
    const steps = [];
    const stepElements = document.querySelectorAll('.chain-step');
    
    stepElements.forEach((stepElement, index) => {
        const delay = parseInt(stepElement.querySelector('.step-delay').value);
        const type = stepElement.querySelector('.step-type').value;
        const text = stepElement.querySelector('.step-text').value;
        
        // Отримуємо URL зображення (або з завантаженого файлу, або з поля URL)
        let imageUrl = '';
        const hiddenImageInput = stepElement.querySelector('.step-image');
        const urlInput = stepElement.querySelector('.step-image-url');
        
        if (hiddenImageInput && hiddenImageInput.value) {
            // Якщо було завантажено файл
            imageUrl = hiddenImageInput.value;
        } else if (urlInput && urlInput.value) {
            // Якщо введено URL
            imageUrl = urlInput.value;
        }
        
        steps.push({
            step_order: index + 1,
            delay_hours: delay,
            message_type: type,
            message_text: text,
            image_url: imageUrl || null
        });
    });
    
    if (steps.length === 0) {
        alert('Додайте хоча б один крок!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/chains`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                trigger_event: triggerEvent,
                is_active: true,
                steps
            })
        });
        
        if (response.ok) {
            alert('Ланцюжок створено!');
            closeModal('createChainModal');
            loadChains();
            // Очищаємо поля форми
            document.getElementById('chain-name').value = '';
            document.getElementById('chain-event').selectedIndex = 0;
            // Очищаємо список кроків
            document.getElementById('steps-list').innerHTML = '';
            stepCounter = 1;
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create chain');
        }
    } catch (error) {
        console.error('Error creating chain:', error);
        alert('Помилка створення ланцюжка: ' + error.message);
    }
}

// Створення акаунта
document.getElementById('createAccountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phone = document.getElementById('account-phone').value;
    const apiId = document.getElementById('account-api-id').value;
    const apiHash = document.getElementById('account-api-hash').value;
    
    try {
        const response = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone_number: phone,
                api_id: apiId,
                api_hash: apiHash
            })
        });
        
        if (response.ok) {
            alert('Акаунт додано! Тепер запусти "npm run auth" в telegram-bot для авторизації');
            closeModal('createAccountModal');
            loadAccounts();
            document.getElementById('createAccountForm').reset();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create account');
        }
    } catch (error) {
        console.error('Error creating account:', error);
        alert('Помилка додавання акаунта: ' + error.message);
    }
});

// Глобальна змінна для відстеження завантаження
let isUploading = false;

// Перехоплюємо window.location.reload
const originalReload = window.location.reload.bind(window.location);
window.location.reload = function(...args) {
    console.error('🚨 window.location.reload() CALLED!');
    console.error('Stack trace:', new Error().stack);
    if (isUploading) {
        alert('BLOCKED: reload during upload!');
        return;
    }
    return originalReload(...args);
};

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Page loaded - reload prevention active');
    
    // КРИТИЧНО: Ловимо спробу перезавантаження сторінки
    window.addEventListener('beforeunload', (e) => {
        console.warn('⚠️ beforeunload event fired');
        console.log('isUploading:', isUploading);
        
        if (isUploading) {
            console.error('🚨 PAGE RELOAD DETECTED DURING UPLOAD!');
            const stack = new Error().stack;
            console.error('Stack trace:', stack);
            e.preventDefault();
            e.returnValue = 'Файл завантажується!';
            alert('УВАГА! Сторінка намагається перезавантажитись під час завантаження файлу!');
            return 'Сторінка намагається перезавантажитись!';
        }
    });
    
    // Ловимо unload
    window.addEventListener('unload', (e) => {
        console.error('🚨 UNLOAD EVENT!');
        console.log('isUploading:', isUploading);
    });
    
    // КРИТИЧНО: Блокуємо всі можливі submit події на сторінці
    document.addEventListener('submit', (e) => {
        console.error('⚠️ Submit event detected!', e.target);
        console.log('Event target:', e.target);
        console.log('Stack:', new Error().stack);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }, true);
    
    // ВАЖЛИВО: Глобальна блокіровка drag & drop на всю сторінку
    // Це запобігає відкриттю зображень браузером
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
    
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
    
    // Таби
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Кнопки відкриття модальних вікон
    document.getElementById('createChainBtn')?.addEventListener('click', openCreateChainModal);
    document.getElementById('createAccountBtn')?.addEventListener('click', openCreateAccountModal);
    
    // Кнопка додавання кроку
    document.getElementById('addStepBtn')?.addEventListener('click', addStep);
    
    // Кнопка створення ланцюжка
    document.getElementById('submitChainBtn')?.addEventListener('click', createChain);
    
    // Кнопки закриття модальних вікон
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            if (modalId) closeModal(modalId);
        });
    });
    
    // Кнопки скасування
    document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            if (modalId) closeModal(modalId);
        });
    });
    
    // Закриття модальних вікон при кліку на фон
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
        
        // Блокуємо propagation для контенту модалки
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    });
    
    checkApiStatus();
    loadDashboard();
    
    // Перевіряємо статус кожні 30 секунд
    setInterval(checkApiStatus, 30000);
});
