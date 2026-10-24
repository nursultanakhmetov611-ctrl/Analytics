export interface Depot {
  code: string;
  name: string;
  city: string;
  daily_capacity: number;
}

export interface RepairType {
  code: string;
  name: string;
  is_scheduled: boolean;
  description: string;
}

export interface WagonType {
  code: string;
  name: string;
  workload_coefficient: number;
}

export interface SummaryReportRow {
  row_index: number;
  report_date: string;
  depot_code: string;
  repair_category: string;
  customer_group: string;
  month_plan: number;
  done_today: number;
  done_month: number;
  staged_today: number;
  plan_variance: number;
  unfinished_repair: number;
  ytd_total: number;
  section: string;
  sub_segment: string;
  completion_pct: number;
}

export interface WagonDislocationRow {
  id: number;
  report_date: string;
  depot_code: string;
  wagon_number: string;
  customer_name: string;
  contract_info: string;
  repair_type: string;
  status: string;
  status_ru: string;
  submission_date: string;
  formatted_submission_date: string;
  track_or_location: string;
  reason_details: string;
  raw_sheet: string;
}

export interface WheelPairProductionRow {
  report_date: string;
  depot_code: string;
  customer_name: string;
  repair_type: string;
  wagon_type: string;
  body_units: number;
  nonk: number;
  sonk_sr_bo: number;
  davalcheskie: number;
  sonk: number;
  sr_obtochka: number;
  sr_razdelka: number;
  tr_obtochka: number;
  sr_bez_obtochki: number;
  tr_bez_obtochki: number;
  total_kp: number;
}

export interface WheelPairStockRow {
  report_date: string;
  depot_code: string;
  stock_category: string;
  quantity: number;
  details: string;
}

export interface DailyOutputRow {
  report_year: number;
  report_month: number;
  report_date: string;
  day_of_month: number;
  depot_code: string;
  customer_name: string;
  repair_type: string;
  wagon_type: string;
  wagons_output: number;
  workers_on_shift: number | null;
}

export interface ArsDataset {
  company: string;
  description: string;
  depots: Depot[];
  repair_types: RepairType[];
  wagon_types: WagonType[];
  summary_reports: SummaryReportRow[];
  wagon_dislocations_and_stalls: WagonDislocationRow[];
  wheel_pairs_production: WheelPairProductionRow[];
  wheel_pair_stocks: WheelPairStockRow[];
  daily_output_october: DailyOutputRow[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  source?: string;
}
