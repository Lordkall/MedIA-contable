/**
 * Servicio de Punto de Venta (MedIA POS)
 * Control de caja, transacciones fiscales, pagos mixtos e IGTF 3%
 */

const db = require('../database/db');
const BCVManager = require('../engine/bcv');
const FiscalEngine = require('../engine/fiscal');
const FiscalPrinter = require('../engine/printer');
const CorrelativoEngine = require('../engine/correlativoEngine');

class PosService {
    static getSesionActiva() {
        return db.get("SELECT * FROM sesiones_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1");
    }

    static abrirCaja(numeroCaja = '01', cajero = 'CAJERO 1', montoInicialVes = 0, montoInicialUsd = 0) {
        const activa = this.getSesionActiva();
        if (activa) {
            throw new Error(`Ya existe una caja abierta (Caja Nro: ${activa.numero_caja}, Cajero: ${activa.cajero})`);
        }

        const { tasa } = BCVManager.getTasaActual();
        const res = db.run(`
            INSERT INTO sesiones_caja (numero_caja, cajero, monto_inicial_ves, monto_inicial_usd, tasa_bcv_apertura, estado)
            VALUES (?, ?, ?, ?, ?, 'ABIERTA')
        `, [numeroCaja, cajero, Number(montoInicialVes) || 0, Number(montoInicialUsd) || 0, tasa]);

        return db.get("SELECT * FROM sesiones_caja WHERE id = ?", [res.lastInsertRowid]);
    }

    static cerrarCaja(sesionId, conteoCierreVes = 0, conteoCierreUsd = 0) {
        const sesion = db.get("SELECT * FROM sesiones_caja WHERE id = ? AND estado = 'ABIERTA'", [sesionId]);
        if (!sesion) throw new Error("Sesión de caja no encontrada o ya cerrada");

        // Calcular totales recaudados en el turno
        const ventasTurno = db.query(`
            SELECT vp.metodo_pago, vp.moneda, SUM(vp.monto_original) as total_monto, SUM(vp.monto_equivalente_ves) as total_ves
            FROM ventas_pagos vp
            JOIN ventas v ON vp.venta_id = v.id
            WHERE v.sesion_caja_id = ? AND v.estado = 'PROCESADA'
            GROUP BY vp.metodo_pago, vp.moneda
        `, [sesionId]);

        let esperadoVes = sesion.monto_inicial_ves;
        let esperadoUsd = sesion.monto_inicial_usd;

        ventasTurno.forEach(v => {
            if (v.metodo_pago === 'EFECTIVO_VES') {
                esperadoVes += v.total_monto;
            } else if (v.metodo_pago === 'EFECTIVO_USD') {
                esperadoUsd += v.total_monto;
            }
        });

        const difVes = Math.round((conteoCierreVes - esperadoVes) * 100) / 100;
        const difUsd = Math.round((conteoCierreUsd - esperadoUsd) * 100) / 100;

        db.run(`
            UPDATE sesiones_caja SET
                fecha_cierre = CURRENT_TIMESTAMP,
                monto_cierre_ves = ?,
                monto_cierre_usd = ?,
                diferencia_ves = ?,
                diferencia_usd = ?,
                estado = 'CERRADA'
            WHERE id = ?
        `, [conteoCierreVes, conteoCierreUsd, difVes, difUsd, sesionId]);

        return {
            sesionId,
            esperadoVes,
            esperadoUsd,
            conteoCierreVes,
            conteoCierreUsd,
            diferenciaVes: difVes,
            diferenciaUsd: difUsd
        };
    }

    static procesarVenta({ cliente_id = null, items = [], pagos = [] }) {
        if (!items || items.length === 0) {
            throw new Error("La venta debe contener al menos un producto");
        }

        const sesion = this.getSesionActiva();
        if (!sesion) {
            throw new Error("No hay ninguna sesión de caja abierta. Debe abrir la caja para poder facturar.");
        }

        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const { tasa: tasaBcv } = BCVManager.getTasaActual();

        // Obtener datos del cliente
        let cliente = null;
        if (cliente_id) {
            cliente = db.get("SELECT * FROM clientes WHERE id = ?", [cliente_id]);
        }
        if (!cliente) {
            cliente = db.get("SELECT * FROM clientes WHERE tipo_contribuyente = 'CONSUMIDOR_FINAL' LIMIT 1");
        }

        // 1. Validar existencias y obtener datos frescos de productos
        const itemsParaCalcular = [];
        for (const it of items) {
            const prod = db.get("SELECT * FROM productos WHERE id = ?", [it.producto_id]);
            if (!prod) throw new Error(`Producto con ID ${it.producto_id} no existe`);
            if (prod.stock_actual < it.cantidad) {
                throw new Error(`Stock insuficiente para "${prod.descripcion}". Disponible: ${prod.stock_actual}, Solicitado: ${it.cantidad}`);
            }
            itemsParaCalcular.push({
                producto_id: prod.id,
                codigo_barra: prod.codigo_barra,
                descripcion: prod.descripcion,
                alicuota_iva: prod.alicuota_iva,
                cantidad: it.cantidad,
                precio_unitario_usd: prod.precio_usd,
                costo_usd: prod.costo_usd
            });
        }

        // 2. Cálculo fiscal de la venta (IVA por alícuotas)
        const calculosVenta = FiscalEngine.calcularTotalesVenta(itemsParaCalcular, tasaBcv);

        // 3. Procesar pagos y cálculo de IGTF (3%)
        const calculosPagos = FiscalEngine.calcularIGTFYPagos(
            pagos,
            Boolean(config.es_agente_percepcion_igtf),
            calculosVenta.totalVentaVes,
            tasaBcv
        );

        // Verificar que el pago cubra el total (con tolerancia de 0.50 Bs por redondeos cambiarios)
        if (calculosPagos.totalPagadoVes < (calculosPagos.totalFinalConIgtfVes - 0.50)) {
            throw new Error(`Pago insuficiente. Total exigido: ${BCVManager.formatVES(calculosPagos.totalFinalConIgtfVes)}, Pagado: ${BCVManager.formatVES(calculosPagos.totalPagadoVes)}`);
        }

        // 4. Correlativo fiscal estricto y secuencial sin saltos
        const seqFactura = CorrelativoEngine.getSiguienteCorrelativo('FACTURA');
        const seqControl = CorrelativoEngine.getSiguienteCorrelativo('CONTROL');
        const numFacturaFiscal = seqFactura.documentoFormateado;
        const numControl = seqControl.documentoFormateado;

        const now = new Date();
        const fecha = now.toISOString().split('T')[0];
        const hora = now.toTimeString().split(' ')[0];

        // 5. Criptografía de Seguridad: Hash encadenado SHA-256 (Tamper-Evidence)
        const ultimaVenta = db.get("SELECT hash_seguridad FROM ventas ORDER BY id DESC LIMIT 1");
        const hashAnterior = ultimaVenta && ultimaVenta.hash_seguridad ? ultimaVenta.hash_seguridad : 'GENESIS_MEDIA_SENIAT';
        const hashSeguridad = CorrelativoEngine.calcularHashFactura({
            numero_factura_fiscal: numFacturaFiscal,
            numero_control: numControl,
            serial_impresora: config.serial_impresora_fiscal,
            fecha,
            hora,
            cliente_rif: cliente.rif_completo,
            total_venta_ves: calculosVenta.totalVentaVes,
            monto_igtf_ves: calculosPagos.montoIgtfVes,
            total_final_con_igtf_ves: calculosPagos.totalFinalConIgtfVes,
            tasa_bcv_snapshot: tasaBcv
        }, hashAnterior);

        // 6. Inserción de la Venta (Protegida por Triggers de Inalterabilidad)
        const resVenta = db.run(`
            INSERT INTO ventas (
                numero_factura_fiscal, numero_control, serial_impresora, sesion_caja_id, cliente_id,
                fecha, hora, tasa_bcv_snapshot,
                subtotal_exento_ves, base_general_ves, iva_general_ves,
                base_reducida_ves, iva_reducida_ves, base_adicional_ves, iva_adicional_ves,
                total_venta_ves, total_venta_usd,
                monto_pagado_divisas_usd, base_igtf_ves, monto_igtf_ves, total_final_con_igtf_ves,
                hash_seguridad, hash_anterior, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESADA')
        `, [
            numFacturaFiscal, numControl, config.serial_impresora_fiscal, sesion.id, cliente.id,
            fecha, hora, tasaBcv,
            calculosVenta.subtotalExentoVes, calculosVenta.baseGeneralVes, calculosVenta.ivaGeneralVes,
            calculosVenta.baseReducidaVes, calculosVenta.ivaReducidaVes, calculosVenta.baseAdicionalVes, calculosVenta.ivaAdicionalVes,
            calculosVenta.totalVentaVes, calculosVenta.totalVentaUsd,
            calculosPagos.montoPagadoDivisasUsd, calculosPagos.baseIgtfVes, calculosPagos.montoIgtfVes, calculosPagos.totalFinalConIgtfVes,
            hashSeguridad, hashAnterior
        ]);

        const ventaId = resVenta.lastInsertRowid;

        // 6. Insertar ítems y descontar inventario en tiempo real
        calculosVenta.items.forEach(it => {
            db.run(`
                INSERT INTO ventas_items (
                    venta_id, producto_id, codigo_barra, descripcion, alicuota_iva,
                    cantidad, precio_unitario_usd, precio_unitario_ves,
                    subtotal_ves, iva_ves, total_ves
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ventaId, it.producto_id, it.codigo_barra, it.descripcion, it.alicuota_iva,
                it.cantidad, it.precio_unitario_usd, it.precio_unitario_ves,
                it.subtotal_ves, it.iva_ves, it.total_ves
            ]);

            // Descontar inventario
            const prodActual = db.get("SELECT stock_actual FROM productos WHERE id = ?", [it.producto_id]);
            const nuevoStock = prodActual.stock_actual - it.cantidad;
            db.run("UPDATE productos SET stock_actual = ? WHERE id = ?", [nuevoStock, it.producto_id]);

            // Asentar en Kárdex
            db.run(`
                INSERT INTO kardex (
                    producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
                    costo_unitario_usd, tasa_bcv_momento, referencia_documento
                ) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?)
            `, [
                it.producto_id, it.cantidad, prodActual.stock_actual, nuevoStock,
                it.costo_usd, tasaBcv, `FACT-${numFacturaFiscal}`
            ]);
        });

        // 7. Insertar pagos
        calculosPagos.pagos.forEach(p => {
            db.run(`
                INSERT INTO ventas_pagos (
                    venta_id, metodo_pago, moneda, monto_original, tasa_cambio,
                    monto_equivalente_ves, genera_igtf, monto_igtf_ves, referencia
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ventaId, p.metodo_pago, p.moneda, p.monto_original, p.tasa_cambio || tasaBcv,
                p.monto_equivalente_ves, p.genera_igtf, p.monto_igtf_ves, p.referencia || ''
            ]);
        });

        // 8. Generar el Ticket Fiscal Impreso (Emulación exacta Providencia 0141)
        const printer = new FiscalPrinter({
            serial: config.serial_impresora_fiscal,
            razonSocial: config.razonSocial,
            rif: config.rif,
            direccion: config.direccion
        });

        const ventaData = db.get("SELECT * FROM ventas WHERE id = ?", [ventaId]);
        const ticketFiscalTexto = printer.generarTicketFiscal(ventaData, cliente, calculosVenta.items, calculosPagos.pagos);

        return {
            ventaId,
            numeroFactura: numFacturaFiscal,
            numeroControl: numControl,
            cliente,
            totales: {
                ...calculosVenta,
                ...calculosPagos
            },
            ticketFiscal: ticketFiscalTexto
        };
    }

    /**
     * Procesa una Devolución / Anulación mediante NOTA DE CRÉDITO FISCAL (SENIAT)
     */
    static procesarNotaCredito(facturaId, motivo = 'Devolución de cliente') {
        const venta = db.get("SELECT * FROM ventas WHERE id = ?", [facturaId]);
        if (!venta) throw new Error("Factura fiscal no encontrada");
        if (venta.estado === 'ANULADA') throw new Error("Esta factura ya fue anulada previamente con Nota de Crédito");

        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const cliente = db.get("SELECT * FROM clientes WHERE id = ?", [venta.cliente_id]);
        const items = db.query("SELECT * FROM ventas_items WHERE venta_id = ?", [facturaId]);

        const now = new Date();
        const fecha = now.toISOString().split('T')[0];
        const hora = now.toTimeString().split(' ')[0];

        // Consecutivo para Nota de Crédito mediante CorrelativoEngine
        const seqNC = CorrelativoEngine.getSiguienteCorrelativo('NOTA_CREDITO');
        const numNC = seqNC.documentoFormateado;

        // Reingresar stock al inventario y registrar en Kárdex
        items.forEach(it => {
            const prodActual = db.get("SELECT stock_actual, costo_usd FROM productos WHERE id = ?", [it.producto_id]);
            const nuevoStock = prodActual.stock_actual + it.cantidad;

            db.run("UPDATE productos SET stock_actual = ? WHERE id = ?", [nuevoStock, it.producto_id]);

            db.run(`
                INSERT INTO kardex (
                    producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
                    costo_unitario_usd, tasa_bcv_momento, referencia_documento
                ) VALUES (?, 'ENTRADA_DEVOLUCION_NC', ?, ?, ?, ?, ?, ?)
            `, [
                it.producto_id, it.cantidad, prodActual.stock_actual, nuevoStock,
                prodActual.costo_usd, venta.tasa_bcv_snapshot, `${numNC} (Fact: ${venta.numero_factura_fiscal})`
            ]);
        });

        // Marcar venta como ANULADA
        db.run("UPDATE ventas SET estado = 'ANULADA' WHERE id = ?", [facturaId]);

        // Generar ticket fiscal de Nota de Crédito
        const printer = new FiscalPrinter({
            serial: config.serial_impresora_fiscal,
            razonSocial: config.razonSocial,
            rif: config.rif,
            direccion: config.direccion
        });

        const ncData = {
            numero_nc: numNC,
            fecha,
            hora,
            motivo,
            total_devuelto_ves: venta.total_final_con_igtf_ves,
            total_devuelto_usd: venta.total_venta_usd
        };

        const ticketFiscal = printer.generarNotaCreditoFiscal(ncData, venta, cliente, items);

        return {
            exito: true,
            numeroNC: numNC,
            facturaAfectada: venta.numero_factura_fiscal,
            totalDevueltoVes: venta.total_final_con_igtf_ves,
            ticketFiscal
        };
    }

    static generarReporteX() {
        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const printer = new FiscalPrinter({
            serial: config.serial_impresora_fiscal,
            razonSocial: config.razonSocial,
            rif: config.rif,
            direccion: config.direccion
        });

        const hoy = new Date().toISOString().split('T')[0];
        const stats = db.get(`
            SELECT 
                COUNT(*) as totalFacturas,
                COALESCE(SUM(subtotal_exento_ves), 0) as exentoVes,
                COALESCE(SUM(base_general_ves), 0) as baseGeneralVes,
                COALESCE(SUM(iva_general_ves), 0) as ivaGeneralVes,
                COALESCE(SUM(monto_igtf_ves), 0) as igtfVes,
                COALESCE(SUM(total_final_con_igtf_ves), 0) as totalVes,
                COALESCE(SUM(total_venta_usd), 0) as totalUsd
            FROM ventas 
            WHERE fecha = ? AND estado = 'PROCESADA'
        `, [hoy]);

        return printer.generarReporteX(stats);
    }

    static generarReporteZ() {
        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const printer = new FiscalPrinter({
            serial: config.serial_impresora_fiscal,
            razonSocial: config.razonSocial,
            rif: config.rif,
            direccion: config.direccion
        });

        const sesion = this.getSesionActiva();
        const proxZ = (sesion && sesion.ultimo_reporte_z ? sesion.ultimo_reporte_z : 0) + 1;

        const hoy = new Date().toISOString().split('T')[0];
        const stats = db.get(`
            SELECT 
                COUNT(*) as totalFacturas,
                COALESCE(MAX(numero_factura_fiscal), '00000000') as ultimaFactura,
                COALESCE(SUM(subtotal_exento_ves), 0) as exentoVes,
                COALESCE(SUM(base_general_ves), 0) as baseGeneralVes,
                COALESCE(SUM(iva_general_ves), 0) as ivaGeneralVes,
                COALESCE(SUM(monto_igtf_ves), 0) as igtfVes,
                COALESCE(SUM(total_final_con_igtf_ves), 0) as totalVes
            FROM ventas 
            WHERE fecha = ? AND estado = 'PROCESADA'
        `, [hoy]);

        if (sesion) {
            db.run("UPDATE sesiones_caja SET ultimo_reporte_z = ? WHERE id = ?", [proxZ, sesion.id]);
        }

        return printer.generarReporteZ(proxZ, stats);
    }
}

module.exports = PosService;

