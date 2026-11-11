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
    const textoFormateado = String(mensaje || '').replace(/\n/g, '<br>');
    toast.innerHTML = `
        <span style="font-size:1.1rem; flex-shrink:0;">${tipo === 'success' ? '✓' : tipo === 'error' ? '✕' : 'ℹ'}</span>
        <div style="flex:1;">${textoFormateado}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

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

        const confModalidad = document.getElementById('config-modalidad-emision');
        if (confModalidad && conf.modalidad_emision) confModalidad.value = conf.modalidad_emision;

        const confToken = document.getElementById('config-unidigital-token');
        if (confToken && conf.unidigital_token) confToken.value = conf.unidigital_token;

        const confUrl = document.getElementById('config-unidigital-url');
        if (confUrl && conf.unidigital_url) confUrl.value = conf.unidigital_url;

        const confAmbiente = document.getElementById('config-unidigital-ambiente');
        if (confAmbiente && conf.unidigital_ambiente) confAmbiente.value = conf.unidigital_ambiente;

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

        // 1. Fecha formateada en español
        const fechaEl = document.getElementById('dashboard-fecha-label');
        if (fechaEl && ger.fechaHoy) {
            const fParts = ger.fechaHoy.split('-');
            const dateObj = new Date(parseInt(fParts[0]), parseInt(fParts[1]) - 1, parseInt(fParts[2]));
            const fechaStr = dateObj.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            fechaEl.innerText = `${fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1)} | Resumen de ventas de repuestos, mostrador y flujo de caja en tiempo real.`;
        }

        // 2. Métricas Operativas del Día de Hoy
        const kpiHoyVes = document.getElementById('kpi-hoy-ventas-ves');
        if (kpiHoyVes && ger.hoy) kpiHoyVes.innerText = `Bs. ${ger.hoy.total_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        
        const kpiHoyUsd = document.getElementById('kpi-hoy-ventas-usd');
        if (kpiHoyUsd && ger.hoy) kpiHoyUsd.innerText = `$ ${ger.hoy.total_usd.toFixed(2)}`;

        const kpiHoyCount = document.getElementById('kpi-hoy-facturas-count');
        if (kpiHoyCount && ger.hoy) kpiHoyCount.innerText = `${ger.hoy.total_facturas} ${ger.hoy.total_facturas === 1 ? 'venta' : 'ventas'}`;

        const badgeTotTickets = document.getElementById('badge-total-tickets-hoy');
        if (badgeTotTickets && ger.hoy) badgeTotTickets.innerText = `${ger.hoy.total_facturas} ${ger.hoy.total_facturas === 1 ? 'Factura Hoy' : 'Facturas Hoy'}`;

        const kpiTicketProm = document.getElementById('kpi-hoy-ticket-promedio');
        if (kpiTicketProm && ger.hoy) kpiTicketProm.innerText = `$ ${ger.hoy.ticket_promedio_usd.toFixed(2)}`;

        const kpiUnidades = document.getElementById('kpi-hoy-unidades-count');
        if (kpiUnidades && ger.hoy) kpiUnidades.innerText = `${ger.hoy.unidades_vendidas} repuestos despachados hoy`;

        const kpiHoyIgtf = document.getElementById('kpi-hoy-igtf');
        if (kpiHoyIgtf && ger.hoy) kpiHoyIgtf.innerText = `Bs. ${ger.hoy.total_igtf_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // 3. Inventario Valorado de Repuestos
        const kpiCosto = document.getElementById('kpi-valor-costo');
        if (kpiCosto && ger.inventario) kpiCosto.innerText = `$ ${ger.inventario.valor_costo_usd.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        const kpiVenta = document.getElementById('kpi-valor-venta');
        if (kpiVenta && ger.inventario) kpiVenta.innerText = `$ ${ger.inventario.valor_venta_usd.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        // 4. Tabla de Ventas y Facturas Realizadas HOY
        const tbodyVentasHoy = document.getElementById('dashboard-ventas-hoy-body');
        if (tbodyVentasHoy) {
            if (!ger.ultimasVentasHoy || ger.ultimasVentasHoy.length === 0) {
                tbodyVentasHoy.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:35px; color:#94a3b8;">
                            <div style="margin-bottom:10px; display:flex; justify-content:center;">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="5" cy="16" r="3.2"/>
                                    <circle cx="19" cy="16" r="3.2"/>
                                    <path d="M5 16l4-7h4.5l2 4h3.5"/>
                                    <path d="M13.5 9l2-4h2.5"/>
                                    <line x1="9" y1="16" x2="16" y2="16"/>
                                </svg>
                            </div>
                            Aún no se han emitido facturas hoy. Las ventas procesadas en el mostrador aparecerán aquí en vivo.
                        </td>
                    </tr>
                `;
            } else {
                tbodyVentasHoy.innerHTML = ger.ultimasVentasHoy.map(v => {
                    let pagoBadge = '';
                    const met = (v.metodos_pago || '').toUpperCase();
                    if (met.includes('USD') || met.includes('DIVISA') || met.includes('ZELLE')) {
                        pagoBadge = `<span style="background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.3); padding:3px 7px; border-radius:5px; font-size:0.72rem; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5a2.5 2.5 0 0 0-5 0c0 1.5 1 2 2.5 2s2.5.5 2.5 2a2.5 2.5 0 0 1-5 0"/></svg>
                            <span>Divisas $</span>
                        </span>`;
                    } else if (met.includes('MOVIL')) {
                        pagoBadge = `<span style="background:rgba(168,85,247,0.12); color:#c084fc; border:1px solid rgba(168,85,247,0.3); padding:3px 7px; border-radius:5px; font-size:0.72rem; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                            <span>Pago Móvil</span>
                        </span>`;
                    } else {
                        pagoBadge = `<span style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:3px 7px; border-radius:5px; font-size:0.72rem; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                            <span>Débito</span>
                        </span>`;
                    }

                    return `
                        <tr>
                            <td>
                                <strong style="color:#ffffff; font-family:monospace; font-size:0.88rem;">${v.numero_factura_fiscal}</strong>
                                <div style="font-size:0.7rem; color:#64748b;">${v.numero_control || '00-000000'}</div>
                            </td>
                            <td>
                                <span style="color:#93c5fd; font-weight:600; font-size:0.82rem;">${(v.hora || '').substring(0, 5)}</span>
                            </td>
                            <td>
                                <strong style="display:block; font-size:0.83rem; color:#e2e8f0; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v.cliente_nombre}</strong>
                                <small style="color:#64748b; font-size:0.72rem;">${v.cliente_rif}</small>
                            </td>
                            <td style="max-width:190px;">
                                <div style="font-size:0.78rem; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${v.items_resumen || ''}">
                                    ${v.items_resumen || 'Repuestos'}
                                </div>
                            </td>
                            <td>
                                <strong style="color:#86efac; font-size:0.88rem;">Bs. ${v.total_final_con_igtf_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>
                            </td>
                            <td>
                                <span style="color:#93c5fd; font-weight:700; font-size:0.85rem;">$ ${v.total_venta_usd.toFixed(2)}</span>
                            </td>
                            <td>${pagoBadge}</td>
                            <td style="text-align:center;">
                                <button onclick="verTicketFiscalAdmin(${v.id})" class="btn-glass" style="padding:4px 10px; font-size:0.74rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;" title="Ver ticket fiscal emitido">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span>Ticket</span>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 5. Desglose de Medios de Pago en Caja (Hoy)
        const mediosContainer = document.getElementById('dashboard-medios-pago-hoy');
        if (mediosContainer && ger.mediosDePagoHoy) {
            if (ger.mediosDePagoHoy.length === 0) {
                mediosContainer.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:12px;">Sin cobros en el turno actual</div>`;
            } else {
                mediosContainer.innerHTML = ger.mediosDePagoHoy.map(m => {
                    const isUsd = m.moneda === 'USD' || m.metodo_pago.includes('DIVISAS') || m.metodo_pago.includes('USD');
                    const isMovil = m.metodo_pago.includes('MOVIL');
                    
                    const iconSvg = isUsd
                        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5a2.5 2.5 0 0 0-5 0c0 1.5 1 2 2.5 2s2.5.5 2.5 2a2.5 2.5 0 0 1-5 0"/></svg>`
                        : isMovil
                        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
                        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
                    
                    const iconBg = isUsd
                        ? `background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.25);`
                        : isMovil
                        ? `background:rgba(168,85,247,0.12); border:1px solid rgba(168,85,247,0.25);`
                        : `background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.25);`;

                    return `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:30px; height:30px; border-radius:8px; ${iconBg} display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    ${iconSvg}
                                </div>
                                <div>
                                    <strong style="display:block; font-size:0.82rem; color:#f1f5f9;">${m.metodo_pago.replace(/_/g, ' ')}</strong>
                                    <small style="color:#64748b; font-size:0.72rem;">${m.transacciones} ${m.transacciones === 1 ? 'cobro' : 'cobros'}</small>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <strong style="color:#86efac; font-size:0.88rem;">Bs. ${m.total_ves.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>
                                ${isUsd ? `<div style="font-size:0.74rem; color:#93c5fd; font-weight:700;">$ ${m.total_capturado.toFixed(2)}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 6. Top Repuestos Más Vendidos Hoy
        const topContainer = document.getElementById('dashboard-top-repuestos-hoy');
        if (topContainer && ger.topRepuestosHoy) {
            if (ger.topRepuestosHoy.length === 0) {
                topContainer.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:12px;">Sin ventas de repuestos hoy</div>`;
            } else {
                topContainer.innerHTML = ger.topRepuestosHoy.map((p, idx) => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:0.72rem; font-weight:800; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.25); width:20px; height:20px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${idx+1}</span>
                            <div style="width:32px; height:32px; border-radius:8px; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; padding:3px;">
                                <img src="${p.imagen_url || '/img/products/placeholder.svg'}" onerror="this.onerror=null; this.src='/img/products/placeholder.svg';" style="width:100%; height:100%; object-fit:contain;" alt="repuesto">
                            </div>
                            <span style="font-size:0.78rem; color:#e2e8f0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.descripcion}</span>
                        </div>
                        <div style="text-align:right; flex-shrink:0;">
                            <span style="font-size:0.78rem; font-weight:800; color:#86efac;">${p.total_cantidad} unid.</span>
                            <div style="font-size:0.72rem; color:#93c5fd;">$ ${p.total_usd.toFixed(2)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 7. Alertas de Stock Crítico
        const alertContainer = document.getElementById('dashboard-alertas-stock');
        const alertBadge = document.getElementById('badge-alertas-count');
        if (alertContainer && ger.alertasStock) {
            if (alertBadge) alertBadge.innerText = ger.alertasStock.length;
            if (ger.alertasStock.length === 0) {
                alertContainer.innerHTML = `<div style="font-size:0.8rem; color:#86efac; text-align:center; padding:10px;">✓ Todo el inventario está en niveles óptimos</div>`;
            } else {
                alertContainer.innerHTML = ger.alertasStock.slice(0, 4).map(a => `
                    <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); padding:6px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                        <div style="min-width:0; padding-right:6px;">
                            <strong style="color:#ffffff; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.descripcion}</strong>
                            <small style="color:#fca5a5;">Mín: ${a.stock_minimo} | Ref: ${a.referencia || '--'}</small>
                        </div>
                        <span style="background:#ef4444; color:#ffffff; font-weight:800; font-size:0.72rem; padding:2px 7px; border-radius:4px; flex-shrink:0;">
                            ${a.stock_actual} disp
                        </span>
                    </div>
                `).join('');
            }
        }

        // 8. Gráfica de Barras de la Semana
        const barsContainer = document.getElementById('dashboard-semanal-bars');
        if (barsContainer) {
            const diasNombres = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
            const dataDias = ger.diasSemana || [];
            
            // Construir los últimos 7 días
            let maxMonto = 1;
            dataDias.forEach(d => { if (d.total_usd > maxMonto) maxMonto = d.total_usd; });

            let barsHtml = '';
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const fStr = d.toISOString().split('T')[0];
                const match = dataDias.find(item => item.fecha === fStr);
                const montoUsd = match ? match.total_usd : 0;
                const pct = Math.max(12, Math.round((montoUsd / (maxMonto * 1.15)) * 100));
                const diaSem = diasNombres[d.getDay()];

                barsHtml += `
                    <div class="mock-bar" style="height: ${pct}%;" title="${fStr}: $ ${montoUsd.toFixed(2)}">
                        <span class="mock-bar-label">${diaSem}</span>
                    </div>
                `;
            }
            barsContainer.innerHTML = barsHtml;
        }

    } catch (err) {
        console.error("Error al cargar KPIs del día", err);
    }
}

let adminUltimoTicketTexto = '';

async function verTicketFiscalAdmin(ventaId) {
    try {
        const res = await fetch(`/api/pos/ticket/${ventaId}`);
        const data = await res.json();
        if (res.ok && data.ticket) {
            adminUltimoTicketTexto = data.ticket;
            const container = document.getElementById('admin-ticket-preview-content');
            if (container) container.innerText = data.ticket;
            const modal = document.getElementById('modal-ticket-fiscal');
            if (modal) modal.style.display = 'flex';
        } else {
            mostrarToast("No se pudo obtener el ticket fiscal.", "error");
        }
    } catch (e) {
        mostrarToast("Error de conexión al cargar ticket", "error");
    }
}

function cerrarModalTicketAdmin() {
    const modal = document.getElementById('modal-ticket-fiscal');
    if (modal) modal.style.display = 'none';
}

function copiarTicketAdminTexto() {
    if (adminUltimoTicketTexto) {
        navigator.clipboard.writeText(adminUltimoTicketTexto).then(() => {
            mostrarToast("✓ Ticket fiscal copiado al portapapeles.", "success");
        });
    }
}

function imprimirTicketFiscalAdminTermico() {
    const ticketText = adminUltimoTicketTexto || document.getElementById('admin-ticket-preview-content')?.innerText;
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

async function guardarTasaBCV() {
    const val = parseFloat(document.getElementById('config-tasa-bcv').value);
    if (isNaN(val) || val <= 0) {
        mostrarToast("Ingrese una tasa numérica válida.", "error");
        return;
    }

    try {
        const res = await fetch('/api/bcv/tasa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasa: val })
        });
        if (res.ok) {
            mostrarToast("✓ Tasa oficial BCV guardada exitosamente.", "success");
            await cargarConfiguracionGeneral();
            await cargarInventario();
            await cargarKPIs();
        } else {
            mostrarToast("Error al guardar la tasa oficial.", "error");
        }
    } catch (err) {
        mostrarToast("Error de conexión con el servidor.", "error");
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
// INTEGRACIÓN UNIDIGITAL (FACTURACIÓN DIGITAL SENIAT)
// ==========================================
async function guardarConfiguracionUnidigital() {
    const modalidad = document.getElementById('config-modalidad-emision')?.value || 'LOCAL';
    const token = document.getElementById('config-unidigital-token')?.value?.trim() || '';
    const url = document.getElementById('config-unidigital-url')?.value?.trim() || 'https://api-sandbox.unidigital.com.ve/v1';
    const ambiente = document.getElementById('config-unidigital-ambiente')?.value || 'SANDBOX';

    try {
        const res = await fetch('/api/configuracion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modalidad_emision: modalidad,
                unidigital_token: token,
                unidigital_url: url,
                unidigital_ambiente: ambiente
            })
        });

        if (res.ok) {
            mostrarToast("✓ Configuración de Facturación Digital guardada exitosamente", "success");
            const pill = document.getElementById('unidigital-status-pill');
            if (pill) {
                if (modalidad === 'UNIDIGITAL') {
                    pill.innerText = `Activo (${ambiente})`;
                    pill.style.background = 'rgba(16, 185, 129, 0.2)';
                    pill.style.color = '#86efac';
                    pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                } else {
                    pill.innerText = 'Modo Local';
                    pill.style.background = 'rgba(59, 130, 246, 0.2)';
                    pill.style.color = '#93c5fd';
                    pill.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                }
            }
        } else {
            mostrarToast("Error al guardar la configuración", "error");
        }
    } catch (e) {
        mostrarToast("Error de conexión al guardar configuración", "error");
    }
}

async function probarConexionUnidigital() {
    const token = document.getElementById('config-unidigital-token')?.value?.trim();
    const url = document.getElementById('config-unidigital-url')?.value?.trim();

    mostrarToast("Verificando conexión con Unidigital...", "info");

    try {
        const res = await fetch('/api/unidigital/probar-conexion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, url })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(`✓ ${data.mensaje}`, "success");
            const pill = document.getElementById('unidigital-status-pill');
            if (pill) {
                pill.innerText = data.simulado ? 'Sandbox Conectado' : 'Conectado SENIAT';
                pill.style.background = 'rgba(16, 185, 129, 0.2)';
                pill.style.color = '#86efac';
                pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            }
        } else {
            mostrarToast(`✕ ${data.mensaje}`, "error");
        }
    } catch (e) {
        mostrarToast("Error al conectar con el servidor local", "error");
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
                        <div style="width:38px; height:38px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
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

let fotoProductoBase64 = null;

function alSeleccionarFotoProducto(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        fotoProductoBase64 = e.target.result;
        const prompt = document.getElementById('prod-upload-prompt');
        const preview = document.getElementById('prod-preview-wrapper');
        const img = document.getElementById('prod-preview-img');
        const label = document.getElementById('prod-file-label');
        if (img) img.src = fotoProductoBase64;
        if (label) label.innerText = file.name;
        if (prompt) prompt.style.display = 'none';
        if (preview) preview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function descartarFotoProducto() {
    fotoProductoBase64 = null;
    const fileInput = document.getElementById('prod-form-file');
    if (fileInput) fileInput.value = '';
    const prompt = document.getElementById('prod-upload-prompt');
    const preview = document.getElementById('prod-preview-wrapper');
    const img = document.getElementById('prod-preview-img');
    if (img) img.src = '';
    if (prompt) prompt.style.display = 'flex';
    if (preview) preview.style.display = 'none';
}

function abrirModalNuevoProducto() {
    descartarFotoProducto();
    document.getElementById('modal-producto').style.display = 'flex';
}

function cerrarModalProducto() {
    descartarFotoProducto();
    document.getElementById('modal-producto').style.display = 'none';
}

async function guardarProductoNuevo() {
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const desc = document.getElementById('prod-form-desc').value.trim();
    const cat = document.getElementById('prod-form-cat').value;
    const iva = document.getElementById('prod-form-iva').value;
    const costo = parseFloat(document.getElementById('prod-form-costo').value) || 0;
    const precio = parseFloat(document.getElementById('prod-form-precio').value) || 0;
    const stock = parseFloat(document.getElementById('prod-form-stock').value) || 0;
    const stockMin = parseFloat(document.getElementById('prod-form-stock-min').value) || 5;

    if (!barcode || !desc) {
        mostrarToast("Código de barras y descripción son obligatorios.", 'error');
        return;
    }

    let imgFinalUrl = '';
    if (fotoProductoBase64) {
        try {
            mostrarToast("Subiendo imagen del producto...", 'info');
            const upRes = await fetch('/api/inventario/upload-imagen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: fotoProductoBase64 })
            });
            const upData = await upRes.json();
            if (upData && upData.url) {
                imgFinalUrl = upData.url;
            }
        } catch (e) {
            console.error("Error al subir foto:", e);
        }
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
                imagen_url: imgFinalUrl
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

function abrirSubmodalCrearProductoEnCompra(selectCaller = null) {
    window._compraCallerSelect = selectCaller;
    const catSel = document.getElementById('subprod-categoria');
    if (catSel && adminState.categorias) {
        catSel.innerHTML = adminState.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
    document.getElementById('subprod-codigo').value = 'REP-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('subprod-descripcion').value = '';
    document.getElementById('subprod-costo').value = '';
    document.getElementById('subprod-precio').value = '';
    document.getElementById('subprod-iva').value = 'G';
    document.getElementById('modal-sub-producto-compra').style.display = 'flex';
    setTimeout(() => document.getElementById('subprod-descripcion')?.focus(), 60);
}

function cerrarSubmodalCrearProductoEnCompra() {
    const subModal = document.getElementById('modal-sub-producto-compra');
    if (subModal) subModal.style.display = 'none';
    if (window._compraCallerSelect && window._compraCallerSelect.value === '__nuevo__') {
        window._compraCallerSelect.selectedIndex = 1; // Seleccionar el primer producto normal
    }
    window._compraCallerSelect = null;
}

async function guardarSubproductoEnCompra() {
    const cod = document.getElementById('subprod-codigo').value.trim();
    const desc = document.getElementById('subprod-descripcion').value.trim();
    const catId = document.getElementById('subprod-categoria').value;
    const costo = parseFloat(document.getElementById('subprod-costo').value) || 0;
    const precio = parseFloat(document.getElementById('subprod-precio').value) || (costo > 0 ? Math.round(costo * 1.35 * 100) / 100 : 0);
    const alic = document.getElementById('subprod-iva').value || 'G';

    if (!desc) {
        mostrarToast("Debe indicar la descripción del repuesto", "warning");
        document.getElementById('subprod-descripcion').focus();
        return;
    }

    try {
        const res = await fetch('/api/inventario/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_barra: cod || ('REP-' + Date.now()),
                referencia: cod || '',
                descripcion: desc,
                categoria_id: catId,
                alicuota_iva: alic,
                precio_usd: precio,
                costo_usd: costo,
                stock_actual: 0,
                stock_minimo: 3,
                unidad_medida: 'UNID'
            })
        });

        const data = await res.json();
        if (res.ok && data) {
            // Actualizar catálogo en memoria
            adminState.productos.unshift(data);

            if (window._compraCallerSelect) {
                const row = window._compraCallerSelect.closest('div[id^="compra-row-"]');
                let opts = `<option value="__nuevo__" style="color:#38bdf8; font-weight:bold;">+ Registrar Nuevo Repuesto...</option>`;
                opts += adminState.productos.map(p => {
                    const isSel = (p.id === data.id) ? 'selected' : '';
                    return `<option value="${p.id}" ${isSel}>${p.descripcion} (Costo actual: $${p.costo_usd.toFixed(2)})</option>`;
                }).join('');
                window._compraCallerSelect.innerHTML = opts;
                if (row) {
                    const costoInput = row.querySelector('.compra-prod-costo');
                    if (costoInput && costo > 0) costoInput.value = costo.toFixed(2);
                }
            } else {
                agregarRenglonCompra(data.id, costo);
            }

            cerrarSubmodalCrearProductoEnCompra();
            mostrarToast(`✓ Repuesto creado: ${data.descripcion}. Se asignó a la factura.`, "success");
        } else {
            mostrarToast(`Error al crear producto: ${data.mensaje || 'Revise los campos'}`, "error");
        }
    } catch(err) {
        console.error(err);
        mostrarToast("Error de conexión al registrar producto", "error");
    }
}

function agregarRenglonCompra(preselectedId = null, costoDefault = null) {
    const container = document.getElementById('compra-items-list');
    const rowId = Date.now();
    let prodsOptions = `<option value="__nuevo__" style="color:#38bdf8; font-weight:bold;">+ Registrar Nuevo Repuesto...</option>`;
    prodsOptions += adminState.productos.map(p => {
        const isSel = (preselectedId && String(p.id) === String(preselectedId)) ? 'selected' : '';
        return `<option value="${p.id}" ${isSel}>${p.descripcion} (Costo actual: $${p.costo_usd.toFixed(2)})</option>`;
    }).join('');

    const div = document.createElement('div');
    div.id = `compra-row-${rowId}`;
    div.style = "display:grid; grid-template-columns: 2fr 100px 120px 40px; gap:8px; margin-bottom:8px; align-items:center;";
    div.innerHTML = `
        <select class="form-select compra-prod-select" onchange="if(this.value==='__nuevo__') abrirSubmodalCrearProductoEnCompra(this)">${prodsOptions}</select>
        <input type="number" step="1" min="1" class="input-text compra-prod-cant" placeholder="Cant." value="10">
        <input type="number" step="0.01" class="input-text compra-prod-costo" placeholder="Costo USD $" value="${costoDefault !== null ? costoDefault.toFixed(2) : '1.00'}">
        <button onclick="document.getElementById('compra-row-${rowId}').remove()" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:bold;" title="Quitar renglón">✕</button>
    `;
    container.appendChild(div);
}

async function guardarCompra() {
    const provId = document.getElementById('compra-form-prov').value;
    const fecha = document.getElementById('compra-form-fecha').value;
    const numFactura = document.getElementById('compra-form-factura').value.trim();
    const numControl = document.getElementById('compra-form-control').value.trim();

    if (!numFactura) {
        mostrarToast("El número de factura del proveedor es obligatorio para el Libro de Compras.", "warning");
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
        mostrarToast("Debe agregar al menos un producto a la compra.", "warning");
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
            mostrarAlertaFlotante(
                "Compra Registrada Exitosamente",
                `Inventario actualizado en tiempo real.<br>Comprobante de Retención IVA SENIAT: <strong>${d.comprobanteRetencionIva || 'No aplicable'}</strong>`,
                "success"
            );
            cerrarModalCompra();
            cargarCompras();
            cargarInventario();
            cargarKPIs();
        } else {
            mostrarToast(`Error: ${d.mensaje}`, "error");
        }
    } catch (err) {
        mostrarToast("Error de conexión al registrar compra", "error");
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
        mostrarToast("Cédula/RIF y Razón Social son requeridos.", "warning");
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
            mostrarAlertaFlotante(
                "Cliente Registrado",
                "Cliente validado ante algoritmo SENIAT y registrado exitosamente.",
                "success"
            );
            cerrarModalCliente();
            cargarClientesYProveedores();
        } else {
            mostrarToast(`Error de Validación: ${d.mensaje}`, "error");
        }
    } catch (err) {
        mostrarToast("Error de conexión", "error");
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
                <span style="font-size:0.8rem; color:#86efac; border:1px solid #16a34a; padding:2px 8px; border-radius:4px; display:inline-flex; align-items:center; gap:5px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>Registros Inalterables (Bloqueo Activo)</span>
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

        // Actualizar panel live de auditoría si está presente
        if (typeof renderizarPanelAuditoriaLive === 'function') {
            renderizarPanelAuditoriaLive();
        }

        const content = document.getElementById('auditoria-body-content');
        if (!content) return;

        const estadoCorrelativo = data.correlatividadCorrecta 
            ? `<div style="color:#86efac; font-weight:bold; margin-bottom:6px;">✓ Correlatividad Estricta: Secuencia 100% continua sin saltos ni duplicados.</div>`
            : `<div style="color:#f87171; font-weight:bold; margin-bottom:6px;">✗ Inconsistencia en secuencia correlativa detectada.</div>`;

        const estadoHash = data.integridadCadenaCorrecta 
            ? `<div style="color:#86efac; font-weight:bold; margin-bottom:6px;">✓ Inalterabilidad Criptográfica: Cadena SHA-256 intacta. Ningún registro fue manipulado.</div>`
            : `<div style="color:#f87171; font-weight:bold; margin-bottom:6px;">✗ Se detectó alteración manual en la base de datos.</div>`;

        let detallesInconsistencias = '';
        if (data.inconsistencias && data.inconsistencias.length > 0) {
            detallesInconsistencias = `
                <div style="background:#0f172a; border:1px solid #dc2626; border-radius:6px; padding:10px; margin-top:12px;">
                    <strong style="color:#f87171;">Discrepancias encontradas:</strong>
                    <ul style="font-size:0.85rem; margin-top:6px; padding-left:18px;">
                        ${data.inconsistencias.map(i => `<li>${i.tipo} - Factura ${i.numeroFactura || i.numeroEncontrado}: ${i.detalle}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            detallesInconsistencias = `
                <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:10px; margin-top:12px; color:#86efac; font-size:0.85rem;">
                    ✓ <strong>Certificación Exitosa:</strong> Todas las facturas (${data.totalDocumentos || 0}) tienen numeración consecutiva estricta y hashes SHA-256 verificados.
                </div>
            `;
        }

        content.innerHTML = `
            <div style="background:#0f172a; border-radius:8px; padding:14px; margin-bottom:14px; border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;">
                    Total Documentos Fiscales Auditados: <strong>${data.totalDocumentos || 0}</strong>
                </div>
                ${estadoCorrelativo}
                ${estadoHash}
                ${detallesInconsistencias}
            </div>
            <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
                Este reporte técnico certifica ante auditores del SENIAT y peritos de TI que el software MeDIa cumple rigurosamente con los principios de inalterabilidad, correlatividad y seguridad legal venezolana.
            </p>
        `;

        document.getElementById('modal-auditoria').style.display = 'flex';
    } catch (err) {
        console.error("Error al ejecutar auditoría de seguridad:", err);
        mostrarToast("Error al ejecutar auditoría de seguridad", "error");
    }
}

function cerrarModalAuditoria() {
    const modal = document.getElementById('modal-auditoria');
    if (modal) modal.style.display = 'none';
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
            mostrarAlertaFlotante(
                "Nota de Crédito Fiscal Emitida",
                `Nota de Crédito: <strong>${d.numeroNC}</strong><br>Factura Afectada: <strong>${d.facturaAfectada}</strong><br>Monto Devuelto: <strong>Bs. ${d.totalDevueltoVes.toFixed(2)}</strong><br>✓ Mercancía reingresada al inventario y Kárdex.`,
                "success"
            );
            document.getElementById('modal-nc').style.display = 'none';
            cargarLibroFiscal();
            cargarInventario();
            cargarKPIs();
        } else {
            mostrarToast(`Error: ${d.mensaje}`, "error");
        }
    } catch (err) {
        mostrarToast("Error de conexión al procesar Nota de Crédito", "error");
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

// ==========================================
// COPIAS DE SEGURIDAD (BACKUP) & INTEGRIDAD
// ==========================================
async function cargarListaBackups() {
    const tbody = document.getElementById('backups-table-body');
    const kpiTotal = document.getElementById('kpi-backup-total');
    const kpiIntegridad = document.getElementById('kpi-backup-integridad');
    const kpiSubtext = document.getElementById('kpi-backup-subtext');
    const kpiFecha = document.getElementById('kpi-backup-fecha');
    const kpiArchivo = document.getElementById('kpi-backup-archivo');

    try {
        const res = await fetch('/api/sistema/backups');
        const data = await res.json();
        const backups = (data && data.backups) ? data.backups : [];

        if (kpiTotal) kpiTotal.innerText = backups.length;

        if (backups.length > 0) {
            const ultimo = backups[0];
            if (kpiIntegridad) {
                kpiIntegridad.innerText = ultimo.integridad === 'OK_INTEGRO' ? '✓ 100% ÍNTEGRO' : '⚠ ATENCIÓN';
                kpiIntegridad.style.color = ultimo.integridad === 'OK_INTEGRO' ? '#86efac' : '#f87171';
            }
            if (kpiSubtext) {
                kpiSubtext.innerText = `PRAGMA integrity_check: ${ultimo.integridad_check ? ultimo.integridad_check.join(', ') : 'ok'}`;
            }
            if (kpiFecha) kpiFecha.innerText = ultimo.fecha;
            if (kpiArchivo) kpiArchivo.innerText = `${ultimo.archivo} (${ultimo.tamano_formateado})`;
        } else {
            if (kpiIntegridad) kpiIntegridad.innerText = '--';
            if (kpiFecha) kpiFecha.innerText = 'Sin respaldos';
            if (kpiArchivo) kpiArchivo.innerText = 'Presione "Generar Copia de Seguridad"';
        }

        if (!tbody) return;

        if (backups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                        No hay copias de seguridad generadas aún. Haga clic en <strong>Generar Copia de Seguridad Inmediata</strong> para crear la primera.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = backups.map(b => {
            const stats = b.estadisticas || {};
            const statsText = stats.ventas !== undefined 
                ? `${stats.ventas} vts • ${stats.productos} prods • ${stats.kardex} kdx` 
                : 'Completo';

            const esIntegro = b.integridad === 'OK_INTEGRO';
            const badgeColor = esIntegro ? '#86efac' : '#f87171';
            const badgeBg = esIntegro ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
            const badgeBorder = esIntegro ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

            const hashCorto = b.sha256 ? `${b.sha256.substring(0, 8)}...${b.sha256.substring(b.sha256.length - 8)}` : '--';

            return `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#ffffff; display:flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span>${b.archivo}</span>
                        </div>
                    </td>
                    <td style="color:#e2e8f0; font-size:0.82rem;">${b.fecha}</td>
                    <td style="color:#93c5fd; font-weight:700;">${b.tamano_formateado}</td>
                    <td>
                        <span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeBorder};">
                            ${esIntegro ? '✓ PRAGMA OK' : '✗ DISCREPANCIA'}
                        </span>
                    </td>
                    <td>
                        <div style="display:inline-flex; align-items:center; gap:6px; font-family:'Courier New', monospace; font-size:0.75rem; color:#cbd5e1; background:rgba(15,23,42,0.6); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                            <span title="${b.sha256}">${hashCorto}</span>
                            <button onclick="copiarTextoPortapapeles('${b.sha256}')" style="background:none; border:none; color:#38bdf8; cursor:pointer; padding:0;" title="Copiar SHA-256 completo">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                        </div>
                    </td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${statsText}</td>
                    <td style="text-align: center; white-space: nowrap;">
                        <div style="display:inline-flex; gap:6px;">
                            <a href="/api/sistema/backup/descargar/${encodeURIComponent(b.archivo)}" class="btn-glass btn-glass-primary" style="padding:4px 9px; font-size:0.75rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Descargar copia de base de datos a este computador o pendrive">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>Descargar</span>
                            </a>
                            <button onclick="confirmarRestaurarBackup('${b.archivo}')" class="btn-glass" style="padding:4px 9px; font-size:0.75rem; font-weight:700; color:#fbbf24; border-color:rgba(245,158,11,0.45); display:inline-flex; align-items:center; gap:4px;" title="Restaurar base de datos a este punto en el tiempo">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>Restaurar</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(err) {
        console.error("Error al cargar lista de respaldos:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#f87171;">Error al consultar respaldos del servidor</td></tr>`;
        }
    }
}

let archivoParaRestaurar = null;

function confirmarRestaurarBackup(archivo) {
    archivoParaRestaurar = archivo;
    const modal = document.getElementById('modal-restaurar-backup');
    const nameEl = document.getElementById('restaurar-archivo-nombre');
    if (nameEl) nameEl.innerText = archivo;
    if (modal) modal.style.display = 'flex';
}

function cerrarModalRestaurarBackup() {
    archivoParaRestaurar = null;
    const modal = document.getElementById('modal-restaurar-backup');
    if (modal) modal.style.display = 'none';
}

async function ejecutarRestauracionConfirmada() {
    if (!archivoParaRestaurar) return;

    const btn = document.getElementById('btn-ejecutar-restauracion');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Restaurando y verificando...';
    }

    try {
        const res = await fetch('/api/sistema/backup/restaurar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archivo: archivoParaRestaurar })
        });
        const data = await res.json();

        if (res.ok && data.exito) {
            cerrarModalRestaurarBackup();
            mostrarAlertaFlotante(
                "✓ Base de Datos Restaurada con Éxito",
                `Se restauró correctamente el archivo: <strong>${data.archivoRestaurado}</strong><br>` +
                `Fecha: ${data.fechaRestauracion}<br>` +
                `<span style="color:#86efac;">✓ Se creó automáticamente un respaldo previo de resguardo: <strong>${data.respaldoPrevioCreado}</strong></span><br>` +
                `Estado activo: ${data.estadisticas.ventas} ventas, ${data.estadisticas.productos} repuestos, ${data.estadisticas.kardex} movimientos de kárdex.`,
                'success'
            );

            // Refrescar datos en la interfaz
            await cargarKPIs();
            await cargarInventario();
            await cargarListaBackups();
        } else {
            mostrarToast(`Error al restaurar: ${data.mensaje || 'Fallo de verificación'}`, 'error');
        }
    } catch(e) {
        console.error("Error al restaurar copia de seguridad:", e);
        mostrarToast("Error de conexión al restaurar base de datos", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> <span>Sí, Restaurar Base de Datos</span>`;
        }
    }
}

async function generarCopiaSeguridad() {
    const btn = document.getElementById('btn-generar-backup');
    const icon = document.getElementById('icon-btn-backup');
    const text = document.getElementById('text-btn-backup');

    if (btn) btn.disabled = true;
    if (text) text.innerText = 'Generando snapshot e integridad...';
    if (icon) icon.classList.add('sync-spin');

    try {
        const res = await fetch('/api/sistema/backup', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.exito && data.backup) {
            const b = data.backup;
            mostrarAlertaFlotante(
                "✓ Copia de Seguridad Generada y Certificada",
                `Archivo: <strong>${b.archivo}</strong> (${b.tamano_formateado})<br>` +
                `Integridad: <strong style="color:#86efac;">100% ÍNTEGRO (PRAGMA OK)</strong><br>` +
                `Firma SHA-256: <code style="font-size:0.75rem; word-break:break-all;">${b.sha256}</code><br>` +
                `Ubicación segura: <strong>${b.ubicacion_segura}</strong><br>` +
                `Registros: ${b.estadisticas.ventas} ventas, ${b.estadisticas.productos} repuestos, ${b.estadisticas.kardex} movimientos de kárdex.`,
                'success'
            );

            await cargarListaBackups();
        } else {
            mostrarToast(`Error: ${data.mensaje || 'No se pudo generar la copia'}`, 'error');
        }
    } catch(e) {
        console.error("Error al generar copia de seguridad:", e);
        mostrarToast("Error de conexión al generar copia de seguridad", "error");
    } finally {
        if (btn) btn.disabled = false;
        if (text) text.innerText = 'Generar Copia de Seguridad Inmediata';
        if (icon) icon.classList.remove('sync-spin');
    }
}

function copiarTextoPortapapeles(txt) {
    if (!txt) return;
    navigator.clipboard.writeText(txt).then(() => {
        mostrarToast("✓ Firma criptográfica SHA-256 copiada al portapapeles.", "success");
    }).catch(() => {
        prompt("Copie el Hash SHA-256:", txt);
    });
}

