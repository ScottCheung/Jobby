(function() {
    // Prevent double initialization
    if (window.botDashboardInitialized) return;
    window.botDashboardInitialized = true;

    // Load raw data provided by Python
    const personals = window.botPersonalsData || {};
    const questionCache = window.botQuestionCacheData || { version: 1, questions: [] };
    const appHistory = window.botAppHistoryData || [];

    // Save requests state
    window.botSaveRequest = null;

    // Inject Styles
    const style = document.createElement('style');
    style.id = 'bot-dashboard-styles';
    style.textContent = `
        /* Root & Theme Variables */
        :root {
            --g-blue: #1a73e8;
            --g-blue-hover: #1557b0;
            --g-red: #ea4335;
            --g-red-hover: #b31412;
            --g-green: #34a853;
            --g-green-hover: #137333;
            --g-yellow: #fbbc05;
            --bg-card: #ffffff;
            --text-primary: #202124;
            --text-secondary: #5f6368;
            --border-color: #dadce0;
            --shadow-fab: 0 4px 10px rgba(26,115,232,0.3), 0 1px 3px rgba(0,0,0,0.1);
            --shadow-panel: 0 12px 36px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1);
            --font-family: 'Google Sans', Roboto, Arial, sans-serif;
        }

        /* Floating Action Button (FAB) */
        #bot-fab {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background-color: var(--g-blue);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--shadow-fab);
            z-index: 2147483645;
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
            border: none;
            outline: none;
            user-select: none;
        }
        #bot-fab:hover {
            transform: scale(1.08);
            background-color: var(--g-blue-hover);
        }
        #bot-fab svg {
            width: 24px;
            height: 24px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        /* Full-screen Overlay Backdrop */
        #bot-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 2147483646;
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        #bot-overlay.active {
            display: flex;
            opacity: 1;
        }

        /* Dashboard Main Panel */
        #bot-panel {
            width: 85%;
            max-width: 1100px;
            height: 80%;
            max-height: 750px;
            background-color: var(--bg-card);
            border-radius: 16px;
            box-shadow: var(--shadow-panel);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: var(--font-family);
            color: var(--text-primary);
            transform: scale(0.95);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #bot-overlay.active #bot-panel {
            transform: scale(1);
        }

        /* Panel Header */
        .bot-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8f9fa;
        }
        .bot-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .bot-title-group svg {
            width: 28px;
            height: 28px;
            color: var(--g-blue);
        }
        .bot-title {
            font-size: 20px;
            font-weight: 500;
            margin: 0;
            color: var(--g-blue);
        }
        .bot-close-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            transition: background-color 0.2s;
        }
        .bot-close-btn:hover {
            background-color: rgba(0,0,0,0.06);
            color: var(--text-primary);
        }

        /* Navigation Tabs */
        .bot-tabs {
            display: flex;
            padding: 0 24px;
            background-color: #f8f9fa;
            border-bottom: 1px solid var(--border-color);
            gap: 24px;
        }
        .bot-tab {
            padding: 14px 4px;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: color 0.2s, border-bottom-color 0.2s;
            user-select: none;
        }
        .bot-tab:hover {
            color: var(--g-blue);
        }
        .bot-tab.active {
            color: var(--g-blue);
            border-bottom-color: var(--g-blue);
        }

        /* Panel Body & Tab Contents */
        .bot-content-area {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            background-color: #ffffff;
        }
        .bot-tab-content {
            display: none;
            height: 100%;
        }
        .bot-tab-content.active {
            display: flex;
            flex-direction: column;
        }

        /* Form Layout (User Info) */
        .bot-grid-form {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }
        .bot-form-group {
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .bot-form-group label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 6px;
        }
        .bot-form-group input, .bot-form-group select {
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 10px 12px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .bot-form-group input:focus, .bot-form-group select:focus {
            border-color: var(--g-blue);
            box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
        }

        /* Buttons & Footer */
        .bot-footer {
            display: flex;
            justify-content: flex-end;
            padding: 16px 24px;
            border-top: 1px solid var(--border-color);
            background-color: #f8f9fa;
            gap: 12px;
        }
        .bot-btn {
            font-size: 14px;
            font-weight: 500;
            padding: 10px 24px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            cursor: pointer;
            transition: background-color 0.2s, box-shadow 0.2s;
            outline: none;
        }
        .bot-btn-primary {
            background-color: var(--g-blue);
            color: #ffffff;
            border-color: transparent;
        }
        .bot-btn-primary:hover {
            background-color: var(--g-blue-hover);
            box-shadow: 0 1px 3px rgba(60,64,67,0.3);
        }
        .bot-btn-secondary {
            background-color: #ffffff;
            color: var(--g-blue);
        }
        .bot-btn-secondary:hover {
            background-color: #f8f9fa;
            border-color: var(--g-blue);
        }

        /* Search inputs inside tabs */
        .bot-search-bar {
            display: flex;
            align-items: center;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 6px 12px;
            margin-bottom: 16px;
            gap: 8px;
        }
        .bot-search-bar svg {
            width: 18px;
            height: 18px;
            color: var(--text-secondary);
        }
        .bot-search-bar input {
            border: none;
            outline: none;
            width: 100%;
            font-size: 14px;
        }

        /* Tables & Lists style (Questions & History) */
        .bot-list-container {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 8px;
        }
        .bot-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .bot-table th {
            position: sticky;
            top: 0;
            background-color: #f1f3f4;
            padding: 12px 16px;
            font-weight: 500;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
            z-index: 1;
        }
        .bot-table td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            vertical-align: middle;
        }
        .bot-table tr:hover {
            background-color: #f8f9fa;
        }

        /* Editable cells */
        .bot-editable-input {
            width: 100%;
            border: 1px solid transparent;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 13px;
            background: transparent;
            transition: border-color 0.2s, background-color 0.2s;
        }
        .bot-editable-input:focus {
            border-color: var(--g-blue);
            background-color: #ffffff;
            outline: none;
        }

        /* Badges */
        .bot-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            text-transform: capitalize;
        }
        .bot-badge-submitted { background-color: #e6f4ea; color: var(--g-green); }
        .bot-badge-failed { background-color: #fce8e6; color: var(--g-red); }
        .bot-badge-external { background-color: #e8f0fe; color: var(--g-blue); }
        .bot-badge-easy { background-color: #fef7e0; color: #b06000; }

        /* Notification Toast */
        #bot-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: #323232;
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-family: var(--font-family);
            box-shadow: 0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14);
            z-index: 2147483647;
            transition: transform 0.3s cubic-bezier(0, 0, 0.2, 1);
            pointer-events: none;
        }
        #bot-toast.show {
            transform: translateX(-50%) translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Create FAB
    const fab = document.createElement('button');
    fab.id = 'bot-fab';
    fab.title = 'Job Bot Dashboard';
    fab.innerHTML = `
        <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="9" rx="1"/>
            <rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/>
            <rect x="3" y="16" width="7" height="5" rx="1"/>
        </svg>
    `;
    document.body.appendChild(fab);

    // Create Overlay & Main Panel HTML
    const overlay = document.createElement('div');
    overlay.id = 'bot-overlay';
    overlay.innerHTML = `
        <div id="bot-panel">
            <div class="bot-header">
                <div class="bot-title-group">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    <h2 class="bot-title">Auto Job Applier Dashboard</h2>
                </div>
                <button class="bot-close-btn" id="bot-close-btn" title="Minimize">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            
            <div class="bot-tabs">
                <div class="bot-tab active" data-tab="personals-tab">User Information</div>
                <div class="bot-tab" data-tab="questions-tab">Question Cache</div>
                <div class="bot-tab" data-tab="history-tab">Application History</div>
            </div>

            <div class="bot-content-area">
                <!-- Tab 1: User Info -->
                <div class="bot-tab-content active" id="personals-tab">
                    <div class="bot-grid-form" id="personals-form">
                        <!-- Filled dynamically -->
                    </div>
                </div>

                <!-- Tab 2: Question Cache -->
                <div class="bot-tab-content" id="questions-tab">
                    <div class="bot-search-bar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="q-search" placeholder="Search questions by text or company name...">
                    </div>
                    <div class="bot-list-container">
                        <table class="bot-table">
                            <thead>
                                <tr>
                                    <th style="width: 45%;">Question Label</th>
                                    <th style="width: 15%;">Type</th>
                                    <th style="width: 30%;">Saved Answer</th>
                                    <th style="width: 10%;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="q-table-body">
                                <!-- Filled dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Tab 3: Application History -->
                <div class="bot-tab-content" id="history-tab">
                    <div class="bot-search-bar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="h-search" placeholder="Search applications by title or company...">
                    </div>
                    <div class="bot-list-container">
                        <table class="bot-table">
                            <thead>
                                <tr>
                                    <th style="width: 30%;">Job Details</th>
                                    <th style="width: 20%;">Company</th>
                                    <th style="width: 15%;">Type & Status</th>
                                    <th style="width: 25%;">Log Details / Error</th>
                                    <th style="width: 10%;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="h-table-body">
                                <!-- Filled dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="bot-footer">
                <button class="bot-btn bot-btn-secondary" id="bot-btn-cancel">Discard Changes</button>
                <button class="bot-btn bot-btn-primary" id="bot-btn-save">Save & Apply</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Create Toast Container
    const toast = document.createElement('div');
    toast.id = 'bot-toast';
    document.body.appendChild(toast);

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Toggle panel visibility
    fab.addEventListener('click', () => {
        overlay.classList.add('active');
        renderAll();
    });

    const closePanel = () => {
        overlay.classList.remove('active');
    };
    
    document.getElementById('bot-close-btn').addEventListener('click', closePanel);
    document.getElementById('bot-btn-cancel').addEventListener('click', () => {
        closePanel();
        showToast('Changes discarded.');
    });

    // Tab Switching
    const tabs = overlay.querySelectorAll('.bot-tab');
    const contents = overlay.querySelectorAll('.bot-tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // Render User Info Tab
    function renderPersonals() {
        const form = document.getElementById('personals-form');
        form.innerHTML = '';
        
        const fields = [
            { key: 'first_name', label: 'First Name', type: 'text' },
            { key: 'middle_name', label: 'Middle Name', type: 'text' },
            { key: 'last_name', label: 'Last Name', type: 'text' },
            { key: 'phone_number', label: 'Phone Number', type: 'text' },
            { key: 'current_city', label: 'Current City', type: 'text' },
            { key: 'street', label: 'Street Address', type: 'text' },
            { key: 'state', label: 'State', type: 'text' },
            { key: 'zipcode', label: 'Zip/Postal Code', type: 'text' },
            { key: 'country', label: 'Country', type: 'text' },
            { key: 'ethnicity', label: 'Ethnicity/Race', type: 'select', options: ["Decline", "Hispanic/Latino", "American Indian or Alaska Native", "Asian", "Black or African American", "Native Hawaiian or Other Pacific Islander", "White", "Other"] },
            { key: 'gender', label: 'Gender', type: 'select', options: ["Male", "Female", "Other", "Decline"] },
            { key: 'gender_identity', label: 'Gender Identity', type: 'text' },
            { key: 'disability_status', label: 'Disability Status', type: 'select', options: ["Yes", "No", "Decline"] },
            { key: 'veteran_status', label: 'Veteran Status', type: 'select', options: ["Yes", "No", "Decline"] }
        ];

        fields.forEach(field => {
            const val = personals[field.key] !== undefined ? personals[field.key] : '';
            const group = document.createElement('div');
            group.className = 'bot-form-group';
            
            let inputHtml = '';
            if (field.type === 'select') {
                const optionsHtml = field.options.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select id="bot-p-${field.key}">${optionsHtml}</select>`;
            } else {
                inputHtml = `<input type="text" id="bot-p-${field.key}" value="${val}">`;
            }

            group.innerHTML = `<label for="bot-p-${field.key}">${field.label}</label>${inputHtml}`;
            form.appendChild(group);
        });
    }

    // Render Question Cache Tab
    let activeQuestions = [...(questionCache.questions || [])];
    function renderQuestions() {
        const body = document.getElementById('q-table-body');
        body.innerHTML = '';

        const filterVal = document.getElementById('q-search').value.toLowerCase();
        
        const filtered = activeQuestions.filter(q => {
            const labelMatch = (q.label || '').toLowerCase().includes(filterVal);
            const ansMatch = (q.answer || '').toLowerCase().includes(filterVal);
            const compMatch = (q.companies || []).some(c => c.toLowerCase().includes(filterVal));
            return labelMatch || ansMatch || compMatch;
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 20px;">No questions found matching your search.</td></tr>`;
            return;
        }

        filtered.forEach((q, idx) => {
            const tr = document.createElement('tr');
            
            // Render option selector if dropdown or yes/no options exist
            let answerCell = '';
            if (q.options && q.options.length > 0) {
                const optsHtml = q.options.map(opt => `<option value="${opt}" ${opt === q.answer ? 'selected' : ''}>${opt}</option>`).join('');
                answerCell = `<select class="bot-editable-input" data-id="${q.id}" style="border: 1px solid var(--border-color);">${optsHtml}</select>`;
            } else {
                answerCell = `<input type="text" class="bot-editable-input" data-id="${q.id}" value="${q.answer || ''}">`;
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500; margin-bottom: 4px;">${q.label}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">Companies: ${(q.companies || []).join(', ') || 'N/A'}</div>
                </td>
                <td><span class="bot-badge bot-badge-easy">${q.field_type}</span></td>
                <td>${answerCell}</td>
                <td>
                    <button class="bot-btn bot-btn-secondary delete-q-btn" data-id="${q.id}" style="padding: 6px 12px; font-size: 11px; border-color: var(--g-red); color: var(--g-red);">Delete</button>
                </td>
            `;

            // Setup listeners
            const input = tr.querySelector('.bot-editable-input');
            input.addEventListener('change', (e) => {
                const targetQ = activeQuestions.find(item => item.id === q.id);
                if (targetQ) targetQ.answer = e.target.value;
            });

            tr.querySelector('.delete-q-btn').addEventListener('click', () => {
                activeQuestions = activeQuestions.filter(item => item.id !== q.id);
                renderQuestions();
            });

            body.appendChild(tr);
        });
    }

    document.getElementById('q-search').addEventListener('input', renderQuestions);

    // Render Applications History Tab
    let activeApps = [...appHistory];
    function renderHistory() {
        const body = document.getElementById('h-table-body');
        body.innerHTML = '';

        const filterVal = document.getElementById('h-search').value.toLowerCase();

        const filtered = activeApps.filter(app => {
            const titleMatch = (app.title || '').toLowerCase().includes(filterVal);
            const compMatch = (app.company || '').toLowerCase().includes(filterVal);
            const errMatch = (app.error || '').toLowerCase().includes(filterVal);
            return titleMatch || compMatch || errMatch;
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">No applications found matching your search.</td></tr>`;
            return;
        }

        filtered.forEach((app, index) => {
            const tr = document.createElement('tr');
            
            const dateStr = app.logged_at ? app.logged_at.replace('T', ' ') : 'N/A';
            const statusClass = app.status === 'submitted' ? 'bot-badge-submitted' : 'bot-badge-failed';
            const typeClass = app.application_type === 'easy_apply' ? 'bot-badge-easy' : 'bot-badge-external';

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500;"><a href="${app.job_link}" target="_blank" style="color: var(--g-blue); text-decoration: none;">${app.title}</a></div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Applied: ${dateStr}</div>
                </td>
                <td><span style="font-weight: 500;">${app.company}</span></td>
                <td>
                    <span class="bot-badge ${typeClass}" style="margin-right: 4px;">${app.application_type}</span>
                    <span class="bot-badge ${statusClass}">${app.status}</span>
                </td>
                <td>
                    <div style="max-height: 50px; overflow-y: auto; font-family: monospace; font-size: 11px; color: #555; white-space: pre-wrap;">${app.error || app.external_application_link || 'Successfully processed'}</div>
                </td>
                <td>
                    <button class="bot-btn bot-btn-secondary delete-app-btn" data-index="${index}" style="padding: 6px 12px; font-size: 11px; border-color: var(--g-red); color: var(--g-red);">Delete</button>
                </td>
            `;

            tr.querySelector('.delete-app-btn').addEventListener('click', () => {
                // Remove from active apps
                const realIndex = activeApps.indexOf(app);
                if (realIndex > -1) {
                    activeApps.splice(realIndex, 1);
                }
                renderHistory();
            });

            body.appendChild(tr);
        });
    }

    document.getElementById('h-search').addEventListener('input', renderHistory);

    // Main Render All Function
    function renderAll() {
        renderPersonals();
        renderQuestions();
        renderHistory();
    }

    // Save Action
    document.getElementById('bot-btn-save').addEventListener('click', () => {
        // Collect personals updates
        const fields = ['first_name', 'middle_name', 'last_name', 'phone_number', 'current_city', 'street', 'state', 'zipcode', 'country', 'ethnicity', 'gender', 'gender_identity', 'disability_status', 'veteran_status'];
        fields.forEach(field => {
            const input = document.getElementById(`bot-p-${field}`);
            if (input) {
                personals[field] = input.value;
            }
        });

        // Set global variables back to windows state
        window.botPersonalsData = personals;
        questionCache.questions = activeQuestions;
        window.botQuestionCacheData = questionCache;
        window.botAppHistoryData = activeApps;

        // Set save requests for Python to pick up sequentially
        // To handle saving multiple files, we trigger them one by one or as a batch.
        // Let's pass a batch object!
        window.botSaveRequest = {
            batch: true,
            personals: personals,
            questions: questionCache,
            applications: activeApps
        };

        closePanel();
        showToast('Changes saved! Bot is syncing settings...');
    });

})();
