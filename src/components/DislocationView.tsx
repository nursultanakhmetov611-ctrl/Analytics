import React, { useState, useMemo } from 'react';
import { Search, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { ArsDataset, WagonDislocationRow } from '../types/ars';
import { StallReasonsMatrix } from './StallReasonsMatrix';

interface DislocationViewProps {
  data: ArsDataset;
  onAskAnalyst: (prompt: string) => void;
  onInspectWagon: (wagonNumber: string) => void;
}

const STATUS_FILTERS = [
  { id: 'ALL', label: 'Все статусы' },
  { id: 'UNFINISHED', label: 'Неоконченный ремонт' },
  { id: 'WAITING_DEPOT', label: 'В ожидании на путях ВРД' },
  { id: 'LIFTING', label: 'Подъемка' },
  { id: 'AT_STATION', label: 'На станции' },
  { id: 'EN_ROUTE', label: 'На подходе к станции' },
  { id: 'RELEASE', label: 'Выпуск' },
];

const SHEET_FILTERS = [
  'Все периоды',
  'Октябрь',
  'Сентябрь',
  'август',
  'Июнь',
  'Май',
  'Апрель',
  'Март',
  'Февраль',
];

export const DislocationView: React.FC<DislocationViewProps> = ({
  data,
  onAskAnalyst,
  onInspectWagon,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sheetFilter, setSheetFilter] = useState('Все периоды');
  const [trackFilter, setTrackFilter] = useState('ALL');

  const allDislocations = data.wagon_dislocations_and_stalls;

  // Group counts by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allDislocations.length };
    for (const w of allDislocations) {
      counts[w.status] = (counts[w.status] || 0) + 1;
    }
    return counts;
  }, [allDislocations]);

  // Extract tracks & approach stations
  const trackSummary = useMemo(() => {
    const map: Record<string, WagonDislocationRow[]> = {};
    for (const w of allDislocations) {
      const loc = (w.track_or_location || w.reason_details || '').trim();
      if (loc.includes('51') && loc.includes('пут')) {
        (map['51 путь'] = map['51 путь'] || []).push(w);
      } else if (loc.includes('52') && loc.includes('пут')) {
        (map['52 путь'] = map['52 путь'] || []).push(w);
      } else if (loc.includes('54') && loc.includes('пут')) {
        (map['54 путь'] = map['54 путь'] || []).push(w);
      } else if (loc.includes('58') && loc.includes('пут')) {
        (map['58 путь'] = map['58 путь'] || []).push(w);
      } else if (loc.includes('59') && loc.includes('пут')) {
        (map['59 путь'] = map['59 путь'] || []).push(w);
      } else if (/Костанай|Шубарколь|Тобол|Державинск|Атбасар|Баталы/i.test(loc)) {
        (map['Станции подхода'] = map['Станции подхода'] || []).push(w);
      }
    }
    return map;
  }, [allDislocations]);

  const filteredWagons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDislocations.filter((w) => {
      const matchStatus = statusFilter === 'ALL' ? true : w.status === statusFilter;
      const matchSheet = sheetFilter === 'Все периоды' ? true : w.raw_sheet === sheetFilter;
      const locText = `${w.track_or_location} ${w.reason_details}`.toLowerCase();
      const matchTrack =
        trackFilter === 'ALL'
          ? true
          : trackFilter === '51 путь'
          ? locText.includes('51')
          : trackFilter === '52 путь'
          ? locText.includes('52')
          : trackFilter === '54 путь'
          ? locText.includes('54')
          : trackFilter === '58 путь'
          ? locText.includes('58')
          : trackFilter === '59 путь'
          ? locText.includes('59')
          : /костанай|шубарколь|тобол|державинск|атбасар|баталы/i.test(locText);

      const matchQuery =
        !q ||
        w.wagon_number.toLowerCase().includes(q) ||
        w.customer_name.toLowerCase().includes(q) ||
        w.repair_type.toLowerCase().includes(q) ||
        w.reason_details.toLowerCase().includes(q) ||
        w.track_or_location.toLowerCase().includes(q) ||
        w.contract_info.toLowerCase().includes(q);

      return matchStatus && matchSheet && matchTrack && matchQuery;
    });
  }, [allDislocations, searchQuery, statusFilter, sheetFilter, trackFilter]);

  return (
    <div className="space-y-6">
      <StallReasonsMatrix
        data={data}
        onAskAnalyst={onAskAnalyst}
        onInspectWagon={onInspectWagon}
      />

      {/* Critical Reasons & Track Occupation Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                Ключевые причины неоконченного ремонта и задержек вагонов
              </h3>
            </div>
            <button
              type="button"
              onClick={() =>
                onAskAnalyst(
                  'Выведи полную таблицу всех вагонов в статусе «Неоконченный ремонт» за 2026 год с указанием номера вагона, заказчика, вида ремонта, пути и точной причины задержки.'
                )
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Сводка по простоям в ИИ</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-semibold text-slate-900 mb-1">Ожидание и брак колёсных пар (КП)</div>
              <p className="text-slate-600 leading-relaxed">
                Вагоны <button type="button" onClick={() => setSearchQuery('94511425')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">94511425</button>,{' '}
                <button type="button" onClick={() => setSearchQuery('94303880')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">94303880</button>,{' '}
                <button type="button" onClick={() => setSearchQuery('94338605')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">94338605</button> (KTZ Express, ДР — «По КП») и{' '}
                <button type="button" onClick={() => setSearchQuery('64780950')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">64780950</button> (ПГК Центр. Азия, ТОР — «Брак КП»).
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-semibold text-slate-900 mb-1">Брак автосцепного устройства</div>
              <p className="text-slate-600 leading-relaxed">
                Вагон <button type="button" onClick={() => setSearchQuery('52509312')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">52509312</button> (Заказчик: Феникс Рейл, капитальный ремонт КР, КВРД) — задержка по причине «брак автоцепки».
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-semibold text-slate-900 mb-1">Неподача со станции / в цех</div>
              <p className="text-slate-600 leading-relaxed">
                Вагон <button type="button" onClick={() => setSearchQuery('98333826')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">98333826</button> (АО «KTZ Express», ДР — «не подали со станции», окт. 2026) и вагон{' '}
                <button type="button" onClick={() => setSearchQuery('61895488')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">61895488</button> (АО «Казтемиртранс», КР — «не подан в цех»).
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-semibold text-slate-900 mb-1">Отстой ХДВ и платформ ЦЖС на 54 пути</div>
              <p className="text-slate-600 leading-relaxed">
                Вагоны ТОО «ЦЖС» <button type="button" onClick={() => setSearchQuery('42526723')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">42526723(68892)</button> (ДР),{' '}
                <button type="button" onClick={() => setSearchQuery('58421')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">58421</button> и{' '}
                <button type="button" onClick={() => setSearchQuery('58273')} className="font-mono font-medium text-blue-700 hover:underline cursor-pointer">58273</button> (ХДВ, КР, дог. №1227153_2026/3).
              </p>
            </div>
          </div>
        </div>

        {/* Track Occupation Filter Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Занятость путей отстоя ВРД и станций подхода
              </h3>
              {trackFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setTrackFilter('ALL')}
                  className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Сбросить путь
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Нажмите на путь отстоя для фильтрации пономерного списка вагонов:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(trackSummary).map(([trackName, list]) => (
                <button
                  key={trackName}
                  type="button"
                  onClick={() => setTrackFilter(trackFilter === trackName ? 'ALL' : trackName)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    trackFilter === trackName
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold">{trackName}</div>
                  <div
                    className={`font-mono tabular-nums text-sm font-bold mt-0.5 ${
                      trackFilter === trackName ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {list.length} зап.
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Станции: Шубарколь, Костанай, Тобол, Державинск, Атбасар</span>
            <button
              type="button"
              onClick={() =>
                onAskAnalyst(
                  'Проанализируй дислокацию вагонов по путям отстоя (51, 52, 54, 58, 59 пути) и станциям подхода (Шубарколь, Костанай, Тобол, Державинск) с указанием номеров вагонов и заказчиков.'
                )
              }
              className="text-blue-700 font-medium hover:underline cursor-pointer whitespace-nowrap shrink-0 ml-2"
            >
              Отчёт по путям
            </button>
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Пономерная дислокация вагонов и статусы ремонта ({filteredWagons.length} из {allDislocations.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Кликните на любой номер вагона для выгрузки полного досье в ИИ-аналитике
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по № вагона, заказчику, пути..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Status & Period Segmented Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {STATUS_FILTERS.map((sf) => (
                <button
                  key={sf.id}
                  type="button"
                  onClick={() => setStatusFilter(sf.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === sf.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sf.label}{' '}
                  <span className="font-mono tabular-nums text-slate-400 ml-0.5">
                    ({statusCounts[sf.id] || 0})
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {SHEET_FILTERS.map((sheet) => (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => setSheetFilter(sheet)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sheetFilter === sheet
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 text-left whitespace-nowrap">№ Вагона</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Дата отчета (Месяц)</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Депо</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Заказчик / Договор</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Вид ремонта</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Статус дислокации</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Дата подачи</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Локация / Путь</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Причина задержки / Примечание</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Досье</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredWagons.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    По выбранным фильтрам вагонов не найдено. Попробуйте сбросить фильтр статуса или пути.
                  </td>
                </tr>
              ) : (
                filteredWagons.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/90 transition-colors text-slate-800">
                    <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectWagon(w.wagon_number)}
                        className="text-blue-700 hover:underline cursor-pointer"
                      >
                        {w.wagon_number}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {w.report_date} · <span className="font-sans">{w.raw_sheet}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{w.depot_code}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{w.customer_name || 'Не указан'}</div>
                      {w.contract_info && <div className="text-slate-500 text-[11px]">{w.contract_info}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{w.repair_type}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          w.status === 'UNFINISHED'
                            ? 'text-red-700'
                            : w.status === 'RELEASE'
                            ? 'text-emerald-700'
                            : w.status === 'LIFTING'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {w.status_ru}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                      {w.formatted_submission_date}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-900 whitespace-nowrap">
                      {w.track_or_location || '—'}
                    </td>
                    <td
                      className={`py-2.5 px-4 ${
                        w.status === 'UNFINISHED' ? 'text-red-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {w.reason_details || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onAskAnalyst(
                            `Дай полную информацию по вагону № ${w.wagon_number}: заказчик, вид ремонта, текущая локация/путь и причина простоя.`
                          )
                        }
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                      >
                        Запросить ИИ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
