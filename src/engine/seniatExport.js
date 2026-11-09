/**
 * Generador de Archivo TXT de Retenciones de IVA para el Portal del SENIAT
 * Formato oficial para la Declaración en Línea de Sujetos Pasivos Especiales
 */

const db = require('../database/db');

class SeniatExportEngine {
    /**
     * Genera el contenido del archivo TXT para subir al portal del SENIAT
     * @param {string} fechaInicio - YYYY-MM-DD
     * @param {string} fechaFin - YYYY-MM-DD
     */
    static generarTxtRetencionesIVA(fechaInicio, fechaFin) {
        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const rifAgenteLimpio = config.rif.replace(/-/g, '').toUpperCase();

        let sql = `
            SELECT 
                c.*,
                p.rif_completo as proveedor_rif
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.comprobante_retencion_iva IS NOT NULL AND c.monto_retenido_iva_ves > 0
        `;
        const params = [];

        if (fechaInicio && fechaFin) {
            sql += ` AND c.fecha_factura BETWEEN ? AND ?`;
            params.push(fechaInicio, fechaFin);
        }

        sql += ` ORDER BY c.fecha_factura ASC`;
        const retenciones = db.query(sql, params);

        const lineas = retenciones.map(r => {
            const rifProveedor = r.proveedor_rif.replace(/-/g, '').toUpperCase();
            const periodo = r.fecha_factura.replace(/-/g, '').substring(0, 6); // YYYYMM
            const fechaFactura = r.fecha_factura; // YYYY-MM-DD
            const tipoOperacion = 'C'; // Compras
            const tipoDocumento = '01'; // 01: Factura
            const numFactura = r.numero_factura_proveedor;
            const numControl = r.numero_control_proveedor || '0';
            const totalConIva = r.total_compra_ves.toFixed(2);
            const baseImponible = r.base_imponible_ves.toFixed(2);
            const montoIvaRetenido = r.monto_retenido_iva_ves.toFixed(2);
            const numComprobante = r.comprobante_retencion_iva;
            const montoExento = r.total_exento_ves.toFixed(2);
            const alicuotaIva = '16.00';
            const numFacturaAfectada = '0'; // 0 para facturas ordinarias

            // Estructura delimitada oficial con tabulaciones o espacios del SENIAT
            return `${rifAgenteLimpio}\t${periodo}\t${fechaFactura}\t${tipoOperacion}\t${tipoDocumento}\t${rifProveedor}\t${numFactura}\t${numControl}\t${totalConIva}\t${baseImponible}\t${montoIvaRetenido}\t${numComprobante}\t${montoExento}\t${alicuotaIva}\t${numFacturaAfectada}`;
        });

        return {
            totalRegistros: retenciones.length,
            contenidoTxt: lineas.join('\r\n'),
            nombreSugerido: `${rifAgenteLimpio}_IVA_${new Date().toISOString().substring(0, 7).replace('-', '')}.txt`
        };
    }
}

module.exports = SeniatExportEngine;

