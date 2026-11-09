import { PlatformUserAccount, PermissionCode } from '../../types/platform';
import { ArsReferences } from '../../types/ars';

const ALL_PERMISSIONS: PermissionCode[] = [
  'VIEW_EXECUTIVE_DASHBOARD',
  'VIEW_HOLDING_PRODUCTION',
  'VIEW_BRANCH_PRODUCTION',
  'EDIT_DAILY_SHIFT',
  'MANAGE_REFERENCES',
  'VIEW_AUDIT_LOGS',
  'EXPORT_REPORTS',
  'AI_ANALYST_ACCESS',
  'MODULE_ACCESS_EXECUTIVE',
  'MODULE_ACCESS_PRODUCTION',
  'MODULE_ACCESS_FINANCE',
  'MODULE_ACCESS_LEGAL',
  'MODULE_ACCESS_HR',
  'MODULE_ACCESS_PROCUREMENT',
  'MODULE_ACCESS_LOGISTICS',
];

const PRODUCTION_HQ_PERMISSIONS: PermissionCode[] = [
  'VIEW_EXECUTIVE_DASHBOARD',
  'VIEW_HOLDING_PRODUCTION',
  'VIEW_BRANCH_PRODUCTION',
  'EDIT_DAILY_SHIFT',
  'MANAGE_REFERENCES',
  'VIEW_AUDIT_LOGS',
  'EXPORT_REPORTS',
  'AI_ANALYST_ACCESS',
  'MODULE_ACCESS_EXECUTIVE',
  'MODULE_ACCESS_PRODUCTION',
];

const BRANCH_PERMISSIONS: PermissionCode[] = [
  'VIEW_BRANCH_PRODUCTION',
  'EDIT_DAILY_SHIFT',
  'AI_ANALYST_ACCESS',
  'EXPORT_REPORTS',
  'MODULE_ACCESS_PRODUCTION',
];

export const PLATFORM_ACCOUNTS: Record<string, PlatformUserAccount> = {
  // Высшее руководство холдинга
  director: {
    username: 'director',
    password: 'ars2026',
    displayName: 'Мамаев А. К.',
    department: 'management',
    departmentName: 'Высшее руководство и Правление',
    position: 'Генеральный директор',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: ALL_PERMISSIONS,
    availableModules: ['executive', 'production', 'finance', 'procurement', 'legal', 'hr', 'logistics'],
  },
  chief_eng: {
    username: 'chief_eng',
    password: 'ars2026',
    displayName: 'Искаков Т. Б.',
    department: 'management',
    departmentName: 'Главный инженерный корпус',
    position: 'Главный инженер холдинга',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: PRODUCTION_HQ_PERMISSIONS,
    availableModules: ['executive', 'production', 'procurement'],
  },

  // Производственный отдел (ЦА)
  astana: {
    username: 'astana',
    password: 'ars2026',
    displayName: 'Ахметов Н. С.',
    department: 'production',
    departmentName: 'Производственно-диспетчерский отдел (ПДО)',
    position: 'Начальник ПДО',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: PRODUCTION_HQ_PERMISSIONS,
    availableModules: ['executive', 'production'],
  },
  technologist: {
    username: 'technologist',
    password: 'ars2026',
    displayName: 'Сулейменов Б. М.',
    department: 'production',
    departmentName: 'Производственно-диспетчерский отдел (ПДО)',
    position: 'Ведущий технолог по ремонту вагонов',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: PRODUCTION_HQ_PERMISSIONS,
    availableModules: ['production'],
  },

  // Филиалы (ВРД) — изолированный контур своего предприятия
  kushmurun: {
    username: 'kushmurun',
    password: 'kush2026',
    displayName: 'Ибраев К. С.',
    department: 'production',
    departmentName: 'Кушмурунское вагоноремонтное депо',
    position: 'Директор филиала КВРД',
    branchCode: 'KVRD',
    role: 'branch',
    dataScope: 'BRANCH_ISOLATED',
    permissions: BRANCH_PERMISSIONS,
    availableModules: ['production'],
  },
  arys: {
    username: 'arys',
    password: 'arys2026',
    displayName: 'Бекболатов Е. М.',
    department: 'production',
    departmentName: 'Арысское вагоноремонтное депо',
    position: 'Директор филиала АВРД',
    branchCode: 'AVRD',
    role: 'branch',
    dataScope: 'BRANCH_ISOLATED',
    permissions: BRANCH_PERMISSIONS,
    availableModules: ['production'],
  },
  balkhash: {
    username: 'balkhash',
    password: 'balkh2026',
    displayName: 'Жумагулов А. Д.',
    department: 'production',
    departmentName: 'Балхашское вагоноремонтное депо',
    position: 'Директор филиала БВРД',
    branchCode: 'BVRD',
    role: 'branch',
    dataScope: 'BRANCH_ISOLATED',
    permissions: BRANCH_PERMISSIONS,
    availableModules: ['production'],
  },
  uralsk: {
    username: 'uralsk',
    password: 'ural2026',
    displayName: 'Сапаров Д. Н.',
    department: 'production',
    departmentName: 'Уральское вагоноремонтное депо',
    position: 'Директор филиала УВРД',
    branchCode: 'UVRD',
    role: 'branch',
    dataScope: 'BRANCH_ISOLATED',
    permissions: BRANCH_PERMISSIONS,
    availableModules: ['production'],
  },

  // Смежные подразделения холдинга (готовы к масштабированию платформы)
  fin_dir: {
    username: 'fin_dir',
    password: 'fin2026',
    displayName: 'Касымова А. Т.',
    department: 'finance',
    departmentName: 'Финансово-экономическое управление',
    position: 'Финансовый директор',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: [
      'VIEW_EXECUTIVE_DASHBOARD',
      'MODULE_ACCESS_EXECUTIVE',
      'MODULE_ACCESS_FINANCE',
      'VIEW_AUDIT_LOGS',
    ],
    availableModules: ['executive', 'finance'],
  },
  lawyer: {
    username: 'lawyer',
    password: 'law2026',
    displayName: 'Абдрахманов М. Р.',
    department: 'legal',
    departmentName: 'Юридическая служба',
    position: 'Главный юрисконсульт',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: [
      'VIEW_EXECUTIVE_DASHBOARD',
      'MODULE_ACCESS_EXECUTIVE',
      'MODULE_ACCESS_LEGAL',
      'VIEW_AUDIT_LOGS',
    ],
    availableModules: ['executive', 'legal'],
  },
  hr_lead: {
    username: 'hr_lead',
    password: 'hr2026',
    displayName: 'Нурланова Г. К.',
    department: 'hr',
    departmentName: 'Управление по работе с персоналом',
    position: 'Директор по персоналу (HRD)',
    branchCode: 'ALL',
    role: 'headquarters',
    dataScope: 'HOLDING_ALL',
    permissions: [
      'VIEW_EXECUTIVE_DASHBOARD',
      'MODULE_ACCESS_EXECUTIVE',
      'MODULE_ACCESS_HR',
      'VIEW_AUDIT_LOGS',
    ],
    availableModules: ['executive', 'hr'],
  },
};

export function buildEffectivePlatformUsers(
  references: ArsReferences
): Record<string, PlatformUserAccount> {
  const combined: Record<string, PlatformUserAccount> = { ...PLATFORM_ACCOUNTS };

  const existingDepotCodes = new Set(
    Object.values(PLATFORM_ACCOUNTS).map((u) => u.branchCode.toUpperCase())
  );

  for (const dep of references.depots) {
    const upperCode = dep.code.trim().toUpperCase();
    const lowerCode = dep.code.trim().toLowerCase();
    if (!lowerCode) continue;

    if (!existingDepotCodes.has(upperCode) && !combined[lowerCode]) {
      combined[lowerCode] = {
        username: lowerCode,
        password: `${lowerCode}2026`,
        displayName: `Директор ${upperCode}`,
        department: 'production',
        departmentName: dep.name || `Вагоноремонтное депо ${upperCode}`,
        position: `Директор филиала ${upperCode}`,
        branchCode: upperCode,
        role: 'branch',
        dataScope: 'BRANCH_ISOLATED',
        permissions: BRANCH_PERMISSIONS,
        availableModules: ['production'],
      };
    }
  }

  return combined;
}
