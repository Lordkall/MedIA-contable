/**
 * Semilla de Datos Iniciales para MeDIa
 * Carga de empresa, categorías, productos con alícuotas venezolanas,
 * clientes, proveedores y tasa oficial BCV.
 */

const db = require('./db');

function seedDatabase() {
    console.log('[MeDIa] Inicializando datos semilla...');

    // 1. Configuración de la Empresa
    const empresaExiste = db.get("SELECT id FROM configuracion WHERE id = 1");
    if (!empresaExiste) {
        db.run(`
            INSERT INTO configuracion (
                id, razon_social, nombre_comercial, rif, direccion, telefono, email,
                es_contribuyente_especial, es_agente_percepcion_igtf, tasa_igtf_porcentaje,
                serial_impresora_fiscal, numero_caja_default
            ) VALUES (
                1, 'COMERCIAL MeDIa, C.A.', 'MeDIa SUPERMARKET & POS', 'J-50123456-6',
                'Av. Francisco de Miranda, Centro Empresarial MeDIa, Torre A, Chacao, Caracas',
                '0212-9998877', 'ventas@media-contable.com.ve',
                1, 1, 3.00,
                'HKA00098765', '01'
            )
        `);
    }

    // 2. Tasa Oficial BCV Inicial
    const tasaExiste = db.get("SELECT id FROM tasa_cambio LIMIT 1");
    if (!tasaExiste) {
        const fechaHoy = new Date().toISOString().split('T')[0];
        db.run("INSERT INTO tasa_cambio (fecha, moneda_origen, moneda_destino, tasa, es_tasa_bcv) VALUES (?, 'USD', 'VES', 65.50, 1)", [fechaHoy]);
    }

    // 3. Categorías de Productos
    const countCat = db.get("SELECT COUNT(*) as count FROM categorias");
    if (countCat.count === 0) {
        const categorias = [
            ['ALIM', 'Alimentos de Primera Necesidad (Cesta Básica)'],
            ['BEB',  'Bebidas y Refrescos'],
            ['HIG',  'Cuidado Personal y Limpieza del Hogar'],
            ['LIC',  'Licores y Productos Suntuarios'],
            ['AGRO', 'Productos Agrícolas y Balanceados']
        ];
        categorias.forEach(([cod, nom]) => {
            db.run("INSERT INTO categorias (codigo, nombre) VALUES (?, ?)", [cod, nom]);
        });
    }

    // 4. Catálogo de Productos con Tratamiento Fiscal SENIAT
    const countProd = db.get("SELECT COUNT(*) as count FROM productos");
    if (countProd.count === 0) {
        const productos = [
            // [barcode, ref, descripcion, cat_id, alicuota_iva, precio_usd, costo_usd, stock]
            ['7591001001', 'ALIM-01', 'Harina PAN Maiz Blanco 1kg', 1, 'E', 1.10, 0.85, 120.0],
            ['7591001002', 'ALIM-02', 'Arroz Blanco Tradicional Mary 1kg', 1, 'E', 1.25, 0.90, 85.0],
            ['7591001003', 'ALIM-03', 'Aceite Vegetal Mazeite 1L', 1, 'E', 2.90, 2.10, 60.0],
            ['7591001004', 'ALIM-04', 'Pasta Larga Primor Spaghetti 1kg', 1, 'E', 1.50, 1.05, 95.0],
            ['7591001005', 'ALIM-05', 'Queso Blanco Llanero Duro 1kg', 1, 'E', 4.80, 3.50, 45.0],
            ['7592002001', 'BEB-01',  'Refresco Coca-Cola Original 1.5L', 2, 'G', 1.80, 1.20, 75.0],
            ['7592002002', 'BEB-02',  'Agua Mineral Minalba 1.5L', 2, 'G', 1.00, 0.60, 110.0],
            ['7592002003', 'BEB-03',  'Jugo Néctar Yukery Naranja 1L', 2, 'G', 1.60, 1.10, 50.0],
            ['7593003001', 'HIG-01',  'Detergente Las Llaves Multiuso 1kg', 3, 'G', 2.20, 1.50, 40.0],
            ['7593003002', 'HIG-02',  'Jabón de Baño Protex Avena 110g', 3, 'G', 1.20, 0.80, 80.0],
            ['7594004001', 'LIC-01',  'Whisky Escocés Buchanan 12 Años 750ml', 4, 'A', 35.00, 24.00, 18.0],
            ['7595005001', 'AGRO-01', 'Alimento Concentrado para Aves 5kg', 5, 'R', 6.00, 4.20, 30.0]
        ];

        productos.forEach(([bar, ref, desc, cat, alic, pUsd, cUsd, stock]) => {
            const res = db.run(`
                INSERT INTO productos (codigo_barra, referencia, descripcion, categoria_id, alicuota_iva, precio_usd, costo_usd, stock_actual, stock_minimo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 10)
            `, [bar, ref, desc, cat, alic, pUsd, cUsd, stock]);

            // Crear movimiento inicial en Kárdex
            db.run(`
                INSERT INTO kardex (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_unitario_usd, tasa_bcv_momento, referencia_documento)
                VALUES (?, 'INVENTARIO_INICIAL', ?, 0, ?, ?, 65.50, 'INICIO_OPERACIONES')
            `, [res.lastInsertRowid, stock, stock, cUsd]);
        });
    }

    // Actualizar fotos oficiales en catálogo para productos base
    const imagenesMap = {
        '7591001001': '/img/products/harina-pan.svg',
        '7591001002': '/img/products/arroz-mary.svg',
        '7591001003': '/img/products/aceite-mazeite.svg',
        '7591001004': '/img/products/pasta-primor.svg',
        '7591001005': '/img/products/queso-llanero.svg',
        '7592002001': '/img/products/coca-cola.svg',
        '7592002002': '/img/products/minalba.svg',
        '7592002003': '/img/products/yukery.svg',
        '7593003001': '/img/products/las-llaves.svg',
        '7593003002': '/img/products/protex.svg',
        '7594004001': '/img/products/buchanans.svg',
        '7595005001': '/img/products/alimento-aves.svg'
    };
    for (const [barcode, imgUrl] of Object.entries(imagenesMap)) {
        try {
            db.run("UPDATE productos SET imagen_url = ? WHERE codigo_barra = ?", [imgUrl, barcode]);
        } catch(e) {}
    }

    // 5. Clientes Pre-cargados
    const countCli = db.get("SELECT COUNT(*) as count FROM clientes");
    if (countCli.count === 0) {
        db.run(`
            INSERT INTO clientes (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, tipo_contribuyente)
            VALUES 
            ('V', '00000000', 'V-00000000-0', 'CONSUMIDOR FINAL / CONTADO', 'Mostrador', '0000-0000000', 'CONSUMIDOR_FINAL'),
            ('V', '18554221', 'V-18554221-3', 'CARLOS EDUARDO PEREZ', 'Av. Romulo Gallegos, Res. Parque, Apto 4-B', '0414-1234567', 'ORDINARIO'),
            ('J', '31245678', 'J-31245678-2', 'INVERSIONES Y SUMINISTROS CARACAS, C.A.', 'Centro San Ignacio, Nivel Jardín, Chacao', '0212-2634455', 'ESPECIAL')
        `);
    }

    // 6. Proveedores Pre-cargados
    const countProv = db.get("SELECT COUNT(*) as count FROM proveedores");
    if (countProv.count === 0) {
        db.run(`
            INSERT INTO proveedores (tipo_documento, numero_documento, rif_completo, razon_social, direccion, telefono, porcentaje_retencion_iva, porcentaje_retencion_islr)
            VALUES 
            ('J', '00012345', 'J-00012345-6', 'ALIMENTOS POLAR COMERCIAL, C.A.', 'Los Cortijos de Lourdes, 4ta Transversal, Caracas', '0212-2023111', 75.0, 2.0),
            ('J', '00054321', 'J-00054321-9', 'DISTRIBUIDORA NACIONAL DE BEBIDAS, S.A.', 'Zona Industrial La Yaguara, Calle 3, Caracas', '0212-4412233', 100.0, 2.0)
        `);
    }

    // 7. Sesión de Caja Activa por Defecto
    const sesionActiva = db.get("SELECT id FROM sesiones_caja WHERE estado = 'ABIERTA'");
    if (!sesionActiva) {
        db.run(`
            INSERT INTO sesiones_caja (numero_caja, cajero, monto_inicial_ves, monto_inicial_usd, tasa_bcv_apertura, estado)
            VALUES ('01', 'CAJERO PRINCIPAL', 500.00, 20.00, 65.50, 'ABIERTA')
        `);
    }

    console.log('[MeDIa] Datos iniciales cargados con éxito.');
}

module.exports = seedDatabase;
