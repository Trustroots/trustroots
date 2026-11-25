/**
 * A stable numeric map feature id for an offer or note id. MapLibre encodes
 * GeoJSON feature ids as integers, so string ids cannot be promoted directly.
 */
export function featureId(id: string): number {
  let hash = 5381;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ id.charCodeAt(index)) >>> 0;
  }
  return hash;
}
