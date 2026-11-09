/**
 * Servicio de Reportes y Libros Legales Fiscales para MeDIa
 * Conforme a las exigencias del Reglamento de la Ley del IVA (Art. 75 al 78)
 * y Providencia SNAT/2022/000013 (IGTF)
 */

const db = require('../database/db');

class ReportesService {
    /**
     * Genera el Libro de Ventas Fiscal del SENIAT para un período dado
     */
    static getLibroVentas(fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                v.*,
                c.razon_social as cliente_nombre,
                c.rif_completo as cliente_rif
            FROM ventas v
            JOIN clientes c ON v.cliente_id = c.id
            WHERE v.estado = 'PROCESADA'
        `;
        const params = [];

        if (fechaInicio && fechaFin) {
            sql += ` AND v.fecha BETWEEN ? AND ?`;
            params.push(fechaInicio, fechaFin);
        }

        sql += ` ORDER BY v.fecha ASC, v.id ASC`;
        const registros = db.query(sql, params);

        // Totales de resumen fiscal para la planilla del SENIAT
        const totales = {
            totalVentasConIva: 0,
            ventasExentas: 0,
            baseGeneral: 0,
            ivaGeneral: 0,
            baseReducida: 0,
            ivaReducida: 0,
            baseAdicional: 0,
            ivaAdicional: 0,
            totalIvaDebito: 0,
            baseIgtf: 0,
            igtfPercibido: 0
        };

        registros.forEach((r, idx) => {
            r.operacion_numero = idx + 1;
            totales.totalVentasConIva += r.total_final_con_igtf_ves;
            totales.ventasExentas += r.subtotal_exento_ves;
            totales.baseGeneral += r.base_general_ves;
            totales.ivaGeneral += r.iva_general_ves;
            totales.baseReducida += r.base_reducida_ves;
            totales.ivaReducida += r.iva_reducida_ves;
            totales.baseAdicional += r.base_adicional_ves;
            totales.ivaAdicional += r.iva_adicional_ves;
            totales.baseIgtf += r.base_igtf_ves;
            totales.igtfPercibido += r.monto_igtf_ves;
        });

        totales.totalIvaDebito = totales.ivaGeneral + totales.ivaReducida + totales.ivaAdicional;

        // Redondear a 2 decimales
        for (const k in totales) {
            totales[k] = Math.round(totales[k] * 100) / 100;
        }

        return {
            periodo: { fechaInicio, fechaFin },
            registros,
            totales
        };
    }

    /**
     * Genera el Libro de Compras Fiscal del SENIAT para un período dado
     */
    static getLibroCompras(fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                c.*,
                p.razon_social as proveedor_nombre,
                p.rif_completo as proveedor_rif
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
        `;
        const params = [];

        if (fechaInicio && fechaFin) {
            sql += ` WHERE c.fecha_factura BETWEEN ? AND ?`;
            params.push(fechaInicio, fechaFin);
        }

        sql += ` ORDER BY c.fecha_factura ASC, c.id ASC`;
        const registros = db.query(sql, params);

        const totales = {
            totalComprasConIva: 0,
            comprasExentas: 0,
            baseImponible: 0,
            montoIvaCredito: 0,
            montoRetenidoIva: 0
        };

        registros.forEach((r, idx) => {
            r.operacion_numero = idx + 1;
            totales.totalComprasConIva += r.total_compra_ves;
            totales.comprasExentas += r.total_exento_ves;
            totales.baseImponible += r.base_imponible_ves;
            totales.montoIvaCredito += r.monto_iva_ves;
            totales.montoRetenidoIva += r.monto_retenido_iva_ves;
        });

        for (const k in totales) {
            totales[k] = Math.round(totales[k] * 100) / 100;
        }

        return {
            periodo: { fechaInicio, fechaFin },
            registros,
            totales
        };
    }

    /**
     * Resumen de Gestión Gerencial y Financiero enfocado en Operaciones del Día
     */
    static getResumenGerencial() {
        const fechaHoy = new Date().toISOString().split('T')[0];

        // 1. Estadísticas Globales del Día de Hoy
        const statsHoy = db.get(`
            SELECT 
                COALESCE(COUNT(*), 0) as total_facturas_hoy,
                COALESCE(SUM(total_venta_usd), 0) as total_usd_hoy,
                COALESCE(SUM(total_final_con_igtf_ves), 0) as total_ves_hoy,
                COALESCE(SUM(monto_igtf_ves), 0) as total_igtf_ves_hoy,
                COALESCE(AVG(total_venta_usd), 0) as ticket_promedio_usd
            FROM ventas 
            WHERE estado = 'PROCESADA' AND fecha = ?
        `, [fechaHoy]) || { total_facturas_hoy: 0, total_usd_hoy: 0, total_ves_hoy: 0, total_igtf_ves_hoy: 0, ticket_promedio_usd: 0 };

        // Unidades vendidas hoy
        const unidadesHoy = db.get(`
            SELECT COALESCE(SUM(vi.cantidad), 0) as total_unidades
            FROM ventas_items vi
            JOIN ventas v ON vi.venta_id = v.id
            WHERE v.estado = 'PROCESADA' AND v.fecha = ?
        `, [fechaHoy]) || { total_unidades: 0 };

        // 2. Estadísticas Históricas Acumuladas
        const statsVentas = db.get(`
            SELECT 
                COALESCE(COUNT(*), 0) as total_facturas,
                COALESCE(SUM(total_venta_usd), 0) as total_usd,
                COALESCE(SUM(total_final_con_igtf_ves), 0) as total_ves,
                COALESCE(SUM(monto_igtf_ves), 0) as total_igtf_ves
            FROM ventas 
            WHERE estado = 'PROCESADA'
        `);

        // 3. Inventario Valorado
        const statsInventario = db.get(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(stock_actual * costo_usd), 0) as valor_costo_usd,
                COALESCE(SUM(stock_actual * precio_usd), 0) as valor_venta_usd,
                COALESCE(SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) as productos_alerta
            FROM productos 
            WHERE activo = 1
        `);

        // 4. Medios de Pago Capturados HOY
        const desglosesPagosHoy = db.query(`
            SELECT vp.metodo_pago, vp.moneda, SUM(vp.monto_original) as total_capturado, SUM(vp.monto_equivalente_ves) as total_ves, COUNT(vp.id) as transacciones
            FROM ventas_pagos vp
            JOIN ventas v ON vp.venta_id = v.id
            WHERE v.estado = 'PROCESADA' AND v.fecha = ?
            GROUP BY vp.metodo_pago, vp.moneda
        `, [fechaHoy]);

        // 5. Últimas Ventas / Facturas Realizadas HOY (Feed en Vivo)
        const ultimasVentasHoy = db.query(`
            SELECT 
                v.id,
                v.numero_factura_fiscal,
                v.numero_control,
                v.hora,
                v.total_final_con_igtf_ves,
                v.total_venta_usd,
                v.monto_igtf_ves,
                v.estado,
                c.razon_social as cliente_nombre,
                c.rif_completo as cliente_rif,
                (
                    SELECT GROUP_CONCAT(vi.descripcion || ' (x' || CAST(vi.cantidad as INTEGER) || ')', ', ')
                    FROM ventas_items vi
                    WHERE vi.venta_id = v.id
                ) as items_resumen,
                (
                    SELECT GROUP_CONCAT(DISTINCT vp.metodo_pago)
                    FROM ventas_pagos vp
                    WHERE vp.venta_id = v.id
                ) as metodos_pago
            FROM ventas v
            JOIN clientes c ON v.cliente_id = c.id
            WHERE v.fecha = ?
            ORDER BY v.id DESC
            LIMIT 15
        `, [fechaHoy]);

        // 6. Top 5 Repuestos de Moto Más Vendidos HOY
        const topRepuestosHoy = db.query(`
            SELECT 
                vi.descripcion,
                p.imagen_url,
                p.codigo_barra,
                SUM(vi.cantidad) as total_cantidad,
                SUM(vi.subtotal_ves) as total_ves,
                SUM(vi.cantidad * vi.precio_unitario_usd) as total_usd
            FROM ventas_items vi
            JOIN ventas v ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            WHERE v.estado = 'PROCESADA' AND v.fecha = ?
            GROUP BY vi.descripcion
            ORDER BY total_cantidad DESC
            LIMIT 5
        `, [fechaHoy]);

        // 7. Repuestos en Alerta de Stock Mínimo
        const alertasStock = db.query(`
            SELECT id, codigo_barra, referencia, descripcion, stock_actual, stock_minimo, precio_usd, imagen_url
            FROM productos
            WHERE activo = 1 AND stock_actual <= stock_minimo
            ORDER BY (stock_actual - stock_minimo) ASC
            LIMIT 8
        `);

        // 8. Distribución Semanal de Ventas (Últimos 7 días)
        const diasSemana = db.query(`
            SELECT fecha, SUM(total_final_con_igtf_ves) as total_ves, SUM(total_venta_usd) as total_usd, COUNT(*) as facturas
            FROM ventas
            WHERE estado = 'PROCESADA' AND fecha >= date(?, '-6 days')
            GROUP BY fecha
            ORDER BY fecha ASC
        `, [fechaHoy]);

        return {
            fechaHoy,
            hoy: {
                total_facturas: statsHoy.total_facturas_hoy,
                total_usd: statsHoy.total_usd_hoy,
                total_ves: statsHoy.total_ves_hoy,
                total_igtf_ves: statsHoy.total_igtf_ves_hoy,
                ticket_promedio_usd: statsHoy.ticket_promedio_usd,
                unidades_vendidas: unidadesHoy.total_unidades
            },
            ventas: statsVentas,
            inventario: statsInventario,
            mediosDePagoHoy: desglosesPagosHoy,
            ultimasVentasHoy,
            topRepuestosHoy,
            alertasStock,
            diasSemana
        };
    }

    /**
     * Exporta el Libro de Ventas a formato CSV compatible con Microsoft Excel (Separador ';')
     */
    static exportarLibroVentasCSV(fechaInicio, fechaFin) {
        const data = this.getLibroVentas(fechaInicio, fechaFin);
        const BOM = '\uFEFF';
        const headers = [
            'Nro. Operación',
            'Fecha',
            'RIF Cliente',
            'Nombre o Razón Social',
            'Nro. Factura Fiscal',
            'Nro. Control',
            'Ventas Exentas (Bs)',
            'Base Imponible G 16% (Bs)',
            'Débito Fiscal 16% (Bs)',
            'Base Imponible R 8% (Bs)',
            'Débito Fiscal 8% (Bs)',
            'Base Imponible A 31% (Bs)',
            'Débito Fiscal 31% (Bs)',
            'IGTF Percibido 3% (Bs)',
            'Total Ventas con IVA (Bs)'
        ].join(';');

        const rows = data.registros.map(r => [
            r.operacion_numero,
            r.fecha,
            r.cliente_rif,
            `"${r.cliente_nombre.replace(/"/g, '""')}"`,
            r.numero_factura_fiscal,
            r.numero_control || '',
            r.subtotal_exento_ves.toFixed(2),
            r.base_general_ves.toFixed(2),
            r.iva_general_ves.toFixed(2),
            r.base_reducida_ves.toFixed(2),
            r.iva_reducida_ves.toFixed(2),
            r.base_adicional_ves.toFixed(2),
            r.iva_adicional_ves.toFixed(2),
            r.monto_igtf_ves.toFixed(2),
            r.total_final_con_igtf_ves.toFixed(2)
        ].join(';'));

        // Totales de resumen
        const summary = [
            '',
            'TOTALES GENERALES',
            '',
            '',
            '',
            '',
            data.totales.ventasExentas.toFixed(2),
            data.totales.baseGeneral.toFixed(2),
            data.totales.ivaGeneral.toFixed(2),
            data.totales.baseReducida.toFixed(2),
            data.totales.ivaReducida.toFixed(2),
            data.totales.baseAdicional.toFixed(2),
            data.totales.ivaAdicional.toFixed(2),
            data.totales.igtfPercibido.toFixed(2),
            data.totales.totalVentasConIva.toFixed(2)
        ].join(';');

        return BOM + [headers, ...rows, summary].join('\r\n');
    }

    /**
     * Exporta el Libro de Compras a formato CSV compatible con Microsoft Excel (Separador ';')
     */
    static exportarLibroComprasCSV(fechaInicio, fechaFin) {
        const data = this.getLibroCompras(fechaInicio, fechaFin);
        const BOM = '\uFEFF';
        const headers = [
            'Nro. Operación',
            'Fecha Emisión',
            'RIF Proveedor',
            'Nombre o Razón Social',
            'Nro. Factura Proveedor',
            'Nro. Control',
            'Compras Exentas (Bs)',
            'Base Imponible (Bs)',
            'Crédito Fiscal IVA (Bs)',
            'Nro. Comprobante Retención IVA',
            'Monto IVA Retenido (Bs)',
            'Total Compras con IVA (Bs)'
        ].join(';');

        const rows = data.registros.map(r => [
            r.operacion_numero,
            r.fecha_factura,
            r.proveedor_rif,
            `"${r.proveedor_nombre.replace(/"/g, '""')}"`,
            r.numero_factura_proveedor,
            r.numero_control_proveedor || '',
            r.total_exento_ves.toFixed(2),
            r.base_imponible_ves.toFixed(2),
            r.monto_iva_ves.toFixed(2),
            r.comprobante_retencion_iva || 'N/A',
            r.monto_retenido_iva_ves.toFixed(2),
            r.total_compra_ves.toFixed(2)
        ].join(';'));

        const summary = [
            '',
            'TOTALES GENERALES',
            '',
            '',
            '',
            '',
            data.totales.comprasExentas.toFixed(2),
            data.totales.baseImponible.toFixed(2),
            data.totales.montoIvaCredito.toFixed(2),
            '',
            data.totales.montoRetenidoIva.toFixed(2),
            data.totales.totalComprasConIva.toFixed(2)
        ].join(';');

        return BOM + [headers, ...rows, summary].join('\r\n');
    }
}

module.exports = ReportesService;

