import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowUpRight, Search, RotateCcw, CheckCircle2, Clock } from 'lucide-react';
import {
  ArsAuthSession,
  ArsDataset,
  ArsReferences,
  ShiftWagonRow,
  DepotKpShiftData,
  ReferenceRepairItem,
} from '../types/ars';
import {
  DEFAULT_ARS_REPAIRS,
  getRepairCode,
  getRepairName,
} from './ReferencesModal';

interface DailyOutputViewProps {
  data: ArsDataset;
  references: ArsReferences;
  currentUser?: ArsAuthSession | null;
  onAskAnalyst: (prompt: string) => void;
}

const STORAGE_KEY_SHIFT_WAGONS = 'ars_daily_shift_wagons_oct2026_v2';
const STORAGE_KEY_SHIFT_KP = 'ars_daily_shift_kp_oct2026_v2';
const STORAGE_KEY_HQ_STATUS = 'ars_daily_hq_status_2026_v1';

export interface OctoberFactGroup {
  cust: string;
  rep: string;
  wt: string;
  cnt: number;
}

export interface OctoberDepotFact {
  waiting: OctoberFactGroup[];
  directed: OctoberFactGroup[];
  release: OctoberFactGroup[];
}

// Официальные исторические данные ТОО "ARS" за ОКТЯБРЬ 2026 года (с 1 по 21 октября)
export const OCTOBER_2026_DATA: {
  daily_release: Record<number, [number, number, number, number]>;
  daily_wheel_pairs: Record<number, [number, number, number, number]>;
  fact_21_oct: Record<'AVRD' | 'BVRD' | 'KVRD' | 'UVRD', OctoberDepotFact>;
} = {
  // Выпуск вагонов посуточно за 1..21 октября: [АВРД, БВРД, КВРД, УВРД]
  daily_release: {
    1:  [9, 0, 0, 0],
    2:  [11, 0, 0, 0],
    3:  [9, 4, 4, 6],
    4:  [10, 4, 8, 4],
    5:  [8, 3, 8, 4],
    6:  [11, 0, 7, 0],
    7:  [12, 4, 3, 8],
    8:  [13, 3, 6, 8],
    9:  [11, 0, 5, 0],
    10: [9, 1, 4, 0],
    11: [14, 3, 5, 8],
    12: [7, 5, 6, 8],
    13: [9, 0, 7, 0],
    14: [12, 2, 6, 0],
    15: [9, 3, 4, 7],
    16: [10, 2, 7, 8],
    17: [8, 2, 6, 0],
    18: [6, 2, 6, 0],
    19: [7, 5, 6, 7],
    20: [9, 4, 7, 7],
    21: [8, 3, 4, 0], // 21 октября (15 ваг. всего)
  },
  // Ремонт колёсных пар посуточно [АВРД, БВРД, КВРД, УВРД]
  daily_wheel_pairs: {
    3: [0, 0, 17, 4], 4: [0, 0, 9, 16], 5: [0, 0, 5, 0],
    6: [0, 0, 2, 0],  7: [0, 0, 13, 0], 8: [0, 23, 3, 4],
    10: [0, 0, 41, 0], 11: [0, 0, 4, 4], 12: [0, 4, 17, 6],
    13: [0, 0, 4, 0], 14: [0, 0, 1, 0], 15: [0, 18, 50, 2],
    16: [0, 0, 12, 10], 17: [0, 0, 4, 0], 18: [0, 0, 9, 0],
    20: [0, 8, 4, 6], 21: [0, 0, 11, 0],
  },
  // Фактическая расстановка вагонов на 21.10.2026 (93 на станции, 20 на подходе, 15 выпуск)
  fact_21_oct: {
    AVRD: {
      waiting: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 4 },
        { cust: 'АО "Казтемиртранс"', rep: 'КР', wt: 'Крытый', cnt: 9 },
        { cust: 'ТОО "Исткомтранс"', rep: 'КР', wt: 'Цистерна', cnt: 1 },
      ],
      directed: [{ cust: 'ТОО "РТА Транс"', rep: 'ДР', wt: 'Крытый', cnt: 3 }],
      release: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 2 },
        { cust: 'ТОО "Исткомтранс"', rep: 'ДР', wt: 'Полувагон', cnt: 4 },
        { cust: 'ТОО "ЦЖС"', rep: 'КР', wt: 'Цистерна', cnt: 2 },
      ],
    },
    BVRD: {
      waiting: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 11 },
        { cust: 'АО "Казтемиртранс"', rep: 'КР', wt: 'Полувагон', cnt: 7 },
        { cust: 'ТОО "Бизнес-Тренд"', rep: 'ТОР', wt: 'Полувагон', cnt: 1 },
      ],
      directed: [{ cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 2 }],
      release: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 1 },
        { cust: 'ТОО "Транко"', rep: 'ДР', wt: 'Цистерна', cnt: 2 },
      ],
    },
    KVRD: {
      waiting: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 6 },
        { cust: 'АО "Казтемиртранс"', rep: 'КР', wt: 'Полувагон', cnt: 5 },
        { cust: 'ТОО "Вагон КП"', rep: 'ДР', wt: 'Полувагон', cnt: 4 },
        { cust: 'ТОО "РТС Холдинг"', rep: 'КР', wt: 'Полувагон', cnt: 13 },
      ],
      directed: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 3 },
        { cust: 'АО "Казтемиртранс"', rep: 'КР', wt: 'Полувагон', cnt: 7 },
        { cust: 'ТОО "Петролеум"', rep: 'ДР', wt: 'Цистерна', cnt: 2 },
        { cust: 'ТОО "Интерлог"', rep: 'КР', wt: 'Полувагон', cnt: 1 },
      ],
      release: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 1 },
        { cust: 'ТОО "Вагон КП"', rep: 'ДР', wt: 'Полувагон', cnt: 1 },
        { cust: 'ТОО "РТА Транс"', rep: 'КР', wt: 'Крытый', cnt: 1 },
        { cust: 'ТОО "Транском"', rep: 'ТОР', wt: 'Полувагон', cnt: 1 },
      ],
    },
    UVRD: {
      waiting: [
        { cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 15 },
        { cust: 'АО "Казтемиртранс"', rep: 'КР', wt: 'Крытый', cnt: 11 },
        { cust: 'ТОО "Каз Прибор Сервис"', rep: 'ДР', wt: 'Полувагон', cnt: 2 },
        { cust: 'ТОО "Жайык Ет"', rep: 'ТОР', wt: 'Крытый', cnt: 4 },
      ],
      directed: [{ cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 2 }],
      release: [],
    },
  },
};

const DEPOT_ORDER: Array<'AVRD' | 'BVRD' | 'KVRD' | 'UVRD'> = ['AVRD', 'BVRD', 'KVRD', 'UVRD'];

// Генератор реалистичных 8-значных сетевых номеров вагонов по роду подвижного состава
function generateRealisticWagonNumber(
  wagonType: string,
  depotIdx: number,
  statusIdx: number,
  seq: number
): string {
  const wtLower = (wagonType || '').toLowerCase();
  const offset = depotIdx * 120000 + statusIdx * 30000 + seq * 137 + 1042;
  if (wtLower.includes('крыт')) {
    return String(52100000 + (offset % 7800000));
  }
  if (wtLower.includes('цистерн')) {
    return String(73100000 + (offset % 6800000));
  }
  // Полувагон и прочие -> серия 6...
  return String(60100000 + (offset % 8800000));
}

// Формирование пономерного списка вагонов из OCTOBER_2026_DATA для выбранной даты октября
export function buildOctober2026WagonsForDate(isoDate = '2026-10-21'): ShiftWagonRow[] {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : '2026-10-21';
  const isOct2026 = cleanDate.startsWith('2026-10-');
  const dayNum = isOct2026 ? parseInt(cleanDate.slice(8, 10), 10) : 21;

  const rows: ShiftWagonRow[] = [];
  let globalSeq = 1;

  DEPOT_ORDER.forEach((depotCode, depotIdx) => {
    const fact = OCTOBER_2026_DATA.fact_21_oct[depotCode];
    if (!fact) return;

    // 1. В ожидании на станции ('AT_STATION') — 93 вагона по холдингу
    fact.waiting.forEach((grp) => {
      for (let i = 0; i < grp.cnt; i++) {
        rows.push({
          id: `oct26-${depotCode}-wait-${globalSeq}`,
          depot_code: depotCode,
          section: 'AT_STATION',
          customer: grp.cust,
          wagon_number: generateRealisticWagonNumber(grp.wt, depotIdx, 1, globalSeq),
          wagon_type: grp.wt,
          repair_type: grp.rep,
          submission_date: cleanDate,
          track_or_location: `Ст. ${depotCode}, путь ожидания`,
          reason_details: `В ожидании ремонта (${grp.rep})`,
        });
        globalSeq++;
      }
    });

    // 2. На подходе к станции ('EN_ROUTE') — 20 вагонов по холдингу
    fact.directed.forEach((grp) => {
      for (let i = 0; i < grp.cnt; i++) {
        rows.push({
          id: `oct26-${depotCode}-dir-${globalSeq}`,
          depot_code: depotCode,
          section: 'EN_ROUTE',
          customer: grp.cust,
          wagon_number: generateRealisticWagonNumber(grp.wt, depotIdx, 2, globalSeq),
          wagon_type: grp.wt,
          repair_type: grp.rep,
          submission_date: cleanDate,
          track_or_location: `На подходе к ст. ${depotCode}`,
          reason_details: `Направлен в ремонт (${grp.rep})`,
        });
        globalSeq++;
      }
    });

    // 3. Выпуск за смену ('RELEASE')
    if (cleanDate === '2026-10-21' || !OCTOBER_2026_DATA.daily_release[dayNum]) {
      // На 21.10.2026 используем точную структуру из fact_21_oct.release (15 вагонов: 11 ДР, 3 КР, 1 ТОР)
      fact.release.forEach((grp) => {
        for (let i = 0; i < grp.cnt; i++) {
          rows.push({
            id: `oct26-${depotCode}-rel-${globalSeq}`,
            depot_code: depotCode,
            section: 'RELEASE',
            customer: grp.cust,
            wagon_number: generateRealisticWagonNumber(grp.wt, depotIdx, 3, globalSeq),
            wagon_type: grp.wt,
            repair_type: grp.rep,
            submission_date: cleanDate,
            track_or_location: `Выставочный путь ${depotCode}`,
            reason_details: `Выпуск из ремонта ВУ-36М (${grp.rep})`,
          });
          globalSeq++;
        }
      });
    } else {
      // Для дат 1..20 октября формируем точное число выпущенных вагонов из daily_release[dayNum][depotIdx]
      const targetRelCount = OCTOBER_2026_DATA.daily_release[dayNum]?.[depotIdx] ?? 0;
      const templates =
        fact.release.length > 0
          ? fact.release
          : fact.waiting.length > 0
          ? fact.waiting
          : [{ cust: 'АО "Казтемиртранс"', rep: 'ДР', wt: 'Полувагон', cnt: 1 }];

      for (let i = 0; i < targetRelCount; i++) {
        const tpl = templates[i % templates.length];
        rows.push({
          id: `oct26-${cleanDate}-${depotCode}-rel-${globalSeq}`,
          depot_code: depotCode,
          section: 'RELEASE',
          customer: tpl.cust,
          wagon_number: generateRealisticWagonNumber(tpl.wt, depotIdx, 3, globalSeq + dayNum * 19),
          wagon_type: tpl.wt,
          repair_type: tpl.rep,
          submission_date: cleanDate,
          track_or_location: `Выставочный путь ${depotCode}`,
          reason_details: `Выпуск за ${cleanDate} (${tpl.rep})`,
        });
        globalSeq++;
      }
    }
  });

  return rows;
}

const BASE_DEPOT_STOCK: Record<'AVRD' | 'BVRD' | 'KVRD' | 'UVRD', Omit<DepotKpShiftData, 'kp_nonk' | 'kp_sonk' | 'kp_sr_ob' | 'kp_tr_ob' | 'kp_sr_bez' | 'kp_tr_bez'>> = {
  AVRD: {
    stock_ckk_ktt: 26,
    stock_sonk_ktt: 19,
    stock_ckk_ktz: 6,
    stock_sonk_ktz: 8,
    stock_rem_ktt: 31,
  },
  BVRD: {
    stock_ckk_ktt: 12,
    stock_sonk_ktt: 9,
    stock_ckk_ktz: 4,
    stock_sonk_ktz: 5,
    stock_rem_ktt: 15,
  },
  KVRD: {
    stock_ckk_ktt: 18,
    stock_sonk_ktt: 14,
    stock_ckk_ktz: 9,
    stock_sonk_ktz: 11,
    stock_rem_ktt: 22,
  },
  UVRD: {
    stock_ckk_ktt: 15,
    stock_sonk_ktt: 11,
    stock_ckk_ktz: 5,
    stock_sonk_ktz: 6,
    stock_rem_ktt: 18,
  },
};

export function buildOctober2026KpForDate(isoDate = '2026-10-21'): Record<string, DepotKpShiftData> {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : '2026-10-21';
  const isOct2026 = cleanDate.startsWith('2026-10-');
  const dayNum = isOct2026 ? parseInt(cleanDate.slice(8, 10), 10) : 21;
  const kpTuple = OCTOBER_2026_DATA.daily_wheel_pairs[dayNum] || [0, 0, 0, 0];

  const result: Record<string, DepotKpShiftData> = {};
  DEPOT_ORDER.forEach((code, idx) => {
    const totalKp = kpTuple[idx] || 0;
    // Распределяем суточный объём отремонтированных КП по видам работ так, чтобы сумма строго равнялась totalKp
    const sonk = Math.floor(totalKp * 0.25);
    const sr_ob = Math.floor(totalKp * 0.35);
    const tr_ob = Math.floor(totalKp * 0.25);
    const rem = totalKp - (sonk + sr_ob + tr_ob);
    const sr_bez = Math.floor(rem / 2);
    const tr_bez = rem - sr_bez;

    result[code] = {
      kp_nonk: 0,
      kp_sonk: sonk,
      kp_sr_ob: sr_ob,
      kp_tr_ob: tr_ob,
      kp_sr_bez: sr_bez,
      kp_tr_bez: tr_bez,
      ...BASE_DEPOT_STOCK[code],
    };
  });

  return result;
}

function buildInitialShiftWagons(_data?: ArsDataset): ShiftWagonRow[] {
  return buildOctober2026WagonsForDate('2026-10-21');
}

const DEFAULT_DEPOT_KP: Record<string, DepotKpShiftData> = buildOctober2026KpForDate('2026-10-21');

export const DailyOutputView: React.FC<DailyOutputViewProps> = ({
  data,
  references,
  currentUser,
  onAskAnalyst,
}) => {
  const isBranchRole = currentUser?.role === 'branch';
  const lockedDepotCode = isBranchRole ? currentUser.depot_code : null;

  const [selectedDepot, setSelectedDepot] = useState<string>(() =>
    lockedDepotCode || 'ALL'
  );
  const [activeSubTab, setActiveSubTab] = useState<'tab-matrix' | 'tab-wagons' | 'tab-kp'>('tab-matrix');

  useEffect(() => {
    if (lockedDepotCode) {
      setSelectedDepot(lockedDepotCode);
    } else if (currentUser?.role === 'headquarters') {
      setSelectedDepot('ALL');
    }
  }, [lockedDepotCode, currentUser]);
  const [wagonFilterStatus, setWagonFilterStatus] = useState<string>('ALL');
  const [filterRepair, setFilterRepair] = useState<string>('ALL');
  const [wagonSearch, setWagonSearch] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [showHistoricalRegistry, setShowHistoricalRegistry] = useState<boolean>(false);
  const [reportDateValue, setReportDateValue] = useState<string>('2026-10-21');

  // Режим выбора дат: 'daily' (1 день) или 'period' (диапазон дат)
  const [dateMode, setDateMode] = useState<'daily' | 'period'>('daily');
  const [dateFrom, setDateFrom] = useState<string>('2026-10-01');
  const [dateTo, setDateTo] = useState<string>('2026-10-21');
  const [activePreset, setActivePreset] = useState<'7days' | 'thisMonth' | 'lastMonth' | 'ytd' | 'custom'>('thisMonth');

  // Фильтр видимости разделов («Какую именно информацию предоставить»)
  const [visibleSections, setVisibleSections] = useState<{
    bannerKpi: boolean;
    sectionMatrix: boolean;
    sectionWagons: boolean;
    sectionWheels: boolean;
    sectionAiAnalyst: boolean;
  }>({
    bannerKpi: true,
    sectionMatrix: true,
    sectionWagons: true,
    sectionWheels: true,
    sectionAiAnalyst: true,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncTimestamp, setSyncTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Управление видимостью верхнего KPI-баннера (#bannerKpi)
  useEffect(() => {
    const bannerEl = document.getElementById('bannerKpi');
    if (bannerEl) {
      bannerEl.style.display = visibleSections.bannerKpi ? '' : 'none';
    }
  }, [visibleSections.bannerKpi]);

  const toggleSectionVisibility = useCallback(
    (
      key: 'bannerKpi' | 'sectionMatrix' | 'sectionWagons' | 'sectionWheels' | 'sectionAiAnalyst',
      explicitVal?: boolean
    ) => {
      setVisibleSections((prev) => {
        const nextVal = typeof explicitVal === 'boolean' ? explicitVal : !prev[key];
        const next = { ...prev, [key]: nextVal };

        if (key === 'bannerKpi') {
          const bannerEl = document.getElementById('bannerKpi');
          if (bannerEl) bannerEl.style.display = nextVal ? '' : 'none';
        } else {
          const secEl = document.getElementById(key);
          if (secEl) secEl.style.display = nextVal ? 'block' : 'none';
        }

        // Если снята галочка с текущей активной вкладки, переключаем на первую доступную
        if (!nextVal) {
          if (key === 'sectionMatrix' && activeSubTab === 'tab-matrix') {
            if (next.sectionWagons) setActiveSubTab('tab-wagons');
            else if (next.sectionWheels) setActiveSubTab('tab-kp');
          } else if (key === 'sectionWagons' && activeSubTab === 'tab-wagons') {
            if (next.sectionMatrix) setActiveSubTab('tab-matrix');
            else if (next.sectionWheels) setActiveSubTab('tab-kp');
          } else if (key === 'sectionWheels' && activeSubTab === 'tab-kp') {
            if (next.sectionMatrix) setActiveSubTab('tab-matrix');
            else if (next.sectionWagons) setActiveSubTab('tab-wagons');
          }
        }

        return next;
      });
    },
    [activeSubTab]
  );

  // Пресеты выбора периода: 7 дней, Текущий месяц, Прошлый месяц, С начала года (от эталонной даты 21.10.2026)
  const applyPeriodPreset = useCallback(
    (preset: '7days' | 'thisMonth' | 'lastMonth' | 'ytd') => {
      const refDate = new Date(2026, 9, 21);
      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let start = new Date(refDate);
      let end = new Date(refDate);

      if (preset === '7days') {
        start.setDate(refDate.getDate() - 6);
      } else if (preset === 'thisMonth') {
        start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      } else if (preset === 'lastMonth') {
        start = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
        end = new Date(refDate.getFullYear(), refDate.getMonth(), 0);
      } else if (preset === 'ytd') {
        start = new Date(refDate.getFullYear(), 0, 1);
      }

      const fromStr = fmt(start);
      const toStr = fmt(end);
      setDateMode('period');
      setDateFrom(fromStr);
      setDateTo(toStr);
      setActivePreset(preset);
      window.logSystemAction?.(
        'Выбор периода отчёта',
        `Применён пресет периода (${preset}): с ${fromStr} по ${toStr}`
      );
    },
    []
  );

  const setReportDateMode = useCallback((mode: 'daily' | 'period') => {
    setDateMode(mode);
    window.logSystemAction?.(
      'Режим дат отчёта',
      mode === 'daily' ? 'Переключён в суточный режим (1 день)' : 'Переключён в режим за период (диапазон дат)'
    );
  }, []);

  // Shift completion status for the 4 HQ cards
  const [hqStatus, setHqStatus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HQ_STATUS);
      if (saved) return JSON.parse(saved);
    } catch (_e) {
      // ignore
    }
    return {
      KVRD: true,
      AVRD: true,
      BVRD: false,
      UVRD: false,
    };
  });

  // Shift Wagons state (Table 2)
  const [shiftWagons, setShiftWagons] = useState<ShiftWagonRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHIFT_WAGONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_e) {
      // ignore
    }
    return buildInitialShiftWagons(data);
  });

  // KP Shift Data per depot (Table 3)
  const [depotKpMap, setDepotKpMap] = useState<Record<string, DepotKpShiftData>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHIFT_KP);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_e) {
      // ignore
    }
    return DEFAULT_DEPOT_KP;
  });

  const matrixTableRef = useRef<HTMLTableElement | null>(null);

  // Persist shiftWagons, depotKpMap, and hqStatus to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SHIFT_WAGONS, JSON.stringify(shiftWagons));
    } catch (_e) {
      // ignore
    }
  }, [shiftWagons]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SHIFT_KP, JSON.stringify(depotKpMap));
    } catch (_e) {
      // ignore
    }
  }, [depotKpMap]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HQ_STATUS, JSON.stringify(hqStatus));
    } catch (_e) {
      // ignore
    }
  }, [hqStatus]);

  // Core classification: isKTT(customer)
  const isKTT = useCallback(
    (customer: string): boolean => {
      if (!customer) return false;
      const trimmed = customer.trim();
      const refCust = references.customers.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (refCust) {
        return refCust.type === 'ktt';
      }
      const lower = trimmed.toLowerCase();
      return (
        lower.includes('ктт') ||
        lower.includes('казтемиртранс') ||
        lower.includes('kaztemirtrans')
      );
    },
    [references.customers]
  );

  // Determine section group ('waiting' | 'directed' | 'release' | 'other') from references.sections
  const getSectionGroup = useCallback(
    (sectionLabel: string): 'waiting' | 'directed' | 'release' | 'other' => {
      if (!sectionLabel) return 'waiting';
      const trimmed = sectionLabel.trim();
      const upper = trimmed.toUpperCase();
      if (upper === 'AT_STATION' || upper.includes('AT_STATION')) return 'waiting';
      if (upper === 'EN_ROUTE' || upper.includes('EN_ROUTE')) return 'directed';
      if (upper === 'RELEASE' || upper.includes('RELEASE')) return 'release';

      const refSec = references.sections.find(
        (s) => s.label.toLowerCase() === trimmed.toLowerCase()
      );
      if (refSec) {
        return refSec.group;
      }
      const lower = trimmed.toLowerCase();
      if (lower.includes('ожид') || lower.includes('на станции')) return 'waiting';
      if (lower.includes('подход') || lower.includes('направл')) return 'directed';
      if (lower.includes('выпуск')) return 'release';
      return 'other';
    },
    [references.sections]
  );

  // Trigger greenSyncFade animation on all .matrix-val cells in #branchMatrixTable
  const triggerGreenSyncPulse = useCallback(() => {
    setSyncTimestamp(
      new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    const tableEl = matrixTableRef.current || document.getElementById('branchMatrixTable');
    if (!tableEl) return;
    const cells = tableEl.querySelectorAll('.matrix-val');
    cells.forEach((cell) => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('sync-pulse');
      // Force reflow so animation restarts cleanly
      void htmlCell.offsetWidth;
      htmlCell.classList.add('sync-pulse');
    });
  }, []);

  const activeRepairTypes: ReferenceRepairItem[] = useMemo(() => {
    if (references.repairs && references.repairs.length > 0) {
      return references.repairs;
    }
    if (
      typeof window !== 'undefined' &&
      Array.isArray(window.REPAIR_TYPES) &&
      window.REPAIR_TYPES.length > 0
    ) {
      return window.REPAIR_TYPES.map((r) => ({
        code: getRepairCode(r),
        name: getRepairName(r),
      }));
    }
    return DEFAULT_ARS_REPAIRS;
  }, [references.repairs]);

  // ========================================================
  // 1. АВТОПЕРЕСЧЁТ МАТРИЦЫ ИЗ ПОНОМЕРНОГО СПИСКА ВАГОНОВ
  // (Поддерживает динамические виды ремонта из REPAIR_TYPES)
  // ========================================================
  const syncMatrixFromWagons = useCallback(
    (notify = false) => {
      const currentRepairsList: Array<ReferenceRepairItem | string> =
        typeof window !== 'undefined' &&
        Array.isArray(window.REPAIR_TYPES) &&
        window.REPAIR_TYPES.length > 0
          ? window.REPAIR_TYPES
          : activeRepairTypes;

      const repairCodes = currentRepairsList
        .map((r) => getRepairCode(r))
        .filter(Boolean);

      const counts: Record<
        string,
        { w_ktt: number; w_own: number; d_ktt: number; d_own: number }
      > = {};
      repairCodes.forEach((code) => {
        counts[code] = { w_ktt: 0, w_own: 0, d_ktt: 0, d_own: 0 };
      });

      let totalWagons = 0;
      let waitingTotal = 0;
      let directedTotal = 0;
      let releaseTotal = 0;
      let unfinishedTotal = 0;

      // Сортируем коды по убыванию длины для корректного префиксного сопоставления (КРП перед КР, ТОР-КНР перед ТОР, ДР-КНР/ДРП перед ДР)
      const codesByLenDesc = [...repairCodes].sort((a, b) => b.length - a.length);

      const rows = document.querySelectorAll('#wagonsBody tr');
      rows.forEach((tr) => {
        if (tr.getAttribute('data-reset-cleared') === 'true') return;
        const cells = tr.querySelectorAll('td');
        if (cells.length < 4) return;

        totalWagons++;

        // А) Вид ремонта (ДР, ДР-КНР, ДРП, КР, КРП, ТОР, ТОР-КНР и др.)
        const repSelect = tr.querySelector(
          '.row-repair, select[name="repair"]'
        ) as HTMLSelectElement | null;
        const repVal = (
          repSelect ? repSelect.value : cells[5]?.textContent?.trim() || 'ДР'
        )
          .toUpperCase()
          .trim();

        const matchedCode =
          repairCodes.find((c) => c.toUpperCase() === repVal) ||
          codesByLenDesc.find((c) => repVal.startsWith(c.toUpperCase())) ||
          repairCodes[0] ||
          'ДР';

        if (!counts[matchedCode]) {
          counts[matchedCode] = { w_ktt: 0, w_own: 0, d_ktt: 0, d_own: 0 };
        }

        // Б) Определение парка (КТТ или Собственники)
        const parkBadge =
          tr.querySelector('.badge, .park-badge, span')?.textContent?.trim() || '';
        const custInputEl = tr.querySelector(
          '.row-cust, input[list="cust-list"], input'
        ) as HTMLInputElement | null;
        const custInput = custInputEl?.value || cells[2]?.textContent || '';
        const isKtt =
          parkBadge.includes('КТТ') ||
          custInput.toUpperCase().includes('КТТ') ||
          custInput.toUpperCase().includes('КАЗТЕМИРТРАНС') ||
          (typeof isKTT === 'function' && isKTT(custInput));

        // В) Определение раздела / статуса дислокации
        const secSelect = tr.querySelector(
          '.row-section, select[name="section"]'
        ) as HTMLSelectElement | null;
        const secText = (
          secSelect
            ? secSelect.value +
              ' ' +
              (secSelect.options[secSelect.selectedIndex]?.text || '')
            : cells[1]?.textContent || ''
        ).toUpperCase();

        // 1. Если вагон «На подходе» / «Направленные к станции» -> Правая половина матрицы
        if (
          secText.includes('EN_ROUTE') ||
          secText.includes('ПОДХОД') ||
          secText.includes('НАПРАВЛ')
        ) {
          directedTotal++;
          if (isKtt) counts[matchedCode].d_ktt++;
          else counts[matchedCode].d_own++;
        }
        // 2. Если вагон «Выпуск» (отремонтирован за смену) -> Не стоит в ожидании, считаем в выпуск
        else if (
          secText.includes('RELEASE') ||
          secText.includes('ВЫПУСК') ||
          secText.includes('СДАНО')
        ) {
          releaseTotal++;
        }
        // 3. ВСЕ ВАГОНЫ НА СТАНЦИИ (включая НЕОКОНЧЕННЫЙ РЕМОНТ, ПОДЪЁМКУ, В ОЖИДАНИИ, НА СТАНЦИИ)
        // ОБЯЗАТЕЛЬНО идут в левую колонку: «Вагоны в ожидании ремонта на станции»!
        else {
          waitingTotal++;
          if (
            secText.includes('НЕОКОНЧ') ||
            secText.includes('ПОДЪЕМ') ||
            secText.includes('ПОДЪЁМ') ||
            secText.includes('БРАК')
          ) {
            unfinishedTotal++;
          }
          if (isKtt) counts[matchedCode].w_ktt++;
          else counts[matchedCode].w_own++;
        }
      });

      // Г) Запись цифр в строки таблицы Матрицы (#branchMatrixBody)
      const matrixRows = document.querySelectorAll(
        '#branchMatrixBody tr, .branch-matrix-table tbody tr'
      );

      repairCodes.forEach((code) => {
        let rowTr = document.querySelector(`tr[data-repair="${code}"]`);
        if (!rowTr) {
          matrixRows.forEach((tr) => {
            const firstTd = tr.querySelector('td:first-child');
            const txt = firstTd ? firstTd.textContent?.trim().toUpperCase() || '' : '';
            if (txt === code.toUpperCase() || txt.startsWith(code.toUpperCase() + ' ')) {
              rowTr = tr;
            }
          });
        }
        if (rowTr && counts[code]) {
          const c = counts[code];
          const wSub = c.w_ktt + c.w_own;
          const dSub = c.d_ktt + c.d_own;
          const grand = wSub + dSub;
          if (rowTr.children[1]) rowTr.children[1].textContent = String(c.w_ktt);
          if (rowTr.children[2]) rowTr.children[2].textContent = String(c.w_own);
          if (rowTr.children[3]) rowTr.children[3].textContent = String(wSub);
          if (rowTr.children[4]) rowTr.children[4].textContent = String(c.d_ktt);
          if (rowTr.children[5]) rowTr.children[5].textContent = String(c.d_own);
          if (rowTr.children[6]) rowTr.children[6].textContent = String(dSub);
          if (rowTr.children[7]) rowTr.children[7].textContent = String(grand);
        }
      });

      // Д) Пересчёт строки ИТОГО в подвале матрицы
      let tot_w_ktt = 0;
      let tot_w_own = 0;
      let tot_w_sub = 0;
      let tot_d_ktt = 0;
      let tot_d_own = 0;
      let tot_d_sub = 0;
      let tot_grand = 0;

      repairCodes.forEach((code) => {
        const c = counts[code];
        if (!c) return;
        tot_w_ktt += c.w_ktt;
        tot_w_own += c.w_own;
        tot_w_sub += c.w_ktt + c.w_own;
        tot_d_ktt += c.d_ktt;
        tot_d_own += c.d_own;
        tot_d_sub += c.d_ktt + c.d_own;
        tot_grand += c.w_ktt + c.w_own + c.d_ktt + c.d_own;
      });

      const tfootTr = document.querySelector(
        '#branchMatrixFoot tr, .branch-matrix-table tfoot tr'
      );
      if (tfootTr) {
        if (tfootTr.children[1]) tfootTr.children[1].textContent = String(tot_w_ktt);
        if (tfootTr.children[2]) tfootTr.children[2].textContent = String(tot_w_own);
        if (tfootTr.children[3]) tfootTr.children[3].textContent = String(tot_w_sub);
        if (tfootTr.children[4]) tfootTr.children[4].textContent = String(tot_d_ktt);
        if (tfootTr.children[5]) tfootTr.children[5].textContent = String(tot_d_own);
        if (tfootTr.children[6]) tfootTr.children[6].textContent = String(tot_d_sub);
        if (tfootTr.children[7]) tfootTr.children[7].textContent = String(tot_grand);
      }

      // Е) Обновление бейджей счётчиков в интерфейсе
      const tabWagonsBtn = document.querySelector(
        '[data-tab="tab-wagons"], #tabBtn-wagons, button[onclick*="tab-wagons"]'
      );
      if (tabWagonsBtn) {
        tabWagonsBtn.innerHTML = `🚂 2. Пономерная ситуация и дислокация (${totalWagons})`;
      }
      const summaryBadge =
        document.getElementById('wagonSummaryBadge') ||
        document.querySelector('.badge-wagon-count');
      if (summaryBadge) {
        summaryBadge.textContent = `Всего: ${totalWagons} ваг.`;
      }

      // Ж) Обновление строки статистики внизу матрицы
      const noteEl = document.querySelector(
        '.matrix-footer-note, .matrix-bottom-bar, #matrixFooterNotice'
      );
      if (noteEl) {
        noteEl.innerHTML = `Всего в пономерном списке смены: <strong>${totalWagons} ваг.</strong> · В матрице ожидания и подхода: <strong>${
          waitingTotal + directedTotal
        } ваг.</strong> · Выпуск из ремонта за смену: <strong>${releaseTotal} ваг.</strong> · Неоконченный ремонт / Подъемка: <strong>${unfinishedTotal} ваг.</strong>`;
      }

      if (notify) {
        triggerGreenSyncPulse();
        showToast(
          `🔄 Матрица обновлена: учтено вагонов на станции — ${waitingTotal}, на подходе — ${directedTotal}.`
        );
      }
    },
    [activeRepairTypes, isKTT, triggerGreenSyncPulse, showToast]
  );

  // 4. Динамическая перерисовка строк сводной матрицы под актуальный список ремонтов
  const renderBranchMatrixTable = useCallback(() => {
    syncMatrixFromWagons(false);
  }, [syncMatrixFromWagons]);

  // calcBranchMatrix() — синхронный пересчёт матрицы «Справка по вагонам»
  const calcBranchMatrix = useCallback(() => {
    syncMatrixFromWagons(false);
  }, [syncMatrixFromWagons]);

  // Автономная функция загрузки отчёта филиала за выбранную дату октября (без сетевых запросов fetch)
  const loadCurrentBranchReport = useCallback(
    (depotOverride?: string, dateOverride?: string) => {
      const hiddenInput = document.getElementById('inputDate') as HTMLInputElement | null;
      const targetDate =
        dateOverride || hiddenInput?.value || reportDateValue || '2026-10-21';
      const targetDepot =
        depotOverride ||
        (typeof window.currentDepot === 'string' ? window.currentDepot : selectedDepot) ||
        'ALL';

      const nextWagons = buildOctober2026WagonsForDate(targetDate);
      const nextKpMap = buildOctober2026KpForDate(targetDate);

      setShiftWagons(nextWagons);
      setDepotKpMap(nextKpMap);
      window.updateShiftMasterKpi?.(targetDepot);

      // Сразу после загрузки вызываем syncMatrixFromWagons() и calcBranchMatrix()
      syncMatrixFromWagons(false);
      calcBranchMatrix();
      setTimeout(() => {
        syncMatrixFromWagons(false);
        calcBranchMatrix();
        triggerGreenSyncPulse();
      }, 15);
    },
    [
      reportDateValue,
      selectedDepot,
      syncMatrixFromWagons,
      calcBranchMatrix,
      triggerGreenSyncPulse,
    ]
  );

  // 5. Обновление выпадающих списков ремонтов во всех строках пономерной таблицы
  const updateAllWagonRepairSelects = useCallback(() => {
    const currentRepairsList: Array<ReferenceRepairItem | string> =
      typeof window !== 'undefined' &&
      Array.isArray(window.REPAIR_TYPES) &&
      window.REPAIR_TYPES.length > 0
        ? window.REPAIR_TYPES
        : activeRepairTypes;

    document
      .querySelectorAll('#wagonsBody .row-repair, .situation-table tbody select[name="repair"]')
      .forEach((el) => {
        const sel = el as HTMLSelectElement;
        const curVal = sel.value;
        sel.innerHTML = currentRepairsList
          .map((r) => {
            const code = getRepairCode(r);
            return `<option value="${code}" ${code === curVal ? 'selected' : ''}>${code}</option>`;
          })
          .join('');
      });
  }, [activeRepairTypes]);

  // selectDepot(depotCode)
  const selectDepot = useCallback(
    (depotCode: string) => {
      if (lockedDepotCode && depotCode !== lockedDepotCode) {
        return;
      }
      setSelectedDepot(depotCode);
      window.currentDepot = depotCode;
      window.updateShiftMasterKpi?.(depotCode);
      window.recordDevStep?.('STATE', `Переключён активный филиал депо: ${depotCode}`);
      setTimeout(() => {
        syncMatrixFromWagons(false);
        calcBranchMatrix();
        triggerGreenSyncPulse();
      }, 20);
    },
    [lockedDepotCode, syncMatrixFromWagons, calcBranchMatrix, triggerGreenSyncPulse]
  );

  // switchTab(tabId)
  const switchTab = useCallback(
    (tabId: string) => {
      if (tabId === 'tab-matrix' || tabId === 'tab-wagons' || tabId === 'tab-kp') {
        setActiveSubTab(tabId);
        window.recordDevStep?.('NAV', `Переход на вкладку суточной справки: ${tabId}`);
        if (tabId === 'tab-matrix') {
          setTimeout(() => {
            triggerGreenSyncPulse();
          }, 25);
        }
      }
    },
    [triggerGreenSyncPulse]
  );

  // addWagonRow()
  const addWagonRow = useCallback(() => {
    const targetDepot = selectedDepot === 'ALL' ? 'KVRD' : selectedDepot;
    const defaultWagonType = references.wagonTypes[0]?.name || 'Полувагон';

    const newRow: ShiftWagonRow = {
      id: `w-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      depot_code: targetDepot,
      section: 'AT_STATION',
      customer: 'АО "Казтемиртранс"',
      wagon_number: '',
      wagon_type: defaultWagonType,
      repair_type: 'ДР',
      submission_date: reportDateValue || '2026-10-21',
      track_or_location: targetDepot === 'KVRD' ? '59 путь' : `Путь ВРД (${targetDepot})`,
      reason_details: '',
    };

    setShiftWagons((prev) => [newRow, ...prev]);
    setActiveSubTab('tab-wagons');
    setWagonFilterStatus('ALL');
    window.recordDevStep?.('STATE', `Добавлена новая строка вагона в смену депо ${targetDepot}`);
  }, [selectedDepot, reportDateValue, references.wagonTypes]);

  // removeWagonRow(id)
  const removeWagonRow = useCallback((rowId: string) => {
    setShiftWagons((prev) => prev.filter((w) => w.id !== rowId));
    window.recordDevStep?.('STATE', `Удалена строка вагона из смены (${rowId})`);
  }, []);

  // Update a single field of a wagon row and auto-recalculate matrix
  const updateWagonField = useCallback(
    (rowId: string, field: keyof ShiftWagonRow, value: string) => {
      setShiftWagons((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  // Register global functions on window so inline onclick attributes work 1-to-1
  useEffect(() => {
    window.OCTOBER_2026_DATA = OCTOBER_2026_DATA as unknown as Record<string, unknown>;
    window.loadCurrentBranchReport = loadCurrentBranchReport;
    window.calcBranchMatrix = calcBranchMatrix;
    window.selectDepot = selectDepot;
    window.switchTab = switchTab;
    window.syncMatrixFromWagons = syncMatrixFromWagons;
    window.renderBranchMatrixTable = renderBranchMatrixTable;
    window.updateAllWagonRepairSelects = updateAllWagonRepairSelects;
    window.isKTT = isKTT;
    window.addWagonRow = addWagonRow;
    window.removeWagonRow = removeWagonRow;
  }, [
    loadCurrentBranchReport,
    calcBranchMatrix,
    selectDepot,
    switchTab,
    syncMatrixFromWagons,
    renderBranchMatrixTable,
    updateAllWagonRepairSelects,
    isKTT,
    addWagonRow,
    removeWagonRow,
  ]);

  // Synchronize exact inline onclick attributes for static controls
  useEffect(() => {
    const pillIds = ['ALL', 'KVRD', 'AVRD', 'BVRD', 'UVRD'];
    pillIds.forEach((code) => {
      const el = document.getElementById(`pill-${code}`);
      if (el) el.setAttribute('onclick', `selectDepot('${code}')`);
    });

    const tabBtns: Array<[string, string]> = [
      ['tabBtn-matrix', 'tab-matrix'],
      ['tabBtn-wagons', 'tab-wagons'],
      ['tabBtn-kp', 'tab-kp'],
    ];
    tabBtns.forEach(([btnId, tabId]) => {
      const el = document.getElementById(btnId);
      if (el) el.setAttribute('onclick', `switchTab('${tabId}')`);
    });
  }, [references.depots]);

  // Расчёт количества дней в выбранном периоде и формирование расширенного пула вагонов за период
  const periodDaysCount = useMemo(() => {
    if (dateMode !== 'period') return 1;
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 1;
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [dateMode, dateFrom, dateTo]);

  // Посуточный выпуск из OCTOBER_2026_DATA и базы (daily_output_october) за выбранный период
  const periodOutputSummary = useMemo(() => {
    const getDayReleaseFromOctData = (isoStr: string): number => {
      if (!isoStr.startsWith('2026-10-')) return 0;
      const day = parseInt(isoStr.slice(8, 10), 10);
      const tuple = OCTOBER_2026_DATA.daily_release[day];
      if (!tuple) return 0;
      if (selectedDepot === 'ALL') {
        return tuple[0] + tuple[1] + tuple[2] + tuple[3];
      }
      const dIdx = DEPOT_ORDER.indexOf(selectedDepot as 'AVRD' | 'BVRD' | 'KVRD' | 'UVRD');
      return dIdx >= 0 ? tuple[dIdx] : 0;
    };

    if (dateMode === 'daily') {
      const octOut = getDayReleaseFromOctData(reportDateValue);
      if (octOut > 0 || reportDateValue.startsWith('2026-10-')) {
        const kttOut = Math.round(octOut * 0.55);
        const ownOut = octOut - kttOut;
        return { totalOut: octOut, kttOut, ownOut, recordsCount: 1 };
      }
    } else if (dateFrom.startsWith('2026-10-') && dateTo.startsWith('2026-10-')) {
      const startDay = Math.max(1, parseInt(dateFrom.slice(8, 10), 10) || 1);
      const endDay = Math.min(31, parseInt(dateTo.slice(8, 10), 10) || 21);
      let octSum = 0;
      let daysMatched = 0;
      for (let d = startDay; d <= endDay; d++) {
        const dtStr = `2026-10-${String(d).padStart(2, '0')}`;
        if (OCTOBER_2026_DATA.daily_release[d]) {
          octSum += getDayReleaseFromOctData(dtStr);
          daysMatched++;
        }
      }
      if (daysMatched > 0) {
        const kttOut = Math.round(octSum * 0.55);
        const ownOut = octSum - kttOut;
        return { totalOut: octSum, kttOut, ownOut, recordsCount: daysMatched };
      }
    }

    const rows = data.daily_output_october.filter((r) => {
      const matchDepot = selectedDepot === 'ALL' ? true : r.depot_code === selectedDepot;
      if (!matchDepot) return false;
      if (dateMode === 'daily') {
        return r.report_date === reportDateValue;
      }
      return r.report_date >= dateFrom && r.report_date <= dateTo;
    });

    let totalOut = 0;
    let kttOut = 0;
    let ownOut = 0;
    rows.forEach((r) => {
      const val = Number(r.wagons_output) || 0;
      totalOut += val;
      if (isKTT(r.customer_name)) kttOut += val;
      else ownOut += val;
    });

    return { totalOut, kttOut, ownOut, recordsCount: rows.length };
  }, [data.daily_output_october, selectedDepot, dateMode, reportDateValue, dateFrom, dateTo, isKTT]);

  // Формирование пула вагонов с учётом режима (суточный vs за период)
  const periodAwareWagons = useMemo(() => {
    if (dateMode === 'daily') {
      return shiftWagons;
    }

    // В режиме периода объединяем оперативные вагоны смены и исторические вагоны из базы дислокации/выпуска за интервал [dateFrom, dateTo]
    const inRange = (dtStr: string) => {
      if (!dtStr) return true;
      return dtStr >= dateFrom && dtStr <= dateTo;
    };

    const baseShift = shiftWagons.filter((w) => inRange(w.submission_date));
    const seenNums = new Set(baseShift.map((w) => w.wagon_number).filter(Boolean));
    const extraPeriodWagons: ShiftWagonRow[] = [];

    // Добавляем вагоны из базы дислокации и простоев, попадающие в диапазон дат
    data.wagon_dislocations_and_stalls.forEach((w, idx) => {
      const subDate = w.submission_date || w.report_date || '2026-10-18';
      if (!inRange(subDate)) return;
      const numStr = String(w.wagon_number || '');
      if (numStr && seenNums.has(numStr)) return;
      if (numStr) seenNums.add(numStr);

      let secLabel = 'На станции';
      const stLower = `${w.status || ''} ${w.status_ru || ''}`.toLowerCase();
      const rsLower = (w.reason_details || '').toLowerCase();
      if (rsLower.includes('брак') || rsLower.includes('рекламац')) {
        secLabel = 'Брак / Рекламация';
      } else if (stLower.includes('неоконч') || stLower.includes('ремонт')) {
        secLabel = 'Неоконченный ремонт';
      } else if (stLower.includes('подход') || stLower.includes('пути')) {
        secLabel = 'На подходе к станции';
      } else if (stLower.includes('выпуск')) {
        secLabel = 'Выпуск';
      }

      extraPeriodWagons.push({
        id: `period-disl-${idx}-${numStr}`,
        depot_code: w.depot_code,
        section: secLabel,
        customer: w.customer_name || 'АО "Казтемиртранс" (КТТ)',
        wagon_number: numStr,
        wagon_type: 'Полувагон',
        repair_type: (w.repair_type || 'ДР').toUpperCase(),
        submission_date: subDate,
        track_or_location: w.track_or_location || `Ст. ${w.depot_code}`,
        reason_details: w.reason_details || 'По данным периода',
      });
    });

    // Добавляем выпущенные вагоны из посуточного архива за выбранный интервал
    data.daily_output_october.forEach((rec, idx) => {
      if (!inRange(rec.report_date)) return;
      const count = Math.min(Number(rec.wagons_output) || 0, 3);
      for (let k = 0; k < count; k++) {
        const synthNum = String(60500000 + ((idx * 17 + k * 31) % 899999));
        if (seenNums.has(synthNum)) continue;
        seenNums.add(synthNum);
        extraPeriodWagons.push({
          id: `period-rel-${rec.report_date}-${idx}-${k}`,
          depot_code: rec.depot_code,
          section: 'Выпуск',
          customer: rec.customer_name,
          wagon_number: synthNum,
          wagon_type: rec.wagon_type || 'Полувагон',
          repair_type: (rec.repair_type || 'ДР').toUpperCase(),
          submission_date: rec.report_date,
          track_or_location: `Выставочный путь (${rec.depot_code})`,
          reason_details: `Выпущен из ремонта (${rec.report_date})`,
        });
      }
    });

    return [...baseShift, ...extraPeriodWagons];
  }, [dateMode, shiftWagons, dateFrom, dateTo, data.wagon_dislocations_and_stalls, data.daily_output_october]);

  // Фильтрация по выбранному филиалу
  const depotScopedWagons = useMemo(() => {
    if (selectedDepot === 'ALL') return periodAwareWagons;
    return periodAwareWagons.filter((w) => w.depot_code === selectedDepot);
  }, [periodAwareWagons, selectedDepot]);

  // Проверка соответствия статусу вагона (поддерживает укрупнённые группы и точные разделы)
  const matchesWagonStatusFilter = useCallback((w: ShiftWagonRow, statusFilter: string): boolean => {
    if (!statusFilter || statusFilter === 'ALL') return true;
    const secUpper = (w.section || '').toUpperCase();
    const reasonUpper = (w.reason_details || '').toUpperCase();

    if (statusFilter === 'WAITING_GROUP') {
      // В ожидании ремонта (на станции, на путях ВРД, на подходе)
      return (
        secUpper === 'AT_STATION' ||
        secUpper === 'EN_ROUTE' ||
        secUpper.includes('ОЖИД') ||
        secUpper.includes('НА СТАНЦИИ') ||
        secUpper.includes('ПОДХОД') ||
        secUpper.includes('НАПРАВЛ')
      );
    }
    if (statusFilter === 'IN_REPAIR_GROUP') {
      // В ремонте (неоконченный ремонт, подъёмка, подача в депо)
      return (
        secUpper.includes('НЕОКОНЧ') ||
        secUpper.includes('ПОДЪЕМ') ||
        secUpper.includes('ПОДЪЁМ') ||
        secUpper.includes('ПОДАЧА') ||
        secUpper.includes('В РЕМОНТЕ')
      );
    }
    if (statusFilter === 'RELEASED_GROUP') {
      // Выпущены
      return (
        secUpper === 'RELEASE' ||
        secUpper.includes('ВЫПУСК') ||
        secUpper.includes('RELEASE') ||
        secUpper.includes('СДАНО')
      );
    }
    if (statusFilter === 'DEFECT_GROUP') {
      // Брак / рекламация
      return (
        secUpper.includes('БРАК') ||
        secUpper.includes('РЕКЛАМАЦ') ||
        reasonUpper.includes('БРАК') ||
        reasonUpper.includes('РЕКЛАМАЦ') ||
        reasonUpper.includes('ВУ-22') ||
        reasonUpper.includes('АКТ')
      );
    }

    return w.section === statusFilter;
  }, []);

  // Итоговый список вагонов с применением всех срезов: Филиал + Вид ремонта + Статус вагона + Текстовый поиск
  const visibleWagons = useMemo(() => {
    const q = wagonSearch.trim().toLowerCase();
    return depotScopedWagons.filter((w) => {
      const matchRepair =
        filterRepair === 'ALL'
          ? true
          : (w.repair_type || '').toUpperCase().trim() === filterRepair.toUpperCase().trim();
      const matchStatus = matchesWagonStatusFilter(w, wagonFilterStatus);
      const matchQuery =
        !q ||
        w.wagon_number.toLowerCase().includes(q) ||
        w.customer.toLowerCase().includes(q) ||
        w.track_or_location.toLowerCase().includes(q) ||
        w.reason_details.toLowerCase().includes(q) ||
        w.wagon_type.toLowerCase().includes(q);
      return matchRepair && matchStatus && matchQuery;
    });
  }, [depotScopedWagons, filterRepair, wagonFilterStatus, wagonSearch, matchesWagonStatusFilter]);

  // Строгий расчёт Таблицы 1 (Матрица) из отфильтрованного пула вагонов (visibleWagons)
  const matrixCalculation = useMemo(() => {
    const byRepair: Record<
      string,
      {
        code: string;
        label: string;
        waitKtt: number;
        waitOwn: number;
        waitTotal: number;
        dirKtt: number;
        dirOwn: number;
        dirTotal: number;
        grandTotal: number;
        releaseKtt: number;
        releaseOwn: number;
        otherKtt: number;
        otherOwn: number;
      }
    > = {};

    const repairCodes = activeRepairTypes.map((r) => getRepairCode(r)).filter(Boolean);

    for (const r of activeRepairTypes) {
      const code = getRepairCode(r);
      const name = getRepairName(r);
      const label = name && name !== code ? `${code} (${name})` : code;
      byRepair[code] = {
        code,
        label,
        waitKtt: 0,
        waitOwn: 0,
        waitTotal: 0,
        dirKtt: 0,
        dirOwn: 0,
        dirTotal: 0,
        grandTotal: 0,
        releaseKtt: 0,
        releaseOwn: 0,
        otherKtt: 0,
        otherOwn: 0,
      };
    }

    for (const w of visibleWagons) {
      const repVal = (w.repair_type || 'ДР').toUpperCase().trim();
      const matchedCode =
        repairCodes.find((c) => c.toUpperCase() === repVal) ||
        repairCodes[0] ||
        'ДР';

      if (!byRepair[matchedCode]) {
        byRepair[matchedCode] = {
          code: matchedCode,
          label: matchedCode,
          waitKtt: 0,
          waitOwn: 0,
          waitTotal: 0,
          dirKtt: 0,
          dirOwn: 0,
          dirTotal: 0,
          grandTotal: 0,
          releaseKtt: 0,
          releaseOwn: 0,
          otherKtt: 0,
          otherOwn: 0,
        };
      }

      const target = byRepair[matchedCode];
      const kttFlag = isKTT(w.customer);
      const combinedSec = (w.section || '').toUpperCase();
      const group = getSectionGroup(w.section);

      // 1. На подходе / Направленные к станции -> правая часть матрицы
      if (
        combinedSec.includes('EN_ROUTE') ||
        combinedSec.includes('ПОДХОД') ||
        combinedSec.includes('НАПРАВЛ') ||
        group === 'directed'
      ) {
        if (kttFlag) target.dirKtt += 1;
        else target.dirOwn += 1;
        target.dirTotal += 1;
        target.grandTotal += 1;
      }
      // 2. Выпуск (сдано за смену) -> завершённые (не в остатке на путях)
      else if (
        combinedSec.includes('RELEASE') ||
        combinedSec.includes('ВЫПУСК') ||
        combinedSec.includes('СДАНО') ||
        group === 'release'
      ) {
        if (kttFlag) target.releaseKtt += 1;
        else target.releaseOwn += 1;
      }
      // 3. ВСЕ ВАГОНЫ НА СТАНЦИИ (включая НЕОКОНЧЕННЫЙ РЕМОНТ, ПОДЪЁМКУ, В ОЖИДАНИИ, НА СТАНЦИИ)
      // ОБЯЗАТЕЛЬНО идут в левую колонку: «Вагоны в ожидании ремонта на станции»!
      else {
        if (kttFlag) target.waitKtt += 1;
        else target.waitOwn += 1;
        target.waitTotal += 1;
        target.grandTotal += 1;

        if (
          combinedSec.includes('НЕОКОНЧ') ||
          combinedSec.includes('ПОДЪЕМ') ||
          combinedSec.includes('ПОДЪЁМ') ||
          combinedSec.includes('БРАК') ||
          group === 'other'
        ) {
          if (kttFlag) target.otherKtt += 1;
          else target.otherOwn += 1;
        }
      }
    }

    const rows = Object.values(byRepair);
    const totals = rows.reduce(
      (acc, r) => {
        acc.waitKtt += r.waitKtt;
        acc.waitOwn += r.waitOwn;
        acc.waitTotal += r.waitTotal;
        acc.dirKtt += r.dirKtt;
        acc.dirOwn += r.dirOwn;
        acc.dirTotal += r.dirTotal;
        acc.grandTotal += r.grandTotal;
        acc.releaseTotal += r.releaseKtt + r.releaseOwn;
        acc.otherTotal += r.otherKtt + r.otherOwn;
        return acc;
      },
      {
        waitKtt: 0,
        waitOwn: 0,
        waitTotal: 0,
        dirKtt: 0,
        dirOwn: 0,
        dirTotal: 0,
        grandTotal: 0,
        releaseTotal: 0,
        otherTotal: 0,
      }
    );

    return { rows, totals };
  }, [activeRepairTypes, visibleWagons, isKTT, getSectionGroup]);

  // Автоматически вызываем syncMatrixFromWagons при каждом изменении списка вагонов, периода, видов ремонта или фильтров
  useEffect(() => {
    const timer = setTimeout(() => {
      syncMatrixFromWagons(false);
    }, 10);
    return () => clearTimeout(timer);
  }, [
    shiftWagons,
    activeRepairTypes,
    selectedDepot,
    filterRepair,
    wagonFilterStatus,
    wagonSearch,
    dateMode,
    dateFrom,
    dateTo,
    syncMatrixFromWagons,
  ]);

  // Активные показатели КП для Вкладки 3 (в режиме периода подкатка суммируется за дни периода)
  const activeKpValues: DepotKpShiftData = useMemo(() => {
    const periodFactor =
      dateMode === 'period' ? Math.max(1, Math.min(periodDaysCount, 30)) : 1;

    if (selectedDepot !== 'ALL') {
      const base = depotKpMap[selectedDepot] || {
        kp_nonk: 0,
        kp_sonk: 0,
        kp_sr_ob: 0,
        kp_tr_ob: 0,
        kp_sr_bez: 0,
        kp_tr_bez: 0,
        stock_ckk_ktt: 0,
        stock_sonk_ktt: 0,
        stock_ckk_ktz: 0,
        stock_sonk_ktz: 0,
        stock_rem_ktt: 0,
      };
      return {
        kp_nonk: (Number(base.kp_nonk) || 0) * periodFactor,
        kp_sonk: (Number(base.kp_sonk) || 0) * periodFactor,
        kp_sr_ob: (Number(base.kp_sr_ob) || 0) * periodFactor,
        kp_tr_ob: (Number(base.kp_tr_ob) || 0) * periodFactor,
        kp_sr_bez: (Number(base.kp_sr_bez) || 0) * periodFactor,
        kp_tr_bez: (Number(base.kp_tr_bez) || 0) * periodFactor,
        stock_ckk_ktt: Number(base.stock_ckk_ktt) || 0,
        stock_sonk_ktt: Number(base.stock_sonk_ktt) || 0,
        stock_ckk_ktz: Number(base.stock_ckk_ktz) || 0,
        stock_sonk_ktz: Number(base.stock_sonk_ktz) || 0,
        stock_rem_ktt: Number(base.stock_rem_ktt) || 0,
      };
    }

    const sum: DepotKpShiftData = {
      kp_nonk: 0,
      kp_sonk: 0,
      kp_sr_ob: 0,
      kp_tr_ob: 0,
      kp_sr_bez: 0,
      kp_tr_bez: 0,
      stock_ckk_ktt: 0,
      stock_sonk_ktt: 0,
      stock_ckk_ktz: 0,
      stock_sonk_ktz: 0,
      stock_rem_ktt: 0,
    };

    Object.values(depotKpMap).forEach((d) => {
      sum.kp_nonk += (Number(d.kp_nonk) || 0) * periodFactor;
      sum.kp_sonk += (Number(d.kp_sonk) || 0) * periodFactor;
      sum.kp_sr_ob += (Number(d.kp_sr_ob) || 0) * periodFactor;
      sum.kp_tr_ob += (Number(d.kp_tr_ob) || 0) * periodFactor;
      sum.kp_sr_bez += (Number(d.kp_sr_bez) || 0) * periodFactor;
      sum.kp_tr_bez += (Number(d.kp_tr_bez) || 0) * periodFactor;
      sum.stock_ckk_ktt += Number(d.stock_ckk_ktt) || 0;
      sum.stock_sonk_ktt += Number(d.stock_sonk_ktt) || 0;
      sum.stock_ckk_ktz += Number(d.stock_ckk_ktz) || 0;
      sum.stock_sonk_ktz += Number(d.stock_sonk_ktz) || 0;
      sum.stock_rem_ktt += Number(d.stock_rem_ktt) || 0;
    });

    return sum;
  }, [depotKpMap, selectedDepot, dateMode, periodDaysCount]);

  // Синхронизация KPI-панели (#bannerKpi) при переключении режима «Суточный» / «За период»
  useEffect(() => {
    if (dateMode === 'period') {
      const aggFact =
        periodOutputSummary.totalOut > 0
          ? periodOutputSummary.totalOut
          : matrixCalculation.totals.releaseTotal;
      const aggKtt =
        periodOutputSummary.kttOut > 0
          ? periodOutputSummary.kttOut
          : matrixCalculation.totals.waitKtt;
      const aggOwn =
        periodOutputSummary.ownOut > 0
          ? periodOutputSummary.ownOut
          : matrixCalculation.totals.waitOwn;

      window.updateShiftMasterKpi?.(selectedDepot, {
        fact: aggFact,
        factSub: `За период ${dateFrom} — ${dateTo} (${periodDaysCount} сут.)`,
        ktt: aggKtt,
        own: aggOwn,
        parkSub: `Агрегировано за период (${periodDaysCount} сут.)`,
        unfinished: matrixCalculation.totals.otherTotal,
        unfinishedSub: `В срезе за выбранный период`,
      });
    } else {
      window.updateShiftMasterKpi?.(selectedDepot);
    }
  }, [
    dateMode,
    dateFrom,
    dateTo,
    periodDaysCount,
    selectedDepot,
    periodOutputSummary,
    matrixCalculation.totals,
  ]);

  const handleUpdateKpField = (field: keyof DepotKpShiftData, rawVal: string) => {
    const num = Math.max(0, parseInt(rawVal || '0', 10) || 0);
    const targetDepot = selectedDepot === 'ALL' ? 'KVRD' : selectedDepot;
    setDepotKpMap((prev) => ({
      ...prev,
      [targetDepot]: {
        ...(prev[targetDepot] || DEFAULT_DEPOT_KP.KVRD),
        [field]: num,
      },
    }));
  };

  const toggleDepotShiftDone = (depotCode: string) => {
    setHqStatus((prev) => {
      const nextDone = !prev[depotCode];
      window.recordDevStep?.(
        'STATE',
        `Статус сдачи смены депо ${depotCode}: ${nextDone ? 'Сдано' : 'Возвращено в работу'}`
      );
      return {
        ...prev,
        [depotCode]: nextDone,
      };
    });
  };

  // ========================================================
  // 2. ФУНКЦИЯ СБРОСА СМЕНЫ (resetCurrentShift)
  // ========================================================
  const resetCurrentShift = useCallback(() => {
    const d =
      typeof window.currentDepot !== 'undefined' ? window.currentDepot : selectedDepot || 'KVRD';

    const t0 = performance.now();
    let confirmed = true;
    try {
      confirmed = window.confirm(
        `Вы действительно хотите сбросить текущую смену филиала ${d}?\nВсе внесённые вагоны и показатели смены будут очищены.`
      );
    } catch (_e) {
      confirmed = true;
    }
    const elapsed = performance.now() - t0;
    // Если браузер показал диалог (elapsed >= 15ms) и пользователь нажал «Отмена», прерываем
    if (!confirmed && elapsed >= 15) {
      return;
    }

    // 1. Очистка пономерных вагонов (React-состояние и DOM)
    const tbody =
      document.getElementById('wagonsBody') ||
      document.querySelector('.situation-table tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach((tr) => {
        tr.setAttribute('data-reset-cleared', 'true');
        (tr as HTMLElement).style.display = 'none';
      });
    }

    if (d === 'ALL') {
      setShiftWagons([]);
    } else {
      setShiftWagons((prev) => prev.filter((w) => w.depot_code !== d));
    }

    // 2. Обнуление счётчиков колёсных пар (React-состояние и DOM)
    const zeroKp: DepotKpShiftData = {
      kp_nonk: 0,
      kp_sonk: 0,
      kp_sr_ob: 0,
      kp_tr_ob: 0,
      kp_sr_bez: 0,
      kp_tr_bez: 0,
      stock_ckk_ktt: 0,
      stock_sonk_ktt: 0,
      stock_ckk_ktz: 0,
      stock_sonk_ktz: 0,
      stock_rem_ktt: 0,
    };

    if (d === 'ALL') {
      setDepotKpMap({
        KVRD: { ...zeroKp },
        AVRD: { ...zeroKp },
        BVRD: { ...zeroKp },
        UVRD: { ...zeroKp },
      });
    } else {
      setDepotKpMap((prev) => ({
        ...prev,
        [d]: { ...zeroKp },
      }));
    }

    const kpIds = [
      'kp_nonk',
      'kp_sonk',
      'kp_sr_ob',
      'kp_tr_ob',
      'kp_sr_bez',
      'kp_tr_bez',
      'stock_ckk_ktt',
      'stock_sonk_ktt',
      'stock_ckk_ktz',
      'stock_sonk_ktz',
      'stock_rem_ktt',
    ];
    kpIds.forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '0';
    });

    // 3. Пересчёт матрицы (обнулит значения синхронно и после рендера)
    syncMatrixFromWagons(false);
    setTimeout(() => {
      syncMatrixFromWagons(false);
    }, 0);

    // 4. Очистка черновика смены в localStorage
    try {
      const dateInput = document.getElementById('inputDate') as HTMLInputElement | null;
      const dt = dateInput?.value || '';
      localStorage.removeItem(`ars_shift_${d}_${dt}`);
      localStorage.removeItem(`ars_wagons_${d}_${dt}`);
      if (d === 'ALL') {
        localStorage.removeItem(STORAGE_KEY_SHIFT_WAGONS);
        localStorage.removeItem(STORAGE_KEY_SHIFT_KP);
      }
    } catch (_e) {
      // ignore
    }

    // 5. Запись в журнал и уведомление
    window.logSystemAction?.(
      '🔄 Сброс смены',
      `Смена филиала ${d} успешно сброшена и очищена.`
    );
    showToast('🔄 Смена сброшена! Форма очищена для нового ввода.');
  }, [selectedDepot, syncMatrixFromWagons, showToast]);

  useEffect(() => {
    window.resetCurrentShift = resetCurrentShift;
    window.showToast = showToast;
    window.setReportDateMode = setReportDateMode;
    window.applyPeriodPreset = applyPeriodPreset;
    window.toggleSectionVisibility = toggleSectionVisibility;
  }, [
    resetCurrentShift,
    showToast,
    setReportDateMode,
    applyPeriodPreset,
    toggleSectionVisibility,
  ]);

  const handleRestoreDemoShift = () => {
    const freshWagons = buildInitialShiftWagons(data);
    setShiftWagons(freshWagons);
    setDepotKpMap(DEFAULT_DEPOT_KP);
    setHqStatus({
      KVRD: true,
      AVRD: true,
      BVRD: false,
      UVRD: false,
    });
    window.logSystemAction?.(
      'Восстановление демо-смены',
      'Загружены эталонные данные смены 2026 г. по 4 филиалам АРС.'
    );
    showToast('✅ Демо-данные смены 2026 г. восстановлены.');
    setTimeout(() => {
      triggerGreenSyncPulse();
    }, 25);
  };

  // Выгрузка отчёта в Excel (.xls) с поддержкой выборочных разделов (visibleSections) и режима периода
  const handleExportReportClick = useCallback(() => {
    const escapeXml = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const dateInput = document.getElementById('inputDate') as HTMLInputElement | null;
    const singleDate =
      dateInput && dateInput.value ? dateInput.value : reportDateValue || new Date().toISOString().split('T')[0];
    const reportDateLabel =
      dateMode === 'period' ? `за период ${dateFrom} — ${dateTo}` : `на ${singleDate} г.`;
    const fileDateSuffix = dateMode === 'period' ? `${dateFrom}_${dateTo}` : singleDate;

    const depot =
      typeof window.currentDepot !== 'undefined' ? window.currentDepot : selectedDepot || 'ALL';
    const isCorp = depot === 'ALL';
    const depotLabels = window.DEPOT_LABELS || {};
    const depotName = isCorp
      ? 'Холдинг АРС (все филиалы)'
      : depotLabels[depot]
      ? depotLabels[depot]
      : depot;

    const sheet1Name = isCorp ? 'Справка по вагонам (Холдинг)' : 'Справка по вагонам';
    const sheet2Name = isCorp ? 'Пономерная ситуация (Холдинг)' : 'Пономерная ситуация';
    const sheet3Name = isCorp ? 'Колесные пары (Холдинг)' : 'Колесные пары';
    const sheet4Name = 'KPI и сводные индикаторы';
    const sheet5Name = 'Справка ИИ-аналитика';

    // 1. Сбор данных матрицы ремонтов
    const matrixRows: Array<{
      rep: string;
      w_ktt: string;
      w_own: string;
      w_sub: string;
      d_ktt: string;
      d_own: string;
      d_sub: string;
      grand: string;
    }> = [];
    const matrixTrs = document.querySelectorAll(
      '#branchMatrixBody tr, .branch-matrix-table tbody tr'
    );
    matrixTrs.forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 8) {
        matrixRows.push({
          rep: cells[0]?.textContent?.trim() || '',
          w_ktt: cells[1]?.textContent?.trim() || '0',
          w_own: cells[2]?.textContent?.trim() || '0',
          w_sub: cells[3]?.textContent?.trim() || '0',
          d_ktt: cells[4]?.textContent?.trim() || '0',
          d_own: cells[5]?.textContent?.trim() || '0',
          d_sub: cells[6]?.textContent?.trim() || '0',
          grand: cells[7]?.textContent?.trim() || '0',
        });
      }
    });

    const tfootTr = document.querySelector(
      '#branchMatrixFoot tr, .branch-matrix-table tfoot tr'
    );
    let totals = {
      w_ktt: '0',
      w_own: '0',
      w_sub: '0',
      d_ktt: '0',
      d_own: '0',
      d_sub: '0',
      grand: '0',
    };
    if (tfootTr) {
      const fCells = tfootTr.querySelectorAll('td');
      if (fCells.length >= 8) {
        totals = {
          w_ktt: fCells[1]?.textContent?.trim() || '0',
          w_own: fCells[2]?.textContent?.trim() || '0',
          w_sub: fCells[3]?.textContent?.trim() || '0',
          d_ktt: fCells[4]?.textContent?.trim() || '0',
          d_own: fCells[5]?.textContent?.trim() || '0',
          d_sub: fCells[6]?.textContent?.trim() || '0',
          grand: fCells[7]?.textContent?.trim() || '0',
        };
      }
    }

    // 2. Сбор пономерных вагонов
    const wagonRows: Array<{
      idx: number;
      depot: string;
      status: string;
      cust: string;
      num: string;
      type: string;
      repair: string;
      date: string;
      loc: string;
      reason: string;
    }> = [];
    document
      .querySelectorAll('#wagonsBody tr, .situation-table tbody tr')
      .forEach((tr, idx) => {
        if (tr.getAttribute('data-reset-cleared') === 'true') return;
        const secSelect = tr.querySelector('.row-section') as HTMLSelectElement | null;
        const status = secSelect
          ? secSelect.options[secSelect.selectedIndex]?.text || secSelect.value
          : tr.children[1]?.textContent?.trim() || '';
        const custInput = tr.querySelector(
          '.row-cust, input[list="cust-list"]'
        ) as HTMLInputElement | null;
        const cust = custInput?.value?.trim() || tr.children[2]?.textContent?.trim() || '';
        const numInput = tr.querySelector('.row-wagon') as HTMLInputElement | null;
        const num = numInput?.value?.trim() || tr.children[3]?.textContent?.trim() || '';
        const typeSelect = tr.querySelector('.row-wagon-type') as HTMLSelectElement | null;
        const type = typeSelect ? typeSelect.value : tr.children[4]?.textContent?.trim() || '';
        const repSelect = tr.querySelector('.row-repair') as HTMLSelectElement | null;
        const repair = repSelect ? repSelect.value : tr.children[5]?.textContent?.trim() || '';
        const dateEl = tr.querySelector('.row-date') as HTMLInputElement | null;
        const date = dateEl?.value?.trim() || tr.children[6]?.textContent?.trim() || '';
        const locEl = tr.querySelector('.row-loc') as HTMLInputElement | null;
        const loc = locEl?.value?.trim() || tr.children[7]?.textContent?.trim() || '';
        const reasonEl = tr.querySelector('.row-reason') as HTMLInputElement | null;
        const reason = reasonEl?.value?.trim() || tr.children[8]?.textContent?.trim() || '';
        const dCode = tr.getAttribute('data-depot') || depot;

        if (num || cust || status) {
          wagonRows.push({
            idx: idx + 1,
            depot: dCode,
            status,
            cust,
            num,
            type,
            repair,
            date,
            loc,
            reason,
          });
        }
      });

    // 3. Сбор колёсных пар (КП)
    const getKp = (id: string, stateKey: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && el.value !== '') return parseInt(el.value, 10) || 0;
      if (
        typeof window.currentReportData !== 'undefined' &&
        window.currentReportData?.wheel_pairs
      ) {
        return parseInt(String(window.currentReportData.wheel_pairs[stateKey] ?? 0), 10) || 0;
      }
      return 0;
    };

    const kpRoll = [
      { label: 'НОНК (новые колёсные пары)', val: getKp('kp_nonk', 'nonk') },
      { label: 'СОНК (старые оси, новые колёса)', val: getKp('kp_sonk', 'sonk') },
      { label: 'Средний ремонт (с обточкой)', val: getKp('kp_sr_ob', 'sr_ob') },
      { label: 'Текущий ремонт (с обточкой)', val: getKp('kp_tr_ob', 'tr_ob') },
      { label: 'Средний ремонт (без обточки)', val: getKp('kp_sr_bez', 'sr_bez') },
      { label: 'Текущий ремонт (без обточки)', val: getKp('kp_tr_bez', 'tr_bez') },
    ];

    const kpStock = [
      { label: 'ЦКК АО "КТТ"', val: getKp('stock_ckk_ktt', 'stock_ckk_ktt') },
      { label: 'СОНК "КТТ"', val: getKp('stock_sonk_ktt', 'stock_sonk_ktt') },
      { label: 'ЦКК (KTZ Express)', val: getKp('stock_ckk_ktz', 'stock_ckk_ktz') },
      { label: 'СОНК (KTZ Express)', val: getKp('stock_sonk_ktz', 'stock_sonk_ktz') },
      { label: 'Ремфонд осей под КР', val: getKp('stock_rem_ktt', 'stock_rem_ktt') },
    ];

    const totKpRoll = kpRoll.reduce((acc, it) => acc + it.val, 0);
    const totKpStock = kpStock.reduce((acc, it) => acc + it.val, 0);

    // Определяем какие листы выгружать согласно чекбоксам visibleSections
    const anySectionSelected =
      visibleSections.sectionMatrix ||
      visibleSections.sectionWagons ||
      visibleSections.sectionWheels ||
      visibleSections.bannerKpi ||
      visibleSections.sectionAiAnalyst;

    const exportMatrix = anySectionSelected ? visibleSections.sectionMatrix : true;
    const exportWagons = anySectionSelected ? visibleSections.sectionWagons : true;
    const exportWheels = anySectionSelected ? visibleSections.sectionWheels : true;
    const exportKpi = visibleSections.bannerKpi;
    const exportAnalyst = visibleSections.sectionAiAnalyst;

    // Сборка XML SpreadsheetML
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
    </Style>
    <Style ss:ID="HeaderTitle">
      <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B365D"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="ThDark">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
      </Borders>
    </Style>
    <Style ss:ID="ThSub">
      <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#1B365D"/>
      <Interior ss:Color="#EAEFF5" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="ThGrandTotal">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#5D4037"/>
      <Interior ss:Color="#FFE082" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
      </Borders>
    </Style>
    <Style ss:ID="TableCell">
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="TableCellLeft">
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="TableCellBoldLeft">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="TableCellTotal">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#856404"/>
      <Interior ss:Color="#FFF9E6" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="TableCellGrandTotal">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#5D4037"/>
      <Interior ss:Color="#FFE082" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
      </Borders>
    </Style>
    <Style ss:ID="FooterTotalLeft">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F223D"/>
      <Interior ss:Color="#EAEFF5" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#1B365D"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1B365D"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="FooterHighlight">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#856404"/>
      <Interior ss:Color="#FFF3CD" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#1B365D"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1B365D"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="FooterGrandTotal">
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#5D4037"/>
      <Interior ss:Color="#FFE082" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#1B365D"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1B365D"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8D6E63"/>
      </Borders>
    </Style>
    <Style ss:ID="SectionHeader">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F223D"/>
      </Borders>
    </Style>
    <Style ss:ID="KpLabelCell">
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
    <Style ss:ID="KpValueCell">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F223D"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
      </Borders>
    </Style>
  </Styles>`;

    // ВКЛАДКА 1: СПРАВКА ПО ВАГОНАМ (МАТРИЦА)
    if (exportMatrix) {
      xml += `
  <Worksheet ss:Name="${escapeXml(sheet1Name)}">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="160"/>
      <Column ss:Width="70"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Column ss:Width="70"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>

      <Row ss:Height="26">
        <Cell ss:MergeAcross="7" ss:StyleID="HeaderTitle">
          <Data ss:Type="String">ТОО "Astana Railway Services" | Справка по вагонам ${escapeXml(reportDateLabel)} (${escapeXml(depotName)})</Data>
        </Cell>
      </Row>
      <Row ss:Height="6"/>

      <Row ss:Height="24">
        <Cell ss:MergeDown="1" ss:StyleID="ThDark"><Data ss:Type="String">Вид ремонта</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="ThDark"><Data ss:Type="String">Вагоны в ожидании ремонта на станции</Data></Cell>
        <Cell ss:MergeAcross="2" ss:StyleID="ThDark"><Data ss:Type="String">Вагоны, направленные к станции в ремонт</Data></Cell>
        <Cell ss:MergeDown="1" ss:StyleID="ThGrandTotal"><Data ss:Type="String">ВСЕГО</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:Index="2" ss:StyleID="ThSub"><Data ss:Type="String">КТТ</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Собственники</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Итого в ожид.</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">КТТ</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Собственники</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Итого направл.</Data></Cell>
      </Row>`;

      matrixRows.forEach((r) => {
        xml += `
      <Row ss:Height="21">
        <Cell ss:StyleID="TableCellBoldLeft"><Data ss:Type="String">${escapeXml(r.rep)}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${parseInt(r.w_ktt, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${parseInt(r.w_own, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(r.w_sub, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${parseInt(r.d_ktt, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${parseInt(r.d_own, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(r.d_sub, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellGrandTotal"><Data ss:Type="Number">${parseInt(r.grand, 10) || 0}</Data></Cell>
      </Row>`;
      });

      xml += `
      <Row ss:Height="24">
        <Cell ss:StyleID="FooterTotalLeft"><Data ss:Type="String">ВСЕГО</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(totals.w_ktt, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(totals.w_own, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="FooterHighlight"><Data ss:Type="Number">${parseInt(totals.w_sub, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(totals.d_ktt, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="TableCellTotal"><Data ss:Type="Number">${parseInt(totals.d_own, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="FooterHighlight"><Data ss:Type="Number">${parseInt(totals.d_sub, 10) || 0}</Data></Cell>
        <Cell ss:StyleID="FooterGrandTotal"><Data ss:Type="Number">${parseInt(totals.grand, 10) || 0}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>`;
    }

    // ВКЛАДКА 2: ПОНОМЕРНАЯ СИТУАЦИЯ
    if (exportWagons) {
      xml += `
  <Worksheet ss:Name="${escapeXml(sheet2Name)}">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="40"/>
      <Column ss:Width="65"/>
      <Column ss:Width="210"/>
      <Column ss:Width="240"/>
      <Column ss:Width="95"/>
      <Column ss:Width="140"/>
      <Column ss:Width="75"/>
      <Column ss:Width="90"/>
      <Column ss:Width="120"/>
      <Column ss:Width="320"/>

      <Row ss:Height="26">
        <Cell ss:MergeAcross="9" ss:StyleID="HeaderTitle">
          <Data ss:Type="String">Пономерной учёт вагонов (${escapeXml(depotName)} ${escapeXml(reportDateLabel)})</Data>
        </Cell>
      </Row>
      <Row ss:Height="6"/>

      <Row ss:Height="23">
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">№</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Депо</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Статус / Раздел</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Заказчик / Предприятие</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">№ вагона</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Род вагона</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Ремонт</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Дата подачи</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Путь / Станция</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Причина простоя / Примечание</Data></Cell>
      </Row>`;

      wagonRows.forEach((w) => {
        xml += `
      <Row>
        <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${w.idx}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(w.depot)}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(w.status)}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(w.cust)}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(w.num)}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(w.type)}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(w.repair)}</Data></Cell>
        <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(w.date)}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(w.loc)}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(w.reason)}</Data></Cell>
      </Row>`;
      });

      xml += `
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>`;
    }

    // ВКЛАДКА 3: КОЛЁСНЫЕ ПАРЫ
    if (exportWheels) {
      xml += `
  <Worksheet ss:Name="${escapeXml(sheet3Name)}">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="240"/>
      <Column ss:Width="60"/>
      <Column ss:Width="25"/>
      <Column ss:Width="220"/>
      <Column ss:Width="60"/>

      <Row ss:Height="26">
        <Cell ss:MergeAcross="4" ss:StyleID="HeaderTitle">
          <Data ss:Type="String">Участок КП и остаток ремфонда (${escapeXml(depotName)} ${escapeXml(reportDateLabel)})</Data>
        </Cell>
      </Row>
      <Row ss:Height="6"/>

      <Row ss:Height="22">
        <Cell ss:MergeAcross="1" ss:StyleID="SectionHeader"><Data ss:Type="String">1. Подкатка под вагоны</Data></Cell>
        <Cell ss:StyleID="Default"/>
        <Cell ss:MergeAcross="1" ss:StyleID="SectionHeader"><Data ss:Type="String">2. Остаток ремфонда на станции</Data></Cell>
      </Row>
      <Row ss:Height="20">
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Операция / Вид ремонта</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Шт.</Data></Cell>
        <Cell ss:StyleID="Default"/>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Категория / Собственник</Data></Cell>
        <Cell ss:StyleID="ThSub"><Data ss:Type="String">Шт.</Data></Cell>
      </Row>`;

      for (let i = 0; i < 6; i++) {
        const r1 = kpRoll[i] || { label: '', val: 0 };
        const r2 = kpStock[i] || null;

        xml += `
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">${escapeXml(r1.label)}</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${r1.val}</Data></Cell>
        <Cell ss:StyleID="Default"/>`;

        if (r2) {
          xml += `
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">${escapeXml(r2.label)}</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${r2.val}</Data></Cell>`;
        } else {
          xml += `
        <Cell ss:StyleID="Default"/>
        <Cell ss:StyleID="Default"/>`;
        }
        xml += `
      </Row>`;
      }

      xml += `
      <Row ss:Height="24">
        <Cell ss:StyleID="FooterTotalLeft"><Data ss:Type="String">ИТОГО ПОДКАТКА</Data></Cell>
        <Cell ss:StyleID="FooterHighlight"><Data ss:Type="Number">${totKpRoll}</Data></Cell>
        <Cell ss:StyleID="Default"/>
        <Cell ss:StyleID="FooterTotalLeft"><Data ss:Type="String">ИТОГО РЕМФОНД</Data></Cell>
        <Cell ss:StyleID="FooterHighlight"><Data ss:Type="Number">${totKpStock}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>`;
    }

    // ВКЛАДКА 4: KPI И СВОДНЫЕ ИНДИКАТОРЫ (если отмечен #bannerKpi)
    if (exportKpi) {
      const kpiPlan = document.getElementById('kpiValPlan')?.textContent || '456';
      const kpiFact = document.getElementById('kpiValFact')?.textContent || '212';
      const kpiDev = document.getElementById('kpiValDev')?.textContent || '-244';
      const kpiKtt = document.getElementById('kpiValKTT')?.textContent || '74';
      const kpiOwn = document.getElementById('kpiValOwn')?.textContent || '138';
      const kpiUnf = document.getElementById('kpiValUnfinished')?.textContent || '38';
      const kpiYtd = document.getElementById('kpiValYear')?.textContent || '2824';

      xml += `
  <Worksheet ss:Name="${escapeXml(sheet4Name)}">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="260"/>
      <Column ss:Width="140"/>
      <Row ss:Height="26">
        <Cell ss:MergeAcross="1" ss:StyleID="HeaderTitle">
          <Data ss:Type="String">KPI и сводные индикаторы (${escapeXml(depotName)} ${escapeXml(reportDateLabel)})</Data>
        </Cell>
      </Row>
      <Row ss:Height="6"/>
      <Row ss:Height="22">
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Показатель KPI</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Значение</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">План на месяц (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiPlan)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Факт выполнения (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiFact)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Отклонение от плана (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiDev)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Парк АО «КТТ» / Собственники (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiKtt)} / ${escapeXml(kpiOwn)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Неоконченный ремонт (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiUnf)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Выпуск с начала года (ваг.)</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="String">${escapeXml(kpiYtd)}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>`;
    }

    // ВКЛАДКА 5: СПРАВКА ИИ-АНАЛИТИКА (если отмечен #sectionAiAnalyst)
    if (exportAnalyst) {
      xml += `
  <Worksheet ss:Name="${escapeXml(sheet5Name)}">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="260"/>
      <Column ss:Width="120"/>
      <Column ss:Width="320"/>
      <Row ss:Height="26">
        <Cell ss:MergeAcross="2" ss:StyleID="HeaderTitle">
          <Data ss:Type="String">Справка ИИ-аналитика (${escapeXml(depotName)} ${escapeXml(reportDateLabel)})</Data>
        </Cell>
      </Row>
      <Row ss:Height="6"/>
      <Row ss:Height="22">
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Аналитический разрез</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Кол-во</Data></Cell>
        <Cell ss:StyleID="ThDark"><Data ss:Type="String">Комментарий / Рекомендация</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Всего вагонов в выбранном срезе</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${visibleWagons.length}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">Учтены фильтры: ремонт=${escapeXml(filterRepair)}, статус=${escapeXml(wagonFilterStatus)}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">В ожидании ремонта на станции</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${matrixCalculation.totals.waitTotal}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">КТТ: ${matrixCalculation.totals.waitKtt} ваг., Собственники: ${matrixCalculation.totals.waitOwn} ваг.</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">На подходе к станции</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${matrixCalculation.totals.dirTotal}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">Планирование подачи на ремонтные позиции ВРД</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Выпущено из ремонта</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${dateMode === 'period' ? periodOutputSummary.totalOut || matrixCalculation.totals.releaseTotal : matrixCalculation.totals.releaseTotal}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${dateMode === 'period' ? `Суммарный выпуск за ${periodDaysCount} сут.` : 'Выпуск за текущую смену'}</Data></Cell>
      </Row>
      <Row ss:Height="21">
        <Cell ss:StyleID="KpLabelCell"><Data ss:Type="String">Подкатка колёсных пар</Data></Cell>
        <Cell ss:StyleID="KpValueCell"><Data ss:Type="Number">${totKpRoll}</Data></Cell>
        <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">Остаток ремфонда на станции: ${totKpStock} шт.</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayGridlines/>
    </WorksheetOptions>
  </Worksheet>`;
    }

    xml += `
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Справка_${depot}_${fileDateSuffix}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    selectedDepot,
    reportDateValue,
    dateMode,
    dateFrom,
    dateTo,
    visibleSections,
    visibleWagons.length,
    filterRepair,
    wagonFilterStatus,
    matrixCalculation.totals,
    periodOutputSummary.totalOut,
    periodDaysCount,
  ]);

  useEffect(() => {
    const labels: Record<string, string> = {
      ALL: 'Все филиалы холдинга АРС (Сводная)',
    };
    references.depots.forEach((d) => {
      labels[d.code] = d.name;
    });
    window.currentDepot = selectedDepot;
    window.DEPOT_LABELS = labels;
    window.currentUser = currentUser;
    window.currentReportData = {
      wheel_pairs: {
        nonk: activeKpValues.kp_nonk,
        sonk: activeKpValues.kp_sonk,
        sr_ob: activeKpValues.kp_sr_ob,
        tr_ob: activeKpValues.kp_tr_ob,
        sr_bez: activeKpValues.kp_sr_bez,
        tr_bez: activeKpValues.kp_tr_bez,
        stock_ckk_ktt: activeKpValues.stock_ckk_ktt,
        stock_sonk_ktt: activeKpValues.stock_sonk_ktt,
        stock_ckk_ktz: activeKpValues.stock_ckk_ktz,
        stock_sonk_ktz: activeKpValues.stock_sonk_ktz,
        stock_rem_ktt: activeKpValues.stock_rem_ktt,
      },
    };
    window.handleExportReportClick = handleExportReportClick;
    window.exportDailyReportCSV = handleExportReportClick;
  }, [selectedDepot, references.depots, currentUser, activeKpValues, handleExportReportClick]);

  // Historical October 2026 matrix for collapsible reference section
  const dailyRows = data.daily_output_october;
  const filteredDetailRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return dailyRows.filter((r) => {
      const matchDepot = selectedDepot === 'ALL' ? true : r.depot_code === selectedDepot;
      const matchPeriod =
        dateMode === 'period' ? r.report_date >= dateFrom && r.report_date <= dateTo : true;
      const matchQuery =
        !q ||
        r.customer_name.toLowerCase().includes(q) ||
        r.wagon_type.toLowerCase().includes(q) ||
        r.report_date.includes(q);
      return matchDepot && matchPeriod && matchQuery;
    });
  }, [dailyRows, selectedDepot, dateMode, dateFrom, dateTo, historySearch]);

  const selectedDepotObj = references.depots.find((d) => d.code === selectedDepot);
  const matrixTitleText =
    selectedDepot === 'ALL'
      ? dateMode === 'period'
        ? `Сводная матрица всех филиалов холдинга АРС за период (${dateFrom} — ${dateTo})`
        : 'Сводная матрица всех филиалов холдинга АРС'
      : dateMode === 'period'
      ? `Матрица справки филиала ${selectedDepotObj?.name || selectedDepot} за период (${dateFrom} — ${dateTo})`
      : `Матрица суточной справки филиала: ${selectedDepotObj?.name || selectedDepot}`;
  const grandHeaderText =
    selectedDepot === 'ALL' ? 'ВСЕГО по холдингу' : `ВСЕГО по депо (${selectedDepot})`;

  // Extra custom depots added in ReferencesModal beyond the 4 standard ones
  const extraDepots = references.depots.filter(
    (d) => !['KVRD', 'AVRD', 'BVRD', 'UVRD'].includes(d.code)
  );

  // ========================================================
  // КОНТРОЛЛЕР КОМПОНЕНТА ВЫБОРА ДАТЫ, МЕСЯЦА И ГОДА С КАЛЕНДАРЁМ
  // ========================================================
  const calViewStateRef = useRef<{
    selectedDate: Date;
    viewYear: number;
    viewMonth: number;
    isOpen: boolean;
  }>({
    selectedDate: new Date(2026, 9, 21),
    viewYear: 2026,
    viewMonth: 9,
    isOpen: false,
  });

  const onDateChange = useCallback(
    (val: string) => {
      if (!val) return;
      setReportDateValue(val);
      loadCurrentBranchReport(selectedDepot, val);
      if (typeof window.logSystemAction === 'function') {
        window.logSystemAction('Выбор даты отчёта', `Установлена дата оперативной смены: ${val}`);
      }
    },
    [loadCurrentBranchReport, selectedDepot]
  );

  const updateDatePickerDisplay = useCallback(() => {
    const d = calViewStateRef.current.selectedDate;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;

    const hiddenInput = document.getElementById('inputDate') as HTMLInputElement | null;
    if (hiddenInput) {
      hiddenInput.value = isoDate;
    }

    const displayEl = document.getElementById('dateDisplayFormatted');
    if (displayEl) {
      displayEl.textContent = `${dd}.${mm}.${yyyy}`;
    }

    const daysShort = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const dowEl = document.getElementById('dateDisplayDayOfWeek') as HTMLElement | null;
    if (dowEl) {
      const dayIdx = d.getDay();
      dowEl.textContent = daysShort[dayIdx];
      if (dayIdx === 0 || dayIdx === 6) {
        dowEl.style.background = '#FEE2E2';
        dowEl.style.color = '#DC2626';
      } else {
        dowEl.style.background = '#E2E8F0';
        dowEl.style.color = '#475569';
      }
    }

    onDateChange(isoDate);
  }, [onDateChange]);

  const closeCalendarPopover = useCallback(() => {
    const popover = document.getElementById('arsCalendarPopover');
    const trigger = document.getElementById('arsDateTrigger');
    if (popover) popover.style.display = 'none';
    if (trigger) trigger.classList.remove('active');
    calViewStateRef.current.isOpen = false;
  }, []);

  const renderCalendarGrid = useCallback(() => {
    const grid = document.getElementById('calDaysGrid');
    const monthSelect = document.getElementById('calMonthSelect') as HTMLSelectElement | null;
    const yearSelect = document.getElementById('calYearSelect') as HTMLSelectElement | null;
    if (!grid) return;

    const { viewMonth, viewYear, selectedDate } = calViewStateRef.current;

    if (monthSelect) monthSelect.value = String(viewMonth);
    if (yearSelect) yearSelect.value = String(viewYear);

    grid.innerHTML = '';

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Воскресенье -> 6

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();

    const refToday = new Date(2026, 9, 21);
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // Предыдущий месяц (хвост)
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day other-month';
      cell.textContent = String(dayNum);
      cell.onclick = (e) => {
        e.stopPropagation();
        calViewStateRef.current.selectedDate = new Date(viewYear, viewMonth - 1, dayNum);
        calViewStateRef.current.viewYear = calViewStateRef.current.selectedDate.getFullYear();
        calViewStateRef.current.viewMonth = calViewStateRef.current.selectedDate.getMonth();
        updateDatePickerDisplay();
        renderCalendarGrid();
        closeCalendarPopover();
      };
      grid.appendChild(cell);
    }

    // Текущий месяц
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(viewYear, viewMonth, day);
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = String(day);

      const dow = cellDate.getDay();
      if (dow === 0 || dow === 6) cell.classList.add('weekend');
      if (isSameDay(cellDate, refToday)) cell.classList.add('today');
      if (isSameDay(cellDate, selectedDate)) cell.classList.add('selected');

      cell.onclick = (e) => {
        e.stopPropagation();
        calViewStateRef.current.selectedDate = cellDate;
        updateDatePickerDisplay();
        renderCalendarGrid();
        closeCalendarPopover();
      };
      grid.appendChild(cell);
    }

    // Следующий месяц (до 42 ячеек)
    const totalCells = startDayOfWeek + daysInMonth;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let nextD = 1; nextD <= nextDays; nextD++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day other-month';
      cell.textContent = String(nextD);
      cell.onclick = (e) => {
        e.stopPropagation();
        calViewStateRef.current.selectedDate = new Date(viewYear, viewMonth + 1, nextD);
        calViewStateRef.current.viewYear = calViewStateRef.current.selectedDate.getFullYear();
        calViewStateRef.current.viewMonth = calViewStateRef.current.selectedDate.getMonth();
        updateDatePickerDisplay();
        renderCalendarGrid();
        closeCalendarPopover();
      };
      grid.appendChild(cell);
    }
  }, [closeCalendarPopover, updateDatePickerDisplay]);

  const stepDateDay = useCallback(
    (offsetDays: number) => {
      const d = new Date(calViewStateRef.current.selectedDate);
      d.setDate(d.getDate() + offsetDays);
      calViewStateRef.current.selectedDate = d;
      calViewStateRef.current.viewYear = d.getFullYear();
      calViewStateRef.current.viewMonth = d.getMonth();
      updateDatePickerDisplay();
      renderCalendarGrid();
    },
    [renderCalendarGrid, updateDatePickerDisplay]
  );

  const stepCalMonth = useCallback(
    (offsetMonths: number) => {
      const d = new Date(
        calViewStateRef.current.viewYear,
        calViewStateRef.current.viewMonth + offsetMonths,
        1
      );
      calViewStateRef.current.viewYear = d.getFullYear();
      calViewStateRef.current.viewMonth = d.getMonth();
      renderCalendarGrid();
    },
    [renderCalendarGrid]
  );

  const onCalMonthYearChange = useCallback(() => {
    const monthSelect = document.getElementById('calMonthSelect') as HTMLSelectElement | null;
    const yearSelect = document.getElementById('calYearSelect') as HTMLSelectElement | null;
    if (monthSelect) calViewStateRef.current.viewMonth = parseInt(monthSelect.value, 10);
    if (yearSelect) calViewStateRef.current.viewYear = parseInt(yearSelect.value, 10);
    renderCalendarGrid();
  }, [renderCalendarGrid]);

  const goToTodayDate = useCallback(() => {
    const oct21 = new Date(2026, 9, 21);
    calViewStateRef.current.selectedDate = oct21;
    calViewStateRef.current.viewYear = oct21.getFullYear();
    calViewStateRef.current.viewMonth = oct21.getMonth();
    updateDatePickerDisplay();
    renderCalendarGrid();
    closeCalendarPopover();
  }, [closeCalendarPopover, renderCalendarGrid, updateDatePickerDisplay]);

  const setRelativeDateDay = useCallback(
    (offsetDays: number) => {
      const d = new Date(2026, 9, 21);
      d.setDate(d.getDate() + offsetDays);
      calViewStateRef.current.selectedDate = d;
      calViewStateRef.current.viewYear = d.getFullYear();
      calViewStateRef.current.viewMonth = d.getMonth();
      updateDatePickerDisplay();
      renderCalendarGrid();
      closeCalendarPopover();
    },
    [closeCalendarPopover, renderCalendarGrid, updateDatePickerDisplay]
  );

  const toggleCalendarPopover = useCallback(
    (event?: MouseEvent | React.MouseEvent) => {
      if (event) event.stopPropagation();
      const popover = document.getElementById('arsCalendarPopover');
      const trigger = document.getElementById('arsDateTrigger');
      if (!popover) return;

      calViewStateRef.current.isOpen = !calViewStateRef.current.isOpen;
      if (calViewStateRef.current.isOpen) {
        calViewStateRef.current.viewYear = calViewStateRef.current.selectedDate.getFullYear();
        calViewStateRef.current.viewMonth = calViewStateRef.current.selectedDate.getMonth();
        renderCalendarGrid();
        popover.style.display = 'block';
        if (trigger) trigger.classList.add('active');
      } else {
        closeCalendarPopover();
      }
    },
    [closeCalendarPopover, renderCalendarGrid]
  );

  const initDatePickerComponent = useCallback(() => {
    const yearSelect = document.getElementById('calYearSelect') as HTMLSelectElement | null;
    const baseYear = 2026;
    if (yearSelect) {
      yearSelect.innerHTML = '';
      for (let y = baseYear - 3; y <= baseYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = `${y} г.`;
        yearSelect.appendChild(opt);
      }
    }

    // Устанавливаем дату по умолчанию в шапке на 21 октября 2026 года
    const inputDateEl = document.getElementById('inputDate') as HTMLInputElement | null;
    if (inputDateEl) {
      inputDateEl.value = '2026-10-21';
    }

    const defaultOctDate = new Date(2026, 9, 21);
    calViewStateRef.current.selectedDate = defaultOctDate;
    calViewStateRef.current.viewYear = 2026;
    calViewStateRef.current.viewMonth = 9;

    updateDatePickerDisplay();
    renderCalendarGrid();
  }, [renderCalendarGrid, updateDatePickerDisplay]);

  useEffect(() => {
    initDatePickerComponent();

    const handleDocClick = (e: MouseEvent) => {
      const toolbar = document.getElementById('arsDateToolbar');
      if (toolbar && !toolbar.contains(e.target as Node)) {
        closeCalendarPopover();
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => {
      document.removeEventListener('click', handleDocClick);
    };
  }, [initDatePickerComponent, closeCalendarPopover]);

  useEffect(() => {
    window.initDatePickerComponent = initDatePickerComponent;
    window.updateDatePickerDisplay = updateDatePickerDisplay;
    window.renderCalendarGrid = renderCalendarGrid;
    window.stepDateDay = stepDateDay;
    window.stepCalMonth = stepCalMonth;
    window.onCalMonthYearChange = onCalMonthYearChange;
    window.goToTodayDate = goToTodayDate;
    window.setRelativeDateDay = setRelativeDateDay;
    window.toggleCalendarPopover = toggleCalendarPopover;
    window.closeCalendarPopover = closeCalendarPopover;
    window.onDateChange = onDateChange;
  }, [
    initDatePickerComponent,
    updateDatePickerDisplay,
    renderCalendarGrid,
    stepDateDay,
    stepCalMonth,
    onCalMonthYearChange,
    goToTodayDate,
    setRelativeDateDay,
    toggleCalendarPopover,
    closeCalendarPopover,
    onDateChange,
  ]);

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-[#1B365D] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-lg border border-slate-700"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Панель переключения филиалов и статуса */}
      <div id="branchSwitcherBar" className="branch-bar">
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {isBranchRole ? 'Изолированный контур депо:' : 'Аналитика холдинга:'}
        </span>

        <a
          href="#all"
          id="pill-ALL"
          style={{ display: isBranchRole ? 'none' : 'inline-flex' }}
          className={`branch-pill ${selectedDepot === 'ALL' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            selectDepot('ALL');
          }}
        >
          📊 Общая сводка холдинга
        </a>

        <a
          href="#KVRD"
          id="pill-KVRD"
          style={{
            display: !isBranchRole || lockedDepotCode === 'KVRD' ? 'inline-flex' : 'none',
          }}
          className={`branch-pill ${selectedDepot === 'KVRD' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            selectDepot('KVRD');
          }}
        >
          KVRD (Кушмурун)
        </a>

        <a
          href="#AVRD"
          id="pill-AVRD"
          style={{
            display: !isBranchRole || lockedDepotCode === 'AVRD' ? 'inline-flex' : 'none',
          }}
          className={`branch-pill ${selectedDepot === 'AVRD' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            selectDepot('AVRD');
          }}
        >
          AVRD (Арыс)
        </a>

        <a
          href="#BVRD"
          id="pill-BVRD"
          style={{
            display: !isBranchRole || lockedDepotCode === 'BVRD' ? 'inline-flex' : 'none',
          }}
          className={`branch-pill ${selectedDepot === 'BVRD' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            selectDepot('BVRD');
          }}
        >
          BVRD (Балхаш)
        </a>

        <a
          href="#UVRD"
          id="pill-UVRD"
          style={{
            display: !isBranchRole || lockedDepotCode === 'UVRD' ? 'inline-flex' : 'none',
          }}
          className={`branch-pill ${selectedDepot === 'UVRD' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            selectDepot('UVRD');
          }}
        >
          UVRD (Уральск)
        </a>

        {extraDepots.map((dep) => (
          <a
            key={dep.id}
            href={`#${dep.code}`}
            id={`pill-${dep.code}`}
            style={{
              display: !isBranchRole || lockedDepotCode === dep.code ? 'inline-flex' : 'none',
            }}
            className={`branch-pill ${selectedDepot === dep.code ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              selectDepot(dep.code);
            }}
          >
            {dep.code} ({dep.city || dep.name})
          </a>
        ))}

        {isBranchRole && (
          <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            🔒 Доступ ограничен филиалом {lockedDepotCode}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            className="ars-date-toolbar"
            id="arsDateToolbar"
            style={{ display: dateMode === 'daily' ? 'inline-flex' : 'none' }}
          >
            <button
              type="button"
              className="ars-date-btn-nav"
              onClick={() => stepDateDay(-1)}
              title="Предыдущий день"
            >
              ◀
            </button>

            <div
              className="ars-date-trigger"
              id="arsDateTrigger"
              onClick={(e) => toggleCalendarPopover(e)}
            >
              <span>📅</span>
              <span
                id="dateDisplayFormatted"
                style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}
              >
                21.10.2026
              </span>
              <span
                id="dateDisplayDayOfWeek"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '3px',
                  background: '#E2E8F0',
                  color: '#475569',
                  textTransform: 'uppercase',
                }}
              >
                СР
              </span>
              <span style={{ fontSize: '9px', color: '#64748B', marginLeft: '2px' }}>▼</span>
            </div>

            <input
              type="hidden"
              id="inputDate"
              value={reportDateValue}
              onChange={(e) => onDateChange(e.target.value)}
            />

            <button
              type="button"
              className="ars-date-btn-nav"
              onClick={() => stepDateDay(1)}
              title="Следующий день"
            >
              ▶
            </button>

            <button
              type="button"
              className="ars-date-today-btn"
              onClick={() => goToTodayDate()}
            >
              Сегодня
            </button>

            <div
              className="ars-calendar-popover"
              id="arsCalendarPopover"
              style={{ display: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cal-header">
                <button
                  type="button"
                  className="cal-nav-month"
                  onClick={() => stepCalMonth(-1)}
                >
                  ◀
                </button>
                <div className="cal-select-group">
                  <select
                    id="calMonthSelect"
                    className="cal-select"
                    onChange={() => onCalMonthYearChange()}
                  >
                    <option value="0">Январь</option>
                    <option value="1">Февраль</option>
                    <option value="2">Март</option>
                    <option value="3">Апрель</option>
                    <option value="4">Май</option>
                    <option value="5">Июнь</option>
                    <option value="6">Июль</option>
                    <option value="7">Август</option>
                    <option value="8">Сентябрь</option>
                    <option value="9">Октябрь</option>
                    <option value="10">Ноябрь</option>
                    <option value="11">Декабрь</option>
                  </select>
                  <select
                    id="calYearSelect"
                    className="cal-select"
                    onChange={() => onCalMonthYearChange()}
                  ></select>
                </div>
                <button
                  type="button"
                  className="cal-nav-month"
                  onClick={() => stepCalMonth(1)}
                >
                  ▶
                </button>
              </div>
              <div className="cal-weekdays">
                <span className="cal-weekday">ПН</span>
                <span className="cal-weekday">ВТ</span>
                <span className="cal-weekday">СР</span>
                <span className="cal-weekday">ЧТ</span>
                <span className="cal-weekday">ПТ</span>
                <span className="cal-weekday weekend">СБ</span>
                <span className="cal-weekday weekend">ВС</span>
              </div>
              <div className="cal-days-grid" id="calDaysGrid"></div>
              <div className="cal-footer">
                <div className="cal-quick-btns">
                  <button
                    type="button"
                    className="cal-quick-btn"
                    onClick={() => setRelativeDateDay(-1)}
                  >
                    Вчера
                  </button>
                  <button
                    type="button"
                    className="cal-quick-btn"
                    onClick={() => setRelativeDateDay(0)}
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    className="cal-quick-btn"
                    onClick={() => setRelativeDateDay(1)}
                  >
                    Завтра
                  </button>
                </div>
                <button
                  type="button"
                  className="cal-close-btn"
                  onClick={() => closeCalendarPopover()}
                >
                  Закрыть ✕
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btnExportCsvReport"
            onClick={handleExportReportClick}
            className="btn btn-primary"
            style={{ background: '#1B365D', borderColor: '#1B365D' }}
            title="Скачать форматированный отчёт Excel (.xls) по выбранным разделам и фильтрам"
          >
            <span>📥 Выгрузить отчёт</span>
          </button>

          <button
            type="button"
            id="btnResetShift"
            onClick={resetCurrentShift}
            className="btn btn-secondary"
            title="Очистить пономерной список вагонов, обнулить колёсные пары и пересчитать матрицу"
          >
            <span>🔄 Сброс смены</span>
          </button>

          {shiftWagons.length === 0 && (
            <button
              type="button"
              onClick={handleRestoreDemoShift}
              className="btn btn-secondary"
              title="Загрузить демонстрационные данные смены 2026 г."
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Демо-данные</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.openAuditLogModal?.('devlog')}
            className="btn btn-secondary"
            title="Журнал системы и Чёрный ящик разработчика (Flight Recorder)"
          >
            📜 Журнал системы
          </button>

          <button
            type="button"
            onClick={() => window.openReferencesModal?.()}
            className="btn btn-secondary"
            title="Управление справочниками АРС"
          >
            ⚙️ Справочники
          </button>
        </div>
      </div>

      {/* ПАНЕЛЬ ВЫБОРА ПЕРИОДА, ФИЛЬТРАЦИИ РАЗДЕЛОВ И КРИТЕРИЕВ ОТБОРА (СРЕЗОВ ДАННЫХ) */}
      <div className="ars-filter-panel" id="arsFilterPanel">
        {/* 1. Режимы выбора дат: Суточный (1 день) vs За период (Диапазон дат) */}
        <div className="ars-filter-row">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Режим периода:
            </span>
            <div className="ars-mode-switcher" role="group" aria-label="Режим выбора дат">
              <button
                type="button"
                id="modeBtnDaily"
                className={`ars-mode-btn ${dateMode === 'daily' ? 'active' : ''}`}
                onClick={() => setReportDateMode('daily')}
              >
                📅 Суточный (1 день)
              </button>
              <button
                type="button"
                id="modeBtnPeriod"
                className={`ars-mode-btn ${dateMode === 'period' ? 'active' : ''}`}
                onClick={() => setReportDateMode('period')}
              >
                🗓️ За период (Диапазон дат)
              </button>
            </div>
          </div>

          {dateMode === 'period' ? (
            <div className="ars-period-controls" id="arsPeriodControls">
              <div className="ars-period-input-group">
                <label htmlFor="dateFrom">С даты:</label>
                <input
                  type="date"
                  id="dateFrom"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="ars-period-input"
                />
              </div>
              <span className="text-slate-400 font-bold">—</span>
              <div className="ars-period-input-group">
                <label htmlFor="dateTo">По дату:</label>
                <input
                  type="date"
                  id="dateTo"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="ars-period-input"
                />
              </div>

              <div className="ars-preset-group">
                <button
                  type="button"
                  className={`ars-preset-btn ${activePreset === '7days' ? 'active' : ''}`}
                  onClick={() => applyPeriodPreset('7days')}
                >
                  7 дней
                </button>
                <button
                  type="button"
                  className={`ars-preset-btn ${activePreset === 'thisMonth' ? 'active' : ''}`}
                  onClick={() => applyPeriodPreset('thisMonth')}
                >
                  Текущий месяц
                </button>
                <button
                  type="button"
                  className={`ars-preset-btn ${activePreset === 'lastMonth' ? 'active' : ''}`}
                  onClick={() => applyPeriodPreset('lastMonth')}
                >
                  Прошлый месяц
                </button>
                <button
                  type="button"
                  className={`ars-preset-btn ${activePreset === 'ytd' ? 'active' : ''}`}
                  onClick={() => applyPeriodPreset('ytd')}
                >
                  С начала года
                </button>
              </div>

              <span className="text-[11px] font-mono font-bold text-[#1B365D] bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                Интервал: {periodDaysCount} сут. · Выпуск: {periodOutputSummary.totalOut || matrixCalculation.totals.releaseTotal} ваг.
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              Оперативный срез на выбранную дату:{' '}
              <strong className="font-mono text-slate-800">{reportDateValue}</strong>
            </div>
          )}
        </div>

        {/* 2. Фильтр разделов («Какую именно информацию предоставить») */}
        <div className="ars-section-toggles" id="arsSectionToggles">
          <span className="ars-section-toggle-label">
            Какую информацию предоставить:
          </span>

          <label
            className={`ars-section-checkbox-pill ${
              visibleSections.bannerKpi ? 'checked' : ''
            }`}
          >
            <input
              type="checkbox"
              id="chkBannerKpi"
              checked={visibleSections.bannerKpi}
              onChange={(e) => toggleSectionVisibility('bannerKpi', e.target.checked)}
            />
            <span>KPI и сводные индикаторы</span>
          </label>

          <label
            className={`ars-section-checkbox-pill ${
              visibleSections.sectionMatrix ? 'checked' : ''
            }`}
          >
            <input
              type="checkbox"
              id="chkSectionMatrix"
              checked={visibleSections.sectionMatrix}
              onChange={(e) => toggleSectionVisibility('sectionMatrix', e.target.checked)}
            />
            <span>Справка по ремонту / Матрица депо</span>
          </label>

          <label
            className={`ars-section-checkbox-pill ${
              visibleSections.sectionWagons ? 'checked' : ''
            }`}
          >
            <input
              type="checkbox"
              id="chkSectionWagons"
              checked={visibleSections.sectionWagons}
              onChange={(e) => toggleSectionVisibility('sectionWagons', e.target.checked)}
            />
            <span>Пономерной учёт вагонов</span>
          </label>

          <label
            className={`ars-section-checkbox-pill ${
              visibleSections.sectionWheels ? 'checked' : ''
            }`}
          >
            <input
              type="checkbox"
              id="chkSectionWheels"
              checked={visibleSections.sectionWheels}
              onChange={(e) => toggleSectionVisibility('sectionWheels', e.target.checked)}
            />
            <span>Колёсные пары</span>
          </label>

          <label
            className={`ars-section-checkbox-pill ${
              visibleSections.sectionAiAnalyst ? 'checked' : ''
            }`}
          >
            <input
              type="checkbox"
              id="chkSectionAiAnalyst"
              checked={visibleSections.sectionAiAnalyst}
              onChange={(e) => toggleSectionVisibility('sectionAiAnalyst', e.target.checked)}
            />
            <span>Справка ИИ-аналитика</span>
          </label>
        </div>

        {/* 3. Фильтры критериев отбора (срезы данных) */}
        <div className="ars-criteria-grid" id="arsCriteriaFilters">
          <div className="ars-criteria-item">
            <label htmlFor="filterDepot">Филиал</label>
            <select
              id="filterDepot"
              className="ars-criteria-select"
              value={selectedDepot}
              disabled={isBranchRole}
              onChange={(e) => selectDepot(e.target.value)}
            >
              {!isBranchRole && <option value="ALL">Все депо (Холдинг)</option>}
              {(!isBranchRole || lockedDepotCode === 'KVRD') && (
                <option value="KVRD">Кушмурун (КВРД)</option>
              )}
              {(!isBranchRole || lockedDepotCode === 'AVRD') && (
                <option value="AVRD">Арыс (АВРД)</option>
              )}
              {(!isBranchRole || lockedDepotCode === 'BVRD') && (
                <option value="BVRD">Балхаш (БВРД)</option>
              )}
              {(!isBranchRole || lockedDepotCode === 'UVRD') && (
                <option value="UVRD">Уральск (УВРД)</option>
              )}
              {extraDepots.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.city || d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="ars-criteria-item">
            <label htmlFor="filterRepair">Вид ремонта</label>
            <select
              id="filterRepair"
              className="ars-criteria-select"
              value={filterRepair}
              onChange={(e) => setFilterRepair(e.target.value)}
            >
              <option value="ALL">Все</option>
              <option value="ДР">ДР</option>
              <option value="КР">КР</option>
              <option value="ТОР">ТОР</option>
              <option value="ДР-КНР">ДР-КНР</option>
              <option value="ДРП">ДРП</option>
              <option value="КРП">КРП</option>
              <option value="ТОР-КНР">ТОР-КНР</option>
              {activeRepairTypes
                .map((r) => getRepairCode(r))
                .filter(
                  (code) =>
                    !['ДР', 'КР', 'ТОР', 'ДР-КНР', 'ДРП', 'КРП', 'ТОР-КНР'].includes(code)
                )
                .map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
            </select>
          </div>

          <div className="ars-criteria-item">
            <label htmlFor="filterStatus">Статус вагона</label>
            <select
              id="filterStatus"
              className="ars-criteria-select"
              value={wagonFilterStatus}
              onChange={(e) => setWagonFilterStatus(e.target.value)}
            >
              <option value="ALL">Все</option>
              <option value="WAITING_GROUP">В ожидании ремонта</option>
              <option value="IN_REPAIR_GROUP">В ремонте</option>
              <option value="RELEASED_GROUP">Выпущены</option>
              <option value="DEFECT_GROUP">Брак</option>
              <optgroup label="Детальные разделы учёта">
                {references.sections.map((sec) => (
                  <option key={sec.id} value={sec.label}>
                    {sec.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="ars-criteria-item">
            <label htmlFor="filterSearch">Быстрый поиск (№ вагона / собственник)</label>
            <input
              type="text"
              id="filterSearch"
              className="ars-criteria-input"
              value={wagonSearch}
              onChange={(e) => setWagonSearch(e.target.value)}
              placeholder="Введите номер вагона или собственника..."
            />
          </div>
        </div>
      </div>

      {/* 2. Навигация по 3 вкладкам суточной справки */}
      <div className="tabs">
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'tab-matrix' ? 'active' : ''}`}
          id="tabBtn-matrix"
          data-tab="tab-matrix"
          style={{ display: visibleSections.sectionMatrix ? '' : 'none' }}
          onClick={() => switchTab('tab-matrix')}
        >
          📊 1. Справка по вагонам
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'tab-wagons' ? 'active' : ''}`}
          id="tabBtn-wagons"
          data-tab="tab-wagons"
          style={{ display: visibleSections.sectionWagons ? '' : 'none' }}
          onClick={() => switchTab('tab-wagons')}
        >
          🚂 2. Пономерная ситуация и дислокация ({visibleWagons.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubTab === 'tab-kp' ? 'active' : ''}`}
          id="tabBtn-kp"
          data-tab="tab-kp"
          style={{ display: visibleSections.sectionWheels ? '' : 'none' }}
          onClick={() => switchTab('tab-kp')}
        >
          ⚙️ 3. Колёсные пары (КП)
        </button>
      </div>

      {/* Вкладка 1: Матрица ремонтов и карточки депо (#sectionMatrix) */}
      <div
        id="sectionMatrix"
        style={{
          display:
            visibleSections.sectionMatrix && activeSubTab === 'tab-matrix' ? 'block' : 'none',
        }}
      >
        <div
          id="tab-matrix"
          className={`tab-content ${activeSubTab === 'tab-matrix' ? 'active' : ''}`}
          style={{ display: 'block' }}
        >
        <div id="hqSection" style={{ marginBottom: '20px' }}>
          <div
            className={`grid grid-cols-1 ${
              isBranchRole ? 'sm:grid-cols-1 max-w-md' : 'sm:grid-cols-2 lg:grid-cols-4'
            } gap-4`}
          >
            {[
              { code: 'KVRD', title: 'Кушмурунское ВРД (КВРД)' },
              { code: 'AVRD', title: 'Арысское ВРД (АВРД)' },
              { code: 'BVRD', title: 'Балхашское ВРД (БВРД)' },
              { code: 'UVRD', title: 'Уральское ВРД (УВРД)' },
              ...extraDepots.map((d) => ({ code: d.code, title: d.name })),
            ].map((dep) => {
              const isDone = !!hqStatus[dep.code];
              const depWagonCount = shiftWagons.filter((w) => w.depot_code === dep.code).length;
              const isSelected = selectedDepot === dep.code;
              const isVisibleCard = !isBranchRole || lockedDepotCode === dep.code;
              return (
                <div
                  key={dep.code}
                  id={`hq-${dep.code}`}
                  style={{ display: isVisibleCard ? 'block' : 'none' }}
                  className={`hq-card ${isDone ? 'done' : ''} ${
                    isSelected ? 'ring-2 ring-[#1B365D]/25' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => selectDepot(dep.code)}
                      className="text-left cursor-pointer group"
                    >
                      <div
                        style={{ fontSize: '14px', fontWeight: 700, color: '#1B365D' }}
                        className="group-hover:underline"
                      >
                        {dep.title}
                      </div>
                    </button>
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500">
                      {depWagonCount} ваг.
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div id={`hq-status-${dep.code}`} style={{ fontSize: '12px' }}>
                      {isDone ? (
                        <span>
                          🟢 <strong>Сдано</strong>
                        </span>
                      ) : (
                        <span>
                          ⚪ <em>Ожидает сдачи</em>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleDepotShiftDone(dep.code)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      title="Переключить статус сдачи смены депо"
                    >
                      {isDone ? 'Вернуть в работу' : 'Сдать смену'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="card"
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #DCE2EB',
            padding: '20px',
          }}
        >
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div>
              <h3
                id="matrixCardTitle"
                style={{ fontSize: '16px', fontWeight: 700, color: '#1B365D' }}
              >
                {matrixTitleText}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Распределение вагонов по разделам «Ожидание на станции» и «Направленные в ремонт» в разрезе парка АО «КТТ» и Собственников (синхронизировано в {syncTimestamp})
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  background: '#E8F8F5',
                  color: '#117864',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid #A3E4D7',
                }}
              >
                🔒 Авторасчёт из пономерного учёта
              </span>
              <button
                type="button"
                onClick={() => syncMatrixFromWagons(true)}
                className="btn btn-secondary"
              >
                🔄 Обновить
              </button>
              <button
                type="button"
                onClick={handleExportReportClick}
                className="btn btn-secondary"
                title="Скачать форматированный отчёт Excel (.xls) с матрицей ремонтов и списком вагонов"
              >
                <span>📥 Выгрузить отчёт</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('tab-wagons')}
                className="btn btn-primary"
              >
                🚂 Перейти к пономерному списку ({depotScopedWagons.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table
              ref={matrixTableRef}
              className="branch-matrix-table"
              id="branchMatrixTable"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              <thead>
                <tr style={{ background: '#1B365D', color: 'white' }}>
                  <th
                    rowSpan={2}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #DCE2EB',
                      width: '190px',
                      textAlign: 'left',
                    }}
                  >
                    Вид ремонта
                  </th>
                  <th colSpan={3} style={{ padding: '10px', border: '1px solid #DCE2EB' }}>
                    Вагоны в ожидании ремонта на станции
                  </th>
                  <th colSpan={3} style={{ padding: '10px', border: '1px solid #DCE2EB' }}>
                    Вагоны, направленные к станции в ремонт
                  </th>
                  <th
                    rowSpan={2}
                    id="thGrandHeader"
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #DCE2EB',
                      width: '150px',
                      background: '#0F223D',
                    }}
                  >
                    {grandHeaderText}
                  </th>
                </tr>
                <tr style={{ background: '#EAEFF5', color: '#1B365D' }}>
                  <th style={{ padding: '8px', border: '1px solid #DCE2EB' }}>КТТ</th>
                  <th style={{ padding: '8px', border: '1px solid #DCE2EB' }}>Собственники</th>
                  <th
                    style={{
                      padding: '8px',
                      border: '1px solid #DCE2EB',
                      background: '#FFF9E6',
                      color: '#856404',
                      fontWeight: 700,
                    }}
                  >
                    Итого в ожид.
                  </th>
                  <th style={{ padding: '8px', border: '1px solid #DCE2EB' }}>КТТ</th>
                  <th style={{ padding: '8px', border: '1px solid #DCE2EB' }}>Собственники</th>
                  <th
                    style={{
                      padding: '8px',
                      border: '1px solid #DCE2EB',
                      background: '#FFF9E6',
                      color: '#856404',
                      fontWeight: 700,
                    }}
                  >
                    Итого направл.
                  </th>
                </tr>
              </thead>

              <tbody id="branchMatrixBody">
                {matrixCalculation.rows.map((r) => (
                  <tr key={r.code} data-repair={r.code} className="hover:bg-slate-50/70">
                    <td
                      style={{
                        textAlign: 'left',
                        fontWeight: 700,
                        color: '#1B365D',
                        background: '#FAFBFD',
                        padding: '8px',
                      }}
                    >
                      {r.label}
                    </td>
                    <td
                      className={`cell-w-ktt matrix-val ${
                        r.waitKtt > 0 ? 'has-wagons' : 'text-slate-500'
                      }`}
                      style={{ textAlign: 'center', padding: '8px' }}
                    >
                      {r.waitKtt}
                    </td>
                    <td
                      className={`cell-w-own matrix-val ${
                        r.waitOwn > 0 ? 'has-wagons' : 'text-slate-500'
                      }`}
                      style={{ textAlign: 'center', padding: '8px' }}
                    >
                      {r.waitOwn}
                    </td>
                    <td
                      className="td-total sub-w-total matrix-val"
                      style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: '#FFF9E6',
                        color: r.waitTotal > 0 ? '#856404' : '#94A3B8',
                        fontWeight: 700,
                      }}
                    >
                      {r.waitTotal}
                    </td>
                    <td
                      className={`cell-d-ktt matrix-val ${
                        r.dirKtt > 0 ? 'has-wagons' : 'text-slate-500'
                      }`}
                      style={{ textAlign: 'center', padding: '8px' }}
                    >
                      {r.dirKtt}
                    </td>
                    <td
                      className={`cell-d-own matrix-val ${
                        r.dirOwn > 0 ? 'has-wagons' : 'text-slate-500'
                      }`}
                      style={{ textAlign: 'center', padding: '8px' }}
                    >
                      {r.dirOwn}
                    </td>
                    <td
                      className="td-total sub-d-total matrix-val"
                      style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: '#FFF9E6',
                        color: r.dirTotal > 0 ? '#856404' : '#94A3B8',
                        fontWeight: 700,
                      }}
                    >
                      {r.dirTotal}
                    </td>
                    <td
                      className="td-grand-total row-grand-total matrix-val"
                      style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: '#FFE082',
                        color: r.grandTotal > 0 ? '#0F172A' : '#64748B',
                        fontWeight: 800,
                      }}
                    >
                      {r.grandTotal}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot id="branchMatrixFoot">
                <tr style={{ background: '#1B365D', color: 'white', fontWeight: 700 }}>
                  <td style={{ textAlign: 'left', padding: '10px 12px' }}>
                    ИТОГО (Ожидание + Подход)
                  </td>
                  <td className="matrix-val">{matrixCalculation.totals.waitKtt}</td>
                  <td className="matrix-val">{matrixCalculation.totals.waitOwn}</td>
                  <td
                    className="matrix-val"
                    style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}
                  >
                    {matrixCalculation.totals.waitTotal}
                  </td>
                  <td className="matrix-val">{matrixCalculation.totals.dirKtt}</td>
                  <td className="matrix-val">{matrixCalculation.totals.dirOwn}</td>
                  <td
                    className="matrix-val"
                    style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}
                  >
                    {matrixCalculation.totals.dirTotal}
                  </td>
                  <td
                    className="matrix-val"
                    style={{ background: '#0F223D', color: '#FFFFFF', fontWeight: 800 }}
                  >
                    {matrixCalculation.totals.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Дополнительная оперативная строка по выпуску и неоконченному ремонту из Таблицы 2 */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div
              id="matrixFooterNotice"
              className="matrix-footer-note flex flex-wrap items-center gap-4"
            >
              <span>
                Всего в пономерном списке смены:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {depotScopedWagons.length} ваг.
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                На станции (вкл. неоконч. ремонт):{' '}
                <strong className="font-mono tabular-nums text-blue-700">
                  {matrixCalculation.totals.waitTotal} ваг.
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                В подходе:{' '}
                <strong className="font-mono tabular-nums text-indigo-700">
                  {matrixCalculation.totals.dirTotal} ваг.
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Выпуск за смену:{' '}
                <strong className="font-mono tabular-nums text-emerald-700">
                  {matrixCalculation.totals.releaseTotal} ваг.
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Неоконченный ремонт / Подъемка:{' '}
                <strong className="font-mono tabular-nums text-amber-700">
                  {matrixCalculation.totals.otherTotal} ваг.
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onAskAnalyst(
                  `Проанализируй оперативную суточную матрицу (${
                    selectedDepot === 'ALL' ? 'все филиалы АРС' : selectedDepot
                }): в ожидании на станции ${matrixCalculation.totals.waitTotal} ваг. (КТТ: ${
                    matrixCalculation.totals.waitKtt
                  }, Собственники: ${
                    matrixCalculation.totals.waitOwn
                  }), направлено к станции ${matrixCalculation.totals.dirTotal} ваг. (КТТ: ${
                    matrixCalculation.totals.dirKtt
                  }, Собственники: ${
                    matrixCalculation.totals.dirOwn
                  }), выпуск за смену ${
                    matrixCalculation.totals.releaseTotal
                  } ваг., неоконченный ремонт и подъемка ${matrixCalculation.totals.otherTotal} ваг.`
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B365D] hover:underline cursor-pointer"
            >
              <span>Передать сводку смены в ИИ-Аналитик</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Вкладка 2: Пономерной учёт вагонов (#sectionWagons) */}
      <div
        id="sectionWagons"
        style={{
          display:
            visibleSections.sectionWagons && activeSubTab === 'tab-wagons' ? 'block' : 'none',
        }}
      >
        <div
          id="tab-wagons"
          className={`tab-content ${activeSubTab === 'tab-wagons' ? 'active' : ''}`}
          style={{ display: 'block' }}
        >
        <div
          className="card"
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #DCE2EB',
            padding: '20px',
          }}
        >
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong style={{ fontSize: '16px', color: '#1B365D' }}>
                Пономерной учёт вагонов депо{' '}
                {selectedDepot === 'ALL' ? '(Все филиалы АРС)' : `(${selectedDepot})`}
              </strong>
              <span
                id="wagonSummaryBadge"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#EAEFF5',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  marginLeft: '4px',
                  color: '#1B365D',
                }}
              >
                Всего: {visibleWagons.length} из {periodAwareWagons.length} ваг.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={wagonFilterStatus}
                onChange={(e) => setWagonFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-[#1B365D]"
              >
                <option value="ALL">Все разделы ({periodAwareWagons.length})</option>
                {references.sections.map((sec) => (
                  <option key={sec.id} value={sec.label}>
                    {sec.label}
                  </option>
                ))}
              </select>

              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={wagonSearch}
                  onChange={(e) => setWagonSearch(e.target.value)}
                  placeholder="Поиск № вагона, заказчика..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#1B365D]"
                />
              </div>

              <button
                type="button"
                onClick={handleExportReportClick}
                className="btn btn-secondary"
                title="Скачать форматированный отчёт Excel (.xls) по отмеченным разделам и фильтрам"
              >
                <span>📥 Выгрузить отчёт</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addWagonRow()}
              >
                ➕ Добавить вагон в смену
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table
              className="situation-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
            >
              <thead>
                <tr style={{ background: '#F1F4F8', color: '#1B365D' }}>
                  <th style={{ padding: '10px 6px', width: '52px', textAlign: 'left' }}>№</th>
                  <th style={{ padding: '10px 6px', width: '195px', textAlign: 'left' }}>
                    Раздел / Статус
                  </th>
                  <th style={{ padding: '10px 6px', width: '230px', textAlign: 'left' }}>
                    Заказчик / Предприятие
                  </th>
                  <th style={{ padding: '10px 6px', width: '115px', textAlign: 'left' }}>
                    № вагона
                  </th>
                  <th style={{ padding: '10px 6px', width: '150px', textAlign: 'left' }}>
                    Род вагона
                  </th>
                  <th style={{ padding: '10px 6px', width: '90px', textAlign: 'left' }}>
                    Ремонт
                  </th>
                  <th style={{ padding: '10px 6px', width: '125px', textAlign: 'left' }}>
                    Дата подачи
                  </th>
                  <th style={{ padding: '10px 6px', width: '135px', textAlign: 'left' }}>
                    Путь / Станция
                  </th>
                  <th style={{ padding: '10px 6px', textAlign: 'left' }}>
                    Причина / Примечание
                  </th>
                  <th style={{ padding: '10px 6px', width: '40px' }}></th>
                </tr>
              </thead>

              <tbody id="wagonsBody">
                {visibleWagons.map((row, idx) => {
                  const kttCustomer = isKTT(row.customer);
                  return (
                    <tr key={row.id} data-depot={row.depot_code} className="hover:bg-slate-50/80">
                      <td className="font-mono tabular-nums text-xs text-slate-500">
                        <div className="flex flex-col">
                          <div className="font-semibold text-slate-700">{idx + 1}</div>
                          {selectedDepot === 'ALL' && (
                            <select
                              value={row.depot_code}
                              onChange={(e) =>
                                updateWagonField(row.id, 'depot_code', e.target.value)
                              }
                              className="mt-0.5 !p-0.5 !text-[10px] font-mono font-bold text-[#1B365D] bg-slate-100 border-slate-200 rounded"
                              title="Филиал депо"
                            >
                              {references.depots.map((d) => (
                                <option key={d.id} value={d.code}>
                                  {d.code}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      <td>
                        <select
                          className="row-section"
                          value={row.section}
                          onChange={(e) => updateWagonField(row.id, 'section', e.target.value)}
                        >
                          <option value="AT_STATION">В ожидании на станции (AT_STATION)</option>
                          <option value="EN_ROUTE">На подходе к станции (EN_ROUTE)</option>
                          <option value="RELEASE">Выпуск за смену (RELEASE)</option>
                          {references.sections.map((sec) => (
                            <option key={sec.id} value={sec.label}>
                              {sec.label}
                            </option>
                          ))}
                          {!['AT_STATION', 'EN_ROUTE', 'RELEASE'].includes(row.section) &&
                            !references.sections.some((s) => s.label === row.section) && (
                              <option value={row.section}>{row.section}</option>
                            )}
                        </select>
                      </td>

                      <td>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            list="cust-list"
                            className="row-cust"
                            value={row.customer}
                            onChange={(e) =>
                              updateWagonField(row.id, 'customer', e.target.value)
                            }
                            placeholder="Наименование заказчика..."
                          />
                          <span
                            className={`park-badge badge shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              kttCustomer
                                ? 'bg-[#EBF3FC] text-[#1D4ED8]'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                            title={
                              kttCustomer
                                ? 'Учитывается в графе КТТ Таблицы 1'
                                : 'Учитывается в графе Собственники Таблицы 1'
                            }
                          >
                            {kttCustomer ? 'КТТ' : 'Собств.'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <input
                          type="text"
                          value={row.wagon_number}
                          onChange={(e) =>
                            updateWagonField(row.id, 'wagon_number', e.target.value)
                          }
                          placeholder="8 цифр"
                          className="row-wagon font-mono tabular-nums font-semibold"
                        />
                      </td>

                      <td>
                        <select
                          className="row-wagon-type"
                          value={row.wagon_type}
                          onChange={(e) =>
                            updateWagonField(row.id, 'wagon_type', e.target.value)
                          }
                        >
                          {references.wagonTypes.map((wt) => (
                            <option key={wt.id} value={wt.name}>
                              {wt.name}
                            </option>
                          ))}
                          {!references.wagonTypes.some((wt) => wt.name === row.wagon_type) && (
                            <option value={row.wagon_type}>{row.wagon_type}</option>
                          )}
                        </select>
                      </td>

                      <td>
                        <select
                          name="repair"
                          value={row.repair_type}
                          onChange={(e) =>
                            updateWagonField(row.id, 'repair_type', e.target.value)
                          }
                          className="row-repair font-mono font-bold"
                        >
                          {activeRepairTypes.map((r) => {
                            const code = getRepairCode(r);
                            return (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            );
                          })}
                          {!activeRepairTypes.some(
                            (r) => getRepairCode(r).toUpperCase() === row.repair_type.toUpperCase()
                          ) && <option value={row.repair_type}>{row.repair_type}</option>}
                        </select>
                      </td>

                      <td>
                        <input
                          type="date"
                          value={row.submission_date}
                          onChange={(e) =>
                            updateWagonField(row.id, 'submission_date', e.target.value)
                          }
                          className="row-date font-mono tabular-nums"
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className="row-loc"
                          value={row.track_or_location}
                          onChange={(e) =>
                            updateWagonField(row.id, 'track_or_location', e.target.value)
                          }
                          placeholder="59 путь / ст."
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className="row-reason"
                          value={row.reason_details}
                          onChange={(e) =>
                            updateWagonField(row.id, 'reason_details', e.target.value)
                          }
                          placeholder="Причина простоя / примечание..."
                        />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-delete-ref"
                          onClick={() => removeWagonRow(row.id)}
                          title="Удалить вагон из смены"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <datalist id="cust-list">
            {references.customers.map((cust) => (
              <option key={cust.id} value={cust.name} />
            ))}
          </datalist>

          <div
            id="emptyWagonsNotice"
            style={{
              display: visibleWagons.length === 0 ? 'block' : 'none',
              textAlign: 'center',
              padding: '30px',
              color: '#7F8C8D',
              fontSize: '14px',
            }}
          >
            Список вагонов по заданным фильтрам пуст. Сбросьте фильтры или нажмите «➕ Добавить вагон в смену».
          </div>
        </div>
        </div>
      </div>

      {/* Вкладка 3: Колёсные пары (#sectionWheels) */}
      <div
        id="sectionWheels"
        style={{
          display:
            visibleSections.sectionWheels && activeSubTab === 'tab-kp' ? 'block' : 'none',
        }}
      >
        <div
          id="tab-kp"
          className={`tab-content ${activeSubTab === 'tab-kp' ? 'active' : ''}`}
          style={{ display: 'block' }}
        >
        <div
          className="card"
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #DCE2EB',
            padding: '20px',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 style={{ fontSize: '16px', color: '#1B365D', fontWeight: 700 }}>
                Участок колёсных пар (КП) и ремфонд на станции{' '}
                {selectedDepot === 'ALL'
                  ? '(Свод по всем филиалам АРС)'
                  : `(${selectedDepotObj?.name || selectedDepot})`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {dateMode === 'period'
                  ? `Суммарная обработка и подкатка КП за выбранный период (${periodDaysCount} сут.)`
                  : selectedDepot === 'ALL'
                  ? 'Отображается суммарная подкатка и ремфонд по 4 депо. Выберите конкретный филиал выше для редактирования норм депо.'
                  : `Оперативный ввод расхода и остатков колёсных пар по филиалу ${selectedDepot}`}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-medium">
                {dateMode === 'period' ? 'Всего подкатка за период:' : 'Всего подкатка за смену:'}{' '}
                <strong className="font-mono tabular-nums text-[#1B365D]">
                  {activeKpValues.kp_nonk +
                    activeKpValues.kp_sonk +
                    activeKpValues.kp_sr_ob +
                    activeKpValues.kp_tr_ob +
                    activeKpValues.kp_sr_bez +
                    activeKpValues.kp_tr_bez}{' '}
                  шт.
                </strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-medium">
                Всего ремфонд на станции:{' '}
                <strong className="font-mono tabular-nums text-emerald-700">
                  {activeKpValues.stock_ckk_ktt +
                    activeKpValues.stock_sonk_ktt +
                    activeKpValues.stock_ckk_ktz +
                    activeKpValues.stock_sonk_ktz +
                    activeKpValues.stock_rem_ktt}{' '}
                  шт.
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              style={{
                border: '1px solid #DCE2EB',
                borderRadius: '8px',
                padding: '18px',
                background: '#FAFBFD',
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  color: '#1B365D',
                  marginBottom: '14px',
                  fontWeight: 700,
                }}
              >
                {dateMode === 'period'
                  ? `Подкатка под вагоны за период (${periodDaysCount} дн., шт.):`
                  : 'Подкатка под вагоны за смену (шт.):'}
              </h4>
              <table style={{ width: '100%', fontSize: '13px' }} cellPadding={6}>
                <tbody>
                  <tr>
                    <td className="py-1.5 text-slate-700">НОНК (новые колёсные пары):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_nonk"
                        className="matrix-input"
                        value={activeKpValues.kp_nonk}
                        onChange={(e) => handleUpdateKpField('kp_nonk', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">СОНК (старые оси, новые колёса):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_sonk"
                        className="matrix-input"
                        value={activeKpValues.kp_sonk}
                        onChange={(e) => handleUpdateKpField('kp_sonk', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">Средний ремонт (с обточкой):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_sr_ob"
                        className="matrix-input"
                        value={activeKpValues.kp_sr_ob}
                        onChange={(e) => handleUpdateKpField('kp_sr_ob', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">Текущий ремонт (с обточкой):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_tr_ob"
                        className="matrix-input"
                        value={activeKpValues.kp_tr_ob}
                        onChange={(e) => handleUpdateKpField('kp_tr_ob', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">Средний ремонт (без обточки):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_sr_bez"
                        className="matrix-input"
                        value={activeKpValues.kp_sr_bez}
                        onChange={(e) => handleUpdateKpField('kp_sr_bez', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">Текущий ремонт (без обточки):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="kp_tr_bez"
                        className="matrix-input"
                        value={activeKpValues.kp_tr_bez}
                        onChange={(e) => handleUpdateKpField('kp_tr_bez', e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                border: '1px solid #DCE2EB',
                borderRadius: '8px',
                padding: '18px',
                background: '#FAFBFD',
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  color: '#1B365D',
                  marginBottom: '14px',
                  fontWeight: 700,
                }}
              >
                Остаток ремфонда на станции (шт.):
              </h4>
              <table style={{ width: '100%', fontSize: '13px' }} cellPadding={6}>
                <tbody>
                  <tr>
                    <td className="py-1.5 text-slate-700">ЦКК АО "КТТ":</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="stock_ckk_ktt"
                        className="matrix-input"
                        value={activeKpValues.stock_ckk_ktt}
                        onChange={(e) => handleUpdateKpField('stock_ckk_ktt', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">СОНК "КТТ":</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="stock_sonk_ktt"
                        className="matrix-input"
                        value={activeKpValues.stock_sonk_ktt}
                        onChange={(e) => handleUpdateKpField('stock_sonk_ktt', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">ЦКК (KTZ Express):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="stock_ckk_ktz"
                        className="matrix-input"
                        value={activeKpValues.stock_ckk_ktz}
                        onChange={(e) => handleUpdateKpField('stock_ckk_ktz', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">СОНК (KTZ Express):</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="stock_sonk_ktz"
                        className="matrix-input"
                        value={activeKpValues.stock_sonk_ktz}
                        onChange={(e) => handleUpdateKpField('stock_sonk_ktz', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-700">Ремфонд осей под КР:</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        id="stock_rem_ktt"
                        className="matrix-input"
                        value={activeKpValues.stock_rem_ktt}
                        onChange={(e) => handleUpdateKpField('stock_rem_ktt', e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Сводная таблица КП по 4 филиалам */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Сравнительная разбивка КП по 4 филиалам за текущую смену
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Депо</th>
                    <th className="py-2 px-2 text-right">НОНК</th>
                    <th className="py-2 px-2 text-right">СОНК</th>
                    <th className="py-2 px-2 text-right">СР обт.</th>
                    <th className="py-2 px-2 text-right">ТР обт.</th>
                    <th className="py-2 px-2 text-right">СР б/обт.</th>
                    <th className="py-2 px-2 text-right">ТР б/обт.</th>
                    <th className="py-2 px-2 text-right bg-blue-50/60 text-blue-900">ЦКК КТТ</th>
                    <th className="py-2 px-2 text-right bg-blue-50/60 text-blue-900">СОНК КТТ</th>
                    <th className="py-2 px-2 text-right bg-emerald-50/60 text-emerald-900">ЦКК KTZ</th>
                    <th className="py-2 px-2 text-right bg-emerald-50/60 text-emerald-900">СОНК KTZ</th>
                    <th className="py-2 px-2 text-right bg-amber-50/60 text-amber-900">Ремфонд КР</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {(['KVRD', 'AVRD', 'BVRD', 'UVRD'] as const)
                    .filter((code) => !isBranchRole || lockedDepotCode === code)
                    .map((code) => {
                      const row = depotKpMap[code] || DEFAULT_DEPOT_KP[code];
                      return (
                        <tr
                          key={code}
                          onClick={() => selectDepot(code)}
                          className={`cursor-pointer hover:bg-slate-50 ${
                            selectedDepot === code ? 'bg-blue-50/40 font-bold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-sans font-bold text-[#1B365D]">{code}</td>
                          <td className="py-2 px-2 text-right">{row.kp_nonk}</td>
                          <td className="py-2 px-2 text-right">{row.kp_sonk}</td>
                          <td className="py-2 px-2 text-right">{row.kp_sr_ob}</td>
                          <td className="py-2 px-2 text-right">{row.kp_tr_ob}</td>
                          <td className="py-2 px-2 text-right">{row.kp_sr_bez}</td>
                          <td className="py-2 px-2 text-right">{row.kp_tr_bez}</td>
                          <td className="py-2 px-2 text-right bg-blue-50/30">{row.stock_ckk_ktt}</td>
                          <td className="py-2 px-2 text-right bg-blue-50/30">{row.stock_sonk_ktt}</td>
                          <td className="py-2 px-2 text-right bg-emerald-50/30">{row.stock_ckk_ktz}</td>
                          <td className="py-2 px-2 text-right bg-emerald-50/30">{row.stock_sonk_ktz}</td>
                          <td className="py-2 px-2 text-right bg-amber-50/30">{row.stock_rem_ktt}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* 5-й контролируемый блок: Справка ИИ-аналитика (#sectionAiAnalyst) */}
      <div
        id="sectionAiAnalyst"
        style={{ display: visibleSections.sectionAiAnalyst ? 'block' : 'none' }}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EBF3FC] text-[#1B365D] font-bold text-sm">
              🤖
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#1B365D]">
                Справка ИИ-аналитика по выбранному срезу ({selectedDepot === 'ALL' ? 'Холдинг АРС — 4 депо' : selectedDepot})
              </h3>
              <p className="text-xs text-slate-500">
                {dateMode === 'period'
                  ? `Аналитическая выжимка за период с ${dateFrom} по ${dateTo} (${periodDaysCount} дн.)`
                  : `Оперативная сводка смены за ${reportDateValue}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskAnalyst(
                `Сформируй аналитическое заключение по филиалу ${
                  selectedDepot === 'ALL' ? 'ТОО «АРС» (4 депо)' : selectedDepot
                } ${
                  dateMode === 'period'
                    ? `за период с ${dateFrom} по ${dateTo} (${periodDaysCount} дн.)`
                    : `за дату ${reportDateValue}`
                }: в ожидании ремонта ${matrixCalculation.totals.waitTotal} ваг., выпуск ${
                  dateMode === 'period'
                    ? periodOutputSummary.totalOut
                    : matrixCalculation.totals.releaseTotal
                } ваг., неоконченный ремонт / подъемка ${
                  matrixCalculation.totals.otherTotal
                } ваг., подкатка КП ${
                  activeKpValues.kp_nonk +
                  activeKpValues.kp_sonk +
                  activeKpValues.kp_sr_ob +
                  activeKpValues.kp_tr_ob +
                  activeKpValues.kp_sr_bez +
                  activeKpValues.kp_tr_bez
                } шт.`
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B365D] text-white text-xs font-semibold hover:bg-[#152a4a] transition-colors cursor-pointer"
          >
            <span>Открыть полный разбор в ИИ-Аналитике</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Выпуск вагонов</div>
            <div className="text-base font-bold text-[#1B365D] font-mono tabular-nums">
              {dateMode === 'period'
                ? `${periodOutputSummary.totalOut} ваг. (КТТ: ${periodOutputSummary.kttOut}, Собств.: ${periodOutputSummary.ownOut})`
                : `${matrixCalculation.totals.releaseTotal} ваг. за смену`}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Ожидание и рабочий парк</div>
            <div className="text-base font-bold text-amber-700 font-mono tabular-nums">
              {matrixCalculation.totals.waitTotal} ваг. (КТТ: {matrixCalculation.totals.waitKtt} / Собств.: {matrixCalculation.totals.waitOwn})
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Неоконченный ремонт и брак</div>
            <div className="text-base font-bold text-rose-700 font-mono tabular-nums">
              {matrixCalculation.totals.otherTotal} ваг. в контроле
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Обработка колёсных пар</div>
            <div className="text-base font-bold text-emerald-700 font-mono tabular-nums">
              Подкатка:{' '}
              {activeKpValues.kp_nonk +
                activeKpValues.kp_sonk +
                activeKpValues.kp_sr_ob +
                activeKpValues.kp_tr_ob +
                activeKpValues.kp_sr_bez +
                activeKpValues.kp_tr_bez}{' '}
              шт. | Ремфонд:{' '}
              {activeKpValues.stock_ckk_ktt +
                activeKpValues.stock_sonk_ktt +
                activeKpValues.stock_ckk_ktz +
                activeKpValues.stock_sonk_ktz +
                activeKpValues.stock_rem_ktt}{' '}
              шт.
            </div>
          </div>
        </div>
      </div>

      {/* Сворачиваемый архив посуточного выпуска за октябрь 2026 г. (905 записей из базы) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {hqStatus.KVRD && hqStatus.AVRD && hqStatus.BVRD && hqStatus.UVRD ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600" />
            )}
            <span className="text-xs font-semibold text-slate-800">
              Архив посуточного выпуска по заказчикам и родам вагонов за 1–23 октября 2026 г. ({filteredDetailRows.length} записей)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowHistoricalRegistry((prev) => !prev)}
            className="btn btn-secondary"
          >
            {showHistoricalRegistry ? 'Скрыть архив октября' : 'Показать посуточный архив октября'}
          </button>
        </div>

        {showHistoricalRegistry && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Посуточная выгрузка из производственной базы АРС за октябрь 2026 г. (фильтр депо: {selectedDepot === 'ALL' ? 'Все депо' : selectedDepot})
              </p>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Заказчик, род вагона, дата..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <th className="py-2 px-3 text-left">Дата выпуска</th>
                    <th className="py-2 px-3 text-left">День</th>
                    <th className="py-2 px-3 text-left">Депо</th>
                    <th className="py-2 px-3 text-left">Заказчик / Категория</th>
                    <th className="py-2 px-3 text-left">Вид работ</th>
                    <th className="py-2 px-3 text-left">Род вагона</th>
                    <th className="py-2 px-3 text-right">Выпуск (ед.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredDetailRows.slice(0, 200).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-1.5 px-3 font-mono tabular-nums">{r.report_date}</td>
                      <td className="py-1.5 px-3 font-mono tabular-nums">{r.day_of_month} окт</td>
                      <td className="py-1.5 px-3 font-mono font-semibold">{r.depot_code}</td>
                      <td className="py-1.5 px-3">{r.customer_name}</td>
                      <td className="py-1.5 px-3 font-mono">{r.repair_type}</td>
                      <td className="py-1.5 px-3">{r.wagon_type}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-bold">
                        {r.wagons_output}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
