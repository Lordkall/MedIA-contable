/**
 * Capa de Abstracción de Hardware Fiscal (HAL) y Emulador Oficial
 * Conforme a la Providencia SNAT/2018/0141 (Máquinas Fiscales Autorizadas)
 * Compatible con protocolos: The Factory HKA, Bixolon, Epson y Dascom.
 */

const BCVManager = require('./bcv');

class FiscalPrinter {
    constructor(config = {}) {
        this.serial = config.serial || 'HKA00098765';
        this.modelo = config.modelo || 'The Factory HKA / Bixolon SRP-350';
        this.razonSocial = config.razonSocial || 'COMERCIAL MeDIa, C.A.';
        this.rif = config.rif || 'J-50123456-6';
        this.direccion = config.direccion || 'Av. Principal, Edif. MeDIa, Caracas, Venezuela';
    }

    /**
     * Genera el formato de texto térmico exacto de un TICKET FISCAL SENIAT
     */
    generarTicketFiscal(venta, cliente, items, pagos) {
        const lineaSep = '------------------------------------------------';
        const lineaDoble = '================================================';

        const lineas = [];
        lineas.push(lineaDoble);
        lineas.push(this.centrar(this.razonSocial));
        lineas.push(this.centrar(`RIF: ${this.rif}`));
        lineas.push(this.centrar(this.direccion));
        lineas.push(this.centrar(`SERIAL FISCAL: ${this.serial}`));
        lineas.push(lineaDoble);
        lineas.push(`FACTURA FISCAL NRO: ${venta.numero_factura_fiscal.padStart(8, '0')}`);
        lineas.push(`NUMERO DE CONTROL:  ${(venta.numero_control || '00-001234').padStart(8, '0')}`);
        lineas.push(`FECHA: ${venta.fecha}   HORA: ${venta.hora}`);
        lineas.push(lineaSep);
        lineas.push(`CLIENTE: ${cliente.razon_social}`);
        lineas.push(`RIF/CI:  ${cliente.rif_completo}`);
        if (cliente.direccion) lineas.push(`DIR:     ${cliente.direccion}`);
        lineas.push(lineaSep);
        lineas.push('CANT  DESCRIPCION             ALIC.     TOTAL BS.');
        lineas.push(lineaSep);

        items.forEach(it => {
            const cantStr = Number(it.cantidad).toFixed(2).padStart(5, ' ');
            const desc = it.descripcion.padEnd(20, ' ').substring(0, 20);
            const alicStr = `(${it.alicuota_iva})`.padEnd(4, ' ');
            const totalStr = BCVManager.formatVES(it.total_ves).padStart(15, ' ');
            lineas.push(`${cantStr} ${desc} ${alicStr} ${totalStr}`);
        });

        lineas.push(lineaSep);
        lineas.push(`SUBTOTAL EXENTO (E):            ${BCVManager.formatVES(venta.subtotal_exento_ves).padStart(16, ' ')}`);
        if (venta.base_general_ves > 0) {
            lineas.push(`BASE IMPONIBLE (G 16%):         ${BCVManager.formatVES(venta.base_general_ves).padStart(16, ' ')}`);
            lineas.push(`IMPUESTO IVA (G 16%):           ${BCVManager.formatVES(venta.iva_general_ves).padStart(16, ' ')}`);
        }
        if (venta.base_reducida_ves > 0) {
            lineas.push(`BASE IMPONIBLE (R 8%):          ${BCVManager.formatVES(venta.base_reducida_ves).padStart(16, ' ')}`);
            lineas.push(`IMPUESTO IVA (R 8%):            ${BCVManager.formatVES(venta.iva_reducida_ves).padStart(16, ' ')}`);
        }
        if (venta.base_adicional_ves > 0) {
            lineas.push(`BASE IMPONIBLE (A 31%):         ${BCVManager.formatVES(venta.base_adicional_ves).padStart(16, ' ')}`);
            lineas.push(`IMPUESTO IVA (A 31%):           ${BCVManager.formatVES(venta.iva_adicional_ves).padStart(16, ' ')}`);
        }
        lineas.push(lineaSep);
        lineas.push(`TOTAL FACTURA:                  ${BCVManager.formatVES(venta.total_venta_ves).padStart(16, ' ')}`);

        // Desglose de IGTF según Providencia 000013
        if (venta.monto_igtf_ves > 0) {
            lineas.push(lineaSep);
            lineas.push('*** PERCEPCION IGTF (PROVIDENCIA SNAT/2022/000013) ***');
            lineas.push(`BASE IGTF (PAGOS DIVISAS):      ${BCVManager.formatVES(venta.base_igtf_ves).padStart(16, ' ')}`);
            lineas.push(`ALICUOTA IGTF (3%):             ${BCVManager.formatVES(venta.monto_igtf_ves).padStart(16, ' ')}`);
            lineas.push(lineaSep);
            lineas.push(`TOTAL A PAGAR (CON IGTF):       ${BCVManager.formatVES(venta.total_final_con_igtf_ves).padStart(16, ' ')}`);
        }

        lineas.push(lineaSep);
        lineas.push('MEDIOS DE PAGO:');
        pagos.forEach(p => {
            const metodo = p.metodo_pago.replace('_', ' ').padEnd(16, ' ');
            const montoOrig = p.moneda === 'USD' 
                ? `${BCVManager.formatUSD(p.monto_original)} (Bs. ${p.monto_equivalente_ves.toFixed(2)})`
                : BCVManager.formatVES(p.monto_original);
            lineas.push(` • ${metodo}: ${montoOrig}`);
        });

        lineas.push(lineaSep);
        lineas.push(`TASA OFICIAL BCV DEL DIA: ${venta.tasa_bcv_snapshot.toFixed(4)} Bs/USD`);
        lineas.push(`TOTAL EN DIVISAS REFERENCIAL: ${BCVManager.formatUSD(venta.total_venta_usd)}`);
        lineas.push(lineaDoble);
        lineas.push(this.centrar('*** COMPROBANTE FISCAL ***'));
        lineas.push(this.centrar('GRACIAS POR SU COMPRA'));
        lineas.push(lineaDoble);

        return lineas.join('\n');
    }

    /**
     * Genera el formato térmico exacto de una NOTA DE CRÉDITO FISCAL SENIAT (Devolución)
     */
    generarNotaCreditoFiscal(ncData, facturaOriginal, cliente, itemsDevueltos) {
        const lineaSep = '------------------------------------------------';
        const lineaDoble = '================================================';

        const lineas = [];
        lineas.push(lineaDoble);
        lineas.push(this.centrar(this.razonSocial));
        lineas.push(this.centrar(`RIF: ${this.rif}`));
        lineas.push(this.centrar(this.direccion));
        lineas.push(this.centrar(`SERIAL FISCAL: ${this.serial}`));
        lineas.push(lineaDoble);
        lineas.push(this.centrar('*** NOTA DE CREDITO FISCAL ***'));
        lineas.push(`NOTA DE CREDITO NRO:  ${ncData.numero_nc.padStart(8, '0')}`);
        lineas.push(`FACTURA AFECTADA NRO: ${facturaOriginal.numero_factura_fiscal.padStart(8, '0')}`);
        lineas.push(`FECHA FACTURA AFECT.: ${facturaOriginal.fecha}`);
        lineas.push(`SERIAL MAQ. AFECTADA: ${facturaOriginal.serial_impresora}`);
        lineas.push(`FECHA NC: ${ncData.fecha}   HORA: ${ncData.hora}`);
        lineas.push(lineaSep);
        lineas.push(`CLIENTE: ${cliente.razon_social}`);
        lineas.push(`RIF/CI:  ${cliente.rif_completo}`);
        lineas.push(lineaSep);
        lineas.push('CANT  DESCRIPCION             ALIC.     TOTAL BS.');
        lineas.push(lineaSep);

        itemsDevueltos.forEach(it => {
            const cantStr = Number(it.cantidad).toFixed(2).padStart(5, ' ');
            const desc = it.descripcion.padEnd(20, ' ').substring(0, 20);
            const alicStr = `(${it.alicuota_iva})`.padEnd(4, ' ');
            const totalStr = BCVManager.formatVES(it.total_ves).padStart(15, ' ');
            lineas.push(`${cantStr} ${desc} ${alicStr} ${totalStr}`);
        });

        lineas.push(lineaSep);
        lineas.push(`MONTO TOTAL DEVUELTO:           ${BCVManager.formatVES(ncData.total_devuelto_ves).padStart(16, ' ')}`);
        lineas.push(`TOTAL DIVISAS DEVUELTO REF.:    ${BCVManager.formatUSD(ncData.total_devuelto_usd)}`);
        lineas.push(lineaDoble);
        lineas.push(this.centrar('MERCANCIA REINGRESADA AL INVENTARIO'));
        lineas.push(this.centrar('*** COMPROBANTE FISCAL DE DEVOLUCION ***'));
        lineas.push(lineaDoble);

        return lineas.join('\n');
    }

    /**
     * Emite un Reporte X (Lectura Parcial de Caja)
     */
    generarReporteX(resumen) {
        const lineas = [
            '================================================',
            this.centrar(this.razonSocial),
            this.centrar(`RIF: ${this.rif}`),
            this.centrar(`SERIAL: ${this.serial}`),
            '================================================',
            this.centrar('*** REPORTE X (LECTURA DE AUDITORIA) ***'),
            `FECHA: ${new Date().toLocaleDateString('es-VE')}   HORA: ${new Date().toLocaleTimeString('es-VE')}`,
            '------------------------------------------------',
            `CANTIDAD FACTURAS HOY:          ${String(resumen.totalFacturas).padStart(16, ' ')}`,
            `VENTAS EXENTAS (E):             ${BCVManager.formatVES(resumen.exentoVes).padStart(16, ' ')}`,
            `BASE GENERAL (G 16%):           ${BCVManager.formatVES(resumen.baseGeneralVes).padStart(16, ' ')}`,
            `TOTAL IVA GENERAL:              ${BCVManager.formatVES(resumen.ivaGeneralVes).padStart(16, ' ')}`,
            `PERCEPCION IGTF (3%):           ${BCVManager.formatVES(resumen.igtfVes).padStart(16, ' ')}`,
            '------------------------------------------------',
            `TOTAL VENTAS EN BOLIVARES:      ${BCVManager.formatVES(resumen.totalVes).padStart(16, ' ')}`,
            `TOTAL DIVISAS CAPTURADAS:       ${BCVManager.formatUSD(resumen.totalUsd).padStart(16, ' ')}`,
            '================================================',
            this.centrar('*** FIN DE REPORTE X ***')
        ];
        return lineas.join('\n');
    }

    /**
     * Emite un Cierre Z Diario (Cierre Definitivo de Máquina Fiscal)
     */
    generarReporteZ(numeroZ, resumen) {
        const lineas = [
            '================================================',
            this.centrar(this.razonSocial),
            this.centrar(`RIF: ${this.rif}`),
            this.centrar(`SERIAL FISCAL: ${this.serial}`),
            '================================================',
            this.centrar(`*** CIERRE Z DIARIO NRO: ${String(numeroZ).padStart(4, '0')} ***`),
            `FECHA: ${new Date().toLocaleDateString('es-VE')}   HORA: ${new Date().toLocaleTimeString('es-VE')}`,
            '------------------------------------------------',
            `ULTIMA FACTURA EMITIDA:         ${String(resumen.ultimaFactura).padStart(16, ' ')}`,
            `TOTAL FACTURAS PROCESADAS:      ${String(resumen.totalFacturas).padStart(16, ' ')}`,
            `VENTAS EXENTAS (E):             ${BCVManager.formatVES(resumen.exentoVes).padStart(16, ' ')}`,
            `BASE IMPONIBLE (G 16%):         ${BCVManager.formatVES(resumen.baseGeneralVes).padStart(16, ' ')}`,
            `IMPUESTO IVA RECAUDADO (16%):   ${BCVManager.formatVES(resumen.ivaGeneralVes).padStart(16, ' ')}`,
            `IGTF PERCIBIDO (3% DIVISAS):    ${BCVManager.formatVES(resumen.igtfVes).padStart(16, ' ')}`,
            '------------------------------------------------',
            `TOTAL RECAUDACION FISCAL (VES): ${BCVManager.formatVES(resumen.totalVes).padStart(16, ' ')}`,
            '================================================',
            this.centrar('MEMORIA FISCAL ACTUALIZADA'),
            this.centrar('DISPOSITIVO DFE: TRANSMISION LISTA'),
            '================================================'
        ];
        return lineas.join('\n');
    }

    centrar(texto, ancho = 48) {
        if (!texto) return '';
        const pad = Math.max(0, Math.floor((ancho - texto.length) / 2));
        return ' '.repeat(pad) + texto;
    }
}

module.exports = FiscalPrinter;
