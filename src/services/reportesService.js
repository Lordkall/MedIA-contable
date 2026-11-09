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
     * Resumen de Gestión Gerencial y Financiero
     */
    static getResumenGerencial() {
        const statsVentas = db.get(`
            SELECT 
                COALESCE(COUNT(*), 0) as total_facturas,
                COALESCE(SUM(total_venta_usd), 0) as total_usd,
                COALESCE(SUM(total_final_con_igtf_ves), 0) as total_ves,
                COALESCE(SUM(monto_igtf_ves), 0) as total_igtf_ves
            FROM ventas 
            WHERE estado = 'PROCESADA'
        `);

        const statsInventario = db.get(`
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(stock_actual * costo_usd), 0) as valor_costo_usd,
                COALESCE(SUM(stock_actual * precio_usd), 0) as valor_venta_usd,
                COALESCE(SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) as productos_alerta
            FROM productos 
            WHERE activo = 1
        `);

        const desglosesPagos = db.query(`
            SELECT metodo_pago, moneda, SUM(monto_original) as total_capturado, SUM(monto_equivalente_ves) as total_ves
            FROM ventas_pagos vp
            JOIN ventas v ON vp.venta_id = v.id
            WHERE v.estado = 'PROCESADA'
            GROUP BY metodo_pago, moneda
        `);

        return {
            ventas: statsVentas,
            inventario: statsInventario,
            mediosDePago: desglosesPagos
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

