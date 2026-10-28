/**
 * Las tablas se crean solas al arrancar (idempotente). Sin datos de ejemplo: solo el acceso
 * inicial del panel y las dos cadenas del planteamiento (su dirección de búsqueda se edita en el panel).
 */
import { db } from './db.js';
import { hashClave } from './seguridad.js';

const TABLAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    clave_hash VARCHAR(255) NOT NULL,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sesiones (
    token_hash CHAR(64) PRIMARY KEY,
    tipo ENUM('equipo','farmacia') NOT NULL,
    ref_id INT NOT NULL,
    expira DATETIME NOT NULL,
    INDEX (expira)
  )`,
  `CREATE TABLE IF NOT EXISTS cadenas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    url_busqueda VARCHAR(500) NOT NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    orden INT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS farmacias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    responsable VARCHAR(120) NOT NULL DEFAULT '',
    telefono VARCHAR(20) NOT NULL DEFAULT '',
    whatsapp VARCHAR(20) NOT NULL DEFAULT '',
    correo VARCHAR(160) NOT NULL DEFAULT '',
    direccion VARCHAR(255) NOT NULL DEFAULT '',
    colonia VARCHAR(120) NOT NULL DEFAULT '',
    cp VARCHAR(5) NOT NULL DEFAULT '',
    ciudad VARCHAR(120) NOT NULL DEFAULT '',
    lat DECIMAL(9,6) NULL,
    lng DECIMAL(9,6) NULL,
    acepta_llamadas TINYINT(1) NOT NULL DEFAULT 1,
    acepta_whatsapp TINYINT(1) NOT NULL DEFAULT 1,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    acceso_hash CHAR(64) NULL,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (cp), INDEX (colonia)
  )`,
  `CREATE TABLE IF NOT EXISTS busquedas (
    id CHAR(16) PRIMARY KEY,
    medicamento VARCHAR(160) NOT NULL,
    zona VARCHAR(160) NOT NULL DEFAULT '',
    cp VARCHAR(5) NOT NULL DEFAULT '',
    lat DECIMAL(9,6) NULL,
    lng DECIMAL(9,6) NULL,
    paciente_whatsapp VARCHAR(20) NOT NULL DEFAULT '',
    principio_activo VARCHAR(200) NULL,
    genericos JSON NULL,
    genericos_estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fase2 TINYINT(1) NOT NULL DEFAULT 0,
    llamada_hecha TINYINT(1) NOT NULL DEFAULT 0,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (creado)
  )`,
  `CREATE TABLE IF NOT EXISTS resultados_cadena (
    id INT AUTO_INCREMENT PRIMARY KEY,
    busqueda_id CHAR(16) NOT NULL,
    cadena_id INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'consultando',
    producto VARCHAR(255) NULL,
    precio DECIMAL(10,2) NULL,
    url VARCHAR(500) NULL,
    detalle VARCHAR(500) NULL,
    actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (busqueda_id)
  )`,
  `CREATE TABLE IF NOT EXISTS respuestas_locales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    busqueda_id CHAR(16) NOT NULL,
    farmacia_id INT NOT NULL,
    token CHAR(32) NOT NULL UNIQUE,
    canal VARCHAR(20) NOT NULL DEFAULT 'panel',
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    precio DECIMAL(10,2) NULL,
    nota VARCHAR(500) NULL,
    transcripcion TEXT NULL,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    respondido DATETIME NULL,
    INDEX (busqueda_id), INDEX (farmacia_id)
  )`,
  `CREATE TABLE IF NOT EXISTS actividad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(40) NOT NULL,
    texto VARCHAR(500) NOT NULL,
    busqueda_id CHAR(16) NULL,
    creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (creado)
  )`,
  // Datos que el propio panel obtiene de una API (p. ej. el agente de voz que crea). Las claves siguen en el .env.
  `CREATE TABLE IF NOT EXISTS ajustes (
    clave VARCHAR(60) PRIMARY KEY,
    valor VARCHAR(500) NOT NULL,
    cambiado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

export async function migrar() {
  for (const t of TABLAS) await db.ejecutar(t);

  const { n } = await db.uno('SELECT COUNT(*) AS n FROM usuarios');
  if (!Number(n)) {
    const usuario = process.env.ADMIN_USUARIO || 'admin';
    const clave = process.env.ADMIN_CLAVE_INICIAL;
    if (!clave) throw new Error('Falta ADMIN_CLAVE_INICIAL en el .env para crear el acceso inicial del panel');
    await db.ejecutar('INSERT INTO usuarios (usuario, nombre, clave_hash) VALUES (?, ?, ?)', [usuario, 'Administrador', await hashClave(clave)]);
    console.log(`Acceso inicial del panel creado: usuario «${usuario}».`);
  }

  const { n: nc } = await db.uno('SELECT COUNT(*) AS n FROM cadenas');
  if (!Number(nc)) {
    // Las dos cadenas del planteamiento. `{q}` es lo que se busca. Se editan en Panel → Cadenas.
    // San Pablo no deja leer su web de forma automática: queda dada de alta pero en pausa.
    await db.ejecutar('INSERT INTO cadenas (nombre, url_busqueda, activa, orden) VALUES (?, ?, 0, 1), (?, ?, 1, 2), (?, ?, 1, 3), (?, ?, 1, 4)', [
      'Farmacias San Pablo', 'https://www.farmaciasanpablo.com.mx/search/?text={q}',
      'Farmacias del Ahorro', 'https://www.fahorro.com/catalogsearch/result/?q={q}',
      'Farmacias Guadalajara', 'https://www.farmaciasguadalajara.com/SearchDisplay?searchTerm={q}',
      'Farmacias Benavides', 'https://www.benavides.com.mx/catalogsearch/result/?q={q}',
    ]);
  }
}
