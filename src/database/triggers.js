const db = require('./db');

function applyFiscalSecurityTriggers() {
    db.exec(`
        -- 1. PROHIBICIÓN ABSOLUTA DE ELIMINAR FACTURAS TIMBRADAS
        CREATE TRIGGER IF NOT EXISTS trg_bloqueo_delete_ventas
        BEFORE DELETE ON ventas
        BEGIN
            SELECT RAISE(ABORT, 'SENIAT VIOLACION: Inalterabilidad Fiscal. Queda terminantemente prohibido eliminar facturas timbradas.');
        END;

        -- 2. PROHIBICIÓN ABSOLUTA DE EDITAR CAMPOS FISCALES TIMBRADOS
        CREATE TRIGGER IF NOT EXISTS trg_bloqueo_update_ventas_fiscal
        BEFORE UPDATE OF numero_factura_fiscal, numero_control, total_venta_ves, monto_igtf_ves, tasa_bcv_snapshot, fecha ON ventas
        BEGIN
            SELECT RAISE(ABORT, 'SENIAT VIOLACION: Inalterabilidad Fiscal. Prohibido alterar montos o datos de facturas timbradas. Cualquier correccion debe ser mediante Nota de Credito.');
        END;
    `);
    console.log('[MeDIa] Triggers de inalterabilidad y bloqueo fiscal aplicados con éxito.');
}

applyFiscalSecurityTriggers();

module.exports = applyFiscalSecurityTriggers;

