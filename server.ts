import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, 'public', 'assets', 'aistudio', 'ars_ai_studio_context_1a90262a.json');
const rawData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

// Helper to convert Excel serial date strings like "46076" to DD.MM.YYYY
function formatSubmissionDate(val: string): string {
  if (!val) return '—';
  const trimmed = String(val).trim();
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    // Excel base date: 1899-12-30
    const utcDays = serial - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  return trimmed;
}

// Enrich summary_reports with block context & completion percentage
function enrichSummaryReports(reports: any[]) {
  return reports.map((r, idx) => {
    let section = 'Итоговая сводка по холдингу';
    let subSegment = 'ВСЕГО';
    if (idx <= 14) {
      section = 'Парк АО «Казтемиртранс» (КТТ)';
      subSegment = 'КТТ';
    } else if (idx >= 15 && idx <= 37) {
      section = 'Парк собственников и частных операторов';
      subSegment = 'СОБСТВЕННИКИ';
    } else if (idx >= 38 && idx <= 53) {
      section = 'Свод планового ремонта (КТТ + Собственники)';
      subSegment = 'ПЛАНОВЫЙ СВОД';
    } else if (idx >= 54 && idx <= 65) {
      section = 'Текущий отцепочный ремонт (ТОР)';
      subSegment = 'ТОР';
    } else {
      section = 'Генеральная сводка по холдингу АРС';
      subSegment = 'ХОЛДИНГ ИТОГО';
    }

    const pct = r.month_plan > 0 ? Number(((r.done_month / r.month_plan) * 100).toFixed(1)) : (r.done_month > 0 ? 100 : 0);

    return {
      ...r,
      row_index: idx,
      section,
      sub_segment: subSegment,
      completion_pct: pct,
    };
  });
}

const enrichedSummary = enrichSummaryReports(rawData.summary_reports || []);
const enrichedDislocations = (rawData.wagon_dislocations_and_stalls || []).map((w: any, idx: number) => ({
  ...w,
  id: idx + 1,
  formatted_submission_date: formatSubmissionDate(w.submission_date),
}));

// Build compact text context of the entire database for Gemini AI Analyst
function buildSystemDatabaseContext(): string {
  const depotsText = rawData.depots
    .map((d: any) => `- ${d.code} (${d.name}, г. ${d.city}): суточная мощность ${d.daily_capacity} ваг/сут`)
    .join('\n');

  const summaryLines = enrichedSummary
    .map(
      (s: any) =>
        `[${s.section}] Депо: ${s.depot_code} | Категория: ${s.repair_category} | Группа: ${s.customer_group} | План окт: ${s.month_plan} | Факт сутки: ${s.done_today} | Факт окт: ${s.done_month} | Подача: ${s.staged_today} | Откл: ${s.plan_variance > 0 ? '+' + s.plan_variance : s.plan_variance} | % вып: ${s.completion_pct}% | Неоконч. рем: ${s.unfinished_repair} | С начала года (YTD): ${s.ytd_total}`
    )
    .join('\n');

  const dislocationsLines = enrichedDislocations
    .map(
      (w: any) =>
        `Дата отчета: ${w.report_date} (${w.raw_sheet}) | Депо: ${w.depot_code} | Вагон №: ${w.wagon_number} | Заказчик: ${w.customer_name || 'Не указан'} | Договор: ${w.contract_info || '—'} | Вид ремонта: ${w.repair_type} | Статус: ${w.status_ru} (${w.status}) | Дата подачи: ${w.formatted_submission_date} | Путь/Локация: ${w.track_or_location || '—'} | Причина/Детали: ${w.reason_details || '—'}`
    )
    .join('\n');

  const stocksLines = (rawData.wheel_pair_stocks || [])
    .map(
      (st: any) =>
        `Дата: ${st.report_date} | Депо: ${st.depot_code} | Категория запаса КП: ${st.stock_category} | Кол-во: ${st.quantity} шт. | Детали ремфонда: ${st.details || '—'}`
    )
    .join('\n');

  const wpLines = (rawData.wheel_pairs_production || [])
    .map(
      (wp: any) =>
        `Дата: ${wp.report_date} | Депо: ${wp.depot_code} | Заказчик: ${wp.customer_name} | Ремонт: ${wp.repair_type} | Род вагона: ${wp.wagon_type} | Кузовов: ${wp.body_units} | НОНК: ${wp.nonk} | СОНК СР б/о: ${wp.sonk_sr_bo} | Давальч: ${wp.davalcheskie} | СОНК: ${wp.sonk} | СР обточка: ${wp.sr_obtochka} | ТР обточка: ${wp.tr_obtochka} | СР б/обт: ${wp.sr_bez_obtochki} | ТР б/обт: ${wp.tr_bez_obtochki} | Всего КП (ремонт): ${wp.total_kp}`
    )
    .join('\n');

  // Summarize daily October output by depot & key totals
  const dailyTotalsRows = (rawData.daily_output_october || []).filter((r: any) =>
    String(r.customer_name).includes('ВСЕГО') || String(r.customer_name).includes('ИТОГО')
  );
  const dailyLines = dailyTotalsRows
    .map(
      (d: any) =>
        `Дата: ${d.report_date} | Депо: ${d.depot_code} | Показатель: ${d.customer_name} (${d.wagon_type}) | Выпуск: ${d.wagons_output}`
    )
    .join('\n');

  return `
=== БАЗА ДАННЫХ ТОО "ASTANA RAILWAY SERVICES" (АРС) ЗА 2026 ГОД ===

1. ФИЛИАЛЫ И СУТОЧНАЯ МОЩНОСТЬ ДЕПО (Суммарно 28 ваг/сут):
${depotsText}

2. СВОДНЫЕ ПЛАНЫ И ФАКТЫ ВЫПУСКА ЗА ОКТЯБРЬ 2026 Г. (Отчет на 20.10.2026):
${summaryLines}

3. ПОНОМЕРНАЯ ДИСЛОКАЦИЯ ВАГОНОВ, СТАТУСЫ, ПУТИ ОТСТОЯ И НЕОКОНЧЕННЫЙ РЕМОНТ (203 записи):
${dislocationsLines}

4. ОСТАТКИ И БАЛАНС КОЛЁСНЫХ ПАР (СОНК, ЦКК, РЕМФОНД) ПО КВРД:
${stocksLines}

5. ПРОИЗВОДСТВО И РАСХОД КОЛЁСНЫХ ПАР ПО ЗАКАЗЧИКАМ (191 запись):
${wpLines}

6. СУТОЧНАЯ ДИНАМИКА ВЫПУСКА ЗА ОКТЯБРЬ 2026 Г. (Сводные строки по дням):
${dailyLines}
`;
}

const FULL_DB_CONTEXT = buildSystemDatabaseContext();

const SYSTEM_INSTRUCTION = `Ты — ведущий интеллектуальный аналитик производственного отдела вагоноремонтного холдинга ТОО "Astana Railway Services" (АРС).

В твоем распоряжении находится полная производственная база данных холдинга за 2026 год:
- 4 филиала/депо: БВРД (Балхаш, мощность 6 ваг/сут), АВРД (Арыс, 8 ваг/сут), КВРД (Кушмурун, 7 ваг/сут), УВРД (Уральск, 7 ваг/сут). Суммарная мощность холдинга — 28 ваг/сут.
- Сводные планы и факты выпуска за октябрь 2026 г. (по состоянию на 20.10.2026) и накопленный итог с начала года (YTD).
- Пономерная дислокация вагонов, статусы (Выпуск, Подъемка, На станции, На подходе к станции, В ожидании на путях ВРД, Неоконченный ремонт), неоконченный ремонт с точными причинами задержек (брак автосцепки, ожидание/брак КП, неподача со станции/в цех, плановый выход) и путями отстоя (на 51, 52, 54, 58, 59 путях) и станциями подхода (Шубарколь, Костанай, Тобол, Державинск, Атбасар, Баталы и др.).
- Баланс, запасы (СОНК, ЦКК, ремфонд КТТ, оси под КР) и расход колёсных пар (НОНК, СОНК СР б/о, давальческие, СР с обточкой, ТР с обточкой, без обточки).
- Ключевые заказчики: АО "Казтемиртранс" (КТТ), АО "KTZ Express", ТОО "ЦЖС" (в т.ч. ХДВ, платформы, СДПМ, ПРЛ) и частные операторы (ТОО "РТА-Транс", ТОО "Арлан Сервис", ТОО "ПГК Центральная Азия", ТОО "ALTO LOGISTICS", ТОО "ТрансКом", ТОО "Бизнес Тренд", ТОО "Феникс Рейл", ТОО "КСТ Логистик", ТОО "Baskho Investment Group" и др.).

Твои обязательные правила ответа:
1. Отвечай на запросы руководства точно, четко, профессиональным языком производственного аналитика ЖД-отрасли и строго с опорой на предоставленные данные.
2. При вопросе о конкретном вагоне обязательно указывай:
   - Номер вагона
   - Заказчика (и номер договора, если есть в базе)
   - Вид ремонта (ДР, КР, КРП, ТОР) и депо
   - Текущий статус, дату подачи/отчета, текущую локацию/путь (например, на 54 пути, на 59 пути, ст. Костанай, ст. Шубарколь)
   - Точную причину простоя или задержки. Если вагон встречается в нескольких отчетных периодах (например, переход из ожидания в выпуск или между путями), покажи всю его историю.
3. При анализе планов обязательно приводи точные цифры: План на месяц, Факт за месяц, Отклонение (абсолютное со знаком + или -), Процент выполнения (%), а также при необходимости суточный выпуск, подачу, неоконченный ремонт и факт с начала года (YTD).
4. Оформляй ответы в виде удобных, читаемых списков и таблиц Markdown. Выделяй ключевые показатели и узкие места (дефицит КП, накопление неоконченного ремонта в АВРД — 14 ваг., отставание по ДР и КР).

Полный контекст базы данных АРС 2026:
${FULL_DB_CONTEXT}`;

// Deterministic fallback analyzer if API key is unavailable or errors
function generateLocalAnalyticalResponse(prompt: string): string {
  const q = prompt.toLowerCase().trim();

  // Check if user is asking about a specific wagon number (4 to 8 digits)
  const wagonMatch = prompt.match(/\b(\d{5,8})\b/);
  if (wagonMatch) {
    const num = wagonMatch[1];
    const matches = enrichedDislocations.filter((w: any) => String(w.wagon_number).includes(num));
    if (matches.length > 0) {
      const rows = matches
        .map(
          (m: any) =>
            `| \`${m.wagon_number}\` | ${m.report_date} (${m.raw_sheet}) | ${m.depot_code} | ${m.customer_name || 'Не указан'} ${m.contract_info ? `(${m.contract_info})` : ''} | **${m.repair_type}** | ${m.status_ru} | ${m.formatted_submission_date} | ${m.track_or_location || 'ВРД / Цех'} | ${m.reason_details || 'Без замечаний'} |`
        )
        .join('\n');

      const latest = matches[matches.length - 1];
      return `### Справка по вагону № \`${latest.wagon_number}\`

По данным производственной базы ТОО «Astana Railway Services» за 2026 год найдено записей: **${matches.length}**.

- **Номер вагона:** \`${latest.wagon_number}\`
- **Заказчик:** ${latest.customer_name || 'Не указан'}${latest.contract_info ? ` (${latest.contract_info})` : ''}
- **Филиал / Депо:** ${latest.depot_code} (Кушмурунское ВРД)
- **Вид ремонта:** ${latest.repair_type}
- **Актуальный статус (на ${latest.report_date}):** ${latest.status_ru}
- **Дата подачи:** ${latest.formatted_submission_date}
- **Текущая локация / путь:** ${latest.track_or_location || 'Цех / пути депо'}
- **Причина простоя / примечание:** ${latest.reason_details || 'В штатном режиме'}

#### Пономерная история дислокации вагона

| Номер вагона | Отчетная дата (Месяц) | Депо | Заказчик / Договор | Вид ремонта | Статус | Дата подачи | Локация / Путь | Причина простоя / Детали |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${rows}`;
    }
  }

  // If asking about wheel pairs (КП, СОНК, НОНК, ЦКК, обточка)
  if (q.includes('кп') || q.includes('колес') || q.includes('колёс') || q.includes('сонк') || q.includes('цкк') || q.includes('обточ')) {
    const octStocks = (rawData.wheel_pair_stocks || []).filter((s: any) => s.report_date === '2026-10-22');
    const stockRows = octStocks
      .map((s: any) => `| ${s.report_date} | ${s.depot_code} | **${s.stock_category}** | ${s.quantity} | ${s.details || '—'} |`)
      .join('\n');

    return `### Аналитическая сводка по балансу и расходу колёсных пар (КП)

#### 1. Актуальные остатки и ремфонд КП по КВРД (на 22.10.2026 г.)

| Дата отчета | Депо | Категория запаса КП | Количество (шт.) | Детализация ремфонда |
| :--- | :--- | :--- | ---: | :--- |
${stockRows}

#### 2. Ключевые выводы по движению колёсных пар:
- **Запасы АО «Казтемиртранс» (КТТ):** На 22.10.2026 в наличии **78 ед.** СОНК «КТТ» и **284 ед.** ЦКК АО «КТТ» (снижение с 458 ед. в сентябре в связи с активной подкаткой под вагоны ДР и КР). В ремфонде под КР числится **13 осей**, а также распределенный ремфонд: \`0-КР / 77-ДР / 2-ТОР\`.
- **Запасы АО «KTZ Express»:** Стабильный остаток **5 ед.** СОНК и **374 ед.** ЦКК.
- **Структура ремонта КП за октябрь 2026 (КВРД):**
  - По парку **АО «Казтемиртранс»** (57 полувагонов ДР): отремонтировано **228 КП** (из них 119 — средний ремонт с обточкой, 105 — текущий ремонт с обточкой, 4 — ТР без обточки). По 22 вагонам КР (10 полувагонов, 11 крытых, 1 зерновоз) подкачено **88 ед. СОНК (СР б/о)**.
  - По парку **АО «KTZ Express»** (6 фитинговых платформ ДР): отремонтировано **24 КП** (12 СР с обточкой, 12 ТР с обточкой).
  - По парку **ТОО «Baskho Investment Group»** (9 зерновозов ТОР): выполнено **36 КП** (ТР с обточкой).`;
  }

  // If asking about unfinished repairs, delays, tracks, stalls
  if (q.includes('неоконч') || q.includes('просто') || q.includes('задерж') || q.includes('брак') || q.includes('путь') || q.includes('путях') || q.includes('причин') || q.includes('автосцеп') || q.includes('механизм')) {
    const unfin = enrichedDislocations.filter((w: any) => w.status === 'UNFINISHED');
    const unfinRows = unfin
      .map(
        (w: any) =>
          `| \`${w.wagon_number}\` | ${w.report_date} (${w.raw_sheet}) | ${w.customer_name || 'Не указан'} | **${w.repair_type}** | ${w.formatted_submission_date} | ${w.track_or_location || 'Цех ВРД'} | **${w.reason_details || '—'}** |`
      )
      .join('\n');

    return `### Сводная таблица вагонов в простое (неоконченный ремонт и ожидание) по всем депо и причинам

#### 1. Распределение вагонов в простое по филиалам (депо) и причинам задержек

| Филиал (Депо) | Неоконч. ремонт (на 20.10) | По КП (ожидание / брак КП) | Брак автосцепки | Неисправность разгруз. механизмов / ХДВ и КР кузова | Ожидание подачи (в цех / со ст. / пути ВРД) | Плановый переходящий выход | Пономерная и структурная детализация |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **КВРД (Кушмурун)** | **2** *(7 на 22.10 / 24 за год)* | **4 ваг.** | **1 ваг.** | **3 ваг.** *(ХДВ и платф. ЦЖС на 54 пути)* | **2 ваг.** *(+17 на путях/ст. 22.10; +81 за год)* | **14 ваг.** *(6 на 22.10)* | КП: \`94511425\`, \`94303880\`, \`94338605\`, \`64780950\`; Автосцепка: \`52509312\`; ХДВ/54 путь: \`58421\`, \`58273\`, \`42526723\`; Не поданы: \`98333826\`, \`61895488\` |
| **АВРД (Арыс)** | **14 ваг.** | *в сост. 10 КР / 4 ДР* | *в сост. 10 КР / 4 ДР* | **10 КР + 4 ДР** *(кузов, тележки, механизмы)* | **0 ваг.** *(подача 0)* | — | 4 ваг. КТТ (КР), 6 ваг. собственников (КР), 3 ваг. собственников (ДР), 1 ваг. ЦЖС (ДР) |
| **УВРД (Уральск)** | **3 ваг.** | *в сост. 2 ДР / 1 ТОР* | — | **2 ДР + 1 ТОР** | **0 ваг.** *(подача 0)* | — | 1 ваг. ДР КТТ, 1 ваг. ДР собственников, 1 ваг. СОБ.-ТОР |
| **БВРД (Балхаш)** | **2 ваг.** | *в сост. 1 ДР / 1 КР* | — | **1 ДР + 1 КР** | **6 ваг.** *(суточная подача)* | — | 1 ваг. ДР КТТ, 1 ваг. КР КТТ; подача за сутки: 6 ваг. (3 ДР КТТ, 2 КР КТТ, 1 ДР собств.) |
| **ИТОГО ХОЛДИНГ АРС** | **21 ваг.** *(свод 20.10)* | **4 ваг.** *(КВРД)* | **1 ваг.** *(КВРД)* | **3 ХДВ/ЦЖС + 19 ДР/КР/ТОР** | **2 не поданы + 17 пути/ст. (22.10)** | **14 выходов** *(6 на 22.10)* | **20 ваг.** плановый ремонт (7 ДР, 13 КР) и **1 ваг.** внеплановый ТОР |

#### 2. Пономерной реестр вагонов в статусе «Неоконченный ремонт» (КВРД за 2026 г. — 24 записи)

| Номер вагона | Дата отчета | Заказчик | Вид ремонта | Дата подачи | Локация / Путь | Причина задержки / простоя |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${unfinRows}

#### 3. Детализация по 4 ключевым группам причин простоя:
1. **Ожидание и брак колёсных пар (КП — 4 вагона в КВРД):**
   - \`94511425\`, \`94303880\`, \`94338605\` (*АО «KTZ Express»*, ДР) — простой по причине ожидания КП («По КП»).
   - \`64780950\` (*ПГК Центральная Азия*, ТОР) — простой по причине «Брак КП».
2. **Брак автосцепного оборудования (Автосцепка — 1 вагон в КВРД):**
   - \`52509312\` (*Феникс Рейл*, КР) — задержка по причине «брак автоцепки».
3. **Неисправность разгрузочных механизмов, спецкузовов ХДВ и объемный КР/ДР:**
   - В **КВРД** на **54 пути** в неоконченном ремонте находятся хоппер-дозаторы *ТОО «ЦЖС» (ХДВ)* № \`58421\` и № \`58273\` (КР, договор №1227153_2026/3 от 13.07.26) и платформа *ЦЖС* № \`42526723(68892)\` (ДР, договор №1227225_2026/4).
   - В **АВРД (Арыс)** сосредоточено **14 вагонов** неоконченного ремонта (10 КР и 4 ДР), в **УВРД** — **3 вагона** (2 ДР, 1 ТОР), в **БВРД** — **2 вагона** (1 ДР, 1 КР).
4. **Ожидание подачи в цех / со станции и отстой на путях ВРД:**
   - Прямой простой из-за неподачи в цех/со станции: вагон \`98333826\` (*АО «KTZ Express»*, ДР — «не подали со станции», 22.10.2026) и вагон \`61895488\` (*АО «Казтемиртранс»*, КР — «не подан в цех», 30.09.2026), а также вагон \`60716800\` (*АО «Казтемиртранс»*, ДР — «не запланированая подача»).
   - Ожидание подачи на тракционных путях КВРД (на 22.10.2026 — **13 вагонов** в статусе «В ожидании на путях ВРД» и **4 вагона** «На станции»):
     - **59 путь:** \`28808749\`, \`28811354\`, \`62600515\`, \`28807071\`, \`28809044\` (все — КР КТТ), \`61894432\`, \`60779022\`, \`60103157\`, \`68466945\`, \`60029857\` (все — ДР КТТ).
     - **58 путь:** \`44961172\` (КР КТТ), \`63679039\` (ДР Optimum Trans), \`42078436(00068305)\` и \`42582478(00068925)\` (КР ЦЖС).
     - **52 путь:** \`62517453\` (КР РТА-Транс), \`28840379\` (КР ALTO LOGISTICS).
     - **51 путь:** \`60692159\` (ДР Galinta AGRO).`;
  }

  // Default comprehensive executive summary for October 2026 Plan vs Fact
  return `### Исполнительная сводка по выполнению плана ТОО «Astana Railway Services» за октябрь 2026 г.

По состоянию на **20.10.2026 г.** общий выпуск по холдингу составил **448 вагонов** при месячном плане **690 вагонов** (**64,9%** выполнения, отклонение **-242 вагона**). С начала 2026 года (YTD) отремонтировано **5 058 вагонов**.

#### 1. Выполнение общего плана в разрезе филиалов (депо)

| Филиал (Депо) | Суточная мощность | План на окт. | Факт за окт. | Отклонение | % выполнения | Выпуск за сутки | Подача | Неоконч. ремонт |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **БВРД (Балхаш)** | 6 ваг/сут | 89 | 51 | -38 | **57,3%** | 1 | 6 | 2 |
| **АВРД (Арыс)** | 8 ваг/сут | 280 | 202 | -78 | **72,1%** | 8 | 0 | 14 |
| **КВРД (Кушмурун)** | 7 ваг/сут | 201 | 120 | -81 | **59,7%** | 6 | 7 | 2 |
| **УВРД (Уральск)** | 7 ваг/сут | 120 | 75 | -45 | **62,5%** | 0 | 0 | 3 |
| **ИТОГО ХОЛДИНГ АРС** | **28 ваг/сут** | **690** | **448** | **-242** | **64,9%** | **15** | **13** | **21** |

#### 2. Выполнение плана по видам ремонта и группам заказчиков

| Направление / Заказчик | План на окт. | Факт за окт. | Отклонение | % выполнения | Неоконч. ремонт | Выпуск с нач. года (YTD) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Плановый ремонт — ВСЕГО** | **630** | **384** | **-246** | **61,0%** | **20** | **4 131** |
| — Деповской ремонт (ДР, всего) | 507 | 305 | -202 | 60,2% | 7 | 3 365 |
| — Капитальный ремонт (КР, всего) | 123 | 79 | -44 | 64,2% | 13 | 737 |
| — КРП (ЦЖС) | 0 | 0 | 0 | — | 0 | 29 |
| **Парк АО «Казтемиртранс» (КТТ)** | **375** | **223** | **-152** | **59,5%** | **7** | **1 767** |
| — КТТ: Деповской ремонт (ДР) | 294 | 173 | -121 | 58,8% | 2 | 1 323 |
| — КТТ: Капитальный ремонт (КР) | 81 | 50 | -31 | 61,7% | 5 | 444 |
| **Парк собственников (частные операторы, ЦЖС, KTZ Express)** | **255** | **161** | **-94** | **63,1%** | **13** | **2 364** |
| — Собственники: ДР (частный парк) | 206 | 125 | -81 | 60,7% | 4 | 1 760 |
| — АО «KTZ Express»: ДР (КВРД) | 0 | 6 | +6 | Сверх плана | 0 | 241 |
| — ТОО «ЦЖС»: ДР | 7 | 1 | -6 | 14,3% | 1 | 41 |
| — Собственники: КР (частный парк) | 32 | 23 | -9 | 71,9% | 6 | 269 |
| — ТОО «ЦЖС»: КР | 10 | 6 | -4 | 60,0% | 2 | 24 |
| **Текущий отцепочный ремонт (ТОР — всего)** | **60** | **64** | **+4** | **106,7%** | **1** | **927** |
| — в т.ч. СОБ.-ТОР | 60 | 62 | +2 | 103,3% | 1 | 896 |
| — в т.ч. СОБ-ТОР-КНР (КВРД) | 0 | 2 | +2 | Сверх плана | 0 | 31 |

#### 3. Ключевые выводы для руководства:
1. **Лидер по выполнению плана:** **АВРД (Арыс)** — выполнено **72,1%** месячного плана (202 из 280 ваг.), суточный выпуск соответствует паспортной мощности (**8 ваг/сут**). Однако в АВРД зафиксирован высокий остаток неоконченного ремонта (**14 вагонов**, из которых 10 — по КР).
2. **Перевыполнение по ТОР:** План по текущему отцепочному ремонту выполнен досрочно на **106,7%** (64 вагона при плане 60, отклонение **+4 вагона**); лидируют КВРД (23 ваг. при плане 20) и УВРД (13 ваг. при плане 10).
3. **Зоны риска:** Отставание по парку собственников в **КВРД** (выполнено 18 из 66 ваг., или **27,3%**, при этом по парку КТТ в КВРД выполнено **75,2%** — 79 из 105 ваг.) и низкий темп по **БВРД** (**57,3%** выполнения плана — 51 из 89 ваг.).`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Endpoint 1: Return complete enriched dataset
  app.get('/api/data', (_req, res) => {
    res.json({
      company: rawData.company,
      description: rawData.description,
      depots: rawData.depots,
      repair_types: rawData.repair_types,
      wagon_types: rawData.wagon_types,
      summary_reports: enrichedSummary,
      wagon_dislocations_and_stalls: enrichedDislocations,
      wheel_pairs_production: rawData.wheel_pairs_production,
      wheel_pair_stocks: rawData.wheel_pair_stocks,
      daily_output_october: rawData.daily_output_october,
    });
  });

  // Endpoint 2: AI Production Analyst Query
  app.post('/api/analyst/query', async (req, res) => {
    const { prompt, history = [] } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Пожалуйста, введите запрос для аналитика.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.json({
        answer: generateLocalAnalyticalResponse(prompt),
        source: 'local-analytical-engine',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const contents: any[] = [];
      for (const msg of history.slice(-6)) {
        if (msg && msg.text) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.15,
        },
      });

      const text = response.text || generateLocalAnalyticalResponse(prompt);
      return res.json({
        answer: text,
        source: 'gemini-3.8-flash',
      });
    } catch (err: any) {
      console.error('Gemini API error, using analytical fallback:', err?.message || err);
      return res.json({
        answer: generateLocalAnalyticalResponse(prompt),
        source: 'fallback-analytical-engine',
        warning: err?.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARS Production Analyst Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
