import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArsAuthSession, ArsReferences, ReferenceRepairItem } from '../types/ars';

interface ReferencesModalProps {
  references: ArsReferences;
  onUpdateReferences: (next: ArsReferences) => void;
  currentUser?: ArsAuthSession | null;
}

type RefTabId =
  | 'ref-tab-customers'
  | 'ref-tab-wagons'
  | 'ref-tab-sections'
  | 'ref-tab-depots'
  | 'ref-tab-repairs';

// Базовый полный список видов ремонта АРС
export const DEFAULT_ARS_REPAIRS: ReferenceRepairItem[] = [
  { code: 'ДР', name: 'Деповской ремонт' },
  { code: 'ДР-КНР', name: 'Деповской ремонт КНР' },
  { code: 'ДРП', name: 'Деповской ремонт с продлением' },
  { code: 'КР', name: 'Капитальный ремонт' },
  { code: 'КРП', name: 'Капитальный ремонт с продлением' },
  { code: 'ТОР', name: 'Текущий отцепочный ремонт' },
  { code: 'ТОР-КНР', name: 'Текущий отцепочный ремонт КНР' },
];

export function getRepairCode(r: ReferenceRepairItem | string): string {
  return typeof r === 'string' ? r : r?.code || '';
}

export function getRepairName(r: ReferenceRepairItem | string): string {
  return typeof r === 'string' ? r : r?.name || r?.code || '';
}

export function loadInitialRepairTypes(): ReferenceRepairItem[] {
  if (typeof window === 'undefined') return DEFAULT_ARS_REPAIRS;
  try {
    const raw = localStorage.getItem('ars_ref_repairs');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      const normalized = parsed
        .map((r: ReferenceRepairItem | string) => ({
          code: getRepairCode(r),
          name: getRepairName(r),
        }))
        .filter((r) => Boolean(r.code));
      if (normalized.length > 0) {
        window.DEFAULT_ARS_REPAIRS = DEFAULT_ARS_REPAIRS;
        window.REPAIR_TYPES = normalized;
        return normalized;
      }
    }
  } catch (_e) {
    // ignore
  }
  try {
    localStorage.setItem('ars_ref_repairs', JSON.stringify(DEFAULT_ARS_REPAIRS));
  } catch (_e) {
    // ignore
  }
  window.DEFAULT_ARS_REPAIRS = DEFAULT_ARS_REPAIRS;
  window.REPAIR_TYPES = [...DEFAULT_ARS_REPAIRS];
  return DEFAULT_ARS_REPAIRS;
}

export const DEFAULT_ARS_REFERENCES: ArsReferences = {
  customers: [
    { id: 'cust-1', name: 'АО "Казтемиртранс" (КТТ)', type: 'ktt' },
    { id: 'cust-2', name: 'АО "KTZ Express"', type: 'own' },
    { id: 'cust-3', name: 'ТОО "ЦЖС" (НК КТЖ)', type: 'own' },
    { id: 'cust-4', name: 'ТОО "РТА-Транс"', type: 'own' },
    { id: 'cust-5', name: 'ТОО "ПГК Центральная Азия"', type: 'own' },
    { id: 'cust-6', name: 'ТОО "Арлан Сервис"', type: 'own' },
    { id: 'cust-7', name: 'ТОО "ALTO LOGISTICS" (ARGL)', type: 'own' },
    { id: 'cust-8', name: 'ТОО "ТрансКом"', type: 'own' },
    { id: 'cust-9', name: 'ТОО "Бизнес Тренд"', type: 'own' },
    { id: 'cust-10', name: 'ТОО "Феникс Рейл"', type: 'own' },
    { id: 'cust-11', name: 'ТОО "КСТ Логистик"', type: 'own' },
    { id: 'cust-12', name: 'ТОО "Baskho Investment Group"', type: 'own' },
    { id: 'cust-13', name: 'ТОО "VERTEX TRANS"', type: 'own' },
    { id: 'cust-14', name: 'ТОО "Джи Логистик Групп"', type: 'own' },
    { id: 'cust-15', name: 'ТОО "Про Транс Логистик"', type: 'own' },
    { id: 'cust-16', name: 'ТОО "Galinta AGRO"', type: 'own' },
    { id: 'cust-17', name: 'ТОО "ПЕТРОЛЕУМ"', type: 'own' },
    { id: 'cust-18', name: 'ТОО "РЕМ ВАГОН"', type: 'own' },
  ],
  wagonTypes: [
    { id: 'wt-1', name: 'Полувагон', code: 'gondola', workload_coefficient: 1.0 },
    { id: 'wt-2', name: 'Полувагон повышенного объёма', code: 'gondola_high', workload_coefficient: 1.15 },
    { id: 'wt-3', name: 'Крытый', code: 'boxcar', workload_coefficient: 1.05 },
    { id: 'wt-4', name: 'Зерновоз (хоппер)', code: 'grain', workload_coefficient: 1.1 },
    { id: 'wt-5', name: 'Платформа', code: 'flatcar', workload_coefficient: 0.95 },
    { id: 'wt-6', name: 'Фитинговая платформа', code: 'fitting_flatcar', workload_coefficient: 1.0 },
    { id: 'wt-7', name: 'Цистерна', code: 'tanker', workload_coefficient: 1.2 },
    { id: 'wt-8', name: 'ХДВ / Думпкар', code: 'dumpcar', workload_coefficient: 1.25 },
    { id: 'wt-9', name: 'Цементовоз', code: 'cement', workload_coefficient: 1.1 },
    { id: 'wt-10', name: 'Транспортёр', code: 'transporter', workload_coefficient: 1.3 },
  ],
  sections: [
    { id: 'sec-1', label: 'В ожидании на путях ВРД', group: 'waiting' },
    { id: 'sec-2', label: 'На станции', group: 'waiting' },
    { id: 'sec-3', label: 'На подходе к станции', group: 'directed' },
    { id: 'sec-4', label: 'Выпуск', group: 'release' },
    { id: 'sec-5', label: 'Подъемка', group: 'other' },
    { id: 'sec-6', label: 'Неоконченный ремонт', group: 'other' },
  ],
  depots: [
    { id: 'dep-1', code: 'BVRD', name: 'Балхашское вагоноремонтное депо (БВРД)', city: 'Балхаш', daily_capacity: 6 },
    { id: 'dep-2', code: 'AVRD', name: 'Арысское вагоноремонтное депо (АВРД)', city: 'Арыс', daily_capacity: 8 },
    { id: 'dep-3', code: 'KVRD', name: 'Кушмурунское вагоноремонтное депо (КВРД)', city: 'Кушмурун', daily_capacity: 7 },
    { id: 'dep-4', code: 'UVRD', name: 'Уральское вагоноремонтное депо (УВРД)', city: 'Уральск', daily_capacity: 7 },
  ],
  repairs: loadInitialRepairTypes(),
};

function getSectionGroupMeta(group: 'waiting' | 'directed' | 'release' | 'other') {
  switch (group) {
    case 'waiting':
      return {
        badgeClass: 'badge-ref badge-group-waiting',
        label: 'В ожидании ремонта («В ожидании на станции»)',
      };
    case 'directed':
      return {
        badgeClass: 'badge-ref badge-group-directed',
        label: 'Направленные / На подходе («Направленные к станции»)',
      };
    case 'release':
      return {
        badgeClass: 'badge-ref badge-group-release',
        label: 'Выпуск (сдано за смену)',
      };
    default:
      return {
        badgeClass: 'badge-ref badge-group-other',
        label: 'Прочее / Информационный статус',
      };
  }
}

export const ReferencesModal: React.FC<ReferencesModalProps> = ({
  references,
  onUpdateReferences,
  currentUser,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<RefTabId>('ref-tab-customers');
  const [isHeadOfficeRole, setIsHeadOfficeRole] = useState<boolean>(
    currentUser ? currentUser.role === 'headquarters' : true
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setIsHeadOfficeRole(currentUser.role === 'headquarters');
    }
  }, [currentUser]);

  const refsRef = useRef<ArsReferences>(references);
  useEffect(() => {
    refsRef.current = references;
  }, [references]);

  const showNotice = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const activeRepairs: ReferenceRepairItem[] =
    references.repairs && references.repairs.length > 0
      ? references.repairs
      : DEFAULT_ARS_REPAIRS;

  // 1. Отображение видов ремонта в модальном окне справочников
  const renderRefRepairsTable = useCallback(() => {
    const list: Array<ReferenceRepairItem | string> =
      window.REPAIR_TYPES && Array.isArray(window.REPAIR_TYPES) && window.REPAIR_TYPES.length > 0
        ? window.REPAIR_TYPES
        : refsRef.current.repairs && refsRef.current.repairs.length > 0
        ? refsRef.current.repairs
        : DEFAULT_ARS_REPAIRS;

    const countBadge = document.getElementById('count-repairs');
    if (countBadge) countBadge.textContent = String(list.length);
  }, []);

  const openReferencesModal = useCallback(() => {
    setIsOpen(true);
    const el = document.getElementById('modalReferences');
    if (el) el.style.display = 'flex';
    setTimeout(() => {
      renderRefRepairsTable();
    }, 0);
  }, [renderRefRepairsTable]);

  const closeReferencesModal = useCallback(() => {
    setIsOpen(false);
    const el = document.getElementById('modalReferences');
    if (el) el.style.display = 'none';
  }, []);

  const switchRefTab = useCallback((tabId: string) => {
    if (
      tabId === 'ref-tab-customers' ||
      tabId === 'ref-tab-wagons' ||
      tabId === 'ref-tab-sections' ||
      tabId === 'ref-tab-depots' ||
      tabId === 'ref-tab-repairs'
    ) {
      setActiveTab(tabId);
    }
  }, []);

  const handleAddCustomer = useCallback(() => {
    const inputEl = document.getElementById('newCustomerInput') as HTMLInputElement | null;
    const selectEl = document.getElementById('newCustomerTypeSelect') as HTMLSelectElement | null;
    const name = inputEl ? inputEl.value.trim() : '';
    const typeVal = (selectEl?.value === 'ktt' ? 'ktt' : 'own') as 'own' | 'ktt';

    if (!name) {
      showNotice('Введите наименование заказчика / предприятия');
      inputEl?.focus();
      return;
    }

    const current = refsRef.current;
    if (current.customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showNotice(`Предприятие «${name}» уже присутствует в справочнике`);
      return;
    }

    const updated: ArsReferences = {
      ...current,
      customers: [
        ...current.customers,
        {
          id: `cust-${Date.now()}`,
          name,
          type: typeVal,
        },
      ],
    };

    onUpdateReferences(updated);
    if (inputEl) inputEl.value = '';
    showNotice(`Добавлен заказчик: ${name}`);
  }, [onUpdateReferences, showNotice]);

  const handleAddWagonType = useCallback(() => {
    const inputEl = document.getElementById('newWagonTypeInput') as HTMLInputElement | null;
    const name = inputEl ? inputEl.value.trim() : '';

    if (!name) {
      showNotice('Введите наименование рода вагона');
      inputEl?.focus();
      return;
    }

    const current = refsRef.current;
    if (current.wagonTypes.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      showNotice(`Род вагона «${name}» уже есть в справочнике`);
      return;
    }

    const updated: ArsReferences = {
      ...current,
      wagonTypes: [
        ...current.wagonTypes,
        {
          id: `wt-${Date.now()}`,
          name,
          code: name.toLowerCase().replace(/\s+/g, '_'),
          workload_coefficient: 1.0,
        },
      ],
    };

    onUpdateReferences(updated);
    if (inputEl) inputEl.value = '';
    showNotice(`Добавлен род вагона: ${name}`);
  }, [onUpdateReferences, showNotice]);

  const handleAddSection = useCallback(() => {
    const inputEl = document.getElementById('newSectionLabelInput') as HTMLInputElement | null;
    const selectEl = document.getElementById('newSectionGroupSelect') as HTMLSelectElement | null;
    const label = inputEl ? inputEl.value.trim() : '';
    const groupVal = (selectEl?.value || 'waiting') as 'waiting' | 'directed' | 'release' | 'other';

    if (!label) {
      showNotice('Введите название статуса или раздела');
      inputEl?.focus();
      return;
    }

    const current = refsRef.current;
    if (current.sections.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      showNotice(`Статус «${label}» уже существует в справочнике`);
      return;
    }

    const updated: ArsReferences = {
      ...current,
      sections: [
        ...current.sections,
        {
          id: `sec-${Date.now()}`,
          label,
          group: groupVal,
        },
      ],
    };

    onUpdateReferences(updated);
    if (inputEl) inputEl.value = '';
    showNotice(`Добавлен статус: ${label}`);
  }, [onUpdateReferences, showNotice]);

  const handleAddDepot = useCallback(() => {
    if (!isHeadOfficeRole) {
      showNotice('Добавление депо доступно только сотрудникам Головного офиса (Астана)');
      return;
    }

    const codeEl = document.getElementById('newDepotCodeInput') as HTMLInputElement | null;
    const nameEl = document.getElementById('newDepotNameInput') as HTMLInputElement | null;
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    const name = nameEl ? nameEl.value.trim() : '';

    if (!code || !name) {
      showNotice('Заполните код депо и полное наименование филиала');
      if (!code) codeEl?.focus();
      else nameEl?.focus();
      return;
    }

    const current = refsRef.current;
    if (current.depots.some((d) => d.code.toUpperCase() === code)) {
      showNotice(`Депо с кодом ${code} уже зарегистрировано`);
      return;
    }

    const updated: ArsReferences = {
      ...current,
      depots: [
        ...current.depots,
        {
          id: `dep-${Date.now()}`,
          code,
          name,
          city: name.split(' ')[0] || code,
          daily_capacity: 7,
        },
      ],
    };

    onUpdateReferences(updated);
    if (codeEl) codeEl.value = '';
    if (nameEl) nameEl.value = '';
    showNotice(`Добавлен филиал ${code} (логин: ${code.toLowerCase()}, пароль: ${code.toLowerCase()}2026)`);
  }, [isHeadOfficeRole, onUpdateReferences, showNotice]);

  const handleDeleteCustomer = useCallback(
    (id: string) => {
      const current = refsRef.current;
      onUpdateReferences({
        ...current,
        customers: current.customers.filter((c) => c.id !== id),
      });
    },
    [onUpdateReferences]
  );

  const handleDeleteWagonType = useCallback(
    (id: string) => {
      const current = refsRef.current;
      onUpdateReferences({
        ...current,
        wagonTypes: current.wagonTypes.filter((w) => w.id !== id),
      });
    },
    [onUpdateReferences]
  );

  const handleDeleteSection = useCallback(
    (id: string) => {
      const current = refsRef.current;
      onUpdateReferences({
        ...current,
        sections: current.sections.filter((s) => s.id !== id),
      });
    },
    [onUpdateReferences]
  );

  const handleDeleteDepot = useCallback(
    (id: string) => {
      if (!isHeadOfficeRole) return;
      const current = refsRef.current;
      onUpdateReferences({
        ...current,
        depots: current.depots.filter((d) => d.id !== id),
      });
    },
    [isHeadOfficeRole, onUpdateReferences]
  );

  // 2. Добавление нового вида ремонта
  const handleAddRepairType = useCallback(() => {
    const codeInput = document.getElementById('newRepairCodeInput') as HTMLInputElement | null;
    const nameInput = document.getElementById('newRepairNameInput') as HTMLInputElement | null;
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    const name = nameInput ? nameInput.value.trim() : code;

    if (!code) {
      showNotice('Пожалуйста, введите код ремонта (например: КР-КНР)');
      window.showToast?.('Пожалуйста, введите код ремонта (например: КР-КНР)');
      codeInput?.focus();
      return;
    }

    const current = refsRef.current;
    const currentRepairs =
      current.repairs && current.repairs.length > 0 ? current.repairs : DEFAULT_ARS_REPAIRS;

    const exists = currentRepairs.some((r) => getRepairCode(r).toUpperCase() === code);
    if (exists) {
      showNotice(`Вид ремонта "${code}" уже есть в справочнике!`);
      window.showToast?.(`Вид ремонта "${code}" уже есть в справочнике!`);
      return;
    }

    const nextRepairs: ReferenceRepairItem[] = [
      ...currentRepairs,
      { code, name: name || code },
    ];

    window.REPAIR_TYPES = nextRepairs;
    try {
      localStorage.setItem('ars_ref_repairs', JSON.stringify(nextRepairs));
    } catch (_e) {
      // ignore
    }

    onUpdateReferences({
      ...current,
      repairs: nextRepairs,
    });

    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';

    // Обновляем справочник, строки матрицы и выпадающие списки в вагонах
    setTimeout(() => {
      renderRefRepairsTable();
      window.renderBranchMatrixTable?.();
      window.updateAllWagonRepairSelects?.();
    }, 10);

    showNotice(`Добавлен вид ремонта: ${code} (${name || code})`);
    window.logSystemAction?.(
      '⚙️ Справочники',
      `Добавлен новый вид ремонта: ${code} (${name || code})`
    );
  }, [onUpdateReferences, renderRefRepairsTable, showNotice]);

  // 3. Удаление вида ремонта
  const handleDeleteRepairType = useCallback(
    (code: string) => {
      const current = refsRef.current;
      const currentRepairs =
        current.repairs && current.repairs.length > 0 ? current.repairs : DEFAULT_ARS_REPAIRS;

      if (currentRepairs.length <= 1) {
        showNotice('В справочнике должен оставаться хотя бы один вид ремонта!');
        window.showToast?.('В справочнике должен оставаться хотя бы один вид ремонта!');
        return;
      }

      const t0 = performance.now();
      let confirmed = true;
      try {
        confirmed = window.confirm(`Удалить вид ремонта "${code}" из справочника?`);
      } catch (_e) {
        confirmed = true;
      }
      const elapsed = performance.now() - t0;
      if (!confirmed && elapsed >= 15) return;

      const nextRepairs = currentRepairs.filter(
        (r) => getRepairCode(r).toUpperCase() !== code.toUpperCase()
      );

      window.REPAIR_TYPES = nextRepairs;
      try {
        localStorage.setItem('ars_ref_repairs', JSON.stringify(nextRepairs));
      } catch (_e) {
        // ignore
      }

      onUpdateReferences({
        ...current,
        repairs: nextRepairs,
      });

      setTimeout(() => {
        renderRefRepairsTable();
        window.renderBranchMatrixTable?.();
        window.updateAllWagonRepairSelects?.();
      }, 10);

      showNotice(`Удалён вид ремонта: ${code}`);
      window.logSystemAction?.('⚙️ Справочники', `Удалён вид ремонта: ${code}`);
    },
    [onUpdateReferences, renderRefRepairsTable, showNotice]
  );

  // Synchronize window.REPAIR_TYPES with references.repairs
  useEffect(() => {
    window.DEFAULT_ARS_REPAIRS = DEFAULT_ARS_REPAIRS;
    window.REPAIR_TYPES = activeRepairs;
    window.getRepairCode = getRepairCode;
    window.getRepairName = getRepairName;
    try {
      localStorage.setItem('ars_ref_repairs', JSON.stringify(activeRepairs));
    } catch (_e) {
      // ignore
    }
  }, [activeRepairs]);

  // Register global functions on window and synchronize exact inline onclick attributes
  useEffect(() => {
    window.openReferencesModal = openReferencesModal;
    window.closeReferencesModal = closeReferencesModal;
    window.switchRefTab = switchRefTab;
    window.handleAddCustomer = handleAddCustomer;
    window.handleAddWagonType = handleAddWagonType;
    window.handleAddSection = handleAddSection;
    window.handleAddDepot = handleAddDepot;
    window.handleDeleteCustomer = handleDeleteCustomer;
    window.handleDeleteWagonType = handleDeleteWagonType;
    window.handleDeleteSection = handleDeleteSection;
    window.handleDeleteDepot = handleDeleteDepot;
    window.renderRefRepairsTable = renderRefRepairsTable;
    window.handleAddRepairType = handleAddRepairType;
    window.handleDeleteRepairType = handleDeleteRepairType;

    const modalEl = document.getElementById('modalReferences');
    if (modalEl) {
      modalEl.setAttribute('onclick', 'if(event.target === this) closeReferencesModal();');
      const closeBtn = modalEl.querySelector('.modal-close');
      if (closeBtn) closeBtn.setAttribute('onclick', 'closeReferencesModal()');

      const tabBtns = modalEl.querySelectorAll('.modal-tab-btn');
      tabBtns.forEach((btn) => {
        const tabId = btn.getAttribute('data-ref-tab');
        if (tabId) btn.setAttribute('onclick', `switchRefTab('${tabId}')`);
      });
    }
  }, [
    openReferencesModal,
    closeReferencesModal,
    switchRefTab,
    handleAddCustomer,
    handleAddWagonType,
    handleAddSection,
    handleAddDepot,
    handleDeleteCustomer,
    handleDeleteWagonType,
    handleDeleteSection,
    handleDeleteDepot,
    renderRefRepairsTable,
    handleAddRepairType,
    handleDeleteRepairType,
  ]);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeReferencesModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeReferencesModal]);

  const modalMarkup = (
    <div
      id="modalReferences"
      className="modal-backdrop"
      style={{ display: isOpen ? 'flex' : 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeReferencesModal();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">
            <span>⚙️ Управление справочниками АРС</span>
            {statusMessage && (
              <span className="text-xs font-normal text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                {statusMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Индикатор и переключатель роли Головного офиса / Филиала */}
            {currentUser?.role === 'branch' ? (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                🔒 Режим филиала: {currentUser.depot_code}
              </span>
            ) : (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsHeadOfficeRole(true)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    isHeadOfficeRole ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Режим сотрудника Головного офиса (Астана / Администратор)"
                >
                  Головной офис (Астана)
                </button>
                <button
                  type="button"
                  onClick={() => setIsHeadOfficeRole(false)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    !isHeadOfficeRole ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Режим сотрудника филиала депо (чтение депо)"
                >
                  Филиал депо
                </button>
              </div>
            )}
            <button
              type="button"
              className="modal-close"
              onClick={closeReferencesModal}
              title="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Вкладки справочника */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'ref-tab-customers' ? 'active' : ''}`}
            data-ref-tab="ref-tab-customers"
            onClick={() => switchRefTab('ref-tab-customers')}
          >
            🏢 Заказчики / Предприятия{' '}
            <span className="badge-count" id="count-customers">
              {references.customers.length}
            </span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'ref-tab-wagons' ? 'active' : ''}`}
            data-ref-tab="ref-tab-wagons"
            onClick={() => switchRefTab('ref-tab-wagons')}
          >
            🚂 Рода вагонов{' '}
            <span className="badge-count" id="count-wagons">
              {references.wagonTypes.length}
            </span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'ref-tab-sections' ? 'active' : ''}`}
            data-ref-tab="ref-tab-sections"
            onClick={() => switchRefTab('ref-tab-sections')}
          >
            📋 Разделы и статусы{' '}
            <span className="badge-count" id="count-sections">
              {references.sections.length}
            </span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'ref-tab-depots' ? 'active' : ''}`}
            data-ref-tab="ref-tab-depots"
            onClick={() => switchRefTab('ref-tab-depots')}
          >
            🏭 Депо / Филиалы{' '}
            <span className="badge-count" id="count-depots">
              {references.depots.length}
            </span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'ref-tab-repairs' ? 'active' : ''}`}
            data-ref-tab="ref-tab-repairs"
            onClick={() => switchRefTab('ref-tab-repairs')}
          >
            🛠️ Виды ремонта{' '}
            <span className="badge-count" id="count-repairs">
              {activeRepairs.length}
            </span>
          </button>
        </div>

        <div className="modal-body">
          {/* Вкладка 1: Заказчики / Предприятия */}
          <div
            id="ref-tab-customers"
            className={`modal-tab-panel ${activeTab === 'ref-tab-customers' ? 'active' : ''}`}
          >
            <div className="ref-form-box">
              <div className="ref-form-group" style={{ flex: 3, minWidth: '220px' }}>
                <label htmlFor="newCustomerInput">Наименование заказчика / предприятия:</label>
                <input
                  type="text"
                  id="newCustomerInput"
                  placeholder='Например: ТОО "КазТрансСервис"'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomer();
                    }
                  }}
                />
              </div>
              <div className="ref-form-group" style={{ flex: 2, maxWidth: '240px' }}>
                <label htmlFor="newCustomerTypeSelect">Тип (принадлежность парка):</label>
                <select id="newCustomerTypeSelect" defaultValue="own">
                  <option value="own">Собственник (частный парк)</option>
                  <option value="ktt">КТТ (АО "Казтемиртранс")</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddCustomer}>
                ➕ Добавить в список
              </button>
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="ref-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>№</th>
                    <th>Наименование предприятия</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Тип</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Удалить</th>
                  </tr>
                </thead>
                <tbody id="refCustomersBody">
                  {references.customers.map((c, index) => (
                    <tr key={c.id}>
                      <td className="font-mono tabular-nums text-slate-500">{index + 1}</td>
                      <td className="font-medium text-slate-900">{c.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        {c.type === 'ktt' ? (
                          <span className="badge-ref badge-group-waiting">КТТ</span>
                        ) : (
                          <span className="badge-ref badge-group-other">Собственник</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-delete-ref"
                          onClick={() => handleDeleteCustomer(c.id)}
                          title="Удалить предприятие"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 2: Рода вагонов */}
          <div
            id="ref-tab-wagons"
            className={`modal-tab-panel ${activeTab === 'ref-tab-wagons' ? 'active' : ''}`}
          >
            <div className="ref-form-box">
              <div className="ref-form-group" style={{ flex: 3 }}>
                <label htmlFor="newWagonTypeInput">Наименование рода вагона:</label>
                <input
                  type="text"
                  id="newWagonTypeInput"
                  placeholder="Например: Лесовоз, Автовоз, Бункер"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddWagonType();
                    }
                  }}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddWagonType}>
                ➕ Добавить род вагона
              </button>
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="ref-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>№</th>
                    <th>Род вагона</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Удалить</th>
                  </tr>
                </thead>
                <tbody id="refWagonTypesBody">
                  {references.wagonTypes.map((w, index) => (
                    <tr key={w.id}>
                      <td className="font-mono tabular-nums text-slate-500">{index + 1}</td>
                      <td className="font-medium text-slate-900">{w.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-delete-ref"
                          onClick={() => handleDeleteWagonType(w.id)}
                          title="Удалить род вагона"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 3: Разделы и статусы */}
          <div
            id="ref-tab-sections"
            className={`modal-tab-panel ${activeTab === 'ref-tab-sections' ? 'active' : ''}`}
          >
            <div className="ref-form-box">
              <div className="ref-form-group" style={{ flex: 2 }}>
                <label htmlFor="newSectionLabelInput">Название статуса / раздела:</label>
                <input
                  type="text"
                  id="newSectionLabelInput"
                  placeholder="Например: В ПУТИ НА РЕМОНТ"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSection();
                    }
                  }}
                />
              </div>
              <div className="ref-form-group" style={{ flex: 2 }}>
                <label htmlFor="newSectionGroupSelect">Группа для сводки (Таблица 1):</label>
                <select id="newSectionGroupSelect" defaultValue="waiting">
                  <option value="waiting">В ожидании ремонта (колонка «В ожидании на станции»)</option>
                  <option value="directed">Направленные / На подходе (колонка «Направленные к станции»)</option>
                  <option value="release">Выпуск (сдано за смену)</option>
                  <option value="other">Прочее / Информационный статус</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddSection}>
                ➕ Добавить статус
              </button>
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="ref-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>№</th>
                    <th>Статус / Раздел</th>
                    <th>Группа в Таблице 1</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Удалить</th>
                  </tr>
                </thead>
                <tbody id="refSectionsBody">
                  {references.sections.map((s, index) => {
                    const meta = getSectionGroupMeta(s.group);
                    return (
                      <tr key={s.id}>
                        <td className="font-mono tabular-nums text-slate-500">{index + 1}</td>
                        <td className="font-medium text-slate-900">{s.label}</td>
                        <td>
                          <span className={meta.badgeClass}>{meta.label}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-delete-ref"
                            onClick={() => handleDeleteSection(s.id)}
                            title="Удалить статус"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 4: Депо / Филиалы (только для Головного офиса) */}
          <div
            id="ref-tab-depots"
            className={`modal-tab-panel ${activeTab === 'ref-tab-depots' ? 'active' : ''}`}
          >
            <div
              id="depotLockNotice"
              style={{
                display: isHeadOfficeRole ? 'none' : 'block',
                padding: '12px 16px',
                marginBottom: '14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#991B1B',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              🔒 Добавление и удаление филиалов депо доступно только сотрудникам головного офиса (Астана / Администратор).
            </div>

            <div
              id="depotAddFormBox"
              className="ref-form-box"
              style={{ display: isHeadOfficeRole ? 'flex' : 'none' }}
            >
              <div className="ref-form-group" style={{ flex: 1, maxWidth: '140px' }}>
                <label htmlFor="newDepotCodeInput">Код депо (4 буквы):</label>
                <input
                  type="text"
                  id="newDepotCodeInput"
                  placeholder="PVRD"
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="ref-form-group" style={{ flex: 3 }}>
                <label htmlFor="newDepotNameInput">Полное наименование филиала:</label>
                <input
                  type="text"
                  id="newDepotNameInput"
                  placeholder="Например: Павлодарское ВРД (ПВРД)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDepot();
                    }
                  }}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddDepot}>
                ➕ Добавить депо
              </button>
            </div>

            <p
              id="depotAddHint"
              style={{
                display: isHeadOfficeRole ? 'block' : 'none',
                fontSize: '12px',
                opacity: 0.7,
                marginBottom: '12px',
              }}
            >
              💡 При добавлении филиала создаётся учётная запись мастера: логин <code>[код]</code>, пароль <code>[код]2026</code>.
            </p>

            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="ref-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>№</th>
                    <th style={{ width: '110px' }}>Код</th>
                    <th>Наименование филиала</th>
                    <th
                      id="depotDeleteHeader"
                      style={{
                        width: '70px',
                        textAlign: 'center',
                        display: isHeadOfficeRole ? 'table-cell' : 'none',
                      }}
                    >
                      Удалить
                    </th>
                  </tr>
                </thead>
                <tbody id="refDepotsBody">
                  {references.depots.map((d, index) => (
                    <tr key={d.id}>
                      <td className="font-mono tabular-nums text-slate-500">{index + 1}</td>
                      <td className="font-mono font-bold text-slate-900">{d.code}</td>
                      <td className="font-medium text-slate-900">{d.name}</td>
                      <td
                        style={{
                          textAlign: 'center',
                          display: isHeadOfficeRole ? 'table-cell' : 'none',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-delete-ref"
                          onClick={() => handleDeleteDepot(d.id)}
                          title="Удалить филиал"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Вкладка 5: Виды ремонта / работ */}
          <div
            id="ref-tab-repairs"
            className={`modal-tab-panel ${activeTab === 'ref-tab-repairs' ? 'active' : ''}`}
          >
            <div
              className="ref-form-box"
              style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '14px',
                background: '#F8FAFC',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #DCE2EB',
                flexWrap: 'wrap',
              }}
            >
              <div className="ref-form-group" style={{ flex: 1, minWidth: '140px' }}>
                <label
                  htmlFor="newRepairCodeInput"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748B',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Код ремонта:
                </label>
                <input
                  type="text"
                  id="newRepairCodeInput"
                  placeholder="Например: КР-КНР, ТО-3"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #DCE2EB',
                    borderRadius: '4px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRepairType();
                    }
                  }}
                />
              </div>
              <div className="ref-form-group" style={{ flex: 2, minWidth: '220px' }}>
                <label
                  htmlFor="newRepairNameInput"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748B',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Полное наименование:
                </label>
                <input
                  type="text"
                  id="newRepairNameInput"
                  placeholder="Например: Капитальный ремонт КНР"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #DCE2EB',
                    borderRadius: '4px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRepairType();
                    }
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    background: '#1B365D',
                    color: 'white',
                    padding: '9px 14px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={handleAddRepairType}
                >
                  ➕ Добавить вид ремонта
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="ref-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    <th style={{ width: '50px', padding: '8px' }}>№</th>
                    <th style={{ width: '140px', padding: '8px' }}>Код ремонта</th>
                    <th style={{ padding: '8px' }}>Полное наименование</th>
                    <th style={{ width: '70px', textAlign: 'center', padding: '8px' }}>Удалить</th>
                  </tr>
                </thead>
                <tbody id="refRepairsBody">
                  {activeRepairs.map((r, idx) => {
                    const code = getRepairCode(r);
                    const name = getRepairName(r);
                    return (
                      <tr key={code || idx} style={{ borderBottom: '1px solid #DCE2EB' }}>
                        <td style={{ color: '#64748B', fontWeight: 600, padding: '8px' }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 800, color: '#1B365D', padding: '8px' }}>
                          {code}
                        </td>
                        <td style={{ padding: '8px', color: '#0F172A' }}>{name}</td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <button
                            type="button"
                            className="btn-remove"
                            style={{
                              color: '#E74C3C',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                            title="Удалить вид ремонта"
                            onClick={() => handleDeleteRepairType(code)}
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
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalMarkup, document.body) : modalMarkup;
};
