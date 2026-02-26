/* ═══════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════ */
const STORE_KEY_PRODUCTS = 'pl_products';
const STORE_KEY_SALES    = 'pl_sales';

let state = {
  products: [],
  sales: [],
  currentSale: null,
  currentView: 'pos',
  role: null,           // 'admin' | 'cajero'  — null hasta elegir
  searchQuery: '',
  historialFilter: { date: '', method: '', q: '' },
};

const ROLES = {
  admin: {
    label: 'Administrador',
    icon:  '🔑',
    desc:  'Acceso completo al sistema',
    color: 'var(--accent)',
  },
  cajero: {
    label: 'Comprar',
    icon:  '🛍️',
    desc:  'Ventas e historial',
    color: 'var(--blue)',
  },
};

const ADMIN_PASSWORD = '1234'; // Cambia esta contraseña

/* ─── Productos semilla ─────────────────────────────────── */
const SEED_PRODUCTS = [
  { id:'p001', name:'Cuaderno Universitario 100h', category:'Cuadernos',  price:8500,  cost:5200,  code:'CU-100', barcode:'', trackInventory:true,  stock:24,  unit:'unidad' },
  { id:'p002', name:'Esfero Azul Kilométrico',     category:'Lapiceros',  price:1200,  cost:600,   code:'ESF-AZ', barcode:'', trackInventory:true,  stock:150, unit:'unidad' },
  { id:'p003', name:'Resma Papel Carta 500h',      category:'Papel',      price:16000, cost:11500, code:'RES-C',  barcode:'', trackInventory:true,  stock:30,  unit:'unidad' },
  { id:'p004', name:'Marcador Permanente Negro',   category:'Marcadores', price:2800,  cost:1400,  code:'MRK-N',  barcode:'', trackInventory:true,  stock:60,  unit:'unidad' },
  { id:'p005', name:'Cinta de Enmascarar 1"',      category:'Cintas',     price:3200,  cost:1800,  code:'CIN-1',  barcode:'', trackInventory:false, stock:0,   unit:'unidad' },
  { id:'p006', name:'Lápiz HB Mirado',             category:'Lápices',    price:700,   cost:300,   code:'LAP-HB', barcode:'', trackInventory:true,  stock:200, unit:'unidad' },
];

/* ═══════════════════════════════════════════════════════════
   PERSISTENCIA
═══════════════════════════════════════════════════════════ */
function loadData() {
  try {
    const p = localStorage.getItem(STORE_KEY_PRODUCTS);
    const s = localStorage.getItem(STORE_KEY_SALES);
    state.products = p ? JSON.parse(p) : [...SEED_PRODUCTS];
    state.sales    = s ? JSON.parse(s) : [];
  } catch(e) {
    state.products = [...SEED_PRODUCTS];
    state.sales    = [];
  }
}
function saveProducts() { localStorage.setItem(STORE_KEY_PRODUCTS, JSON.stringify(state.products)); }
function saveSales()    { localStorage.setItem(STORE_KEY_SALES,    JSON.stringify(state.sales)); }

/* ═══════════════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════════════ */
function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase(); }
function nextSaleNum()  { return String(state.sales.length + 1).padStart(5, '0'); }
function fmt(n)         { return '$ ' + Number(n || 0).toLocaleString('es-CO'); }
function fmtDate(iso)   { return new Date(iso).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' }); }

/* ═══════════════════════════════════════════════════════════
   PANTALLA DE SELECCIÓN DE PERFIL
═══════════════════════════════════════════════════════════ */
function promptAdminPassword() {
  // Inject inline password modal into the role screen
  const existing = document.getElementById('pwd-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pwd-overlay';
  overlay.innerHTML = `
    <div id="pwd-box">
      <div id="pwd-title">Acceso Administrador</div>
      <div id="pwd-sub">Ingresa la contraseña para continuar</div>
      <input type="password" id="pwd-input" class="form-control" placeholder="Contraseña"
        onkeydown="if(event.key==='Enter')checkAdminPassword(); if(event.key==='Escape')closePwdOverlay();"
        autocomplete="off"/>
      <div id="pwd-error" style="display:none">Contraseña incorrecta. Intenta de nuevo.</div>
      <div id="pwd-actions">
        <button class="btn btn-ghost" onclick="closePwdOverlay()">Cancelar</button>
        <button class="btn btn-primary" onclick="checkAdminPassword()">Ingresar</button>
      </div>
    </div>
  `;
  overlay.onclick = e => { if (e.target === overlay) closePwdOverlay(); };
  document.getElementById('role-screen').appendChild(overlay);
  setTimeout(() => document.getElementById('pwd-input')?.focus(), 80);
}

function checkAdminPassword() {
  const input = document.getElementById('pwd-input');
  if (!input) return;
  if (input.value === ADMIN_PASSWORD) {
    closePwdOverlay();
    enterAs('admin');
  } else {
    const err = document.getElementById('pwd-error');
    err.style.display = 'block';
    input.value = '';
    input.classList.add('pwd-shake');
    setTimeout(() => input.classList.remove('pwd-shake'), 400);
    input.focus();
  }
}

function closePwdOverlay() {
  document.getElementById('pwd-overlay')?.remove();
}

function enterAs(role) {
  state.role = role;

  // Ocultar pantalla de selección, mostrar app
  document.getElementById('role-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Clases en body para CSS
  document.body.classList.remove('role-admin', 'role-cajero');
  document.body.classList.add('role-' + role);

  // Topbar: badge de rol
  const r = ROLES[role];
  document.getElementById('topbar-role-icon').textContent  = r.icon;
  document.getElementById('topbar-role-label').textContent = r.label;

  // Sidebar: perfil al fondo
  document.getElementById('sidebar-profile-icon').textContent = r.icon;
  document.getElementById('sidebar-profile-name').textContent = r.label;
  document.getElementById('sidebar-profile-desc').textContent = r.desc;

  // Iniciar la app
  initNewSale();
  navigate('pos');
  toast('Bienvenido, ' + r.label, 'success');
}

function exitToRoleScreen() {
  // Confirmar si hay venta en curso con ítems
  if (state.currentSale && state.currentSale.items.length > 0) {
    openModal(
      'Cambiar perfil',
      `<div class="confirm-icon">⚠️</div>
       <div class="confirm-msg">Tienes una venta en curso. ¿Salir de todas formas?</div>
       <div class="confirm-sub">Se perderá la venta no guardada.</div>`,
      `<button class="btn btn-ghost"  onclick="closeModal()">Cancelar</button>
       <button class="btn btn-danger" onclick="confirmExit()">Salir</button>`
    );
  } else {
    confirmExit();
  }
}

function confirmExit() {
  closeModal();
  state.currentSale = null;
  state.role = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('role-screen').style.display = 'flex';
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR — colapsable a iconos
═══════════════════════════════════════════════════════════ */
function toggleSidebar() {
  document.body.classList.toggle('sidebar-expanded');
}

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
function toast(msg, type = 'success') {
  const icons = { success:'✔', error:'✖', info:'ℹ' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'✔'}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ═══════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════ */
function openModal(title, body, footer, large = false) {
  document.getElementById('modal-title').innerHTML  = title;
  document.getElementById('modal-body').innerHTML   = body;
  document.getElementById('modal-footer').innerHTML = footer;
  document.getElementById('modal-box').className    = large ? 'modal modal-lg' : 'modal';
  document.getElementById('modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════
   NAVEGACIÓN
═══════════════════════════════════════════════════════════ */
function navigate(view) {
  if (view === 'productos' && state.role === 'cajero') {
    toast('Sin acceso. Solo disponible para Administrador.', 'error');
    return;
  }
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.remove('hidden');
  const ni = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (ni) ni.classList.add('active');
  // Colapsar sidebar al navegar
  document.body.classList.remove('sidebar-expanded');
  renderView(view);
}

function renderView(view) {
  if (view === 'pos')       renderPOS();
  if (view === 'historial') renderHistorial();
  if (view === 'productos') renderProductos();
}

/* ═══════════════════════════════════════════════════════════
   VISTA POS — Nueva Venta
═══════════════════════════════════════════════════════════ */
function initNewSale() {
  state.currentSale = {
    id:        genId('VNT'),
    num:       nextSaleNum(),
    createdAt: new Date().toISOString(),
    items:     [],
    method:    null,
    client:    '',
    status:    'open',
  };
}

function calcTotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function renderPOS() {
  if (!state.currentSale) initNewSale();
  const sale  = state.currentSale;
  const total = calcTotal(sale.items);
  const count = sale.items.reduce((s, i) => s + i.qty, 0);

  document.getElementById('view-pos').innerHTML = `
    <div id="pos-layout">
      <div id="pos-left">

        <div class="page-header">
          <div>
            <div class="page-title">Nueva Venta</div>
            <div class="page-subtitle">Venta #${sale.num} · ${fmtDate(sale.createdAt)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="discardSale()">✕ Descartar</button>
        </div>

        <!-- Buscador -->
        <div class="card">
          <div class="card-body" style="padding:14px 16px">
            <div class="search-wrapper">
              <div class="search-bar" style="max-width:100%">
                <span class="search-icon">🔍</span>
                <input type="text" class="form-control" id="pos-search"
                  placeholder="Buscar producto por nombre o código…"
                  autocomplete="off"
                  oninput="onPosSearch(this.value)"
                  onkeydown="onPosSearchKey(event)"/>
              </div>
              <div class="product-search-results" id="pos-search-results" style="display:none"></div>
            </div>
          </div>
        </div>

        <!-- Catálogo rápido -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Productos</span>
            <span style="font-size:.78rem;color:var(--ink-soft)">${state.products.length} en catálogo</span>
          </div>
          ${state.products.length === 0
            ? '<div style="padding:40px;text-align:center;color:var(--ink-soft);font-size:.85rem">Sin productos. <a href="#" onclick="navigate(\'productos\')">Crear productos →</a></div>'
            : `<div class="product-grid">
                ${state.products.slice(0, 18).map(p => `
                  <div class="product-card" onclick="addToSale('${p.id}')">
                    <div class="product-card-img">
                      ${p.image
                        ? `<img src="${p.image}" alt="${p.name}"/>`
                        : `<div class="img-placeholder">
                             <div class="img-placeholder-icon">📦</div>
                             <div class="img-placeholder-text">Sin imagen</div>
                           </div>`}
                      ${p.trackInventory
                        ? `<div class="product-card-stock-badge ${p.stock > 0 ? 'in-stock' : 'out-stock'}">
                             ${p.stock > 0 ? p.stock : 'Agotado'}
                           </div>`
                        : ''}
                    </div>
                    <div class="product-card-body">
                      <div class="product-card-name">${p.name}</div>
                      <div class="product-card-cat">${p.category}</div>
                      <div class="product-card-price">${fmt(p.price)}</div>
                    </div>
                    <button class="product-card-add" onclick="event.stopPropagation();addToSale('${p.id}')">+ Agregar al carrito</button>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

      </div>
    </div>

    <!-- FAB -->
    <button id="cart-fab" onclick="toggleCart()" aria-label="Ver carrito">
      <span id="cart-fab-icon">🛒</span>
      <span id="cart-fab-label">Carrito</span>
      ${count > 0 ? `<span id="cart-fab-badge">${count}</span>` : ''}
      ${count > 0 ? `<span id="cart-fab-total">${fmt(total)}</span>` : ''}
    </button>

    <!-- Overlay -->
    <div id="cart-overlay" onclick="closeCart()"></div>

    <!-- Drawer -->
    <div id="cart-drawer">
      <div id="cart-drawer-header">
        <div>
          <div class="drawer-title">Papel <span>&</span> Luna</div>
          <div class="drawer-sub">Venta #${sale.num} · ${count > 0 ? count + ' producto' + (count !== 1 ? 's' : '') : 'carrito vacío'}</div>
        </div>
        <div id="cart-drawer-header-actions">
          ${sale.items.length > 0
            ? `<button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.15);font-size:.72rem" onclick="clearSale()">Limpiar</button>`
            : ''}
          <button id="cart-close-btn" onclick="closeCart()">✕</button>
        </div>
      </div>

      <div id="cart-drawer-items">
        ${sale.items.length === 0
          ? `<div class="empty-state" style="padding:60px 20px">
              <div class="big-icon">🛒</div>
              <h3>Carrito vacío</h3>
              <p>Selecciona productos del catálogo para agregarlos aquí</p>
             </div>`
          : sale.items.map((item, i) => `
              <div class="pos-item pop">
                <div class="pos-item-thumb">📦</div>
                <div class="pos-item-info">
                  <div class="pos-item-name">${item.name}</div>
                  <div class="pos-item-cat">${item.category}</div>
                  <div class="pos-item-price">${fmt(item.price)} c/u</div>
                </div>
                <div class="pos-item-right">
                  <div class="pos-item-subtotal">${fmt(item.price * item.qty)}</div>
                  <div class="qty-ctrl">
                    <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${i},  1)">+</button>
                  </div>
                  <button class="pos-item-remove" onclick="removeItem(${i})" title="Eliminar">✕</button>
                </div>
              </div>
            `).join('')}
      </div>

      <div id="cart-drawer-totals">
        <div class="total-row"><span>Subtotal</span><span>${fmt(total)}</span></div>
        <div class="total-row grand"><span>Total</span><span>${fmt(total)}</span></div>
      </div>

      <div id="cart-drawer-actions">
        <button class="cart-cobrar-btn"
          ${sale.items.length === 0 ? 'disabled' : ''}
          onclick="openCobro()">
          <span class="cobrar-label">Cobrar ahora</span>
          <span class="cobrar-total">${fmt(total)}</span>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="saveSaleOpen()" style="width:100%;justify-content:center">
          Guardar para después
        </button>
      </div>
    </div>
  `;
}

/* ─── Drawer carrito ─────────────────────────────────────── */
function toggleCart() {
  const drawer  = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  if (isOpen) { closeCart(); }
  else { drawer.classList.add('open'); overlay.classList.add('visible'); }
}
function closeCart() {
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('visible');
}
function isCartOpen() {
  return document.getElementById('cart-drawer')?.classList.contains('open') || false;
}
function restoreCartState(wasOpen) {
  if (wasOpen) {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('visible');
  }
}

/* ─── Búsqueda en POS ────────────────────────────────────── */
function onPosSearch(q) {
  state.searchQuery = q;
  const res = document.getElementById('pos-search-results');
  if (!q.trim()) { res.style.display = 'none'; return; }
  const matches = state.products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.code.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);
  if (!matches.length) {
    res.style.display = 'block';
    res.innerHTML = '<div style="padding:14px;text-align:center;font-size:.82rem;color:var(--ink-soft)">Sin resultados</div>';
    return;
  }
  res.style.display = 'block';
  res.innerHTML = matches.map(p => `
    <div class="search-result-item"
      onclick="addToSale('${p.id}');
               document.getElementById('pos-search').value='';
               document.getElementById('pos-search-results').style.display='none'">
      <div>
        <div class="sri-name">${p.name}</div>
        <div class="sri-cat">${p.category} · ${p.code}</div>
        ${p.trackInventory ? `<div class="sri-stock">Stock: ${p.stock}</div>` : ''}
      </div>
      <div class="sri-price">${fmt(p.price)}</div>
    </div>
  `).join('');
}
function onPosSearchKey(e) {
  if (e.key === 'Escape') document.getElementById('pos-search-results').style.display = 'none';
}
document.addEventListener('click', e => {
  const res = document.getElementById('pos-search-results');
  if (res && !e.target.closest('.search-wrapper')) res.style.display = 'none';
});

/* ─── Carrito — operaciones ──────────────────────────────── */
function addToSale(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;

  // Bloquear si no tiene stock
  if (p.trackInventory && p.stock <= 0) {
    toast('Sin stock disponible para ' + p.name, 'error');
    return;
  }

  const existing = state.currentSale.items.find(i => i.productId === productId);
  if (existing) {
    // No superar el stock disponible
    if (p.trackInventory && existing.qty >= p.stock) {
      toast('Stock máximo alcanzado (' + p.stock + ' unidades)', 'error');
      return;
    }
    existing.qty += 1;
  } else {
    state.currentSale.items.push({
      productId: p.id, name: p.name, category: p.category,
      price: p.price, cost: p.cost, qty: 1, trackInventory: p.trackInventory,
    });
  }
  const wasOpen = isCartOpen();
  renderPOS();
  restoreCartState(wasOpen);
  const badge = document.getElementById('cart-fab-badge');
  if (badge) { badge.classList.remove('bounce'); void badge.offsetWidth; badge.classList.add('bounce'); }
}
function changeQty(index, delta) {
  const item = state.currentSale.items[index];
  if (!item) return;
  if (delta > 0 && item.trackInventory) {
    const p = state.products.find(x => x.id === item.productId);
    if (p && item.qty >= p.stock) {
      toast('Stock máximo disponible: ' + p.stock + ' unidades', 'error');
      return;
    }
  }
  item.qty = Math.max(1, item.qty + delta);
  const wasOpen = isCartOpen();
  renderPOS();
  restoreCartState(wasOpen);
}
function removeItem(index) {
  state.currentSale.items.splice(index, 1);
  const wasOpen = isCartOpen();
  renderPOS();
  restoreCartState(wasOpen);
}
function clearSale() {
  if (!state.currentSale.items.length) return;
  openModal(
    'Limpiar carrito',
    `<div class="confirm-icon">🗑️</div>
     <div class="confirm-msg">¿Eliminar todos los productos del carrito?</div>`,
    `<button class="btn btn-ghost"  onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmClear()">Sí, limpiar</button>`
  );
}
function confirmClear() {
  state.currentSale.items = [];
  closeModal();
  const wasOpen = isCartOpen();
  renderPOS();
  restoreCartState(wasOpen);
}
function discardSale() {
  openModal(
    'Descartar venta',
    `<div class="confirm-icon">⚠️</div>
     <div class="confirm-msg">¿Descartar esta venta e iniciar una nueva?</div>`,
    `<button class="btn btn-ghost"  onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmDiscard()">Descartar</button>`
  );
}
function confirmDiscard() {
  state.currentSale = null;
  closeModal();
  initNewSale();
  renderPOS();
}
function saveSaleOpen() { toast('Venta guardada como abierta', 'info'); }

/* ═══════════════════════════════════════════════════════════
   COBRO
═══════════════════════════════════════════════════════════ */
function openCobro() {
  const total = calcTotal(state.currentSale.items);
  openModal('Cobrar venta', `
    <div class="form-grid" style="gap:16px">
      <div class="form-group">
        <label>Total a cobrar</label>
        <div style="font-family:'DM Serif Display',serif;font-size:1.6rem;color:var(--accent)">${fmt(total)}</div>
      </div>
      <div class="form-group">
        <label>Método de pago</label>
        <select class="form-control" id="cobro-method" onchange="onMethodChange()">
          <option value="">— Seleccionar —</option>
          <option value="efectivo">💵 Efectivo</option>
          <option value="nequi">📱 Nequi</option>
          <option value="debe">📒 Debe (Cuenta por cobrar)</option>
        </select>
      </div>
      <div id="efectivo-section" style="display:none" class="form-grid form-grid-2">
        <div class="form-group">
          <label>Valor recibido</label>
          <input type="number" class="form-control" id="cobro-recibido" placeholder="0" oninput="calcCambio()" min="0" step="100"/>
        </div>
        <div class="form-group">
          <label>Cambio</label>
          <div class="form-control" id="cobro-cambio" style="background:var(--paper);font-weight:600;color:var(--green)">$ 0</div>
        </div>
      </div>
      <div id="debe-section" style="display:none">
        <div class="form-group">
          <label>Cliente</label>
          <input type="text" class="form-control" id="cobro-cliente" placeholder="Nombre del cliente (obligatorio)"/>
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-ghost"          onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary btn-lg" onclick="confirmCobro()">Confirmar pago</button>
  `);
}
function onMethodChange() {
  const m = document.getElementById('cobro-method').value;
  document.getElementById('efectivo-section').style.display = m === 'efectivo' ? 'grid'  : 'none';
  document.getElementById('debe-section').style.display     = m === 'debe'     ? 'block' : 'none';
}
function calcCambio() {
  const total  = calcTotal(state.currentSale.items);
  const rec    = parseFloat(document.getElementById('cobro-recibido').value) || 0;
  const cambio = rec - total;
  const el = document.getElementById('cobro-cambio');
  el.textContent = fmt(Math.max(0, cambio));
  el.style.color = cambio < 0 ? '#b91c1c' : 'var(--green)';
}
function confirmCobro() {
  const method = document.getElementById('cobro-method').value;
  if (!method) { toast('Selecciona un método de pago', 'error'); return; }
  const total = calcTotal(state.currentSale.items);
  if (method === 'efectivo') {
    const rec = parseFloat(document.getElementById('cobro-recibido').value) || 0;
    if (rec < total) { toast('El valor recibido es menor al total', 'error'); return; }
    state.currentSale.received = rec;
    state.currentSale.change   = rec - total;
  }
  if (method === 'debe') {
    const cliente = document.getElementById('cobro-cliente').value.trim();
    if (!cliente) { toast('Ingresa el nombre del cliente', 'error'); return; }
    state.currentSale.client = cliente;
  }
  state.currentSale.method   = method;
  state.currentSale.status   = 'closed';
  state.currentSale.closedAt = new Date().toISOString();
  state.currentSale.total    = total;
  state.currentSale.items.forEach(item => {
    if (item.trackInventory) {
      const p = state.products.find(x => x.id === item.productId);
      if (p) p.stock = Math.max(0, (p.stock || 0) - item.qty);
    }
  });
  saveProducts();
  state.sales.unshift({ ...state.currentSale });
  saveSales();
  const ventaCerrada = { ...state.currentSale };
  state.currentSale = null;
  closeModal();
  initNewSale();
  renderPOS();
  showVentaConfirmada(ventaCerrada);
}
function showVentaConfirmada(sale) {
  const methodLabel = { efectivo:'Efectivo', nequi:'Nequi', debe:'Debe' }[sale.method] || sale.method;
  openModal('Venta confirmada', `
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-size:3rem;margin-bottom:8px">✅</div>
      <div style="font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--green)">¡Venta cerrada!</div>
      <div style="font-size:.85rem;color:var(--ink-soft);margin-top:4px">Venta #${sale.num} · ${methodLabel}</div>
      <div style="font-size:1.8rem;font-weight:700;color:var(--ink);margin:14px 0">${fmt(sale.total)}</div>
      ${sale.method === 'efectivo' ? `
        <div style="display:flex;justify-content:center;gap:24px;font-size:.85rem;color:var(--ink-mid)">
          <span>Recibido: <b>${fmt(sale.received)}</b></span>
          <span>Cambio: <b style="color:var(--green)">${fmt(sale.change)}</b></span>
        </div>` : ''}
      ${sale.method === 'debe' ? `
        <div style="font-size:.85rem;color:var(--gold)">📒 Cuenta por cobrar a: <b>${sale.client}</b></div>` : ''}
    </div>
  `, `
    <button class="btn btn-ghost"     onclick="closeModal()">🛒 Nueva venta</button>
    <button class="btn btn-secondary" onclick="closeModal();viewFactura('${sale.id}')">🧾 Ver factura</button>
    <button class="btn btn-primary"   onclick="closeModal()">Continuar</button>
  `);
}

/* ═══════════════════════════════════════════════════════════
   FACTURA
═══════════════════════════════════════════════════════════ */
function viewFactura(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) { toast('Venta no encontrada', 'error'); return; }
  const methodLabel = { efectivo:'Efectivo', nequi:'Nequi', debe:'Debe' }[sale.method] || sale.method;
  openModal('Factura / Comprobante', `
    <div class="factura">
      <div class="factura-logo">Papel <span>&</span> Luna</div>
      <div class="factura-info">Papelería y Miscelánea · NIT 900.123.456-7<br>Calle 45 #12-34 · Tel. 310 000 0000</div>
      <hr class="factura-divider"/>
      <div class="factura-meta">
        <span><b>Comprobante #</b> ${sale.num}</span>
        <span><b>Fecha:</b> ${fmtDate(sale.closedAt)}</span>
        <span><b>Método:</b> ${methodLabel}</span>
        ${sale.client ? `<span><b>Cliente:</b> ${sale.client}</span>` : ''}
      </div>
      <hr class="factura-divider"/>
      <div class="factura-items-header">
        <span>Producto</span><span style="text-align:right">Cant.</span>
        <span style="text-align:right">Precio</span><span style="text-align:right">Subtotal</span>
      </div>
      ${sale.items.map(item => `
        <div class="factura-item-row">
          <span>${item.name}</span>
          <span style="text-align:right">${item.qty}</span>
          <span style="text-align:right">${fmt(item.price)}</span>
          <span style="text-align:right;font-weight:600">${fmt(item.price * item.qty)}</span>
        </div>`).join('')}
      <div class="factura-totals">
        <div class="row"><span>Subtotal</span><b>${fmt(sale.total)}</b></div>
        <div class="row grand"><span>TOTAL</span><b>${fmt(sale.total)}</b></div>
        ${sale.method === 'efectivo' ? `
          <div class="row"><span>Recibido</span><b>${fmt(sale.received)}</b></div>
          <div class="row"><span>Cambio</span><b style="color:var(--green)">${fmt(sale.change)}</b></div>` : ''}
      </div>
      <div class="factura-footer">¡Gracias por tu compra!<br>Papel & Luna — Tu papelería de confianza</div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Cerrar</button>`, true);
}

/* ═══════════════════════════════════════════════════════════
   HISTORIAL
═══════════════════════════════════════════════════════════ */
function renderHistorial() {
  const f = state.historialFilter;
  let filtered = [...state.sales];
  if (f.date)   filtered = filtered.filter(s => s.closedAt && s.closedAt.startsWith(f.date));
  if (f.method) filtered = filtered.filter(s => s.method === f.method);
  if (f.q)      filtered = filtered.filter(s =>
    s.num.includes(f.q) || (s.client || '').toLowerCase().includes(f.q.toLowerCase())
  );
  const mc = { efectivo:'badge-green', nequi:'badge-blue', debe:'badge-gold' };
  const ml = { efectivo:'💵 Efectivo', nequi:'📱 Nequi', debe:'📒 Debe' };

  document.getElementById('view-historial').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Historial de Ventas</div>
        <div class="page-subtitle">${state.sales.length} ventas registradas</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:10px">
        <span class="card-title">Ventas cerradas</span>
        <div class="filters-row">
          <input type="text" class="form-control" style="max-width:160px" placeholder="Buscar #, cliente…"
            value="${f.q}" oninput="setHistFilter('q', this.value)"/>
          <input type="date" class="form-control" style="max-width:160px"
            value="${f.date}" onchange="setHistFilter('date', this.value)"/>
          <select class="form-control" style="max-width:150px" onchange="setHistFilter('method', this.value)">
            <option value="">Todos los métodos</option>
            <option value="efectivo" ${f.method==='efectivo'?'selected':''}>Efectivo</option>
            <option value="nequi"    ${f.method==='nequi'   ?'selected':''}>Nequi</option>
            <option value="debe"     ${f.method==='debe'    ?'selected':''}>Debe</option>
          </select>
          ${f.date||f.method||f.q ? `<button class="btn btn-ghost btn-sm" onclick="clearHistFilter()">✕ Limpiar</button>` : ''}
        </div>
      </div>
      <div class="table-wrap">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="big-icon">📋</div>
            <h3>Sin ventas</h3>
            <p>${state.sales.length === 0 ? 'Aún no se han registrado ventas.' : 'No hay resultados con ese filtro.'}</p>
          </div>` : `
          <table>
            <thead><tr>
              <th>#</th><th>Fecha</th><th>Ítems</th><th>Método</th><th>Cliente</th>
              <th style="text-align:right">Total</th><th style="text-align:right">Acciones</th>
            </tr></thead>
            <tbody>
              ${filtered.map(s => `
                <tr>
                  <td><b>${s.num}</b></td>
                  <td style="white-space:nowrap">${fmtDate(s.closedAt)}</td>
                  <td>${s.items.length} ítem${s.items.length!==1?'s':''}</td>
                  <td><span class="badge ${mc[s.method]||'badge-gray'}">${ml[s.method]||s.method}</span></td>
                  <td>${s.client||'—'}</td>
                  <td style="text-align:right;font-weight:700">${fmt(s.total)}</td>
                  <td><div class="td-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewSaleDetail('${s.id}')">Ver</button>
                    <button class="btn btn-ghost btn-sm"     onclick="viewFactura('${s.id}')">🧾</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>`}
      </div>
    </div>
  `;
}
function setHistFilter(key, val) { state.historialFilter[key] = val; renderHistorial(); }
function clearHistFilter() { state.historialFilter = { date:'', method:'', q:'' }; renderHistorial(); }

function viewSaleDetail(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;
  const ml = { efectivo:'💵 Efectivo', nequi:'📱 Nequi', debe:'📒 Debe' }[sale.method] || sale.method;
  openModal('Detalle de venta #' + sale.num, `
    <div class="form-grid" style="gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div><div style="font-size:.72rem;color:var(--ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Venta</div><div style="font-weight:700">#${sale.num}</div></div>
        <div><div style="font-size:.72rem;color:var(--ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Fecha</div><div>${fmtDate(sale.closedAt)}</div></div>
        <div><div style="font-size:.72rem;color:var(--ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Pago</div><div>${ml}</div></div>
        ${sale.client ? `<div><div style="font-size:.72rem;color:var(--ink-soft);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Cliente</div><div>${sale.client}</div></div>` : ''}
      </div>
      <hr class="divider"/>
      <div>
        ${sale.items.map(item => `
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--sand);font-size:.85rem">
            <div><b>${item.name}</b> <span style="color:var(--ink-soft)">× ${item.qty}</span></div>
            <div style="font-weight:600">${fmt(item.price * item.qty)}</div>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:1rem;font-weight:700">
          <span>TOTAL</span><span>${fmt(sale.total)}</span>
        </div>
        ${sale.method === 'efectivo' ? `
          <div style="display:flex;gap:20px;font-size:.82rem;color:var(--ink-soft);margin-top:6px">
            <span>Recibido: <b>${fmt(sale.received)}</b></span>
            <span>Cambio: <b style="color:var(--green)">${fmt(sale.change)}</b></span>
          </div>` : ''}
      </div>
    </div>
  `, `
    <button class="btn btn-ghost"     onclick="closeModal()">Cerrar</button>
    <button class="btn btn-secondary" onclick="closeModal();viewFactura('${sale.id}')">🧾 Ver factura</button>
  `, true);
}

/* ═══════════════════════════════════════════════════════════
   PRODUCTOS — CRUD
═══════════════════════════════════════════════════════════ */
function renderProductos() {
  const q = state.searchQuery;
  let list = state.products;
  if (q) list = list.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase()) ||
    p.code.toLowerCase().includes(q.toLowerCase())
  );

  document.getElementById('view-productos').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Productos</div>
        <div class="page-subtitle">Catálogo e inventario</div>
      </div>
      <button class="btn btn-primary" onclick="openProductForm()">+ Nuevo producto</button>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total productos</div>
        <div class="stat-value">${state.products.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Con inventario</div>
        <div class="stat-value">${state.products.filter(p=>p.trackInventory).length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sin stock</div>
        <div class="stat-value" style="color:${state.products.filter(p=>p.trackInventory&&p.stock<=0).length>0?'#b91c1c':'var(--green)'}">
          ${state.products.filter(p=>p.trackInventory&&p.stock<=0).length}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Listado</span>
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" class="form-control" placeholder="Buscar por nombre, categoría…"
            value="${state.searchQuery}"
            oninput="state.searchQuery=this.value; renderProductos()"/>
        </div>
      </div>
      <div class="table-wrap">
        ${list.length === 0 ? `
          <div class="empty-state">
            <div class="big-icon">📦</div>
            <h3>Sin productos</h3>
            <p>${state.products.length===0?'Crea tu primer producto.':'No hay resultados.'}</p>
          </div>` : `
          <table>
            <thead><tr>
              <th>Nombre</th><th>Categoría</th><th>Código</th>
              <th style="text-align:right">Costo</th><th style="text-align:right">Precio</th>
              <th style="text-align:center">Stock</th><th style="text-align:right">Acciones</th>
            </tr></thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  <td><b>${p.name}</b></td>
                  <td><span class="badge badge-gray">${p.category}</span></td>
                  <td style="font-family:monospace;font-size:.8rem;color:var(--ink-soft)">${p.code}</td>
                  <td style="text-align:right;color:var(--ink-soft)">${fmt(p.cost)}</td>
                  <td style="text-align:right;font-weight:600;color:var(--accent)">${fmt(p.price)}</td>
                  <td style="text-align:center">
                    ${p.trackInventory
                      ? `<span class="badge ${p.stock>5?'badge-green':p.stock>0?'badge-gold':'badge-red'}">${p.stock}</span>`
                      : '<span class="badge badge-gray">—</span>'}
                  </td>
                  <td><div class="td-actions">
                    <button class="btn btn-secondary btn-sm" onclick="openProductForm('${p.id}')">Editar</button>
                    <button class="btn btn-danger btn-sm"    onclick="confirmDeleteProduct('${p.id}')">Eliminar</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>`}
      </div>
    </div>
  `;
}

function genProductCode() { return 'PRD-' + String(state.products.length + 1).padStart(3, '0'); }

function openProductForm(productId) {
  const isEdit = !!productId;
  const p = isEdit ? state.products.find(x => x.id === productId) : null;
  openModal(isEdit ? 'Editar producto' : 'Nuevo producto', `
    <div class="form-grid">
      <div class="form-grid form-grid-2">
        <div class="form-group" id="fg-name">
          <label>Nombre <span style="color:var(--accent)">*</span></label>
          <input type="text" class="form-control" id="p-name" value="${p?p.name:''}" placeholder="Ej. Cuaderno universitario"/>
          <div class="form-error">Campo obligatorio</div>
        </div>
        <div class="form-group" id="fg-category">
          <label>Categoría <span style="color:var(--accent)">*</span></label>
          <input type="text" class="form-control" id="p-category" value="${p?p.category:''}" placeholder="Ej. Cuadernos"/>
          <div class="form-error">Campo obligatorio</div>
        </div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group" id="fg-price">
          <label>Precio de venta <span style="color:var(--accent)">*</span></label>
          <input type="number" class="form-control" id="p-price" value="${p?p.price:''}" placeholder="0" min="0" step="50"/>
          <div class="form-error">Ingresa un valor válido (≥ 0)</div>
        </div>
        <div class="form-group" id="fg-cost">
          <label>Costo de compra</label>
          <input type="number" class="form-control" id="p-cost" value="${p?p.cost:''}" placeholder="0" min="0" step="50"/>
          <div class="form-error">Ingresa un valor válido (≥ 0)</div>
        </div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Código interno</label>
          <input type="text" class="form-control" id="p-code" value="${p?p.code:genProductCode()}" placeholder="Ej. CU-001"/>
          <div class="form-hint">Sugerido automáticamente. Puedes editarlo.</div>
        </div>
        <div class="form-group">
          <label>Código de barras</label>
          <input type="text" class="form-control" id="p-barcode" value="${p?p.barcode:''}" placeholder="Opcional"/>
        </div>
      </div>
      <div class="form-group">
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Seguimiento de inventario</div>
            <div class="form-hint">Activar para controlar stock</div>
          </div>
          <input type="checkbox" class="toggle" id="p-track" ${p&&p.trackInventory?'checked':''}
            onchange="document.getElementById('stock-row').style.display=this.checked?'grid':'none'"/>
        </div>
      </div>
      <div class="form-grid form-grid-2" id="stock-row" style="display:${!p||p.trackInventory?'grid':'none'}">
        <div class="form-group" id="fg-stock">
          <label>Stock actual</label>
          <input type="number" class="form-control" id="p-stock" value="${p?p.stock:0}" min="0"/>
          <div class="form-error">Ingresa un valor válido (≥ 0)</div>
        </div>
      </div>

      <div class="form-group">
        <label>Imagen del producto</label>
        <div class="img-upload-area" id="img-upload-area" onclick="document.getElementById('p-image-file').click()">
          ${p&&p.image
            ? `<img id="img-preview" src="${p.image}" alt="preview"/>`
            : `<div id="img-upload-placeholder">
                <div class="img-upload-icon">📷</div>
                <div class="img-upload-text">Haz clic para subir una imagen</div>
                <div class="img-upload-hint">JPG, PNG, WEBP — máx. 2 MB</div>
               </div>`}
        </div>
        <input type="file" id="p-image-file" accept="image/*" style="display:none"
          onchange="previewProductImage(this)"/>
        ${p&&p.image ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;width:fit-content" onclick="removeProductImage()">✕ Quitar imagen</button>` : ''}
      </div>
    </div>
  `, `
    <button class="btn btn-ghost"   onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveProduct(${isEdit?`'${productId}'`:'null'})">
      ${isEdit ? 'Guardar cambios' : 'Crear producto'}
    </button>
  `, true);
}

function saveProduct(productId) {
  let valid = true;
  const nameEl  = document.getElementById('p-name');
  const catEl   = document.getElementById('p-category');
  const priceEl = document.getElementById('p-price');
  const costEl  = document.getElementById('p-cost');
  const stockEl = document.getElementById('p-stock');
  const trackEl = document.getElementById('p-track');
  const clearErr = id => document.getElementById(id).classList.remove('has-error');
  const setErr   = id => { document.getElementById(id).classList.add('has-error'); valid = false; };
  clearErr('fg-name'); clearErr('fg-price'); clearErr('fg-cost'); clearErr('fg-stock');
  if (!nameEl.value.trim()) setErr('fg-name');
  if (priceEl.value===''||isNaN(priceEl.value)||parseFloat(priceEl.value)<0) setErr('fg-price');
  if (costEl.value!==''&&(isNaN(costEl.value)||parseFloat(costEl.value)<0))  setErr('fg-cost');
  if (trackEl.checked&&(stockEl.value===''||isNaN(stockEl.value)||parseInt(stockEl.value)<0)) setErr('fg-stock');
  if (!valid) { toast('Revisa los campos con error', 'error'); return; }
  const imgPreview = document.getElementById('img-preview');
  const imageData = imgPreview ? imgPreview.src : (window._productImageRemoved ? '' : (state.products.find(x=>x.id===productId)||{}).image || '');
  window._productImageRemoved = false;
  const data = {
    name: nameEl.value.trim(), category: catEl.value.trim()||'General',
    price: parseFloat(priceEl.value), cost: costEl.value!==''?parseFloat(costEl.value):0,
    code: document.getElementById('p-code').value.trim()||genProductCode(),
    barcode: document.getElementById('p-barcode').value.trim(),
    trackInventory: trackEl.checked,
    stock: trackEl.checked ? parseInt(stockEl.value)||0 : 0,
    unit: 'unidad',
    image: imageData || '',
  };
  if (productId) {
    const idx = state.products.findIndex(p => p.id === productId);
    state.products[idx] = { ...state.products[idx], ...data };
    toast('Producto actualizado ✔');
  } else {
    state.products.push({ id: genId('PRD'), ...data });
    toast('Producto creado ✔');
  }
  saveProducts();
  closeModal();
  renderProductos();
}

function confirmDeleteProduct(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  openModal('Eliminar producto', `
    <div class="confirm-icon">⚠️</div>
    <div class="confirm-msg">¿Eliminar "<b>${p.name}</b>"?</div>
    <div class="confirm-sub">Esta acción no se puede deshacer.</div>
  `, `
    <button class="btn btn-ghost"  onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="deleteProduct('${productId}')">Eliminar</button>
  `);
}
function deleteProduct(productId) {
  state.products = state.products.filter(p => p.id !== productId);
  saveProducts();
  closeModal();
  toast('Producto eliminado', 'info');
  renderProductos();
}


/* ─── Imagen de producto ─────────────────────────────────── */
function previewProductImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 2 * 1024 * 1024) { toast('La imagen supera 2 MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const area = document.getElementById('img-upload-area');
    area.innerHTML = `<img id="img-preview" src="${e.target.result}" alt="preview"/>`;
    // Show remove button
    const existing = area.nextElementSibling?.nextElementSibling;
    if (!existing || existing.tagName !== 'BUTTON') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost btn-sm';
      btn.style = 'margin-top:6px;width:fit-content';
      btn.textContent = '✕ Quitar imagen';
      btn.onclick = removeProductImage;
      area.parentNode.insertBefore(btn, area.nextSibling.nextSibling);
    }
  };
  reader.readAsDataURL(file);
}
function removeProductImage() {
  window._productImageRemoved = true;
  const area = document.getElementById('img-upload-area');
  area.innerHTML = `<div id="img-upload-placeholder">
    <div class="img-upload-icon">📷</div>
    <div class="img-upload-text">Haz clic para subir una imagen</div>
    <div class="img-upload-hint">JPG, PNG, WEBP — máx. 2 MB</div>
  </div>`;
  // Remove button
  const btn = area.parentNode.querySelector('button');
  if (btn) btn.remove();
}

/* ═══════════════════════════════════════════════════════════
   ARRANQUE — solo carga datos, no entra a la app todavía
═══════════════════════════════════════════════════════════ */
loadData();
