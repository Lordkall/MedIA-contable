/**
 * Servicio de Inventario y Kárdex Multimoneda para MeDIa
 */

const db = require('../database/db');
const BCVManager = require('../engine/bcv');

class InventarioService {
    static getProductos(busqueda = '', categoriaId = null) {
        const { tasa } = BCVManager.getTasaActual();
        let sql = `
            SELECT p.*, c.nombre as categoria_nombre 
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = 1
        `;
        const params = [];

        if (busqueda) {
            sql += ` AND (p.descripcion LIKE ? OR p.codigo_barra LIKE ? OR p.referencia LIKE ?)`;
            const term = `%${busqueda}%`;
            params.push(term, term, term);
        }

        if (categoriaId) {
            sql += ` AND p.categoria_id = ?`;
            params.push(categoriaId);
        }

        sql += ` ORDER BY p.descripcion ASC`;
        const items = db.query(sql, params);

        return items.map(p => ({
            ...p,
            precio_ves: Math.round((p.precio_usd * tasa) * 100) / 100,
            costo_ves: Math.round((p.costo_usd * tasa) * 100) / 100,
            tasa_bcv: tasa
        }));
    }

    static getProductoPorCodigo(codigo) {
        const { tasa } = BCVManager.getTasaActual();
        const p = db.get(`
            SELECT p.*, c.nombre as categoria_nombre 
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.codigo_barra = ? OR p.referencia = ?
        `, [codigo, codigo]);

        if (!p) return null;

        return {
            ...p,
            precio_ves: Math.round((p.precio_usd * tasa) * 100) / 100,
            costo_ves: Math.round((p.costo_usd * tasa) * 100) / 100,
            tasa_bcv: tasa
        };
    }

    static crearProducto(datos) {
        const res = db.run(`
            INSERT INTO productos (
                codigo_barra, referencia, descripcion, categoria_id, alicuota_iva,
                precio_usd, costo_usd, stock_actual, stock_minimo, unidad_medida, imagen_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            datos.codigo_barra,
            datos.referencia || '',
            datos.descripcion,
            datos.categoria_id || 1,
            datos.alicuota_iva || 'G',
            Number(datos.precio_usd) || 0,
            Number(datos.costo_usd) || 0,
            Number(datos.stock_actual) || 0,
            Number(datos.stock_minimo) || 5,
            datos.unidad_medida || 'UNID',
            datos.imagen_url || ''
        ]);

        const nuevoId = res.lastInsertRowid;
        if (Number(datos.stock_actual) > 0) {
            const { tasa } = BCVManager.getTasaActual();
            db.run(`
                INSERT INTO kardex (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_unitario_usd, tasa_bcv_momento, referencia_documento)
                VALUES (?, 'INVENTARIO_INICIAL', ?, 0, ?, ?, ?, 'ALTA_PRODUCTO')
            `, [nuevoId, datos.stock_actual, datos.stock_actual, datos.costo_usd || 0, tasa]);
        }

        return this.getProductoPorCodigo(datos.codigo_barra);
    }

    static actualizarProducto(id, datos) {
        db.run(`
            UPDATE productos SET
                codigo_barra = ?,
                referencia = ?,
                descripcion = ?,
                categoria_id = ?,
                alicuota_iva = ?,
                precio_usd = ?,
                costo_usd = ?,
                stock_minimo = ?,
                unidad_medida = ?,
                imagen_url = ?
            WHERE id = ?
        `, [
            datos.codigo_barra,
            datos.referencia,
            datos.descripcion,
            datos.categoria_id,
            datos.alicuota_iva,
            Number(datos.precio_usd),
            Number(datos.costo_usd),
            Number(datos.stock_minimo),
            datos.unidad_medida,
            datos.imagen_url || '',
            id
        ]);
        return db.get("SELECT * FROM productos WHERE id = ?", [id]);
    }

    static ajustarStock(productoId, cantidad, tipo, motivo = '') {
        const prod = db.get("SELECT * FROM productos WHERE id = ?", [productoId]);
        if (!prod) throw new Error("Producto no encontrado");

        const cantNum = Math.abs(Number(cantidad));
        const stockAnt = prod.stock_actual;
        let stockNuevo = stockAnt;

        if (tipo === 'AJUSTE_POSITIVO') {
            stockNuevo = stockAnt + cantNum;
        } else if (tipo === 'AJUSTE_NEGATIVO') {
            if (stockAnt < cantNum) throw new Error("Stock insuficiente para ajuste negativo");
            stockNuevo = stockAnt - cantNum;
        } else {
            throw new Error("Tipo de ajuste inválido");
        }

        db.run("UPDATE productos SET stock_actual = ? WHERE id = ?", [stockNuevo, productoId]);

        const { tasa } = BCVManager.getTasaActual();
        db.run(`
            INSERT INTO kardex (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_unitario_usd, tasa_bcv_momento, referencia_documento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [productoId, tipo, cantNum, stockAnt, stockNuevo, prod.costo_usd, tasa, motivo || 'AJUSTE_MANUAL']);

        return { productoId, stockAnterior: stockAnt, stockNuevo };
    }

    static getKardex(productoId) {
        return db.query(`
            SELECT k.*, p.descripcion, p.codigo_barra
            FROM kardex k
            JOIN productos p ON k.producto_id = p.id
            WHERE k.producto_id = ?
            ORDER BY k.id DESC
        `, [productoId]);
    }

    static getAlertasStock() {
        return db.query(`
            SELECT * FROM productos 
            WHERE stock_actual <= stock_minimo AND activo = 1 
            ORDER BY stock_actual ASC
        `);
    }

    static getCategorias() {
        return db.query("SELECT * FROM categorias ORDER BY nombre ASC");
    }
}

module.exports = InventarioService;

