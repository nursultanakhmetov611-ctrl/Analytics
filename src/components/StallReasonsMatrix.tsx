import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Filter } from 'lucide-react';
import { ArsAuthSession, ArsDataset } from '../types/ars';

interface StallReasonsMatrixProps {
  data: ArsDataset;
  currentUser?: ArsAuthSession | null;
  onAskAnalyst: (prompt: string) => void;
  onInspectWagon: (wagonNumber: string) => void;
}

type MatrixMode = 'october_summary' | 'annual_dislocation';

export interface DepotStallRow {
  depotCode: string;
  depotName: string;
  city: string;
  capacity: number;
  totalUnfinishedOct20: number;
  drCount: number;
  krCount: number;
  torCount: number;
  byReason: {
    kp: number;
    coupler: number;
    mechanisms: number;
    waitingSubmission: number;
    scheduledTransition: number;
  };
  waitingOnTracksOct: number;
  atStationOct: number;
  note: string;
  sampleWagons: Array<{ num: string; reason: string; repair: string; customer: string }>;
}

const HQ_SUBTITLE_TEXT =
  'Распределение по 4 филиалам (АВРД, КВРД, УВРД, БВРД) и причинам: колёсные пары (КП), автосцепка, разгрузочные механизмы / ХДВ, ожидание подачи';
const HQ_TABLE_TITLE_TEXT =
  'Сводная таблица по всем депо: распределение вагонов в простое и ожидании по причинам';
const HQ_STRUCT_TITLE_TEXT =
  'Структура подтвержденных причин простоя в ремонте (пономерной учет КВРД — 24 ваг. UNFINISHED + 81 ваг. ожидание подачи)';

// ========================================================
// ПОЛНАЯ ИЗОЛЯЦИЯ РАЗДЕЛА «ИИ-АНАЛИТИК» ПО РОЛИ ПОЛЬЗОВАТЕЛЯ
// ========================================================
export function isolateAiAnalystForBranch(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let user: ArsAuthSession | null =
    typeof window.currentUser !== 'undefined' && window.currentUser
      ? window.currentUser
      : null;

  if (!user) {
    try {
      const raw =
        localStorage.getItem('ars_current_user') ||
        localStorage.getItem('ars_auth_session_2026_v1');
      if (raw) {
        user = JSON.parse(raw);
      }
    } catch (_e) {
      // ignore parse errors
    }
  }

  const isBranch = Boolean(user && user.role === 'branch');
  const myDepot = isBranch ? (user?.depot_code || 'KVRD').toUpperCase() : 'ALL';

  const DEPOT_KEYS: Record<string, string[]> = {
    KVRD: ['КВРД', 'Кушмурун'],
    AVRD: ['АВРД', 'Арыс'],
    BVRD: ['БВРД', 'Балхаш'],
    UVRD: ['УВРД', 'Уральск'],
  };

  const rootScope =
    document.getElementById('stallReasonsMatrixRoot') ||
    document.getElementById('analystWorkspaceRoot') ||
    document;

  // 1. ФИЛЬТРАЦИЯ КАРТОЧЕК В ЛЕВОЙ КОЛОНКЕ («Визуализация загрузки»)
  rootScope.querySelectorAll('div').forEach((el) => {
    const htmlEl = el as HTMLElement;
    const explicitCode = htmlEl.getAttribute('data-depot-card');
    if (explicitCode) {
      if (isBranch) {
        if (explicitCode.toUpperCase() === myDepot) {
          htmlEl.style.setProperty('display', 'block', 'important');
        } else {
          htmlEl.style.setProperty('display', 'none', 'important');
        }
      } else {
        htmlEl.style.removeProperty('display');
      }
      return;
    }

    // Не трогаем родительские контейнеры, содержащие карточки депо
    if (htmlEl.querySelector('[data-depot-card], .depot-load-card')) {
      return;
    }

    const txt = (htmlEl.innerText || '').trim();
    if (htmlEl.children.length >= 2 && htmlEl.offsetHeight > 50 && htmlEl.offsetWidth > 220) {
      for (const [code, names] of Object.entries(DEPOT_KEYS)) {
        if (
          names.some(
            (n) =>
              txt.startsWith(n) ||
              txt.startsWith(`${code} (`) ||
              txt.startsWith(`${n} (`)
          )
        ) {
          if (isBranch) {
            if (code === myDepot) {
              htmlEl.style.setProperty('display', 'block', 'important');
            } else {
              htmlEl.style.setProperty('display', 'none', 'important');
            }
          } else {
            htmlEl.style.removeProperty('display');
          }
          break;
        }
      }
    }
  });

  // 2. ФИЛЬТРАЦИЯ СТРОК НИЖНЕЙ ТАБЛИЦЫ («Сводная таблица по всем депо»)
  const analystRoot = document.getElementById('analystWorkspaceRoot') || rootScope;
  analystRoot.querySelectorAll('tr').forEach((tr) => {
    const htmlTr = tr as HTMLElement;
    const rowText = htmlTr.innerText || '';
    const explicitRowCode = htmlTr.getAttribute('data-depot-row');

    if (explicitRowCode) {
      if (isBranch) {
        if (explicitRowCode.toUpperCase() === myDepot) {
          htmlTr.style.setProperty('display', '', 'important');
        } else {
          htmlTr.style.setProperty('display', 'none', 'important');
        }
      } else {
        htmlTr.style.removeProperty('display');
      }
      return;
    }

    // Скрываем строки чужих филиалов
    for (const [code, names] of Object.entries(DEPOT_KEYS)) {
      if (names.some((n) => rowText.includes(n))) {
        if (isBranch) {
          if (code === myDepot) {
            htmlTr.style.setProperty('display', '', 'important');
          } else {
            htmlTr.style.setProperty('display', 'none', 'important');
          }
        } else {
          htmlTr.style.removeProperty('display');
        }
        break;
      }
    }

    // Скрываем строку «ИТОГО ПО ХОЛДИНГУ АРС» для филиала
    if (
      rowText.includes('ИТОГО ПО ХОЛДИНГУ') ||
      rowText.includes('ИТОГО ПО ВСЕМ') ||
      rowText.includes('ИТОГО АРС') ||
      rowText.includes('ИТОГО ХОЛДИНГ')
    ) {
      if (isBranch) {
        htmlTr.style.setProperty('display', 'none', 'important');
      } else {
        htmlTr.style.removeProperty('display');
      }
    }
  });

  // 3. СКРЫТИЕ КНОПКИ «СВОД ПО 4 ДЕПО»
  document.querySelectorAll('button, a').forEach((btn) => {
    const htmlBtn = btn as HTMLElement;
    const bText = htmlBtn.innerText || '';
    if (bText.includes('Свод по 4 депо') || bText.includes('Свод по всем депо')) {
      if (isBranch) {
        htmlBtn.style.setProperty('display', 'none', 'important');
      } else {
        htmlBtn.style.removeProperty('display');
      }
    }
  });

  // 4. АДАПТАЦИЯ ТЕКСТОВ И ЗАГОЛОВКОВ ПОД ТЕКУЩИЙ ФИЛИАЛ
  if (isBranch) {
    document.querySelectorAll('h3, h4, p, span').forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.children.length > 0 && !htmlEl.hasAttribute('data-analyst-heading')) {
        return;
      }
      const text = htmlEl.innerText || '';
      // Подзаголовок вверху
      if (
        text.includes('Распределение по 4 филиалам') ||
        htmlEl.getAttribute('data-analyst-heading') === 'subtitle'
      ) {
        htmlEl.innerText = `Анализ причин задержек и неоконченного ремонта филиала ${myDepot}`;
      }
      // Заголовок нижней таблицы
      if (
        text.includes('Сводная таблица по всем депо') ||
        htmlEl.getAttribute('data-analyst-heading') === 'table-title'
      ) {
        htmlEl.innerText = `Аналитическая таблица филиала ${myDepot}: распределение вагонов в простое и ожидании по причинам`;
      }
    });

    // Заголовок правого блока причин
    const structTitle = document.querySelector('.structure-title, h4') as HTMLElement | null;
    if (
      structTitle &&
      (structTitle.innerText.includes('Структура подтвержденных причин') ||
        structTitle.classList.contains('structure-title'))
    ) {
      structTitle.innerText = `Структура подтвержденных причин простоя в ремонте (${myDepot})`;
    }
  } else {
    const subEl = document.querySelector('[data-analyst-heading="subtitle"]') as HTMLElement | null;
    if (subEl) subEl.innerText = HQ_SUBTITLE_TEXT;
    const tblEl = document.querySelector('[data-analyst-heading="table-title"]') as HTMLElement | null;
    if (tblEl) tblEl.innerText = HQ_TABLE_TITLE_TEXT;
    const structTitle = document.querySelector('.structure-title') as HTMLElement | null;
    if (structTitle) structTitle.innerText = HQ_STRUCT_TITLE_TEXT;
  }
}

// Регистрация глобальных обработчиков клика по вкладке «ИИ-Аналитик» и загрузки
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.isolateAiAnalystForBranch = isolateAiAnalystForBranch;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const tab = target?.closest('button, a, .nav-item, [data-tab]') as HTMLElement | null;
    if (tab && ((tab.innerText || '').includes('Аналитик') || (tab.innerText || '').includes('ИИ-Аналитик'))) {
      setTimeout(isolateAiAnalystForBranch, 50);
      setTimeout(isolateAiAnalystForBranch, 200);
    }
  });

  if (typeof window.checkAuthAndInit === 'function') {
    const origAuth = window.checkAuthAndInit;
    window.checkAuthAndInit = async function () {
      await origAuth();
      isolateAiAnalystForBranch();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(isolateAiAnalystForBranch, 150);
  });
}

// Structured breakdown combining exact 20.10.2026 summary_reports (all 4 depots) + KVRD itemized dislocation records
export const DEPOT_STALL_MATRIX_DATA: DepotStallRow[] = [
  {
    depotCode: 'AVRD',
    depotName: 'Арысское ВРД',
    city: 'Арыс',
    capacity: 8,
    totalUnfinishedOct20: 14,
    drCount: 4,
    krCount: 10,
    torCount: 0,
    byReason: {
      kp: 5,
      coupler: 2,
      mechanisms: 4,
      waitingSubmission: 3,
      scheduledTransition: 0,
    },
    waitingOnTracksOct: 0,
    atStationOct: 0,
    note: '4 ваг. КТТ (КР), 9 ваг. собственников (3 ДР, 6 КР), 1 ваг. ЦЖС (ДР). Пономерная расшифровка ведется в локальном учете АВРД.',
    sampleWagons: [],
  },
  {
    depotCode: 'KVRD',
    depotName: 'Кушмурунское ВРД',
    city: 'Кушмурун',
    capacity: 7,
    totalUnfinishedOct20: 2,
    drCount: 0,
    krCount: 2,
    torCount: 0,
    byReason: {
      kp: 4,
      coupler: 1,
      mechanisms: 3,
      waitingSubmission: 2,
      scheduledTransition: 14,
    },
    waitingOnTracksOct: 13,
    atStationOct: 4,
    note: 'По своду на 20.10 — 2 ваг. КР-ЦЖС; по пономерной базе 2026 г. — 24 записи неоконченного ремонта + 56 в ожидании на путях ВРД (51, 52, 58, 59 пути) + 25 на станции.',
    sampleWagons: [
      { num: '94511425', reason: 'По КП (ожидание КП)', repair: 'ДР', customer: 'KTZ Express' },
      { num: '94303880', reason: 'По КП (ожидание КП)', repair: 'ДР', customer: 'KTZ Express' },
      { num: '94338605', reason: 'По КП (ожидание КП)', repair: 'ДР', customer: 'KTZ Express' },
      { num: '64780950', reason: 'Брак КП', repair: 'ТОР', customer: 'ПГК Центральная Азия' },
      { num: '52509312', reason: 'Брак автосцепки', repair: 'КР', customer: 'Феникс Рейл' },
      { num: '58421', reason: 'ХДВ / разгрузочные механизмы (на 54 пути)', repair: 'КР', customer: 'ЦЖС (ХДВ)' },
      { num: '58273', reason: 'ХДВ / разгрузочные механизмы (на 54 пути)', repair: 'КР', customer: 'ЦЖС (ХДВ)' },
      { num: '42526723(68892)', reason: 'Спецплатформа (на 54 пути)', repair: 'ДР', customer: 'ЦЖС (платформа)' },
      { num: '98333826', reason: 'Не подали со станции', repair: 'ДР', customer: 'АО "KTZ Express"' },
      { num: '61895488', reason: 'Не подан в цех', repair: 'КР', customer: 'АО "Казтемиртранс"' },
      { num: '60716800', reason: 'Незапланированная подача (выход 22.10)', repair: 'ДР', customer: 'АО "Казтемиртранс"' },
    ],
  },
  {
    depotCode: 'UVRD',
    depotName: 'Уральское ВРД',
    city: 'Уральск',
    capacity: 7,
    totalUnfinishedOct20: 3,
    drCount: 2,
    krCount: 0,
    torCount: 1,
    byReason: {
      kp: 1,
      coupler: 0,
      mechanisms: 1,
      waitingSubmission: 1,
      scheduledTransition: 0,
    },
    waitingOnTracksOct: 0,
    atStationOct: 0,
    note: 'По своду на 20.10: 1 ваг. ДР КТТ, 1 ваг. ДР собственников, 1 ваг. СОБ.-ТОР.',
    sampleWagons: [],
  },
  {
    depotCode: 'BVRD',
    depotName: 'Балхашское ВРД',
    city: 'Балхаш',
    capacity: 6,
    totalUnfinishedOct20: 2,
    drCount: 1,
    krCount: 1,
    torCount: 0,
    byReason: {
      kp: 1,
      coupler: 0,
      mechanisms: 0,
      waitingSubmission: 1,
      scheduledTransition: 0,
    },
    waitingOnTracksOct: 0,
    atStationOct: 0,
    note: 'По своду на 20.10: 1 ваг. ДР КТТ и 1 ваг. КР КТТ (подача в цех за сутки — 6 ваг.).',
    sampleWagons: [],
  },
];

const DEPOT_LOAD_CARDS = [
  {
    code: 'AVRD',
    name: 'АВРД (г. Арыс)',
    unfinished: 14,
    dr: 4,
    kr: 10,
    tor: 0,
    waitingTracks: 0,
    station: 0,
    totalIdle: 14,
    maxScale: 24,
    breakdownText: '14 ваг. в неоконч. ремонте: 4 ДР (3 частн., 1 ЦЖС) и 10 КР (4 КТТ, 6 частн.)',
  },
  {
    code: 'KVRD',
    name: 'КВРД (п. Кушмурун)',
    unfinished: 2,
    dr: 0,
    kr: 2,
    tor: 0,
    waitingTracks: 13,
    station: 4,
    totalIdle: 19,
    maxScale: 24,
    breakdownText:
      '2 ваг. КР-ЦЖС в своде (7 на вых. 22.10) + 13 ваг. в ожидании на путях 51, 52, 58, 59 + 4 на станции',
  },
  {
    code: 'UVRD',
    name: 'УВРД (г. Уральск)',
    unfinished: 3,
    dr: 2,
    kr: 0,
    tor: 1,
    waitingTracks: 0,
    station: 0,
    totalIdle: 3,
    maxScale: 24,
    breakdownText: '3 ваг. в неоконч. ремонте: 1 ДР КТТ, 1 ДР собственников, 1 ТОР собственников',
  },
  {
    code: 'BVRD',
    name: 'БВРД (г. Балхаш)',
    unfinished: 2,
    dr: 1,
    kr: 1,
    tor: 0,
    waitingTracks: 6,
    station: 0,
    totalIdle: 8,
    maxScale: 24,
    breakdownText: '2 ваг. в неоконч. ремонте (1 ДР КТТ, 1 КР КТТ) + 6 ваг. суточная подача в ремонт',
  },
];

export const StallReasonsMatrix: React.FC<StallReasonsMatrixProps> = ({
  data,
  currentUser,
  onAskAnalyst,
  onInspectWagon,
}) => {
  const [mode, setMode] = useState<MatrixMode>('october_summary');
  const [selectedReasonCategory, setSelectedReasonCategory] = useState<string>('ALL');

  const isBranch = currentUser?.role === 'branch';
  const myDepot = isBranch ? (currentUser?.depot_code || 'KVRD').toUpperCase() : 'ALL';

  useEffect(() => {
    window.isolateAiAnalystForBranch = isolateAiAnalystForBranch;
    isolateAiAnalystForBranch();
    const timer = setTimeout(isolateAiAnalystForBranch, 50);
    return () => clearTimeout(timer);
  }, [currentUser, mode]);

  const activeBranchCard = DEPOT_LOAD_CARDS.find((c) => c.code === myDepot) || DEPOT_LOAD_CARDS[1];

  // Exact itemized classification from KVRD wagon_dislocations_and_stalls (203 records)
  const itemizedReasons = [
    {
      id: 'KP',
      title: 'Ожидание и брак колёсных пар (КП)',
      countUnfinished: 4,
      sharePct: 16.7,
      colorClass: 'bg-red-600',
      textClass: 'text-red-700',
      description: 'Отсутствие годных КП под подкатку или выявленный брак КП при ТОР/ДР',
      wagons: [
        { num: '94511425', date: '2026-02-28', customer: 'KTZ Express', repair: 'ДР', loc: 'Цех КВРД', detail: 'По КП' },
        { num: '94303880', date: '2026-02-28', customer: 'KTZ Express', repair: 'ДР', loc: 'Цех КВРД', detail: 'По КП' },
        { num: '94338605', date: '2026-02-28', customer: 'KTZ Express', repair: 'ДР', loc: 'Цех КВРД', detail: 'По КП' },
        { num: '64780950', date: '2026-05-01', customer: 'ПГК Центральная Азия', repair: 'ТОР', loc: 'Цех КВРД', detail: 'Брак КП' },
      ],
    },
    {
      id: 'COUPLER',
      title: 'Брак автосцепного оборудования',
      countUnfinished: 1,
      sharePct: 4.2,
      colorClass: 'bg-amber-600',
      textClass: 'text-amber-700',
      description: 'Выявленный при дефектоскопии брак корпуса автосцепки / тягового хомута',
      wagons: [
        { num: '52509312', date: '2026-02-28', customer: 'Феникс Рейл', repair: 'КР', loc: 'Цех КВРД', detail: 'брак автоцепки' },
      ],
    },
    {
      id: 'MECHANISMS',
      title: 'Разгрузочные механизмы и спецкузова (ХДВ / Платформы ЦЖС)',
      countUnfinished: 3,
      sharePct: 12.5,
      colorClass: 'bg-purple-600',
      textClass: 'text-purple-700',
      description: 'Капитальный и деповской ремонт хоппер-дозаторов (ХДВ) и платформ ПМС/ЦЖС на 54 пути',
      wagons: [
        { num: '58421', date: '2026-09-08', customer: 'ЦЖС (ХДВ)', repair: 'КР', loc: 'на 54 пути', detail: 'дог. №1227153_2026/3 (на 54 пути)' },
        { num: '58273', date: '2026-09-08', customer: 'ЦЖС (ХДВ)', repair: 'КР', loc: 'на 54 пути', detail: 'дог. №1227153_2026/3 (на 54 пути)' },
        { num: '42526723(68892)', date: '2026-09-08', customer: 'ЦЖС (платформа)', repair: 'ДР', loc: 'на 54 пути', detail: 'дог. №1227225_2026/4 (на 54 пути)' },
      ],
    },
    {
      id: 'WAITING_SUBMISSION',
      title: 'Ожидание подачи в цех / со станции и отстой на путях',
      countUnfinished: 2,
      sharePct: 8.3,
      colorClass: 'bg-blue-600',
      textClass: 'text-blue-700',
      description: 'Неподача вагона маневровым локомотивом со станции или задержка подачи на ремонтную позицию (+ 56 ваг. в ожидании на путях 51, 52, 58, 59)',
      wagons: [
        { num: '61895488', date: '2026-09-30', customer: 'АО "Казтемиртранс"', repair: 'КР', loc: 'Пути КВРД', detail: 'не подан в цех.' },
        { num: '98333826', date: '2026-10-22', customer: 'АО "KTZ Express"', repair: 'ДР', loc: 'Станция Кушмурун', detail: 'не подали со станции' },
      ],
    },
    {
      id: 'TRANSITION',
      title: 'Переходящий технологический выход (в т.ч. незапланированная подача)',
      countUnfinished: 14,
      sharePct: 58.3,
      colorClass: 'bg-slate-600',
      textClass: 'text-slate-700',
      description: 'Вагоны на завершающей стадии ремонта с фиксированным временем выхода (10:30 следующего дня)',
      wagons: [
        { num: '60716800', date: '2026-10-22', customer: 'АО "Казтемиртранс"', repair: 'ДР', loc: 'Цех КВРД', detail: 'не запланированая подача — выход 22.10.26 в 10.30ч' },
        { num: '28841658', date: '2026-10-22', customer: 'ТОО "ALTO LOGISTICS"', repair: 'КР', loc: 'Цех КВРД', detail: 'выход- 22.10.26г время 10.30ч' },
        { num: '60750262', date: '2026-10-22', customer: 'АО "Казтемиртранс"', repair: 'ДР', loc: 'Цех КВРД', detail: 'выход- 22.10.26г время 10.30ч' },
        { num: '52883535', date: '2026-10-22', customer: 'АО "Казтемиртранс"', repair: 'ДР', loc: 'Цех КВРД', detail: 'выход- 22.10.26г время 10.30ч' },
        { num: '60950888', date: '2026-10-22', customer: 'АО "Казтемиртранс"', repair: 'ДР', loc: 'Цех КВРД', detail: 'выход- 22.10.26г время 10.30ч' },
        { num: '29026077', date: '2026-10-22', customer: 'ТОО "РТА- Транс"', repair: 'ТОР', loc: 'Цех КВРД', detail: 'выход- 22.10.26г время 10.30ч' },
      ],
    },
  ];

  // October 2026 (22.10) Waiting on Depot Tracks & At Station breakdown
  const octWaitingWagons = data.wagon_dislocations_and_stalls.filter(
    (w) =>
      w.report_date === '2026-10-22' &&
      (w.status === 'WAITING_DEPOT' || w.status === 'AT_STATION' || w.status === 'UNFINISHED')
  );

  return (
    <div id="stallReasonsMatrixRoot" className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Сводная матрица простоев и неоконченного ремонта по депо и причинам задержек
          </h2>
          <p
            data-analyst-heading="subtitle"
            className="text-xs text-slate-500 mt-0.5"
          >
            {isBranch
              ? `Анализ причин задержек и неоконченного ремонта филиала ${myDepot}`
              : HQ_SUBTITLE_TEXT}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('october_summary')}
              style={{ display: isBranch ? 'none' : undefined }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'october_summary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Свод по 4 депо (Октябрь 2026)
            </button>
            <button
              type="button"
              onClick={() => setMode('annual_dislocation')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'annual_dislocation' || isBranch
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBranch
                ? `Пономерная база причин (${myDepot})`
                : 'Пономерная база причин (КВРД · 203 зап.)'}
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskAnalyst(
                isBranch
                  ? `Проанализируй причины простоев и неоконченного ремонта по филиалу ${myDepot} (КП, автосцепка, механизмы, ожидание подачи).`
                  : 'Визуализируй сводную таблицу по всем депо: количество вагонов в простое, распределенное по причинам (КП, автосцепка, неисправность механизмов, ожидание подачи).'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Открыть отчёт в ИИ-аналитике</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Proportional Distribution Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>
              {isBranch
                ? `Визуализация загрузки неоконченным ремонтом и ожиданием подачи (${myDepot})`
                : 'Визуализация загрузки неоконченным ремонтом и ожиданием подачи по депо'}
            </span>
            <span className="font-mono tabular-nums text-slate-900 font-semibold">
              {isBranch
                ? `Неоконч. ремонт (20.10): ${activeBranchCard.unfinished} ваг. · Ожидание на путях (22.10): ${
                    activeBranchCard.waitingTracks + activeBranchCard.station
                  } ваг.`
                : 'Неоконч. ремонт (20.10): 21 ваг. · Ожидание на путях (22.10): 17 ваг.'}
            </span>
          </div>

          <div className="space-y-3.5">
            {DEPOT_LOAD_CARDS.map((row) => (
              <div
                key={row.code}
                data-depot-card={row.code}
                style={{ display: isBranch && row.code !== myDepot ? 'none' : 'block' }}
                className="depot-load-card p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{row.name}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">{row.breakdownText}</span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                    Неоконч.: {row.unfinished} ваг.
                  </span>
                </div>

                {/* Stacked Bar */}
                <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden flex">
                  {row.kr > 0 && (
                    <div
                      className="bg-red-600 h-full"
                      style={{ width: `${(row.kr / row.maxScale) * 100}%` }}
                      title={`Неоконченный КР: ${row.kr} ваг.`}
                    />
                  )}
                  {row.dr > 0 && (
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${(row.dr / row.maxScale) * 100}%` }}
                      title={`Неоконченный ДР: ${row.dr} ваг.`}
                    />
                  )}
                  {row.tor > 0 && (
                    <div
                      className="bg-purple-600 h-full"
                      style={{ width: `${(row.tor / row.maxScale) * 100}%` }}
                      title={`Неоконченный ТОР: ${row.tor} ваг.`}
                    />
                  )}
                  {row.waitingTracks > 0 && (
                    <div
                      className="bg-blue-600 h-full"
                      style={{ width: `${(row.waitingTracks / row.maxScale) * 100}%` }}
                      title={`Ожидание подачи на путях ВРД: ${row.waitingTracks} ваг.`}
                    />
                  )}
                  {row.station > 0 && (
                    <div
                      className="bg-slate-500 h-full"
                      style={{ width: `${(row.station / row.maxScale) * 100}%` }}
                      title={`На станции в ожидании подачи: ${row.station} ваг.`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono tabular-nums">
                  <span>КР (неоконч.): <strong>{row.kr}</strong></span>
                  <span>ДР (неоконч.): <strong>{row.dr}</strong></span>
                  <span>ТОР (неоконч.): <strong>{row.tor}</strong></span>
                  <span>Ожидание подачи (пути ВРД): <strong>{row.waitingTracks}</strong></span>
                  <span>На станции: <strong>{row.station}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Columns: Itemized Reason Breakdown */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 structure-title">
              {isBranch
                ? `Структура подтвержденных причин простоя в ремонте (${myDepot})`
                : HQ_STRUCT_TITLE_TEXT}
            </h3>
          </div>

          <div className="space-y-2.5">
            {itemizedReasons.map((ir) => (
              <button
                key={ir.id}
                type="button"
                onClick={() =>
                  setSelectedReasonCategory(selectedReasonCategory === ir.id ? 'ALL' : ir.id)
                }
                className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  selectedReasonCategory === ir.id
                    ? 'bg-white border-blue-600 shadow-xs'
                    : 'bg-white/80 hover:bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">{ir.title}</span>
                  <span className={`font-mono tabular-nums font-bold ${ir.textClass}`}>
                    {ir.countUnfinished} ваг. ({ir.sharePct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-1.5">
                  <div
                    className={`h-full rounded-full ${ir.colorClass}`}
                    style={{ width: `${ir.sharePct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{ir.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Summary Pivot Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3
            data-analyst-heading="table-title"
            className="text-sm font-bold text-slate-900"
          >
            {isBranch
              ? `Аналитическая таблица филиала ${myDepot}: распределение вагонов в простое и ожидании по причинам`
              : HQ_TABLE_TITLE_TEXT}
          </h3>
          <span className="text-xs text-slate-500">
            Данные `summary_reports` (на 20.10.2026) + `wagon_dislocations_and_stalls` (февраль–октябрь 2026)
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-3 px-4 text-left whitespace-nowrap">Филиал (Депо)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Неоконч. ремонт (20.10)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">По КП (ожидание / брак КП)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Брак автосцепки</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Механизмы / ХДВ / КР кузова</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Ожидание подачи (в цех / пути / ст.)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Плановый переходящий выход</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Пономерная расшифровка и структура по депо</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              <tr
                data-depot-row="KVRD"
                style={{ display: isBranch && myDepot !== 'KVRD' ? 'none' : '' }}
                className="hover:bg-slate-50 text-slate-800"
              >
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  КВРД (Кушмурун)
                  <div className="text-[11px] font-normal text-slate-500">Пономерная база (203 зап.)</div>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  2 <span className="text-slate-500 font-normal">(7 на 22.10 / 24 год)</span>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-red-700">
                  4 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-amber-700">
                  1 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-purple-700">
                  3 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-blue-700">
                  2 ваг. <span className="text-slate-500 font-normal">(+17 на 22.10 / +81 год)</span>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-700">
                  14 ваг. <span className="text-slate-500 font-normal">(6 на 22.10)</span>
                </td>
                <td className="py-3 px-4 text-slate-600">
                  КП: <span className="font-mono">94511425, 94303880, 94338605, 64780950</span> · Автосцепка: <span className="font-mono">52509312</span> · ХДВ/54 путь: <span className="font-mono">58421, 58273, 42526723</span> · Не поданы: <span className="font-mono">98333826, 61895488</span>
                </td>
              </tr>

              <tr
                data-depot-row="AVRD"
                style={{ display: isBranch && myDepot !== 'AVRD' ? 'none' : '' }}
                className="hover:bg-slate-50 text-slate-800"
              >
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  АВРД (Арыс)
                  <div className="text-[11px] font-normal text-slate-500">Сводный отчет на 20.10.2026</div>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-red-700">
                  14 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д (в сост. 10 КР / 4 ДР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д (в сост. 10 КР / 4 ДР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-purple-700">
                  10 ваг. (КР) + 4 ваг. (ДР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                  0 (подача 0)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  —
                </td>
                <td className="py-3 px-4 text-slate-600">
                  Всего <strong>14 ваг.</strong> в неоконченном ремонте: <strong>4 ваг. КТТ (КР)</strong>, <strong>6 ваг. собственников (КР)</strong>, <strong>3 ваг. собственников (ДР)</strong>, <strong>1 ваг. ЦЖС (ДР)</strong>
                </td>
              </tr>

              <tr
                data-depot-row="UVRD"
                style={{ display: isBranch && myDepot !== 'UVRD' ? 'none' : '' }}
                className="hover:bg-slate-50 text-slate-800"
              >
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  УВРД (Уральск)
                  <div className="text-[11px] font-normal text-slate-500">Сводный отчет на 20.10.2026</div>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  3 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д (в сост. 2 ДР / 1 ТОР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-purple-700">
                  2 ваг. (ДР) + 1 ваг. (ТОР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                  0 (подача 0)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  —
                </td>
                <td className="py-3 px-4 text-slate-600">
                  Всего <strong>3 ваг.</strong> в неоконченном ремонте: <strong>1 ваг. ДР КТТ</strong>, <strong>1 ваг. ДР собственников</strong>, <strong>1 ваг. СОБ.-ТОР</strong>
                </td>
              </tr>

              <tr
                data-depot-row="BVRD"
                style={{ display: isBranch && myDepot !== 'BVRD' ? 'none' : '' }}
                className="hover:bg-slate-50 text-slate-800"
              >
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  БВРД (Балхаш)
                  <div className="text-[11px] font-normal text-slate-500">Сводный отчет на 20.10.2026</div>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  2 ваг.
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д (в сост. 1 ДР / 1 КР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  н/д
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-purple-700">
                  1 ваг. (ДР) + 1 ваг. (КР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                  6 ваг. (суточная подача)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                  —
                </td>
                <td className="py-3 px-4 text-slate-600">
                  Всего <strong>2 ваг.</strong> в неоконченном ремонте: <strong>1 ваг. ДР КТТ</strong>, <strong>1 ваг. КР КТТ</strong>; подано в ремонт за сутки — <strong>6 ваг.</strong> (3 ДР КТТ, 2 КР КТТ, 1 ДР собств.)
                </td>
              </tr>

              <tr
                data-holding-total-row="true"
                style={{ display: isBranch ? 'none' : '' }}
                className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-300"
              >
                <td className="py-3 px-4">ИТОГО ПО ХОЛДИНГУ АРС</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  21 ваг. (свод 20.10)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-red-700">
                  4 ваг. (КВРД)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                  1 ваг. (КВРД)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-purple-700">
                  3 ваг. ХДВ/ЦЖС (+19 ДР/КР/ТОР)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-700">
                  2 не поданы (+17 пути/ст. 22.10)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  14 выходов (6 на 22.10)
                </td>
                <td className="py-3 px-4 font-normal text-slate-700">
                  Плановый ремонт: <strong>20 ваг.</strong> (7 ДР, 13 КР) · Внеплановый ТОР: <strong>1 ваг.</strong> · Подача по холдингу за сутки: <strong>13 ваг.</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtered Itemized Wagons Table when a reason category is selected or in annual mode */}
      {(selectedReasonCategory !== 'ALL' || mode === 'annual_dislocation') && (
        <div className="pt-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-900">
                Пономерная расшифровка вагонов по выбранной причине (кликабельные номера вагонов)
              </h4>
            </div>
            {selectedReasonCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedReasonCategory('ALL')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Показать все категории причин
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4 text-left">Категория причины</th>
                  <th className="py-2.5 px-3 text-left">№ Вагона</th>
                  <th className="py-2.5 px-3 text-left">Дата отчета</th>
                  <th className="py-2.5 px-4 text-left">Заказчик</th>
                  <th className="py-2.5 px-3 text-left">Вид ремонта</th>
                  <th className="py-2.5 px-3 text-left">Локация / Путь</th>
                  <th className="py-2.5 px-4 text-left">Точная причина в базе</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {itemizedReasons
                  .filter((r) => selectedReasonCategory === 'ALL' || r.id === selectedReasonCategory)
                  .flatMap((cat) =>
                    cat.wagons.map((w, idx) => (
                      <tr key={`${cat.id}-${w.num}-${idx}`} className="hover:bg-slate-50">
                        <td className={`py-2 px-4 font-semibold ${cat.textClass}`}>{cat.title}</td>
                        <td className="py-2 px-3 font-mono tabular-nums font-bold">
                          <button
                            type="button"
                            onClick={() => onInspectWagon(w.num)}
                            className="text-blue-700 hover:underline cursor-pointer"
                          >
                            {w.num}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-600">{w.date}</td>
                        <td className="py-2 px-4 font-medium text-slate-900">{w.customer}</td>
                        <td className="py-2 px-3 font-mono font-semibold">{w.repair}</td>
                        <td className="py-2 px-3 font-mono text-slate-800">{w.loc}</td>
                        <td className="py-2 px-4 font-medium text-slate-900">{w.detail}</td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* October 22, 2026 Active Track Waiting List (51, 52, 58, 59 tracks) */}
      {octWaitingWagons.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-bold text-slate-900 mb-2">
            Оперативный срез вагонов в ожидании подачи на путях ВРД (51, 52, 58, 59 пути) и на станции на 22.10.2026 г. ({octWaitingWagons.length} ваг.)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {octWaitingWagons.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onInspectWagon(w.wagon_number)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title={`${w.customer_name} · ${w.repair_type} · ${w.status_ru} · ${w.track_or_location || w.reason_details}`}
              >
                <span className="font-mono tabular-nums font-bold text-slate-900">{w.wagon_number}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{w.repair_type}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-[11px] text-blue-700">
                  {w.track_or_location || (w.reason_details.includes('не подали') ? 'не подали со ст.' : 'выход 22.10')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
