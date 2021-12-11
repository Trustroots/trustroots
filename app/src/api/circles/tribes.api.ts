import circles from './data.json'
import { Circle } from './types';

export async function join(tribeId) {
 
}

export async function leave(tribeId) {

}

export async function read({ limit = 50 } = {}): Promise<Circle[]> {
  return circles;
}

export async function get(slug: string): Promise<Circle> {
  return circles[0];
}
