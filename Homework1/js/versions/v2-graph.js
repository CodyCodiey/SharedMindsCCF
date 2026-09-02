import { createGraphVersion } from '../shared/graph-version.js';

export const meta = {
  id: 'graph',
  title: '2 · Idea graph',
  blurb: 'Black and white. Ideas name themselves and drift under spring physics; weak ones retire.',
};

export function create() {
  return createGraphVersion({ retire: 26, quotes: false, chunking: false, fit: false });
}
