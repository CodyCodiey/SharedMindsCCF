import { createGraphVersion } from '../shared/graph-version.js';

export const meta = {
  id: 'brainmap',
  title: '3 · Brain map',
  blurb: 'Nothing retires. Ideas quote you, chunk by shared vocabulary, and the view scales to hold them all.',
};

export function create() {
  return createGraphVersion({ retire: 0, quotes: true, chunking: true, fit: true });
}
