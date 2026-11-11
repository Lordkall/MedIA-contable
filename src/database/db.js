const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', '..', 'media_contable.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class DBManager {
    constructor() {
        this.db = new DatabaseSync(DB_PATH);
        this.init();
    }

    init() {
        this.db.exec("PRAGMA foreign_keys = ON;");
        if (fs.existsSync(SCHEMA_PATH)) {
            const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
            this.db.exec(schemaSql);
        }
        try {
            this.db.exec("ALTER TABLE productos ADD COLUMN imagen_url TEXT;");
        } catch (e) {
            // Columna ya existe
        }
        try { this.db.exec("ALTER TABLE configuracion ADD COLUMN modalidad_emision TEXT DEFAULT 'LOCAL';"); } catch (e) {}
        try { this.db.exec("ALTER TABLE configuracion ADD COLUMN unidigital_token TEXT DEFAULT '';"); } catch (e) {}
        try { this.db.exec("ALTER TABLE configuracion ADD COLUMN unidigital_url TEXT DEFAULT 'https://api-sandbox.unidigital.com.ve/v1';"); } catch (e) {}
        try { this.db.exec("ALTER TABLE configuracion ADD COLUMN unidigital_ambiente TEXT DEFAULT 'SANDBOX';"); } catch (e) {}
        try { this.db.exec("ALTER TABLE ventas ADD COLUMN unidigital_id TEXT;"); } catch (e) {}
        try { this.db.exec("ALTER TABLE ventas ADD COLUMN unidigital_pdf_url TEXT;"); } catch (e) {}
        try { this.db.exec("ALTER TABLE ventas ADD COLUMN unidigital_xml_url TEXT;"); } catch (e) {}
        try { this.db.exec("ALTER TABLE ventas ADD COLUMN unidigital_qr TEXT;"); } catch (e) {}
        try { this.db.exec("ALTER TABLE ventas ADD COLUMN unidigital_status TEXT;"); } catch (e) {}
    }

    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }

    get(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.get(...params);
    }

    run(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.run(...params);
    }

    exec(sql) {
        return this.db.exec(sql);
    }

    reemplazarYReabrir(rutaNuevoDb) {
        this.db.close();
        fs.copyFileSync(rutaNuevoDb, DB_PATH);
        try { if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal'); } catch(e){}
        try { if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm'); } catch(e){}
        this.db = new DatabaseSync(DB_PATH);
        this.init();
    }
}

const dbInstance = new DBManager();
module.exports = dbInstance;

