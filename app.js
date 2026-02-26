

function formatCOP(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function pad(num, size) {
  return String(num).padStart(size, "0");
}

function nowISO() {
  return new Date().toISOString();
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value) {
  return Math.max(0, toNumber(value, 0));
}

function makeProductCode(id) {
  return `P${pad(id, 4)}`;
}

function makeSaleId() {

  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  const hh = pad(d.getHours(), 2);
  const mm = pad(d.getMinutes(), 2);
  const ss = pad(d.getSeconds(), 2);
  return `V-${y}${m}${day}-${hh}${mm}${ss}`;
}

const Storage = {
  KEYS: {
    PRODUCTS: "pos_papel_y_luna_products_v1",
    SALES: "pos_papel_y_luna_sales_v1",
  },

  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function defaultProductsSeed() {

  const base = [
    { id: 1, name: "Cuaderno Profesional", category: "Cuadernos", price: 12500, cost: 8000, trackInventory: true, stock: 20 },
    { id: 2, name: "Lapicero Negro", category: "Escritura", price: 2200, cost: 900, trackInventory: true, stock: 60 },
    { id: 3, name: "Resaltador Amarillo", category: "Escritura", price: 4500, cost: 2000, trackInventory: true, stock: 40 },
    { id: 4, name: "Regla 30 cm", category: "Útiles", price: 3000, cost: 1400, trackInventory: true, stock: 25 },
    { id: 5, name: "Borrador", category: "Útiles", price: 1000, cost: 400, trackInventory: true, stock: 80 },
    { id: 6, name: "Lápiz", category: "Útiles", price: 1500, cost: 600, trackInventory: true, stock: 100 },
    { id: 7, name: "Marcador Permanente", category: "Útiles", price: 3000, cost: 1400, trackInventory: true, stock: 30 },
    { id: 8, name: "Tijeras", category: "Útiles", price: 5000, cost: 2600, trackInventory: true, stock: 15 },
    { id: 9, name: "Pegastick", category: "Útiles", price: 6000, cost: 3200, trackInventory: true, stock: 18 },
    { id: 10, name: "Carpeta", category: "Cuadernos", price: 7000, cost: 3500, trackInventory: true, stock: 22 },
    { id: 11, name: "Calculadora", category: "Útiles", price: 149000, cost: 110000, trackInventory: true, stock: 6 },
    { id: 12, name: "Post-it", category: "Útiles", price: 15000, cost: 9000, trackInventory: true, stock: 12 },
  ];

  return base.map((p) => ({
    ...p,
    code: makeProductCode(p.id),
  }));
}

const state = {
  products: [],
  sales: [],
  currentSale: {
    items: [], 
    payment: { method: "Efectivo", cashReceived: 0, change: 0 },
  },
  ui: {
    currentView: "saleView",
    editingProductId: null,
    lastSaleId: null,
  },
};

function loadData() {
  const storedProducts = Storage.load(Storage.KEYS.PRODUCTS, null);
  const storedSales = Storage.load(Storage.KEYS.SALES, []);

  const seed = defaultProductsSeed();
  const rawProducts = Array.isArray(storedProducts) && storedProducts.length ? storedProducts : seed;

  state.products = rawProducts.map((p, idx) => {
    const id = toNumber(p.id, idx + 1);
    const price = nonNegative(p.price);
    const cost = nonNegative(p.cost);
    const trackInventory = Boolean(p.trackInventory);
    const stock = nonNegative(p.stock);

    return {
      id,
      code: p.code || makeProductCode(id),
      name: String(p.name || "Producto").trim(),
      category: String(p.category || "General").trim(),
      price,
      cost,
      trackInventory,
      stock: trackInventory ? stock : 0,
    };
  });

  Storage.save(Storage.KEYS.PRODUCTS, state.products);

  state.sales = Array.isArray(storedSales) ? storedSales : [];
}

function persistProducts() {
  Storage.save(Storage.KEYS.PRODUCTS, state.products);
}

function persistSales() {
  Storage.save(Storage.KEYS.SALES, state.sales);
}

const goSaleBtn = document.querySelector("#goSaleBtn");
const goSalesBtn = document.querySelector("#goSalesBtn");
const goProductsBtn = document.querySelector("#goProductsBtn");

const saleView = document.querySelector("#saleView");
const saleConfirmationView = document.querySelector("#saleConfirmationView");
const salesView = document.querySelector("#salesView");
const invoiceView = document.querySelector("#invoiceView");
const productsView = document.querySelector("#productsView");

const headerSaleTotalSpan = document.querySelector("#headerSaleTotal");

const saleSearchInput = document.querySelector("#saleSearchInput");
const saleProductsDiv = document.querySelector("#saleProducts");
const saleCartDiv = document.querySelector("#saleCart");
const emptySaleP = document.querySelector("#emptySale");
const saleTotalSpan = document.querySelector("#saleTotal");
const clearSaleBtn = document.querySelector("#clearSaleBtn");

const paymentMethodSelect = document.querySelector("#paymentMethod");
const cashFieldsDiv = document.querySelector("#cashFields");
const cashReceivedInput = document.querySelector("#cashReceived");
const cashChangeSpan = document.querySelector("#cashChange");
const confirmSaleBtn = document.querySelector("#confirmSaleBtn");
const newSaleBtn = document.querySelector("#newSaleBtn");
const saleMessageP = document.querySelector("#saleMessage");

const confirmationText = document.querySelector("#confirmationText");
const confirmationNewSaleBtn = document.querySelector("#confirmationNewSaleBtn");
const confirmationInvoiceBtn = document.querySelector("#confirmationInvoiceBtn");
const confirmationHistoryBtn = document.querySelector("#confirmationHistoryBtn");

const emptySalesP = document.querySelector("#emptySales");
const salesListDiv = document.querySelector("#salesList");

const invoiceContainer = document.querySelector("#invoiceContainer");
const invoiceBackBtn = document.querySelector("#invoiceBackBtn");

const productSearchInput = document.querySelector("#productSearchInput");
const productsListDiv = document.querySelector("#productsList");
const productFormTitle = document.querySelector("#productFormTitle");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const productForm = document.querySelector("#productForm");
const pName = document.querySelector("#pName");
const pCategory = document.querySelector("#pCategory");
const pPrice = document.querySelector("#pPrice");
const pCost = document.querySelector("#pCost");
const pTrack = document.querySelector("#pTrack");
const stockRow = document.querySelector("#stockRow");
const pStock = document.querySelector("#pStock");
const resetProductBtn = document.querySelector("#resetProductBtn");
const productMessageP = document.querySelector("#productMessage");

const allViews = [saleView, saleConfirmationView, salesView, invoiceView, productsView];

function showView(viewEl) {
  allViews.forEach((v) => v.classList.add("hidden"));
  viewEl.classList.remove("hidden");
}

function goToSale() {
  state.ui.currentView = "saleView";
  showView(saleView);
  renderSale();
}

function goToConfirmation() {
  state.ui.currentView = "saleConfirmationView";
  showView(saleConfirmationView);
}

function goToSales() {
  state.ui.currentView = "salesView";
  showView(salesView);
  renderSalesHistory();
}

function goToInvoice() {
  state.ui.currentView = "invoiceView";
  showView(invoiceView);
}

function goToProducts() {
  state.ui.currentView = "productsView";
  showView(productsView);
  renderProductsView();
}

function findProductById(id) {
  return state.products.find((p) => p.id === id);
}

function getSaleTotal() {
  let total = 0;
  for (const item of state.currentSale.items) {
    const p = findProductById(item.productId);
    if (!p) continue;
    total += p.price * item.qty;
  }
  return total;
}

function setSaleMessage(text, kind = "info") {
  saleMessageP.textContent = text;
  saleMessageP.classList.remove("hidden");

  saleMessageP.style.background = kind === "error" ? "#fff1f2" : "#f0f6ff";
  saleMessageP.style.borderColor = kind === "error" ? "#fecdd3" : "#dbe7ff";
}

function clearSaleMessage() {
  saleMessageP.textContent = "";
  saleMessageP.classList.add("hidden");
}

function addToSale(productId) {
  const p = findProductById(productId);
  if (!p) return;

  const item = state.currentSale.items.find((i) => i.productId === productId);
  if (item) {
    item.qty += 1;
  } else {
    state.currentSale.items.push({ productId, qty: 1 });
  }
  renderSaleCart();
}

function removeFromSale(productId) {
  state.currentSale.items = state.currentSale.items.filter((i) => i.productId !== productId);
  renderSaleCart();
}

function changeSaleQty(productId, delta) {
  const item = state.currentSale.items.find((i) => i.productId === productId);
  if (!item) return;

  const nextQty = item.qty + delta;
  if (nextQty <= 0) {
    removeFromSale(productId);
    return;
  }

  item.qty = nextQty;
  renderSaleCart();
}

function clearSale() {
  state.currentSale.items = [];
  renderSaleCart();
}

function resetPayment() {
  state.currentSale.payment = { method: "Efectivo", cashReceived: 0, change: 0 };
  paymentMethodSelect.value = "Efectivo";
  cashReceivedInput.value = "";
  updateCashUI();
}

function startNewSale() {
  clearSaleMessage();
  clearSale();
  resetPayment();
  saleSearchInput.value = "";
  renderSaleProducts(state.products);
}

function updateCashUI() {
  const method = paymentMethodSelect.value;
  state.currentSale.payment.method = method;

  if (method === "Efectivo") {
    cashFieldsDiv.classList.remove("hidden");
  } else {
    cashFieldsDiv.classList.add("hidden");
  }
  updateCashChange();
}

function updateCashChange() {
  const total = getSaleTotal();
  const method = state.currentSale.payment.method;

  if (method !== "Efectivo") {
    state.currentSale.payment.cashReceived = 0;
    state.currentSale.payment.change = 0;
    cashChangeSpan.textContent = formatCOP(0);
    headerSaleTotalSpan.textContent = formatCOP(total);
    saleTotalSpan.textContent = formatCOP(total);
    return;
  }

  const received = nonNegative(cashReceivedInput.value);
  const change = Math.max(0, received - total);

  state.currentSale.payment.cashReceived = received;
  state.currentSale.payment.change = change;

  cashChangeSpan.textContent = formatCOP(change);
  headerSaleTotalSpan.textContent = formatCOP(total);
  saleTotalSpan.textContent = formatCOP(total);
}

function renderSaleProducts(list) {
  saleProductsDiv.innerHTML = "";

  list.forEach((p) => {
    const div = document.createElement("div");
    div.className = "product";
    div.setAttribute("data-id", String(p.id));

    const stockInfo = p.trackInventory ? `<p><small>Stock: <strong>${p.stock}</strong></small></p>` : `<p><small>Sin inventario</small></p>`;

    div.innerHTML = `
      <h3>${p.name}</h3>
      <p><small>${p.code} • ${p.category}</small></p>
      <p>Precio: <strong>${formatCOP(p.price)}</strong></p>
      ${stockInfo}
      <button type="button" data-add="${p.id}">Agregar</button>
    `;

    div.querySelector("[data-add]").addEventListener("click", () => {
      addToSale(p.id);
    });

    saleProductsDiv.appendChild(div);
  });
}

function renderSaleCart() {
  clearSaleMessage();
  saleCartDiv.innerHTML = "";

  const total = getSaleTotal();
  emptySaleP.style.display = state.currentSale.items.length === 0 ? "block" : "none";

  for (const item of state.currentSale.items) {
    const p = findProductById(item.productId);
    if (!p) continue;
    const subtotal = p.price * item.qty;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.setAttribute("data-id", String(p.id));

    div.innerHTML = `
      <strong>${p.name}</strong>
      <p><small>${p.code} • ${p.category}</small></p>
      <p>Cantidad: <strong>${item.qty}</strong></p>
      <p>Subtotal: <strong>${formatCOP(subtotal)}</strong></p>
      <div>
        <button type="button" data-dec="${p.id}">-</button>
        <button type="button" data-inc="${p.id}">+</button>
        <button type="button" data-remove="${p.id}">Eliminar</button>
      </div>
    `;

    div.querySelector("[data-inc]").addEventListener("click", () => changeSaleQty(p.id, +1));
    div.querySelector("[data-dec]").addEventListener("click", () => changeSaleQty(p.id, -1));
    div.querySelector("[data-remove]").addEventListener("click", () => removeFromSale(p.id));

    saleCartDiv.appendChild(div);
  }

  saleTotalSpan.textContent = formatCOP(total);
  headerSaleTotalSpan.textContent = formatCOP(total);
  updateCashChange();
}

function renderSale() {
  renderSaleProducts(state.products);
  renderSaleCart();
}

function validateInventoryForSale() {
  for (const item of state.currentSale.items) {
    const p = findProductById(item.productId);
    if (!p) continue;
    if (!p.trackInventory) continue;
    if (p.stock < item.qty) {
      return `No hay stock suficiente para “${p.name}”. Stock: ${p.stock}, requerido: ${item.qty}.`;
    }
  }
  return null;
}

function applyInventoryDiscountForSale() {

  for (const item of state.currentSale.items) {
    const p = findProductById(item.productId);
    if (!p || !p.trackInventory) continue;
    p.stock = Math.max(0, p.stock - item.qty);
  }
  persistProducts();
}

function buildSaleSnapshot() {
  const itemsSnapshot = state.currentSale.items.map((item) => {
    const p = findProductById(item.productId);
    const price = p ? p.price : 0;
    return {
      productId: item.productId,
      code: p ? p.code : "—",
      name: p ? p.name : "Producto eliminado",
      category: p ? p.category : "—",
      price,
      qty: item.qty,
      subtotal: price * item.qty,
    };
  });

  const total = itemsSnapshot.reduce((acc, it) => acc + it.subtotal, 0);

  return {
    id: makeSaleId(),
    createdAt: nowISO(),
    closedAt: nowISO(),
    status: "cerrada",
    items: itemsSnapshot,
    total,
    payment: {
      method: state.currentSale.payment.method,
      cashReceived: state.currentSale.payment.method === "Efectivo" ? state.currentSale.payment.cashReceived : 0,
      change: state.currentSale.payment.method === "Efectivo" ? state.currentSale.payment.change : 0,
    },
  };
}

function confirmSale() {
  clearSaleMessage();

  if (state.currentSale.items.length === 0) {
    setSaleMessage("No puedes cerrar una venta sin productos.", "error");
    return;
  }

  const inventoryError = validateInventoryForSale();
  if (inventoryError) {
    setSaleMessage(inventoryError, "error");
    return;
  }

  const total = getSaleTotal();
  const method = state.currentSale.payment.method;

  if (method === "Efectivo") {
    const received = nonNegative(cashReceivedInput.value);
    if (received < total) {
      setSaleMessage(`Efectivo insuficiente. Total: ${formatCOP(total)}. Recibido: ${formatCOP(received)}.`, "error");
      return;
    }
  }

  const sale = buildSaleSnapshot();

  state.sales.unshift(sale);
  persistSales();

  applyInventoryDiscountForSale();

  state.ui.lastSaleId = sale.id;
  confirmationText.textContent = `Venta ${sale.id} registrada. Total: ${formatCOP(sale.total)} • Pago: ${sale.payment.method}.`;
  goToConfirmation();

  startNewSale();
}

function renderSalesHistory() {
  salesListDiv.innerHTML = "";
  emptySalesP.style.display = state.sales.length === 0 ? "block" : "none";

  state.sales.forEach((sale) => {
    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `
      <div class="meta">
        <strong>${sale.id}</strong>
        <span class="muted">${formatDateTime(sale.closedAt)} • ${sale.payment.method}</span>
        <span>Total: <strong>${formatCOP(sale.total)}</strong></span>
      </div>
      <div>
        <button type="button" data-invoice="${sale.id}" class="btn-secondary">Ver factura</button>
      </div>
    `;

    div.querySelector("[data-invoice]").addEventListener("click", () => {
      openInvoice(sale.id, { backTo: "sales" });
    });

    salesListDiv.appendChild(div);
  });
}

function findSaleById(id) {
  return state.sales.find((s) => s.id === id);
}

function openInvoice(saleId, opts = { backTo: "sales" }) {
  const sale = findSaleById(saleId);
  if (!sale) {
    goToSales();
    return;
  }

  invoiceBackBtn.dataset.backto = opts.backTo || "sales";

  invoiceContainer.innerHTML = buildInvoiceHTML(sale);
  goToInvoice();
}

function buildInvoiceHTML(sale) {
  const business = {
    name: "Papelería Papel y Luna",
    nit: "NIT: 000.000.000-0",
    address: "Dirección: (pendiente)",
    phone: "Tel: (pendiente)",
  };

  const rows = sale.items
    .map(
      (it) => `
        <tr>
          <td>${it.code}</td>
          <td>${it.name}</td>
          <td>${it.qty}</td>
          <td>${formatCOP(it.price)}</td>
          <td><strong>${formatCOP(it.subtotal)}</strong></td>
        </tr>
      `
    )
    .join("");

  const cashInfo =
    sale.payment.method === "Efectivo"
      ? `<p><strong>Recibido:</strong> ${formatCOP(sale.payment.cashReceived)} • <strong>Cambio:</strong> ${formatCOP(sale.payment.change)}</p>`
      : "";

  return `
    <h2>Factura / Comprobante</h2>
    <p><strong>${business.name}</strong></p>
    <p class="muted">${business.nit} • ${business.address} • ${business.phone}</p>
    <hr />
    <p><strong>Venta:</strong> ${sale.id}</p>
    <p><strong>Fecha:</strong> ${formatDateTime(sale.closedAt)}</p>
    <p><strong>Método de pago:</strong> ${sale.payment.method}</p>
    ${cashInfo}
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th>Cant.</th>
          <th>Precio</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="totals" style="margin-top:14px;">
      <div class="totals__row">
        <span>Total</span>
        <strong>${formatCOP(sale.total)}</strong>
      </div>
    </div>
  `;
}

function setProductMessage(text, kind = "info") {
  productMessageP.textContent = text;
  productMessageP.classList.remove("hidden");
  productMessageP.style.background = kind === "error" ? "#fff1f2" : "#f0f6ff";
  productMessageP.style.borderColor = kind === "error" ? "#fecdd3" : "#dbe7ff";
}

function clearProductMessage() {
  productMessageP.textContent = "";
  productMessageP.classList.add("hidden");
}

function resetProductForm() {
  state.ui.editingProductId = null;
  productFormTitle.textContent = "Crear producto";
  cancelEditBtn.classList.add("hidden");

  pName.value = "";
  pCategory.value = "";
  pPrice.value = "";
  pCost.value = "";
  pTrack.checked = false;
  pStock.value = "0";
  stockRow.classList.add("hidden");

  clearProductMessage();
}

function getNextProductId() {
  const maxId = state.products.reduce((acc, p) => Math.max(acc, p.id), 0);
  return maxId + 1;
}

function renderProductsView() {
  clearProductMessage();
  if (state.ui.editingProductId === null) {
    resetProductForm();
  }
  renderProductsList(state.products);
}

function renderProductsList(list) {
  productsListDiv.innerHTML = "";

  list.forEach((p) => {
    const div = document.createElement("div");
    div.className = "product";
    div.setAttribute("data-id", String(p.id));

    const inv = p.trackInventory
      ? `<p><small>Stock: <strong>${p.stock}</strong></small></p>`
      : `<p><small>Sin inventario</small></p>`;

    div.innerHTML = `
      <h3>${p.name}</h3>
      <p><small>${p.code} • ${p.category}</small></p>
      <p>Venta: <strong>${formatCOP(p.price)}</strong></p>
      <p><small>Costo: ${formatCOP(p.cost)}</small></p>
      ${inv}
      <div class="actions" style="justify-content:center; margin-top:8px;">
        <button type="button" data-edit="${p.id}" class="btn-secondary">Editar</button>
        <button type="button" data-del="${p.id}" class="btn-danger">Eliminar</button>
      </div>
    `;

    div.querySelector("[data-edit]").addEventListener("click", () => startEditProduct(p.id));
    div.querySelector("[data-del]").addEventListener("click", () => deleteProduct(p.id));

    productsListDiv.appendChild(div);
  });
}

function startEditProduct(productId) {
  const p = findProductById(productId);
  if (!p) return;

  state.ui.editingProductId = p.id;
  productFormTitle.textContent = `Editar: ${p.name}`;
  cancelEditBtn.classList.remove("hidden");

  pName.value = p.name;
  pCategory.value = p.category;
  pPrice.value = String(p.price);
  pCost.value = String(p.cost);
  pTrack.checked = Boolean(p.trackInventory);
  pStock.value = String(p.stock ?? 0);

  stockRow.classList.toggle("hidden", !pTrack.checked);
  clearProductMessage();
}

function deleteProduct(productId) {
  const p = findProductById(productId);
  if (!p) return;

  const ok = confirm(`¿Seguro que deseas eliminar el producto “${p.name}”?`);
  if (!ok) return;

  state.products = state.products.filter((x) => x.id !== productId);
  persistProducts();

  state.currentSale.items = state.currentSale.items.filter((i) => i.productId !== productId);

  setProductMessage("Producto eliminado.");
  renderProductsView();
  renderSale();
}

function validateProductForm({ name, category, price, cost, trackInventory, stock }) {
  if (!name.trim()) return "El nombre es obligatorio.";
  if (!category.trim()) return "La categoría es obligatoria.";
  if (price < 0) return "El precio de venta no puede ser negativo.";
  if (cost < 0) return "El costo no puede ser negativo.";
  if (trackInventory && stock < 0) return "El stock no puede ser negativo.";
  return null;
}

function upsertProductFromForm() {
  clearProductMessage();

  const draft = {
    name: pName.value,
    category: pCategory.value,
    price: nonNegative(pPrice.value),
    cost: nonNegative(pCost.value),
    trackInventory: Boolean(pTrack.checked),
    stock: nonNegative(pStock.value),
  };

  if (!draft.trackInventory) {
    draft.stock = 0;
  }

  const error = validateProductForm(draft);
  if (error) {
    setProductMessage(error, "error");
    return;
  }

  if (state.ui.editingProductId === null) {
    const id = getNextProductId();
    const product = {
      id,
      code: makeProductCode(id),
      ...draft,
    };
    state.products.push(product);
    persistProducts();
    setProductMessage(`Producto creado (${product.code}).`);
  } else {
    const p = findProductById(state.ui.editingProductId);
    if (!p) {
      setProductMessage("No se encontró el producto a editar.", "error");
      return;
    }
    p.name = draft.name.trim();
    p.category = draft.category.trim();
    p.price = draft.price;
    p.cost = draft.cost;
    p.trackInventory = draft.trackInventory;
    p.stock = draft.stock;
    persistProducts();
    setProductMessage("Producto actualizado.");

    renderSaleCart();
  }

  resetProductForm();
  renderProductsView();
  renderSaleProducts(state.products);
}

function toggleStockRow() {
  stockRow.classList.toggle("hidden", !pTrack.checked);
}

goSaleBtn.addEventListener("click", goToSale);
goSalesBtn.addEventListener("click", goToSales);
goProductsBtn.addEventListener("click", goToProducts);

saleSearchInput.addEventListener("input", () => {
  const q = saleSearchInput.value.toLowerCase().trim();
  const filtered = state.products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  renderSaleProducts(filtered);
});

clearSaleBtn.addEventListener("click", () => {
  const ok = confirm("¿Vaciar la venta en curso?");
  if (!ok) return;
  clearSale();
});

paymentMethodSelect.addEventListener("change", updateCashUI);
cashReceivedInput.addEventListener("input", updateCashChange);

confirmSaleBtn.addEventListener("click", confirmSale);
newSaleBtn.addEventListener("click", () => {
  const ok = state.currentSale.items.length === 0 ? true : confirm("Esto limpiará la venta actual. ¿Continuar?");
  if (!ok) return;
  startNewSale();
});

confirmationNewSaleBtn.addEventListener("click", () => {
  state.ui.lastSaleId = null;
  goToSale();
});

confirmationInvoiceBtn.addEventListener("click", () => {
  const id = state.ui.lastSaleId;
  if (!id) {
    goToSales();
    return;
  }
  openInvoice(id, { backTo: "confirmation" });
});

confirmationHistoryBtn.addEventListener("click", goToSales);

invoiceBackBtn.addEventListener("click", () => {
  const backTo = invoiceBackBtn.dataset.backto || "sales";
  if (backTo === "confirmation") {
    goToConfirmation();
  } else {
    goToSales();
  }
});

productSearchInput.addEventListener("input", () => {
  const q = productSearchInput.value.toLowerCase().trim();
  const filtered = state.products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  renderProductsList(filtered);
});

pTrack.addEventListener("change", toggleStockRow);

cancelEditBtn.addEventListener("click", () => {
  resetProductForm();
  renderProductsView();
});

resetProductBtn.addEventListener("click", resetProductForm);

productForm.addEventListener("submit", (e) => {
  e.preventDefault();
  upsertProductFromForm();
});

loadData();
resetPayment();
renderSale();
goToSale();
