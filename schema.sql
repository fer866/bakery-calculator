-- ==========================================================
-- Schema DDL para Cloudflare D1: bakery-db
-- Bakery Calculator - Migración a SQLite Cloudflare D1
-- ==========================================================

-- 1. Tabla: Insumos (Materias primas e inventario)
CREATE TABLE IF NOT EXISTS insumos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  proveedor TEXT DEFAULT '',
  cantidadPres REAL NOT NULL DEFAULT 1,
  unidadPres TEXT NOT NULL DEFAULT 'kg',
  precioPres REAL NOT NULL DEFAULT 0,
  stockActual REAL NOT NULL DEFAULT 0,
  stockMinimo REAL NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insumos_nombre ON insumos(nombre);

-- 2. Tabla: Postres (Recetas y fichas técnicas)
CREATE TABLE IF NOT EXISTS postres (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  piezasPorLote REAL NOT NULL DEFAULT 1,
  pesoPieza REAL DEFAULT 0,
  precioVenta REAL DEFAULT 0,
  mermaPct REAL DEFAULT 0,
  indirectos_json TEXT NOT NULL DEFAULT '{}',
  insumos_json TEXT NOT NULL DEFAULT '[]',
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_postres_nombre ON postres(nombre);

-- 3. Tabla: Gastos Generales (Costos indirectos y datos de la empresa)
CREATE TABLE IF NOT EXISTS gastos_generales (
  id TEXT PRIMARY KEY DEFAULT 'global_indirects',
  nombreNegocio TEXT DEFAULT '',
  gasMinutos REAL DEFAULT 18,
  costoGasPorMinuto REAL DEFAULT 0.2667,
  tarifaHoraManoObra REAL DEFAULT 80.0,
  tiempoManoObraMin REAL DEFAULT 45,
  empaquePorPieza REAL DEFAULT 2.0,
  otrosIndirectos REAL DEFAULT 0.0,
  updatedAt INTEGER NOT NULL
);

-- 4. Tabla: Lotes Horneados (Historial de producción y deducciones de stock)
CREATE TABLE IF NOT EXISTS lotes_horneados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postreId TEXT NOT NULL,
  postreNombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  piezasReales REAL NOT NULL DEFAULT 1,
  costoTotalHistorico REAL NOT NULL DEFAULT 0,
  insumos_descontados_json TEXT NOT NULL DEFAULT '[]',
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lotes_fecha ON lotes_horneados(fecha);
CREATE INDEX IF NOT EXISTS idx_lotes_postreId ON lotes_horneados(postreId);
