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
}

const dbInstance = new DBManager();
module.exports = dbInstance;

