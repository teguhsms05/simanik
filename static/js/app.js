let vehicles = [];
let maintenanceRecords = [];
let taxRecords = [];
let tripLogs = [];
let currentView = 'grid';

// ---- THEME TOGGLE ----
function initTheme() {
    const savedTheme = localStorage.getItem('simanik-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (isDark) {
        document.documentElement.classList.add('dark-mode');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('simanik-theme', isDark ? 'dark' : 'light');
}

initTheme();

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

// ---- FETCH ----
async function fetchAll() {
    showLoading();
    try {
        const [vRes, mRes, tRes, trRes] = await Promise.all([
            fetch('/api/vehicles'), fetch('/api/maintenance'), fetch('/api/tax-records'), fetch('/api/trips')
        ]);
        vehicles = await vRes.json();
        maintenanceRecords = await mRes.json();
        taxRecords = await tRes.json();
        tripLogs = await trRes.json();
        renderAll();
    } catch (e) {
        console.error('Fetch error:', e);
        showToast('Gagal memuat data. Silakan refresh halaman.', 'error');
    } finally {
        hideLoading();
    }
}

// ---- HELPERS ----
function fmt(n) { return new Intl.NumberFormat('id-ID').format(n); }
function fmtRp(n) { return 'Rp ' + fmt(n); }
function daysBetween(dateStr) {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}
function taxBadge(days) {
    if (days < 0) return `<span class="badge badge--rose">Lewat ${Math.abs(days)} Hari</span>`;
    if (days <= 30) return `<span class="badge badge--amber">${days} Hari Lagi</span>`;
    return `<span class="badge badge--green">${days} Hari Lagi</span>`;
}
function statusBadge(status) {
    const m = {
        'Tersedia': 'badge--green',
        'Sedang Digunakan': 'badge--blue',
        'Dalam Perawatan': 'badge--amber',
        'Perawatan': 'badge--amber',
        'Non-Aktif': 'badge--slate'
    };
    return `<span class="badge ${m[status] || 'badge--slate'}">${status}</span>`;
}
function maintStatusBadge(v) {
    const status = getMaintStatus(v);
    const badgeMap = {
        'Sedang di Bengkel': 'badge--purple',
        'Segera Servis': 'badge--amber',
        'Kondisi Prima': 'badge--green'
    };
    return `<span class="badge ${badgeMap[status] || 'badge--slate'}">${status}</span>`;
}
function serviceProgress(v) {
    const range = v.next_service_odometer - v.last_service_odometer;
    if (range <= 0) return 100;
    const used = v.current_odometer - v.last_service_odometer;
    return Math.min(100, Math.max(0, Math.round((used / range) * 100)));
}
function getVehicle(id) { return vehicles.find(v => v.id === id); }
function getLastService(vehicleId) {
    const services = maintenanceRecords.filter(r => r.vehicle_id === vehicleId);
    if (services.length === 0) return null;
    return services.sort((a, b) => new Date(b.service_date) - new Date(a.service_date))[0];
}
function daysSinceService(vehicleId) {
    const lastService = getLastService(vehicleId);
    if (!lastService) return 999;
    const serviceDate = new Date(lastService.service_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    serviceDate.setHours(0, 0, 0, 0);
    return Math.ceil((today - serviceDate) / (1000 * 60 * 60 * 24));
}
function formatDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateTime(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ---- TOAST ----
let toastTimer;
function showToast(text, type) {
    const icon = document.getElementById('toast-icon');
    if (type === 'info') { icon.className = 'fa-solid fa-circle-info'; icon.style.color = '#60a5fa'; }
    else { icon.className = 'fa-solid fa-circle-check'; icon.style.color = '#34d399'; }
    document.getElementById('toast-text').textContent = text;
    document.getElementById('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
}
function hideToast() { document.getElementById('toast').classList.remove('show'); }

// ---- RENDER ALL ----
function renderAll() {
    renderHeroDate();
    renderDashboard();
    renderInventory();
    renderMaintenance();
    renderTax();
    renderTracking();
    updateNavBadges();
    populateModalSelects();
}

function renderHeroDate() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const now = new Date();
    document.getElementById('hero-date').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function updateNavBadges() {
    document.getElementById('nav-count-vehicles').textContent = vehicles.length;
    const needService = vehicles.filter(v => getMaintStatus(v) === 'Segera Servis' || v.status === 'Dalam Perawatan').length;
    document.getElementById('nav-count-maint').textContent = needService;
    const taxWarn = vehicles.filter(v => daysBetween(v.tax_due_date) <= 30 || daysBetween(v.stnk_due_date) <= 30).length;
    document.getElementById('nav-count-tax').textContent = taxWarn;
    const activeTrips = tripLogs.filter(t => t.status === 'Berjalan').length;
    document.getElementById('nav-count-trips').textContent = activeTrips + ' Jalan';
}

// ---- DASHBOARD ----
function renderDashboard() {
    const total = vehicles.length;
    const available = vehicles.filter(v => v.status === 'Tersedia').length;
    const used = vehicles.filter(v => v.status === 'Sedang Digunakan').length;
    const maint = vehicles.filter(v => v.status === 'Dalam Perawatan').length;
    const activeTrips = tripLogs.filter(t => t.status === 'Berjalan').length;

    let taxExpired = 0, taxSoon = 0;
    vehicles.forEach(v => {
        const d = daysBetween(v.tax_due_date);
        if (d < 0) taxExpired++;
        else if (d <= 30) taxSoon++;
    });
    const needService = vehicles.filter(v => getMaintStatus(v) === 'Segera Servis').length;

    document.getElementById('ds-total').textContent = total;
    document.getElementById('ds-available').textContent = available;
    document.getElementById('ds-used').textContent = used;
    document.getElementById('ds-maint').textContent = maint;
    document.getElementById('ds-tax-warn').textContent = taxExpired + taxSoon;
    document.getElementById('ds-tax-expired').textContent = taxExpired;
    document.getElementById('ds-tax-soon').textContent = taxSoon;
    document.getElementById('ds-need-service').textContent = needService;
    document.getElementById('ds-active-trips').textContent = activeTrips;
    document.getElementById('ds-trip-total').textContent = tripLogs.length;
    document.getElementById('inv-count').textContent = total;

    // Alert banner
    const urgentVehicles = vehicles.filter(v => daysBetween(v.tax_due_date) < 0 || getMaintStatus(v) === 'Segera Servis');
    const alertBanner = document.getElementById('alert-banner');
    if (urgentVehicles.length > 0) {
        alertBanner.style.display = 'flex';
        document.getElementById('alert-title').textContent = `Pemberitahuan Mendesak Inventaris (${urgentVehicles.length} Unit)`;
        let tags = '';
        urgentVehicles.forEach(v => {
            if (daysBetween(v.tax_due_date) < 0) tags += `<span class="alert__tag">${v.plate_number} (${v.model}) - Pajak Kadaluwarsa!</span>`;
            if (getMaintStatus(v) === 'Segera Servis') tags += `<span class="alert__tag alert__tag--amber">${v.plate_number} (${v.model}) - Perlu Servis!</span>`;
        });
        document.getElementById('alert-tags').innerHTML = tags;
    } else {
        alertBanner.style.display = 'none';
    }

    // Live trip
    const liveTrips = tripLogs.filter(t => t.status === 'Berjalan');
    const ltContent = document.getElementById('live-trip-content');
    if (liveTrips.length > 0) {
        ltContent.innerHTML = liveTrips.map(t => {
            const v = getVehicle(t.vehicle_id);
            return `<div class="live-trip-item">
                <div class="live-trip-item__icon"><i class="fa-solid fa-truck-fast"></i></div>
                <div class="grow">
                    <div class="flex flex-wrap" style="gap:8px;align-items:center;">
                        <span class="plate">${v ? v.plate_number : '?'}</span>
                        <span class="text-xs text-secondary">• ${v ? v.brand + ' ' + v.model : ''}</span>
                    </div>
                    <div class="text-xs text-secondary" style="margin-top:4px;"><strong>Driver:</strong> ${t.driver_name}</div>
                    <div class="text-xs text-muted"><strong>Tujuan:</strong> ${t.destination}</div>
                </div>
                <div style="text-align:right;">
                    <span class="badge badge--green"><span class="dot-live"></span> Sedang Berjalan</span>
                    <div class="text-xs text-muted" style="margin-top:4px;">KM Awal: ${fmt(t.start_odometer)} km</div>
                </div>
            </div>`;
        }).join('');
    } else {
        ltContent.innerHTML = `<div class="empty-state slide-up">
            <i class="fa-solid fa-route empty-state__icon"></i>
            <h3 class="empty-state__title">Tidak Ada Perjalanan Aktif</h3>
            <p class="empty-state__text">Semua kendaraan sedang tersedia di pool. Mulai perjalanan baru untuk melihat tracking real-time.</p>
            <button onclick="openModal('startTripModal')" class="btn btn--primary">
                <i class="fa-solid fa-plus"></i> Mulai Perjalanan Baru
            </button>
        </div>`;
    }

    // Costs
    const totalMaintCost = maintenanceRecords.reduce((s, r) => s + r.cost, 0);
    const totalTaxCost = taxRecords.reduce((s, r) => s + r.amount, 0);
    document.getElementById('cost-maint').textContent = fmtRp(totalMaintCost);
    document.getElementById('cost-tax').textContent = fmtRp(totalTaxCost);
    document.getElementById('cost-total').textContent = fmtRp(totalMaintCost + totalTaxCost);

    // Dashboard table
    const tbody = document.getElementById('dashboard-table-body');
    tbody.innerHTML = vehicles.map(v => {
        const taxDays = daysBetween(v.tax_due_date);
        return `<tr>
            <td><span class="plate" style="font-size:10px">${v.plate_number}</span><br><span class="text-xs text-muted">${v.brand} ${v.model}</span></td>
            <td>${v.category}</td>
            <td>${v.pool_location}</td>
            <td>${taxBadge(taxDays)}</td>
            <td>${statusBadge(v.status)}</td>
            <td class="text-right"><button onclick="openVehicleDetail('${v.id}')" class="link">Detail</button></td>
        </tr>`;
    }).join('');

    // Recent services
    const recentSrv = document.getElementById('recent-services');
    const recent = maintenanceRecords.slice(0, 3);
    if (recent.length === 0) {
        recentSrv.innerHTML = '<p class="text-xs text-muted" style="padding:16px 0;text-align:center;">Belum ada catatan servis.</p>';
    } else {
        recentSrv.innerHTML = recent.map(r => {
            const v = getVehicle(r.vehicle_id);
            return `<div class="recent-item">
                <div>
                    <div class="text-xs text-bold">${v ? v.plate_number : '?'} (${r.service_type})</div>
                    <div class="text-xs text-muted">${r.workshop_name} &nbsp; ${formatDate(r.service_date)}</div>
                </div>
                <div class="text-xs text-bold text-rose">${fmtRp(r.cost)}</div>
            </div>`;
        }).join('');
    }
}

// ---- INVENTORY ----
function renderInventory() {
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const cat = document.getElementById('inv-category')?.value || '';
    const status = document.getElementById('inv-status')?.value || '';
    const pool = document.getElementById('inv-pool')?.value || '';

    let filtered = vehicles.filter(v => {
        if (search && !`${v.plate_number} ${v.brand} ${v.model}`.toLowerCase().includes(search)) return false;
        if (cat && v.category !== cat) return false;
        if (status && v.status !== status) return false;
        if (pool && v.pool_location !== pool) return false;
        return true;
    });

    document.getElementById('inv-showing').textContent = filtered.length;
    document.getElementById('inv-total').textContent = vehicles.length;

    const poolSelect = document.getElementById('inv-pool');
    const pools = [...new Set(vehicles.map(v => v.pool_location))];
    const currentPool = poolSelect.value;
    poolSelect.innerHTML = '<option value="">Semua Pool / Garasi</option>' + pools.map(p => `<option value="${p}" ${p === currentPool ? 'selected' : ''}>${p}</option>`).join('');

    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = filtered.map(v => {
        const taxDays = daysBetween(v.tax_due_date);
        const pct = serviceProgress(v);
        const taxTagClass = taxDays < 0 ? 'tag--black' : taxDays <= 30 ? 'tag--amber' : 'tag--green';
        const maintTag = pct >= 95 ? 'tag--black' : 'tag--green';
        const maintLabel = getMaintStatus(v);
        const actionBtn = v.status === 'Sedang Digunakan' ? `<button onclick="switchTab('tracking')" class="btn btn--primary btn--xs"><i class="fa-solid fa-map-location-dot"></i> Pantau</button>`
            : v.status === 'Dalam Perawatan' ? `<button onclick="switchTab('maintenance')" class="btn btn--amber btn--xs"><i class="fa-solid fa-wrench"></i> Servis</button>`
                : `<button onclick="openStartTripFor('${v.id}')" class="btn btn--green btn--xs"><i class="fa-solid fa-route"></i> Jalan</button>`;

        return `<div class="vehicle-card slide-up" style="animation-delay: ${filtered.indexOf(v) * 0.05}s">
            <div class="vehicle-card__media">
                <img src="${v.image_url || '/assets/images/avanza_veloz.jpg'}" alt="${v.brand} ${v.model}" onerror="this.src='/assets/images/avanza_veloz.jpg'" class="vehicle-card__img" loading="lazy">
                <div class="vehicle-card__overlay"></div>
                <div class="vehicle-card__top">
                    <span class="plate plate--dark">${v.plate_number}</span>
                    ${statusBadge(v.status)}
                </div>
                <div class="vehicle-card__bottom">
                    <div class="vehicle-card__name">${v.brand} ${v.model}</div>
                    <div class="vehicle-card__meta"><span>Thn ${v.year}</span><span>•</span><span>${v.category}</span></div>
                </div>
            </div>
            <div class="vehicle-card__body">
                <div class="vehicle-card__tags">
                    <div class="vehicle-card__tag ${taxTagClass}">
                        <span class="tag-label"><i class="fa-solid fa-shield-halved"></i> PAJAK STNK</span>
                        <span class="tag-value">${taxDays < 0 ? 'Lewat ' + Math.abs(taxDays) + ' Hari' : taxDays + ' Hari Lagi'}</span>
                    </div>
                    <div class="vehicle-card__tag ${maintTag}">
                        <span class="tag-label"><i class="fa-solid fa-wrench"></i> PERAWATAN</span>
                        <span class="tag-value">${maintLabel}</span>
                    </div>
                </div>
                <div class="vehicle-card__details">
                    <div class="vehicle-card__detail"><span><i class="fa-solid fa-gauge"></i> Odometer:</span><span>${fmt(v.current_odometer)} km</span></div>
                    <div class="vehicle-card__detail"><span><i class="fa-solid fa-gas-pump"></i> Bahan Bakar:</span><span>${v.fuel_type}</span></div>
                    <div class="vehicle-card__detail"><span><i class="fa-solid fa-location-dot"></i> Lokasi Pool:</span><span>${v.pool_location}</span></div>
                </div>
                <div class="vehicle-card__actions">
                    <button onclick="openVehicleDetail('${v.id}')" class="btn btn--outline btn--xs"><i class="fa-solid fa-eye"></i> Detail</button>
                    <button onclick="openEditVehicle('${v.id}')" class="btn btn--edit btn--xs"><i class="fa-solid fa-pen"></i> Edit</button>
                    ${actionBtn}
                </div>
            </div>
        </div>`;
    }).join('');

    const tableDiv = document.getElementById('inventory-table');
    tableDiv.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table>
        <thead><tr><th>Plat &amp; Unit</th><th>Kategori</th><th>Tahun</th><th>Pool Lokasi</th><th>Odometer</th><th>Pajak</th><th>Status</th><th class="text-right">Aksi</th></tr></thead>
        <tbody>${filtered.map(v => `<tr>
            <td><span class="plate" style="font-size:10px">${v.plate_number}</span><br><span class="text-xs text-muted">${v.brand} ${v.model}</span></td>
            <td>${v.category}</td>
            <td>${v.year}</td>
            <td>${v.pool_location}</td>
            <td style="font-weight:600">${fmt(v.current_odometer)} km</td>
            <td>${taxBadge(daysBetween(v.tax_due_date))}</td>
            <td>${statusBadge(v.status)}</td>
            <td class="text-right" style="white-space:nowrap"><button onclick="openVehicleDetail('${v.id}')" class="link">Detail</button> &nbsp; <button onclick="openEditVehicle('${v.id}')" class="link" style="color:var(--indigo-600)">Edit</button></td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;
}

function setView(view) {
    currentView = view;
    document.getElementById('view-grid-btn').classList.toggle('active', view === 'grid');
    document.getElementById('view-table-btn').classList.toggle('active', view === 'table');
    document.getElementById('inventory-grid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('inventory-table').style.display = view === 'table' ? 'block' : 'none';
}

// ---- MAINTENANCE ----
function renderMaintenance() {
    const search = (document.getElementById('maint-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('maint-status-filter')?.value || '';

    let filtered = vehicles.filter(v => {
        if (search && !`${v.plate_number} ${v.brand} ${v.model}`.toLowerCase().includes(search)) return false;
        if (statusFilter && getMaintStatus(v) !== statusFilter) return false;
        return true;
    });

    const needServiceUnits = vehicles.filter(v => getMaintStatus(v) === 'Segera Servis');
    const needService = needServiceUnits.length;
    const totalCost = maintenanceRecords.reduce((s, r) => s + r.cost, 0);
    const avgCost = maintenanceRecords.length > 0 ? Math.round(totalCost / maintenanceRecords.length) : 0;
    const budgetCost = needServiceUnits.reduce((s, v) => s + (v.estimated_service_cost || avgCost), 0);

    document.getElementById('maint-need').textContent = needService + ' Unit';
    document.getElementById('maint-budget').textContent = fmtRp(budgetCost);
    document.getElementById('maint-budget-sub').textContent = `Estimasi total untuk ${needService} unit`;
    document.getElementById('maint-total-cost').textContent = fmtRp(totalCost);
    document.getElementById('maint-avg-cost').textContent = fmtRp(avgCost);
    document.getElementById('maint-count-sub').textContent = maintenanceRecords.length + ' transaksi servis tercatat';

    const grid = document.getElementById('maint-cards-grid');
    grid.innerHTML = filtered.map(v => {
        const pct = serviceProgress(v);
        const remaining = v.next_service_odometer - v.current_odometer;
        const barColor = pct >= 90 ? 'progress-bar--rose' : pct >= 75 ? 'progress-bar--amber' : 'progress-bar--green';
        const lastService = getLastService(v.id);
        const lastServiceInfo = lastService
            ? `${lastService.service_type} (${formatDate(lastService.service_date)})`
            : 'Belum ada riwayat servis';
        return `<div class="card slide-up" style="padding:16px;animation-delay: ${filtered.indexOf(v) * 0.05}s">
            <div class="flex-between mb-16">
                <span class="plate">${v.plate_number}</span>
                ${maintStatusBadge(v)}
            </div>
            <div style="font-size:13px;font-weight:700;margin-bottom:2px">${v.brand} ${v.model}</div>
            <div class="text-xs text-secondary mb-16">${v.category} • ${v.pool_location}</div>
            <div class="flex-between" style="margin-bottom:6px">
                <span class="text-xs text-bold">Progres Usia Servis (${pct}%)</span>
                <span class="text-xs text-secondary">${remaining > 0 ? 'Sisa ' + fmt(remaining) + ' km' : 'Melebihi Batas!'}</span>
            </div>
            <div class="progress"><div class="progress-bar ${barColor}" style="width:${pct}%"></div></div>
            <div class="flex-between" style="margin-top:6px">
                <span class="text-xs text-muted">Servis Terakhir: ${fmt(v.last_service_odometer)} km</span>
                <span class="text-xs text-muted">Target: ${fmt(v.next_service_odometer)} km</span>
            </div>
            <div style="margin-top:10px;padding:8px;background:var(--slate-50);border-radius:var(--radius-xs);border:1px solid var(--border)">
                <div class="text-xs text-secondary"><i class="fa-solid fa-wrench" style="color:var(--amber-600)"></i> <strong>Servis Terakhir:</strong> ${lastServiceInfo}</div>
            </div>
            <div class="flex-between mt-16">
                <button onclick="openVehicleDetail('${v.id}')" class="link">Detail Unit</button>
                <button onclick="openServiceFor('${v.id}')" class="btn btn--amber btn--xs"><i class="fa-solid fa-plus"></i> Catat Servis</button>
            </div>
        </div>`;
    }).join('');

    const tbody = document.getElementById('maint-history-body');
    tbody.innerHTML = maintenanceRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        return `<tr>
            <td>${formatDate(r.service_date)}</td>
            <td><span class="plate" style="font-size:10px">${v ? v.plate_number : '?'}</span><br><span class="text-xs text-muted">${v ? v.brand + ' ' + v.model : ''}</span></td>
            <td><span class="badge badge--amber">${r.service_type}</span></td>
            <td>${r.workshop_name}<br><span class="text-xs text-muted">Mekanik: ${r.mechanic_name || '-'}</span></td>
            <td style="font-weight:600;font-family:monospace">${fmt(r.odometer)} km</td>
            <td>${r.description || '-'}</td>
            <td class="text-right text-bold text-green">${fmtRp(r.cost)}</td>
        </tr>`;
    }).join('');
}

function toggleBudgetDetail() {
    const card = document.getElementById('budget-detail-card');
    if (card.style.display === 'none') {
        renderBudgetDetail();
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        card.style.display = 'none';
    }
}

function renderBudgetDetail() {
    const needServiceUnits = vehicles.filter(v => getMaintStatus(v) === 'Segera Servis');
    const needService = needServiceUnits.length;
    const totalCost = maintenanceRecords.reduce((s, r) => s + r.cost, 0);
    const avgCost = maintenanceRecords.length > 0 ? Math.round(totalCost / maintenanceRecords.length) : 0;
    const budgetCost = needServiceUnits.reduce((s, v) => s + (v.estimated_service_cost || avgCost), 0);

    document.getElementById('detail-need-count').textContent = needService;
    document.getElementById('detail-avg-cost').textContent = fmtRp(avgCost);
    document.getElementById('detail-transactions').textContent = maintenanceRecords.length + ' transaksi tercatat';
    document.getElementById('detail-total-budget').textContent = fmtRp(budgetCost);

    const tbody = document.getElementById('budget-detail-tbody');
    tbody.innerHTML = needServiceUnits.map(v => {
        const pct = serviceProgress(v);
        const estCost = v.estimated_service_cost || avgCost;
        const serviceType = v.estimated_service_type || 'Servis Berkala';
        return `<tr>
            <td><span class="plate">${v.plate_number}</span></td>
            <td>${v.brand} ${v.model}<br><span class="text-xs text-muted">${v.category}</span></td>
            <td>${maintStatusBadge(v)}</td>
            <td><span class="text-bold">${pct}%</span><br><span class="text-xs text-muted">${v.current_odometer > v.next_service_odometer ? 'Melebihi batas' : 'Mendekati batas'}</span><br><span class="text-xs" style="color:var(--primary-600)"><i class="fa-solid fa-wrench"></i> ${serviceType}</span></td>
            <td class="text-right text-bold text-green">${fmtRp(estCost)}</td>
        </tr>`;
    }).join('');

    if (needServiceUnits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:24px"><i class="fa-solid fa-check-circle" style="color:var(--green-500);font-size:24px"></i><br>Semua unit dalam kondisi prima</td></tr>`;
    }
}

function getMaintStatus(v) {
    const pct = serviceProgress(v);
    const hasServiceHistory = maintenanceRecords.some(r => r.vehicle_id === v.id);

    if (pct >= 75) return 'Segera Servis';
    if (v.status === 'Dalam Perawatan' && hasServiceHistory) return 'Segera Servis';
    if (v.status === 'Dalam Perawatan') return 'Sedang di Bengkel';
    return 'Kondisi Prima';
}

function filterNeedService() {
    const filterSelect = document.getElementById('maint-status-filter');
    if (filterSelect) {
        filterSelect.value = 'Segera Servis';
        renderMaintenance();
        document.querySelector('.card--maintenance-status').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ---- TAX ----
function renderTax() {
    const search = (document.getElementById('tax-search')?.value || '').toLowerCase();
    const schemeFilter = document.getElementById('tax-scheme-filter')?.value || '';

    let s1Exp = 0, s1Warn = 0, s1Safe = 0, s2Exp = 0, s2Warn = 0, s2Safe = 0;
    vehicles.forEach(v => {
        const d1 = daysBetween(v.tax_due_date);
        if (d1 < 0) s1Exp++; else if (d1 <= 30) s1Warn++; else s1Safe++;
        const d2 = daysBetween(v.stnk_due_date);
        if (d2 < 0) s2Exp++; else if (d2 <= 30) s2Warn++; else s2Safe++;
    });

    document.getElementById('tax-s1-expired').textContent = s1Exp;
    document.getElementById('tax-s1-warning').textContent = s1Warn;
    document.getElementById('tax-s1-safe').textContent = s1Safe;
    document.getElementById('tax-s2-expired').textContent = s2Exp;
    document.getElementById('tax-s2-warning').textContent = s2Warn;
    document.getElementById('tax-s2-safe').textContent = s2Safe;

    const totalExpired = s1Exp + s2Exp;
    const totalWarning = s1Warn + s2Warn;
    const totalVehicles = vehicles.length;
    const readyVehicles = vehicles.filter(v => {
        const d1 = daysBetween(v.tax_due_date);
        const d2 = daysBetween(v.stnk_due_date);
        return d1 > 30 && d2 > 30;
    }).length;
    const fleetReadiness = totalVehicles > 0 ? Math.round((readyVehicles / totalVehicles) * 100) : 0;

    let tax30DayCost = 0;
    const upcomingList = [];
    vehicles.forEach(v => {
        const d1 = daysBetween(v.tax_due_date);
        const d2 = daysBetween(v.stnk_due_date);
        if (d1 <= 30) {
            tax30DayCost += (v.annual_tax_cost || 0);
            upcomingList.push({ vehicle: v, type: 'Pajak Tahunan', days: d1, cost: v.annual_tax_cost || 0, due: v.tax_due_date });
        }
        if (d2 <= 30) {
            upcomingList.push({ vehicle: v, type: 'STNK 5 Tahunan', days: d2, cost: 3000000, due: v.stnk_due_date });
            tax30DayCost += 3000000;
        }
    });
    upcomingList.sort((a, b) => a.days - b.days);

    document.getElementById('tax-30day-cost').textContent = fmtRp(tax30DayCost);
    document.getElementById('tax-expired-count').textContent = totalExpired;
    document.getElementById('tax-warning-count').textContent = totalWarning;
    document.getElementById('tax-fleet-readiness').textContent = fleetReadiness + '%';

    const upcomingListEl = document.getElementById('tax-upcoming-list');
    if (upcomingList.length > 0) {
        upcomingListEl.innerHTML = upcomingList.slice(0, 5).map(item => {
            const daysText = item.days < 0 ? `<span style="color:var(--rose-600);font-weight:700">Kadaluwarsa ${Math.abs(item.days)} hari</span>` : `${item.days} hari lagi`;
            return `<div class="tax-upcoming-item">
                <div class="tax-upcoming-item__info">
                    <span class="tax-upcoming-item__plate">${item.vehicle.plate_number}</span>
                    <div>
                        <div style="font-size:12px;font-weight:600">${item.vehicle.brand} ${item.vehicle.model}</div>
                        <div class="tax-upcoming-item__detail">${item.type} • ${daysText} • ${formatDate(item.due)}</div>
                    </div>
                </div>
                <div class="tax-upcoming-item__cost">${fmtRp(item.cost)}</div>
            </div>`;
        }).join('');
    } else {
        upcomingListEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:12px"><i class="fa-solid fa-check-circle" style="color:var(--green-600);margin-right:6px"></i>Tidak ada pajak jatuh tempo dalam 30 hari ke depan</div>';
    }

    const recommendationEl = document.getElementById('tax-recommendation');
    if (totalExpired > 0) {
        recommendationEl.innerHTML = `<strong><i class="fa-solid fa-exclamation-triangle" style="color:var(--rose-600)"></i> Perhatian:</strong> Ada ${totalExpired} kendaraan dengan pajak kadaluwarsa. Segera lakukan perpanjangan untuk menghindari denda dan masalah hukum saat operasi.`;
        recommendationEl.style.background = 'var(--card)';
        recommendationEl.style.borderColor = 'var(--rose-600)';
        recommendationEl.style.color = 'var(--rose-900)';
    } else if (totalWarning > 0) {
        recommendationEl.innerHTML = `<strong><i class="fa-solid fa-clock" style="color:var(--amber-600)"></i> Pengingat:</strong> ${totalWarning} kendaraan akan jatuh tempo dalam 30 hari. Siapkan anggaran sebesar <strong>${fmtRp(tax30DayCost)}</strong> untuk pembayaran pajak.`;
        recommendationEl.style.background = 'var(--amber-50)';
        recommendationEl.style.borderColor = 'var(--amber-200)';
        recommendationEl.style.color = 'var(--amber-900)';
    } else {
        recommendationEl.innerHTML = `<strong><i class="fa-solid fa-check-circle" style="color:var(--green-600)"></i> Status Baik:</strong> Semua kendaraan memiliki pajak aktif. Fleet readiness ${fleetReadiness}%. Pertahankan jadwal perpanjangan yang teratur.`;
        recommendationEl.style.background = 'var(--green-50)';
        recommendationEl.style.borderColor = 'var(--green-200)';
        recommendationEl.style.color = 'var(--green-900)';
    }

    let filtered = vehicles.filter(v => {
        if (search && !`${v.plate_number} ${v.brand} ${v.model}`.toLowerCase().includes(search)) return false;
        if (schemeFilter) {
            const d1 = daysBetween(v.tax_due_date);
            const d2 = daysBetween(v.stnk_due_date);
            if (schemeFilter === 'expired' && d1 >= 0 && d2 >= 0) return false;
            if (schemeFilter === 'warning' && !(d1 >= 0 && d1 <= 30) && !(d2 >= 0 && d2 <= 30)) return false;
            if (schemeFilter === 'safe' && (d1 <= 30 || d2 <= 30)) return false;
        }
        return true;
    });

    const grid = document.getElementById('tax-cards-grid');
    grid.innerHTML = filtered.map(v => {
        const d1 = daysBetween(v.tax_due_date);
        const d2 = daysBetween(v.stnk_due_date);
        const cardBorder = (d1 < 0 || d2 < 0) ? 'border:2px solid var(--rose-300)' : (d1 <= 30 || d2 <= 30) ? 'border:2px solid var(--amber-300)' : '';
        return `<div class="card slide-up" style="padding:16px;${cardBorder};animation-delay: ${filtered.indexOf(v) * 0.05}s">
            <div class="flex-between mb-16">
                <span class="plate">${v.plate_number}</span>
            </div>
            <div class="flex" style="align-items:center;gap:12px;margin-bottom:12px">
                <img src="${v.image_url || '/assets/images/avanza_veloz.jpg'}" onerror="this.src='/assets/images/avanza_veloz.jpg'" style="width:48px;height:48px;object-fit:cover;border-radius:12px;border:1px solid var(--border)">
                <div>
                    <div style="font-size:13px;font-weight:700">${v.brand} ${v.model}</div>
                    <div class="text-xs text-secondary">${v.category} • Thn ${v.year}</div>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
                <div class="mini-scheme mini-scheme--teal">
                    <div class="flex-between">
                        <span class="text-xs text-bold" style="color:var(--teal-800)"><i class="fa-solid fa-shield-halved" style="color:var(--teal-600)"></i> 1. Pajak Tahunan (PKB)</span>
                        ${taxBadge(d1)}
                    </div>
                    <div class="text-xs text-secondary">Jatuh Tempo: <strong>${formatDate(v.tax_due_date)}</strong></div>
                </div>
                <div class="mini-scheme mini-scheme--teal-dark">
                    <div class="flex-between">
                        <span class="text-xs text-bold" style="color:var(--teal-900)"><i class="fa-solid fa-id-card" style="color:var(--teal-700)"></i> 2. STNK 5 Tahunan (Plat)</span>
                        ${taxBadge(d2)}
                    </div>
                    <div class="text-xs text-secondary">Jatuh Tempo: <strong>${formatDate(v.stnk_due_date)}</strong></div>
                </div>
            </div>
            <div class="flex-between">
                <button onclick="openVehicleDetail('${v.id}')" class="link">Detail Unit</button>
                <button onclick="openTaxFor('${v.id}')" class="btn btn--teal btn--xs"><i class="fa-solid fa-plus"></i> Bayar / Perpanjang</button>
            </div>
        </div>`;
    }).join('');

    const tbody = document.getElementById('tax-history-body');
    tbody.innerHTML = taxRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        const typeBadge = r.tax_type.includes('5 Tahunan') ? 'badge--teal-dark' : 'badge--teal';
        return `<tr>
            <td>${formatDate(r.payment_date)}</td>
            <td><span class="plate" style="font-size:10px">${v ? v.plate_number : '?'}</span><br><span class="text-xs text-muted">${v ? v.brand + ' ' + v.model : ''}</span></td>
            <td><span class="badge ${typeBadge}">${r.tax_type}</span></td>
            <td style="font-family:monospace;font-weight:600">${r.receipt_number}</td>
            <td>${formatDate(r.new_due_date)}</td>
            <td class="text-right text-bold text-green">${fmtRp(r.amount)}</td>
            <td class="text-center">
                <div class="flex-gap" style="justify-content:center;gap:4px">
                    <button onclick="openEditTax('${r.id}')" class="btn btn--outline btn--xs" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="confirmDeleteTax('${r.id}')" class="btn btn--outline btn--xs" style="color:var(--rose-600);border-color:var(--rose-300)" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderTaxCalendar();
}

function renderTaxCalendar() {
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    document.getElementById('tax-calendar-year').textContent = currentYear;

    const monthlyData = Array.from({ length: 12 }, () => ({
        count: 0,
        cost: 0,
        vehicles: [],
        status: 'safe'
    }));

    vehicles.forEach(v => {
        const taxDate = new Date(v.tax_due_date);
        const stnkDate = new Date(v.stnk_due_date);

        if (taxDate.getFullYear() === currentYear) {
            const month = taxDate.getMonth();
            const days = daysBetween(v.tax_due_date);
            monthlyData[month].count++;
            monthlyData[month].cost += (v.annual_tax_cost || 0);
            monthlyData[month].vehicles.push({ plate: v.plate_number, type: 'Pajak', days });
            if (days < 0) monthlyData[month].status = 'expired';
            else if (days <= 30 && monthlyData[month].status !== 'expired') monthlyData[month].status = 'warning';
        }

        if (stnkDate.getFullYear() === currentYear) {
            const month = stnkDate.getMonth();
            const days = daysBetween(v.stnk_due_date);
            monthlyData[month].count++;
            monthlyData[month].cost += 3000000;
            monthlyData[month].vehicles.push({ plate: v.plate_number, type: 'STNK', days });
            if (days < 0) monthlyData[month].status = 'expired';
            else if (days <= 30 && monthlyData[month].status !== 'expired') monthlyData[month].status = 'warning';
        }
    });

    const gridEl = document.getElementById('tax-calendar-grid');
    gridEl.innerHTML = monthlyData.map((data, idx) => {
        const isCurrentMonth = idx === currentMonth;
        const statusClass = data.status === 'expired' ? 'tax-calendar-month--expired' :
            data.status === 'warning' ? 'tax-calendar-month--warning' :
                isCurrentMonth ? 'tax-calendar-month--current' : '';

        const vehicleTags = data.vehicles.slice(0, 3).map(v =>
            `<span class="tax-calendar-month__vehicle-tag">${v.plate}</span>`
        ).join('');
        const moreVehicles = data.vehicles.length > 3 ? `<span class="tax-calendar-month__vehicle-tag">+${data.vehicles.length - 3}</span>` : '';

        return `<div class="tax-calendar-month ${statusClass}">
            <div class="tax-calendar-month__name">${monthNames[idx]}</div>
            <div class="tax-calendar-month__count">${data.count}</div>
            <div class="tax-calendar-month__label">Jatuh Tempo</div>
            ${data.count > 0 ? `<div class="tax-calendar-month__cost">${fmtRp(data.cost)}</div>` : ''}
            ${data.vehicles.length > 0 ? `<div class="tax-calendar-month__vehicles">${vehicleTags}${moreVehicles}</div>` : ''}
        </div>`;
    }).join('');

    const totalAnnualCost = monthlyData.reduce((sum, m) => sum + m.cost, 0);
    const monthsWithDeadlines = monthlyData.filter(m => m.count > 0).length;
    const avgMonthlyCost = monthsWithDeadlines > 0 ? Math.round(totalAnnualCost / monthsWithDeadlines) : 0;

    const summaryEl = document.getElementById('tax-calendar-summary');
    summaryEl.innerHTML = `<strong><i class="fa-solid fa-chart-pie" style="color:var(--blue-600)"></i> Ringkasan Tahun ${currentYear}:</strong>
        Total estimasi biaya pajak tahunan: <strong>${fmtRp(totalAnnualCost)}</strong> dari ${monthsWithDeadlines} bulan dengan jatuh tempo.
        Rata-rata per bulan: <strong>${fmtRp(avgMonthlyCost)}</strong>. Gunakan kalender ini untuk perencanaan anggaran dan pengingat jatuh tempo.`;
}

// ---- TRACKING ----
function renderTracking() {
    const search = (document.getElementById('track-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('track-status-filter')?.value || '';

    const activeTrips = tripLogs.filter(t => t.status === 'Berjalan');
    const completedTrips = tripLogs.filter(t => t.status === 'Selesai');
    const totalDistance = completedTrips.reduce((s, t) => s + ((t.end_odometer || 0) - t.start_odometer), 0);
    const totalFuelCost = completedTrips.reduce((s, t) => s + (t.fuel_cost || 0), 0);

    document.getElementById('track-active').textContent = activeTrips.length + ' Kendaraan';
    document.getElementById('track-distance').textContent = fmt(totalDistance) + ' km';
    document.getElementById('track-distance-sub').textContent = `Dari ${completedTrips.length} perjalanan selesai`;
    document.getElementById('track-fuel-cost').textContent = fmtRp(totalFuelCost);

    const liveSection = document.getElementById('tracking-live-section');
    const liveContent = document.getElementById('tracking-live-content');
    if (activeTrips.length > 0) {
        liveSection.style.display = 'block';
        liveContent.innerHTML = activeTrips.map((t, idx) => {
            const v = getVehicle(t.vehicle_id);
            const speed = Math.floor(40 + Math.random() * 40);
            return `<div class="live-card__item slide-up" style="animation-delay: ${idx * 0.1}s">
                <div>
                    <div class="flex-between" style="margin-bottom:8px">
                        <span class="plate plate--dark" style="font-size:12px">${v ? v.plate_number : '?'}</span>
                        <span class="live-card__speed">Kecepatan: ${speed} km/j</span>
                    </div>
                    <div style="font-size:14px;font-weight:700;margin-bottom:2px">${v ? v.brand + ' ' + v.model : ''}</div>
                    <div class="text-xs" style="color:var(--slate-400);margin-bottom:8px"><strong>Pengemudi:</strong> ${t.driver_name}</div>
                    <div class="live-card__dest">
                        <div style="font-size:12px;font-weight:700;color:var(--green-300)"><i class="fa-solid fa-location-dot"></i> ${t.destination}</div>
                        <div style="font-size:10px;color:var(--slate-400);margin-top:2px">Keperluan: ${t.purpose}</div>
                    </div>
                    <div style="margin-top:8px">
                        <div class="flex-between text-xs" style="color:var(--slate-400);margin-bottom:4px"><span>Progres Rute Perjalanan</span><span>43%</span></div>
                        <div class="progress progress--lg" style="background:var(--slate-700)"><div class="progress-bar progress-bar--blue" style="width:43%"></div></div>
                    </div>
                </div>
                <button onclick="openCompleteTrip('${t.id}','${t.vehicle_id}',${t.start_odometer})" class="btn btn--green" style="width:100%;justify-content:center"><i class="fa-solid fa-circle-check"></i> Selesaikan Perjalanan</button>
            </div>`;
        }).join('');
    } else {
        liveSection.style.display = 'none';
    }

    let filtered = tripLogs.filter(t => {
        const v = getVehicle(t.vehicle_id);
        const text = `${v ? v.plate_number : ''} ${t.driver_name} ${t.destination}`.toLowerCase();
        if (search && !text.includes(search)) return false;
        if (statusFilter && t.status !== statusFilter) return false;
        return true;
    });

    const tbody = document.getElementById('track-history-body');
    tbody.innerHTML = filtered.map(t => {
        const v = getVehicle(t.vehicle_id);
        const distance = t.end_odometer ? t.end_odometer - t.start_odometer : '-';
        return `<tr>
            <td>${formatDateTime(t.start_time)}</td>
            <td><span class="plate" style="font-size:10px">${v ? v.plate_number : '?'}</span><br><span class="text-xs text-muted">${v ? v.brand + ' ' + v.model : ''}</span></td>
            <td style="font-weight:600">${t.driver_name}</td>
            <td><strong>${t.destination}</strong><br><span class="text-muted">${t.purpose}</span></td>
            <td style="font-weight:600;font-family:monospace">${fmt(t.start_odometer)} km${t.end_odometer ? ' → ' + fmt(t.end_odometer) + ' km' : ''}</td>
            <td style="font-weight:700">${distance !== '-' ? distance + ' km' : '-'}</td>
            <td class="text-green" style="font-weight:600">${t.fuel_cost ? fmtRp(t.fuel_cost) : '-'}</td>
            <td>${t.status === 'Berjalan' ? '<span class="badge badge--green"><span class="dot-live"></span> Berjalan</span>' : '<span class="badge badge--slate">Selesai</span>'}</td>
            <td class="text-right" style="white-space:nowrap">${t.status === 'Berjalan' ? `<button onclick="openCompleteTrip('${t.id}','${t.vehicle_id}',${t.start_odometer})" class="btn btn--green btn--xs">Selesaikan</button>` : ''}</td>
        </tr>`;
    }).join('');
}

// ---- TAB SWITCH ----
function switchTab(tab) {
    ['dashboard', 'inventory', 'maintenance', 'tax', 'tracking'].forEach(t => {
        document.getElementById('sec-' + t).classList.toggle('active', t === tab);
        document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    });
    window.scrollTo(0, 0);
}

// ---- MODALS ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function populateModalSelects() {
    const opts = vehicles.map(v => `<option value="${v.id}">${v.plate_number} - ${v.brand} ${v.model}</option>`).join('');
    ['as_vehicle', 'at_vehicle', 'et_vehicle'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });

    const availOpts = vehicles.filter(v => v.status === 'Tersedia').map(v => `<option value="${v.id}" data-odo="${v.current_odometer}">${v.plate_number} - ${v.brand} ${v.model}</option>`).join('');
    const stEl = document.getElementById('st_vehicle');
    if (stEl) {
        stEl.innerHTML = availOpts;
        stEl.onchange = () => {
            const sel = stEl.options[stEl.selectedIndex];
            if (sel) document.getElementById('st_odometer').value = sel.getAttribute('data-odo') || '';
        };
        if (stEl.options.length > 0) stEl.dispatchEvent(new Event('change'));
    }

    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fiveYears = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const el1 = document.getElementById('av_tax_date'); if (el1 && !el1.value) el1.value = nextYear;
    const el2 = document.getElementById('av_stnk_date'); if (el2 && !el2.value) el2.value = fiveYears;
    const el3 = document.getElementById('as_date'); if (el3) el3.value = today;
    const el4 = document.getElementById('at_date'); if (el4) el4.value = today;
    const el5 = document.getElementById('at_new_due'); if (el5 && !el5.value) el5.value = nextYear;
}

function openStartTripFor(vehicleId) {
    openModal('startTripModal');
    setTimeout(() => {
        const sel = document.getElementById('st_vehicle');
        if (sel) { sel.value = vehicleId; sel.dispatchEvent(new Event('change')); }
    }, 100);
}

function openServiceFor(vehicleId) {
    openModal('addServiceModal');
    setTimeout(() => {
        const sel = document.getElementById('as_vehicle');
        if (sel) sel.value = vehicleId;
        const v = getVehicle(vehicleId);
        if (v) document.getElementById('as_odometer').value = v.current_odometer;
    }, 100);
}

function openTaxFor(vehicleId) {
    openModal('addTaxModal');
    setTimeout(() => {
        const sel = document.getElementById('at_vehicle');
        if (sel) sel.value = vehicleId;
    }, 100);
}

function openCompleteTrip(tripId, vehicleId, startOdo) {
    document.getElementById('ct_trip_id').value = tripId;
    document.getElementById('ct_vehicle_id').value = vehicleId;
    document.getElementById('ct_end_odo').value = Math.round(startOdo + 50);
    openModal('completeTripModal');
}

function openVehicleDetail(vehicleId) {
    const v = getVehicle(vehicleId);
    if (!v) return;

    const d1 = daysBetween(v.tax_due_date);
    const d2 = daysBetween(v.stnk_due_date);
    const pct = serviceProgress(v);
    const barColor = pct >= 90 ? 'progress-bar--rose' : pct >= 75 ? 'progress-bar--amber' : 'progress-bar--green';
    const maint = maintenanceRecords.filter(r => r.vehicle_id === vehicleId);
    const taxes = taxRecords.filter(r => r.vehicle_id === vehicleId);
    const trips = tripLogs.filter(t => t.vehicle_id === vehicleId);

    let maintHtml = maint.length === 0
        ? '<p class="text-xs text-muted" style="padding:12px 0;text-align:center">Belum ada catatan servis.</p>'
        : maint.map(r => `<div class="history-row">
            <div><div class="text-xs text-bold">${r.service_type} <span class="text-secondary" style="font-weight:400">• ${r.workshop_name}</span></div><div class="text-xs text-muted" style="margin-top:2px">${formatDate(r.service_date)} • Odo ${fmt(r.odometer)} km</div></div>
            <span class="text-xs text-bold text-green">${fmtRp(r.cost)}</span>
        </div>`).join('');

    let taxHtml = taxes.length === 0
        ? '<p class="text-xs text-muted" style="padding:12px 0;text-align:center">Belum ada riwayat pembayaran pajak.</p>'
        : taxes.map(r => `<div class="history-row">
            <div><div class="text-xs text-bold">${r.tax_type}</div><div class="text-xs text-muted" style="margin-top:2px">${formatDate(r.payment_date)} • ${r.receipt_number}</div></div>
            <span class="text-xs text-bold text-green">${fmtRp(r.amount)}</span>
        </div>`).join('');

    let tripHtml = trips.length === 0
        ? '<p class="text-xs text-muted" style="padding:12px 0;text-align:center">Belum ada riwayat perjalanan.</p>'
        : trips.map(t => `<div class="history-row">
            <div><div class="text-xs text-bold">${t.destination}</div><div class="text-xs text-muted" style="margin-top:2px">${t.driver_name} • ${formatDateTime(t.start_time)}</div></div>
            <span class="text-xs text-bold" style="${t.status === 'Berjalan' ? 'color:var(--green-600)' : 'color:var(--text-secondary)'}">${t.status === 'Berjalan' ? '<i class="fa-solid fa-circle-dot" style="color:var(--green-500)"></i> Berjalan' : 'Selesai'}</span>
        </div>`).join('');

    const startBtn = v.status === 'Tersedia'
        ? `<button onclick="closeModal('vehicleDetailModal');openStartTripFor('${v.id}')" class="btn btn--green"><i class="fa-solid fa-route"></i> Mulai Perjalanan</button>`
        : '';

    document.getElementById('vd-content').innerHTML = `
        <div class="vd-hero">
            <img src="${v.image_url || '/assets/images/avanza_veloz.jpg'}" alt="${v.brand} ${v.model}" onerror="this.src='/assets/images/avanza_veloz.jpg'" class="vd-hero__img">
            <div class="vd-hero__overlay"></div>
            <button onclick="closeModal('vehicleDetailModal')" class="vd-hero__close"><i class="fa-solid fa-xmark"></i></button>
            <div class="vd-hero__body">
                <div class="flex" style="gap:8px;align-items:center;margin-bottom:8px">
                    <span class="plate plate--dark" style="font-size:14px">${v.plate_number}</span>
                    ${statusBadge(v.status)}
                </div>
                <div class="vd-hero__name">${v.brand} ${v.model}</div>
                <div class="vd-hero__meta"><span>Thn ${v.year}</span><span>•</span><span>${v.category}</span><span>•</span><span>${v.fuel_type}</span></div>
            </div>
        </div>

        <div style="padding:20px 24px">
            <div class="facts">
                <div class="fact"><span class="fact__label"><i class="fa-solid fa-gauge"></i> Odometer</span><div class="fact__value">${fmt(v.current_odometer)} km</div></div>
                <div class="fact"><span class="fact__label"><i class="fa-solid fa-gas-pump"></i> Bahan Bakar</span><div class="fact__value" style="font-size:14px">${v.fuel_type}</div></div>
                <div class="fact"><span class="fact__label"><i class="fa-solid fa-location-dot"></i> Pool</span><div class="fact__value" style="font-size:14px">${v.pool_location}</div></div>
                <div class="fact"><span class="fact__label"><i class="fa-solid fa-file-invoice-dollar"></i> Pajak Tahunan</span><div class="fact__value">${fmtRp(v.annual_tax_cost || 0)}</div></div>
            </div>

            <div class="grid grid--2" style="margin-top:16px">
                <div class="mini-scheme mini-scheme--teal">
                    <div class="flex-between"><span class="text-xs text-bold" style="color:var(--teal-800)"><i class="fa-solid fa-shield-halved" style="color:var(--teal-600)"></i> 1. Pajak Tahunan (PKB)</span>${taxBadge(d1)}</div>
                    <div class="text-xs text-secondary" style="margin-top:4px">Jatuh Tempo: <strong>${formatDate(v.tax_due_date)}</strong></div>
                </div>
                <div class="mini-scheme mini-scheme--teal-dark">
                    <div class="flex-between"><span class="text-xs text-bold" style="color:var(--teal-900)"><i class="fa-solid fa-id-card" style="color:var(--teal-700)"></i> 2. STNK 5 Tahunan (Plat)</span>${taxBadge(d2)}</div>
                    <div class="text-xs text-secondary" style="margin-top:4px">Jatuh Tempo: <strong>${formatDate(v.stnk_due_date)}</strong></div>
                </div>
            </div>

            <div class="mini-scheme" style="margin-top:16px;background:var(--slate-50);border-color:var(--border)">
                <div class="flex-between"><span class="text-xs text-bold"><i class="fa-solid fa-wrench" style="color:var(--amber-600)"></i> Status Perawatan</span>${maintStatusBadge(v)}</div>
                <div class="flex-between text-xs text-secondary" style="margin-top:8px;font-weight:500"><span>Progres Usia Servis (${pct}%)</span><span>${(v.next_service_odometer - v.current_odometer) > 0 ? 'Sisa ' + fmt(v.next_service_odometer - v.current_odometer) + ' km' : 'Melebihi Batas!'}</span></div>
                <div class="progress" style="margin-top:8px"><div class="progress-bar ${barColor}" style="width:${pct}%"></div></div>
                <div class="flex-between" style="margin-top:6px"><span class="text-xs text-muted">Servis Terakhir: ${fmt(v.last_service_odometer)} km (${formatDate(v.last_service_date)})</span><span class="text-xs text-muted">Target: ${fmt(v.next_service_odometer)} km</span></div>
            </div>

            <div class="vd-section"><h4 class="vd-section__title">Riwayat Servis</h4>${maintHtml}</div>
            <div class="vd-section"><h4 class="vd-section__title">Riwayat Pembayaran Pajak</h4>${taxHtml}</div>
            <div class="vd-section"><h4 class="vd-section__title">Riwayat Perjalanan</h4>${tripHtml}</div>

            ${v.notes ? `<div class="mini-scheme" style="margin-top:16px;background:var(--blue-50);border-color:var(--blue-300);color:var(--blue-800)"><i class="fa-solid fa-circle-info" style="color:var(--blue-600)"></i> ${v.notes}</div>` : ''}
        </div>

        <div class="modal-footer" style="flex-wrap:wrap">
            ${startBtn}
            <button onclick="closeModal('vehicleDetailModal');openServiceFor('${v.id}')" class="btn btn--amber"><i class="fa-solid fa-wrench"></i> Catat Servis</button>
            <button onclick="closeModal('vehicleDetailModal');openTaxFor('${v.id}')" class="btn btn--teal"><i class="fa-solid fa-receipt"></i> Bayar Pajak</button>
            <button onclick="closeModal('vehicleDetailModal')" class="btn btn--outline" style="margin-left:auto">Tutup</button>
        </div>`;

    openModal('vehicleDetailModal');
}

function openEditVehicle(vehicleId) {
    const v = getVehicle(vehicleId);
    if (!v) return;
    document.getElementById('ev_id').value = v.id;
    document.getElementById('ev_plate').value = v.plate_number;
    document.getElementById('ev_brand').value = v.brand;
    document.getElementById('ev_model').value = v.model;
    document.getElementById('ev_year').value = v.year;
    document.getElementById('ev_category').value = v.category;
    document.getElementById('ev_fuel').value = v.fuel_type;
    document.getElementById('ev_odometer').value = v.current_odometer;
    document.getElementById('ev_pool').value = v.pool_location;
    document.getElementById('ev_status').value = v.status;
    document.getElementById('ev_tax_cost').value = v.annual_tax_cost || 0;
    document.getElementById('ev_tax_date').value = v.tax_due_date;
    document.getElementById('ev_stnk_date').value = v.stnk_due_date;
    document.getElementById('ev_image').value = v.image_url || '';
    document.getElementById('ev_notes').value = v.notes || '';
    document.getElementById('ev_service_type').value = v.estimated_service_type || '';
    document.getElementById('ev_service_cost').value = v.estimated_service_cost || 0;
    openModal('editVehicleModal');
}

// ---- FORM SUBMISSIONS ----
async function submitEditVehicle(e) {
    e.preventDefault();
    const id = document.getElementById('ev_id').value;
    const data = {
        plate_number: document.getElementById('ev_plate').value.toUpperCase(),
        brand: document.getElementById('ev_brand').value,
        model: document.getElementById('ev_model').value,
        year: parseInt(document.getElementById('ev_year').value),
        category: document.getElementById('ev_category').value,
        fuel_type: document.getElementById('ev_fuel').value,
        current_odometer: parseFloat(document.getElementById('ev_odometer').value),
        pool_location: document.getElementById('ev_pool').value,
        status: document.getElementById('ev_status').value,
        tax_due_date: document.getElementById('ev_tax_date').value,
        stnk_due_date: document.getElementById('ev_stnk_date').value,
        annual_tax_cost: parseInt(document.getElementById('ev_tax_cost').value || '0'),
        image_url: document.getElementById('ev_image').value,
        notes: document.getElementById('ev_notes').value,
        estimated_service_type: document.getElementById('ev_service_type').value,
        estimated_service_cost: parseInt(document.getElementById('ev_service_cost').value) || 0
    };
    await fetch('/api/vehicles/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('editVehicleModal');
    fetchAll();
    showToast(`Data kendaraan [${data.plate_number}] berhasil diperbarui!`);
}

async function submitAddVehicle(e) {
    e.preventDefault();
    const data = {
        plate_number: document.getElementById('av_plate').value.toUpperCase(),
        brand: document.getElementById('av_brand').value,
        model: document.getElementById('av_model').value,
        year: parseInt(document.getElementById('av_year').value),
        category: document.getElementById('av_category').value,
        fuel_type: document.getElementById('av_fuel').value,
        current_odometer: parseFloat(document.getElementById('av_odometer').value),
        pool_location: document.getElementById('av_pool').value,
        tax_due_date: document.getElementById('av_tax_date').value,
        stnk_due_date: document.getElementById('av_stnk_date').value,
        image_url: document.getElementById('av_image').value,
        estimated_service_type: document.getElementById('av_service_type').value,
        estimated_service_cost: parseInt(document.getElementById('av_service_cost').value) || 0
    };
    await fetch('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('addVehicleModal');
    e.target.reset();
    fetchAll();
    showToast(`Kendaraan baru [${data.plate_number}] berhasil didaftarkan!`);
}

async function submitAddService(e) {
    e.preventDefault();
    const data = {
        vehicle_id: document.getElementById('as_vehicle').value,
        service_date: document.getElementById('as_date').value,
        odometer: parseFloat(document.getElementById('as_odometer').value),
        workshop_name: document.getElementById('as_workshop').value,
        mechanic_name: document.getElementById('as_mechanic').value,
        service_type: document.getElementById('as_type').value,
        cost: parseInt(document.getElementById('as_cost').value),
        description: document.getElementById('as_desc').value
    };
    await fetch('/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('addServiceModal');
    e.target.reset();
    fetchAll();
    showToast('Catatan servis berhasil disimpan!');
}

async function submitAddTax(e) {
    e.preventDefault();
    const data = {
        vehicle_id: document.getElementById('at_vehicle').value,
        payment_date: document.getElementById('at_date').value,
        tax_type: document.getElementById('at_type').value,
        amount: parseInt(document.getElementById('at_amount').value),
        new_due_date: document.getElementById('at_new_due').value,
        receipt_number: document.getElementById('at_receipt').value
    };
    await fetch('/api/tax-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('addTaxModal');
    e.target.reset();
    fetchAll();
    showToast('Pembayaran pajak berhasil dicatat!');
}

function openEditTax(id) {
    const r = taxRecords.find(t => t.id === id);
    if (!r) return;
    document.getElementById('et_id').value = r.id;
    document.getElementById('et_vehicle').value = r.vehicle_id;
    document.getElementById('et_date').value = r.payment_date;
    document.getElementById('et_type').value = r.tax_type;
    document.getElementById('et_amount').value = r.amount;
    document.getElementById('et_new_due').value = r.new_due_date;
    document.getElementById('et_receipt').value = r.receipt_number;
    openModal('editTaxModal');
}

async function submitEditTax(e) {
    e.preventDefault();
    const id = document.getElementById('et_id').value;
    const data = {
        vehicle_id: document.getElementById('et_vehicle').value,
        payment_date: document.getElementById('et_date').value,
        tax_type: document.getElementById('et_type').value,
        amount: parseInt(document.getElementById('et_amount').value),
        new_due_date: document.getElementById('et_new_due').value,
        receipt_number: document.getElementById('et_receipt').value
    };
    await fetch('/api/tax-records/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('editTaxModal');
    fetchAll();
    showToast('Riwayat pembayaran pajak berhasil diperbarui!');
}

function confirmDeleteTax(id) {
    const r = taxRecords.find(t => t.id === id);
    if (!r) return;
    const v = getVehicle(r.vehicle_id);
    document.getElementById('dt_id').value = r.id;
    document.getElementById('dt_info').innerHTML = `
        <div style="font-size:12px;line-height:1.6">
            <div><strong>Kendaraan:</strong> ${v ? v.plate_number + ' - ' + v.brand + ' ' + v.model : '?'}</div>
            <div><strong>Tanggal Bayar:</strong> ${formatDate(r.payment_date)}</div>
            <div><strong>Skema:</strong> ${r.tax_type}</div>
            <div><strong>No. Resi:</strong> <span style="font-family:monospace">${r.receipt_number}</span></div>
            <div><strong>Nominal:</strong> <span style="color:var(--green-700);font-weight:600">${fmtRp(r.amount)}</span></div>
        </div>`;
    openModal('deleteTaxModal');
}

async function deleteTax() {
    const id = document.getElementById('dt_id').value;
    await fetch('/api/tax-records/' + id, { method: 'DELETE' });
    closeModal('deleteTaxModal');
    fetchAll();
    showToast('Riwayat pembayaran pajak berhasil dihapus!');
}

async function submitStartTrip(e) {
    e.preventDefault();
    const data = {
        vehicle_id: document.getElementById('st_vehicle').value,
        driver_name: document.getElementById('st_driver').value,
        start_odometer: parseFloat(document.getElementById('st_odometer').value),
        destination: document.getElementById('st_destination').value,
        purpose: document.getElementById('st_purpose').value
    };
    await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('startTripModal');
    e.target.reset();
    fetchAll();
    showToast('Perjalanan dimulai!');
}

async function submitCompleteTrip(e) {
    e.preventDefault();
    const tripId = document.getElementById('ct_trip_id').value;
    const data = {
        vehicle_id: document.getElementById('ct_vehicle_id').value,
        end_odometer: parseFloat(document.getElementById('ct_end_odo').value),
        fuel_cost: parseInt(document.getElementById('ct_fuel_cost').value || '0')
    };
    await fetch('/api/trips/' + tripId + '/complete', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('completeTripModal');
    fetchAll();
    showToast('Tugas perjalanan selesai. Unit kembali Tersedia.');
}

async function resetDemo() {
    if (!confirm('Apakah Anda yakin ingin mengembalikan seluruh data ke standar demo awal?')) return;
    await fetch('/api/reset-demo', { method: 'POST' });
    fetchAll();
    showToast('Data demo berhasil dikembalikan.', 'info');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const isInput = e.target.matches('input, textarea, select');
    const isModalOpen = document.querySelector('.modal-overlay.open');
    const shortcutPanel = document.getElementById('shortcut-help-panel');

    if (e.key === 'Escape') {
        if (shortcutPanel) {
            toggleShortcutHelp();
            return;
        }
        if (isModalOpen) {
            isModalOpen.classList.remove('open');
            return;
        }
    }

    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openModal('addVehicleModal');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        openModal('addTaxModal');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.section.active .search input');
        if (searchInput) searchInput.focus();
    } else if (e.key === '?') {
        toggleShortcutHelp();
    } else if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
        switchTab('dashboard');
    } else if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
        switchTab('inventory');
    } else if (e.key === '3' && !e.ctrlKey && !e.metaKey) {
        switchTab('maintenance');
    } else if (e.key === '4' && !e.ctrlKey && !e.metaKey) {
        switchTab('tax');
    } else if (e.key === '5' && !e.ctrlKey && !e.metaKey) {
        switchTab('tracking');
    }
});

function toggleShortcutHelp() {
    let panel = document.getElementById('shortcut-help-panel');
    if (panel) {
        panel.classList.toggle('show');
        if (!panel.classList.contains('show')) {
            setTimeout(() => panel.remove(), 200);
        }
        return;
    }

    panel = document.createElement('div');
    panel.id = 'shortcut-help-panel';
    panel.innerHTML = `
        <div class="shortcut-help__header">
            <h3><i class="fa-solid fa-keyboard"></i> Keyboard Shortcuts</h3>
            <button onclick="toggleShortcutHelp()" class="shortcut-help__close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="shortcut-help__body">
            <div class="shortcut-help__section">
                <h4>General</h4>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Tambah Kendaraan Baru</span>
                    <div class="shortcut-help__keys"><kbd>Ctrl</kbd><span>+</span><kbd>N</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Bayar Pajak</span>
                    <div class="shortcut-help__keys"><kbd>Ctrl</kbd><span>+</span><kbd>P</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Focus Search</span>
                    <div class="shortcut-help__keys"><kbd>Ctrl</kbd><span>+</span><kbd>F</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Tutup Modal</span>
                    <div class="shortcut-help__keys"><kbd>Esc</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Tampilkan Shortcuts</span>
                    <div class="shortcut-help__keys"><kbd>?</kbd></div>
                </div>
            </div>
            <div class="shortcut-help__section">
                <h4>Navigasi Tab</h4>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Dashboard</span>
                    <div class="shortcut-help__keys"><kbd>1</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Inventaris</span>
                    <div class="shortcut-help__keys"><kbd>2</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Perawatan</span>
                    <div class="shortcut-help__keys"><kbd>3</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Pajak & STNK</span>
                    <div class="shortcut-help__keys"><kbd>4</kbd></div>
                </div>
                <div class="shortcut-help__item">
                    <span class="shortcut-help__desc">Tracking</span>
                    <div class="shortcut-help__keys"><kbd>5</kbd></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
}

// INIT
switchTab('dashboard');
fetchAll();

// Show keyboard shortcut hint on first load
setTimeout(() => {
    showToast('Tekan ? untuk melihat keyboard shortcuts', 'info');
}, 1500);

// ============ EXPORT FUNCTIONS ============

// Helper: Get current date string for filename
function getExportDate() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

// Helper: Format currency for export
function fmtExport(n) {
    return n ? n.toLocaleString('id-ID') : '0';
}

// ============ MODERN PDF GENERATOR ============
class ModernPDFReport {
    constructor(title, subtitle) {
        const { jsPDF } = window.jspdf;
        this.doc = new jsPDF();
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.currentY = 0;
        this.margin = 15;
        this.colors = {
            primary: [142, 27, 47],      // #8E1B2F
            primaryLight: [184, 45, 69], // #B82D45
            primaryDark: [111, 21, 37],  // #6F1525
            gold: [212, 169, 50],        // #D4A932
            goldLight: [245, 220, 158],  // #F5DC9E
            teal: [31, 157, 130],        // #1F9D82
            green: [27, 165, 99],        // #1BA563
            amber: [245, 166, 35],       // #F5A623
            rose: [232, 64, 88],         // #E84058
            slate50: [250, 249, 249],    // #FAF9F9
            slate100: [245, 243, 243],   // #F5F3F3
            slate200: [232, 229, 229],   // #E8E5E5
            slate500: [115, 110, 110],   // #736E6E
            slate700: [61, 56, 56],      // #3D3838
            slate900: [26, 22, 22],      // #1A1616
            white: [255, 255, 255]
        };
        this.title = title;
        this.subtitle = subtitle;
        this.pageCount = 1;
    }

    drawHeader() {
        const doc = this.doc;

        // Header background gradient effect
        doc.setFillColor(...this.colors.primary);
        doc.rect(0, 0, this.pageWidth, 45, 'F');

        // Decorative accent bar
        doc.setFillColor(...this.colors.gold);
        doc.rect(0, 45, this.pageWidth, 2, 'F');

        // Logo area (placeholder)
        doc.setFillColor(...this.colors.white);
        doc.roundedRect(15, 10, 25, 25, 3, 3, 'F');
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...this.colors.primary);
        doc.text('VF', 22, 27);

        // Title
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...this.colors.white);
        doc.text(this.title, 48, 22);

        // Subtitle
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(255, 255, 255, 0.8);
        doc.text(this.subtitle, 48, 32);

        // Date on right
        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        doc.setFontSize(9);
        doc.setTextColor(...this.colors.white);
        doc.text(`Dicetak: ${dateStr}`, this.pageWidth - 15, 22, { align: 'right' });
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255, 0.7);
        doc.text('VeloceFleet Management System', this.pageWidth - 15, 30, { align: 'right' });

        this.currentY = 55;
    }

    drawSummaryCard(x, y, width, height, label, value, icon, color) {
        const doc = this.doc;

        // Card background
        doc.setFillColor(...this.colors.white);
        doc.setDrawColor(...this.colors.slate200);
        doc.roundedRect(x, y, width, height, 3, 3, 'FD');

        // Color accent on top
        doc.setFillColor(...color);
        doc.rect(x, y, width, 3, 'F');

        // Icon circle
        doc.setFillColor(...color);
        doc.circle(x + 12, y + 15, 6, 'F');
        doc.setFontSize(10);
        doc.setTextColor(...this.colors.white);
        doc.text(icon, x + 10, y + 18);

        // Value
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...this.colors.slate900);
        doc.text(value, x + 22, y + 18);

        // Label
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...this.colors.slate500);
        doc.text(label, x + 22, y + 25);
    }

    drawSectionTitle(title, icon) {
        const doc = this.doc;
        this.currentY += 8;

        // Section line
        doc.setDrawColor(...this.colors.primary);
        doc.setLineWidth(0.5);
        doc.line(this.margin, this.currentY, this.margin + 40, this.currentY);

        // Title
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...this.colors.primary);
        doc.text(`${icon}  ${title}`, this.margin, this.currentY + 5);

        this.currentY += 12;
    }

    drawTable(headers, data, options = {}) {
        const doc = this.doc;
        const {
            headColor = this.colors.primary,
            altRowColor = this.colors.slate50,
            fontSize = 8
        } = options;

        doc.autoTable({
            startY: this.currentY,
            head: [headers],
            body: data,
            styles: {
                fontSize: fontSize,
                cellPadding: 3,
                lineColor: this.colors.slate200,
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: headColor,
                textColor: this.colors.white,
                fontStyle: 'bold',
                fontSize: fontSize + 1
            },
            alternateRowStyles: {
                fillColor: altRowColor
            },
            margin: { left: this.margin, right: this.margin },
            didDrawPage: () => {
                this.drawFooter();
            }
        });

        this.currentY = doc.lastAutoTable.finalY + 10;
    }

    drawFooter() {
        const doc = this.doc;
        const pageHeight = this.pageHeight;

        // Footer line
        doc.setDrawColor(...this.colors.slate200);
        doc.setLineWidth(0.3);
        doc.line(this.margin, pageHeight - 15, this.pageWidth - this.margin, pageHeight - 15);

        // Footer text
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...this.colors.slate500);
        doc.text('VeloceFleet - Sistem Manajemen Inventaris Kendaraan', this.margin, pageHeight - 10);
        doc.text(`Halaman ${this.pageCount}`, this.pageWidth - this.margin, pageHeight - 10, { align: 'right' });

        this.pageCount++;
    }

    addPage() {
        this.doc.addPage();
        this.pageCount = 1;
        this.currentY = 15;
    }

    checkPageBreak(requiredSpace = 50) {
        if (this.currentY + requiredSpace > this.pageHeight - 25) {
            this.addPage();
            return true;
        }
        return false;
    }

    save(filename) {
        this.doc.save(filename);
    }
}

// ---- TAX EXPORT ----
function exportTaxExcel() {
    if (taxRecords.length === 0) {
        showToast('Tidak ada data pajak untuk diexport', 'info');
        return;
    }

    const data = taxRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        return {
            'Tanggal Bayar': formatDate(r.payment_date),
            'Plat Nomor': v ? v.plate_number : '-',
            'Kendaraan': v ? `${v.brand} ${v.model}` : '-',
            'Skema Pembayaran': r.tax_type,
            'No. Resi/SKUM': r.receipt_number,
            'Masa Berlaku Baru': formatDate(r.new_due_date),
            'Nominal (Rp)': r.amount
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Pajak');

    ws['!cols'] = [
        { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 15 }
    ];

    XLSX.writeFile(wb, `Laporan_Pajak_VeloceFleet_${getExportDate()}.xlsx`);
    showToast('Laporan pajak berhasil diexport ke Excel!');
}

function exportTaxPDF() {
    if (taxRecords.length === 0) {
        showToast('Tidak ada data pajak untuk diexport', 'info');
        return;
    }

    const report = new ModernPDFReport(
        'LAPORAN PAJAK KENDARAAN',
        'Riwayat Tanda Bukti Pelunasan Pajak (SKUM Samsat)'
    );

    report.drawHeader();

    // Summary statistics
    const totalAmount = taxRecords.reduce((sum, r) => sum + r.amount, 0);
    const annualTax = taxRecords.filter(r => r.tax_type.includes('Tahunan')).length;
    const stnkTax = taxRecords.filter(r => r.tax_type.includes('5 Tahunan')).length;

    // Summary cards
    const cardWidth = (report.pageWidth - report.margin * 2 - 10) / 3;
    report.drawSummaryCard(report.margin, report.currentY, cardWidth, 32, 'Total Pembayaran', `Rp ${fmtExport(totalAmount)}`, '$', report.colors.primary);
    report.drawSummaryCard(report.margin + cardWidth + 5, report.currentY, cardWidth, 32, 'Pajak Tahunan', `${annualTax} transaksi`, '1', report.colors.teal);
    report.drawSummaryCard(report.margin + (cardWidth + 5) * 2, report.currentY, cardWidth, 32, 'STNK 5 Tahunan', `${stnkTax} transaksi`, '5', report.colors.gold);

    report.currentY += 42;

    // Table section
    report.drawSectionTitle('Detail Riwayat Pembayaran', '');

    const tableData = taxRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        return [
            formatDate(r.payment_date),
            v ? v.plate_number : '-',
            v ? `${v.brand} ${v.model}` : '-',
            r.tax_type,
            r.receipt_number,
            formatDate(r.new_due_date),
            `Rp ${fmtExport(r.amount)}`
        ];
    });

    report.drawTable(
        ['Tgl Bayar', 'Plat', 'Kendaraan', 'Skema', 'No. Resi/SKUM', 'Masa Berlaku', 'Nominal'],
        tableData,
        { headColor: report.colors.primary, altRowColor: report.colors.primaryLight + [245, 240, 241] }
    );

    report.save(`Laporan_Pajak_VeloceFleet_${getExportDate()}.pdf`);
    showToast('Laporan pajak berhasil diexport ke PDF!');
}

// ---- MAINTENANCE EXPORT ----
function exportMaintenanceExcel() {
    if (maintenanceRecords.length === 0) {
        showToast('Tidak ada data servis untuk diexport', 'info');
        return;
    }

    const data = maintenanceRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        return {
            'Tanggal Servis': formatDate(r.service_date),
            'Plat Nomor': v ? v.plate_number : '-',
            'Kendaraan': v ? `${v.brand} ${v.model}` : '-',
            'Jenis Servis': r.service_type,
            'Bengkel': r.workshop_name,
            'Mekanik': r.mechanic_name || '-',
            'Odometer (KM)': r.odometer,
            'Rincian': r.description || '-',
            'Biaya (Rp)': r.cost
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Servis');

    ws['!cols'] = [
        { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 }
    ];

    XLSX.writeFile(wb, `Laporan_Servis_VeloceFleet_${getExportDate()}.xlsx`);
    showToast('Laporan servis berhasil diexport ke Excel!');
}

function exportMaintenancePDF() {
    if (maintenanceRecords.length === 0) {
        showToast('Tidak ada data servis untuk diexport', 'info');
        return;
    }

    const report = new ModernPDFReport(
        'LAPORAN PERAWATAN & SERVIS',
        'Riwayat Catatan Perawatan dan Faktur Bengkel'
    );

    report.drawHeader();

    // Summary statistics
    const totalCost = maintenanceRecords.reduce((sum, r) => sum + r.cost, 0);
    const avgCost = maintenanceRecords.length > 0 ? Math.round(totalCost / maintenanceRecords.length) : 0;
    const uniqueWorkshops = [...new Set(maintenanceRecords.map(r => r.workshop_name))].length;

    // Summary cards
    const cardWidth = (report.pageWidth - report.margin * 2 - 10) / 3;
    report.drawSummaryCard(report.margin, report.currentY, cardWidth, 32, 'Total Biaya Servis', `Rp ${fmtExport(totalCost)}`, '$', report.colors.amber);
    report.drawSummaryCard(report.margin + cardWidth + 5, report.currentY, cardWidth, 32, 'Rata-rata per Servis', `Rp ${fmtExport(avgCost)}`, '~', report.colors.teal);
    report.drawSummaryCard(report.margin + (cardWidth + 5) * 2, report.currentY, cardWidth, 32, 'Bengkel Terpakai', `${uniqueWorkshops} bengkel`, 'B', report.colors.primary);

    report.currentY += 42;

    // Table section
    report.drawSectionTitle('Detail Riwayat Servis', '');

    const tableData = maintenanceRecords.map(r => {
        const v = getVehicle(r.vehicle_id);
        return [
            formatDate(r.service_date),
            v ? v.plate_number : '-',
            v ? `${v.brand} ${v.model}` : '-',
            r.service_type,
            r.workshop_name,
            `${fmtExport(r.odometer)} km`,
            `Rp ${fmtExport(r.cost)}`
        ];
    });

    report.drawTable(
        ['Tanggal', 'Plat', 'Kendaraan', 'Jenis Servis', 'Bengkel', 'Odometer', 'Biaya'],
        tableData,
        { headColor: report.colors.amber, altRowColor: [255, 251, 240] }
    );

    report.save(`Laporan_Servis_VeloceFleet_${getExportDate()}.pdf`);
    showToast('Laporan servis berhasil diexport ke PDF!');
}

// ---- TRACKING EXPORT ----
function exportTrackingExcel() {
    if (tripLogs.length === 0) {
        showToast('Tidak ada data perjalanan untuk diexport', 'info');
        return;
    }

    const data = tripLogs.map(t => {
        const v = getVehicle(t.vehicle_id);
        const distance = t.end_odometer ? t.end_odometer - t.start_odometer : 0;
        return {
            'Waktu Mulai': formatDateTime(t.start_time),
            'Plat Nomor': v ? v.plate_number : '-',
            'Kendaraan': v ? `${v.brand} ${v.model}` : '-',
            'Pengemudi': t.driver_name,
            'Tujuan': t.destination,
            'Keperluan': t.purpose,
            'KM Awal': t.start_odometer,
            'KM Akhir': t.end_odometer || '-',
            'Jarak (KM)': distance,
            'Biaya BBM (Rp)': t.fuel_cost || 0,
            'Status': t.status
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Perjalanan');

    ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }
    ];

    XLSX.writeFile(wb, `Laporan_Perjalanan_VeloceFleet_${getExportDate()}.xlsx`);
    showToast('Laporan perjalanan berhasil diexport ke Excel!');
}

function exportTrackingPDF() {
    if (tripLogs.length === 0) {
        showToast('Tidak ada data perjalanan untuk diexport', 'info');
        return;
    }

    const report = new ModernPDFReport(
        'LAPORAN PERJALANAN KENDARAAN',
        'Riwayat Penggunaan dan Live Tracking'
    );

    report.drawHeader();

    // Summary statistics
    const totalFuel = tripLogs.reduce((sum, t) => sum + (t.fuel_cost || 0), 0);
    const completedTrips = tripLogs.filter(t => t.status === 'Selesai');
    const totalDistance = completedTrips.reduce((sum, t) => sum + ((t.end_odometer || 0) - t.start_odometer), 0);
    const activeTrips = tripLogs.filter(t => t.status === 'Berjalan').length;

    // Summary cards
    const cardWidth = (report.pageWidth - report.margin * 2 - 15) / 4;
    report.drawSummaryCard(report.margin, report.currentY, cardWidth, 32, 'Total Perjalanan', `${tripLogs.length} trip`, '#', report.colors.teal);
    report.drawSummaryCard(report.margin + cardWidth + 5, report.currentY, cardWidth, 32, 'Total Jarak', `${fmtExport(totalDistance)} km`, '>', report.colors.primary);
    report.drawSummaryCard(report.margin + (cardWidth + 5) * 2, report.currentY, cardWidth, 32, 'Total BBM', `Rp ${fmtExport(totalFuel)}`, '$', report.colors.gold);
    report.drawSummaryCard(report.margin + (cardWidth + 5) * 3, report.currentY, cardWidth, 32, 'Sedang Berjalan', `${activeTrips} unit`, '*', report.colors.green);

    report.currentY += 42;

    // Table section
    report.drawSectionTitle('Detail Riwayat Perjalanan', '');

    const tableData = tripLogs.map(t => {
        const v = getVehicle(t.vehicle_id);
        const distance = t.end_odometer ? t.end_odometer - t.start_odometer : '-';
        return [
            formatDateTime(t.start_time),
            v ? v.plate_number : '-',
            t.driver_name,
            t.destination,
            `${fmtExport(t.start_odometer)} - ${t.end_odometer ? fmtExport(t.end_odometer) : '-'}`,
            distance !== '-' ? `${distance} km` : '-',
            t.fuel_cost ? `Rp ${fmtExport(t.fuel_cost)}` : '-',
            t.status
        ];
    });

    report.drawTable(
        ['Waktu', 'Plat', 'Driver', 'Tujuan', 'KM Awal-Akhir', 'Jarak', 'BBM', 'Status'],
        tableData,
        { headColor: report.colors.teal, altRowColor: [240, 250, 248], fontSize: 7 }
    );

    report.save(`Laporan_Perjalanan_VeloceFleet_${getExportDate()}.pdf`);
    showToast('Laporan perjalanan berhasil diexport ke PDF!');
}

// ---- COMPREHENSIVE FULL REPORT ----
function exportFullReportPDF() {
    const hasData = vehicles.length > 0 || taxRecords.length > 0 || maintenanceRecords.length > 0 || tripLogs.length > 0;
    if (!hasData) {
        showToast('Tidak ada data untuk diexport', 'info');
        return;
    }

    const report = new ModernPDFReport(
        'LAPORAN LENGKAP FLEET MANAGEMENT',
        'VeloceFleet - Sistem Manajemen Inventaris Kendaraan'
    );

    report.drawHeader();

    // EXECUTIVE SUMMARY
    report.drawSectionTitle('RINGKASAN EKSEKUTIF', '');

    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter(v => v.status === 'Tersedia').length;
    const totalTaxCost = taxRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalMaintCost = maintenanceRecords.reduce((sum, r) => sum + r.cost, 0);
    const totalTripCost = tripLogs.reduce((sum, t) => sum + (t.fuel_cost || 0), 0);
    const grandTotal = totalTaxCost + totalMaintCost + totalTripCost;

    // Executive summary cards (2 rows)
    const cardWidth = (report.pageWidth - report.margin * 2 - 10) / 3;
    report.drawSummaryCard(report.margin, report.currentY, cardWidth, 32, 'Total Kendaraan', `${totalVehicles} unit`, 'V', report.colors.primary);
    report.drawSummaryCard(report.margin + cardWidth + 5, report.currentY, cardWidth, 32, 'Tersedia', `${availableVehicles} unit`, 'A', report.colors.green);
    report.drawSummaryCard(report.margin + (cardWidth + 5) * 2, report.currentY, cardWidth, 32, 'Total Pengeluaran', `Rp ${fmtExport(grandTotal)}`, '$', report.colors.gold);

    report.currentY += 42;

    // Cost breakdown
    const breakdownCardWidth = (report.pageWidth - report.margin * 2 - 5) / 2;
    report.drawSummaryCard(report.margin, report.currentY, breakdownCardWidth, 28, 'Biaya Pajak', `Rp ${fmtExport(totalTaxCost)}`, 'P', report.colors.primary);
    report.drawSummaryCard(report.margin + breakdownCardWidth + 5, report.currentY, breakdownCardWidth, 28, 'Biaya Servis', `Rp ${fmtExport(totalMaintCost)}`, 'S', report.colors.amber);

    report.currentY += 38;

    // VEHICLE INVENTORY
    if (vehicles.length > 0) {
        report.checkPageBreak(80);
        report.drawSectionTitle('INVENTARIS KENDARAAN', '');

        const vehicleData = vehicles.map(v => [
            v.plate_number,
            `${v.brand} ${v.model}`,
            v.year,
            v.category,
            v.pool_location,
            `${fmtExport(v.current_odometer)} km`,
            v.status
        ]);

        report.drawTable(
            ['Plat', 'Merk/Model', 'Thn', 'Kategori', 'Lokasi', 'Odometer', 'Status'],
            vehicleData,
            { headColor: report.colors.primary, fontSize: 7 }
        );
    }

    // TAX RECORDS
    if (taxRecords.length > 0) {
        report.checkPageBreak(80);
        report.drawSectionTitle('RIWAYAT PAJAK KENDARAAN', '');

        const taxData = taxRecords.map(r => {
            const v = getVehicle(r.vehicle_id);
            return [
                formatDate(r.payment_date),
                v ? v.plate_number : '-',
                r.tax_type,
                r.receipt_number,
                formatDate(r.new_due_date),
                `Rp ${fmtExport(r.amount)}`
            ];
        });

        report.drawTable(
            ['Tgl Bayar', 'Plat', 'Skema', 'No. Resi/SKUM', 'Masa Berlaku', 'Nominal'],
            taxData,
            { headColor: report.colors.primary, fontSize: 7 }
        );
    }

    // MAINTENANCE RECORDS
    if (maintenanceRecords.length > 0) {
        report.checkPageBreak(80);
        report.drawSectionTitle('RIWAYAT PERAWATAN & SERVIS', '');

        const maintData = maintenanceRecords.map(r => {
            const v = getVehicle(r.vehicle_id);
            return [
                formatDate(r.service_date),
                v ? v.plate_number : '-',
                r.service_type,
                r.workshop_name,
                `${fmtExport(r.odometer)} km`,
                `Rp ${fmtExport(r.cost)}`
            ];
        });

        report.drawTable(
            ['Tanggal', 'Plat', 'Jenis Servis', 'Bengkel', 'Odometer', 'Biaya'],
            maintData,
            { headColor: report.colors.amber, fontSize: 7 }
        );
    }

    // TRIP LOGS
    if (tripLogs.length > 0) {
        report.checkPageBreak(80);
        report.drawSectionTitle('RIWAYAT PERJALANAN', '');

        const tripData = tripLogs.map(t => {
            const v = getVehicle(t.vehicle_id);
            const distance = t.end_odometer ? t.end_odometer - t.start_odometer : '-';
            return [
                formatDateTime(t.start_time),
                v ? v.plate_number : '-',
                t.driver_name,
                t.destination,
                distance !== '-' ? `${distance} km` : '-',
                t.fuel_cost ? `Rp ${fmtExport(t.fuel_cost)}` : '-',
                t.status
            ];
        });

        report.drawTable(
            ['Waktu', 'Plat', 'Driver', 'Tujuan', 'Jarak', 'BBM', 'Status'],
            tripData,
            { headColor: report.colors.teal, fontSize: 7 }
        );
    }

    report.save(`Laporan_Lengkap_VeloceFleet_${getExportDate()}.pdf`);
    showToast('Laporan lengkap berhasil diexport ke PDF!');
}

// ---- COMBINED REPORT EXPORT (Excel) ----
function exportFullReportExcel() {
    const wb = XLSX.utils.book_new();

    // Tax sheet
    if (taxRecords.length > 0) {
        const taxData = taxRecords.map(r => {
            const v = getVehicle(r.vehicle_id);
            return {
                'Tanggal Bayar': formatDate(r.payment_date),
                'Plat Nomor': v ? v.plate_number : '-',
                'Kendaraan': v ? `${v.brand} ${v.model}` : '-',
                'Skema': r.tax_type,
                'No. Resi': r.receipt_number,
                'Masa Berlaku': formatDate(r.new_due_date),
                'Nominal (Rp)': r.amount
            };
        });
        const wsTax = XLSX.utils.json_to_sheet(taxData);
        XLSX.utils.book_append_sheet(wb, wsTax, 'Pajak');
    }

    // Maintenance sheet
    if (maintenanceRecords.length > 0) {
        const maintData = maintenanceRecords.map(r => {
            const v = getVehicle(r.vehicle_id);
            return {
                'Tanggal': formatDate(r.service_date),
                'Plat': v ? v.plate_number : '-',
                'Jenis': r.service_type,
                'Bengkel': r.workshop_name,
                'Odometer': r.odometer,
                'Biaya (Rp)': r.cost
            };
        });
        const wsMaint = XLSX.utils.json_to_sheet(maintData);
        XLSX.utils.book_append_sheet(wb, wsMaint, 'Servis');
    }

    // Tracking sheet
    if (tripLogs.length > 0) {
        const tripData = tripLogs.map(t => {
            const v = getVehicle(t.vehicle_id);
            return {
                'Waktu': formatDateTime(t.start_time),
                'Plat': v ? v.plate_number : '-',
                'Driver': t.driver_name,
                'Tujuan': t.destination,
                'KM Awal': t.start_odometer,
                'KM Akhir': t.end_odometer || '-',
                'BBM (Rp)': t.fuel_cost || 0,
                'Status': t.status
            };
        });
        const wsTrip = XLSX.utils.json_to_sheet(tripData);
        XLSX.utils.book_append_sheet(wb, wsTrip, 'Perjalanan');
    }

    if (wb.SheetNames.length === 0) {
        showToast('Tidak ada data untuk diexport', 'info');
        return;
    }

    XLSX.writeFile(wb, `Laporan_Lengkap_VeloceFleet_${getExportDate()}.xlsx`);
    showToast('Laporan lengkap berhasil diexport ke Excel!');
}
