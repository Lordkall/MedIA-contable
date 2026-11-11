/**
 * Servicio de Clientes y Proveedores para MeDIa
 * Con validación algorítmica de RIF del SENIAT
 */

const db = require('../database/db');
const { validarRIF, calcularDigitoRIF } = require('../engine/rif');

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
        let { tipo_documento, numero_documento, digito_verificador, razon_social, direccion, telefono, email, tipo_contribuyente } = datos;

        tipo_documento = (tipo_documento || 'V').toUpperCase().trim();
        numero_documento = String(numero_documento || '').replace(/[^0-9]/g, '');

        if (!numero_documento) throw new Error("El número de documento o cédula es obligatorio");
        if (!razon_social || !razon_social.trim()) throw new Error("El nombre o razón social es obligatorio");

        // Si no se proporcionó dígito verificador, calcularlo con el algoritmo Módulo 11 del SENIAT
        if (digito_verificador === undefined || digito_verificador === null || String(digito_verificador).trim() === '') {
            digito_verificador = calcularDigitoRIF(tipo_documento, numero_documento);
        }

        let rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador}`;
        
        // Si no es el consumidor final genérico, validar RIF
        if (numero_documento !== '00000000') {
            const resVal = validarRIF(rifCompleto);
            if (!resVal.valido) {
                // Si el cálculo da otro dígito, corregir automáticamente
                if (resVal.digitoCalculado !== undefined) {
                    digito_verificador = resVal.digitoCalculado;
                    rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador}`;
                } else {
                    throw new Error(`RIF Inválido según el SENIAT: ${resVal.error}`);
                }
            }
        }

        // Si el cliente ya existe por RIF o cédula, actualizarlo y retornarlo
        const existente = db.get("SELECT * FROM clientes WHERE rif_completo = ? OR (tipo_documento = ? AND numero_documento = ?)", [rifCompleto, tipo_documento, numero_documento]);
        if (existente) {
            db.run(`
                UPDATE clientes SET 
                    razon_social = ?, 
                    direccion = ?, 
                    telefono = ?, 
                    email = ?, 
                    tipo_contribuyente = ?,
                    rif_completo = ?
                WHERE id = ?
            `, [
                razon_social.toUpperCase().trim(),
                direccion || existente.direccion || '',
                telefono || existente.telefono || '',
                email || existente.email || '',
                tipo_contribuyente || existente.tipo_contribuyente || 'ORDINARIO',
                rifCompleto.toUpperCase(),
                existente.id
            ]);
            return db.get("SELECT * FROM clientes WHERE id = ?", [existente.id]);
        }

        const res = db.run(`
            INSERT INTO clientes (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, email, tipo_contribuyente)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tipo_documento.toUpperCase(),
            numero_documento,
            rifCompleto.toUpperCase(),
            razon_social.toUpperCase().trim(),
            direccion || 'Ciudad',
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
        let { tipo_documento, numero_documento, digito_verificador, razon_social, direccion, telefono, email, porcentaje_retencion_iva, porcentaje_retencion_islr } = datos;

        tipo_documento = (tipo_documento || 'J').toUpperCase().trim();
        numero_documento = String(numero_documento || '').replace(/[^0-9]/g, '');

        if (!numero_documento) throw new Error("El número de RIF del proveedor es obligatorio");
        if (!razon_social || !razon_social.trim()) throw new Error("La razón social del proveedor es obligatoria");

        if (digito_verificador === undefined || digito_verificador === null || String(digito_verificador).trim() === '') {
            digito_verificador = calcularDigitoRIF(tipo_documento, numero_documento);
        }

        let rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador}`;
        const resVal = validarRIF(rifCompleto);
        if (!resVal.valido) {
            if (resVal.digitoCalculado !== undefined) {
                digito_verificador = resVal.digitoCalculado;
                rifCompleto = `${tipo_documento}-${numero_documento}-${digito_verificador}`;
            } else {
                throw new Error(`RIF de Proveedor Inválido según el SENIAT: ${resVal.error}`);
            }
        }

        const existente = db.get("SELECT * FROM proveedores WHERE rif_completo = ? OR (tipo_documento = ? AND numero_documento = ?)", [rifCompleto, tipo_documento, numero_documento]);
        if (existente) {
            db.run(`
                UPDATE proveedores SET
                    razon_social = ?, direccion = ?, telefono = ?, email = ?,
                    porcentaje_retencion_iva = ?, porcentaje_retencion_islr = ?, rif_completo = ?
                WHERE id = ?
            `, [
                razon_social.toUpperCase().trim(),
                direccion || existente.direccion || '',
                telefono || existente.telefono || '',
                email || existente.email || '',
                Number(porcentaje_retencion_iva) || existente.porcentaje_retencion_iva || 75.0,
                Number(porcentaje_retencion_islr) || existente.porcentaje_retencion_islr || 2.0,
                rifCompleto.toUpperCase(),
                existente.id
            ]);
            return db.get("SELECT * FROM proveedores WHERE id = ?", [existente.id]);
        }

        const res = db.run(`
            INSERT INTO proveedores (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, email, porcentaje_retencion_iva, porcentaje_retencion_islr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tipo_documento.toUpperCase(),
            numero_documento,
            rifCompleto.toUpperCase(),
            razon_social.toUpperCase().trim(),
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

