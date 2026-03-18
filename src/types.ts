
export interface DailyLog {
  date: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snacks?: string;
  water?: number;
  dairy?: string;
  exercise?: boolean;
  sunlight?: boolean;
  sleep?: string;
  stress?: number;
  pleasure?: boolean;
  whiteheads: number;
  cystic_acne: number;
  acne_state: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const defaultLog: DailyLog = {
  date: new Date().toISOString().split('T')[0],
  breakfast: '',
  lunch: '',
  dinner: '',
  snacks: '',
  water: 0,
  dairy: '',
  exercise: false,
  sunlight: false,
  sleep: '',
  stress: 0,
  pleasure: false,
  whiteheads: 0,
  cystic_acne: 0,
  acne_state: 0,
  notes: ''
};
