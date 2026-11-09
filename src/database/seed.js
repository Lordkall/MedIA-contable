/**
 * Semilla de Datos Iniciales para MeDIa - VENTA DE REPUESTOS DE MOTO
 * Configuración de empresa de repuestos, categorías moteras, catálogo completo de repuestos,
 * clientes, proveedores mayoristas de repuestos y ventas iniciales de hoy.
 */

const db = require('./db');
const crypto = require('node:crypto');

function seedDatabase() {
    console.log('[MeDIa] Inicializando datos semilla de Venta de Repuestos de Moto...');

    // 1. Configuración de la Empresa
    const empresaExiste = db.get("SELECT id FROM configuracion WHERE id = 1");
    if (!empresaExiste) {
        db.run(`
            INSERT INTO configuracion (
                id, razon_social, nombre_comercial, rif, direccion, telefono, email,
                es_contribuyente_especial, es_agente_percepcion_igtf, tasa_igtf_porcentaje,
                serial_impresora_fiscal, numero_caja_default
            ) VALUES (
                1, 'MOTO REPUESTOS & ACCESORIOS MeDIa, C.A.', 'MeDIa MOTO REPUESTOS', 'J-50123456-6',
                'Av. Casanova c/ Calle El Recreo, Edif. Motos del Centro, Sabana Grande, Caracas',
                '0212-7629911', 'repuestos@media-motos.com.ve',
                1, 1, 3.00,
                'HKA00098765', '01'
            )
        `);
    } else {
        db.run(`
            UPDATE configuracion SET 
                razon_social = 'MOTO REPUESTOS & ACCESORIOS MeDIa, C.A.',
                nombre_comercial = 'MeDIa MOTO REPUESTOS',
                direccion = 'Av. Casanova c/ Calle El Recreo, Edif. Motos del Centro, Sabana Grande, Caracas',
                telefono = '0212-7629911',
                email = 'repuestos@media-motos.com.ve'
            WHERE id = 1
        `);
    }

    // 2. Tasa Oficial BCV Inicial
    const fechaHoy = new Date().toISOString().split('T')[0];
    const tasaExiste = db.get("SELECT id, tasa FROM tasa_cambio ORDER BY id DESC LIMIT 1");
    let tasaActual = 897.54;
    if (!tasaExiste) {
        db.run("INSERT INTO tasa_cambio (fecha, moneda_origen, moneda_destino, tasa, es_tasa_bcv) VALUES (?, 'USD', 'VES', ?, 1)", [fechaHoy, tasaActual]);
    } else {
        tasaActual = tasaExiste.tasa;
    }

    // 3. Categorías de Repuestos para Motos
    const countCat = db.get("SELECT COUNT(*) as count FROM categorias");
    if (countCat.count === 0) {
        const categorias = [
            ['LUBR', 'Lubricantes y Químicos para Motos'],
            ['FREN', 'Frenos, Discos y Embrague'],
            ['TRAN', 'Transmisión, Cadenas y Arrastre'],
            ['ELEC', 'Sistema Eléctrico, Baterías y Luces'],
            ['MOTO', 'Motor, Cilindros y Carburación'],
            ['NEUM', 'Cauchos, Tripas y Rines'],
            ['ACCE', 'Accesorios, Cascos y Protección']
        ];
        categorias.forEach(([cod, nom]) => {
            db.run("INSERT INTO categorias (codigo, nombre) VALUES (?, ?)", [cod, nom]);
        });
    }

    // 4. Catálogo de Repuestos de Moto con Tratamiento Fiscal SENIAT (16% General)
    const countProd = db.get("SELECT COUNT(*) as count FROM productos");
    if (countProd.count === 0) {
        const productos = [
            // [barcode, ref, descripcion, cat_id, alicuota_iva, precio_usd, costo_usd, stock, stock_minimo, imgUrl]
            ['7591001001', 'LUB-01', 'Aceite Motul 3000 4T 20W50 Mineral 1L', 1, 'G', 6.50, 4.50, 48, 10, '/img/products/aceite-motul-4t.svg'],
            ['7591001002', 'LUB-02', 'Aceite Castrol Actevo 4T 20W50 Semisintético 1L', 1, 'G', 8.00, 5.80, 36, 10, '/img/products/aceite-castrol-4t.svg'],
            ['7591001003', 'LUB-03', 'Grasa para Cadena Motul Chain Lube 400ml', 1, 'G', 9.50, 6.80, 24, 6, '/img/products/motul-chain-lube.svg'],
            ['7591001004', 'LUB-04', 'Líquido de Frenos DOT-4 Wagner 250ml', 1, 'G', 3.50, 2.10, 30, 8, '/img/products/liquido-frenos-dot4.svg'],
            
            ['7592002001', 'FREN-01', 'Pastillas de Freno Delanteras Bera SBR 150 / New Jaguar', 2, 'G', 4.00, 2.20, 55, 12, '/img/products/pastillas-freno-bera.svg'],
            ['7592002002', 'FREN-02', 'Bandas de Freno Traseras Empire Horse / Arsen / Owen', 2, 'G', 4.50, 2.50, 40, 10, '/img/products/bandas-freno-horse.svg'],
            ['7592002003', 'FREN-03', 'Guaya de Embrague (Clutch) Bera SBR 150', 2, 'G', 3.00, 1.50, 35, 8, '/img/products/guaya-clutch.svg'],
            ['7592002004', 'FREN-04', 'Bomba de Freno Delantero con Manilla Universal', 2, 'G', 12.00, 7.80, 15, 5, '/img/products/bomba-freno.svg'],
            
            ['7593003001', 'TRAN-01', 'Kit de Arrastre Reforzado Bera SBR 150 (Cadena 428H + Corona + Piñón)', 3, 'G', 18.50, 12.00, 28, 6, '/img/products/kit-arrastre-bera.svg'],
            ['7593003002', 'TRAN-02', 'Kit de Arrastre Reforzado Empire Horse 150', 3, 'G', 19.00, 12.50, 25, 6, '/img/products/kit-arrastre-horse.svg'],
            ['7593003003', 'TRAN-03', 'Cadena Reforzada 428H x 120 Eslabones Choho Gold', 3, 'G', 11.00, 7.20, 32, 8, '/img/products/cadena-428h.svg'],
            
            ['7594004001', 'ELEC-01', 'Batería de Gel 12V 7Ah YTX7A-BS Bera / Empire / Toro', 4, 'G', 22.00, 14.50, 20, 5, '/img/products/bateria-gel-12v.svg'],
            ['7594004002', 'ELEC-02', 'Bujía NGK D8EA Rosca Gruesa Original', 4, 'G', 2.50, 1.40, 80, 15, '/img/products/bujia-ngk-d8ea.svg'],
            ['7594004003', 'ELEC-03', 'Bombillo LED H4 Alta y Baja 6000K Blanco Frío', 4, 'G', 5.50, 3.20, 45, 10, '/img/products/bombillo-led-h4.svg'],
            ['7594004004', 'ELEC-04', 'Regulador de Voltaje 5 Cables Bera / Horse 150', 4, 'G', 8.00, 4.90, 18, 5, '/img/products/regulador-voltaje.svg'],
            
            ['7595005001', 'MOTO-01', 'Carburador PZ27 con Ahogador Bera SBR / Horse 150', 5, 'G', 24.00, 16.00, 4, 6, '/img/products/carburador-pz27.svg'],
            ['7595005002', 'MOTO-02', 'Kit de Cilindro y Pistón Completo CG-150cc', 5, 'G', 35.00, 23.00, 10, 4, '/img/products/cilindro-piston-cg150.svg'],
            ['7595005003', 'MOTO-03', 'Filtro de Gasolina de Alto Flujo Lavable Metálico', 5, 'G', 3.00, 1.60, 60, 15, '/img/products/filtro-gasolina.svg'],
            
            ['7596006001', 'NEUM-01', 'Caucho Trasero Kenda 90/90-18 Pistero 6 Lonas', 6, 'G', 28.00, 19.50, 16, 5, '/img/products/caucho-kenda-90-90.svg'],
            ['7596006002', 'NEUM-02', 'Caucho Delantero Kenda 2.75-18 Mixto 4 Lonas', 6, 'G', 22.00, 15.00, 18, 5, '/img/products/caucho-kenda-275.svg'],
            ['7596006003', 'NEUM-03', 'Tripa de Moto Rin 18 Reforzada Válvula TR4', 6, 'G', 4.50, 2.50, 50, 12, '/img/products/tripa-rin18.svg'],
            
            ['7597007001', 'ACCE-01', 'Casco Integral Certificado DOT con Visor Polarizado', 7, 'G', 38.00, 24.00, 3, 5, '/img/products/casco-integral-dot.svg'],
            ['7597007002', 'ACCE-02', 'Guantes de Moto Pro-Biker con Protección de Nudillos L/XL', 7, 'G', 9.00, 5.50, 22, 6, '/img/products/guantes-probiker.svg'],
            ['7597007003', 'ACCE-03', 'Espejos Retrovisores Universales Rosca 10mm (Par)', 7, 'G', 6.50, 3.80, 25, 6, '/img/products/espejos-retrovisores.svg']
        ];

        productos.forEach(([bar, ref, desc, cat, alic, pUsd, cUsd, stock, sMin, imgUrl]) => {
            const res = db.run(`
                INSERT INTO productos (codigo_barra, referencia, descripcion, categoria_id, alicuota_iva, precio_usd, costo_usd, stock_actual, stock_minimo, imagen_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [bar, ref, desc, cat, alic, pUsd, cUsd, stock, sMin, imgUrl]);

            db.run(`
                INSERT INTO kardex (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_unitario_usd, tasa_bcv_momento, referencia_documento)
                VALUES (?, 'INVENTARIO_INICIAL', ?, 0, ?, ?, ?, 'INICIO_TIENDA_MOTOS')
            `, [res.lastInsertRowid, stock, stock, cUsd, tasaActual]);
        });
    }

    // 5. Clientes Pre-cargados
    const countCli = db.get("SELECT COUNT(*) as count FROM clientes");
    if (countCli.count === 0) {
        db.run(`
            INSERT INTO clientes (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, tipo_contribuyente)
            VALUES 
            ('V', '00000000', 'V-00000000-0', 'CONSUMIDOR FINAL / CONTADO', 'Mostrador MeDIa Motos', '0000-0000000', 'CONSUMIDOR_FINAL'),
            ('V', '18554221', 'V-18554221-3', 'CARLOS EDUARDO PEREZ (MOTERO)', 'Av. Romulo Gallegos, Res. Parque, Caracas', '0414-1234567', 'ORDINARIO'),
            ('V', '24891023', 'V-24891023-4', 'JHONATAN RIVAS (RIDERS DELIVERY)', 'Calle Real de Sabana Grande, Edif. Motos', '0412-5556677', 'ORDINARIO'),
            ('J', '31245678', 'J-31245678-2', 'TALLER MECANICO Y MOTOS RACING, C.A.', 'Av. Libertador, Galpón 4, Chacao, Caracas', '0212-2634455', 'ESPECIAL')
        `);
    }

    // 6. Proveedores Mayoristas de Repuestos de Moto
    const countProv = db.get("SELECT COUNT(*) as count FROM proveedores");
    if (countProv.count === 0) {
        db.run(`
            INSERT INTO proveedores (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, porcentaje_retencion_iva, porcentaje_retencion_islr)
            VALUES 
            ('J', '40192837', 'J-40192837-1', 'IMPORTADORA Y DISTRIBUIDORA MOTOREPUESTOS VENEZUELA, C.A.', 'Zona Industrial Boleita Norte, Calle 4, Caracas', '0212-2391122', 75.0, 2.0),
            ('J', '31829401', 'J-31829401-5', 'LUBRICANTES Y FILTROS MOTUL CARACAS, S.A.', 'Av. Principal de Los Ruices, Torre Industrial, Piso 3', '0212-2384455', 100.0, 2.0),
            ('J', '50291834', 'J-50291834-0', 'DISTRIBUIDORA DE CAUCHOS Y TRIPAS EL CENTAURO, C.A.', 'Zona Industrial San Martín, Galpón 12, Caracas', '0212-4613300', 75.0, 2.0)
        `);
    }

    // 7. Sesión de Caja Activa
    const sesionActiva = db.get("SELECT id FROM sesiones_caja WHERE estado = 'ABIERTA'");
    let sesionId = sesionActiva ? sesionActiva.id : null;
    if (!sesionActiva) {
        const resCaja = db.run(`
            INSERT INTO sesiones_caja (numero_caja, cajero, monto_inicial_ves, monto_inicial_usd, tasa_bcv_apertura, estado)
            VALUES ('01', 'CAJERO PRINCIPAL (MOSTRADOR MOTOS)', 1500.00, 50.00, ?, 'ABIERTA')
        `, [tasaActual]);
        sesionId = resCaja.lastInsertRowid;
    }

    // 8. Inicializar Secuencias Fiscales SENIAT
    db.exec(`
        CREATE TABLE IF NOT EXISTS secuencias_fiscales (
            id TEXT PRIMARY KEY,
            prefijo TEXT NOT NULL,
            ultimo_numero INTEGER NOT NULL DEFAULT 0,
            formato_longitud INTEGER DEFAULT 8,
            actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO secuencias_fiscales (id, prefijo, ultimo_numero, formato_longitud)
        VALUES 
        ('FACTURA', '', 0, 8),
        ('CONTROL', '00-', 0, 6),
        ('NOTA_CREDITO', 'NC-', 0, 8),
        ('NOTA_DEBITO', 'ND-', 0, 8);
    `);

    // 9. Registrar Ventas Iniciales de Repuestos de Moto Realizadas HOY
    const countVentas = db.get("SELECT COUNT(*) as count FROM ventas");
    if (countVentas.count === 0) {
        console.log('[MeDIa] Generando ventas operativas del día para Repuestos de Moto...');

        const ventasDelDia = [
            {
                hora: '08:45:10',
                cliente_id: 2, // Carlos Pérez
                items: [
                    { prodId: 1, desc: 'Aceite Motul 3000 4T 20W50 Mineral 1L', cant: 1, pUsd: 6.50 },
                    { prodId: 13, desc: 'Bujía NGK D8EA Rosca Gruesa Original', cant: 1, pUsd: 2.50 }
                ],
                pagos: [{ metodo: 'PUNTO_DEBITO', moneda: 'VES' }]
            },
            {
                hora: '10:12:44',
                cliente_id: 1, // Consumidor Final
                items: [
                    { prodId: 9, desc: 'Kit de Arrastre Reforzado Bera SBR 150 (Cadena 428H + Corona + Piñón)', cant: 1, pUsd: 18.50 },
                    { prodId: 5, desc: 'Pastillas de Freno Delanteras Bera SBR 150 / New Jaguar', cant: 1, pUsd: 4.00 }
                ],
                pagos: [{ metodo: 'PAGO_MOVIL', moneda: 'VES' }]
            },
            {
                hora: '11:30:22',
                cliente_id: 4, // Taller Racing
                items: [
                    { prodId: 19, desc: 'Caucho Trasero Kenda 90/90-18 Pistero 6 Lonas', cant: 1, pUsd: 28.00 },
                    { prodId: 21, desc: 'Tripa de Moto Rin 18 Reforzada Válvula TR4', cant: 1, pUsd: 4.50 }
                ],
                pagos: [{ metodo: 'EFECTIVO_USD', moneda: 'USD' }] // IGTF 3%
            },
            {
                hora: '13:05:18',
                cliente_id: 3, // Jhonatan Rivas Riders Delivery
                items: [
                    { prodId: 22, desc: 'Casco Integral Certificado DOT con Visor Polarizado', cant: 1, pUsd: 38.00 },
                    { prodId: 23, desc: 'Guantes de Moto Pro-Biker con Protección de Nudillos L/XL', cant: 1, pUsd: 9.00 }
                ],
                pagos: [{ metodo: 'EFECTIVO_USD', moneda: 'USD' }] // IGTF 3%
            },
            {
                hora: '14:20:55',
                cliente_id: 1, // Consumidor Final
                items: [
                    { prodId: 1, desc: 'Aceite Motul 3000 4T 20W50 Mineral 1L', cant: 2, pUsd: 6.50 },
                    { prodId: 18, desc: 'Filtro de Gasolina de Alto Flujo Lavable Metálico', cant: 1, pUsd: 3.00 }
                ],
                pagos: [{ metodo: 'PUNTO_DEBITO', moneda: 'VES' }]
            }
        ];

        let hashAnterior = 'GENESIS_MEDIA_SENIAT';

        ventasDelDia.forEach((vd, idx) => {
            const numEntero = idx + 1;
            const numFactura = String(numEntero).padStart(8, '0');
            const numControl = `00-${String(numEntero).padStart(6, '0')}`;
            const serialImp = 'HKA00098765';

            let baseGeneralUsd = 0;
            vd.items.forEach(it => {
                baseGeneralUsd += it.cant * it.pUsd;
            });
            const baseGeneralVes = Math.round(baseGeneralUsd * tasaActual * 100) / 100;
            const ivaGeneralVes = Math.round(baseGeneralVes * 0.16 * 100) / 100;
            const totalVentaVes = Math.round((baseGeneralVes + ivaGeneralVes) * 100) / 100;
            const totalVentaUsd = Math.round(baseGeneralUsd * 1.16 * 100) / 100;

            let montoDivisasUsd = 0;
            let baseIgtfVes = 0;
            let montoIgtfVes = 0;

            const esDivisa = vd.pagos.some(p => p.moneda === 'USD');
            if (esDivisa) {
                montoDivisasUsd = totalVentaUsd;
                baseIgtfVes = totalVentaVes;
                montoIgtfVes = Math.round(baseIgtfVes * 0.03 * 100) / 100;
            }
            const totalFinalConIgtfVes = Math.round((totalVentaVes + montoIgtfVes) * 100) / 100;

            const cli = db.get("SELECT rif_completo FROM clientes WHERE id = ?", [vd.cliente_id]);
            const clienteRif = cli ? cli.rif_completo : 'V-00000000-0';

            const payloadHash = [
                hashAnterior,
                numFactura,
                numControl,
                serialImp,
                fechaHoy,
                vd.hora,
                clienteRif,
                totalVentaVes.toFixed(2),
                montoIgtfVes.toFixed(2),
                totalFinalConIgtfVes.toFixed(2),
                tasaActual.toFixed(4)
            ].join('|');
            const hashSeguridad = crypto.createHash('sha256').update(payloadHash).digest('hex');

            const resVenta = db.run(`
                INSERT INTO ventas (
                    numero_factura_fiscal, numero_control, serial_impresora, sesion_caja_id,
                    cliente_id, fecha, hora, tasa_bcv_snapshot,
                    subtotal_exento_ves, base_general_ves, iva_general_ves,
                    total_venta_ves, total_venta_usd,
                    monto_pagado_divisas_usd, base_igtf_ves, monto_igtf_ves, total_final_con_igtf_ves,
                    estado, hash_seguridad, hash_anterior
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESADA', ?, ?)
            `, [
                numFactura, numControl, serialImp, sesionId,
                vd.cliente_id, fechaHoy, vd.hora, tasaActual,
                baseGeneralVes, ivaGeneralVes,
                totalVentaVes, totalVentaUsd,
                montoDivisasUsd, baseIgtfVes, montoIgtfVes, totalFinalConIgtfVes,
                hashSeguridad, hashAnterior
            ]);

            hashAnterior = hashSeguridad;

            const ventaId = resVenta.lastInsertRowid;

            // Ítems de la venta
            vd.items.forEach(it => {
                const subVes = Math.round(it.cant * it.pUsd * tasaActual * 100) / 100;
                const ivaVes = Math.round(subVes * 0.16 * 100) / 100;
                const totVes = Math.round((subVes + ivaVes) * 100) / 100;

                db.run(`
                    INSERT INTO ventas_items (
                        venta_id, producto_id, descripcion, alicuota_iva, cantidad,
                        precio_unitario_usd, precio_unitario_ves, subtotal_ves, iva_ves, total_ves
                    ) VALUES (?, ?, ?, 'G', ?, ?, ?, ?, ?, ?)
                `, [ventaId, it.prodId, it.desc, it.cant, it.pUsd, (it.pUsd * tasaActual), subVes, ivaVes, totVes]);

                // Actualizar stock y registrar en Kárdex
                db.run(`
                    UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?
                `, [it.cant, it.prodId]);

                const prod = db.get("SELECT stock_actual, costo_usd FROM productos WHERE id = ?", [it.prodId]);
                const stockDespues = prod ? prod.stock_actual : 0;
                const costoUsd = prod ? prod.costo_usd : 0;

                db.run(`
                    INSERT INTO kardex (
                        producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
                        costo_unitario_usd, tasa_bcv_momento, referencia_documento, fecha
                    ) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?, ?)
                `, [it.prodId, it.cant, (stockDespues + it.cant), stockDespues, costoUsd, tasaActual, numFactura, `${fechaHoy} ${vd.hora}`]);
            });

            // Pagos de la venta
            vd.pagos.forEach(pg => {
                if (pg.moneda === 'USD') {
                    db.run(`
                        INSERT INTO ventas_pagos (venta_id, metodo_pago, moneda, monto_original, tasa_cambio, monto_equivalente_ves)
                        VALUES (?, ?, 'USD', ?, ?, ?)
                    `, [ventaId, pg.metodo, totalVentaUsd, tasaActual, totalFinalConIgtfVes]);
                } else {
                    db.run(`
                        INSERT INTO ventas_pagos (venta_id, metodo_pago, moneda, monto_original, tasa_cambio, monto_equivalente_ves)
                        VALUES (?, ?, 'VES', ?, 1, ?)
                    `, [ventaId, pg.metodo, totalFinalConIgtfVes, totalFinalConIgtfVes]);
                }
            });
        });

        // Actualizar último correlativo emitido
        db.run("UPDATE secuencias_fiscales SET ultimo_numero = ? WHERE id = 'FACTURA'", [ventasDelDia.length]);
        db.run("UPDATE secuencias_fiscales SET ultimo_numero = ? WHERE id = 'CONTROL'", [ventasDelDia.length]);
    }

    console.log('[MeDIa] Datos de Venta de Repuestos de Moto cargados con éxito.');
}

module.exports = seedDatabase;
