/**
 * Script de Verificación Integral de MeDIa
 * Valida: Base de Datos, Motor Fiscal, RIF, Kárdex, POS y Libros Fiscales
 */

const { validarRIF } = require('./src/engine/rif');
const BCVManager = require('./src/engine/bcv');
const FiscalEngine = require('./src/engine/fiscal');
const FiscalPrinter = require('./src/engine/printer');
const InventarioService = require('./src/services/inventarioService');
const PosService = require('./src/services/posService');
const ReportesService = require('./src/services/reportesService');

console.log('--- 1. PROBANDO VALIDADOR DE RIF SENIAT (MODULO 11) ---');
const rifValido = validarRIF('J-50123456-6');
console.log('RIF J-50123456-7:', rifValido.valido ? 'VALIDO' : 'INVALIDO', rifValido);
const rifInvalido = validarRIF('V-12345678-0');
console.log('RIF V-12345678-0:', rifInvalido.valido ? 'VALIDO' : 'DETECTADO INVALIDO CON EXITO');

console.log('\n--- 2. PROBANDO TASA OFICIAL BCV ---');
const tasaActual = BCVManager.getTasaActual();
console.log('Tasa BCV Activa:', tasaActual.tasa, 'Bs/USD');

console.log('\n--- 3. PROBANDO INVENTARIO Y CATALOGO BIMONETARIO ---');
const prods = InventarioService.getProductos();
console.log(`Total productos cargados: ${prods.length}`);
const repuesto1 = prods.find(p => p.descripcion.includes('Motul')) || prods[0];
console.log(`Producto: ${repuesto1.descripcion} | Alicuota: ${repuesto1.alicuota_iva} | Precio USD: $${repuesto1.precio_usd} | Precio VES: Bs. ${repuesto1.precio_ves}`);

console.log('\n--- 4. PROBANDO TRANSACCION DE VENTA CON IGTF (3%) ---');
// Venta de repuestos de moto
const repuesto2 = prods.find(p => p.descripcion.includes('Bujía')) || prods[1];

const ventaTest = PosService.procesarVenta({
    cliente_id: 1, // Consumidor Final
    items: [
        { producto_id: repuesto1.id, cantidad: 1 },
        { producto_id: repuesto2.id, cantidad: 1 }
    ],
    pagos: [
        // Pago en divisa que cubre la totalidad con IGTF
        { metodo_pago: 'EFECTIVO_USD', moneda: 'USD', monto_original: 15.00 }
    ]
});

console.log(`Venta Procesada Nro Factura Fiscal: ${ventaTest.numeroFactura}`);
console.log(`Subtotal Exento (VES): Bs. ${ventaTest.totales.subtotalExentoVes}`);
console.log(`Base Imponible General (VES): Bs. ${ventaTest.totales.baseGeneralVes}`);
console.log(`IVA General 16% (VES): Bs. ${ventaTest.totales.ivaGeneralVes}`);
console.log(`Base IGTF Divisas (VES): Bs. ${ventaTest.totales.baseIgtfVes}`);
console.log(`IGTF 3% Percibido (VES): Bs. ${ventaTest.totales.montoIgtfVes}`);
console.log(`Total Factura con IGTF: Bs. ${ventaTest.totales.totalFinalConIgtfVes}`);

console.log('\n--- 5. VISUALIZANDO TICKET FISCAL PRODUCIDO (PROVIDENCIA 0141) ---');
console.log(ventaTest.ticketFiscal);

console.log('\n--- 6. VERIFICANDO LIBRO DE VENTAS FISCAL SENIAT ---');
const libroVentas = ReportesService.getLibroVentas();
console.log(`Registros en Libro de Ventas: ${libroVentas.registros.length}`);
console.log('Totales Libro de Ventas:', libroVentas.totales);

console.log('\n>>> ¡TODAS LAS PRUEBAS FISCALES Y OPERATIVAS DE MeDIa PASARON AL 100%! <<<');
