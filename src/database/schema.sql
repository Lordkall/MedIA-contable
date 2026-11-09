-- ====================================================================
-- MeDIa - Suite Administrativa Básica + Punto de Venta (SENIAT / BCV)
-- Esquema Relacional de Base de Datos SQLite (node:sqlite)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. CONFIGURACIÓN FISCAL DE LA EMPRESA
CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT NOT NULL,
    rif TEXT NOT NULL UNIQUE,
    direccion TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    es_contribuyente_especial INTEGER DEFAULT 1, -- 1: Sí (Agente de retención/percepción), 0: Ordinario
    es_agente_percepcion_igtf INTEGER DEFAULT 1, -- 1: Obligado a percibir 3% IGTF en divisas (Prov. 000013)
    tasa_igtf_porcentaje REAL DEFAULT 3.00,
    serial_impresora_fiscal TEXT DEFAULT 'HKA00012345',
    numero_caja_default TEXT DEFAULT '01',
    actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. HISTORIAL DE TASA OFICIAL BCV
CREATE TABLE IF NOT EXISTS tasa_cambio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,                         -- Formato YYYY-MM-DD
    moneda_origen TEXT DEFAULT 'USD',
    moneda_destino TEXT DEFAULT 'VES',
    tasa REAL NOT NULL,                          -- Ej: 65.50 Bs/USD
    es_tasa_bcv INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. CATEGORÍAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL
);

-- 4. CATÁLOGO DE PRODUCTOS (Bimonetario & Fiscal)
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barra TEXT UNIQUE NOT NULL,
    referencia TEXT,
    descripcion TEXT NOT NULL,
    categoria_id INTEGER,
    alicuota_iva TEXT CHECK(alicuota_iva IN ('G', 'R', 'A', 'E')) DEFAULT 'G', -- G:16%, R:8%, A:31%, E:0%
    precio_usd REAL NOT NULL DEFAULT 0.0,
    costo_usd REAL NOT NULL DEFAULT 0.0,
    stock_actual REAL NOT NULL DEFAULT 0.0,
    stock_minimo REAL NOT NULL DEFAULT 5.0,
    unidad_medida TEXT DEFAULT 'UNID',           -- UNID, KG, BLISTER, BULTO
    activo INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- 5. KÁRDEX DE INVENTARIO (Movimientos y Costeo)
CREATE TABLE IF NOT EXISTS kardex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    tipo_movimiento TEXT NOT NULL,               -- ENTRADA_COMPRA, SALIDA_VENTA, AJUSTE_POS, AJUSTE_NEG
    cantidad REAL NOT NULL,
    stock_anterior REAL NOT NULL,
    stock_nuevo REAL NOT NULL,
    costo_unitario_usd REAL NOT NULL,
    tasa_bcv_momento REAL NOT NULL,
    referencia_documento TEXT,
    fecha TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 6. CLIENTES (Con validación de RIF y Tipo de Contribuyente)
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento TEXT CHECK(tipo_documento IN ('V', 'E', 'J', 'G', 'C')) NOT NULL,
    numero_documento TEXT NOT NULL,
    rif_completo TEXT UNIQUE NOT NULL,           -- Ej: J-12345678-9
    razon_social TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    tipo_contribuyente TEXT CHECK(tipo_contribuyente IN ('ORDINARIO', 'ESPECIAL', 'FORMAL', 'CONSUMIDOR_FINAL')) DEFAULT 'ORDINARIO',
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 7. PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento TEXT CHECK(tipo_documento IN ('V', 'E', 'J', 'G', 'C')) NOT NULL,
    numero_documento TEXT NOT NULL,
    rif_completo TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    porcentaje_retencion_iva REAL DEFAULT 75.0,  -- 75% o 100%
    porcentaje_retencion_islr REAL DEFAULT 2.0,
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 8. SESIONES DE CAJA (Aperturas, Arqueos y Cierres)
CREATE TABLE IF NOT EXISTS sesiones_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_caja TEXT NOT NULL,
    cajero TEXT NOT NULL,
    fecha_apertura TEXT DEFAULT CURRENT_TIMESTAMP,
    monto_inicial_ves REAL DEFAULT 0.0,
    monto_inicial_usd REAL DEFAULT 0.0,
    tasa_bcv_apertura REAL NOT NULL,
    fecha_cierre TEXT,
    monto_cierre_ves REAL DEFAULT 0.0,
    monto_cierre_usd REAL DEFAULT 0.0,
    diferencia_ves REAL DEFAULT 0.0,
    diferencia_usd REAL DEFAULT 0.0,
    estado TEXT CHECK(estado IN ('ABIERTA', 'CERRADA')) DEFAULT 'ABIERTA',
    ultimo_reporte_z INTEGER DEFAULT 0
);

-- 9. VENTAS Y FACTURACIÓN FISCAL
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_factura_fiscal TEXT NOT NULL,
    numero_control TEXT,
    serial_impresora TEXT NOT NULL,
    sesion_caja_id INTEGER,
    cliente_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,                         -- YYYY-MM-DD
    hora TEXT NOT NULL,                          -- HH:MM:SS
    tasa_bcv_snapshot REAL NOT NULL,
    -- Bases e Impuestos
    subtotal_exento_ves REAL DEFAULT 0.0,
    base_general_ves REAL DEFAULT 0.0,
    iva_general_ves REAL DEFAULT 0.0,            -- 16%
    base_reducida_ves REAL DEFAULT 0.0,
    iva_reducida_ves REAL DEFAULT 0.0,           -- 8%
    base_adicional_ves REAL DEFAULT 0.0,
    iva_adicional_ves REAL DEFAULT 0.0,          -- 31%
    total_venta_ves REAL NOT NULL,
    total_venta_usd REAL NOT NULL,
    -- IGTF (Providencia 000013)
    monto_pagado_divisas_usd REAL DEFAULT 0.0,
    base_igtf_ves REAL DEFAULT 0.0,
    monto_igtf_ves REAL DEFAULT 0.0,             -- 3%
    total_final_con_igtf_ves REAL NOT NULL,
    estado TEXT CHECK(estado IN ('PROCESADA', 'ANULADA')) DEFAULT 'PROCESADA',
    FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- 10. DETALLE DE ÍTEMS VENDIDOS
CREATE TABLE IF NOT EXISTS ventas_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    codigo_barra TEXT,
    descripcion TEXT NOT NULL,
    alicuota_iva TEXT NOT NULL,
    cantidad REAL NOT NULL,
    precio_unitario_usd REAL NOT NULL,
    precio_unitario_ves REAL NOT NULL,
    subtotal_ves REAL NOT NULL,
    iva_ves REAL NOT NULL,
    total_ves REAL NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 11. DESGLOSE DE MEDIOS DE PAGO (Multimoneda e IGTF)
CREATE TABLE IF NOT EXISTS ventas_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    metodo_pago TEXT NOT NULL,                   -- EFECTIVO_USD, EFECTIVO_VES, PUNTO_DEBITO, BIOPAGO, PAGO_MOVIL, ZELLE, etc.
    moneda TEXT NOT NULL,                        -- USD o VES
    monto_original REAL NOT NULL,
    tasa_cambio REAL NOT NULL,
    monto_equivalente_ves REAL NOT NULL,
    genera_igtf INTEGER DEFAULT 0,
    monto_igtf_ves REAL DEFAULT 0.0,
    referencia TEXT,
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
);

-- 12. COMPRAS DE MERCANCÍA (Alimenta Inventario y Cuentas por Pagar)
CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    numero_factura_proveedor TEXT NOT NULL,
    numero_control_proveedor TEXT,
    fecha_factura TEXT NOT NULL,
    fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
    tasa_bcv_snapshot REAL NOT NULL,
    total_exento_ves REAL DEFAULT 0.0,
    base_imponible_ves REAL DEFAULT 0.0,
    monto_iva_ves REAL DEFAULT 0.0,
    total_compra_ves REAL NOT NULL,
    total_compra_usd REAL NOT NULL,
    -- Retenciones Fiscales
    comprobante_retencion_iva TEXT,
    monto_retenido_iva_ves REAL DEFAULT 0.0,
    monto_retenido_islr_ves REAL DEFAULT 0.0,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- 13. DETALLE DE ÍTEMS DE COMPRA
CREATE TABLE IF NOT EXISTS compras_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    costo_unitario_usd REAL NOT NULL,
    costo_unitario_ves REAL NOT NULL,
    alicuota_iva TEXT NOT NULL,
    total_ves REAL NOT NULL,
    FOREIGN KEY (compra_id) REFERENCES compras(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Índices para búsqueda rápida en caja e informes
CREATE INDEX IF NOT EXISTS idx_prod_barcode ON productos(codigo_barra);
CREATE INDEX IF NOT EXISTS idx_prod_desc ON productos(descripcion);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_kardex_prod ON kardex(producto_id);

