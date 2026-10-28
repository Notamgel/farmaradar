// Da de alta farmacias de demostración en las zonas de abajo (5 por zona). Uso: node scripts/demo-farmacias.mjs
// Se pueden borrar todas desde Panel → Farmacias («Borrar las de demostración»).
import '../lib/entorno.js';
import { db } from '../lib/db.js';
import { migrar } from '../lib/esquema.js';
import { creaAlrededor } from '../lib/demo.js';

const ZONAS = [
  // Ciudad de México
  ['Polanco', 19.4330, -99.1910], ['Roma Norte', 19.4190, -99.1620], ['Condesa', 19.4120, -99.1730], ['Del Valle', 19.3850, -99.1670],
  ['Narvarte', 19.3950, -99.1550], ['Coyoacán', 19.3500, -99.1620], ['Centro Histórico', 19.4330, -99.1340], ['Santa María la Ribera', 19.4500, -99.1580],
  ['Lindavista', 19.4880, -99.1290], ['Tlalpan', 19.2900, -99.1680], ['Iztapalapa', 19.3570, -99.0930], ['Santa Fe', 19.3600, -99.2600],
  ['Xochimilco', 19.2620, -99.1050], ['Azcapotzalco', 19.4840, -99.1840], ['Escandón', 19.4040, -99.1800], ['Portales', 19.3700, -99.1480],
  ['Nápoles', 19.3930, -99.1770], ['San Ángel', 19.3460, -99.1900], ['Iztacalco', 19.3950, -99.0970], ['Gustavo A. Madero', 19.4820, -99.1100],
  ['Venustiano Carranza', 19.4300, -99.1000], ['Tláhuac', 19.2860, -99.0050], ['Magdalena Contreras', 19.3320, -99.2120], ['Cuajimalpa', 19.3570, -99.2990],
  // Zona metropolitana
  ['Satélite', 19.5100, -99.2350], ['Naucalpan', 19.4750, -99.2380], ['Tlalnepantla', 19.5400, -99.1950], ['Ecatepec', 19.6010, -99.0500],
  ['Nezahualcóyotl', 19.4000, -99.0150], ['Interlomas', 19.3980, -99.2770], ['Coacalco', 19.6290, -99.1100], ['Chalco', 19.2640, -98.8970],
  // Otras ciudades
  ['Guadalajara Centro', 20.6760, -103.3470], ['Providencia, Guadalajara', 20.6900, -103.3900], ['Chapalita, Guadalajara', 20.6680, -103.4000],
  ['Zapopan', 20.7210, -103.3910], ['Tlaquepaque', 20.6400, -103.3120], ['Monterrey Centro', 25.6700, -100.3100], ['San Pedro Garza García', 25.6510, -100.3560],
  ['Cumbres, Monterrey', 25.7300, -100.4000], ['San Nicolás de los Garza', 25.7450, -100.3020], ['Guadalupe, Nuevo León', 25.6770, -100.2600],
  ['Puebla Centro', 19.0430, -98.1980], ['La Paz, Puebla', 19.0500, -98.2200], ['Cholula', 19.0630, -98.3060], ['Querétaro', 20.5930, -100.3920],
  ['Juriquilla', 20.7100, -100.4460], ['Mérida', 20.9670, -89.6230], ['Mérida Norte', 21.0200, -89.6100], ['Tijuana', 32.5250, -117.0300],
  ['León', 21.1220, -101.6820], ['Aguascalientes', 21.8820, -102.2960], ['San Luis Potosí', 22.1500, -100.9750], ['Morelia', 19.7020, -101.1920],
  ['Toluca', 19.2880, -99.6560], ['Metepec', 19.2560, -99.6050], ['Cuernavaca', 18.9220, -99.2340], ['Pachuca', 20.1010, -98.7590],
  ['Veracruz', 19.1900, -96.1530], ['Xalapa', 19.5400, -96.9250], ['Oaxaca', 17.0610, -96.7250], ['Tuxtla Gutiérrez', 16.7530, -93.1150],
  ['Villahermosa', 17.9890, -92.9300], ['Cancún', 21.1610, -86.8510], ['Playa del Carmen', 20.6290, -87.0740], ['Acapulco', 16.8530, -99.8820],
  ['Chihuahua', 28.6350, -106.0890], ['Ciudad Juárez', 31.6900, -106.4240], ['Hermosillo', 29.0730, -110.9560], ['Culiacán', 24.8090, -107.3940],
  ['Mazatlán', 23.2490, -106.4110], ['Saltillo', 25.4230, -101.0050], ['Torreón', 25.5420, -103.4060], ['Durango', 24.0270, -104.6530],
  ['Zacatecas', 22.7700, -102.5830], ['Tampico', 22.2550, -97.8690], ['Reynosa', 26.0920, -98.2780], ['Mexicali', 32.6250, -115.4520],
  ['La Paz, BCS', 24.1420, -110.3100], ['Tepic', 21.5040, -104.8950], ['Colima', 19.2430, -103.7250], ['Campeche', 19.8450, -90.5240],
  ['Tlaxcala', 19.3180, -98.2370], ['Celaya', 20.5230, -100.8150], ['Irapuato', 20.6770, -101.3560], ['Puerto Vallarta', 20.6530, -105.2250],
];

await migrar();
const antes = (await db.uno('SELECT COUNT(*) n FROM farmacias WHERE demo = 1')).n;
let total = 0;
for (const [nombre, lat, lng] of ZONAS) {
  const ya = await db.todos('SELECT lat, lng FROM farmacias WHERE demo = 1 AND ABS(lat - ?) < 0.03 AND ABS(lng - ?) < 0.03', [lat, lng]);
  if (ya.length >= 4) continue; // esa zona ya tiene
  const n = await creaAlrededor({ lat, lng }, 5, { minKm: 0.2, maxKm: 2.2 });
  total += n;
  process.stdout.write(`${nombre}: ${n} · `);
}
console.log(`\nListo: ${total} farmacias de demostración nuevas (antes había ${antes}).`);
await db.cerrar();
