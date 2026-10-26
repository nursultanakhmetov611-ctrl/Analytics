import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArsAuthSession, ArsReferences } from '../types/ars';

interface AuditLogModalProps {
  currentUser?: ArsAuthSession | null;
  references: ArsReferences;
}

type AuditTabId = 'actions' | 'sessions' | 'devlog';

interface SystemAuditEntry {
  id: string;
  time: string;
  actor: string;
  depot: string;
  category: string;
  details: string;
}

const INITIAL_AUDIT_ACTIONS: SystemAuditEntry[] = [
  {
    id: 'aud-1',
    time: '08:05:12',
    actor: 'kushmurun (Кушмурунское ВРД)',
    depot: 'KVRD',
    category: 'Сдача смены',
    details: 'Подтверждена сдача суточной справки КВРД (выпуск 6 ваг., подача 7 ваг.)',
  },
  {
    id: 'aud-2',
    time: '08:14:40',
    actor: 'arys (Арысское ВРД)',
    depot: 'AVRD',
    category: 'Сдача смены',
    details: 'Подтверждена сдача суточной справки АВРД (выпуск 8 ваг., в незавершённом ремонте 14 ваг.)',
  },
  {
    id: 'aud-3',
    time: '08:30:05',
    actor: 'astana (Головной офис АРС)',
    depot: 'ALL',
    category: 'Свод ПТО',
    details: 'Сформирована сводная матрица ремонтов по 4 филиалам холдинга АРС на 22.10.2026',
  },
];

// Global Flight Recorder memory (persists across component renders during session)
const globalFlightRecorder: NonNullable<Window['ARS_FLIGHT_RECORDER']> =
  typeof window !== 'undefined' && window.ARS_FLIGHT_RECORDER
    ? window.ARS_FLIGHT_RECORDER
    : {
        stepCount: 0,
        logs: [],
      };

if (typeof window !== 'undefined') {
  window.ARS_FLIGHT_RECORDER = globalFlightRecorder;
}

function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ currentUser, references }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AuditTabId>('devlog');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [systemEvents, setSystemEvents] = useState<SystemAuditEntry[]>(INITIAL_AUDIT_ACTIONS);

  const tabBtnActionsRef = useRef<HTMLButtonElement | null>(null);
  const tabBtnSessionsRef = useRef<HTMLButtonElement | null>(null);
  const tabBtnDevLogRef = useRef<HTMLButtonElement | null>(null);
  const btnCopyDevReportRef = useRef<HTMLButtonElement | null>(null);
  const btnClearDevLogRef = useRef<HTMLButtonElement | null>(null);
  const btnCloseHeaderRef = useRef<HTMLButtonElement | null>(null);
  const btnCloseFooterRef = useRef<HTMLButtonElement | null>(null);

  // 4. ОТОБРАЖЕНИЕ В МОДАЛЬНОМ ОКНЕ (renderDevLog)
  const renderDevLog = useCallback(() => {
    const tbody = document.getElementById('devLogBody');
    const snapEl = document.getElementById('devStateSnapshot');
    const countBadge = document.getElementById('count-devlog');

    const errorCount = globalFlightRecorder.logs.filter((l) => l.type === 'ERROR').length;
    if (countBadge) {
      countBadge.textContent =
        errorCount > 0 ? `${errorCount} ❌` : String(globalFlightRecorder.logs.length);
    }

    if (snapEl) {
      const d = typeof window.currentDepot !== 'undefined' ? window.currentDepot : 'ALL';
      const u =
        typeof window.currentUser !== 'undefined' && window.currentUser
          ? window.currentUser.display_name
          : currentUser?.display_name || 'Не авторизован';
      const dateInput = document.getElementById('inputDate') as HTMLInputElement | null;
      const dt = dateInput?.value || 'сегодня';
      const wc = document.querySelectorAll('#wagonsBody tr')?.length || 0;
      snapEl.innerHTML = `
        <span>🏛️ <strong>Филиал:</strong> ${escapeHtml(d)}</span>
        <span>📅 <strong>Дата:</strong> ${escapeHtml(dt)}</span>
        <span>👤 <strong>Пользователь:</strong> ${escapeHtml(u)}</span>
        <span>🚂 <strong>Вагонов в дислокации:</strong> ${wc} шт.</span>
      `;
    }

    if (!tbody) return;

    if (globalFlightRecorder.logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 18px;">Журнал шагов пуст. Любое действие в приложении будет отображаться здесь.</td></tr>`;
      return;
    }

    tbody.innerHTML = globalFlightRecorder.logs
      .map((l) => {
        const isErr = l.type === 'ERROR';
        const badgeClass = isErr
          ? 'badge-error'
          : l.type === 'CLICK'
          ? 'badge-click'
          : l.type === 'STATE' || l.type === 'NAV'
          ? 'badge-state'
          : 'badge-input';
        return `
          <tr class="${isErr ? 'dev-row-error' : 'dev-row-step'}">
            <td style="font-weight: 700; color: #64748B; padding: 6px 8px;">#${l.step}</td>
            <td style="color: #64748B; font-size: 11px; padding: 6px 8px; font-family: var(--font-mono);">${escapeHtml(l.time)}</td>
            <td style="padding: 6px 8px;"><span class="dev-badge ${badgeClass}">${escapeHtml(l.type)}</span></td>
            <td style="padding: 6px 8px; ${isErr ? 'color: #B91C1C; font-weight: 600;' : ''}">
              ${escapeHtml(l.desc)}
              ${
                l.meta?.stack
                  ? `<pre style="margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.05); font-size: 10px; overflow-x: auto;">${escapeHtml(l.meta.stack)}</pre>`
                  : ''
              }
            </td>
          </tr>
        `;
      })
      .join('');
  }, [currentUser]);

  // Функция записи шага (recordDevStep)
  const recordDevStep = useCallback(
    (type: string, description: string, meta: { stack?: string } | null = null) => {
      globalFlightRecorder.stepCount++;
      const now = new Date();
      const timeStr =
        now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

      const dateInput = document.getElementById('inputDate') as HTMLInputElement | null;
      const depot = typeof window.currentDepot !== 'undefined' ? window.currentDepot : 'ALL';
      const user =
        typeof window.currentUser !== 'undefined' && window.currentUser
          ? window.currentUser.username
          : currentUser?.username || 'anon';

      const record = {
        step: globalFlightRecorder.stepCount,
        time: timeStr,
        type, // 'CLICK', 'NAV', 'INPUT', 'ACTION', 'ERROR'
        desc: description,
        meta,
        stateSnapshot: {
          depot,
          user,
          date: dateInput?.value || '',
          wagonsCount: document.querySelectorAll('#wagonsBody tr')?.length || 0,
        },
      };

      globalFlightRecorder.logs.unshift(record);
      if (globalFlightRecorder.logs.length > 200) {
        globalFlightRecorder.logs.pop();
      }

      const errorCount = globalFlightRecorder.logs.filter((l) => l.type === 'ERROR').length;
      const countBadge = document.getElementById('count-devlog');
      if (countBadge) {
        countBadge.textContent =
          errorCount > 0 ? `${errorCount} ❌` : String(globalFlightRecorder.logs.length);
      }

      // Update live view if #auditTabDevLog is open
      const devPanel = document.getElementById('auditTabDevLog');
      if (devPanel && devPanel.style.display !== 'none') {
        renderDevLog();
      }
    },
    [currentUser, renderDevLog]
  );

  // Очистка лога (clearDevLog)
  const clearDevLog = useCallback(() => {
    globalFlightRecorder.stepCount = 0;
    globalFlightRecorder.logs = [];
    renderDevLog();
    const countBadge = document.getElementById('count-devlog');
    if (countBadge) countBadge.textContent = '0';
    setCopyFeedback('🧹 Журнал шагов Flight Recorder очищен.');
    setTimeout(() => setCopyFeedback(null), 2500);
  }, [renderDevLog]);

  // 5. КОПИРОВАНИЕ ОТЧЁТА ОБ ОШИБКЕ ДЛЯ ИИ (copyDevBugReport)
  const copyDevBugReport = useCallback(() => {
    const lastSteps = globalFlightRecorder.logs.slice(0, 15).reverse();
    const d = typeof window.currentDepot !== 'undefined' ? window.currentDepot : 'ALL';
    const dateInput = document.getElementById('inputDate') as HTMLInputElement | null;
    const dt = dateInput?.value || '';
    const u =
      typeof window.currentUser !== 'undefined' && window.currentUser
        ? window.currentUser.username
        : currentUser?.username || 'unknown';

    let report = `### 🐞 Отчёт об ошибке АРС (Flight Recorder)\n`;
    report += `**Контур:** ${d} | **Дата:** ${dt} | **Пользователь:** ${u}\n\n`;
    report += `**Хронология последних шагов перед ошибкой:**\n`;

    lastSteps.forEach((s) => {
      report += `- [Шаг ${s.step}] (${s.time}) [${s.type}]: ${s.desc}\n`;
      if (s.meta?.stack) {
        report += `  \`\`\`\n  ${s.meta.stack.slice(0, 300)}\n  \`\`\`\n`;
      }
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(report)
        .then(() => {
          setCopyFeedback(
            '✅ Отчёт о шагах и ошибках скопирован в буфер обмена! Вставьте его в чат для быстрой диагностики.'
          );
          setTimeout(() => setCopyFeedback(null), 4000);
        })
        .catch(() => {
          setCopyFeedback('✅ Сформирован отчёт Flight Recorder (выделите и скопируйте при необходимости).');
          setTimeout(() => setCopyFeedback(null), 4000);
        });
    } else {
      setCopyFeedback('✅ Отчёт Flight Recorder подготовлен.');
      setTimeout(() => setCopyFeedback(null), 4000);
    }
  }, [currentUser]);

  // Переключение вкладок в #modalAuditLog (switchAuditTab)
  const switchAuditTab = useCallback(
    (tab: string) => {
      const normalized: AuditTabId =
        tab === 'actions' || tab === 'sessions' || tab === 'devlog' ? tab : 'devlog';
      setActiveTab(normalized);

      const tabActions = document.getElementById('auditTabActions');
      const tabSessions = document.getElementById('auditTabSessions');
      const tabDev = document.getElementById('auditTabDevLog');

      const btnActions = document.getElementById('tabBtnAuditActions');
      const btnSessions = document.getElementById('tabBtnAuditSessions');
      const btnDev = document.getElementById('tabBtnDevLog');

      const isDev = normalized === 'devlog';
      if (tabActions) tabActions.style.display = normalized === 'actions' ? 'block' : 'none';
      if (tabSessions) tabSessions.style.display = normalized === 'sessions' ? 'block' : 'none';
      if (tabDev) tabDev.style.display = isDev ? 'block' : 'none';

      if (btnActions) btnActions.classList.toggle('active', normalized === 'actions');
      if (btnSessions) btnSessions.classList.toggle('active', normalized === 'sessions');
      if (btnDev) btnDev.classList.toggle('active', isDev);

      if (isDev) {
        renderDevLog();
      }
    },
    [renderDevLog]
  );

  const openAuditLogModal = useCallback(
    (initialTab?: string) => {
      setIsOpen(true);
      const modalEl = document.getElementById('modalAuditLog');
      if (modalEl) modalEl.style.display = 'flex';
      const targetTab: AuditTabId =
        initialTab === 'actions' || initialTab === 'sessions' || initialTab === 'devlog'
          ? initialTab
          : 'devlog';
      setActiveTab(targetTab);
      setTimeout(() => {
        switchAuditTab(targetTab);
        renderDevLog();
      }, 10);
    },
    [switchAuditTab, renderDevLog]
  );

  const closeAuditLogModal = useCallback(() => {
    setIsOpen(false);
    const modalEl = document.getElementById('modalAuditLog');
    if (modalEl) modalEl.style.display = 'none';
  }, []);

  const logSystemAction = useCallback(
    (category: string, details: string) => {
      const nowTime = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const depot = typeof window.currentDepot !== 'undefined' ? window.currentDepot : 'ALL';
      const actor =
        typeof window.currentUser !== 'undefined' && window.currentUser
          ? `${window.currentUser.username} (${window.currentUser.display_name})`
          : currentUser
          ? `${currentUser.username} (${currentUser.display_name})`
          : 'Дежурный мастер';

      setSystemEvents((prev) => [
        {
          id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          time: nowTime,
          actor,
          depot,
          category,
          details,
        },
        ...prev.slice(0, 49),
      ]);
      recordDevStep('ACTION', `${category}: ${details}`);
    },
    [currentUser, recordDevStep]
  );

  // Register global functions on window
  useEffect(() => {
    window.recordDevStep = recordDevStep;
    window.renderDevLog = renderDevLog;
    window.clearDevLog = clearDevLog;
    window.copyDevBugReport = copyDevBugReport;
    window.switchAuditTab = switchAuditTab;
    window.openAuditLogModal = openAuditLogModal;
    window.closeAuditLogModal = closeAuditLogModal;
    window.logSystemAction = logSystemAction;
  }, [
    recordDevStep,
    renderDevLog,
    clearDevLog,
    copyDevBugReport,
    switchAuditTab,
    openAuditLogModal,
    closeAuditLogModal,
    logSystemAction,
  ]);

  // Set exact inline onclick attributes for 1-to-1 compatibility
  useEffect(() => {
    if (tabBtnActionsRef.current) {
      tabBtnActionsRef.current.setAttribute('onclick', "switchAuditTab('actions')");
    }
    if (tabBtnSessionsRef.current) {
      tabBtnSessionsRef.current.setAttribute('onclick', "switchAuditTab('sessions')");
    }
    if (tabBtnDevLogRef.current) {
      tabBtnDevLogRef.current.setAttribute('onclick', "switchAuditTab('devlog')");
    }
    if (btnCopyDevReportRef.current) {
      btnCopyDevReportRef.current.setAttribute('onclick', 'copyDevBugReport()');
    }
    if (btnClearDevLogRef.current) {
      btnClearDevLogRef.current.setAttribute('onclick', 'clearDevLog()');
    }
    if (btnCloseHeaderRef.current) {
      btnCloseHeaderRef.current.setAttribute('onclick', 'closeAuditLogModal()');
    }
    if (btnCloseFooterRef.current) {
      btnCloseFooterRef.current.setAttribute('onclick', 'closeAuditLogModal()');
    }
  }, [isOpen]);

  // Record initial session boot step once
  useEffect(() => {
    if (globalFlightRecorder.logs.length === 0) {
      recordDevStep(
        'STATE',
        `Инициализация Flight Recorder АРС (${
          currentUser ? `${currentUser.display_name} [${currentUser.depot_code}]` : 'Гостевой контур'
        })`
      );
    }
  }, [currentUser, recordDevStep]);

  // Log user session changes into systemEvents & Flight Recorder
  useEffect(() => {
    if (currentUser) {
      const nowTime = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setSystemEvents((prev) => [
        {
          id: `aud-${Date.now()}`,
          time: nowTime,
          actor: `${currentUser.username} (${currentUser.display_name})`,
          depot: currentUser.depot_code,
          category: 'Авторизация RBAC',
          details:
            currentUser.role === 'headquarters'
              ? 'Вход в полнофункциональный контур Головного офиса АРС (ALL)'
              : `Вход в изолированный контур филиала ${currentUser.depot_code}`,
        },
        ...prev.slice(0, 49),
      ]);
    }
  }, [currentUser]);

  // 1-3. АВТОПЕРЕХВАТ ОШИБОК JAVASCRIPT, КЛИКОВ И ИЗМЕНЕНИЙ ФОРМЫ
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      recordDevStep(
        'ERROR',
        `Сбой JS: ${event.message} в файле ${event.filename || 'app'}:${event.lineno}`,
        {
          stack: event.error?.stack || '',
        }
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg =
        event.reason && typeof event.reason === 'object' && 'message' in event.reason
          ? String(event.reason.message)
          : String(event.reason);
      const reasonStack =
        event.reason && typeof event.reason === 'object' && 'stack' in event.reason
          ? String(event.reason.stack)
          : '';
      recordDevStep('ERROR', `Сбой Promise/Async: ${reasonMsg}`, {
        stack: reasonStack,
      });
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (!targetEl || typeof targetEl.closest !== 'function') return;
      const target = targetEl.closest(
        'button, .branch-pill, .modal-tab-btn, .tab-btn, a'
      ) as HTMLElement | null;
      if (target) {
        const text = (target.innerText || target.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 45);
        const id = target.id ? `#${target.id}` : '';
        recordDevStep('CLICK', `Нажатие: "${text}" ${id}`.trim());
      }
    };

    const handleDocumentChange = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement | null;
      if (!target) return;
      if (target.id === 'inputDate') {
        recordDevStep('INPUT', `Изменена дата отчёта на: ${target.value}`);
      } else if (target.classList.contains('row-section')) {
        recordDevStep('INPUT', `Изменён раздел/статус вагона на: "${target.value}"`);
      } else if (target.classList.contains('row-cust')) {
        recordDevStep('INPUT', `Изменён заказчик вагона на: "${target.value}"`);
      } else if (target.classList.contains('row-wagon')) {
        recordDevStep('INPUT', `Введён номер вагона: "${target.value}"`);
      } else if (target.classList.contains('row-repair')) {
        recordDevStep('INPUT', `Изменён вид ремонта вагона на: "${target.value}"`);
      } else if (target.classList.contains('matrix-input')) {
        recordDevStep('INPUT', `Обновлён показатель КП (#${target.id}): ${target.value} шт.`);
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('change', handleDocumentChange, true);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('change', handleDocumentChange, true);
    };
  }, [recordDevStep]);

  // Refresh DOM view when modal opens or tab changes to devlog
  useEffect(() => {
    if (isOpen && activeTab === 'devlog') {
      renderDevLog();
    }
  }, [isOpen, activeTab, renderDevLog]);

  if (typeof document === 'undefined') return null;

  const errorCount = globalFlightRecorder.logs.filter((l) => l.type === 'ERROR').length;
  const badgeText =
    errorCount > 0 ? `${errorCount} ❌` : String(globalFlightRecorder.logs.length);

  return createPortal(
    <div
      id="modalAuditLog"
      className="modal-backdrop"
      style={{ display: isOpen ? 'flex' : 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuditLogModal();
      }}
    >
      <div className="modal-card" style={{ maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>📜 Журнал системы и отладка ТОО «Astana Railway Services»</span>
          </div>
          <button
            ref={btnCloseHeaderRef}
            type="button"
            className="modal-close"
            onClick={closeAuditLogModal}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Навигация по 3 вкладкам журнала */}
        <div className="modal-tabs">
          <button
            ref={tabBtnActionsRef}
            type="button"
            id="tabBtnAuditActions"
            className={`modal-tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => switchAuditTab('actions')}
          >
            📋 Операции смены{' '}
            <span className="badge-count">{systemEvents.length}</span>
          </button>

          <button
            ref={tabBtnSessionsRef}
            type="button"
            id="tabBtnAuditSessions"
            className={`modal-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => switchAuditTab('sessions')}
          >
            🔐 Контур доступа (RBAC){' '}
            <span className="badge-count">{references.depots.length + 2}</span>
          </button>

          <button
            ref={tabBtnDevLogRef}
            type="button"
            className={`modal-tab-btn ${activeTab === 'devlog' ? 'active' : ''}`}
            id="tabBtnDevLog"
            onClick={() => switchAuditTab('devlog')}
          >
            🐞 Чёрный ящик (Отладка багов){' '}
            <span
              className="badge-count"
              id="count-devlog"
              style={{ background: '#E74C3C', color: '#FFFFFF' }}
            >
              {badgeText}
            </span>
          </button>
        </div>

        <div className="modal-body">
          {copyFeedback && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
              <span>{copyFeedback}</span>
              <button
                type="button"
                onClick={() => setCopyFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Вкладка 1: Операции смены */}
          <div
            id="auditTabActions"
            className={`modal-tab-panel ${activeTab === 'actions' ? 'active' : ''}`}
            style={{ display: activeTab === 'actions' ? 'block' : 'none' }}
          >
            <div className="mb-3">
              <strong style={{ color: 'var(--primary-dark)', fontSize: '13px' }}>
                Производственный журнал событий и сдачи смен
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Фиксация оперативных изменений по депо КВРД, АВРД, БВРД, УВРД и сводной матрице холдинга.
              </p>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <table className="ref-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ width: '90px' }}>Время</th>
                    <th style={{ width: '80px' }}>Контур</th>
                    <th style={{ width: '210px' }}>Пользователь</th>
                    <th style={{ width: '140px' }}>Категория</th>
                    <th>Описание события</th>
                  </tr>
                </thead>
                <tbody>
                  {systemEvents.map((ev) => (
                    <tr key={ev.id} className="dev-row-step">
                      <td className="font-mono text-xs text-slate-500">{ev.time}</td>
                      <td>
                        <span className="dev-badge badge-click">{ev.depot}</span>
                      </td>
                      <td className="font-medium text-slate-800">{ev.actor}</td>
                      <td>
                        <span className="dev-badge badge-state">{ev.category}</span>
                      </td>
                      <td className="text-slate-700">{ev.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 2: Контур доступа (RBAC) */}
          <div
            id="auditTabSessions"
            className={`modal-tab-panel ${activeTab === 'sessions' ? 'active' : ''}`}
            style={{ display: activeTab === 'sessions' ? 'block' : 'none' }}
          >
            <div className="mb-3">
              <strong style={{ color: 'var(--primary-dark)', fontSize: '13px' }}>
                Матрица изоляции филиалов и активной сессии (Role-Based Access Control)
              </strong>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Текущий статус полномочий пользователя и зарегистрированных депо в системе АРС.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 mb-3 text-xs flex flex-wrap gap-6">
              <div>
                <span className="text-slate-500">Текущий логин:</span>{' '}
                <strong className="font-mono text-slate-900">
                  {currentUser?.username || 'Не выполнен вход'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Роль:</span>{' '}
                <strong className="text-slate-900">
                  {currentUser?.role === 'headquarters'
                    ? 'Головной офис (Полный доступ ALL)'
                    : currentUser?.role === 'branch'
                    ? `Мастер филиала (Строгая изоляция ${currentUser.depot_code})`
                    : '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Профиль:</span>{' '}
                <strong className="text-slate-900">{currentUser?.display_name || '—'}</strong>
              </div>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <table className="ref-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th>Код депо</th>
                    <th>Наименование филиала</th>
                    <th>Логин филиала</th>
                    <th>Режим доступа</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="dev-row-step">
                    <td className="font-mono font-bold text-[#1B365D]">ALL</td>
                    <td>Головной офис ТОО «Astana Railway Services» (Астана)</td>
                    <td className="font-mono">astana / admin</td>
                    <td>
                      <span className="dev-badge badge-state">Полный доступ ко всем депо</span>
                    </td>
                  </tr>
                  {references.depots.map((dep) => {
                    const loginMap: Record<string, string> = {
                      KVRD: 'kushmurun',
                      AVRD: 'arys',
                      BVRD: 'balkhash',
                      UVRD: 'uralsk',
                    };
                    const loginName = loginMap[dep.code] || dep.code.toLowerCase();
                    return (
                      <tr key={dep.id} className="dev-row-step">
                        <td className="font-mono font-bold text-slate-800">{dep.code}</td>
                        <td>{dep.name}</td>
                        <td className="font-mono">{loginName}</td>
                        <td>
                          <span className="dev-badge badge-click">
                            Изолированный контур {dep.code}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 3: Чёрный ящик разработчика (Flight Recorder) */}
          <div
            id="auditTabDevLog"
            className={`modal-tab-panel ${activeTab === 'devlog' ? 'active' : ''}`}
            style={{ display: activeTab === 'devlog' ? 'block' : 'none' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong style={{ color: 'var(--primary-dark)', fontSize: '13px' }}>
                  Журнал шагов и отлова сбоев (Flight Recorder)
                </strong>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Автоматически пишет каждый клик, переключение вкладки, изменение формы и системные ошибки.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  ref={btnCopyDevReportRef}
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: '#1B365D',
                    color: 'white',
                    padding: '6px 12px',
                    fontSize: '12px',
                  }}
                  onClick={copyDevBugReport}
                >
                  📋 Скопировать лог для ИИ
                </button>
                <button
                  ref={btnClearDevLogRef}
                  type="button"
                  className="btn btn-sm btn-clear"
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'white',
                  }}
                  onClick={clearDevLog}
                >
                  Очистить
                </button>
              </div>
            </div>

            {/* Панель текущего состояния системы на момент открытия */}
            <div
              id="devStateSnapshot"
              style={{
                background: '#F1F5F9',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '12px',
                fontSize: '11px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                borderLeft: '3px solid var(--primary)',
              }}
            >
              {/* Автозаполняется текущим состоянием: Депо, Дата, Вкладка, Пользователь, Кол-во вагонов */}
            </div>

            {/* Список шагов */}
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
            >
              <table
                className="ref-table"
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
              >
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ width: '50px' }}>Шаг</th>
                    <th style={{ width: '90px' }}>Время</th>
                    <th style={{ width: '110px' }}>Тип</th>
                    <th>Действие / Сообщение об ошибке</th>
                  </tr>
                </thead>
                <tbody id="devLogBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Автоперехват событий: <strong className="text-emerald-700">Активен (window.onerror + click + change)</strong>
          </span>
          <button
            ref={btnCloseFooterRef}
            type="button"
            className="btn btn-secondary"
            onClick={closeAuditLogModal}
          >
            Закрыть окно
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
