/**
 * Lógica Front-End para MeDIa Administrativo (Back-Office)
 */

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

let adminState = {
    tasaBcv: 65.50,
    productos: [],
    categorias: [],
    clientes: [],
    proveedores: [],
    compras: []
};

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionGeneral();
    await cargarKPIs();
    await cargarCategorias();
    await cargarInventario();
    await cargarCompras();
    await cargarClientesYProveedores();
});

// ==========================================
// PESTAÑAS Y NAVEGACIÓN
// ==========================================
function cambiarTab(tabName, btnEl) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const tabs = ['inventario', 'compras', 'terceros', 'libros', 'configuracion'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    });

    if (tabName === 'libros') {
        cargarLibroFiscal();
    }
}

// ==========================================
// CONFIGURACIÓN & KPIS
// ==========================================
async function cargarConfiguracionGeneral() {
    try {
        const resBcv = await fetch('/api/bcv/tasa');
        const dataBcv = await resBcv.json();
        adminState.tasaBcv = dataBcv.tasa;

        const bcvText = `Bs. ${dataBcv.tasa.toFixed(2)}`;
        const topBcv = document.getElementById('top-bcv-rate');
        if (topBcv) topBcv.innerText = bcvText;
        const sideBcv = document.getElementById('sidebar-bcv-val');
        if (sideBcv) sideBcv.innerText = bcvText;
        const confBcv = document.getElementById('config-tasa-bcv');
        if (confBcv) confBcv.value = dataBcv.tasa;

        const resConf = await fetch('/api/configuracion');
        const conf = await resConf.json();
        const confRazon = document.getElementById('config-razon-social');
        if (confRazon) confRazon.value = conf.razon_social;
        const confRif = document.getElementById('config-rif');
        if (confRif) confRif.value = conf.rif;
        const confSerial = document.getElementById('config-serial-fiscal');
        if (confSerial) confSerial.value = conf.serial_impresora_fiscal;

        // Estado de Caja
        const resCaja = await fetch('/api/pos/sesion');
        const sesion = await resCaja.json();
        const cajaStatus = document.getElementById('top-caja-status');
        const pillCaja = document.getElementById('pill-caja-header');
        if (sesion && sesion.estado === 'ABIERTA') {
            if (cajaStatus) cajaStatus.innerText = `Caja ${sesion.numero_caja} (Abierta)`;
            if (pillCaja) pillCaja.className = 'pill-badge caja-open';
        } else {
            if (cajaStatus) cajaStatus.innerText = 'Cerrada';
            if (pillCaja) pillCaja.className = 'pill-badge';
        }
    } catch (err) {
        console.error("Error al cargar configuración", err);
    }
}

async function cargarKPIs() {
    try {
        const res = await fetch('/api/reportes/gerencial');
        const ger = await res.json();
        const kpiCosto = document.getElementById('kpi-valor-costo');
        if (kpiCosto) kpiCosto.innerText = `$ ${ger.inventario.valor_costo_usd.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        const kpiVenta = document.getElementById('kpi-valor-venta');
        if (kpiVenta) kpiVenta.innerText = `$ ${ger.inventario.valor_venta_usd.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        const kpiTotVes = document.getElementById('kpi-total-ventas');
        if (kpiTotVes) kpiTotVes.innerText = `Bs. ${ger.ventas.total_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        const kpiTotUsd = document.getElementById('kpi-total-ventas-usd');
        if (kpiTotUsd) kpiTotUsd.innerText = `$ ${ger.ventas.total_usd.toFixed(2)}`;
        const kpiIgtf = document.getElementById('kpi-total-igtf');
        if (kpiIgtf) kpiIgtf.innerText = `Bs. ${ger.ventas.total_igtf_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // Desglose de Medios de Pago en Dashboard
        const mediosContainer = document.getElementById('dashboard-medios-pago-list');
        if (mediosContainer && ger.mediosDePago) {
            if (ger.mediosDePago.length === 0) {
                mediosContainer.innerHTML = `<div style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:15px;">Aún no hay cobros procesados</div>`;
            } else {
                mediosContainer.innerHTML = ger.mediosDePago.map(m => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="display:block; font-size:0.85rem;">${m.metodo_pago.replace('_', ' ')}</strong>
                            <small style="color:var(--text-muted);">${m.moneda === 'USD' ? 'Divisa' : 'Moneda Nacional'}</small>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:#86efac; font-size:0.95rem;">Bs. ${m.total_ves.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong>
                            <div style="font-size:0.75rem; color:#93c5fd;">${m.moneda === 'USD' ? `$ ${m.total_capturado.toFixed(2)}` : ''}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Error al cargar KPIs", err);
    }
}

async function guardarTasaBCV() {
    const val = parseFloat(document.getElementById('config-tasa-bcv').value);
    if (isNaN(val) || val <= 0) {
        alert("Ingrese una tasa válida.");
        return;
    }

    try {
        const res = await fetch('/api/bcv/tasa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasa: val })
        });
        if (res.ok) {
            alert("Tasa oficial BCV guardada exitosamente.");
            await cargarConfiguracionGeneral();
            await cargarInventario();
            await cargarKPIs();
        } else {
            alert("Error al guardar la tasa.");
        }
    } catch (err) {
        alert("Error de conexión");
    }
}

/**
 * Agarra automáticamente la tasa oficial del Banco Central de Venezuela (BCV)
 * en tiempo real sin intervención manual
 */
async function sincronizarBCVAuto(btnEl) {
    const feedback = document.getElementById('bcv-sync-feedback');
    const icons = document.querySelectorAll('#sync-icon-sidebar, #sync-icon-header, #sync-icon-config');
    icons.forEach(ic => ic.classList.add('sync-spin'));

    if (feedback) {
        feedback.innerHTML = `<span style="color:#60a5fa;">Conectando en vivo con el Banco Central de Venezuela...</span>`;
    }

    try {
        const res = await fetch('/api/bcv/sincronizar', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.exito) {
            adminState.tasaBcv = data.tasa;
            const formatted = `Bs. ${data.tasa.toFixed(2)}`;

            const topBcv = document.getElementById('top-bcv-rate');
            if (topBcv) topBcv.innerText = formatted;
            const sideBcv = document.getElementById('sidebar-bcv-val');
            if (sideBcv) sideBcv.innerText = formatted;
            const inputBcv = document.getElementById('config-tasa-bcv');
            if (inputBcv) inputBcv.value = data.tasa;

            if (feedback) {
                feedback.innerHTML = `<span style="color:#86efac; font-weight:bold;">✓ Sincronización Exitosa con BCV: Bs. ${data.tasa.toFixed(2)} (Fecha: ${data.fecha})</span>`;
            }

            // Recalcular productos y catálogo en tiempo real con la nueva tasa
            await cargarInventario();
            await cargarKPIs();
        } else {
            if (feedback) {
                feedback.innerHTML = `<span style="color:#f87171;">No se pudo obtener respuesta del BCV: ${data.mensaje || 'Error'}</span>`;
            }
        }
    } catch (err) {
        if (feedback) {
            feedback.innerHTML = `<span style="color:#f87171;">Error de conexión con el servidor de MeDIa.</span>`;
        }
    } finally {
        icons.forEach(ic => ic.classList.remove('sync-spin'));
    }
}

// ==========================================
// INVENTARIO & KÁRDEX
// ==========================================
async function cargarCategorias() {
    try {
        const res = await fetch('/api/inventario/categorias');
        adminState.categorias = await res.json();
        const sel = document.getElementById('prod-form-cat');
        sel.innerHTML = adminState.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (err) {
        console.error("Error al cargar categorías", err);
    }
}

async function cargarInventario() {
    try {
        const res = await fetch('/api/inventario/productos');
        adminState.productos = await res.json();
        renderizarTablaInventario(adminState.productos);
    } catch (err) {
        console.error("Error al cargar inventario", err);
    }
}

function filtrarInventario() {
    const q = document.getElementById('inv-search').value.toLowerCase().trim();
    const filtrados = adminState.productos.filter(p => 
        p.descripcion.toLowerCase().includes(q) ||
        p.codigo_barra.toLowerCase().includes(q) ||
        (p.referencia && p.referencia.toLowerCase().includes(q))
    );
    renderizarTablaInventario(filtrados);
}

function renderizarTablaInventario(items) {
    const tbody = document.getElementById('inventario-table-body');
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:30px;">No hay productos registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(p => {
        const stockAlerta = p.stock_actual <= p.stock_minimo ? 'color:#f87171; font-weight:bold;' : 'color:#86efac;';
        const imgUrl = p.imagen_url || '/img/products/placeholder.svg';
        return `
            <tr>
                <td><code>${p.codigo_barra}</code></td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:38px; height:38px; border-radius:8px; background:rgba(0,0,0,0.4); border:1px solid var(--glass-border); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                            <img src="${imgUrl}" alt="${p.descripcion}" style="width:100%; height:100%; object-fit:contain; padding:2px;" onerror="this.onerror=null; this.src='/img/products/placeholder.svg';">
                        </div>
                        <strong>${p.descripcion}</strong>
                    </div>
                </td>
                <td><small style="color:var(--text-muted);">${p.categoria_nombre || 'General'}</small></td>
                <td><span class="prod-tag tag-${p.alicuota_iva}">${p.alicuota_iva === 'G' ? 'IVA 16%' : p.alicuota_iva === 'E' ? 'EXENTO' : p.alicuota_iva}</span></td>
                <td>$ ${p.costo_usd.toFixed(2)}</td>
                <td><strong>$ ${p.precio_usd.toFixed(2)}</strong></td>
                <td><strong style="color:#86efac;">Bs. ${p.precio_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></td>
                <td style="${stockAlerta}">${p.stock_actual} ${p.unidad_medida}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button onclick="verKardex(${p.id}, '${p.descripcion.replace(/'/g, "\\'")}', '${p.codigo_barra}', ${p.stock_actual}, '${p.unidad_medida}')" class="btn-glass" style="padding:4px 9px; font-size:0.75rem;" title="Ver historial de movimientos">
                            <svg style="width:12px; height:12px; stroke:currentColor; stroke-width:2; fill:none;" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>
                            <span>Kárdex</span>
                        </button>
                        <button onclick="abrirModalAjuste(${p.id}, '${p.descripcion.replace(/'/g, "\\'")}', '${p.codigo_barra}', ${p.stock_actual}, '${p.unidad_medida}')" class="btn-glass" style="padding:4px 9px; font-size:0.75rem;" title="Ajustar existencia">
                            <svg style="width:12px; height:12px; stroke:currentColor; stroke-width:2; fill:none;" viewBox="0 0 24 24"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                            <span>Ajuste</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalNuevoProducto() {
    document.getElementById('modal-producto').style.display = 'flex';
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').style.display = 'none';
}

async function guardarProductoNuevo() {
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const desc = document.getElementById('prod-form-desc').value.trim();
    const cat = document.getElementById('prod-form-cat').value;
    const iva = document.getElementById('prod-form-iva').value;
    const imgUrl = document.getElementById('prod-form-img') ? document.getElementById('prod-form-img').value.trim() : '';
    const costo = parseFloat(document.getElementById('prod-form-costo').value) || 0;
    const precio = parseFloat(document.getElementById('prod-form-precio').value) || 0;
    const stock = parseFloat(document.getElementById('prod-form-stock').value) || 0;
    const stockMin = parseFloat(document.getElementById('prod-form-stock-min').value) || 5;

    if (!barcode || !desc) {
        mostrarToast("Código de barras y descripción son obligatorios.", 'error');
        return;
    }

    try {
        const res = await fetch('/api/inventario/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_barra: barcode,
                descripcion: desc,
                categoria_id: cat,
                alicuota_iva: iva,
                costo_usd: costo,
                precio_usd: precio,
                stock_actual: stock,
                stock_minimo: stockMin,
                imagen_url: imgUrl
            })
        });

        if (res.ok) {
            mostrarToast("Producto guardado exitosamente.", 'success');
            cerrarModalProducto();
            cargarInventario();
            cargarKPIs();
        } else {
            const d = await res.json();
            mostrarToast(`Error: ${d.mensaje}`, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión al guardar producto.", 'error');
    }
}

// ==========================================
// KÁRDEX & AJUSTES FLOTANTES GLASSY
// ==========================================
let ajusteModalState = {
    productoId: null,
    stockActual: 0,
    unidadMedida: 'UNID',
    tipo: 'AJUSTE_POSITIVO'
};

function abrirModalAjuste(prodId, desc, barcode, stockActual, unidad) {
    ajusteModalState.productoId = prodId;
    ajusteModalState.stockActual = stockActual !== undefined ? Number(stockActual) : 0;
    ajusteModalState.unidadMedida = unidad || 'UNID';
    ajusteModalState.tipo = 'AJUSTE_POSITIVO';

    document.getElementById('ajuste-prod-id').value = prodId;
    document.getElementById('ajuste-prod-info').innerText = `${desc} (Código: ${barcode || 'S/C'})`;
    document.getElementById('ajuste-stock-actual').innerText = `${ajusteModalState.stockActual} ${ajusteModalState.unidadMedida}`;
    document.getElementById('ajuste-cantidad').value = '1';
    document.getElementById('ajuste-motivo-select').value = 'Conteo Físico / Inventario Periódico';
    document.getElementById('ajuste-motivo-otro').style.display = 'none';
    document.getElementById('ajuste-motivo-otro').value = '';

    seleccionarTipoAjuste('AJUSTE_POSITIVO');
    document.getElementById('modal-ajuste-stock').style.display = 'flex';
}

function cerrarModalAjuste() {
    document.getElementById('modal-ajuste-stock').style.display = 'none';
}

function seleccionarTipoAjuste(tipo) {
    ajusteModalState.tipo = tipo;
    const btnPos = document.getElementById('btn-ajuste-pos');
    const btnNeg = document.getElementById('btn-ajuste-neg');

    if (tipo === 'AJUSTE_POSITIVO') {
        btnPos.classList.add('active-positive');
        btnNeg.classList.remove('active-negative');
    } else {
        btnPos.classList.remove('active-positive');
        btnNeg.classList.add('active-negative');
    }
    recalcularStockEstimadoAjuste();
}

function recalcularStockEstimadoAjuste() {
    const cant = parseFloat(document.getElementById('ajuste-cantidad').value) || 0;
    const stockActual = ajusteModalState.stockActual;
    const labelEstimado = document.getElementById('ajuste-stock-estimado');
    const btnConfirmar = document.getElementById('btn-confirmar-ajuste');

    let estimado = stockActual;
    if (ajusteModalState.tipo === 'AJUSTE_POSITIVO') {
        estimado = stockActual + cant;
        labelEstimado.style.color = '#86efac';
        btnConfirmar.disabled = cant <= 0;
    } else {
        estimado = stockActual - cant;
        if (estimado < 0) {
            labelEstimado.style.color = '#f87171';
            btnConfirmar.disabled = true;
        } else {
            labelEstimado.style.color = '#86efac';
            btnConfirmar.disabled = cant <= 0;
        }
    }
    labelEstimado.innerText = `${estimado} ${ajusteModalState.unidadMedida}`;
}

function verificarMotivoPersonalizado(sel) {
    const inputOtro = document.getElementById('ajuste-motivo-otro');
    if (sel.value === 'OTRO') {
        inputOtro.style.display = 'block';
        inputOtro.focus();
    } else {
        inputOtro.style.display = 'none';
    }
}

async function guardarAjusteStockModal() {
    const prodId = ajusteModalState.productoId;
    const cant = parseFloat(document.getElementById('ajuste-cantidad').value) || 0;
    if (cant <= 0) {
        mostrarToast("Ingrese una cantidad válida mayor a 0", 'error');
        return;
    }

    const selMotivo = document.getElementById('ajuste-motivo-select').value;
    let motivoFinal = selMotivo;
    if (selMotivo === 'OTRO') {
        motivoFinal = document.getElementById('ajuste-motivo-otro').value.trim() || 'Ajuste Manual Personalizado';
    }

    const btnConfirmar = document.getElementById('btn-confirmar-ajuste');
    btnConfirmar.disabled = true;
    btnConfirmar.innerText = "Aplicando Ajuste...";

    try {
        const res = await fetch('/api/inventario/ajustar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                producto_id: prodId,
                cantidad: cant,
                tipo: ajusteModalState.tipo,
                motivo: motivoFinal
            })
        });

        const data = await res.json();
        if (res.ok) {
            mostrarToast("Ajuste de inventario aplicado y registrado en el Kárdex.", 'success');
            cerrarModalAjuste();
            await cargarInventario();
            await cargarKPIs();
        } else {
            mostrarToast(`Error: ${data.mensaje || 'No se pudo procesar el ajuste'}`, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión con el servidor", 'error');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerText = "Aplicar Ajuste Fiscal";
    }
}

async function verKardex(prodId, desc, barcode, stockActual, unidad) {
    try {
        const res = await fetch(`/api/inventario/kardex/${prodId}`);
        const movimientos = await res.json();

        document.getElementById('kardex-modal-title').innerText = `Kárdex: ${desc}`;
        document.getElementById('kardex-modal-subtitle').innerText = `Código: ${barcode || '--'} | Trazabilidad y auditoría SENIAT`;

        let totalEntradas = 0;
        let totalSalidas = 0;

        const tbody = document.getElementById('kardex-table-body');
        if (!movimientos || movimientos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">Sin movimientos registrados para este producto</td></tr>`;
        } else {
            tbody.innerHTML = movimientos.map(m => {
                const esEntrada = m.tipo_movimiento.includes('ENTRADA') || m.tipo_movimiento.includes('INICIAL') || m.tipo_movimiento === 'AJUSTE_POSITIVO' || m.tipo_movimiento.includes('COMPRA');
                if (esEntrada) {
                    totalEntradas += m.cantidad;
                } else {
                    totalSalidas += m.cantidad;
                }

                const badgeBg = esEntrada ? 'background:rgba(16, 185, 129, 0.2); color:#86efac; border:1px solid rgba(16, 185, 129, 0.4);' : 'background:rgba(239, 68, 68, 0.2); color:#fca5a5; border:1px solid rgba(239, 68, 68, 0.4);';
                const signo = esEntrada ? '+' : '-';

                return `
                    <tr>
                        <td><small style="color:var(--text-muted);">${m.fecha}</small></td>
                        <td>
                            <span style="font-size:0.75rem; font-weight:800; padding:3px 8px; border-radius:6px; display:inline-block; ${badgeBg}">
                                ${m.tipo_movimiento}
                            </span>
                        </td>
                        <td style="text-align: right; font-weight:800; color:${esEntrada ? '#86efac' : '#fca5a5'};">${signo}${m.cantidad}</td>
                        <td style="text-align: right; color:var(--text-muted);">${m.stock_anterior}</td>
                        <td style="text-align: right; font-weight:700; color:#93c5fd;">${m.stock_nuevo}</td>
                        <td><code>${m.referencia_documento || 'S/R'}</code></td>
                    </tr>
                `;
            }).join('');
        }

        document.getElementById('kardex-total-entradas').innerText = `+${totalEntradas} ${unidad || 'UNID'}`;
        document.getElementById('kardex-total-salidas').innerText = `-${totalSalidas} ${unidad || 'UNID'}`;
        document.getElementById('kardex-stock-actual').innerText = `${stockActual !== undefined ? stockActual : (totalEntradas - totalSalidas)} ${unidad || 'UNID'}`;

        document.getElementById('modal-kardex').style.display = 'flex';
    } catch (err) {
        mostrarToast("Error al cargar movimientos del Kárdex", 'error');
    }
}

function cerrarModalKardex() {
    document.getElementById('modal-kardex').style.display = 'none';
}

// ==========================================
// COMPRAS A PROVEEDORES
// ==========================================
async function cargarCompras() {
    try {
        const res = await fetch('/api/compras');
        adminState.compras = await res.json();
        renderizarTablaCompras();
    } catch (err) {
        console.error("Error al cargar compras", err);
    }
}

function renderizarTablaCompras() {
    const tbody = document.getElementById('compras-table-body');
    if (!adminState.compras || adminState.compras.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-secondary);">No hay compras registradas</td></tr>`;
        return;
    }

    tbody.innerHTML = adminState.compras.map(c => `
        <tr>
            <td>#${c.id}</td>
            <td><small>${c.fecha_factura}</small></td>
            <td><strong>${c.proveedor_nombre}</strong><br><small style="color:var(--text-secondary);">${c.proveedor_rif}</small></td>
            <td><code>${c.numero_factura_proveedor}</code></td>
            <td><code>${c.numero_control_proveedor || ''}</code></td>
            <td>Bs. ${c.base_imponible_ves.toLocaleString('es-VE', {minimumFractionDigits:2})}</td>
            <td>Bs. ${c.monto_iva_ves.toLocaleString('es-VE', {minimumFractionDigits:2})}</td>
            <td>
                ${c.comprobante_retencion_iva ? `<span style="color:#60a5fa; font-weight:bold;">${c.comprobante_retencion_iva}</span><br><small>Ret: Bs. ${c.monto_retenido_iva_ves.toFixed(2)}</small>` : 'N/A'}
            </td>
            <td><strong style="color:#86efac;">Bs. ${c.total_compra_ves.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></td>
            <td><strong>$ ${c.total_compra_usd.toFixed(2)}</strong></td>
        </tr>
    `).join('');
}

function abrirModalNuevaCompra() {
    const selProv = document.getElementById('compra-form-prov');
    selProv.innerHTML = adminState.proveedores.map(p => `<option value="${p.id}">${p.razon_social} (${p.rif_completo})</option>`).join('');
    document.getElementById('compra-form-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('compra-items-list').innerHTML = '';
    agregarRenglonCompra();
    document.getElementById('modal-compra').style.display = 'flex';
}

function cerrarModalCompra() {
    document.getElementById('modal-compra').style.display = 'none';
}

function agregarRenglonCompra() {
    const container = document.getElementById('compra-items-list');
    const rowId = Date.now();
    const prodsOptions = adminState.productos.map(p => `<option value="${p.id}">${p.descripcion} (Costo actual: $${p.costo_usd.toFixed(2)})</option>`).join('');

    const div = document.createElement('div');
    div.id = `compra-row-${rowId}`;
    div.style = "display:grid; grid-template-columns: 2fr 100px 120px 40px; gap:8px; margin-bottom:8px; align-items:center;";
    div.innerHTML = `
        <select class="form-select compra-prod-select">${prodsOptions}</select>
        <input type="number" step="0.01" class="input-text compra-prod-cant" placeholder="Cant." value="10">
        <input type="number" step="0.01" class="input-text compra-prod-costo" placeholder="Costo USD $" value="1.00">
        <button onclick="document.getElementById('compra-row-${rowId}').remove()" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:bold;">✕</button>
    `;
    container.appendChild(div);
}

async function guardarCompra() {
    const provId = document.getElementById('compra-form-prov').value;
    const fecha = document.getElementById('compra-form-fecha').value;
    const numFactura = document.getElementById('compra-form-factura').value.trim();
    const numControl = document.getElementById('compra-form-control').value.trim();

    if (!numFactura) {
        alert("El número de factura del proveedor es obligatorio para el Libro de Compras.");
        return;
    }

    const rows = document.querySelectorAll('#compra-items-list > div');
    const items = [];
    rows.forEach(r => {
        const prodId = r.querySelector('.compra-prod-select').value;
        const cant = parseFloat(r.querySelector('.compra-prod-cant').value) || 0;
        const costo = parseFloat(r.querySelector('.compra-prod-costo').value) || 0;
        if (prodId && cant > 0) {
            items.push({ producto_id: prodId, cantidad: cant, costo_unitario_usd: costo });
        }
    });

    if (items.length === 0) {
        alert("Debe agregar al menos un producto a la compra.");
        return;
    }

    try {
        const res = await fetch('/api/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proveedor_id: provId,
                fecha_factura: fecha,
                numero_factura_proveedor: numFactura,
                numero_control_proveedor: numControl,
                items: items
            })
        });

        const d = await res.json();
        if (res.ok) {
            alert(`Compra registrada exitosamente.\nInventario actualizado.\nComprobante de Retención IVA SENIAT: ${d.comprobanteRetencionIva || 'No aplicable'}`);
            cerrarModalCompra();
            cargarCompras();
            cargarInventario();
            cargarKPIs();
        } else {
            alert(`Error: ${d.mensaje}`);
        }
    } catch (err) {
        alert("Error de conexión al registrar compra");
    }
}

// ==========================================
// CLIENTES Y PROVEEDORES (RIF MÓDULO 11)
// ==========================================
async function cargarClientesYProveedores() {
    try {
        const resC = await fetch('/api/terceros/clientes');
        adminState.clientes = await resC.json();
        const tbodyC = document.getElementById('clientes-table-body');
        tbodyC.innerHTML = adminState.clientes.map(c => `
            <tr>
                <td><code>${c.rif_completo}</code></td>
                <td><strong>${c.razon_social}</strong></td>
                <td><small>${c.tipo_contribuyente}</small></td>
            </tr>
        `).join('');

        const resP = await fetch('/api/terceros/proveedores');
        adminState.proveedores = await resP.json();
        const tbodyP = document.getElementById('proveedores-table-body');
        tbodyP.innerHTML = adminState.proveedores.map(p => `
            <tr>
                <td><code>${p.rif_completo}</code></td>
                <td><strong>${p.razon_social}</strong></td>
                <td>${p.porcentaje_retencion_iva}%</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error al cargar terceros", err);
    }
}

function abrirModalNuevoCliente() {
    document.getElementById('modal-cliente').style.display = 'flex';
}

function cerrarModalCliente() {
    document.getElementById('modal-cliente').style.display = 'none';
}

async function guardarCliente() {
    const tipo = document.getElementById('cli-tipo').value;
    const num = document.getElementById('cli-num').value.trim();
    const digito = document.getElementById('cli-digito').value.trim();
    const nombre = document.getElementById('cli-nombre').value.trim();
    const dir = document.getElementById('cli-dir').value.trim();
    const tel = document.getElementById('cli-tel').value.trim();
    const tipoTrib = document.getElementById('cli-tipo-trib').value;

    if (!num || !nombre) {
        alert("Cédula/RIF y Razón Social son requeridos.");
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
                razon_social: nombre,
                direccion: dir,
                telefono: tel,
                tipo_contribuyente: tipoTrib
            })
        });

        const d = await res.json();
        if (res.ok) {
            alert("Cliente validado ante algoritmo SENIAT y registrado.");
            cerrarModalCliente();
            cargarClientesYProveedores();
        } else {
            alert(`Error de Validación: ${d.mensaje}`);
        }
    } catch (err) {
        alert("Error de conexión");
    }
}

// ==========================================
// LIBROS FISCALES SENIAT
// ==========================================
async function cargarLibroFiscal() {
    const tipo = document.getElementById('select-tipo-libro').value;
    const desde = document.getElementById('libro-fecha-desde').value;
    const hasta = document.getElementById('libro-fecha-hasta').value;
    const container = document.getElementById('libro-fiscal-container');

    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">Generando libro oficial...</div>`;

    let url = tipo === 'ventas' ? '/api/reportes/libro-ventas?' : '/api/reportes/libro-compras?';
    if (desde) url += `inicio=${desde}&`;
    if (hasta) url += `fin=${hasta}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (tipo === 'ventas') {
            renderizarLibroVentas(data);
        } else {
            renderizarLibroCompras(data);
        }
    } catch (err) {
        container.innerHTML = `<div style="color:#f87171; text-align:center; padding:30px;">Error al generar libro fiscal</div>`;
    }
}

function renderizarLibroVentas(data) {
    const container = document.getElementById('libro-fiscal-container');
    const { registros, totales } = data;

    let rowsHtml = '';
    if (!registros || registros.length === 0) {
        rowsHtml = `<tr><td colspan="12" style="text-align:center; color:var(--text-secondary);">Sin operaciones en este período</td></tr>`;
    } else {
        rowsHtml = registros.map(r => {
            const esAnulada = r.estado === 'ANULADA';
            const estadoHtml = esAnulada 
                ? `<span style="color:#f87171; font-weight:bold; font-size:0.75rem;">ANULADA (NC)</span>`
                : `<span style="color:#86efac; font-weight:bold; font-size:0.75rem;">TIMBRADA</span><br>
                   <button onclick="abrirModalNC(${r.id}, '${r.numero_factura_fiscal}')" class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; margin-top:3px;" title="Cualquier corrección debe ser mediante Nota de Crédito">
                     Emitir NC
                   </button>`;

            return `
                <tr style="${esAnulada ? 'opacity: 0.6; text-decoration: line-through;' : ''}">
                    <td>${r.operacion_numero}</td>
                    <td><small>${r.fecha}</small></td>
                    <td><code>${r.cliente_rif}</code></td>
                    <td><strong>${r.cliente_nombre}</strong></td>
                    <td><code>${r.numero_factura_fiscal}</code></td>
                    <td><code>${r.numero_control || ''}</code></td>
                    <td>Bs. ${r.subtotal_exento_ves.toFixed(2)}</td>
                    <td>Bs. ${r.base_general_ves.toFixed(2)}</td>
                    <td>Bs. ${r.iva_general_ves.toFixed(2)}</td>
                    <td style="color:#fbbf24; font-weight:bold;">Bs. ${r.monto_igtf_ves.toFixed(2)}</td>
                    <td style="color:#86efac; font-weight:bold;">Bs. ${r.total_final_con_igtf_ves.toFixed(2)}</td>
                    <td style="text-decoration: none;">${estadoHtml}</td>
                </tr>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div style="background:#0f172a; border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="color:#60a5fa;">LIBRO DE VENTAS FISCAL (Cumplimiento Art. 76 al 78 Reglamento IVA y Providencia 000013)</h4>
                <span style="font-size:0.8rem; color:#86efac; border:1px solid #16a34a; padding:2px 8px; border-radius:4px;">
                    🛡️ Registros Inalterables (Bloqueo Activo)
                </span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; font-size:0.85rem;">
                <div>Total Facturado con IVA: <strong>Bs. ${totales.totalVentasConIva.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Ventas Exentas: <strong>Bs. ${totales.ventasExentas.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Base Imponible (16%): <strong>Bs. ${totales.baseGeneral.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Débito Fiscal (IVA): <strong>Bs. ${totales.ivaGeneral.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div style="color:#fbbf24;">IGTF Percibido (3%): <strong>Bs. ${totales.igtfPercibido.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
            </div>
        </div>

        <div class="table-responsive">
            <table class="data-table" style="font-size:0.85rem;">
                <thead>
                    <tr>
                        <th>Op.</th>
                        <th>Fecha</th>
                        <th>RIF Cliente</th>
                        <th>Nombre / Razón Social</th>
                        <th>Nº Factura</th>
                        <th>Nº Control</th>
                        <th>Exento (Bs)</th>
                        <th>Base 16% (Bs)</th>
                        <th>IVA 16% (Bs)</th>
                        <th>IGTF 3% (Bs)</th>
                        <th>Total con IVA (Bs)</th>
                        <th>Estado / Corrección</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
}

// ==========================================
// DESCARGAS FISCALES Y AUDITORÍA TI
// ==========================================
function descargarLibroCSV() {
    const tipo = document.getElementById('select-tipo-libro').value;
    const desde = document.getElementById('libro-fecha-desde').value;
    const hasta = document.getElementById('libro-fecha-hasta').value;

    let url = tipo === 'ventas' ? '/api/reportes/libro-ventas-csv?' : '/api/reportes/libro-compras-csv?';
    if (desde) url += `inicio=${desde}&`;
    if (hasta) url += `fin=${hasta}&`;

    window.open(url, '_blank');
}

function descargarTxtSENIAT() {
    const desde = document.getElementById('libro-fecha-desde').value;
    const hasta = document.getElementById('libro-fecha-hasta').value;

    let url = '/api/reportes/retenciones-iva-txt?';
    if (desde) url += `inicio=${desde}&`;
    if (hasta) url += `fin=${hasta}&`;

    window.open(url, '_blank');
}

async function ejecutarAuditoriaIntegridad() {
    try {
        const res = await fetch('/api/pos/auditoria-integridad');
        const data = await res.json();

        const content = document.getElementById('auditoria-body-content');
        const estadoCorrelativo = data.correlatividadCorrecta 
            ? `<div style="color:#86efac; font-weight:bold; margin-bottom:6px;">✓ Correlatividad Estricta: Secuencia 100% continua sin saltos ni duplicados.</div>`
            : `<div style="color:#f87171; font-weight:bold; margin-bottom:6px;">✗ Inconsistencia en secuencia correlativa detectada.</div>`;

        const estadoHash = data.integridadCadenaCorrecta 
            ? `<div style="color:#86efac; font-weight:bold; margin-bottom:6px;">✓ Inalterabilidad Criptográfica: Cadena SHA-256 intacta. Ningún registro fue manipulado.</div>`
            : `<div style="color:#f87171; font-weight:bold; margin-bottom:6px;">✗ Se detectó alteración manual en la base de datos.</div>`;

        let detallesInconsistencias = '';
        if (data.inconsistencias.length > 0) {
            detallesInconsistencias = `
                <div style="background:#0f172a; border:1px solid #dc2626; border-radius:6px; padding:10px; margin-top:12px;">
                    <strong style="color:#f87171;">Discrepancias encontradas:</strong>
                    <ul style="font-size:0.85rem; margin-top:6px; padding-left:18px;">
                        ${data.inconsistencias.map(i => `<li>${i.tipo} - Factura ${i.numeroFactura || i.numeroEncontrado}: ${i.detalle}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        content.innerHTML = `
            <div style="background:#0f172a; border-radius:8px; padding:14px; margin-bottom:14px;">
                <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;">
                    Total Documentos Fiscales Auditados: <strong>${data.totalDocumentos}</strong>
                </div>
                ${estadoCorrelativo}
                ${estadoHash}
                ${detallesInconsistencias}
            </div>
            <p style="font-size:0.85rem; color:var(--text-secondary);">
                Este reporte técnico certifica ante auditores del SENIAT y peritos de TI que el software MeDIa cumple rigurosamente con los principios de inalterabilidad, correlatividad y seguridad legal.
            </p>
        `;

        document.getElementById('modal-auditoria').style.display = 'flex';
    } catch (err) {
        alert("Error al ejecutar auditoría de seguridad");
    }
}

// ==========================================
// NOTAS DE CRÉDITO FISCALES (SENIAT)
// ==========================================
function abrirModalNC(facturaId, numFactura) {
    document.getElementById('nc-factura-id').value = facturaId;
    document.getElementById('nc-factura-num').value = `Factura Fiscal Nro: ${numFactura}`;
    document.getElementById('nc-motivo').value = 'Devolución de cliente';
    document.getElementById('modal-nc').style.display = 'flex';
}

async function confirmarNotaCredito() {
    const facturaId = document.getElementById('nc-factura-id').value;
    const motivo = document.getElementById('nc-motivo').value.trim();

    try {
        const res = await fetch('/api/pos/nota-credito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factura_id: facturaId, motivo: motivo })
        });

        const d = await res.json();
        if (res.ok) {
            alert(`Nota de Crédito Fiscal Emitida: ${d.numeroNC}\nFactura Afectada: ${d.facturaAfectada}\nMonto Devuelto: Bs. ${d.totalDevueltoVes.toFixed(2)}\nMercancía reingresada al inventario.`);
            document.getElementById('modal-nc').style.display = 'none';
            cargarLibroFiscal();
            cargarInventario();
            cargarKPIs();
        } else {
            alert(`Error: ${d.mensaje}`);
        }
    } catch (err) {
        alert("Error de conexión al procesar Nota de Crédito");
    }
}

function renderizarLibroCompras(data) {
    const container = document.getElementById('libro-fiscal-container');
    const { registros, totales } = data;

    let rowsHtml = '';
    if (!registros || registros.length === 0) {
        rowsHtml = `<tr><td colspan="10" style="text-align:center; color:var(--text-secondary);">Sin compras en este período</td></tr>`;
    } else {
        rowsHtml = registros.map(r => `
            <tr>
                <td>${r.operacion_numero}</td>
                <td><small>${r.fecha_factura}</small></td>
                <td><code>${r.proveedor_rif}</code></td>
                <td><strong>${r.proveedor_nombre}</strong></td>
                <td><code>${r.numero_factura_proveedor}</code></td>
                <td><code>${r.numero_control_proveedor || ''}</code></td>
                <td>Bs. ${r.total_exento_ves.toFixed(2)}</td>
                <td>Bs. ${r.base_imponible_ves.toFixed(2)}</td>
                <td>Bs. ${r.monto_iva_ves.toFixed(2)}</td>
                <td style="color:#60a5fa; font-weight:bold;">${r.comprobante_retencion_iva || 'N/A'}<br><small>Bs. ${r.monto_retenido_iva_ves.toFixed(2)}</small></td>
                <td style="color:#86efac; font-weight:bold;">Bs. ${r.total_compra_ves.toFixed(2)}</td>
            </tr>
        `).join('');
    }

    container.innerHTML = `
        <div style="background:#0f172a; border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px;">
            <h4 style="color:#4ade80; margin-bottom:8px;">LIBRO DE COMPRAS FISCAL (Cumplimiento Art. 75 Reglamento IVA)</h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; font-size:0.85rem;">
                <div>Total Compras con IVA: <strong>Bs. ${totales.totalComprasConIva.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Compras Exentas: <strong>Bs. ${totales.comprasExentas.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Base Imponible: <strong>Bs. ${totales.baseImponible.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div>Crédito Fiscal (IVA): <strong>Bs. ${totales.montoIvaCredito.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
                <div style="color:#60a5fa;">Total Retenciones IVA Aplicadas: <strong>Bs. ${totales.montoRetenidoIva.toLocaleString('es-VE', {minimumFractionDigits:2})}</strong></div>
            </div>
        </div>

        <div class="table-responsive">
            <table class="data-table" style="font-size:0.85rem;">
                <thead>
                    <tr>
                        <th>Op.</th>
                        <th>Fecha</th>
                        <th>RIF Proveedor</th>
                        <th>Razón Social</th>
                        <th>Nº Factura</th>
                        <th>Nº Control</th>
                        <th>Exento (Bs)</th>
                        <th>Base Imp. (Bs)</th>
                        <th>IVA Crédito (Bs)</th>
                        <th>Comprobante Ret. IVA</th>
                        <th>Total Compra (Bs)</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
}

