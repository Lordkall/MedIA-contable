/**
 * Servidor Web y REST API para MeDIa (Administrativo + POS)
 * Construido sobre el módulo nativo node:http (Ultra-rápido, Cero dependencias externas)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./database/db');
const seed = require('./database/seed');
const applyTriggers = require('./database/triggers');
const BCVManager = require('./engine/bcv');
const CorrelativoEngine = require('./engine/correlativoEngine');
const SeniatExportEngine = require('./engine/seniatExport');
const PosService = require('./services/posService');
const InventarioService = require('./services/inventarioService');
const ComprasService = require('./services/comprasService');
const TercerosService = require('./services/tercerosService');
const ReportesService = require('./services/reportesService');
const UnidigitalService = require('./services/unidigitalService');
const FiscalPrinter = require('./engine/printer');

// Inicializar base de datos con datos semilla y triggers de inalterabilidad
seed();
applyTriggers();
CorrelativoEngine.init();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
};

function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, error, statusCode = 400) {
    const msg = error.message || error || 'Error interno del servidor';
    sendJSON(res, { error: true, mensaje: msg }, statusCode);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error("Formato JSON inválido en el cuerpo de la petición"));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // Manejo de CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = Object.fromEntries(parsedUrl.searchParams);

    try {
        // ==========================================
        // RUTAS DE LA API REST
        // ==========================================

        // --- TASA BCV Y CONFIGURACIÓN ---
        if (pathname === '/api/bcv/tasa' && method === 'GET') {
            return sendJSON(res, BCVManager.getTasaActual());
        }
        if (pathname === '/api/bcv/sincronizar' && method === 'POST') {
            const syncRes = await BCVManager.sincronizarTasaBCV();
            return sendJSON(res, syncRes);
        }
        if (pathname === '/api/bcv/tasa' && method === 'POST') {
            const body = await parseBody(req);
            const r = BCVManager.registrarTasa(body.tasa, body.fecha);
            return sendJSON(res, r);
        }
        if (pathname === '/api/configuracion' && method === 'GET') {
            const conf = db.get("SELECT * FROM configuracion WHERE id = 1");
            return sendJSON(res, conf);
        }
        if (pathname === '/api/configuracion' && method === 'POST') {
            const body = await parseBody(req);
            db.run(`
                UPDATE configuracion SET 
                    razon_social = COALESCE(?, razon_social),
                    rif = COALESCE(?, rif),
                    direccion = COALESCE(?, direccion),
                    telefono = COALESCE(?, telefono),
                    email = COALESCE(?, email),
                    modalidad_emision = COALESCE(?, modalidad_emision),
                    unidigital_token = COALESCE(?, unidigital_token),
                    unidigital_url = COALESCE(?, unidigital_url),
                    unidigital_ambiente = COALESCE(?, unidigital_ambiente),
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE id = 1
            `, [
                body.razon_social,
                body.rif,
                body.direccion,
                body.telefono,
                body.email,
                body.modalidad_emision,
                body.unidigital_token,
                body.unidigital_url,
                body.unidigital_ambiente
            ]);
            const conf = db.get("SELECT * FROM configuracion WHERE id = 1");
            return sendJSON(res, conf);
        }
        if (pathname === '/api/unidigital/probar-conexion' && method === 'POST') {
            const body = await parseBody(req);
            const resultado = await UnidigitalService.probarConexion(body.token, body.url);
            return sendJSON(res, resultado);
        }

        // --- PUNTO DE VENTA (MeDIa POS) ---
        if (pathname === '/api/pos/sesion' && method === 'GET') {
            const sesion = PosService.getSesionActiva();
            return sendJSON(res, sesion || null);
        }
        if (pathname === '/api/pos/abrir-caja' && method === 'POST') {
            const body = await parseBody(req);
            const sesion = PosService.abrirCaja(body.numero_caja, body.cajero, body.monto_ves, body.monto_usd);
            return sendJSON(res, sesion);
        }
        if (pathname === '/api/pos/cerrar-caja' && method === 'POST') {
            const body = await parseBody(req);
            const resultado = PosService.cerrarCaja(body.sesion_id, body.conteo_ves, body.conteo_usd);
            return sendJSON(res, resultado);
        }
        if (pathname === '/api/pos/venta' && method === 'POST') {
            const body = await parseBody(req);
            const resultado = PosService.procesarVenta(body);
            return sendJSON(res, resultado);
        }
        if (pathname === '/api/pos/reporte-x' && method === 'GET') {
            const reporte = PosService.generarReporteX();
            return sendJSON(res, { reporte });
        }
        if (pathname === '/api/pos/reporte-z' && method === 'POST') {
            const reporte = PosService.generarReporteZ();
            return sendJSON(res, { reporte });
        }
        if (pathname === '/api/pos/nota-credito' && method === 'POST') {
            const body = await parseBody(req);
            const resultado = PosService.procesarNotaCredito(body.factura_id, body.motivo);
            return sendJSON(res, resultado);
        }
        if (pathname === '/api/pos/auditoria-integridad' && method === 'GET') {
            const audit = CorrelativoEngine.auditarIntegridadYCorrelatividad();
            return sendJSON(res, audit);
        }
        if (pathname.startsWith('/api/pos/ticket/') && method === 'GET') {
            const parts = pathname.split('/');
            const ventaId = parts[parts.length - 1];
            const venta = db.get("SELECT * FROM ventas WHERE id = ? OR numero_factura_fiscal = ?", [ventaId, ventaId]);
            if (!venta) return sendError(res, "Venta fiscal no encontrada", 404);
            const cliente = db.get("SELECT * FROM clientes WHERE id = ?", [venta.cliente_id]) || { razon_social: 'CONSUMIDOR FINAL', rif_completo: 'V-00000000-0', direccion: 'Mostrador' };
            const items = db.query("SELECT * FROM ventas_items WHERE venta_id = ?", [venta.id]);
            const pagos = db.query("SELECT * FROM ventas_pagos WHERE venta_id = ?", [venta.id]);
            const printer = new FiscalPrinter();
            const ticketTexto = printer.generarTicketFiscal(venta, cliente, items, pagos);
            return sendJSON(res, { ticket: ticketTexto, venta });
        }

        // --- INVENTARIO & PRODUCTOS ---
        if (pathname === '/api/inventario/productos' && method === 'GET') {
            const prods = InventarioService.getProductos(query.busqueda, query.categoria_id);
            return sendJSON(res, prods);
        }
        if (pathname.startsWith('/api/inventario/producto/') && method === 'GET') {
            const codigo = decodeURIComponent(pathname.replace('/api/inventario/producto/', ''));
            const p = InventarioService.getProductoPorCodigo(codigo);
            if (!p) return sendError(res, "Producto no encontrado", 404);
            return sendJSON(res, p);
        }
        if (pathname === '/api/inventario/productos' && method === 'POST') {
            const body = await parseBody(req);
            const nuevo = InventarioService.crearProducto(body);
            return sendJSON(res, nuevo);
        }
        if (pathname === '/api/inventario/ajustar' && method === 'POST') {
            const body = await parseBody(req);
            const resAjuste = InventarioService.ajustarStock(body.producto_id, body.cantidad, body.tipo, body.motivo);
            return sendJSON(res, resAjuste);
        }
        if (pathname.startsWith('/api/inventario/kardex/') && method === 'GET') {
            const prodId = pathname.replace('/api/inventario/kardex/', '');
            const k = InventarioService.getKardex(prodId);
            return sendJSON(res, k);
        }
        if (pathname === '/api/inventario/categorias' && method === 'GET') {
            return sendJSON(res, InventarioService.getCategorias());
        }
        if (pathname === '/api/inventario/alertas' && method === 'GET') {
            return sendJSON(res, InventarioService.getAlertasStock());
        }

        // --- COMPRAS & RETENCIONES SENIAT ---
        if (pathname === '/api/compras' && method === 'GET') {
            return sendJSON(res, ComprasService.getCompras());
        }
        if (pathname === '/api/compras' && method === 'POST') {
            const body = await parseBody(req);
            const resComp = ComprasService.registrarCompra(body);
            return sendJSON(res, resComp);
        }

        // --- CLIENTES Y PROVEEDORES ---
        if (pathname === '/api/terceros/clientes' && method === 'GET') {
            return sendJSON(res, TercerosService.getClientes(query.busqueda));
        }
        if (pathname === '/api/terceros/clientes' && method === 'POST') {
            const body = await parseBody(req);
            const c = TercerosService.crearCliente(body);
            return sendJSON(res, c);
        }
        if (pathname === '/api/terceros/proveedores' && method === 'GET') {
            return sendJSON(res, TercerosService.getProveedores(query.busqueda));
        }
        if (pathname === '/api/terceros/proveedores' && method === 'POST') {
            const body = await parseBody(req);
            const p = TercerosService.crearProveedor(body);
            return sendJSON(res, p);
        }

        // --- REPORTES FISCALES Y GERENCIALES ---
        if (pathname === '/api/reportes/libro-ventas' && method === 'GET') {
            const lv = ReportesService.getLibroVentas(query.inicio, query.fin);
            return sendJSON(res, lv);
        }
        if (pathname === '/api/reportes/libro-ventas-csv' && method === 'GET') {
            const csv = ReportesService.exportarLibroVentasCSV(query.inicio, query.fin);
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="Libro_Ventas_SENIAT.csv"',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(csv);
            return;
        }
        if (pathname === '/api/reportes/libro-compras' && method === 'GET') {
            const lc = ReportesService.getLibroCompras(query.inicio, query.fin);
            return sendJSON(res, lc);
        }
        if (pathname === '/api/reportes/libro-compras-csv' && method === 'GET') {
            const csv = ReportesService.exportarLibroComprasCSV(query.inicio, query.fin);
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="Libro_Compras_SENIAT.csv"',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(csv);
            return;
        }
        if (pathname === '/api/reportes/retenciones-iva-txt' && method === 'GET') {
            const txtObj = SeniatExportEngine.generarTxtRetencionesIVA(query.inicio, query.fin);
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${txtObj.nombreSugerido}"`,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(txtObj.contenidoTxt);
            return;
        }
        if (pathname === '/api/reportes/gerencial' && method === 'GET') {
            const rg = ReportesService.getResumenGerencial();
            return sendJSON(res, rg);
        }

        if (pathname === '/api/inventario/upload-imagen' && method === 'POST') {
            const body = await parseBody(req);
            if (!body || !body.data) {
                return sendError(res, "No se recibió archivo de imagen", 400);
            }
            const base64Data = body.data;
            const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (!matches) {
                return sendError(res, "Formato de imagen inválido. Debe ser una imagen en base64.", 400);
            }
            const rawExt = matches[1].toLowerCase();
            const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt;
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `prod_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
            const uploadDir = path.join(PUBLIC_DIR, 'img', 'products');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const targetPath = path.join(uploadDir, fileName);
            fs.writeFileSync(targetPath, buffer);
            const publicUrl = `/img/products/${fileName}`;
            return sendJSON(res, { success: true, url: publicUrl });
        }

        // ==========================================
        // SERVIDOR DE ARCHIVOS ESTÁTICOS (FRONTEND)
        // ==========================================
        if (pathname === '/' || pathname === '/index.html') {
            res.writeHead(302, { 'Location': '/admin.html' });
            res.end();
            return;
        }

        let filePath = path.join(PUBLIC_DIR, pathname);

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            if (pathname.startsWith('/img/products/')) {
                const placeholder = path.join(PUBLIC_DIR, 'img', 'products', 'placeholder.svg');
                filePath = fs.existsSync(placeholder) ? placeholder : path.join(PUBLIC_DIR, 'admin.html');
            } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end("Archivo estático no encontrado");
                return;
            } else {
                filePath = path.join(PUBLIC_DIR, 'admin.html');
            }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end("Error al leer archivo estático");
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });

    } catch (error) {
        console.error('[MeDIa Server Error]', error);
        sendError(res, error, 500);
    }
});

// Intentar sincronizar tasa BCV automáticamente al iniciar
BCVManager.sincronizarTasaBCV().catch(err => {
    console.log('[MeDIa BCV] Aviso al iniciar:', err.message);
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  MeDIa - Suite Administrativa Básica + Punto de Venta `);
    console.log(`  Cumplimiento Tributario SENIAT / Banco Central (BCV) `);
    console.log(`  Servidor activo en: http://localhost:${PORT}        `);
    console.log(`=======================================================`);
});

