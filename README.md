# MeDIa - Suite Administrativa Básica + Punto de Venta (POS)
### Diseñado para el Ecosistema Comercial y Tributario de Venezuela
**Cumplimiento Normativo SENIAT & Resoluciones Cambiarias del Banco Central de Venezuela (BCV)**

---

## 🏛️ Marco Legal & Fiscal Implementado

1. **Providencia SNAT/2018/0141 (Máquinas Fiscales Autorizadas):**
   - Abstracción e integración para protocolos fiscales de impresoras autorizadas (**The Factory HKA, Bixolon, Epson, Hasar, Dascom**).
   - Generación de comprobante fiscal con serial de máquina, número de control, desglose de bases y alícuotas.
   - Emisión y control de **Reporte X** (auditoría parcial) y **Reporte Z** (cierre diario de memoria fiscal).
   
2. **Providencia SNAT/2022/000013 (IGTF 3% en Divisas):**
   - Motor automático de cálculo y percepción del 3% de IGTF cuando se registran cobros en moneda extranjera (efectivo USD, Zelle, etc.) en comercios clasificados como Sujetos Pasivos Especiales.
   - Soporte para cobros mixtos (parte en bolívares sin IGTF y parte en divisas con IGTF).

3. **Manejo Multimoneda y Tasa Oficial BCV:**
   - Precios bimonetarios en tiempo real (USD y Bs.).
   - Almacenamiento inmutable del *snapshot* de la tasa de cambio en cada documento fiscal.
   - Recalculación instantánea de precios en mostrador al actualizar la tasa del BCV sin afectar los costos ni márgenes fijados.

4. **Alícuotas de IVA Venezolanas (Providencia 00071):**
   - **G (General):** 16%
   - **R (Reducida):** 8% (alimentos balanceados y compras agropecuarias)
   - **A (Adicional / Suntuaria):** 31% (16% general + 15% alícuota de lujo)
   - **E (Exento / Exonerado):** 0% (cesta básica y medicinas)

5. **Libros Fiscales Oficiales (Art. 75 al 78 Reglamento Ley del IVA):**
   - Libro de Ventas Fiscal con resumen de débitos fiscales y percepción de IGTF.
   - Libro de Compras Fiscal con resumen de créditos fiscales y generación de Comprobantes de Retención de IVA (75% o 100%) e ISLR.

6. **Validador Oficial de RIF (Algoritmo Módulo 11):**
   - Validación matemática para evitar la carga de RIFs o cédulas erróneas que bloqueen la memoria fiscal o los libros legales.

---

## 🚀 Arquitectura Técnica

- **Cero dependencias externas npm:** Funciona 100% offline con módulos nativos de **Node.js v22+** (`node:http`, `node:sqlite DatabaseSync`, `node:fs`, `node:crypto`).
- **Base de Datos Embebida de Alta Velocidad:** Base de datos relacional SQLite con llaves foráneas e integridad transaccional ACID (`media_contable.db`).
- **Resiliencia Local-First:** Preparado para contingencias eléctricas y caídas de conectividad frecuentes en Venezuela.

---

## 📁 Estructura del Código

```
d:\MedIA-CONTABLE\
├── media_contable.db               # Base de datos SQLite local
├── package.json
├── README.md
├── src\
│   ├── server.js                   # Servidor HTTP nativo + API REST
│   ├── database\
│   │   ├── schema.sql              # Esquema SQL relacional
│   │   ├── db.js                   # Conexión nativa node:sqlite
│   │   └── seed.js                 # Datos semilla iniciales (productos, tasa, clientes)
│   ├── engine\
│   │   ├── fiscal.js               # Motor de cálculo IVA e IGTF 3%
│   │   ├── bcv.js                  # Gestor de Tasa BCV y conversiones
│   │   ├── rif.js                  # Validador Módulo 11 de RIFs venezolanos
│   │   └── printer.js              # Driver / Emulador de Impresora Fiscal Prov. 0141
│   └── services\
│       ├── posService.js           # Lógica de mostrador, cobro mixto y caja
│       ├── inventarioService.js    # Kárdex bimonetario y ajustes de stock
│       ├── comprasService.js       # Compras y comprobantes de retención SENIAT
│       ├── tercerosService.js      # Clientes y proveedores con validación fiscal
│       └── reportesService.js      # Libro de Ventas y Compras SENIAT
└── public\
    ├── index.html                  # Portal central MeDIa
    ├── pos.html                    # Pantalla de alta velocidad del Punto de Venta
    ├── admin.html                  # Panel Administrativo Back-Office
    ├── css\app.css                 # Estilos comerciales de alto contraste
    └── js\
        ├── pos.js                  # Lógica del cajero y pagos
        └── admin.js                # Lógica administrativa y libros fiscales
```

---

## 🏃 Cómo Iniciar MeDIa

En la terminal ejecuta:

```bash
npm start
```

Abre en tu navegador:
- **Portal Principal:** `http://localhost:3000`
- **MeDIa Punto de Venta:** `http://localhost:3000/pos.html`
- **MeDIa Administrativo:** `http://localhost:3000/admin.html`

