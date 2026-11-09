/**
 * Manejador de Tasa Oficial del Banco Central de Venezuela (BCV)
 * y Sincronizador Automático en Tiempo Real
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
     * Consulta automáticamente la tasa oficial del Banco Central de Venezuela (BCV)
     * mediante endpoints bancarios venezolanos y scraping con múltiples redundancias
     */
    static async sincronizarTasaBCV() {
        const fuentes = [
            {
                url: 'https://ve.dolarapi.com/v1/dolares/oficial',
                parser: (json) => ({
                    tasa: Number(json.promedio),
                    fecha: json.fechaActualizacion ? json.fechaActualizacion.split('T')[0] : null
                })
            },
            {
                url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv',
                parser: (json) => ({
                    tasa: Number(json.monitors?.usd?.price || json.price),
                    fecha: json.monitors?.usd?.last_update ? json.monitors.usd.last_update.split(' ')[0] : null
                })
            }
        ];

        let tasaObtenida = null;
        let fechaObtenida = null;
        let fuenteExitosa = null;

        for (const f of fuentes) {
            try {
                const response = await fetch(f.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    const data = await response.json();
                    const resultado = f.parser(data);
                    if (resultado.tasa && resultado.tasa > 0) {
                        tasaObtenida = resultado.tasa;
                        fechaObtenida = resultado.fecha;
                        fuenteExitosa = f.url;
                        break;
                    }
                }
            } catch (err) {
                // Probar siguiente fuente de respaldo
                console.warn(`[MeDIa BCV Sync] Falló fuente ${f.url}: ${err.message}`);
            }
        }

        if (!tasaObtenida) {
            throw new Error("No se pudo conectar a los servidores del BCV en este momento. Verifique su conexión.");
        }

        const fechaFinal = fechaObtenida || new Date().toISOString().split('T')[0];
        this.registrarTasa(tasaObtenida, fechaFinal);

        console.log(`[MeDIa] Tasa BCV Oficial sincronizada con éxito: Bs. ${tasaObtenida} (${fechaFinal})`);

        return {
            exito: true,
            tasa: tasaObtenida,
            fecha: fechaFinal,
            fuente: 'Banco Central de Venezuela (BCV Oficial)'
        };
    }

    static usdToVes(montoUsd, tasa = null) {
        const t = tasa || this.getTasaActual().tasa;
        return Math.round((montoUsd * t) * 100) / 100;
    }

    static vesToUsd(montoVes, tasa = null) {
        const t = tasa || this.getTasaActual().tasa;
        if (t <= 0) return 0;
        return Math.round((montoVes / t) * 100) / 100;
    }

    static formatVES(monto) {
        const num = Number(monto) || 0;
        return 'Bs. ' + num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    static formatUSD(monto) {
        const num = Number(monto) || 0;
        return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

module.exports = BCVManager;
