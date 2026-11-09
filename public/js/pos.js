/**
 * Lógica Front-End para MeDIa POS (Punto de Venta)
 */

let state = {
    tasaBcv: 65.50,
    sesionCaja: null,
    catalogo: [],
    categorias: [],
    categoriaSeleccionada: null,
    clientes: [],
    clienteSeleccionadoId: null,
    carrito: [],
    totales: {
        exentoVes: 0,
        baseGeneralVes: 0,
        ivaGeneralVes: 0,
        totalVes: 0,
        totalUsd: 0
    },
    ultimoTicket: ''
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarTasaBCV();
    await cargarSesionCaja();
    await cargarClientes();
    await cargarCategorias();
    await cargarCatalogo();

    // Atajos de Teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12') {
            e.preventDefault();
            if (state.carrito.length > 0) abrirModalCobro();
        }
        if (e.key === 'Escape') {
            cerrarModalCobro();
            cerrarModalTicket();
            cerrarModalCaja();
        }
    });

    // Evento Escáner Barcode
    const barcodeInput = document.getElementById('barcode-input');
    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            procesarEscaneoBarcode(barcodeInput.value.trim());
        }
    });
});

// ==========================================
// CARGA DE DATOS DE API
// ==========================================
async function cargarTasaBCV() {
    try {
        const res = await fetch('/api/bcv/tasa');
        const data = await res.json();
        state.tasaBcv = data.tasa;
        document.getElementById('pos-bcv-rate').innerText = `Bs. ${state.tasaBcv.toFixed(2)}`;
    } catch (err) {
        console.error('Error al cargar tasa BCV', err);
    }
}

async function sincronizarBCVAutoPOS(btnEl) {
    const icon = document.getElementById('sync-icon-pos');
    if (icon) icon.classList.add('sync-spin');
    try {
        const res = await fetch('/api/bcv/sincronizar', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.exito) {
            state.tasaBcv = data.tasa;
            document.getElementById('pos-bcv-rate').innerText = `Bs. ${data.tasa.toFixed(2)}`;
            await cargarCatalogo();
            actualizarCarritoUI();
        }
    } catch(err) {
        console.error('Error al sincronizar BCV en POS', err);
    } finally {
        if (icon) icon.classList.remove('sync-spin');
    }
}

async function cargarSesionCaja() {
    try {
        const res = await fetch('/api/pos/sesion');
        const sesion = await res.json();
        state.sesionCaja = sesion;
        const headerInfo = document.getElementById('caja-info-header');
        if (sesion && sesion.estado === 'ABIERTA') {
            headerInfo.innerText = `Caja ${sesion.numero_caja} - ${sesion.cajero}`;
        } else {
            headerInfo.innerText = `Caja CERRADA - Abra la caja para operar`;
            headerInfo.style.color = '#f87171';
        }
    } catch (err) {
        console.error('Error al verificar sesión de caja', err);
    }
}

async function cargarCategorias() {
    try {
        const res = await fetch('/api/inventario/categorias');
        state.categorias = await res.json();
        const container = document.getElementById('category-pills-container');
        container.innerHTML = `<button class="pill-btn active" onclick="filtrarCategoria(null, this)">Todos</button>`;
        state.categorias.forEach(cat => {
            container.innerHTML += `<button class="pill-btn" onclick="filtrarCategoria(${cat.id}, this)">${cat.nombre.split(' ')[0]}</button>`;
        });
    } catch (err) {
        console.error('Error al cargar categorías', err);
    }
}

async function cargarClientes() {
    try {
        const res = await fetch('/api/terceros/clientes');
        state.clientes = await res.json();
        const select = document.getElementById('cart-client-select');
        select.innerHTML = '';
        state.clientes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.razon_social} (${c.rif_completo})</option>`;
        });
        
        // Seleccionar Consumidor Final por defecto si existe, o el primero
        const consFinal = state.clientes.find(c => c.numero_documento === '00000000');
        if (consFinal) {
            state.clienteSeleccionadoId = consFinal.id;
            select.value = consFinal.id;
        } else {
            state.clienteSeleccionadoId = state.clientes[0] ? state.clientes[0].id : null;
        }

        actualizarFichaClienteDisplay(state.clienteSeleccionadoId);

    } catch (err) {
        console.error('Error al cargar clientes', err);
    }
}

function alCambiarClientePOS(selectEl) {
    state.clienteSeleccionadoId = selectEl.value;
    actualizarFichaClienteDisplay(selectEl.value);
}

function seleccionarConsumidorFinal() {
    const consFinal = state.clientes.find(c => c.numero_documento === '00000000');
    const select = document.getElementById('cart-client-select');
    if (consFinal) {
        state.clienteSeleccionadoId = consFinal.id;
        select.value = consFinal.id;
        actualizarFichaClienteDisplay(consFinal.id);
        mostrarToast("Cliente: Consumidor Final (Contado)", 'info');
    }
}

function actualizarFichaClienteDisplay(clienteId) {
    const cliente = state.clientes.find(c => String(c.id) === String(clienteId));
    if (!cliente) return;

    const nombreEl = document.getElementById('client-display-nombre');
    const rifEl = document.getElementById('client-display-rif');
    const dirEl = document.getElementById('client-display-direccion');
    const tlfEl = document.getElementById('client-display-telefono');

    if (nombreEl) nombreEl.innerText = cliente.razon_social;
    if (rifEl) rifEl.innerText = cliente.rif_completo;
    if (dirEl) dirEl.innerText = cliente.direccion || 'Mostrador / Sin dirección física';
    if (tlfEl) tlfEl.innerText = cliente.telefono || '--';
}

function abrirModalNuevoClientePOS() {
    document.getElementById('modal-nuevo-cliente-pos').style.display = 'flex';
}

function cerrarModalNuevoClientePOS() {
    document.getElementById('modal-nuevo-cliente-pos').style.display = 'none';
}

async function guardarNuevoClienteDesdePOS() {
    const tipo = document.getElementById('pos-cli-tipo').value;
    const num = document.getElementById('pos-cli-num').value.trim();
    const digito = document.getElementById('pos-cli-digito').value.trim();
    const razon = document.getElementById('pos-cli-nombre').value.trim();
    const direccion = document.getElementById('pos-cli-direccion').value.trim();
    const telefono = document.getElementById('pos-cli-telefono').value.trim();
    const tipoContrib = document.getElementById('pos-cli-contrib').value;

    if (!num || !razon) {
        mostrarToast("Cédula/RIF y Razón Social son obligatorios.", 'error');
        return;
    }

    try {
        const res = await fetch('/api/terceros/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_documento: tipo,
                numero_documento: num,
                digito_verificador: digito,
                razon_social: razon,
                direccion: direccion,
                telefono: telefono,
                tipo_contribuyente: tipoContrib
            })
        });

        const data = await res.json();
        if (res.ok) {
            mostrarToast("Cliente registrado y seleccionado para la factura.", 'success');
            cerrarModalNuevoClientePOS();
            // Recargar lista y seleccionar nuevo
            await cargarClientes();
            const select = document.getElementById('cart-client-select');
            select.value = data.id;
            state.clienteSeleccionadoId = data.id;
            actualizarFichaClienteDisplay(data.id);
        } else {
            mostrarToast(`Error: ${data.mensaje}`, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión al registrar cliente.", 'error');
    }
}

async function cargarCatalogo(busqueda = '', catId = null) {
    try {
        let url = '/api/inventario/productos?';
        if (busqueda) url += `busqueda=${encodeURIComponent(busqueda)}&`;
        if (catId) url += `categoria_id=${catId}&`;

        const res = await fetch(url);
        state.catalogo = await res.json();
        renderizarCatalogo();
    } catch (err) {
        console.error('Error al cargar catálogo', err);
    }
}

function filtrarCategoria(catId, btnEl) {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    state.categoriaSeleccionada = catId;
    cargarCatalogo(document.getElementById('barcode-input').value.trim(), catId);
}

function buscarProductosManual() {
    const val = document.getElementById('barcode-input').value.trim();
    cargarCatalogo(val, state.categoriaSeleccionada);
}

// ==========================================
// RENDERIZADO DEL CATÁLOGO EN POS (CON FOTOS Y GLASS V5)
// ==========================================
function renderizarCatalogo() {
    const container = document.getElementById('pos-products-container');
    if (!state.catalogo || state.catalogo.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No se encontraron productos coincidentes</div>`;
        return;
    }

    container.innerHTML = state.catalogo.map(prod => {
        const stockAlerta = prod.stock_actual <= prod.stock_minimo ? 'color:#f87171;' : 'color:#86efac;';
        const imgUrl = prod.imagen_url || '/img/products/placeholder.svg';
        const catTintClass = `cat-tint-${prod.categoria_id || 1}`;

        return `
            <div class="product-card ${catTintClass}" onclick="agregarAlCarritoPorId(${prod.id})">
                <!-- Foto del Producto -->
                <div class="product-img-box">
                    <img src="${imgUrl}" alt="${prod.descripcion}" class="product-img" onerror="this.onerror=null; this.src='/img/products/placeholder.svg';">
                    <span class="prod-tag tag-${prod.alicuota_iva}" style="position:absolute; top:6px; left:6px;">${getNombreAlicuota(prod.alicuota_iva)}</span>
                    <code style="position:absolute; top:6px; right:6px; font-size:0.65rem; background:rgba(0,0,0,0.6); padding:2px 6px; border-radius:4px; color:#94a3b8;">${prod.codigo_barra}</code>
                </div>

                <div>
                    <div class="prod-desc" title="${prod.descripcion}">${prod.descripcion}</div>
                </div>

                <div>
                    <div class="prod-prices">
                        <span class="price-ves">Bs. ${prod.precio_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        <span class="price-usd">$ ${prod.precio_usd.toFixed(2)}</span>
                    </div>
                    <div class="prod-footer">
                        <span class="prod-stock">Stock: <strong style="${stockAlerta}">${prod.stock_actual}</strong> ${prod.unidad_medida}</span>
                        <span style="font-size: 0.72rem; color: #60a5fa; font-weight:700;">+ Agregar</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getNombreAlicuota(alic) {
    if (alic === 'G') return 'IVA 16%';
    if (alic === 'E') return 'EXENTO';
    if (alic === 'A') return 'LUJO 31%';
    if (alic === 'R') return 'RED 8%';
    return alic;
}

// ==========================================
// TOAST NOTIFICATIONS MODERNAS FLOTANTES
// ==========================================
function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `glass-toast toast-${tipo}`;
    toast.innerHTML = `
        <span style="font-size:1.1rem;">${tipo === 'success' ? '✓' : tipo === 'error' ? '✕' : 'ℹ'}</span>
        <span>${mensaje}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ==========================================
// MANEJO DEL CARRITO DE COMPRAS
// ==========================================
function procesarEscaneoBarcode(codigo) {
    if (!codigo) return;
    const encontrado = state.catalogo.find(p => p.codigo_barra === codigo || p.referencia === codigo);
    if (encontrado) {
        agregarAlCarrito(encontrado);
        document.getElementById('barcode-input').value = '';
    } else {
        fetch(`/api/inventario/producto/${encodeURIComponent(codigo)}`)
            .then(res => res.json())
            .then(prod => {
                if (prod && prod.id) {
                    agregarAlCarrito(prod);
                    document.getElementById('barcode-input').value = '';
                } else {
                    mostrarToast(`Código "${codigo}" no encontrado en catálogo.`, 'error');
                }
            })
            .catch(() => mostrarToast(`Error al consultar código "${codigo}".`, 'error'));
    }
}

function agregarAlCarritoPorId(id) {
    const prod = state.catalogo.find(p => p.id === id);
    if (prod) agregarAlCarrito(prod);
}

function agregarAlCarrito(prod) {
    if (prod.stock_actual <= 0) {
        mostrarToast(`Sin existencia disponible para "${prod.descripcion}".`, 'error');
        return;
    }

    const itemEnCarrito = state.carrito.find(it => it.producto_id === prod.id);
    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad + 1 > prod.stock_actual) {
            mostrarToast(`Existencia máxima alcanzada (${prod.stock_actual} disp).`, 'error');
            return;
        }
        itemEnCarrito.cantidad += 1;
    } else {
        state.carrito.push({
            producto_id: prod.id,
            descripcion: prod.descripcion,
            codigo_barra: prod.codigo_barra,
            alicuota_iva: prod.alicuota_iva,
            precio_usd: prod.precio_usd,
            precio_ves: prod.precio_ves,
            cantidad: 1,
            stock_max: prod.stock_actual
        });
    }

    actualizarCarritoUI();
    mostrarToast(`+ ${prod.descripcion}`, 'info');
}

function cambiarCantidad(prodId, delta) {
    const item = state.carrito.find(it => it.producto_id === prodId);
    if (!item) return;

    const nuevaCant = item.cantidad + delta;
    if (nuevaCant <= 0) {
        state.carrito = state.carrito.filter(it => it.producto_id !== prodId);
    } else if (nuevaCant > item.stock_max) {
        mostrarToast(`Stock máximo disponible alcanzado (${item.stock_max}).`, 'error');
    } else {
        item.cantidad = nuevaCant;
    }
    actualizarCarritoUI();
}

function eliminarDelCarrito(prodId) {
    state.carrito = state.carrito.filter(it => it.producto_id !== prodId);
    actualizarCarritoUI();
}

function limpiarCarrito() {
    if (state.carrito.length === 0) return;
    state.carrito = [];
    actualizarCarritoUI();
    mostrarToast("Ticket cancelado y vaciado.", 'info');
}

function actualizarCarritoUI() {
    const listContainer = document.getElementById('cart-items-list');
    const itemsCountEl = document.getElementById('cart-items-count');
    const btnCobrar = document.getElementById('btn-cobrar');

    if (state.carrito.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); margin-top: 60px;">
                <svg style="width:42px; height:42px; stroke:var(--text-muted); stroke-width:1.5; fill:none; margin: 0 auto 12px; display:block;" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span>Escanee o haga clic en un producto para comenzar</span>
            </div>
        `;
        itemsCountEl.innerText = '0';
        btnCobrar.disabled = true;
        recalcularTotales([]);
        return;
    }

    btnCobrar.disabled = false;
    let cantTotal = 0;

    listContainer.innerHTML = state.carrito.map(it => {
        cantTotal += it.cantidad;
        const totalItemVes = it.cantidad * it.precio_ves;
        return `
            <div class="cart-item">
                <div class="cart-item-row-top">
                    <div class="cart-item-title">${it.descripcion}</div>
                    <button onclick="eliminarDelCarrito(${it.producto_id})" style="background:none; border:none; color:#f87171; cursor:pointer; padding:2px;" title="Quitar ítem">
                        <svg style="width:14px; height:14px; stroke:#f87171; stroke-width:2; fill:none;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
                <div class="cart-item-row-bottom">
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="cambiarCantidad(${it.producto_id}, -1)">-</button>
                        <span style="font-weight: 800; min-width: 22px; text-align: center; font-size: 0.88rem;">${it.cantidad}</span>
                        <button class="qty-btn" onclick="cambiarCantidad(${it.producto_id}, 1)">+</button>
                    </div>
                    <div class="cart-item-price">
                        <div class="cart-item-price-ves">Bs. ${totalItemVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                        <div class="cart-item-price-sub">$ ${(it.cantidad * it.precio_usd).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    itemsCountEl.innerText = cantTotal;
    recalcularTotales(state.carrito);
}

function recalcularTotales(items) {
    let subExento = 0;
    let baseG = 0;
    let ivaG = 0;
    let totalUsd = 0;

    items.forEach(it => {
        const subVes = it.cantidad * it.precio_ves;
        totalUsd += it.cantidad * it.precio_usd;

        if (it.alicuota_iva === 'E') {
            subExento += subVes;
        } else if (it.alicuota_iva === 'G') {
            baseG += subVes;
            ivaG += subVes * 0.16;
        } else if (it.alicuota_iva === 'R') {
            baseG += subVes;
            ivaG += subVes * 0.08;
        } else if (it.alicuota_iva === 'A') {
            baseG += subVes;
            ivaG += subVes * 0.31;
        }
    });

    const totalVes = subExento + baseG + ivaG;

    state.totales = {
        exentoVes: subExento,
        baseGeneralVes: baseG,
        ivaGeneralVes: ivaG,
        totalVes: totalVes,
        totalUsd: totalUsd
    };

    document.getElementById('tot-exento').innerText = `Bs. ${subExento.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('tot-base-g').innerText = `Bs. ${baseG.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('tot-iva-g').innerText = `Bs. ${ivaG.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('tot-usd').innerText = `$ ${totalUsd.toFixed(2)}`;
    document.getElementById('tot-ves').innerText = `Bs. ${totalVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// ==========================================
// MODAL DE COBRO MULTIMONEDA & CÁLCULO IGTF
// ==========================================
function abrirModalCobro() {
    if (state.carrito.length === 0) return;
    if (!state.sesionCaja || state.sesionCaja.estado !== 'ABIERTA') {
        alert("Atención: Debe abrir la caja antes de poder emitir facturas.");
        gestionarCajaModal();
        return;
    }

    document.getElementById('modal-cobro-total-ves').innerText = `Bs. ${state.totales.totalVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('modal-cobro-total-usd').innerText = `$ ${state.totales.totalUsd.toFixed(2)}`;

    // Reset inputs
    document.getElementById('pago-debito-ves').value = '';
    document.getElementById('pago-movil-ves').value = '';
    document.getElementById('pago-efectivo-ves').value = '';
    document.getElementById('pago-efectivo-usd').value = '';
    document.getElementById('pago-zelle-usd').value = '';

    // Sugerencia rápida: si paga todo con tarjeta de débito
    document.getElementById('pago-debito-ves').value = state.totales.totalVes.toFixed(2);

    recalcularModalPagos();
    document.getElementById('modal-cobro').style.display = 'flex';
}

function cerrarModalCobro() {
    document.getElementById('modal-cobro').style.display = 'none';
}

function recalcularModalPagos() {
    const debitoVes = parseFloat(document.getElementById('pago-debito-ves').value) || 0;
    const movilVes = parseFloat(document.getElementById('pago-movil-ves').value) || 0;
    const efectivoVes = parseFloat(document.getElementById('pago-efectivo-ves').value) || 0;
    const efectivoUsd = parseFloat(document.getElementById('pago-efectivo-usd').value) || 0;
    const zelleUsd = parseFloat(document.getElementById('pago-zelle-usd').value) || 0;

    const totalDivisasUsd = efectivoUsd + zelleUsd;
    const divisasEnVes = totalDivisasUsd * state.tasaBcv;

    // Cálculo del 3% de IGTF sobre divisas
    const igtfVes = divisasEnVes * 0.03;

    const igtfBox = document.getElementById('igtf-display-box');
    if (totalDivisasUsd > 0) {
        igtfBox.style.display = 'flex';
        document.getElementById('igtf-base-usd').innerText = `$ ${totalDivisasUsd.toFixed(2)} (Bs. ${divisasEnVes.toFixed(2)})`;
        document.getElementById('igtf-monto-ves').innerText = `+ Bs. ${igtfVes.toFixed(2)}`;
    } else {
        igtfBox.style.display = 'none';
    }

    const totalExigidoConIgtf = state.totales.totalVes + igtfVes;
    const totalIngresado = debitoVes + movilVes + efectivoVes + divisasEnVes;

    document.getElementById('modal-total-exigido-ves').innerText = `Bs. ${totalExigidoConIgtf.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('modal-total-ingresado-ves').innerText = `Bs. ${totalIngresado.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    const diferencia = Math.round((totalIngresado - totalExigidoConIgtf) * 100) / 100;
    const labelDif = document.getElementById('modal-estado-pago-label');
    const valDif = document.getElementById('modal-saldo-diferencia');
    const btnConfirmar = document.getElementById('btn-confirmar-fiscal');

    if (diferencia >= -0.50) {
        // Cubierto
        if (diferencia > 0.01) {
            labelDif.innerText = "Vuelto / Cambio:";
            valDif.innerText = `Bs. ${diferencia.toFixed(2)}`;
            valDif.style.color = '#86efac';
        } else {
            labelDif.innerText = "Pago Exacto:";
            valDif.innerText = "Bs. 0,00";
            valDif.style.color = '#86efac';
        }
        btnConfirmar.disabled = false;
    } else {
        // Falta dinero
        labelDif.innerText = "Saldo Pendiente:";
        valDif.innerText = `Bs. ${Math.abs(diferencia).toFixed(2)}`;
        valDif.style.color = '#f87171';
        btnConfirmar.disabled = true;
    }
}

async function confirmarVentaFiscal() {
    const btnConfirmar = document.getElementById('btn-confirmar-fiscal');
    btnConfirmar.disabled = true;
    btnConfirmar.innerText = "Emitiendo a Impresora Fiscal...";

    // Ensamblar pagos
    const pagos = [];
    const debitoVes = parseFloat(document.getElementById('pago-debito-ves').value) || 0;
    const movilVes = parseFloat(document.getElementById('pago-movil-ves').value) || 0;
    const efectivoVes = parseFloat(document.getElementById('pago-efectivo-ves').value) || 0;
    const efectivoUsd = parseFloat(document.getElementById('pago-efectivo-usd').value) || 0;
    const zelleUsd = parseFloat(document.getElementById('pago-zelle-usd').value) || 0;

    if (debitoVes > 0) pagos.push({ metodo_pago: 'PUNTO_DEBITO', moneda: 'VES', monto_original: debitoVes });
    if (movilVes > 0) pagos.push({ metodo_pago: 'PAGO_MOVIL', moneda: 'VES', monto_original: movilVes });
    if (efectivoVes > 0) pagos.push({ metodo_pago: 'EFECTIVO_VES', moneda: 'VES', monto_original: efectivoVes });
    if (efectivoUsd > 0) pagos.push({ metodo_pago: 'EFECTIVO_USD', moneda: 'USD', monto_original: efectivoUsd });
    if (zelleUsd > 0) pagos.push({ metodo_pago: 'ZELLE', moneda: 'USD', monto_original: zelleUsd });

    const payload = {
        cliente_id: state.clienteSeleccionadoId,
        items: state.carrito.map(it => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad
        })),
        pagos: pagos
    };

    try {
        const res = await fetch('/api/pos/venta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(`Error Fiscal: ${data.mensaje || 'No se pudo procesar la venta'}`);
            btnConfirmar.disabled = false;
            btnConfirmar.innerText = "🖨️ EMITIR FACTURA FISCAL";
            return;
        }

        // Éxito: cerrar modal de cobro y mostrar el ticket fiscal
        cerrarModalCobro();
        state.ultimoTicket = data.ticketFiscal;
        mostrarModalTicket(data.ticketFiscal);

        // Vaciar carrito y recargar catálogo para refrescar existencias
        state.carrito = [];
        actualizarCarritoUI();
        cargarCatalogo();

    } catch (err) {
        alert("Error de conexión al emitir factura fiscal");
        btnConfirmar.disabled = false;
        btnConfirmar.innerText = "🖨️ EMITIR FACTURA FISCAL";
    }
}

// ==========================================
// VISOR DE TICKET FISCAL
// ==========================================
function mostrarModalTicket(ticketTexto) {
    document.getElementById('ticket-preview-content').innerText = ticketTexto;
    document.getElementById('modal-ticket-fiscal').style.display = 'flex';
}

function cerrarModalTicket() {
    document.getElementById('modal-ticket-fiscal').style.display = 'none';
}

function copiarTicketTexto() {
    navigator.clipboard.writeText(state.ultimoTicket).then(() => {
        alert("Texto del ticket copiado al portapapeles.");
    });
}

// ==========================================
// REPORTES FISCALES X Y Z
// ==========================================
async function solicitarReporteX() {
    try {
        const res = await fetch('/api/pos/reporte-x');
        const data = await res.json();
        mostrarModalTicket(data.reporte);
    } catch (err) {
        alert("Error al solicitar Reporte X");
    }
}

async function solicitarReporteZ() {
    if (!confirm("ADVERTENCIA SENIAT: El Cierre Z cerrará el día fiscal de la máquina y generará el bloque de auditoría diario. ¿Desea proceder?")) {
        return;
    }
    try {
        const res = await fetch('/api/pos/reporte-z', { method: 'POST' });
        const data = await res.json();
        mostrarModalTicket(data.reporte);
    } catch (err) {
        alert("Error al emitir Cierre Z");
    }
}

// ==========================================
// GESTIÓN DE CAJA (APERTURA / ARQUEO / CIERRE)
// ==========================================
function gestionarCajaModal() {
    const modalBody = document.getElementById('modal-caja-body');
    const titulo = document.getElementById('modal-caja-titulo');

    if (state.sesionCaja && state.sesionCaja.estado === 'ABIERTA') {
        titulo.innerText = `Cierre y Arqueo - Caja ${state.sesionCaja.numero_caja}`;
        modalBody.innerHTML = `
            <p style="color:var(--text-muted); margin-bottom: 14px; font-size:0.85rem;">
                Cajero activo: <strong style="color:white;">${state.sesionCaja.cajero}</strong> | Apertura: ${state.sesionCaja.fecha_apertura}
            </p>
            <div style="margin-bottom: 12px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Conteo Físico en Bolívares (Efectivo Bs.):</label>
                <input type="number" step="0.01" class="glass-input" id="cierre-conteo-ves" placeholder="0.00" style="width:100%;">
            </div>
            <div style="margin-bottom: 14px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Conteo Físico en Divisas (Efectivo USD $):</label>
                <input type="number" step="0.01" class="glass-input" id="cierre-conteo-usd" placeholder="0.00" style="width:100%;">
            </div>
            <button onclick="ejecutarCierreCaja()" class="btn-glass btn-glass-danger" style="width: 100%; justify-content:center; padding: 12px; margin-top: 10px;">
                Cerrar Turno y Guardar Arqueo
            </button>
        `;
    } else {
        titulo.innerText = "Apertura de Turno de Caja";
        modalBody.innerHTML = `
            <div style="margin-bottom: 12px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Número de Caja:</label>
                <input type="text" class="glass-input" id="apertura-caja-num" value="01" style="width:100%;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Nombre del Cajero:</label>
                <input type="text" class="glass-input" id="apertura-cajero-nombre" value="CAJERO PRINCIPAL" style="width:100%;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Fondo Inicial en Bolívares (Bs.):</label>
                <input type="number" step="0.01" class="glass-input" id="apertura-monto-ves" value="500.00" style="width:100%;">
            </div>
            <div style="margin-bottom: 14px;">
                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Fondo Inicial en Divisas ($ USD):</label>
                <input type="number" step="0.01" class="glass-input" id="apertura-monto-usd" value="20.00" style="width:100%;">
            </div>
            <button onclick="ejecutarAperturaCaja()" class="btn-glass btn-glass-success" style="width: 100%; justify-content:center; padding: 12px; margin-top: 10px;">
                Abrir Caja y Comenzar Turno
            </button>
        `;
    }
    document.getElementById('modal-caja').style.display = 'flex';
}

function cerrarModalCaja() {
    document.getElementById('modal-caja').style.display = 'none';
}

async function ejecutarAperturaCaja() {
    const num = document.getElementById('apertura-caja-num').value;
    const cajero = document.getElementById('apertura-cajero-nombre').value;
    const ves = parseFloat(document.getElementById('apertura-monto-ves').value) || 0;
    const usd = parseFloat(document.getElementById('apertura-monto-usd').value) || 0;

    try {
        const res = await fetch('/api/pos/abrir-caja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_caja: num, cajero, monto_ves: ves, monto_usd: usd })
        });
        const data = await res.json();
        if (res.ok) {
            mostrarToast("Caja abierta exitosamente.", 'success');
            cerrarModalCaja();
            cargarSesionCaja();
        } else {
            mostrarToast(`Error: ${data.mensaje}`, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión", 'error');
    }
}

async function ejecutarCierreCaja() {
    const ves = parseFloat(document.getElementById('cierre-conteo-ves').value) || 0;
    const usd = parseFloat(document.getElementById('cierre-conteo-usd').value) || 0;

    try {
        const res = await fetch('/api/pos/cerrar-caja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sesion_id: state.sesionCaja.id, conteo_ves: ves, conteo_usd: usd })
        });
        const data = await res.json();
        if (res.ok) {
            mostrarToast(`Turno cerrado. Dif Bs: ${data.diferenciaVes} | Dif USD: ${data.diferenciaUsd}`, 'info');
            cerrarModalCaja();
            cargarSesionCaja();
        } else {
            mostrarToast(`Error: ${data.mensaje}`, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión", 'error');
    }
}

