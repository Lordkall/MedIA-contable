/**
 * Manejador de Tasa Oficial del Banco Central de Venezuela (BCV)
 * y funciones de conversión y formateo bimonetario.
 */

const db = require('../database/db');

class BCVManager {
    /**
     * Obtiene la tasa activa más reciente
     */
    static getTasaActual() {
        const row = db.get("SELECT tasa, fecha FROM tasa_cambio ORDER BY id DESC LIMIT 1");
        if (row) {
            return {
                tasa: row.tasa,
                fecha: row.fecha
            };
        }
        // Tasa por defecto si la base de datos está vacía
        return { tasa: 65.50, fecha: new Date().toISOString().split('T')[0] };
    }

    /**
     * Registra una nueva tasa oficial del BCV
     */
    static registrarTasa(nuevaTasa, fecha = null) {
        const fechaTasa = fecha || new Date().toISOString().split('T')[0];
        const tasaNum = parseFloat(nuevaTasa);
        if (isNaN(tasaNum) || tasaNum <= 0) {
            throw new Error("La tasa debe ser un número positivo mayor que cero");
        }

        db.run(
            "INSERT INTO tasa_cambio (fecha, moneda_origen, moneda_destino, tasa, es_tasa_bcv) VALUES (?, 'USD', 'VES', ?, 1)",
            [fechaTasa, tasaNum]
        );

        return { tasa: tasaNum, fecha: fechaTasa };
    }

    /**
     * Convierte de USD a VES usando la tasa dada o la actual
     */
    static usdToVes(montoUsd, tasa = null) {
        const t = tasa || this.getTasaActual().tasa;
        return Math.round((montoUsd * t) * 100) / 100;
    }

    /**
     * Convierte de VES a USD usando la tasa dada o la actual
     */
    static vesToUsd(montoVes, tasa = null) {
        const t = tasa || this.getTasaActual().tasa;
        if (t <= 0) return 0;
        return Math.round((montoVes / t) * 100) / 100;
    }

    /**
     * Formateador estándar venezolano: Bs. 1.234,56
     */
    static formatVES(monto) {
        const num = Number(monto) || 0;
        return 'Bs. ' + num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Formateador en divisas: $ 1,234.56
     */
    static formatUSD(monto) {
        const num = Number(monto) || 0;
        return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

module.exports = BCVManager;

