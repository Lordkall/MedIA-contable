/**
 * Servicio de Clientes y Proveedores para MeDIa
 * Con validación algorítmica de RIF del SENIAT
 */

const db = require('../database/db');
const { validarRIF } = require('../engine/rif');

class TercerosService {
    // === CLIENTES ===
    static getClientes(busqueda = '') {
        if (!busqueda) {
            return db.query("SELECT * FROM clientes ORDER BY id DESC LIMIT 100");
        }
        const term = `%${busqueda}%`;
        return db.query(`
            SELECT * FROM clientes 
            WHERE razon_social LIKE ? OR rif_completo LIKE ? OR numero_documento LIKE ?
            ORDER BY razon_social ASC
        `, [term, term, term]);
    }

    static crearCliente(datos) {
        const { tipo_documento, numero_documento, digito_verificador, razon_social, direccion, telefono, email, tipo_contribuyente } = datos;

        const rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador !== undefined ? digito_verificador : ''}`;
        
        // Si no es el consumidor final genérico, validar RIF
        if (numero_documento !== '00000000') {
            const resVal = validarRIF(rifCompleto);
            if (!resVal.valido) {
                throw new Error(`RIF Inválido según el SENIAT: ${resVal.error}`);
            }
        }

        const res = db.run(`
            INSERT INTO clientes (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, email, tipo_contribuyente)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tipo_documento.toUpperCase(),
            numero_documento,
            rifCompleto.toUpperCase(),
            razon_social.toUpperCase(),
            direccion || '',
            telefono || '',
            email || '',
            tipo_contribuyente || 'ORDINARIO'
        ]);

        return db.get("SELECT * FROM clientes WHERE id = ?", [res.lastInsertRowid]);
    }

    // === PROVEEDORES ===
    static getProveedores(busqueda = '') {
        if (!busqueda) {
            return db.query("SELECT * FROM proveedores ORDER BY razon_social ASC");
        }
        const term = `%${busqueda}%`;
        return db.query(`
            SELECT * FROM proveedores 
            WHERE razon_social LIKE ? OR rif_completo LIKE ? 
            ORDER BY razon_social ASC
        `, [term, term]);
    }

    static crearProveedor(datos) {
        const { tipo_documento, numero_documento, digito_verificador, razon_social, direccion, telefono, email, porcentaje_retencion_iva, porcentaje_retencion_islr } = datos;

        const rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador !== undefined ? digito_verificador : ''}`;
        const resVal = validarRIF(rifCompleto);
        if (!resVal.valido) {
            throw new Error(`RIF de Proveedor Inválido según el SENIAT: ${resVal.error}`);
        }

        const res = db.run(`
            INSERT INTO proveedores (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, email, porcentaje_retencion_iva, porcentaje_retencion_islr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tipo_documento.toUpperCase(),
            numero_documento,
            rifCompleto.toUpperCase(),
            razon_social.toUpperCase(),
            direccion || '',
            telefono || '',
            email || '',
            Number(porcentaje_retencion_iva) || 75.0,
            Number(porcentaje_retencion_islr) || 2.0
        ]);

        return db.get("SELECT * FROM proveedores WHERE id = ?", [res.lastInsertRowid]);
    }
}

module.exports = TercerosService;

