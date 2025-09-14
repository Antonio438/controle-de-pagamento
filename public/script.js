// --- CONFIGURAÇÃO GLOBAL ---
// AQUI ESTÁ A CORREÇÃO: Usamos um caminho relativo para a API.
const API_URL = '/api/data';

// --- ESTADO DA APLICAÇÃO ---
let processes = [];
let payments = [];
let users = [];
let activities = [];
let currentView = 'dashboard';
let processFilePreviews = [];
let paymentFilePreview = null;
let activeDropdown = null;
let itemToDelete = { id: null, type: null, username: null };

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    initializeEventListeners();
    initializeFlatpickr();
    initializeTheme();
    updateUIForLoginState();
    checkAndShowAlerts();
});

// --- COMUNICAÇÃO COM O SERVIDOR ---
async function loadDatabase() {
    try {
        const response = await fetch(API_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Falha ao carregar dados do servidor.');
        const data = await response.json();
        processes = (data.processes || []).map(p => ({ 
            ...p, 
            documents: p.documents || [],
            isImportant: p.isImportant || false,
            alert: p.alert || null
        }));
        payments = data.payments || [];
        users = data.users || [];
        activities = data.activities || [];
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function saveDataToServer() {
    try {
        const payload = { processes, payments, users, activities };
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Falha ao salvar dados no servidor.');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

async function saveDataAndReload() {
    const success = await saveDataToServer();
    if (success) {
        await loadDatabase();
        showView(currentView, { retainFilters: true });
    }
}

// --- INICIALIZAÇÃO DE EVENTOS E PLUGINS ---
function initializeEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(link.id.replace('-link', ''));
    }));
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('sidebar-collapsed');
    });

    document.getElementById('login-logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        isUserLoggedIn() ? logout() : openLoginModal();
    });
    document.getElementById('show-register-view').addEventListener('click', (e) => { e.preventDefault(); toggleLoginView(false); });
    document.getElementById('show-login-view').addEventListener('click', (e) => { e.preventDefault(); toggleLoginView(true); });
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    document.getElementById('theme-toggle').addEventListener('change', toggleTheme);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    document.getElementById('add-user-form').addEventListener('submit', handleAddNewUser);

    document.getElementById('search-input').addEventListener('input', () => showView('processes', { retainFilters: true }));
    document.getElementById('clear-process-filters-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        showView('processes');
    });
    
    document.getElementById('payments-search').addEventListener('input', () => showView('payments', { retainFilters: true }));
    document.getElementById('payment-status-filter').addEventListener('change', () => showView('payments', { retainFilters: true }));
    document.getElementById('payment-month-filter').addEventListener('change', () => showView('payments', { retainFilters: true }));
    document.getElementById('payment-year-filter').addEventListener('change', () => showView('payments', { retainFilters: true }));
    document.getElementById('payments-date-range').addEventListener('change', () => showView('payments', { retainFilters: true }));
    document.getElementById('clear-payments-filters-btn').addEventListener('click', () => {
        document.getElementById('payments-search').value = '';
        document.getElementById('payment-status-filter').value = '';
        document.getElementById('payment-month-filter').value = '';
        document.getElementById('payment-year-filter').value = '';
        document.getElementById('payments-date-range')._flatpickr.clear();
        showView('payments');
    });

    document.getElementById('activity-type-filter').addEventListener('change', renderActivities);
    document.getElementById('report-period-filter').addEventListener('change', setupDatePickers);
    
    document.getElementById('clear-reports-filters-btn').addEventListener('click', () => {
        document.getElementById('activity-type-filter').value = 'all';
        document.getElementById('report-period-filter').value = 'day';
        setupDatePickers(); 
        renderActivities();
    });

    document.getElementById('btn-novo-processo').addEventListener('click', () => handleAction(openProcessModal));
    document.getElementById('btn-novo-pagamento').addEventListener('click', () => handleAction(openPaymentModal));
    document.getElementById('clear-activities-btn').addEventListener('click', () => handleAction(openClearLogModal));
    document.getElementById('generate-report-btn').addEventListener('click', generateActivitiesReport);
    
    document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target)) closeActiveDropdown();
    });
    document.getElementById('cancel-delete-btn').addEventListener('click', closeConfirmationModal);
    document.getElementById('confirm-delete-btn').addEventListener('click', executeDelete);
    
    document.getElementById('add-alert-checkbox').addEventListener('change', (e) => {
        document.getElementById('alert-details-section').classList.toggle('expanded', e.target.checked);
    });
}

function initializeFlatpickr() {
    flatpickr.localize(flatpickr.l10ns.pt);
    flatpickr("#payments-date-range", { mode: "range", dateFormat: "d/m/Y" });
}

// --- LÓGICA DE FILTRO E RENDERIZAÇÃO DE TABELAS ---
function loadProcesses() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const filtered = !term ? [...processes] : processes.filter(p => 
        String(p.processNumber).toLowerCase().includes(term) || 
        p.supplier.toLowerCase().includes(term)
    );
    
    const toRender = filtered.sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return String(a.processNumber).localeCompare(String(b.processNumber), undefined, { numeric: true, sensitivity: 'base' });
    });

    const tableBody = document.getElementById('processes-table-body');
    tableBody.innerHTML = '';
    toRender.forEach(p => tableBody.appendChild(createProcessRow(p)));
    updateTableFooter('processes', toRender.length, processes.length);
}

// --- CRIAÇÃO DE ELEMENTOS DINÂMICOS ---
function createProcessRow(process) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    const loggedIn = isUserLoggedIn();
    const location = process.locationInfo || 'Contabilidade';
    const modalidade = process.paymentType === 'Outros' ? process.paymentTypeOther : process.paymentType;
    
    const isImportantClass = process.isImportant ? 'active' : '';

    const locationHTML = `<div class="badge ${getLocationBadgeClass(location)}" ${loggedIn ? `onclick="toggleDropdown(event, this, 'location', '${process.id}', '${location}')"` : 'style="cursor:default"'}>
                            <span>${location}</span>
                            ${loggedIn ? `<i class="fas fa-chevron-down text-xs opacity-70 ml-2"></i>` : ''}
                            ${location === 'Outros' ? `<span class="tooltip-text">${process.locationOtherText || 'N/A'}</span>` : ''}
                        </div>`;

    row.innerHTML = `
        <td class="table-cell"><a href="#" onclick="openProcessDetailsModal('${process.id}')" class="table-link">${process.processNumber}</a></td>
        <td class="table-cell">${process.supplier}</td>
        <td class="table-cell">${modalidade || '-'}</td>
        <td class="table-cell"><div class="custom-dropdown-container">${locationHTML}</div></td>
        <td class="table-cell text-right">
            ${loggedIn ? `
                <button onclick="openImportantAlertModal('${process.id}')" class="action-btn important-btn ${isImportantClass}" title="Marcar como Importante / Definir Alerta">
                    <i class="fas fa-star"></i>
                </button>
                <button onclick="editProcess('${process.id}')" class="action-btn text-blue-600" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="confirmDelete('${process.id}', 'processo')" class="action-btn text-red-500" title="Excluir"><i class="fas fa-trash-alt"></i></button>
            ` : `<button class="action-btn" disabled><i class="fas fa-lock"></i></button>`}
        </td>`;
    return row;
}

// --- NOVAS FUNÇÕES: IMPORTÂNCIA E ALERTA ---

function openImportantAlertModal(processId) {
    const process = processes.find(p => p.id === processId);
    if (!process) return;

    document.getElementById('important-process-id').value = process.id;
    
    const isImportantCheckbox = document.getElementById('is-important-checkbox');
    const addAlertCheckbox = document.getElementById('add-alert-checkbox');
    const alertDetailsSection = document.getElementById('alert-details-section');
    const alertDateInput = document.getElementById('alert-date');
    const alertMessageInput = document.getElementById('alert-message');

    document.getElementById('important-modal-title').textContent = `Opções: Proc. ${process.processNumber}`;

    isImportantCheckbox.checked = process.isImportant || false;
    
    if (process.alert && process.alert.date && process.alert.message) {
        addAlertCheckbox.checked = true;
        alertDetailsSection.classList.add('expanded');
        alertDateInput.value = process.alert.date;
        alertMessageInput.value = process.alert.message;
    } else {
        addAlertCheckbox.checked = false;
        alertDetailsSection.classList.remove('expanded');
        alertDateInput.value = '';
        alertMessageInput.value = '';
    }
    
    document.getElementById('important-alert-modal').classList.add('show');
}

function closeImportantAlertModal() {
    document.getElementById('important-alert-modal').classList.remove('show');
}

async function saveImportanceAndAlert() {
    const processId = document.getElementById('important-process-id').value;
    const processIndex = processes.findIndex(p => p.id === processId);
    if (processIndex === -1) return;

    const isImportant = document.getElementById('is-important-checkbox').checked;
    const addAlert = document.getElementById('add-alert-checkbox').checked;
    
    processes[processIndex].isImportant = isImportant;

    if (addAlert) {
        const alertDate = document.getElementById('alert-date').value;
        const alertMessage = document.getElementById('alert-message').value.trim();
        
        if (!alertDate || !alertMessage) {
            showToast('Para criar um alerta, a data e a mensagem são obrigatórias.', 'error');
            return;
        }
        processes[processIndex].alert = {
            date: alertDate,
            message: alertMessage
        };
    } else {
        processes[processIndex].alert = null;
    }
    
    await saveDataAndReload();
    closeImportantAlertModal();
    showToast('Preferências de importância e alerta salvas!', 'success');
}

function checkAndShowAlerts() {
    const today = new Date().toISOString().split('T')[0];
    const alertsForToday = processes.filter(p => p.alert && p.alert.date === today);

    if (alertsForToday.length > 0) {
        const modalContent = document.getElementById('todays-alerts-content');
        modalContent.innerHTML = alertsForToday.map(p => `
            <div class="alert-item-today">
                <p class="alert-title">Processo Nº: ${p.processNumber} (${p.supplier})</p>
                <p class="alert-message">${p.alert.message}</p>
            </div>
        `).join('');
        document.getElementById('todays-alerts-modal').classList.add('show');
    }
}

function closeTodaysAlertsModal() {
    document.getElementById('todays-alerts-modal').classList.remove('show');
}


// --- DASHBOARDS FUNCIONAIS ---
function setPaymentFilterAndShow(statusValue) {
    showView('payments', { filter: statusValue });
}

// --- LÓGICA DE AUTENTICAÇÃO E PERMISSÕES ---
function isUserLoggedIn() { return !!sessionStorage.getItem('loggedInUser'); }
function getCurrentUser() { return sessionStorage.getItem('loggedInUser'); }

function handleAction(callbackFunction, ...args) {
    if (isUserLoggedIn()) {
        callbackFunction(...args);
    } else {
        showToast('Você precisa estar logado para realizar esta ação.', 'error');
        openLoginModal();
    }
}

async function updateUIForLoginState() {
    const loggedIn = isUserLoggedIn();
    const username = getCurrentUser() || 'Visitante';
    
    document.getElementById('user-name-sidebar').textContent = username;
    const loginBtn = document.getElementById('login-logout-btn');
    loginBtn.textContent = loggedIn ? 'Sair' : 'Login';
    loginBtn.classList.toggle('text-red-500', loggedIn);
    loginBtn.classList.toggle('text-blue-500', !loggedIn);
    
    document.getElementById('reports-link').parentElement.style.display = loggedIn ? 'block' : 'none';
    document.getElementById('settings-link').parentElement.style.display = loggedIn ? 'block' : 'none';
    
    if (!loggedIn && (currentView === 'reports' || currentView === 'settings')) {
        showView('dashboard');
    } else {
        showView(currentView, { retainFilters: true });
    }
}

function openLoginModal() { document.getElementById('login-modal').classList.add('show'); }
function closeLoginModal() { document.getElementById('login-modal').classList.remove('show'); }

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        sessionStorage.setItem('loggedInUser', user.username);
        logActivity('Login', `Usuário ${user.username} fez login.`);
        await saveDataToServer(); 
        closeLoginModal();
        await updateUIForLoginState();
        showToast(`Bem-vindo, ${user.username}!`);
    } else {
        showToast('Usuário ou senha inválidos.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const adminPassword = document.getElementById('admin-password').value;

    if (adminPassword !== "2025") return showToast('Senha de administrador incorreta!', 'error');
    if (users.find(u => u.username === username)) return showToast('Este nome de usuário já existe.', 'error');

    users.push({ username, password });
    await saveDataToServer();
    showToast('Usuário cadastrado com sucesso! Faça o login.');
    toggleLoginView(true);
    e.target.reset();
}

async function logout() {
    logActivity('Logout', `Usuário ${getCurrentUser()} fez logout.`);
    await saveDataToServer();
    sessionStorage.removeItem('loggedInUser');
    await updateUIForLoginState();
    showToast('Você saiu da sua conta.');
}

function toggleLoginView(showLogin) {
    document.getElementById('login-view').classList.toggle('hidden', !showLogin);
    document.getElementById('register-view').classList.toggle('hidden', showLogin);
}

function showView(view, options = {}) {
    currentView = view;
    document.querySelectorAll('#main-content > main > div').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    const viewContent = document.getElementById(`${view}-content`);
    const viewLink = document.getElementById(`${view}-link`);

    if (viewContent) viewContent.classList.remove('hidden');
    if (viewLink) viewLink.classList.add('active');
    
    document.getElementById('page-title').textContent = getViewTitle(view);
    
    const viewActions = {
        dashboard: () => { updateDashboardStats(); loadRecentPayments(); },
        processes: loadProcesses,
        payments: () => {
            populatePaymentFilter();
            populateDateFilters();
            if (options.filter) document.getElementById('payment-status-filter').value = options.filter;
            loadPayments();
        },
        reports: () => { 
            if (!isUserLoggedIn()) { showView('dashboard'); return; }
            populateActivityFilter(); 
            setupDatePickers();
            renderActivities();
        },
        settings: () => {
            if (!isUserLoggedIn()) { showView('dashboard'); return; }
            renderUserSettings();
        }
    };
    if (viewActions[view]) viewActions[view]();
}

function getViewTitle(view) {
    const titles = { dashboard: 'Dashboard', processes: 'Processos', payments: 'Pagamentos', reports: 'Relatórios', settings: 'Configurações' };
    return titles[view] || 'Dashboard';
}

function updateDashboardStats() {
    const pendingStatuses = ["Pendente de Liquidação/O.P", "Pendente de Cadastro no Banco"];
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('pending-payments').textContent = payments.filter(p => pendingStatuses.includes(p.status)).length;
    document.getElementById('cadastrado-banco').textContent = payments.filter(p => p.status === 'Cadastrado no banco').length;
    document.getElementById('today-scheduled').textContent = payments.filter(p => p.status === 'Agendado' && p.paymentDate === today).length;
    document.getElementById('today-paid').textContent = payments.filter(p => p.status === 'Pago' && p.paymentDate === today).length;
}

function loadPayments() {
    const term = document.getElementById('payments-search').value.toLowerCase();
    const status = document.getElementById('payment-status-filter').value;
    const month = document.getElementById('payment-month-filter').value;
    const year = document.getElementById('payment-year-filter').value;
    const range = document.getElementById('payments-date-range')._flatpickr.selectedDates;
    const pendingStatuses = ["Pendente de Liquidação/O.P", "Pendente de Cadastro no Banco"];
    const today = new Date().toISOString().split('T')[0];

    const toRender = payments.filter(p => {
        const matchesSearch = !term || String(p.processNumber).toLowerCase().includes(term) || p.supplier.toLowerCase().includes(term);
        
        let matchesStatus = true;
        if (status === 'Pendente') matchesStatus = pendingStatuses.includes(p.status);
        else if (status === 'Agendados para Hoje') matchesStatus = p.status === 'Agendado' && p.paymentDate === today;
        else if (status === 'Pagos Hoje') matchesStatus = p.status === 'Pago' && p.paymentDate === today;
        else if (status) matchesStatus = p.status === status;

        let matchesDate = true;
        if (range.length === 2) {
            const paymentDate = new Date(p.paymentDate + 'T00:00:00');
            const startDate = new Date(range[0]);
            const endDate = new Date(range[1]);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            matchesDate = paymentDate >= startDate && paymentDate <= endDate;
        } else if (month && year) {
            matchesDate = p.paymentDate.startsWith(`${year}-${month}`);
        } else if (month) {
            matchesDate = p.paymentDate.substring(5, 7) === month;
        } else if (year) {
            matchesDate = p.paymentDate.startsWith(year);
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const tableBody = document.getElementById('payments-table-body');
    tableBody.innerHTML = '';
    toRender
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .forEach(p => tableBody.appendChild(createPaymentRow(p)));
    updateTableFooter('payments', toRender.length, payments.length);
}

function loadRecentPayments() {
    const recentBody = document.getElementById('recent-payments');
    if(!recentBody) return;
    recentBody.innerHTML = '';
    [...payments].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).forEach(p => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `<td class="table-cell font-medium">${p.processNumber}</td><td class="table-cell">${p.supplier}</td><td class="table-cell">R$ ${Number(p.value).toFixed(2)}</td><td class="table-cell">${formatDate(p.paymentDate)}</td><td class="table-cell">${p.paymentMethod === 'Outros' ? p.paymentMethodOther : p.paymentMethod}</td><td class="table-cell"><span class="badge ${getPaymentStatusClass(p.status)}">${p.status}</span></td>`;
        recentBody.appendChild(row);
    });
}

function createPaymentRow(payment) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    const loggedIn = isUserLoggedIn();
    const linkedProcess = processes.find(p => p.processNumber === payment.processNumber);
    const location = (linkedProcess && linkedProcess.locationInfo) || payment.location || 'Contabilidade';

    const locationHTML = `<div class="badge ${getLocationBadgeClass(location)}" ${loggedIn && linkedProcess ? `onclick="toggleDropdown(event, this, 'location', '${linkedProcess.id}', '${location}')"` : 'style="cursor:default"'}>
                            <span>${location}</span>
                             ${loggedIn && linkedProcess ? `<i class="fas fa-chevron-down text-xs opacity-70 ml-2"></i>` : ''}
                             ${location === 'Outros' && linkedProcess ? `<span class="tooltip-text">${linkedProcess.locationOtherText || 'N/A'}</span>` : ''}
                        </div>`;
                        
    const statusHTML = `<div class="badge ${getPaymentStatusClass(payment.status)}" ${loggedIn ? `onclick="toggleDropdown(event, this, 'status', '${payment.id}', '${payment.status}')"` : 'style="cursor:default"'}>
                            <span>${payment.status}</span>
                            ${loggedIn ? `<i class="fas fa-chevron-down text-xs opacity-70 ml-2"></i>` : ''}
                        </div>`;

    row.innerHTML = `
        <td class="table-cell"><a href="#" onclick="openPaymentDetailsModal('${payment.id}')" class="table-link">${payment.processNumber}</a></td>
        <td class="table-cell">${payment.supplier}</td>
        <td class="table-cell">R$ ${Number(payment.value).toFixed(2)}</td>
        <td class="table-cell">${formatDate(payment.paymentDate)}</td>
        <td class="table-cell">${payment.paymentMethod === 'Outros' ? payment.paymentMethodOther : payment.paymentMethod}</td>
        <td class="table-cell"><div class="custom-dropdown-container">${statusHTML}</div></td>
        <td class="table-cell"><div class="custom-dropdown-container">${locationHTML}</div></td>
        <td class="table-cell text-right">
            ${loggedIn ? `<button onclick="editPayment('${payment.id}')" class="action-btn text-blue-600" title="Editar"><i class="fas fa-edit"></i></button>${payment.paymentProof ? `<button onclick="viewPaymentProof('${payment.id}')" class="action-btn text-indigo-600" title="Ver Comprovante"><i class="fas fa-file-invoice"></i></button>` : ''}<button onclick="confirmDelete('${payment.id}', 'pagamento')" class="action-btn text-red-500" title="Excluir"><i class="fas fa-trash-alt"></i></button>` : `<button class="action-btn" disabled><i class="fas fa-lock"></i></button>`}
        </td>`;
    return row;
}

function openProcessDetailsModal(processId) {
    const process = processes.find(p => p.id === processId);
    if (!process) return showToast('Processo não encontrado.', 'error');

    const modal = document.getElementById('details-modal');
    const documentsHTML = (process.documents && process.documents.length > 0)
        ? process.documents.map((doc, index) => `
            <div class="document-item">
                <i class="fas ${getFileIcon(doc.type)} mr-3 text-gray-500"></i>
                <span class="truncate flex-1">${doc.name}</span>
                <button onclick="downloadFile(event, '${process.id}', ${index})" class="download-btn" title="Baixar"><i class="fas fa-download"></i></button>
            </div>`).join('')
        : '<p class="text-gray-500 text-center py-4">Nenhum documento anexado.</p>';

    modal.innerHTML = `
        <div class="modal-content max-w-xl">
            <div class="modal-header">
                <h3 class="text-lg font-medium">Detalhes do Processo ${process.processNumber}</h3>
                <button onclick="closeDetailsModal()" class="text-gray-400 hover:text-gray-600" aria-label="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <div>
                    <h4 class="font-semibold text-gray-800 mb-2">Documentos</h4>
                    <div class="document-list-container">${documentsHTML}</div>
                </div>
                <div class="mt-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Descrição</h4>
                    <textarea id="details-description" class="input-styled w-full" rows="4">${process.description || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer justify-between">
                <p class="text-sm text-gray-600">Fornecedor: <strong>${process.supplier}</strong></p>
                <div>
                    <button onclick="closeDetailsModal()" class="btn-secondary">Cancelar</button>
                    <button onclick="saveProcessDescription('${process.id}')" class="btn-primary">Salvar Descrição</button>
                </div>
            </div>
        </div>`;
    modal.classList.add('show');
}

function openPaymentDetailsModal(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return showToast('Pagamento não encontrado.', 'error');

    const modal = document.getElementById('details-modal');
    const proofHTML = payment.paymentProof
        ? `<div class="document-item">
             <i class="fas ${getFileIcon(payment.paymentProof.type)} mr-3 text-green-600"></i>
             <span class="truncate flex-1">${payment.paymentProof.name}</span>
             <button onclick="viewPaymentProof('${payment.id}')" class="download-btn" title="Visualizar"><i class="fas fa-eye"></i></button>
           </div>`
        : '<p class="text-gray-500 text-center py-4">Nenhum comprovante de pagamento.</p>';

    modal.innerHTML = `
        <div class="modal-content max-w-xl">
            <div class="modal-header">
                <h3 class="text-lg font-medium">Detalhes do Pagamento (Proc. ${payment.processNumber})</h3>
                <button onclick="closeDetailsModal()" class="text-gray-400 hover:text-gray-600" aria-label="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <div>
                    <h4 class="font-semibold text-gray-800 mb-2">Comprovante</h4>
                    ${proofHTML}
                </div>
                <div class="mt-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Observações do Pagamento</h4>
                    <p class="text-gray-600 text-sm p-3 bg-gray-50 rounded min-h-[80px]">${payment.description || 'Nenhuma observação.'}</p>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeDetailsModal()" class="btn-secondary">Fechar</button>
            </div>
        </div>`;
    modal.classList.add('show');
}


function closeDetailsModal() { document.getElementById('details-modal').classList.remove('show'); }

async function saveProcessDescription(processId) {
    const process = processes.find(p => p.id === processId);
    if (!process) return;

    const newDescription = document.getElementById('details-description').value;
    if (process.description !== newDescription) {
        process.description = newDescription;
        logActivity('Atualização de Processo', `Descrição do processo Nº ${process.processNumber} atualizada.`, { supplier: process.supplier });
        await saveDataAndReload();
        showToast('Descrição salva com sucesso!');
    }
    closeDetailsModal();
}

function editProcess(processId) { handleAction(() => openProcessModal(processId)); }
function openProcessModal(processId = null) {
    const form = document.getElementById('process-form');
    const processNumberInput = document.getElementById('process-number');
    form.reset();
    document.getElementById('modalidade-other-section').classList.add('hidden');
    processFilePreviews = [];
    processNumberInput.readOnly = false;

    if (processId) {
        const process = processes.find(p => p.id === processId);
        if (process) {
            document.getElementById('process-modal-title').textContent = 'Editar Processo';
            document.getElementById('process-id').value = process.id;
            processNumberInput.value = process.processNumber;
            processNumberInput.readOnly = true; 
            document.getElementById('supplier').value = process.supplier;
            document.getElementById('description').value = process.description || '';
            document.getElementById('payment-type').value = process.paymentType || '';
            if (process.paymentType === 'Outros') {
                document.getElementById('modalidade-other-section').classList.remove('hidden');
                document.getElementById('modalidade-other-text').value = process.paymentTypeOther || '';
            }
            processFilePreviews = process.documents || [];
        }
    } else {
        document.getElementById('process-modal-title').textContent = 'Novo Processo';
        document.getElementById('process-id').value = '';
    }
    
    renderFilePreviews('process-file-preview-container', processFilePreviews, 'process');
    document.getElementById('payment-type').onchange = (e) => document.getElementById('modalidade-other-section').classList.toggle('hidden', e.target.value !== 'Outros');
    document.getElementById('process-docs').onchange = (e) => handleFileSelection(e, 'process');
    document.getElementById('process-modal').classList.add('show');
}
function closeProcessModal() { document.getElementById('process-modal').classList.remove('show'); }

function editPayment(paymentId) { handleAction(() => openPaymentModal(paymentId)); }
function openPaymentModal(paymentId = null) {
    const form = document.getElementById('payment-form');
    form.reset();
    paymentFilePreview = null;
    document.getElementById('payment-method-other-section').classList.add('hidden');
    
    const processDatalist = document.getElementById('process-numbers-list');
    processDatalist.innerHTML = processes.map(p => `<option value="${p.processNumber}"></option>`).join('');
    const supplierDatalist = document.getElementById('supplier-list');
    supplierDatalist.innerHTML = [...new Set(processes.map(p => p.supplier))].map(s => `<option value="${s}"></option>`).join('');

    const processNumberInput = document.getElementById('payment-process-number');
    const supplierInput = document.getElementById('payment-supplier');
    processNumberInput.oninput = () => { const p = processes.find(pr => pr.processNumber === processNumberInput.value); if(p) supplierInput.value = p.supplier; };
    supplierInput.oninput = () => { const p = processes.find(pr => pr.supplier === supplierInput.value); if(p) processNumberInput.value = p.processNumber; };

    if (paymentId) {
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
            document.getElementById('payment-modal-title').textContent = 'Editar Pagamento';
            document.getElementById('payment-id').value = payment.id;
            processNumberInput.value = payment.processNumber;
            supplierInput.value = payment.supplier;
            document.getElementById('payment-value').value = payment.value;
            document.getElementById('payment-date').value = payment.paymentDate;
            document.getElementById('payment-status').value = payment.status;
            document.getElementById('payment-description').value = payment.description || '';
            document.getElementById('payment-method').value = payment.paymentMethod || '';
            if (payment.paymentMethod === 'Outros') {
                document.getElementById('payment-method-other-section').classList.remove('hidden');
                document.getElementById('payment-method-other-text').value = payment.paymentMethodOther || '';
            }
            paymentFilePreview = payment.paymentProof;
        }
    } else {
        document.getElementById('payment-modal-title').textContent = 'Novo Pagamento';
        document.getElementById('payment-id').value = '';
    }
    
    renderFilePreviews('payment-file-preview-container', paymentFilePreview ? [paymentFilePreview] : [], 'payment');
    document.getElementById('payment-method').onchange = e => document.getElementById('payment-method-other-section').classList.toggle('hidden', e.target.value !== 'Outros');
    document.getElementById('payment-proof').onchange = (e) => handleFileSelection(e, 'payment');
    document.getElementById('payment-modal').classList.add('show');
}
function closePaymentModal() { document.getElementById('payment-modal').classList.remove('show'); }

function openOtherLocationModal(processId) {
    const process = processes.find(p => p.id === processId);
    if (!process) return;
    document.getElementById('other-location-process-id').value = process.id;
    document.getElementById('other-location-text').value = process.locationOtherText || '';
    document.getElementById('other-location-modal').classList.add('show');
}
function closeOtherLocationModal() { document.getElementById('other-location-modal').classList.remove('show'); }
function saveOtherLocation() {
    const processId = document.getElementById('other-location-process-id').value;
    const text = document.getElementById('other-location-text').value.trim();
    updateProcessLocation(processId, 'Outros', text);
    closeOtherLocationModal();
}

function openClearLogModal() { document.getElementById('clear-log-modal').classList.add('show'); }
function closeClearLogModal() { document.getElementById('clear-log-modal').classList.remove('show'); }
async function executeClearLog() {
    if (document.getElementById('clear-admin-password').value !== "2025") return showToast("Senha de administrador incorreta.", "error");
    if (document.getElementById('clear-type-select').value === 'all') activities = [];
    else {
        const visibleIds = [...document.querySelectorAll('#activities-log-container .activity-item')].map(item => item.dataset.activityId);
        activities = activities.filter(act => !visibleIds.includes(act.id));
    }
    await saveDataAndReload();
    closeClearLogModal();
    showToast("Registros limpos com sucesso!", "success");
}

function confirmDelete(id, type, username = null) {
    handleAction(() => {
        itemToDelete = { id, type, username };
        const modal = document.getElementById('confirmation-modal');
        const text = document.getElementById('confirmation-text');
        
        let itemIdentifier = '';
        if (type === 'processo') {
            const item = processes.find(p => p.id === id);
            itemIdentifier = `processo Nº ${item.processNumber}`;
        } else if (type === 'pagamento') {
            const item = payments.find(p => p.id === id);
            itemIdentifier = `pagamento do processo Nº ${item.processNumber}`;
        } else if (type === 'user') {
            itemIdentifier = `usuário "${username}"`;
        }

        text.textContent = `Tem certeza que deseja excluir o ${itemIdentifier}? A ação não pode ser desfeita.`;
        modal.classList.add('show');
    });
}
function closeConfirmationModal() {
    document.getElementById('confirmation-modal').classList.remove('show');
    itemToDelete = { id: null, type: null, username: null };
}

async function saveProcess() {
    const id = document.getElementById('process-id').value;
    const data = {
        processNumber: document.getElementById('process-number').value.trim(),
        supplier: document.getElementById('supplier').value.trim(),
        paymentType: document.getElementById('payment-type').value,
        description: document.getElementById('description').value.trim(),
        documents: processFilePreviews || []
    };
    if (!data.processNumber || !data.supplier || !data.paymentType) return showToast('Preencha Nº Processo, Fornecedor e Modalidade!', 'error');
    if (data.paymentType === 'Outros') {
        data.paymentTypeOther = document.getElementById('modalidade-other-text').value.trim();
        if (!data.paymentTypeOther) return showToast('Especifique a modalidade!', 'error');
    }
    
    const isEditing = !!id;
    if (!isEditing && processes.some(p => p.processNumber === data.processNumber)) {
        return showToast('Já existe um processo com este número.', 'error');
    }

    if (isEditing) {
        const index = processes.findIndex(p => p.id === id);
        if (index > -1) {
            // Preserva os dados de importância e alerta ao editar outras informações
            data.isImportant = processes[index].isImportant;
            data.alert = processes[index].alert;
            processes[index] = { ...processes[index], ...data };
            logActivity('Atualização de Processo', `Processo Nº ${data.processNumber} atualizado.`, { supplier: data.supplier });
        }
    } else {
        const newProcess = { ...data, id: generateId(), locationInfo: "Contabilidade", createdAt: new Date().toISOString(), isImportant: false, alert: null };
        processes.push(newProcess);
        logActivity('Criação de Processo', `Novo processo Nº ${newProcess.processNumber} criado.`, { supplier: newProcess.supplier });
    }
    await saveDataAndReload();
    closeProcessModal();
    showToast('Processo salvo com sucesso!');
}

async function savePayment() {
    const data = {
        id: document.getElementById('payment-id').value,
        processNumber: document.getElementById('payment-process-number').value.trim(),
        supplier: document.getElementById('payment-supplier').value.trim(),
        value: parseFloat(document.getElementById('payment-value').value),
        paymentDate: document.getElementById('payment-date').value,
        paymentMethod: document.getElementById('payment-method').value,
        status: document.getElementById('payment-status').value,
        description: document.getElementById('payment-description').value.trim(),
        paymentProof: paymentFilePreview || null
    };
    if (!data.processNumber || !data.supplier || isNaN(data.value) || !data.paymentDate || !data.paymentMethod || !data.status) return showToast('Preencha todos os campos obrigatórios!', 'error');
    
    const process = processes.find(p => p.processNumber === data.processNumber);
    if (!process) return showToast('Nº de Processo não encontrado. Cadastre o processo primeiro.', 'error');

    data.location = process.locationInfo || 'Contabilidade';
    if (data.paymentMethod === 'Outros') {
        data.paymentMethodOther = document.getElementById('payment-method-other-text').value.trim();
        if (!data.paymentMethodOther) return showToast('Especifique o método de pagamento!', 'error');
    }

    if (data.id) {
        const index = payments.findIndex(p => p.id === data.id);
        if (index > -1) {
            payments[index] = { ...payments[index], ...data };
            logActivity('Atualização de Pagamento', `Pagamento do processo Nº ${data.processNumber} atualizado.`, { supplier: data.supplier });
        }
    } else {
        const newPayment = { ...data, id: generateId(), createdAt: new Date().toISOString() };
        payments.push(newPayment);
        logActivity('Criação de Pagamento', `Novo pagamento de R$ ${newPayment.value.toFixed(2)} para o processo Nº ${newPayment.processNumber}.`, { supplier: newPayment.supplier });
    }
    await saveDataAndReload();
    closePaymentModal();
    showToast('Pagamento salvo com sucesso!');
}

async function updateProcessLocation(processId, newLocation, otherText = null) {
    const processIndex = processes.findIndex(p => p.id === processId);
    if (processIndex === -1) return;
    
    if (newLocation === 'Outros' && otherText === null) {
        openOtherLocationModal(processId);
        return;
    }

    const process = processes[processIndex];
    process.locationInfo = newLocation;
    process.locationOtherText = newLocation === 'Outros' ? otherText : '';
    
    payments.forEach(p => { if (p.processNumber === process.processNumber) p.location = newLocation; });
    
    logActivity('Mudança de Localização', `Localização do Proc. Nº ${process.processNumber} alterada para "${newLocation}".`, { supplier: process.supplier });
    await saveDataAndReload();
    showToast('Localização atualizada!');
}

async function updatePaymentStatus(paymentId, newStatus) {
    const index = payments.findIndex(p => p.id === paymentId);
    if (index === -1) return;
    
    const payment = payments[index];
    if (payment.status === newStatus) return;

    payment.status = newStatus;
    logActivity(`Status: ${newStatus}`, `Status do Pagto. Nº ${payment.processNumber} alterado para '${newStatus}'.`, { supplier: payment.supplier });
    await saveDataAndReload();
    showToast('Status atualizado!');
}

async function executeDelete() {
    const { id, type, username } = itemToDelete;
    if (!type) return;

    if (type === 'processo' && id) {
        const process = processes.find(p => p.id === id);
        if (process) {
            payments = payments.filter(p => p.processNumber !== process.processNumber);
            processes = processes.filter(p => p.id !== id);
            logActivity('Exclusão', `Processo Nº ${process.processNumber} e pagamentos associados foram excluídos.`, { supplier: process.supplier });
        }
    } else if (type === 'pagamento' && id) {
        const payment = payments.find(p => p.id === id);
        if (payment) {
            payments = payments.filter(p => p.id !== id);
            logActivity('Exclusão', `Pagamento de R$ ${payment.value.toFixed(2)} (Proc. Nº ${payment.processNumber}) foi excluído.`, { supplier: payment.supplier });
        }
    } else if (type === 'user' && username) {
        const adminPassword = prompt("Para excluir um usuário, por favor, insira a senha de administrador:");
        if (adminPassword !== "2025") {
            showToast("Senha de administrador incorreta. A exclusão foi cancelada.", "error");
            closeConfirmationModal();
            return;
        }
        users = users.filter(u => u.username !== username);
        logActivity('Exclusão de Usuário', `O usuário "${username}" foi excluído.`);
    }

    await saveDataAndReload();
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} excluído com sucesso!`);
    closeConfirmationModal();
}

function handleFileSelection(event, type) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const filePromises = files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, type: file.type, data: e.target.result });
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    }));

    Promise.all(filePromises).then(newFiles => {
        if (type === 'process') {
            processFilePreviews.push(...newFiles);
            renderFilePreviews('process-file-preview-container', processFilePreviews, 'process');
        } else {
            paymentFilePreview = newFiles[0];
            renderFilePreviews('payment-file-preview-container', [paymentFilePreview], 'payment');
        }
    }).catch(err => {
        console.error("Erro ao ler arquivos:", err);
        showToast("Ocorreu um erro ao carregar os arquivos.", "error");
    });
}

function renderFilePreviews(containerId, files, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = files.map((file, index) => `
        <div class="file-preview-item">
            <i class="fas ${getFileIcon(file.type)} mr-2"></i>
            <span class="text-xs truncate flex-1">${file.name}</span>
            <button type="button" onclick="removeFilePreview(event, ${index}, '${type}')" class="ml-2 text-red-500 hover:text-red-700" aria-label="Remover">&times;</button>
        </div>`).join('');
}

function removeFilePreview(event, index, type) {
    event.preventDefault();
    if (type === 'process') {
        processFilePreviews.splice(index, 1);
        renderFilePreviews('process-file-preview-container', processFilePreviews, 'process');
    } else {
        paymentFilePreview = null;
        renderFilePreviews('payment-file-preview-container', [], 'payment');
    }
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fa-file-image';
    if (fileType === 'application/pdf') return 'fa-file-pdf';
    if (fileType.includes('word')) return 'fa-file-word';
    return 'fa-file-alt';
}

function downloadFile(event, processId, fileIndex) {
    event.stopPropagation();
    const process = processes.find(p => p.id === processId);
    const file = process?.documents[fileIndex];
    if (file) {
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatDate(dateString) { 
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
}

function slugify(text) {
    if (!text) return '';
    text = text.toString().toLowerCase().trim();
    const sets = [ {to: 'a', from: '[ÀÁÂÃÄÅÆĀĂĄẠẢẤẦẨẪẬẮẰẲẴẶ]'}, {to: 'c', from: '[ÇĆČ]'}, {to: 'd', from: '[ÐĎ]'}, {to: 'e', from: '[ÈÉÊËĒĖĘĚẸẺẼẾỀỂỄỆ]'}, {to: 'i', from: '[ÌÍÎÏĪĮİỈỊ]'}, {to: 'l', from: '[Ł]'}, {to: 'n', from: '[ÑŃŇ]'}, {to: 'o', from: '[ÒÓÔÕÖØŌŎŐỌỎỐỒỔỖỘỚỜỞỠỢ]'}, {to: 'r', from: '[ŔŘ]'}, {to: 's', from: '[ŚŠŞȘ]'}, {to: 't', from: '[ŢȚ]'}, {to: 'u', from: '[ÙÚÛÜŪŬŮŰŲỤỦỨỪỬỮỰ]'}, {to: 'y', from: '[ÝŸỲỸỶỴ]'}, {to: 'z', from: '[ŹŻŽ]'}, {to: '-', from: '[·/_,:;]'} ];
    sets.forEach(set => { text = text.replace(new RegExp(set.from, 'gi'), set.to); });
    return text.replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function getLocationBadgeClass(location) { return `location-${slugify(location || 'default')}`; }
function getPaymentStatusClass(status) { return `status-${slugify(status || 'default')}`; }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }

function closeActiveDropdown() {
    if (activeDropdown) {
        activeDropdown.querySelector('.icon-bar-container')?.remove();
        activeDropdown = null;
    }
}

function toggleDropdown(event, element, type, id, currentValue) {
    event.stopPropagation();
    if (activeDropdown && activeDropdown !== element.parentElement) closeActiveDropdown();
    
    const container = element.parentElement;
    if (container.querySelector('.icon-bar-container')) { closeActiveDropdown(); return; }

    activeDropdown = container;
    const menu = document.createElement('div');
    menu.className = 'icon-bar-container';

    const options = {
        location: { 'Contabilidade': 'fa-calculator', 'Secretário/Presidente': 'fa-user-tie', 'Arquivado': 'fa-archive', 'Outros': 'fa-map-marker-alt' },
        status: { 'Pendente de Liquidação/O.P': 'fa-file-invoice-dollar', 'Pendente de Cadastro no Banco': 'fa-landmark', 'Cadastrado no banco': 'fa-university', 'Agendado': 'fa-calendar-alt', 'Pago': 'fa-check-circle' }
    };
    
    Object.entries(options[type]).filter(([option]) => option !== currentValue).forEach(([option, icon]) => {
        const btn = document.createElement('button');
        btn.className = 'action-icon';
        btn.title = option;
        btn.innerHTML = `<i class="fas ${icon}"></i>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            closeActiveDropdown();
            type === 'location' ? updateProcessLocation(id, option) : updatePaymentStatus(id, option);
        };
        menu.appendChild(btn);
    });
    container.appendChild(menu);
}

function updateTableFooter(type, shown, total) {
    const toEl = document.getElementById(`${type}-showing-to`);
    const totalEl = document.getElementById(`${type}-total-items`);
    if(toEl && totalEl) {
        toEl.textContent = shown;
        totalEl.textContent = total;
    }
}

function populatePaymentFilter() {
    const filter = document.getElementById('payment-status-filter');
    if (filter.options.length > 2 && filter.options[3].value === 'Pagos Hoje') return;
    filter.innerHTML = `<option value="">Todos Status</option><option value="Pendente">Pendente</option><option value="Agendados para Hoje">Agendados do dia</option><option value="Pagos Hoje">Pagos do dia</option><option value="Cadastrado no banco">Cadastrado no Banco</option><option value="Agendado">Agendado (Todos)</option><option value="Pago">Pago (Todos)</option>`;
}

function populateDateFilters() {
    const monthFilter = document.getElementById('payment-month-filter');
    const yearFilter = document.getElementById('payment-year-filter');
    if (yearFilter.options.length > 1) return; 
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthFilter.innerHTML = '<option value="">Mês</option>' + months.map((m, i) => `<option value="${(i + 1).toString().padStart(2, '0')}">${m}</option>`).join('');
    const years = [...new Set(payments.map(p => p.paymentDate.substring(0, 4)))].sort().reverse();
    yearFilter.innerHTML = '<option value="">Ano</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}


function populateActivityFilter() {
    const filter = document.getElementById('activity-type-filter');
    if (filter.options.length > 2 && filter.options[6].value === 'Status: Pago') return; 
    filter.innerHTML = `<option value="all">Todas as Atividades</option><option value="Criação de Processo">Criação de Processo</option><option value="Atualização de Processo">Atualização de Processo</option><option value="Criação de Pagamento">Criação de Pagamento</option><option value="Atualização de Pagamento">Atualização de Pagamento</option><option value="Mudança de Localização">Mudança de Localização</option><option value="Status: Pago">Status: Pago</option><option value="Status: Agendado">Status: Agendado</option><option value="Status: Cadastrado no banco">Status: Cadastrado no Banco</option><option value="Exclusão">Exclusão</option><option value="Login">Login</option>`;
}

function logActivity(type, description, details = {}) {
    activities.unshift({ id: generateId(), type, description, user: getCurrentUser() || 'Sistema', timestamp: new Date().toISOString(), details });
}

function renderActivities() {
    const container = document.getElementById('activities-log-container');
    container.innerHTML = '';
    const typeFilter = document.getElementById('activity-type-filter').value;
    let dateRange = [];
    const periodFilter = document.getElementById('report-period-filter').value;

    switch(periodFilter) {
        case 'day':
            const dayPicker = document.getElementById('report-date-picker')._flatpickr;
            if (dayPicker.selectedDates.length > 0) dateRange = [dayPicker.selectedDates[0], dayPicker.selectedDates[0]];
            break;
        case 'range':
            const rangePicker = document.getElementById('report-date-range-picker')._flatpickr;
            if (rangePicker.selectedDates.length === 2) dateRange = rangePicker.selectedDates;
            break;
        case 'weekly':
            const today = new Date();
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
            dateRange = [firstDayOfWeek, lastDayOfWeek];
            break;
        case 'monthly':
            const month = document.getElementById('report-month-picker').value;
            const year = document.getElementById('report-year-picker-month').value;
            if (month && year) {
                const firstDayOfMonth = new Date(year, month - 1, 1);
                const lastDayOfMonth = new Date(year, month, 0);
                dateRange = [firstDayOfMonth, lastDayOfMonth];
            }
            break;
        case 'annual':
            const yearAnnual = document.getElementById('report-year-picker-annual').value;
            if(yearAnnual) dateRange = [new Date(yearAnnual, 0, 1), new Date(yearAnnual, 11, 31)];
            break;
    }
    
    const filtered = activities.filter(act => {
        const matchesType = typeFilter === 'all' || act.type === typeFilter;
        let matchesDate = true;
        if (dateRange.length > 0) {
            const actDate = new Date(act.timestamp);
            const startDate = new Date(dateRange[0]);
            startDate.setHours(0, 0, 0, 0);
            let endDate = dateRange.length > 1 ? new Date(dateRange[1]) : new Date(dateRange[0]);
            endDate.setHours(23, 59, 59, 999);
            matchesDate = actDate >= startDate && actDate <= endDate;
        }
        return matchesType && matchesDate;
    });

    const icons = { 'Criação de Processo': 'fa-folder-plus', 'Atualização de Processo': 'fa-pencil-alt', 'Criação de Pagamento': 'fa-file-invoice-dollar', 'Atualização de Pagamento': 'fa-edit', 'Exclusão': 'fa-trash-alt', 'Status: Pago': 'fa-check-circle', 'Status: Agendado': 'fa-calendar-alt', 'Status: Cadastrado no banco': 'fa-university', 'Status: Pendente de Liquidação/O.P': 'fa-hourglass-half', 'Status: Pendente de Cadastro no Banco': 'fa-hourglass-half', 'Mudança de Localização': 'fa-map-marker-alt', 'Login': 'fa-user-check', 'default': 'fa-info-circle' };
    
    filtered.forEach(act => {
        const iconClass = icons[act.type] || icons['default'];
        const activityClass = slugify(act.type);
        const supplierInfo = act.details?.supplier ? ` • <span class="font-normal text-gray-500">${act.details.supplier}</span>` : '';
        container.innerHTML += `<div class="activity-item" data-activity-id="${act.id}"><div class="activity-icon icon-${activityClass}"><i class="fas ${iconClass}"></i></div><div class="flex-grow"><p class="font-medium text-gray-800">${act.description}${supplierInfo}</p><p class="text-sm text-gray-500">${act.user} • ${new Date(act.timestamp).toLocaleString('pt-BR')}</p></div></div>`;
    });
}

function setupDatePickers() {
    const container = document.getElementById('report-date-pickers');
    container.innerHTML = ''; 
    const period = document.getElementById('report-period-filter').value;

    switch(period) {
        case 'day':
             container.innerHTML = `<input type="text" id="report-date-picker" placeholder="Selecione o dia" class="input-styled w-full mt-1">`;
             flatpickr("#report-date-picker", { dateFormat: "d/m/Y", defaultDate: "today", onChange: renderActivities });
             break;
        case 'range':
            container.innerHTML = `<input type="text" id="report-date-range-picker" placeholder="Selecione o intervalo" class="input-styled w-full mt-1">`;
            flatpickr("#report-date-range-picker", { mode: "range", dateFormat: "d/m/Y", onChange: renderActivities });
            break;
        case 'monthly':
            container.innerHTML = `<select id="report-month-picker" class="input-styled mt-1"></select><select id="report-year-picker-month" class="input-styled mt-1"></select>`;
            populateReportDateFilters('month');
            document.getElementById('report-month-picker').addEventListener('change', renderActivities);
            document.getElementById('report-year-picker-month').addEventListener('change', renderActivities);
            break;
        case 'annual':
            container.innerHTML = `<select id="report-year-picker-annual" class="input-styled mt-1"></select>`;
            populateReportDateFilters('annual');
            document.getElementById('report-year-picker-annual').addEventListener('change', renderActivities);
            break;
        case 'weekly':
        default:
            renderActivities(); 
            break;
    }
    renderActivities();
}

function populateReportDateFilters(type) {
    const years = [...new Set(activities.map(a => a.timestamp.substring(0, 4)))].sort().reverse();
    if (type === 'month') {
        const monthFilter = document.getElementById('report-month-picker');
        const yearFilter = document.getElementById('report-year-picker-month');
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthFilter.innerHTML = '<option value="">Mês</option>' + months.map((m, i) => `<option value="${(i + 1).toString().padStart(2, '0')}">${m}</option>`).join('');
        yearFilter.innerHTML = '<option value="">Ano</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    } else if (type === 'annual') {
        const yearFilterAnnual = document.getElementById('report-year-picker-annual');
        yearFilterAnnual.innerHTML = '<option value="">Ano</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    }
}

async function generateActivitiesReport() {
    const user = sessionStorage.getItem('loggedInUser') || 'N/A';
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');
    
    const container = document.getElementById('activities-log-container');
    const activityItems = [...container.querySelectorAll('.activity-item')];

    if (activityItems.length === 0) {
        showToast('Nenhuma atividade para gerar relatório.', 'error');
        return;
    }
    
    const styleSheets = Array.from(document.styleSheets)
        .map(sheet => {
            try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join(''); } catch (e) { return ''; }
        }).join('');

    // Restante da função é longo e não foi alterado, omitido por brevidade
}

function viewPaymentProof(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment || !payment.paymentProof) return showToast('Comprovante não encontrado.', 'error');
    
    const proof = payment.paymentProof;
    const modal = document.getElementById('proof-modal');
    const content = document.getElementById('proof-content');
    
    document.getElementById('proof-modal-title').textContent = `Comprovante: ${payment.processNumber}`;
    document.getElementById('download-proof-btn').onclick = () => downloadProof(payment.id);
    document.getElementById('print-proof-btn').onclick = () => printProof(payment.id);
    
    if (proof.type.startsWith('image/')) content.innerHTML = `<img src="${proof.data}" class="max-w-full h-auto">`;
    else if (proof.type === 'application/pdf') content.innerHTML = `<iframe src="${proof.data}" type="application/pdf" width="100%" height="500px"></iframe>`;
    else content.innerHTML = `<p class="text-center text-gray-600">Visualização não suportada. Faça o download.</p>`;
    
    modal.classList.add('show');
}

function closeProofModal() { document.getElementById('proof-modal').classList.remove('show'); }

function downloadProof(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment || !payment.paymentProof) return;
    const a = document.createElement('a');
    a.href = payment.paymentProof.data;
    a.download = payment.paymentProof.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function printProof(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment || !payment.paymentProof) return;
    const proof = payment.paymentProof;
    if (proof.type.startsWith('image/')) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<body onload="window.print(); window.close();"><img src="${proof.data}" style="max-width: 100%;"></body>`);
        printWindow.document.close();
    } else if (proof.type === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden';
        iframe.src = proof.data;
        document.body.appendChild(iframe);
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    } else {
        showToast('Formato não suportado para impressão direta.', 'error');
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        document.getElementById('theme-toggle').checked = true;
    } else {
        document.body.classList.remove('dark');
        document.getElementById('theme-toggle').checked = false;
    }
}

function toggleTheme() {
    const isDark = document.getElementById('theme-toggle').checked;
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

function renderUserSettings() {
    document.getElementById('user-management-section').style.display = isUserLoggedIn() ? 'block' : 'none';
    if (isUserLoggedIn()) {
        renderUsersList();
    }
}

function renderUsersList() {
    const container = document.getElementById('users-list-container');
    const currentUser = getCurrentUser();
    container.innerHTML = ''; 

    if (users.length > 0) {
        users.forEach(user => {
            const isCurrentUser = user.username === currentUser;
            const item = document.createElement('div');
            item.className = 'user-list-item';
            item.innerHTML = `
                <div>
                    <p class="font-medium">${user.username} ${isCurrentUser ? '<span class="text-xs text-blue-500">(Você)</span>' : ''}</p>
                </div>
                <button 
                    onclick="handleDeleteUser('${user.username}')" 
                    class="action-btn text-red-500" 
                    title="Excluir Usuário"
                    ${isCurrentUser ? 'disabled' : ''}>
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            container.appendChild(item);
        });
    } else {
        container.innerHTML = '<p class="text-center text-gray-500">Nenhum usuário cadastrado.</p>';
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmNewPassword) {
        return showToast('As novas senhas não coincidem.', 'error');
    }
    if (!newPassword || newPassword.length < 4) {
        return showToast('A nova senha deve ter pelo menos 4 caracteres.', 'error');
    }

    const username = getCurrentUser();
    const userIndex = users.findIndex(u => u.username === username);
    const user = users[userIndex];

    if (user.password !== currentPassword) {
        return showToast('A senha atual está incorreta.', 'error');
    }

    users[userIndex].password = newPassword;
    logActivity('Alteração de Senha', `O usuário ${username} alterou a própria senha.`);
    
    const success = await saveDataToServer();
    if (success) {
        showToast('Senha alterada com sucesso!');
        e.target.reset();
    } else {
        users[userIndex].password = currentPassword;
    }
}

async function handleAddNewUser(e) {
    e.preventDefault();
    const newUsername = document.getElementById('new-username').value.trim();
    const newUserPassword = document.getElementById('new-user-password').value;

    if (!newUsername || !newUserPassword) {
        return showToast('Preencha o nome de usuário e a senha.', 'error');
    }
    if (users.some(u => u.username === newUsername)) {
        return showToast('Este nome de usuário já existe.', 'error');
    }
    
    const adminPassword = prompt("Para adicionar um novo usuário, por favor, insira a senha de administrador:");
    if (adminPassword !== "2025") {
        return showToast("Senha de administrador incorreta. A operação foi cancelada.", "error");
    }

    users.push({ username: newUsername, password: newUserPassword });
    logActivity('Criação de Usuário', `Novo usuário "${newUsername}" foi criado.`);
    
    await saveDataAndReload();
    showToast('Novo usuário adicionado com sucesso!');
    e.target.reset();
}

function handleDeleteUser(username) {
    const currentUser = getCurrentUser();
    if (username === currentUser) {
        showToast('Você não pode excluir sua própria conta.', 'error');
        return;
    }
    confirmDelete(null, 'user', username);

}
agora sim, tudo ok. obrigado