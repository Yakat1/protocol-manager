import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_CURVES = () => [
  { id: 'c1', name: 'Curva 1', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] },
  { id: 'c2', name: 'Curva 2', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] },
  { id: 'c3', name: 'Curva 3', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] }
];