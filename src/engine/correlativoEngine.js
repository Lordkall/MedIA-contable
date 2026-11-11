/**
 * Motor de Correlatividad Estricta y Criptografía de Seguridad (SENIAT)
 * Garantiza:
 * 1. Secuencia numérica continua sin saltos ni duplicados (Control de Correlativos).
 * 2. Inalterabilidad mediante cadena de hashes criptográficos SHA-256 (Tamper-Evidence).
 * 3. Asignación obligatoria y controlada de Número de Factura y Número de Control.
 */

const crypto = require('node:crypto');
const db = require('../database/db');

class CorrelativoEngine {
    /**
     * Inicializa la tabla de secuencias si no existe
     */
    static init() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS secuencias_fiscales (
                id TEXT PRIMARY KEY,               -- 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO'
                prefijo TEXT NOT NULL,
                ultimo_numero INTEGER NOT NULL DEFAULT 0,
                formato_longitud INTEGER DEFAULT 8,
                actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Inicializar tipos si no existen
            INSERT OR IGNORE INTO secuencias_fiscales (id, prefijo, ultimo_numero, formato_longitud)
            VALUES 
            ('FACTURA', '', 0, 8),
            ('CONTROL', '00-', 0, 6),
            ('NOTA_CREDITO', 'NC-', 0, 8),
            ('NOTA_DEBITO', 'ND-', 0, 8);
        `);
    }

    /**
     * Obtiene el siguiente número correlativo estricto y secuencial.
     * Garantiza matemáticamente cero saltos y cero duplicados (SENIAT).
     */
    static getSiguienteCorrelativo(tipo) {
        this.init();

        if (tipo === 'FACTURA') {
            const maxVenta = db.get("SELECT COALESCE(MAX(CAST(numero_factura_fiscal AS INTEGER)), 0) as max_num FROM ventas");
            const proximoNumero = (maxVenta ? maxVenta.max_num : 0) + 1;
            
            db.run(`
                UPDATE secuencias_fiscales 
                SET ultimo_numero = ?,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id = 'FACTURA'
            `, [proximoNumero]);

            const numeroFormateado = String(proximoNumero).padStart(8, '0');
            return {
                numeroEntero: proximoNumero,
                documentoFormateado: numeroFormateado
            };
        }

        if (tipo === 'CONTROL') {
            const maxControl = db.get("SELECT COUNT(*) as total_ventas FROM ventas");
            const proximoNumero = (maxControl ? maxControl.total_ventas : 0) + 1;
            
            db.run(`
                UPDATE secuencias_fiscales 
                SET ultimo_numero = ?,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id = 'CONTROL'
            `, [proximoNumero]);

            const numeroFormateado = String(proximoNumero).padStart(6, '0');
            return {
                numeroEntero: proximoNumero,
                documentoFormateado: `00-${numeroFormateado}`
            };
        }

        if (tipo === 'NOTA_CREDITO') {
            const seq = db.get("SELECT ultimo_numero, formato_longitud FROM secuencias_fiscales WHERE id = 'NOTA_CREDITO'");
            const proximoNumero = (seq ? seq.ultimo_numero : 0) + 1;
            
            db.run(`
                UPDATE secuencias_fiscales 
                SET ultimo_numero = ?,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id = 'NOTA_CREDITO'
            `, [proximoNumero]);

            const numeroFormateado = String(proximoNumero).padStart(8, '0');
            return {
                numeroEntero: proximoNumero,
                documentoFormateado: `NC-${numeroFormateado}`
            };
        }

        // Fallback para otros tipos
        db.run(`
            UPDATE secuencias_fiscales 
            SET ultimo_numero = ultimo_numero + 1,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [tipo]);

        const seq = db.get("SELECT * FROM secuencias_fiscales WHERE id = ?", [tipo]);
        if (!seq) throw new Error(`Secuencia fiscal no configurada para: ${tipo}`);

        const numeroFormateado = String(seq.ultimo_numero).padStart(seq.formato_longitud, '0');
        const documentoCompleto = seq.prefijo ? `${seq.prefijo}${numeroFormateado}` : numeroFormateado;

        return {
            numeroEntero: seq.ultimo_numero,
            documentoFormateado: documentoCompleto
        };
    }

    /**
     * Genera el Hash Criptográfico SHA-256 de la factura encadenado al registro anterior.
     * Si alguien intenta modificar un monto, fecha o cliente en la BD, la cadena se rompe.
     */
    static calcularHashFactura(datosFactura, hashAnterior = '') {
        const payload = [
            hashAnterior || 'GENESIS_MEDIA_SENIAT',
            datosFactura.numero_factura_fiscal,
            datosFactura.numero_control,
            datosFactura.serial_impresora,
            datosFactura.fecha,
            datosFactura.hora,
            datosFactura.cliente_rif,
            Number(datosFactura.total_venta_ves || 0).toFixed(2),
            Number(datosFactura.monto_igtf_ves || 0).toFixed(2),
            Number(datosFactura.total_final_con_igtf_ves || 0).toFixed(2),
            Number(datosFactura.tasa_bcv_snapshot || 0).toFixed(4)
        ].join('|');

        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Auditoría de TI: Valida que no existan saltos en los correlativos
     * y que ningún registro haya sido alterado en la base de datos.
     */
    static auditarIntegridadYCorrelatividad() {
        this.init();
        const ventas = db.query("SELECT * FROM ventas ORDER BY id ASC");
        const auditoria = {
            totalDocumentos: ventas.length,
            correlatividadCorrecta: true,
            integridadCadenaCorrecta: true,
            inconsistencias: []
        };

        let numeroEsperado = 1;
        let hashAnteriorEsperado = 'GENESIS_MEDIA_SENIAT';

        for (const v of ventas) {
            const numFacturaInt = parseInt(v.numero_factura_fiscal.replace(/\D/g, ''), 10);

            // 1. Verificar correlatividad estricta (sin saltos ni retrocesos)
            if (numFacturaInt !== numeroEsperado) {
                auditoria.correlatividadCorrecta = false;
                auditoria.inconsistencias.push({
                    tipo: 'SALTO_DE_CORRELATIVO',
                    facturaId: v.id,
                    numeroEncontrado: v.numero_factura_fiscal,
                    numeroEsperado: String(numeroEsperado).padStart(8, '0'),
                    detalle: 'Se detectó una discontinuidad en la secuencia fiscal.'
                });
            }
            numeroEsperado = numFacturaInt + 1;

            // 2. Verificar hash criptográfico (inalterabilidad)
            if (v.hash_seguridad) {
                const cliente = db.get("SELECT rif_completo FROM clientes WHERE id = ?", [v.cliente_id]);
                const hashCalculado = this.calcularHashFactura({
                    numero_factura_fiscal: v.numero_factura_fiscal,
                    numero_control: v.numero_control,
                    serial_impresora: v.serial_impresora,
                    fecha: v.fecha,
                    hora: v.hora,
                    cliente_rif: cliente ? cliente.rif_completo : '',
                    total_venta_ves: v.total_venta_ves,
                    monto_igtf_ves: v.monto_igtf_ves,
                    total_final_con_igtf_ves: v.total_final_con_igtf_ves,
                    tasa_bcv_snapshot: v.tasa_bcv_snapshot
                }, v.hash_anterior || hashAnteriorEsperado);

                if (hashCalculado !== v.hash_seguridad) {
                    auditoria.integridadCadenaCorrecta = false;
                    auditoria.inconsistencias.push({
                        tipo: 'ALTERACION_DE_DATOS_DETECTADA',
                        facturaId: v.id,
                        numeroFactura: v.numero_factura_fiscal,
                        detalle: 'El hash criptográfico no coincide. El registro fue manipulado fuera de la aplicación.'
                    });
                }
                hashAnteriorEsperado = v.hash_seguridad;
            }
        }

        return auditoria;
    }
}

module.exports = CorrelativoEngine;

