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

export interface ReferenceCustomer {
  id: string;
  name: string;
  type: 'own' | 'ktt';
}

export interface ReferenceWagonType {
  id: string;
  name: string;
  code?: string;
  workload_coefficient?: number;
}

export interface ReferenceSection {
  id: string;
  label: string;
  group: 'waiting' | 'directed' | 'release' | 'other';
}

export interface ReferenceDepot {
  id: string;
  code: string;
  name: string;
  city?: string;
  daily_capacity?: number;
}

export interface ReferenceRepairItem {
  code: string;
  name: string;
}

export interface ArsReferences {
  customers: ReferenceCustomer[];
  wagonTypes: ReferenceWagonType[];
  sections: ReferenceSection[];
  depots: ReferenceDepot[];
  repairs?: ReferenceRepairItem[];
}

export interface ShiftWagonRow {
  id: string;
  depot_code: string;
  section: string;
  customer: string;
  wagon_number: string;
  wagon_type: string;
  repair_type: string;
  submission_date: string;
  track_or_location: string;
  reason_details: string;
}

export interface DepotKpShiftData {
  kp_nonk: number;
  kp_sonk: number;
  kp_sr_ob: number;
  kp_tr_ob: number;
  kp_sr_bez: number;
  kp_tr_bez: number;
  stock_ckk_ktt: number;
  stock_sonk_ktt: number;
  stock_ckk_ktz: number;
  stock_sonk_ktz: number;
  stock_rem_ktt: number;
}

export interface ArsUserAccount {
  password: string;
  role: 'headquarters' | 'branch';
  depot_code: string;
  display_name: string;
}

export interface ArsAuthSession {
  username: string;
  role: 'headquarters' | 'branch';
  depot_code: string;
  display_name: string;
}

declare global {
  interface Window {
    ARS_USERS?: Record<string, ArsUserAccount>;
    DEFAULT_ARS_REPAIRS?: ReferenceRepairItem[];
    REPAIR_TYPES?: Array<ReferenceRepairItem | string>;
    getRepairCode?: (r: ReferenceRepairItem | string) => string;
    getRepairName?: (r: ReferenceRepairItem | string) => string;
    renderRefRepairsTable?: () => void;
    handleAddRepairType?: () => void;
    handleDeleteRepairType?: (code: string) => void;
    renderBranchMatrixTable?: () => void;
    updateAllWagonRepairSelects?: () => void;
    openReferencesModal?: () => void;
    closeReferencesModal?: () => void;
    switchRefTab?: (tabId: string) => void;
    handleAddCustomer?: () => void;
    handleAddWagonType?: () => void;
    handleAddSection?: () => void;
    handleAddDepot?: () => void;
    handleDeleteCustomer?: (id: string) => void;
    handleDeleteWagonType?: (id: string) => void;
    handleDeleteSection?: (id: string) => void;
    handleDeleteDepot?: (id: string) => void;
    selectDepot?: (depotCode: string) => void;
    switchTab?: (tabId: string) => void;
    syncMatrixFromWagons?: (animate?: boolean) => void;
    isKTT?: (customer: string) => boolean;
    addWagonRow?: () => void;
    removeWagonRow?: (id: string) => void;
    handleLogin?: () => void;
    handleLogout?: () => void;
    fillLoginCredentials?: (username: string, password: string) => void;
    exportDailyReportCSV?: () => void;
    handleExportReportClick?: () => void;
    currentDepot?: string;
    DEPOT_LABELS?: Record<string, string>;
    currentUser?: ArsAuthSession | null;
    currentReportData?: {
      wheel_pairs?: Record<string, number>;
    };
    ARS_FLIGHT_RECORDER?: {
      stepCount: number;
      logs: Array<{
        step: number;
        time: string;
        type: string;
        desc: string;
        meta?: { stack?: string } | null;
        stateSnapshot: {
          depot: string;
          user: string;
          date: string;
          wagonsCount: number;
        };
      }>;
    };
    recordDevStep?: (type: string, description: string, meta?: { stack?: string } | null) => void;
    renderDevLog?: () => void;
    clearDevLog?: () => void;
    copyDevBugReport?: () => void;
    openAuditLogModal?: (initialTab?: string) => void;
    closeAuditLogModal?: () => void;
    switchAuditTab?: (tab: string) => void;
    resetCurrentShift?: () => void;
    showToast?: (message: string) => void;
    logSystemAction?: (category: string, details: string) => void;
    isolateAiAnalystForBranch?: () => void;
    checkAuthAndInit?: () => Promise<void> | void;
    updateShiftMasterKpi?: (depotCode?: string, data?: Record<string, unknown> | null) => void;
    initDatePickerComponent?: () => void;
    updateDatePickerDisplay?: () => void;
    renderCalendarGrid?: () => void;
    stepDateDay?: (offsetDays: number) => void;
    stepCalMonth?: (offsetMonths: number) => void;
    onCalMonthYearChange?: () => void;
    goToTodayDate?: () => void;
    setRelativeDateDay?: (offsetDays: number) => void;
    toggleCalendarPopover?: (event?: MouseEvent | React.MouseEvent) => void;
    closeCalendarPopover?: () => void;
    onDateChange?: (val: string) => void;
    setReportDateMode?: (mode: 'daily' | 'period') => void;
    applyPeriodPreset?: (preset: '7days' | 'thisMonth' | 'lastMonth' | 'ytd') => void;
    toggleSectionVisibility?: (
      sectionKey: 'bannerKpi' | 'sectionMatrix' | 'sectionWagons' | 'sectionWheels' | 'sectionAiAnalyst',
      visible?: boolean
    ) => void;
    OCTOBER_2026_DATA?: Record<string, unknown>;
    loadCurrentBranchReport?: (depotCode?: string, dateStr?: string) => void;
    calcBranchMatrix?: () => void;
  }
}




