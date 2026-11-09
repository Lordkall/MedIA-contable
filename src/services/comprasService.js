/**
 * Servicio de Compras y Retenciones Fiscales (SENIAT) para MeDIa
 */

const db = require('../database/db');
const BCVManager = require('../engine/bcv');
const FiscalEngine = require('../engine/fiscal');

class ComprasService {
    static getCompras() {
        return db.query(`
            SELECT c.*, p.razon_social as proveedor_nombre, p.rif_completo as proveedor_rif
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            ORDER BY c.id DESC
        `);
    }

    static registrarCompra(datos) {
        const {
            proveedor_id,
            numero_factura_proveedor,
            numero_control_proveedor,
            fecha_factura,
            items = []
        } = datos;

        if (!items || items.length === 0) {
            throw new Error("La compra debe incluir al menos un producto");
        }

        const proveedor = db.get("SELECT * FROM proveedores WHERE id = ?", [proveedor_id]);
        if (!proveedor) throw new Error("Proveedor no encontrado");

        const config = db.get("SELECT * FROM configuracion WHERE id = 1");
        const { tasa: tasaBcv } = BCVManager.getTasaActual();

        let totalExentoVes = 0;
        let baseImponibleVes = 0;
        let totalIvaVes = 0;
        let totalCompraUsd = 0;

        const itemsCalculados = items.map(it => {
            const prod = db.get("SELECT * FROM productos WHERE id = ?", [it.producto_id]);
            if (!prod) throw new Error(`Producto ${it.producto_id} no existe`);

            const cant = Number(it.cantidad);
            const costoUsd = Number(it.costo_unitario_usd);
            const costoVes = Math.round((costoUsd * tasaBcv) * 100) / 100;
            const subtotalVes = Math.round((cant * costoVes) * 100) / 100;
            totalCompraUsd += cant * costoUsd;

            let ivaItemVes = 0;
            const alic = FiscalEngine.ALICUOTAS_IVA[prod.alicuota_iva] || FiscalEngine.ALICUOTAS_IVA['G'];
            if (prod.alicuota_iva === 'E') {
                totalExentoVes += subtotalVes;
            } else {
                baseImponibleVes += subtotalVes;
                ivaItemVes = Math.round((subtotalVes * alic.factor) * 100) / 100;
                totalIvaVes += ivaItemVes;
            }

            return {
                producto_id: prod.id,
                cantidad: cant,
                costo_unitario_usd: costoUsd,
                costo_unitario_ves: costoVes,
                alicuota_iva: prod.alicuota_iva,
                total_ves: subtotalVes + ivaItemVes
            };
        });

        const totalCompraVes = Math.round((totalExentoVes + baseImponibleVes + totalIvaVes) * 100) / 100;

        // Cálculo de Retención de IVA (75% o 100% si el comercio es Sujeto Pasivo Especial)
        let montoRetenidoIvaVes = 0;
        let comprobanteRetIva = null;

        if (config.es_contribuyente_especial && totalIvaVes > 0) {
            const pctRet = proveedor.porcentaje_retencion_iva || 75.0;
            montoRetenidoIvaVes = Math.round((totalIvaVes * (pctRet / 100)) * 100) / 100;

            const periodo = (fecha_factura || new Date().toISOString().split('T')[0]).replace(/-/g, '').substring(0, 6);
            const countCompras = db.get("SELECT COUNT(*) as c FROM compras");
            const correlativo = String((countCompras ? countCompras.c : 0) + 1).padStart(8, '0');
            comprobanteRetIva = `${periodo}${correlativo}`;
        }

        // Inserción de la compra
        const resCompra = db.run(`
            INSERT INTO compras (
                proveedor_id, numero_factura_proveedor, numero_control_proveedor,
                fecha_factura, tasa_bcv_snapshot,
                total_exento_ves, base_imponible_ves, monto_iva_ves,
                total_compra_ves, total_compra_usd,
                comprobante_retencion_iva, monto_retenido_iva_ves
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            proveedor.id, numero_factura_proveedor, numero_control_proveedor,
            fecha_factura || new Date().toISOString().split('T')[0], tasaBcv,
            totalExentoVes, baseImponibleVes, totalIvaVes,
            totalCompraVes, totalCompraUsd,
            comprobanteRetIva, montoRetenidoIvaVes
        ]);

        const compraId = resCompra.lastInsertRowid;

        // Actualizar stock de inventario y asentar en Kárdex
        itemsCalculados.forEach(it => {
            db.run(`
                INSERT INTO compras_items (
                    compra_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_ves, alicuota_iva, total_ves
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [compraId, it.producto_id, it.cantidad, it.costo_unitario_usd, it.costo_unitario_ves, it.alicuota_iva, it.total_ves]);

            const prodActual = db.get("SELECT stock_actual, costo_usd FROM productos WHERE id = ?", [it.producto_id]);
            const nuevoStock = prodActual.stock_actual + it.cantidad;

            // Actualizar costo y stock en productos
            db.run(`
                UPDATE productos 
                SET stock_actual = ?, costo_usd = ?
                WHERE id = ?
            `, [nuevoStock, it.costo_unitario_usd, it.producto_id]);

            // Asentar entrada en Kárdex
            db.run(`
                INSERT INTO kardex (
                    producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
                    costo_unitario_usd, tasa_bcv_momento, referencia_documento
                ) VALUES (?, 'ENTRADA_COMPRA', ?, ?, ?, ?, ?, ?)
            `, [
                it.producto_id, it.cantidad, prodActual.stock_actual, nuevoStock,
                it.costo_unitario_usd, tasaBcv, `COMP-${numero_factura_proveedor}`
            ]);
        });

        return {
            compraId,
            comprobanteRetencionIva: comprobanteRetIva,
            montoRetenidoIvaVes,
            totalCompraVes,
            totalCompraUsd
        };
    }
}

module.exports = ComprasService;

