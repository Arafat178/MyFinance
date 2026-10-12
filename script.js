// ==========================================
// API Configuration - তোমার URL এখানে বসাও
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbzm8momDYiD2RS16HYH4Y-uI04rpwLNhg04H0hz-u2_dmTxKzkmypdm1G7S2s__OT7PcQ/exec";

let currentPin = "";
let formOptions = null;
let analyticsOffset = 0; 
let transactionsData = [];
let currentTx = null;
let isBalanceHidden = localStorage.getItem('hideBalance') === 'true';
let rawTotalBalance = 0;

// FORCE DEFAULT BENGAL DARK MODE
let savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || !savedTheme) {
  document.body.classList.add('dark-mode');
}

window.onload = function() {
  if(typeof google !== 'undefined' && google.charts) {
    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(() => {
      window.addEventListener('resize', () => {
        if (!document.getElementById('view-analytics').classList.contains('hidden') && transactionsData.length) {
          drawCharts(window.currentAnalyticsData);
        }
      });
    });
  }
};

// --- API Helper ---
async function apiCall(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, payload: payload }),
      redirect: "follow"
    });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "Network Error. Check connection." };
  }
}

// --- UTILS ---
function showToast(msg) { 
  const t = document.getElementById('toast'); 
  t.innerText = msg; 
  t.classList.add('show'); 
  setTimeout(() => t.classList.remove('show'), 3000); 
}
function toggleLoader(show) { 
  document.getElementById('loader').classList.toggle('hidden', !show); 
}
function escapeHTML(str) { 
  if(!str) return ''; 
  return str.toString().replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag]||tag)); 
}
function formatMoney(amount) {
  return `৳ ${parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// --- PIN AUTHENTICATION ---
function enterPin(num) { 
  if (currentPin.length < 6) { 
    currentPin += num; 
    updatePinUI(); 
    if (currentPin.length === 6) validatePin(); 
  } 
}
function clearPin() { currentPin = ""; updatePinUI(); }
function backspacePin() { currentPin = currentPin.slice(0, -1); updatePinUI(); }
function updatePinUI() { 
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('filled', i < currentPin.length)); 
}

async function validatePin() {
  toggleLoader(true);
  let res = await apiCall('verifyPin', { pin: currentPin });
  toggleLoader(false);
  if (res.success) {
    document.getElementById('pin-screen').classList.remove('active');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('active');
    loadDashboard(); 
    loadFormOptions();
  } else { 
    showToast("Incorrect PIN"); 
    clearPin(); 
  }
}

// --- DASHBOARD ---
function toggleBalanceMask() {
  isBalanceHidden = !isBalanceHidden;
  localStorage.setItem('hideBalance', isBalanceHidden);
  updateBalanceDisplay();
}

function updateBalanceDisplay() {
  const el = document.getElementById('dash-total-balance');
  const eye = document.getElementById('eye-icon');
  if(isBalanceHidden) {
    el.innerText = '৳ ••••••';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    el.innerText = formatMoney(rawTotalBalance);
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}

function getTxIcon(type, categoryStr) {
  if(type.includes('Transfer')) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`;
  
  const emojiMatch = categoryStr.match(/\p{Emoji}/u);
  if(emojiMatch) return emojiMatch[0];
  
  if(type === 'Income') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`;
}

async function loadDashboard() {
  toggleLoader(true);
  const hr = new Date().getHours();
  document.getElementById('greeting').innerText = hr < 12 ? 'Good morning' : (hr < 18 ? 'Good afternoon' : 'Good evening');
  document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' });

  let res = await apiCall('getDashboardData');
  toggleLoader(false);
  if (res.success) {
    const d = res.data;
    rawTotalBalance = d.totalBalance;
    updateBalanceDisplay();
    
    document.getElementById('dash-month-inc').innerText = formatMoney(d.thisMonthIncome);
    document.getElementById('dash-month-exp').innerText = formatMoney(d.thisMonthExpense);
    
    let sav = d.thisMonthIncome - d.thisMonthExpense;
    let rate = d.thisMonthIncome > 0 ? ((sav / d.thisMonthIncome) * 100).toFixed(1) + "%" : "0%";
    document.getElementById('dash-month-sav').innerText = formatMoney(sav);
    document.getElementById('dash-month-rate').innerText = rate;
    
    let pct = d.budget > 0 ? Math.min((d.thisMonthExpense / d.budget) * 100, 100) : 0;
    let realPct = d.budget > 0 ? ((d.thisMonthExpense / d.budget) * 100).toFixed(1) : 0;
    
    const bText = document.getElementById('dash-budget-text');
    const bBar = document.getElementById('dash-budget-bar');
    
    if(d.thisMonthExpense > d.budget && d.budget > 0) {
      bBar.classList.add('over');
      bText.innerHTML = `<span class="text-red">Budget Exceeded!</span>`;
    } else {
      bBar.classList.remove('over');
      bText.innerHTML = `Budget: ${realPct}% used`;
    }
    bBar.style.width = pct + "%";
    document.getElementById('dash-budget-amount').innerText = `৳${d.thisMonthExpense.toLocaleString()} / ৳${d.budget.toLocaleString()}`;

    document.getElementById('account-list').innerHTML = Object.values(d.accounts).map(a => `
      <div class="account-card">
        <small>${escapeHTML(a.name)}</small>
        <h3>${formatMoney(a.balance)}</h3>
      </div>`).join('');
    
    document.getElementById('recent-transactions').innerHTML = d.recentTransactions.map(tx => {
      let isIncome = tx.type === 'Income';
      let isTrf = tx.type.includes('Transfer');
      let colorClass = isIncome ? 'text-green' : (isTrf ? 'text-muted' : 'text-main');
      let prefix = isIncome ? '+' : (isTrf ? '' : '-');
      let cleanCat = tx.category.replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
      if(!cleanCat) cleanCat = tx.type;
      
      return `
      <div class="tx-item" onclick='viewDetails(${JSON.stringify(tx).replace(/'/g, "&apos;")})'>
        <div class="tx-left">
          <div class="tx-icon-wrapper ${isIncome ? 'text-green' : (isTrf?'text-muted':'text-red')}">${getTxIcon(tx.type, tx.category)}</div>
          <div class="tx-details">
            <h4>${escapeHTML(isTrf ? 'Transfer' : cleanCat)}</h4>
            <p>${escapeHTML(tx.account)} • ${escapeHTML(tx.time)}</p>
          </div>
        </div>
        <div class="tx-right">
          <h4 class="${colorClass}">${prefix}${formatMoney(tx.amount)}</h4>
          <p>${escapeHTML(tx.date)}</p>
        </div>
      </div>`;
    }).join('');
  }
}

// --- ADD / EDIT TRANSACTION ---
async function loadFormOptions() { 
  let res = await apiCall('getFormOptions');
  if(res.success) {
    formOptions = res.data; 
    document.getElementById('filter-acc').innerHTML = '<option value="All">All Accounts</option>' + formOptions.accounts.map(a => `<option value="${a.name}">${escapeHTML(a.name)}</option>`).join('');
    let allCats = [...formOptions.categories.Expense, ...formOptions.categories.Income];
    document.getElementById('filter-cat').innerHTML = '<option value="All">All Categories</option>' + allCats.map(c => `<option value="${c.name}">${escapeHTML(c.name)}</option>`).join('');
  }
}

function openAddModal(defaultType = 'Expense') { 
  document.getElementById('form-modal-title').innerText = "Add Transaction";
  document.getElementById('tx-id').value = "";
  document.getElementById('tx-form').reset();
  
  let now = new Date();
  document.getElementById('tx-date').value = now.toLocaleDateString('en-CA');
  document.getElementById('tx-time').value = now.toTimeString().substring(0,5);
  
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('disabled'));
  document.getElementById('add-modal').classList.add('active'); 
  if(formOptions) switchTxTab(defaultType); 
}

function closeAddModal() { 
  document.getElementById('add-modal').classList.remove('active'); 
}

function switchTxTab(type) {
  document.getElementById('tx-type').value = type;
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.toggle('active', t.innerText === type));
  
  const isTrf = type === 'Transfer';
  document.getElementById('cat-group').classList.toggle('hidden', isTrf);
  document.getElementById('to-acc-group').classList.toggle('hidden', !isTrf);
  document.getElementById('acc-label').innerText = isTrf ? "From Account" : "Account";
  
  document.getElementById('tx-account').innerHTML = formOptions.accounts.map(a => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');
  if (isTrf) {
    document.getElementById('tx-to-account').innerHTML = formOptions.accounts.map(a => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');
    document.getElementById('tx-category').removeAttribute('required');
    document.getElementById('tx-to-account').setAttribute('required', 'true');
  } else {
    document.getElementById('tx-category').innerHTML = (formOptions.categories[type] || []).map(c => `<option value="${c.name}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');
    document.getElementById('tx-to-account').removeAttribute('required');
    document.getElementById('tx-category').setAttribute('required', 'true');
  }
}

async function submitTransaction(e) {
  e.preventDefault();
  if(!navigator.onLine) { showToast("You're offline!"); return; }
  
  const btn = document.getElementById('btn-save-tx');
  btn.disabled = true;
  btn.innerText = "Saving...";

  const p = { 
    id: document.getElementById('tx-id').value,
    type: document.getElementById('tx-type').value, 
    amount: parseFloat(document.getElementById('tx-amount').value), 
    desc: document.getElementById('tx-desc').value,
    date: document.getElementById('tx-date').value,
    time: document.getElementById('tx-time').value
  };

  if (p.type === 'Transfer') {
    p.fromAccount = document.getElementById('tx-account').value; 
    p.toAccount = document.getElementById('tx-to-account').value;
    if(p.fromAccount === p.toAccount) {
      showToast("Invalid transfer: Same account");
      btn.disabled = false; btn.innerText = "Save Transaction";
      return;
    }
  } else {
    p.category = document.getElementById('tx-category').value; 
    p.account = document.getElementById('tx-account').value;
  }
  
  toggleLoader(true);
  let action = p.id ? 'editTransaction' : 'addTransaction';
  let res = await apiCall(action, p);
  
  toggleLoader(false); 
  btn.disabled = false; 
  btn.innerText = "Save Transaction";
  
  showToast(res.message); 
  if(res.success) { 
    closeAddModal(); 
    loadDashboard(); 
    if(!document.getElementById('view-transactions').classList.contains('hidden')) loadTransactions(); 
  }
}

// --- DETAILS, EDIT & DELETE ---
function viewDetails(tx) {
  currentTx = tx;
  let isIncome = tx.type === 'Income';
  let isTrf = tx.type.includes('Transfer');
  let typeColor = isIncome ? 'text-green' : (isTrf ? 'text-muted' : 'text-red');
  let prefix = isIncome ? '+' : (isTrf ? '' : '-');
  
  let html = `
    <div style="text-align:center; margin-bottom:24px;">
      <p class="text-muted" style="margin-bottom:4px; text-transform:uppercase; font-size:12px; font-weight:700; letter-spacing: 0.5px;">${escapeHTML(tx.type)}</p>
      <h2 class="${typeColor}" style="font-size:36px; font-weight:800; letter-spacing: -1px;">${prefix}${formatMoney(tx.amount)}</h2>
    </div>
    <div class="card" style="margin:0; box-shadow:none; background: var(--bg); border: none;">
      <div class="flex justify-between" style="padding:12px 0; border-bottom:1px solid var(--border);">
        <span class="text-muted font-semibold">Date</span><span class="font-bold">${escapeHTML(tx.date)} at ${escapeHTML(tx.time)}</span>
      </div>
      ${isTrf ? `
      <div class="flex justify-between" style="padding:12px 0; border-bottom:1px solid var(--border);">
        <span class="text-muted font-semibold">From/To</span><span class="font-bold">${escapeHTML(tx.account)}</span>
      </div>
      <div class="flex justify-between" style="padding:12px 0; border-bottom:1px solid var(--border);">
        <span class="text-muted font-semibold">Ref ID</span><span class="font-bold" style="font-size:11px;">${escapeHTML(tx.linkedId)}</span>
      </div>` : `
      <div class="flex justify-between" style="padding:12px 0; border-bottom:1px solid var(--border);">
        <span class="text-muted font-semibold">Category</span><span class="font-bold">${escapeHTML(tx.category)}</span>
      </div>
      <div class="flex justify-between" style="padding:12px 0; border-bottom:1px solid var(--border);">
        <span class="text-muted font-semibold">Account</span><span class="font-bold">${escapeHTML(tx.account)}</span>
      </div>`}
      <div class="flex justify-between" style="padding:12px 0; flex-direction:column; gap:6px;">
        <span class="text-muted font-semibold">Description</span>
        <span class="font-bold">${escapeHTML(tx.desc || '—')}</span>
      </div>
    </div>
  `;
  document.getElementById('details-content').innerHTML = html;
  document.getElementById('details-modal').classList.add('active');
}

function closeDetailsModal() { document.getElementById('details-modal').classList.remove('active'); }

function openEditTransaction() {
  closeDetailsModal();
  document.getElementById('form-modal-title').innerText = "Edit Transaction";
  document.getElementById('tx-id').value = currentTx.id;
  document.getElementById('add-modal').classList.add('active');
  
  let baseType = currentTx.type.includes('Transfer') ? 'Transfer' : currentTx.type;
  switchTxTab(baseType);
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.add('disabled'));
  
  document.getElementById('tx-amount').value = currentTx.amount;
  document.getElementById('tx-date').value = currentTx.date;
  
  let parsedTime = currentTx.time.match(/(\d+):(\d+) (\w+)/);
  if(parsedTime) {
    let h = parseInt(parsedTime[1]); if(parsedTime[3]==='PM' && h<12) h+=12; if(parsedTime[3]==='AM' && h===12) h=0;
    document.getElementById('tx-time').value = `${h.toString().padStart(2,'0')}:${parsedTime[2]}`;
  } else { document.getElementById('tx-time').value = currentTx.time; }
  
  document.getElementById('tx-desc').value = currentTx.desc;

  if (baseType === 'Transfer') {
     document.getElementById('tx-account').value = currentTx.accountId;
  } else {
     document.getElementById('tx-account').value = currentTx.accountId;
     document.getElementById('tx-category').value = currentTx.category;
  }
}

async function confirmDelete() {
  if(!confirm("Are you sure you want to delete this transaction?")) return;
  closeDetailsModal();
  toggleLoader(true);
  let res = await apiCall('deleteTransaction', { id: currentTx.id, linkedId: currentTx.linkedId });
  toggleLoader(false); 
  showToast(res.message);
  if(res.success) { 
    loadDashboard(); 
    if(!document.getElementById('view-transactions').classList.contains('hidden')) loadTransactions(); 
  }
}

// --- HISTORY & FILTERS ---
async function loadTransactions() {
  toggleLoader(true);
  let res = await apiCall('getTransactions');
  toggleLoader(false);
  if (res.success) { transactionsData = res.data; filterTransactions(); }
}

function toggleCustomDate() {
  let show = document.getElementById('filter-date').value === 'Custom';
  document.getElementById('custom-date-group').classList.toggle('hidden', !show);
}

function clearFilters() {
  document.getElementById('search-tx').value = '';
  document.getElementById('filter-type').value = 'All';
  document.getElementById('filter-date').value = 'All';
  document.getElementById('filter-cat').value = 'All';
  document.getElementById('filter-acc').value = 'All';
  toggleCustomDate(); 
  filterTransactions();
}

function filterTransactions() {
  const q = document.getElementById('search-tx').value.toLowerCase();
  const type = document.getElementById('filter-type').value;
  const cat = document.getElementById('filter-cat').value;
  const acc = document.getElementById('filter-acc').value;
  const dateRange = document.getElementById('filter-date').value;
  
  let now = new Date();
  let todayStr = now.toLocaleDateString('en-CA');
  
  let filtered = transactionsData.filter(tx => {
    let descStr = (tx.desc || '').toLowerCase();
    let catStr = (tx.category || '').toLowerCase();
    
    if (q && !descStr.includes(q) && !catStr.includes(q)) return false;
    if (type !== 'All') { 
      if (type === 'Transfer' && !tx.type.includes('Transfer')) return false; 
      else if (type !== 'Transfer' && tx.type !== type) return false; 
    }
    if (cat !== 'All' && tx.category !== cat) return false;
    if (acc !== 'All' && tx.account !== acc) return false;
    
    if (dateRange === 'Today' && tx.date !== todayStr) return false;
    if (dateRange === 'Month' && tx.date.substring(0,7) !== todayStr.substring(0,7)) return false;
    if (dateRange === 'Custom') {
      let s = document.getElementById('filter-start').value; let e = document.getElementById('filter-end').value;
      if (s && tx.date < s) return false; if (e && tx.date > e) return false;
    }
    return true;
  });

  document.getElementById('tx-count').innerText = `${filtered.length} txns`;
  let html = filtered.length ? filtered.map(tx => {
    let isIncome = tx.type === 'Income';
    let isTrf = tx.type.includes('Transfer');
    let colorClass = isIncome ? 'text-green' : (isTrf ? 'text-muted' : 'text-main');
    let prefix = isIncome ? '+' : (isTrf ? '' : '-');
    let cleanCat = tx.category.replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    if(!cleanCat) cleanCat = tx.type;

    return `
    <div class="tx-item" onclick='viewDetails(${JSON.stringify(tx).replace(/'/g, "&apos;")})'>
      <div class="tx-left">
        <div class="tx-icon-wrapper ${isIncome ? 'text-green' : (isTrf?'text-muted':'text-red')}">${getTxIcon(tx.type, tx.category)}</div>
        <div class="tx-details">
          <h4>${escapeHTML(isTrf ? 'Transfer' : cleanCat)}</h4>
          <p>${escapeHTML(tx.desc||tx.type)}</p>
        </div>
      </div>
      <div class="tx-right">
        <h4 class="${colorClass}">${prefix}${formatMoney(tx.amount)}</h4>
        <p>${escapeHTML(tx.account)} • ${escapeHTML(tx.date)}</p>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center; padding:50px 20px; color:var(--text-muted); font-weight:600;">No transactions match criteria.</div>';
  
  document.getElementById('full-tx-list').innerHTML = html;
}

// --- ANALYTICS ENGINE ---
function resetOffsetAndLoad() { analyticsOffset = 0; loadAnalytics(); }
function changeOffset(step) { 
  if (document.getElementById('timeframe-filter').value === 'All') {
    return showToast("Offset not available for All Time"); 
  }
  analyticsOffset += step; 
  loadAnalytics(); 
}

async function loadAnalytics() {
  toggleLoader(true);
  const timeframe = document.getElementById('timeframe-filter').value;
  
  let res = await apiCall('getAnalyticsData', { timeframe: timeframe, offset: analyticsOffset });
  toggleLoader(false);
  if (res.success) {
    window.currentAnalyticsData = res.data;
    document.getElementById('analytics-period').innerText = res.data.label;
    document.getElementById('insights-list').innerHTML = res.data.insights.map(i => `<li>${escapeHTML(i)}</li>`).join('');
    
    let topHtml = "";
    res.data.topExpenses.forEach((t, i) => {
      topHtml += `
        <div class="flex justify-between items-center" style="padding:16px 0; border-bottom:1px solid var(--border);">
          <div><strong class="text-muted" style="margin-right:10px; font-size:16px;">#${i+1}</strong> <span class="font-bold" style="font-size:15px;">${escapeHTML(t.cat)}</span> <small style="display:block;color:var(--text-muted);margin-top:6px; font-weight:600;">${escapeHTML(t.desc)}</small></div>
          <strong class="text-red" style="font-size:16px;">-${formatMoney(t.amount)}</strong>
        </div>`;
    });
    document.getElementById('top-expenses-list').innerHTML = topHtml || "<div style='color:var(--text-muted); padding:15px 0; font-weight:600;'>No data found</div>";
    drawCharts(res.data);
  }
}

// --- MATCHED COLORS FOR LAL-SOBUJ BENGAL THEME ---
function drawCharts(data) {
  if(typeof google === 'undefined' || !google.visualization || !data) return;
  const isDark = document.body.classList.contains('dark-mode');
  const txtColor = isDark ? '#8AA396' : '#64748B';
  const gridColor = isDark ? 'rgba(0,137,85,0.08)' : '#D1E0D8';
  const bg = 'transparent';
  const fontFamily = "'Inter', sans-serif";

  const commonOptions = {
    backgroundColor: bg,
    fontName: fontFamily,
    hAxis: { textStyle: { color: txtColor, bold: true }, gridlines: { color: gridColor }, baselineColor: gridColor },
    vAxis: { textStyle: { color: txtColor, bold: true }, gridlines: { color: gridColor }, baselineColor: gridColor },
    legend: { textStyle: { color: txtColor, bold: true } },
    chartArea: { width: '85%', height: '75%' },
    animation: { startup: true, duration: 600, easing: 'out' }
  };

  let barData = google.visualization.arrayToDataTable([ ['Type', 'Amount', { role: 'style' }], ['Income', data.income, 'color: #008955'], ['Expense', data.expense, 'color: #E82540'] ]);
  new google.visualization.BarChart(document.getElementById('bar-chart')).draw(barData, Object.assign({}, commonOptions, { legend: 'none', chartArea: { width: '80%', height: '70%' }}));

  let donutData = new google.visualization.DataTable(); donutData.addColumn('string', 'Category'); donutData.addColumn('number', 'Amount'); donutData.addRows(data.categories.length ? data.categories : [['No Data', 0]]);
  new google.visualization.PieChart(document.getElementById('donut-chart')).draw(donutData, Object.assign({}, commonOptions, { pieHole: 0.5, legend: { position: 'bottom', textStyle: { color: txtColor, bold: true } }, chartArea: { width: '90%', height: '80%' } }));

  let lineData = new google.visualization.DataTable(); lineData.addColumn('string', 'Day'); lineData.addColumn('number', 'Expense'); lineData.addRows(data.dailyTrend.length ? data.dailyTrend : [['N/A', 0]]);
  new google.visualization.AreaChart(document.getElementById('line-chart')).draw(lineData, Object.assign({}, commonOptions, { legend: 'none', colors:['#E82540'] }));

  let trendData = new google.visualization.DataTable(); trendData.addColumn('string', 'Month'); trendData.addColumn('number', 'Income'); trendData.addColumn('number', 'Expense'); trendData.addColumn('number', 'Savings'); trendData.addRows(data.trends.length ? data.trends : [['N/A',0,0,0]]);
  new google.visualization.ColumnChart(document.getElementById('trend-chart')).draw(trendData, Object.assign({}, commonOptions, { legend: 'bottom', colors:['#008955', '#E82540', '#FBBF24'] }));
  
  let catBarData = new google.visualization.DataTable(); catBarData.addColumn('string', 'Category'); catBarData.addColumn('number', 'Amount'); catBarData.addRows(data.categories.length ? data.categories : [['N/A', 0]]);
  new google.visualization.BarChart(document.getElementById('cat-bar-chart')).draw(catBarData, Object.assign({}, commonOptions, { legend: 'none', colors:['#00A667'] }));

  let accData = new google.visualization.DataTable(); accData.addColumn('string', 'Account'); accData.addColumn('number', 'Balance'); accData.addRows(data.accounts.length ? data.accounts : [['N/A', 0]]);
  new google.visualization.ColumnChart(document.getElementById('acc-chart')).draw(accData, Object.assign({}, commonOptions, { legend: 'none', colors:['#FBBF24'] }));
}

// --- ROUTING & SETTINGS ---
function navTo(page) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const target = document.getElementById(`view-${page}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  const tabs = { 'home': 1, 'transactions': 2, 'analytics': 4, 'more': 5 };
  if (tabs[page]) {
    const activeBtn = document.querySelector(`.bottom-nav > button:nth-child(${tabs[page]})`);
    if (activeBtn) activeBtn.classList.add('active');
  }
  
  if (page === 'home') loadDashboard();
  else if (page === 'transactions') loadTransactions();
  else if (page === 'analytics') resetOffsetAndLoad();
  
  window.scrollTo(0, 0);
}

function toggleDarkMode() { 
  document.body.classList.toggle('dark-mode'); 
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  showToast(isDark ? "Dark Mode Enabled" : "Light Mode Enabled"); 
  if (!document.getElementById('view-analytics').classList.contains('hidden') && window.currentAnalyticsData) {
    drawCharts(window.currentAnalyticsData);
  }
}

function logout() { 
  document.getElementById('app-shell').classList.remove('active'); 
  document.getElementById('app-shell').classList.add('hidden'); 
  document.getElementById('pin-screen').classList.add('active'); 
  navTo('home'); 
  clearPin(); 
  showToast("App Locked"); 
}