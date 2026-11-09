/**
 * Motor Fiscal de Venezuela (SENIAT) para MeDIa
 * Conforme a la Providencia SNAT/2011/00071, Providencia 0141 y Providencia SNAT/2022/000013 (IGTF)
 */

const ALICUOTAS_IVA = {
    'G': { nombre: 'General', porcentaje: 16.0, factor: 0.16 },
    'R': { nombre: 'Reducida', porcentaje: 8.0, factor: 0.08 },
    'A': { nombre: 'Adicional/Suntuaria', porcentaje: 31.0, factor: 0.31 },
    'E': { nombre: 'Exento/Exonerado', porcentaje: 0.0, factor: 0.0 }
};

const PORCENTAJE_IGTF_DEFAULT = 3.0; // 3%

class FiscalEngine {
    /**
     * Calcula los totales de una lista de ítems con sus respectivas alícuotas
     * @param {Array} items - [{ alicuota_iva: 'G'|'R'|'A'|'E', cantidad, precio_unitario_usd }]
     * @param {number} tasaBcv - Tasa BCV fijada para la operación
     */
    static calcularTotalesVenta(items, tasaBcv) {
        let subtotalExentoVes = 0;
        let baseGeneralVes = 0;
        let ivaGeneralVes = 0;
        let baseReducidaVes = 0;
        let ivaReducidaVes = 0;
        let baseAdicionalVes = 0;
        let ivaAdicionalVes = 0;

        let totalVentaUsd = 0;

        const itemsCalculados = items.map(item => {
            const alic = ALICUOTAS_IVA[item.alicuota_iva] || ALICUOTAS_IVA['G'];
            const cant = Number(item.cantidad);
            const precioUsd = Number(item.precio_unitario_usd);
            const subtotalUsd = cant * precioUsd;
            totalVentaUsd += subtotalUsd;

            const precioVes = Math.round((precioUsd * tasaBcv) * 100) / 100;
            const subtotalItemVes = Math.round((cant * precioVes) * 100) / 100;
            const ivaItemVes = Math.round((subtotalItemVes * alic.factor) * 100) / 100;
            const totalItemVes = Math.round((subtotalItemVes + ivaItemVes) * 100) / 100;

            if (item.alicuota_iva === 'E') {
                subtotalExentoVes += subtotalItemVes;
            } else if (item.alicuota_iva === 'R') {
                baseReducidaVes += subtotalItemVes;
                ivaReducidaVes += ivaItemVes;
            } else if (item.alicuota_iva === 'A') {
                baseAdicionalVes += subtotalItemVes;
                ivaAdicionalVes += ivaItemVes;
            } else {
                baseGeneralVes += subtotalItemVes;
                ivaGeneralVes += ivaItemVes;
            }

            return {
                ...item,
                precio_unitario_ves: precioVes,
                subtotal_ves: subtotalItemVes,
                iva_ves: ivaItemVes,
                total_ves: totalItemVes
            };
        });

        // Totales consolidados en VES
        subtotalExentoVes = Math.round(subtotalExentoVes * 100) / 100;
        baseGeneralVes = Math.round(baseGeneralVes * 100) / 100;
        ivaGeneralVes = Math.round(ivaGeneralVes * 100) / 100;
        baseReducidaVes = Math.round(baseReducidaVes * 100) / 100;
        ivaReducidaVes = Math.round(ivaReducidaVes * 100) / 100;
        baseAdicionalVes = Math.round(baseAdicionalVes * 100) / 100;
        ivaAdicionalVes = Math.round(ivaAdicionalVes * 100) / 100;

        const totalIvaVes = Math.round((ivaGeneralVes + ivaReducidaVes + ivaAdicionalVes) * 100) / 100;
        const totalVentaVes = Math.round((subtotalExentoVes + baseGeneralVes + baseReducidaVes + baseAdicionalVes + totalIvaVes) * 100) / 100;
        totalVentaUsd = Math.round(totalVentaUsd * 100) / 100;

        return {
            items: itemsCalculados,
            subtotalExentoVes,
            baseGeneralVes,
            ivaGeneralVes,
            baseReducidaVes,
            ivaReducidaVes,
            baseAdicionalVes,
            ivaAdicionalVes,
            totalIvaVes,
            totalVentaVes,
            totalVentaUsd
        };
    }

    /**
     * Evalúa los métodos de pago y calcula la percepción del 3% de IGTF
     * si la empresa es Sujeto Pasivo Especial y el pago es en divisas
     * @param {Array} pagos - [{ metodo_pago, moneda: 'USD'|'VES', monto_original, tasa_cambio }]
     * @param {boolean} esAgentePercepcion - Si está obligado por el SENIAT
     * @param {number} totalFacturaVes - Monto total antes de IGTF
     */
    static calcularIGTFYPagos(pagos, esAgentePercepcion, totalFacturaVes, tasaBcv) {
        let montoPagadoDivisasUsd = 0;
        let baseIgtfVes = 0;
        let montoIgtfVes = 0;
        let totalPagadoVes = 0;

        const metodosEnDivisa = ['EFECTIVO_USD', 'EFECTIVO_EUR', 'ZELLE', 'BANESCO_PANAMA', 'BINANCE_PAY', 'PAYPAL'];

        const pagosProcesados = pagos.map(p => {
            const esDivisa = p.moneda === 'USD' || metodosEnDivisa.includes(p.metodo_pago);
            const tasa = p.tasa_cambio || tasaBcv;
            let montoVes = 0;

            if (esDivisa) {
                montoPagadoDivisasUsd += Number(p.monto_original);
                montoVes = Math.round((Number(p.monto_original) * tasa) * 100) / 100;
            } else {
                montoVes = Math.round(Number(p.monto_original) * 100) / 100;
            }

            totalPagadoVes += montoVes;

            let igtfItemVes = 0;
            let generaIgtf = 0;

            if (esAgentePercepcion && esDivisa) {
                generaIgtf = 1;
                // El IGTF es 3% sobre el monto pagado en divisas equivalente en Bs
                igtfItemVes = Math.round((montoVes * (PORCENTAJE_IGTF_DEFAULT / 100)) * 100) / 100;
                baseIgtfVes += montoVes;
                montoIgtfVes += igtfItemVes;
            }

            return {
                ...p,
                moneda: esDivisa ? 'USD' : 'VES',
                monto_equivalente_ves: montoVes,
                genera_igtf: generaIgtf,
                monto_igtf_ves: igtfItemVes
            };
        });

        baseIgtfVes = Math.round(baseIgtfVes * 100) / 100;
        montoIgtfVes = Math.round(montoIgtfVes * 100) / 100;
        const totalFinalConIgtfVes = Math.round((totalFacturaVes + montoIgtfVes) * 100) / 100;

        return {
            pagos: pagosProcesados,
            montoPagadoDivisasUsd: Math.round(montoPagadoDivisasUsd * 100) / 100,
            baseIgtfVes,
            montoIgtfVes,
            totalPagadoVes: Math.round(totalPagadoVes * 100) / 100,
            totalFinalConIgtfVes
        };
    }
}

module.exports = FiscalEngine;
module.exports.ALICUOTAS_IVA = ALICUOTAS_IVA;

