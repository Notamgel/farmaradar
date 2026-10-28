/**
 * Google Geocoding (con GOOGLE_MAPS_API_KEY): de texto a coordenadas y de coordenadas a calle y colonia.
 * Si no hay clave o Google no contesta, devuelve null y todo sigue igual.
 */
const clave = () => String(process.env.GOOGLE_MAPS_API_KEY ?? '').trim();
const URL_GEO = 'https://maps.googleapis.com/maps/api/geocode/json';

const parte = (comps, ...tipos) => comps.find((c) => tipos.some((t) => c.types.includes(t)))?.long_name ?? '';

function lee(r) {
  const c = r.address_components ?? [];
  return {
    lat: r.geometry.location.lat, lng: r.geometry.location.lng,
    calle: parte(c, 'route'),
    colonia: parte(c, 'sublocality_level_1', 'neighborhood', 'sublocality'),
    cp: parte(c, 'postal_code').slice(0, 5),
    ciudad: parte(c, 'locality') || parte(c, 'administrative_area_level_2') || parte(c, 'administrative_area_level_1'),
  };
}

/** «Polanco», «11560», «Col. Roma, CDMX»… → {lat, lng, colonia, cp, ciudad} o null (solo México). */
export async function geocodifica(texto) {
  if (!clave() || !String(texto ?? '').trim()) return null;
  try {
    const u = `${URL_GEO}?address=${encodeURIComponent(`${texto}, México`)}&region=mx&components=country:MX&language=es&key=${clave()}`;
    const d = await (await fetch(u, { signal: AbortSignal.timeout(8000) })).json();
    return d.status === 'OK' && d.results[0] ? lee(d.results[0]) : null;
  } catch { return null; }
}

/** Coordenadas → la calle, colonia, CP y ciudad más cercanas, o null. */
export async function reverso(lat, lng) {
  if (!clave()) return null;
  try {
    const u = `${URL_GEO}?latlng=${lat},${lng}&language=es&result_type=street_address|route|premise&key=${clave()}`;
    const d = await (await fetch(u, { signal: AbortSignal.timeout(8000) })).json();
    return d.status === 'OK' && d.results[0] ? lee(d.results[0]) : null;
  } catch { return null; }
}
