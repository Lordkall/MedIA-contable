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
        if (e.key === 'F4') {
            e.preventDefault();
            abrirModalClientePOS();
        }
        if (e.key === 'F12') {
            e.preventDefault();
            if (state.carrito.length > 0) abrirModalCobro();
        }
        if (e.key === 'Escape') {
            cerrarModalCobro();
            cerrarModalTicket();
            cerrarModalCaja();
            cerrarModalClientePOS();
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
        if (data && data.tasa) {
            state.tasaBcv = Number(data.tasa);
        }
        const bcvEl = document.getElementById('pos-bcv-rate');
        if (bcvEl) {
            bcvEl.innerText = `Bs. ${(state.tasaBcv || 897.54).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        }
    } catch (err) {
        console.error('Error al cargar tasa BCV', err);
        const bcvEl = document.getElementById('pos-bcv-rate');
        if (bcvEl) bcvEl.innerText = `Bs. ${(state.tasaBcv || 897.54).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
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
            document.getElementById('pos-bcv-rate').innerText = `Bs. ${data.tasa.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
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
        const data = await res.json();
        state.categorias = Array.isArray(data) ? data : [];
        const container = document.getElementById('category-pills-container');
        if (!container) return;
        container.innerHTML = `<button class="pill-btn active" onclick="filtrarCategoria(null, this)">Todos</button>`;
        state.categorias.forEach(cat => {
            let label = cat.nombre;
            if (cat.codigo === 'LUBR') label = 'Lubricantes';
            else if (cat.codigo === 'FREN') label = 'Frenos & Clutch';
            else if (cat.codigo === 'TRAN') label = 'Arrastre & Cadenas';
            else if (cat.codigo === 'ELEC') label = 'Eléctrico & Luces';
            else if (cat.codigo === 'MOTO') label = 'Motor & Carburador';
            else if (cat.codigo === 'NEUM') label = 'Cauchos & Tripas';
            else if (cat.codigo === 'ACCE') label = 'Cascos & Accesorios';
            else label = (cat.nombre || '').replace(/,/g, '').split(' ')[0];

            container.innerHTML += `<button class="pill-btn" onclick="filtrarCategoria(${cat.id}, this)">${label}</button>`;
        });
    } catch (err) {
        console.error('Error al cargar categorías', err);
    }
}

async function cargarClientes() {
    try {
        const res = await fetch('/api/terceros/clientes');
        state.clientes = await res.json();
        seleccionarConsumidorFinal();
    } catch (err) {
        console.error('Error al cargar clientes', err);
    }
}

function actualizarBarraClienteUI(cliente) {
    const nombreEl = document.getElementById('pos-display-cliente-nombre');
    const docEl = document.getElementById('pos-display-cliente-doc');
    const tipoEl = document.getElementById('pos-display-cliente-tipo');

    if (!cliente) {
        if (nombreEl) nombreEl.innerText = 'CONSUMIDOR FINAL / CONTADO';
        if (docEl) docEl.innerText = 'V-00000000';
        if (tipoEl) tipoEl.innerText = 'Mostrador Local';
        return;
    }

    const docPrefijo = cliente.tipo_documento || 'V';
    const docNum = cliente.numero_documento || '00000000';
    const docDig = cliente.digito_verificador ? `-${cliente.digito_verificador}` : '';
    const rifCompleto = cliente.rif_completo || `${docPrefijo}-${docNum}${docDig}`;

    if (nombreEl) nombreEl.innerText = (cliente.razon_social || 'CONSUMIDOR FINAL / CONTADO').toUpperCase();
    if (docEl) docEl.innerText = rifCompleto;
    if (tipoEl) tipoEl.innerText = cliente.direccion || (cliente.tipo_contribuyente === 'ESPECIAL' ? 'Sujeto Pasivo Especial' : 'Mostrador Local');
}

function seleccionarConsumidorFinal() {
    const consFinal = state.clientes.find(c => c.numero_documento === '00000000');
    state.clienteSeleccionadoId = consFinal ? consFinal.id : 1;
    actualizarBarraClienteUI(consFinal || {
        razon_social: 'CONSUMIDOR FINAL / CONTADO',
        tipo_documento: 'V',
        numero_documento: '00000000',
        direccion: 'Mostrador Local'
    });
}

function abrirModalClientePOS() {
    const modal = document.getElementById('modal-cliente-pos');
    if (!modal) return;
    modal.style.display = 'flex';

    const searchInput = document.getElementById('modal-client-search');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 60);
    }

    const clienteActual = state.clientes.find(c => c.id === state.clienteSeleccionadoId);
    if (clienteActual) {
        poblarCamposModalCliente(clienteActual, true);
    } else {
        const consFinal = state.clientes.find(c => c.numero_documento === '00000000');
        poblarCamposModalCliente(consFinal || {
            tipo_documento: 'V',
            numero_documento: '00000000',
            digito_verificador: '0',
            razon_social: 'CONSUMIDOR FINAL / CONTADO',
            direccion: 'Mostrador Local',
            telefono: '--',
            tipo_contribuyente: 'NO_CONTRIBUYENTE'
        }, true);
    }
}

function cerrarModalClientePOS() {
    const modal = document.getElementById('modal-cliente-pos');
    if (modal) modal.style.display = 'none';
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) barcodeInput.focus();
}

function poblarCamposModalCliente(cliente, esRegistrado) {
    if (!cliente) return;
    if (document.getElementById('modal-cli-tipo')) document.getElementById('modal-cli-tipo').value = cliente.tipo_documento || 'V';
    if (document.getElementById('modal-cli-num')) document.getElementById('modal-cli-num').value = cliente.numero_documento || '';
    if (document.getElementById('modal-cli-dig')) {
        const dig = (cliente.digito_verificador !== undefined && cliente.digito_verificador !== null && cliente.digito_verificador !== '')
            ? cliente.digito_verificador
            : calcularDigitoSENIATFront(cliente.tipo_documento || 'V', cliente.numero_documento || '0');
        document.getElementById('modal-cli-dig').value = dig;
    }
    if (document.getElementById('modal-cli-razon')) document.getElementById('modal-cli-razon').value = cliente.razon_social || '';
    if (document.getElementById('modal-cli-dir')) document.getElementById('modal-cli-dir').value = cliente.direccion || 'Ciudad';
    if (document.getElementById('modal-cli-tlf')) document.getElementById('modal-cli-tlf').value = cliente.telefono || '';
    if (document.getElementById('modal-cli-contrib')) document.getElementById('modal-cli-contrib').value = cliente.tipo_contribuyente || 'ORDINARIO';

    const badge = document.getElementById('modal-cli-badge');
    if (badge) {
        if (cliente.numero_documento === '00000000') {
            badge.innerText = '✓ Consumidor Final';
            badge.style.color = '#86efac';
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else if (esRegistrado) {
            badge.innerText = '✓ Cliente Registrado';
            badge.style.color = '#86efac';
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
            badge.innerText = '✎ Nuevo Cliente';
            badge.style.color = '#38bdf8';
            badge.style.background = 'rgba(56, 189, 248, 0.15)';
            badge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        }
    }
}

function calcularDigitoSENIATFront(tipo, num) {
    const prefijos = { 'V': 1, 'E': 2, 'J': 3, 'P': 4, 'G': 5, 'C': 6 };
    const factores = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const cleanNum = String(num || '').replace(/[^0-9]/g, '').padStart(8, '0').slice(-8);
    const pref = prefijos[(tipo || 'V').toUpperCase()] !== undefined ? prefijos[(tipo || 'V').toUpperCase()] : 1;
    let suma = pref * factores[0];
    for (let i = 0; i < 8; i++) {
        suma += parseInt(cleanNum[i], 10) * factores[i + 1];
    }
    const resto = suma % 11;
    let digito = 11 - resto;
    if (digito >= 10) digito = 0;
    return digito;
}

function limpiarFormularioNuevoClientePOS() {
    const searchInput = document.getElementById('modal-client-search');
    if (searchInput) searchInput.value = '';

    const tipoEl = document.getElementById('modal-cli-tipo');
    const numEl = document.getElementById('modal-cli-num');
    const digEl = document.getElementById('modal-cli-dig');
    const razonEl = document.getElementById('modal-cli-razon');
    const dirEl = document.getElementById('modal-cli-dir');
    const tlfEl = document.getElementById('modal-cli-tlf');
    const contribEl = document.getElementById('modal-cli-contrib');

    if (tipoEl) tipoEl.value = 'V';
    if (numEl) numEl.value = '';
    if (digEl) digEl.value = '';
    if (razonEl) {
        razonEl.value = '';
        razonEl.placeholder = 'Nombre del cliente o Razón Social';
    }
    if (dirEl) dirEl.value = 'Ciudad';
    if (tlfEl) tlfEl.value = '';
    if (contribEl) contribEl.value = 'ORDINARIO';

    const badge = document.getElementById('modal-cli-badge');
    if (badge) {
        badge.innerText = '✎ Anotando Nuevo Cliente';
        badge.style.color = '#38bdf8';
        badge.style.background = 'rgba(56, 189, 248, 0.15)';
        badge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
    }

    if (numEl) setTimeout(() => numEl.focus(), 60);
}

function alCambiarTipoOCedula() {
    const tipoEl = document.getElementById('modal-cli-tipo');
    const numEl = document.getElementById('modal-cli-num');
    const digEl = document.getElementById('modal-cli-dig');
    const razonEl = document.getElementById('modal-cli-razon');
    const badge = document.getElementById('modal-cli-badge');

    const tipo = tipoEl ? tipoEl.value : 'V';
    const num = numEl ? numEl.value.trim().replace(/[^0-9]/g, '') : '';

    if (!num) {
        if (digEl) digEl.value = '';
        return;
    }

    if (digEl) {
        digEl.value = String(calcularDigitoSENIATFront(tipo, num));
    }

    const match = state.clientes.find(c => {
        const cNum = (c.numero_documento || '').replace(/[^0-9]/g, '');
        return cNum === num && (c.tipo_documento || 'V') === tipo;
    });

    if (match && match.numero_documento !== '00000000') {
        poblarCamposModalCliente(match, true);
    } else {
        if (badge) {
            badge.innerText = '✎ Nuevo Cliente (Por Registrar)';
            badge.style.color = '#38bdf8';
            badge.style.background = 'rgba(56, 189, 248, 0.15)';
            badge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        }
        if (razonEl && razonEl.value.includes('CONSUMIDOR FINAL')) {
            razonEl.value = '';
            razonEl.placeholder = 'Nombre o Razón Social';
        }
    }
}

function alEscribirNombreCliente() {
    const badge = document.getElementById('modal-cli-badge');
    const num = (document.getElementById('modal-cli-num')?.value || '').trim();
    if (badge && num !== '00000000') {
        badge.innerText = '✎ Nuevo Cliente';
        badge.style.color = '#38bdf8';
        badge.style.background = 'rgba(56, 189, 248, 0.15)';
        badge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
    }
}

function alBuscarClienteEnModal(val) {
    const term = (val || '').trim();
    if (!term) return;

    const cleanNum = term.replace(/[^0-9]/g, '');
    const cleanUpper = term.toUpperCase().replace(/\s+/g, '');

    const match = state.clientes.find(c => {
        const cNum = (c.numero_documento || '').replace(/[^0-9]/g, '');
        const cRif = (c.rif_completo || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
        return (cleanNum && cNum === cleanNum) || (cleanUpper && cRif.includes(cleanUpper)) || (c.razon_social && c.razon_social.toUpperCase().includes(term.toUpperCase()));
    });

    if (match) {
        poblarCamposModalCliente(match, true);
    } else {
        const tipoEl = document.getElementById('modal-cli-tipo');
        if (cleanUpper.startsWith('J') && tipoEl) tipoEl.value = 'J';
        else if (cleanUpper.startsWith('G') && tipoEl) tipoEl.value = 'G';
        else if (cleanUpper.startsWith('E') && tipoEl) tipoEl.value = 'E';

        const tipo = tipoEl ? tipoEl.value : 'V';
        const calcDig = cleanNum ? calcularDigitoSENIATFront(tipo, cleanNum) : '';

        poblarCamposModalCliente({
            tipo_documento: tipo,
            numero_documento: cleanNum || term,
            digito_verificador: calcDig,
            razon_social: '',
            direccion: 'Ciudad',
            telefono: '',
            tipo_contribuyente: 'ORDINARIO'
        }, false);
    }
}

function asignarConsumidorFinalDesdeModal() {
    seleccionarConsumidorFinal();
    cerrarModalClientePOS();
    mostrarToast('Cliente: Consumidor Final (Contado)', 'info');
}

async function confirmarClienteYPasarAlPOS() {
    const tipoEl = document.getElementById('modal-cli-tipo');
    const numEl = document.getElementById('modal-cli-num');
    const digEl = document.getElementById('modal-cli-dig');
    const razonEl = document.getElementById('modal-cli-razon');
    const dirEl = document.getElementById('modal-cli-dir');
    const tlfEl = document.getElementById('modal-cli-tlf');
    const contribEl = document.getElementById('modal-cli-contrib');

    const tipo = (tipoEl ? tipoEl.value : 'V').toUpperCase();
    const num = (numEl ? numEl.value : '').trim().replace(/[^0-9]/g, '');
    let dig = (digEl ? digEl.value : '').trim();
    const razon = (razonEl ? razonEl.value : '').trim();
    const dir = (dirEl ? dirEl.value : '').trim();
    const tlf = (tlfEl ? tlfEl.value : '').trim();
    const contrib = contribEl ? contribEl.value : 'ORDINARIO';

    // Si es Consumidor Final explícito
    if (num === '00000000' || razon.toUpperCase().includes('CONSUMIDOR FINAL')) {
        seleccionarConsumidorFinal();
        cerrarModalClientePOS();
        mostrarToast('Venta asignada a Consumidor Final', 'info');
        return;
    }

    if (!num) {
        mostrarToast('Por favor ingrese el número de Cédula o RIF del cliente', 'warning');
        if (numEl) numEl.focus();
        return;
    }

    if (!razon) {
        mostrarToast('Por favor ingrese el Nombre o Razón Social del cliente', 'warning');
        if (razonEl) razonEl.focus();
        return;
    }

    if (!dig) {
        dig = String(calcularDigitoSENIATFront(tipo, num));
        if (digEl) digEl.value = dig;
    }

    // Verificar si ya existe en la memoria
    const match = state.clientes.find(c => {
        const cNum = (c.numero_documento || '').replace(/[^0-9]/g, '');
        return cNum === num && (c.tipo_documento || 'V') === tipo;
    });

    if (match) {
        state.clienteSeleccionadoId = match.id;
        actualizarBarraClienteUI(match);
        cerrarModalClientePOS();
        mostrarToast(`✓ Cliente asignado: ${match.razon_social} (${match.rif_completo})`, 'success');
        return;
    }

    // Registrar nuevo cliente en la base de datos
    try {
        const res = await fetch('/api/terceros/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_documento: tipo,
                numero_documento: num,
                digito_verificador: dig,
                razon_social: razon,
                direccion: dir || 'Ciudad',
                telefono: tlf,
                tipo_contribuyente: contrib
            })
        });

        const data = await res.json();
        if (res.ok && data && data.id) {
            const idx = state.clientes.findIndex(c => c.id === data.id);
            if (idx >= 0) state.clientes[idx] = data;
            else state.clientes.push(data);

            state.clienteSeleccionadoId = data.id;
            actualizarBarraClienteUI(data);
            cerrarModalClientePOS();
            mostrarToast(`✓ Cliente registrado: ${data.razon_social} (${data.rif_completo})`, 'success');
        } else {
            mostrarToast(`No se pudo registrar: ${data.mensaje || 'Revise los datos del cliente'}`, 'error');
        }
    } catch (e) {
        console.error('Error registrando cliente:', e);
        mostrarToast('Error de conexión al registrar cliente', 'error');
    }
}

function imprimirTicketFiscalTermico() {
    const ticketText = state.ultimoTicket || document.getElementById('ticket-preview-content')?.innerText;
    if (!ticketText) {
        mostrarToast("No hay ticket fiscal emitido para imprimir.", "warning");
        return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Ticket Fiscal 80mm</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                body {
                    width: 72mm;
                    margin: 0 auto;
                    padding: 3mm 1mm;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11px;
                    line-height: 1.25;
                    color: #000000;
                    background: #ffffff;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
            </style>
        </head>
        <body>${ticketText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
        } catch(e) {
            console.error("Error al imprimir ticket térmico", e);
        }
        setTimeout(() => printFrame.remove(), 1200);
    }, 250);
}

async function asegurarClienteSeleccionado() {
    if (state.clienteSeleccionadoId) {
        return state.clienteSeleccionadoId;
    }
    const consFinal = state.clientes.find(c => c.numero_documento === '00000000');
    return consFinal ? consFinal.id : 1;
}

function abrirModalNuevoClientePOS() {
    abrirModalClientePOS();
}

function cerrarModalNuevoClientePOS() {
    cerrarModalClientePOS();
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
// RENDERIZADO DEL CATÁLOGO EN POS (FOTOS + COSTOS + TASA BCV)
// ==========================================
function renderizarCatalogo() {
    const container = document.getElementById('pos-products-container');
    if (!container) return;

    if (!Array.isArray(state.catalogo) || state.catalogo.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px 20px;">
                <svg style="width:40px; height:40px; stroke:var(--text-muted); stroke-width:1.5; fill:none; margin: 0 auto 12px; display:block; opacity:0.6;" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <div style="font-size:0.95rem; font-weight:600; margin-bottom:8px;">No se encontraron repuestos en el catálogo</div>
                <button type="button" onclick="cargarCatalogo()" class="btn-glass" style="font-size:0.78rem; padding:5px 14px; margin-top:8px;">Recargar Catálogo</button>
            </div>
        `;
        return;
    }

    container.innerHTML = state.catalogo.map(prod => {
        try {
            const stockActual = Number(prod.stock_actual || 0);
            const stockMinimo = Number(prod.stock_minimo || 5);
            const stockAlerta = stockActual <= stockMinimo ? 'color:#f87171;' : 'color:#86efac;';
            const imgUrl = prod.imagen_url || '/img/products/placeholder.svg';
            const catTintClass = `cat-tint-${prod.categoria_id || 1}`;
            const costoUsd = Number(prod.costo_usd || 0);
            const precioUsd = Number(prod.precio_usd || 0);
            const tasaActual = Number(state.tasaBcv || 900);
            const precioVes = prod.precio_ves !== undefined && prod.precio_ves !== null ? Number(prod.precio_ves) : Math.round(precioUsd * tasaActual * 100) / 100;
            const costoVes = prod.costo_ves !== undefined && prod.costo_ves !== null ? Number(prod.costo_ves) : Math.round(costoUsd * tasaActual * 100) / 100;

            return `
                <div class="product-card ${catTintClass}" onclick="agregarAlCarritoPorId(${prod.id})">
                    <!-- Barra Superior de Identificación Fiscal y Código -->
                    <div class="prod-card-top-bar">
                        <span class="prod-tag tag-${prod.alicuota_iva || 'G'}">${getNombreAlicuota(prod.alicuota_iva || 'G')}</span>
                        <span class="prod-barcode-badge">
                            <svg style="width:11px; height:11px; stroke:currentColor; stroke-width:2.2; fill:none; opacity:0.8;" viewBox="0 0 24 24"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>
                            <span>${prod.codigo_barra || '--'}</span>
                        </span>
                    </div>

                    <!-- Foto del Producto (Garantizada Visible con 110px de Alto) -->
                    <div class="product-img-box">
                        <img src="${imgUrl}" alt="${prod.descripcion}" class="product-img" onerror="this.onerror=null; this.src='/img/products/placeholder.svg';">
                    </div>

                    <!-- Título del Producto -->
                    <div>
                        <div class="prod-desc" title="${prod.descripcion}">${prod.descripcion}</div>
                    </div>

                    <!-- Precios, Costo y Stock -->
                    <div>
                        <div class="prod-prices">
                            <span class="price-ves">Bs. ${precioVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            <span class="price-usd">$ ${precioUsd.toFixed(2)}</span>
                        </div>
                        <div class="prod-cost-row">
                            <span>Costo Ref: <strong class="prod-cost-val">$ ${costoUsd.toFixed(2)}</strong></span>
                            <span>(Bs. ${costoVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})})</span>
                        </div>
                        <div class="prod-footer">
                            <span class="prod-stock">Stock: <strong style="${stockAlerta}">${stockActual}</strong> ${prod.unidad_medida || 'UNID'}</span>
                            <span style="font-size: 0.74rem; color: #60a5fa; font-weight:800;">+ Agregar</span>
                        </div>
                    </div>
                </div>
            `;
        } catch(e) {
            console.error("Error al renderizar tarjeta de producto", prod, e);
            return '';
        }
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
let alertaGlassCallback = null;

function mostrarAlertaFlotante(titulo, mensaje, tipo = 'success') {
    const modal = document.getElementById('modal-alerta-glass');
    if (!modal) {
        mostrarToast(`${titulo}: ${mensaje}`, tipo);
        return;
    }
    const iconEl = document.getElementById('alerta-glass-icon');
    const titleEl = document.getElementById('alerta-glass-titulo');
    const msgEl = document.getElementById('alerta-glass-mensaje');
    const btnCancel = document.getElementById('alerta-glass-btn-cancelar');
    const btnAceptar = document.getElementById('alerta-glass-btn-aceptar');

    if (btnCancel) btnCancel.style.display = 'none';
    if (btnAceptar) {
        btnAceptar.innerText = 'Aceptar';
        btnAceptar.className = 'btn-glass btn-glass-primary';
    }
    alertaGlassCallback = null;

    if (iconEl) {
        if (tipo === 'success') {
            iconEl.innerHTML = '<span style="color:#86efac; filter:drop-shadow(0 0 12px rgba(16,185,129,0.5));">✓</span>';
        } else if (tipo === 'error') {
            iconEl.innerHTML = '<span style="color:#f87171; filter:drop-shadow(0 0 12px rgba(239,68,68,0.5));">✕</span>';
        } else if (tipo === 'warning') {
            iconEl.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 12px rgba(245,158,11,0.5));"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        } else {
            iconEl.innerHTML = '<span style="color:#93c5fd; filter:drop-shadow(0 0 12px rgba(59,130,246,0.5));">ℹ</span>';
        }
    }
    if (titleEl) titleEl.innerText = titulo;
    if (msgEl) msgEl.innerHTML = String(mensaje || '').replace(/\n/g, '<br>');

    modal.style.display = 'flex';
}

function mostrarConfirmFlotante(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('modal-alerta-glass');
    if (!modal) {
        if (confirm(`${titulo}\n\n${mensaje}`)) {
            if (onConfirm) onConfirm();
        }
        return;
    }
    const iconEl = document.getElementById('alerta-glass-icon');
    const titleEl = document.getElementById('alerta-glass-titulo');
    const msgEl = document.getElementById('alerta-glass-mensaje');
    const btnCancel = document.getElementById('alerta-glass-btn-cancelar');
    const btnAceptar = document.getElementById('alerta-glass-btn-aceptar');

    if (btnCancel) btnCancel.style.display = 'block';
    if (btnAceptar) {
        btnAceptar.innerText = 'Confirmar';
        btnAceptar.className = 'btn-glass btn-glass-primary';
    }
    alertaGlassCallback = onConfirm;

    if (iconEl) {
        iconEl.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 12px rgba(245,158,11,0.5));"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }
    if (titleEl) titleEl.innerText = titulo;
    if (msgEl) msgEl.innerHTML = String(mensaje || '').replace(/\n/g, '<br>');

    modal.style.display = 'flex';
}

function ejecutarAceptarAlertaGlass() {
    cerrarAlertaGlass();
    if (typeof alertaGlassCallback === 'function') {
        const cb = alertaGlassCallback;
        alertaGlassCallback = null;
        cb();
    }
}

function cerrarAlertaGlass() {
    const modal = document.getElementById('modal-alerta-glass');
    if (modal) modal.style.display = 'none';
    alertaGlassCallback = null;
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `glass-toast toast-${tipo}`;
    const iconSpan = tipo === 'success' 
        ? '<span>✓</span>' 
        : tipo === 'error' 
        ? '<span>✕</span>' 
        : tipo === 'warning' 
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' 
        : '<span>ℹ</span>';
    toast.innerHTML = `
        <span style="font-size:1.1rem; display:inline-flex; align-items:center;">${iconSpan}</span>
        <span>${String(mensaje || '').replace(/\n/g, '<br>')}</span>
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
            imagen_url: prod.imagen_url || '/img/products/placeholder.svg',
            cantidad: 1,
            stock_max: prod.stock_actual
        });
    }

    actualizarCarritoUI(true);
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
    actualizarCarritoUI(false);
}

function eliminarDelCarrito(prodId) {
    state.carrito = state.carrito.filter(it => it.producto_id !== prodId);
    actualizarCarritoUI(false);
}

function limpiarCarrito() {
    if (state.carrito.length === 0) return;
    state.carrito = [];
    actualizarCarritoUI(false);
    mostrarToast("Ticket cancelado y vaciado.", 'info');
}

function actualizarCarritoUI(scrollDown = false) {
    const listContainer = document.getElementById('cart-items-list');
    const itemsCountEl = document.getElementById('cart-items-count');
    const btnCobrar = document.getElementById('btn-cobrar');

    if (state.carrito.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); margin-top: 50px;">
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
        const img = it.imagen_url || '/img/products/placeholder.svg';
        return `
            <div class="cart-item">
                <div class="cart-item-row-top">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <img src="${img}" onerror="this.onerror=null; this.src='/img/products/placeholder.svg';" style="width:28px; height:28px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); padding:2px; flex-shrink:0;">
                        <div class="cart-item-title" title="${it.descripcion}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${it.descripcion}</div>
                    </div>
                    <button onclick="eliminarDelCarrito(${it.producto_id})" style="background:none; border:none; color:#f87171; cursor:pointer; padding:2px; margin-left:6px;" title="Quitar ítem">
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

    if (scrollDown) {
        setTimeout(() => {
            listContainer.scrollTop = listContainer.scrollHeight;
        }, 40);
    }
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
        mostrarToast("Atención: Debe abrir la caja antes de poder emitir facturas.", "warning");
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

    const clienteIdFinal = await asegurarClienteSeleccionado();

    const payload = {
        cliente_id: clienteIdFinal,
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
            mostrarToast(`Error Fiscal: ${data.mensaje || 'No se pudo procesar la venta'}`, "error");
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> EMITIR FACTURA FISCAL`;
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
        mostrarToast("Error de conexión al emitir factura fiscal", "error");
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> EMITIR FACTURA FISCAL`;
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
        mostrarToast("✓ Texto del ticket copiado al portapapeles.", "info");
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
        mostrarToast("Error al solicitar Reporte X", "error");
    }
}

async function solicitarReporteZ() {
    mostrarConfirmFlotante(
        "Cierre Z Fiscal - SENIAT",
        "ADVERTENCIA SENIAT: El Cierre Z cerrará definitivamente el día fiscal de la máquina y generará el bloque de auditoría inalterable diario.<br><br>¿Desea proceder?",
        async () => {
            try {
                const res = await fetch('/api/pos/reporte-z', { method: 'POST' });
                const data = await res.json();
                mostrarModalTicket(data.reporte);
                mostrarToast("✓ Cierre Z Fiscal completado", "success");
            } catch (err) {
                mostrarToast("Error al emitir Cierre Z", "error");
            }
        }
    );
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

