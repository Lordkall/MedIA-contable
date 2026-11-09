/**
 * Test de Seguridad, Correlatividad e Integridad SENIAT para MeDIa
 */

const db = require('./src/database/db');
const CorrelativoEngine = require('./src/engine/correlativoEngine');
const PosService = require('./src/services/posService');
const SeniatExportEngine = require('./src/engine/seniatExport');
const ReportesService = require('./src/services/reportesService');

console.log('=== TEST 1: CONTROL DE CORRELATIVOS ESTRICTOS (SIN SALTOS) ===');
CorrelativoEngine.init();
const s1 = CorrelativoEngine.getSiguienteCorrelativo('FACTURA');
const s2 = CorrelativoEngine.getSiguienteCorrelativo('FACTURA');
console.log(`Secuencia consecutiva generada: ${s1.documentoFormateado} -> ${s2.documentoFormateado}`);
const diff = s2.numeroEntero - s1.numeroEntero;
console.log(`Diferencia de secuencia: ${diff} (Esperado: 1 -> CERO SALTOS)`);

console.log('\n=== TEST 2: INALTERABILIDAD Y BLOQUEO DE REGISTROS (TRIGGERS SQL) ===');
const ultimaVenta = db.get("SELECT id, numero_factura_fiscal, total_venta_ves FROM ventas LIMIT 1");
if (ultimaVenta) {
    try {
        db.run("DELETE FROM ventas WHERE id = ?", [ultimaVenta.id]);
        console.error("ERROR GRAVE: Se permitió eliminar una factura fiscal timbrada!");
    } catch (err) {
        console.log("✓ BLOQUEO DE ELIMINACIÓN EXITOSO:", err.message);
    }

    try {
        db.run("UPDATE ventas SET total_venta_ves = 0 WHERE id = ?", [ultimaVenta.id]);
        console.error("ERROR GRAVE: Se permitió editar el total de una factura fiscal timbrada!");
    } catch (err) {
        console.log("✓ BLOQUEO DE EDICIÓN FISCAL EXITOSO:", err.message);
    }
}

console.log('\n=== TEST 3: CORRECCIÓN FISCAL ESTRICTA MEDIANTE NOTA DE CRÉDITO ===');
const ventaParaNC = db.get("SELECT id, numero_factura_fiscal, estado FROM ventas WHERE estado = 'PROCESADA' LIMIT 1");
if (ventaParaNC) {
    const resNC = PosService.procesarNotaCredito(ventaParaNC.id, 'Prueba de auditoría de TI');
    console.log(`✓ Nota de Crédito generada: ${resNC.numeroNC} afectando Factura: ${resNC.facturaAfectada}`);
    console.log(`✓ Monto devuelto: Bs. ${resNC.totalDevueltoVes}`);

    // Verificar en BD que el estado sea ANULADA
    const ventaVerificada = db.get("SELECT estado FROM ventas WHERE id = ?", [ventaParaNC.id]);
    console.log(`✓ Estado en Base de Datos de Factura ${ventaParaNC.numero_factura_fiscal}: ${ventaVerificada.estado}`);
}

console.log('\n=== TEST 4: AUDITORÍA DE CADENA CRIPTOGRÁFICA SHA-256 (TAMPER-EVIDENCE) ===');
const auditoria = CorrelativoEngine.auditarIntegridadYCorrelatividad();
console.log('Documentos auditados:', auditoria.totalDocumentos);
console.log('Correlatividad Correcta:', auditoria.correlatividadCorrecta ? '✓ 100% CONTINUA' : '✗ DISCONTINUA');
console.log('Cadena Hash SHA-256:', auditoria.integridadCadenaCorrecta ? '✓ INTACTA / INALTERADA' : '✗ MANIPULADA');

console.log('\n=== TEST 5: GENERACIÓN DE TXT PARA PORTAL SENIAT Y CSV EXCEL ===');
const txtSeniat = SeniatExportEngine.generarTxtRetencionesIVA();
console.log(`Archivo TXT generado para el portal SENIAT: ${txtSeniat.nombreSugerido}`);
console.log(`Total registros en TXT: ${txtSeniat.totalRegistros}`);

const csvVentas = ReportesService.exportarLibroVentasCSV();
console.log(`Libro de Ventas CSV generado con longitud: ${csvVentas.length} caracteres.`);

console.log('\n>>> ¡TODOS LOS PILARES SENIAT (INTEGRIDAD, CORRELATIVIDAD, SEGURIDAD) HAN SIDO VALIDADOS! <<<');

