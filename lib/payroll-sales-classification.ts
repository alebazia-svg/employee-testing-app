export type PayrollSalesSourceRow = {
  manager: string;
  client: string;
  category: string;
  item: string;
  registrar: string;
  registrars: string[];
  revenue: number;
  cost: number;
  grossProfit: number;
  profitability: number;
  sourceCostReviewRows?: number;
  sourceCostCalculationPendingRows?: number;
};

type CellValue = string | number | boolean | Date | null | undefined;
type SalesRow = PayrollSalesSourceRow;
type Department = 'Опт' | 'Розница';
export type PayrollCalculationType =
  | 'WHOLESALE_EXCLUDED_TECH' | 'WHOLESALE_REVIEW_TECH' | 'WHOLESALE_INCLUDED_1_75'
  | 'CREDIT_GROSS_PROFIT' | 'CREDIT_ACCESSORY_NO_BONUS' | 'CREDIT_REVIEW_NO_BONUS'
  | 'RETAIL_REVIEW_TECH' | 'RETAIL_FILM_50' | 'RETAIL_PLOTTER_MATERIAL_COST_50'
  | 'RETAIL_GROSS_PROFIT_10' | 'RETAIL_ACCESSORY_5' | 'MANUAL_EXCLUDED';
type CalculationType = PayrollCalculationType;
export type PayrollSalesClassificationRule = {
  id: number; title: string | null; isActive: boolean; priority: number;
  matchType: 'EXACT_ITEM' | 'CONTAINS_ITEM' | 'CATEGORY' | 'CATEGORY_AND_CONTAINS_ITEM' | 'ARTICLE';
  itemText: string | null; categoryText: string | null; article: string | null;
  department: 'all' | 'retail' | 'wholesale' | string | null;
  saleContext: 'all' | 'credit' | 'regular' | string | null;
  targetCalculationType: CalculationType | 'REVIEW_ONLY'; reason: string | null;
  createdAt?: string; updatedAt?: string;
};
type PayrollClassificationRule = PayrollSalesClassificationRule;
export type PayrollClassifiedSalesRow = SalesRow & {
  department: Department; calculationType: CalculationType; calculationLabel: string; article: string;
  base: number; percent: number; bonus: number; formula: string; includedInWholesaleBase: boolean | null;
  classificationReason: string; matchedRule: string; isCreditSale: boolean;
  creditProductType: 'tech' | 'accessory' | 'review' | null; creditIncludedInBonus: boolean;
};
type ClassifiedSalesRow = PayrollClassifiedSalesRow;
export type PayrollManagerBonusSummary = {
  manager: string; department: Department; revenue: number; grossProfit: number;
  creditBonus: number; filmBonus: number; plotterBonus: number; techBonus: number;
  accessoryBonus: number; wholesaleBonus: number; totalBonus: number;
};
type BonusManagerSummary = PayrollManagerBonusSummary;
type CalculationTypeSummary = { type: CalculationType; label: string; rows: number; revenue: number; grossProfit: number; base: number; formula: string; bonus: number };
type WholesaleCalculation = { zalinaRevenue: number; lianaRevenue: number; totalRevenue: number; excludedTechRevenue: number; base: number; bonusEach: number };
export type PayrollSalesClassificationResult = {
  rows: ClassifiedSalesRow[]; wholesale: WholesaleCalculation; typeSummaries: CalculationTypeSummary[];
  managerSummaries: BonusManagerSummary[]; disputedRows: ClassifiedSalesRow[]; accessoryExcludedRows: ClassifiedSalesRow[];
  expensiveReviewRows: ClassifiedSalesRow[];
  counts: { total: number; wholesale: number; retail: number; credit: number; film: number; retailTech: number; accessory: number; wholesaleExcludedTech: number };
};
type ClassificationResult = PayrollSalesClassificationResult;

function normalizeText(value: CellValue) {
  return String(value ?? '').toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
}
const asadManagerName = 'Икаев Асад';
const retailTraineePayrollName = 'Костеренко Магомед';
const legacyRetailTraineeSourceName = 'СтажерРозница';
const payrollExcludedEmployeeNames = ['Кештова Аслан', 'Кештова Амир', 'Кештов Аслан', 'Кештов Амир', 'Атабиева Муслим', 'Атабиев Муслим'];
const payrollExcludedEmployeeKeys = new Set(payrollExcludedEmployeeNames.map(normalizeText));
const payrollManagerAliases: Record<string, string> = {
  [normalizeText('Косторенко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Косторенко')]: retailTraineePayrollName,
  [normalizeText('Костеренко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костеренко')]: retailTraineePayrollName,
  [normalizeText('Костенко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костенко')]: retailTraineePayrollName,
  [normalizeText('Костанко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костанко')]: retailTraineePayrollName,
  [normalizeText('Костаренко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костаренко')]: retailTraineePayrollName,
};
function getPayrollManagerName(manager: string) {
  const normalized = normalizeText(manager);
  if (normalized.includes('магомед') && /(косторенко|костеренко|костенко|костанко|костаренко)/.test(normalized)) return retailTraineePayrollName;
  return payrollManagerAliases[normalized] ?? manager;
}
export function getPayrollSalesManagerNameForPeriod(manager: string, periodKey: string) {
  if (normalizeText(manager) === normalizeText(legacyRetailTraineeSourceName)) {
    return periodKey === '2026-06' ? retailTraineePayrollName : null;
  }
  return getPayrollManagerName(manager);
}
function isPayrollExcludedEmployee(manager: string) { return payrollExcludedEmployeeKeys.has(normalizeText(getPayrollManagerName(manager))); }
const wholesaleManagers = ['Ахобекова Залина', 'Хурзокова Лиана'];
const calculationLabels: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'Опт: исключённая техника', WHOLESALE_REVIEW_TECH: 'Опт: спорная техника', WHOLESALE_INCLUDED_1_75: 'Опт: база 1.75%',
  CREDIT_GROSS_PROFIT: 'Кредит: ВП × 0.91 × 10%', CREDIT_ACCESSORY_NO_BONUS: 'Кредитный аксессуар', CREDIT_REVIEW_NO_BONUS: 'Кредит: требуется классификация',
  RETAIL_REVIEW_TECH: 'Розница: спорная техника', RETAIL_FILM_50: 'Услуги оказываемые: 50%', RETAIL_PLOTTER_MATERIAL_COST_50: 'Плоттерные материалы: 50% от с/с',
  RETAIL_GROSS_PROFIT_10: 'Техника: 10% от ВП', RETAIL_ACCESSORY_5: 'Аксессуары', MANUAL_EXCLUDED: 'Исключено вручную',
};
const calculationFormulas: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'не входит в базу опта', WHOLESALE_REVIEW_TECH: 'входит в базу опта, требует проверки', WHOLESALE_INCLUDED_1_75: 'выручка × 1.75%',
  CREDIT_GROSS_PROFIT: 'ВП × 0.91 × 10%', CREDIT_ACCESSORY_NO_BONUS: 'выручка × ставку команды', CREDIT_REVIEW_NO_BONUS: 'кредитная строка без начисления до классификации',
  RETAIL_REVIEW_TECH: 'выручка × 5%, требует проверки', RETAIL_FILM_50: 'выручка × 50%', RETAIL_PLOTTER_MATERIAL_COST_50: 'с/с × 50%',
  RETAIL_GROSS_PROFIT_10: 'ВП × 10%', RETAIL_ACCESSORY_5: 'выручка × ставку команды', MANUAL_EXCLUDED: 'не входит в начисления',
};
const accessoryCategories = ['Зарядные устройства','Чехлы, накладки, сумки и бампера','Защитные стекла и пленки','Кабели','Наушники и гарнитура','Внешний аккумулятор','Карты памяти и накопители','Периферия для ПК','Держатели','Колонки Микрофоны','Переходники (Адаптеры)','Ремешки','Моноподы','Аккумуляторные батареи','Расходные материалы','Инструмент','Автовизитки','Геймпады (Джостики)','Товары для блогеров','Фото-видео камеры','Игрушки'].map(normalizeText);
const excludedTechCategories = ['Смартфоны (хар-ки)'].map(normalizeText);
const reviewTechCategories = ['Смарт-часы (без хар-к)', 'Электроника'].map(normalizeText);

function isWholesaleManager(manager: string) {
  return wholesaleManagers.some((name) => normalizeText(name) === normalizeText(manager));
}

function containsAny(text: string, fragments: string[]) {
  const normalized = normalizeText(text);
  return fragments.some((fragment) => normalized.includes(normalizeText(fragment)));
}

function getCategoryMatch(category: string, options: string[]) {
  const normalizedCategory = normalizeText(category);
  return options.find((option) => normalizedCategory === option || normalizedCategory.includes(option));
}

function isAccessoryCategory(category: string) {
  return Boolean(getCategoryMatch(category, accessoryCategories));
}

function isExcludedTechCategory(category: string) {
  return Boolean(getCategoryMatch(category, excludedTechCategories));
}

function isReviewTechCategory(category: string) {
  return Boolean(getCategoryMatch(category, reviewTechCategories));
}

function isTabletCategory(category: string) {
  return normalizeText(category) === 'планшеты';
}

function isPhoneCategory(category: string) {
  return normalizeText(category) === 'телефоны';
}

function hasExplicitAccessoryMarker(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  const hasAccessoryItemMarker = containsAny(text, [
    'чехол',
    'чехлы',
    'накладка',
    'бампер',
    'стекло',
    'стекла',
    'пленка',
    'плёнка',
    'кабель',
    'провод',
    'зарядка',
    'зарядное',
    'блок питания',
    'адаптер',
    'держатель',
    'ремешок',
    'magsafe',
    'lightning',
    'стилус',
    'penpro',
    'переходник',
  ]);
  const hasAccessoryCategory = isAccessoryCategory(row.category) && !hasAirPods(row);

  return hasAccessoryCategory || hasAccessoryItemMarker;
}

function isButtonPhone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, [
    'кнопочный телефон',
    'телефон кнопочный',
    'кнопочные телефоны',
    'мобильный телефон bq',
    'bq 1858',
    'bq 3590',
    'bq 2820',
    'nokia 1202',
    'philips xenium',
    'maxvi',
    'texet',
    'teXet',
  ]);
}

function isSmartphone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isExcludedTechCategory(row.category) || containsAny(text, [
    'смартфон',
    'смартфоны',
    'iphone',
    'galaxy',
    'redmi',
    'poco',
    'realme',
    'honor',
    'tecno',
    'infinix',
    'vivo',
    'oppo',
    'huawei',
    'motorola',
  ]);
}

function isAmbiguousPhone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isPhoneCategory(row.category) || containsAny(text, ['телефон']);
}

function isTablet(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isTabletCategory(row.category) || containsAny(text, ['планшет', 'ipad', 'айпад', 'tablet', 'tg30']);
}

function isAppleWatch(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['apple watch']);
}

function isMacBookOrAppleNotebook(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['macbook', 'макбук', 'ноутбук apple', 'apple notebook']);
}

function isPlayStation(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['playstation', 'sony playstation', 'ps5', 'ps4', 'консоль sony']);
}

function hasAirPods(row: SalesRow) {
  return containsAny(row.item, ['airpods', 'аирподс', 'эйрподс']);
}

function hasAirPodsCopyMarker(row: SalesRow) {
  return containsAny(row.item, ['hoco', 'borofone', 'celebrat', 'tws', 'copy', 'копия', 'replica', 'aaa', 'аналог', 'совместимые', 'неоригинал']);
}

function isOriginalAirPods(row: SalesRow) {
  return hasAirPods(row) && !hasAirPodsCopyMarker(row) && containsAny(row.item, ['apple', 'original', 'оригинал', 'оригинальные', 'airpods pro', 'airpods 2', 'airpods 3']);
}

function isAmbiguousAirPods(row: SalesRow) {
  return hasAirPods(row) && !hasAirPodsCopyMarker(row) && !isOriginalAirPods(row);
}

function isNonAppleSmartWatch(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isReviewTechCategory(row.category) && !isAppleWatch(row) && containsAny(text, ['hoco', 'hk', 'hk11', 'hk ultra', 'garmin', 'watch', 'часы', 'смарт-часы']);
}

function isKnownPremiumTech(row: SalesRow) {
  return isAppleWatch(row) || isMacBookOrAppleNotebook(row) || isOriginalAirPods(row) || isPlayStation(row);
}

function isBroadReviewCategory(category: string) {
  return isReviewTechCategory(category) || isTabletCategory(category) || normalizeText(category) === 'прочее';
}

function isWholesaleCameraOrRecorder(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isWholesaleManager(row.manager) && containsAny(text, ['камера', 'wi-fi камера', 'wifi камера', '4g камера', 'видеорегистратор', 'регистратор', 'dvr', 'faizfull']);
}

function isToyOrRobot(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['игрушка', 'игрушки', 'робот собака', 'робот-собака', 'детский робот']);
}

function isSmartGlasses(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['умные очки', 'smart glasses', 'g2 glasses', 'очки с камерой', 'очки солнцезащитные с наушником', 'очки с микрофоном', 'hn-w088']);
}

function isAffordableHairDryer(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['фен xiaomi', 'фен hoco', 'xiaomi mijia', 'hoco hp10']) && row.revenue < 15000;
}

function isVoiceRecorder(row: SalesRow) {
  return containsAny(row.item, ['диктофон', 'remax rp3']);
}

function isReplicaLikePhone(row: SalesRow) {
  return containsAny(row.item, ['17 pro max mini']) && !containsAny(row.item, ['apple', 'iphone']);
}

function getNewExpensiveReviewReason(row: SalesRow) {
  if (containsAny(row.item, ['dyson'])) return 'найдено слово Dyson';
  if (containsAny(row.item, ['фен']) && !isAffordableHairDryer(row)) return 'найдено слово фен';
  if (containsAny(row.item, ['стайлер'])) return 'найдено слово стайлер';
  if (containsAny(row.item, ['робот-пылесос'])) return 'найдено слово робот-пылесос';
  if (containsAny(row.item, ['пылесос'])) return 'найдено слово пылесос';
  if (containsAny(row.item, ['playstation', 'ps5', 'ps4', 'консоль'])) return 'найдена игровая консоль';
  if (containsAny(row.item, ['камера']) && !isWholesaleCameraOrRecorder(row) && !isToyOrRobot(row) && !isSmartGlasses(row)) return 'найдено слово камера';
  if (isBroadReviewCategory(row.category) && row.revenue >= 15000) return `дорогой товар в широкой категории ${row.category}`;
  return '';
}

function getArticle(item: string) {
  const parts = item.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isFilmService(row: SalesRow) {
  const category = normalizeText(row.category);
  return category === 'услуги оказываемые' || category.includes('услуги оказываемые');
}

function isAsadManager(manager: string) {
  return normalizeText(manager) === normalizeText(asadManagerName);
}

function isPlotterMaterial(row: SalesRow) {
  if (!isAsadManager(row.manager)) return false;

  const category = normalizeText(row.category);
  const item = normalizeText(row.item);
  const isProtectiveFilmCategory = category === 'защитные стекла и пленки' || category.includes('защитные стекла и пленки');
  const hasProtectiveFilmName = item.includes('защитная пленка');
  const hasPlotterMaterialMarker = containsAny(row.item, ['антигравийная', 'плоттера', '3m skin', 'матовая', 'глянцевая', 'текстурная']);
  const isGlassOrLens = item.includes('защитное стекло') || item.includes('защитные линзы') || item.includes('защитная линза');

  return isProtectiveFilmCategory && hasProtectiveFilmName && hasPlotterMaterialMarker && !isGlassOrLens;
}

function hasDisputeMarkers(row: SalesRow) {
  return containsAny(`${row.category} ${row.item}`, ['Apple', 'Original', 'iPad', 'AirPods', 'Mac', 'Watch']);
}

function isCreditSale(row: SalesRow) {
  return normalizeText(row.client).includes('кредит/рассрочка');
}

function getCreditTechReason(row: SalesRow, rule: string) {
  if (rule === 'smartphone-tech') return 'кредит + смартфон: входит в кредитный бонус';
  if (rule === 'tablet-tech-included-wholesale') return 'кредит + планшет: входит в кредитный бонус';
  if (rule === 'playstation-tech') return 'кредит + PlayStation: входит в кредитный бонус';
  if (rule === 'apple-watch-tech') return 'кредит + Apple Watch: входит в кредитный бонус';
  if (rule === 'macbook-tech') return 'кредит + MacBook: входит в кредитный бонус';
  if (rule === 'original-airpods-tech') return 'кредит + оригинальные AirPods: входит в кредитный бонус';
  return `кредит + техника: входит в кредитный бонус (${row.category})`;
}

function getCreditAccessoryReason(row: SalesRow, rule: string) {
  if (rule === 'accessory-category' || rule === 'accessory-item-marker') return 'кредит + аксессуар: 5% от выручки';
  if (rule === 'button-phone-accessory') return 'кредит + кнопочный телефон: 5% от выручки';
  if (rule === 'airpods-copy-accessory') return 'кредит + неоригинальные AirPods / TWS / копия: 5% от выручки';
  if (rule === 'non-apple-watch-accessory') return 'кредит + не-Apple смарт-часы: 5% от выручки';
  return `кредит + аксессуар: 5% от выручки (${row.category})`;
}

function getCategoryReason(row: SalesRow) {
  if (hasAirPods(row) && hasAirPodsCopyMarker(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'неоригинальные AirPods / TWS / копия — аксессуар / обычная база',
      rule: 'airpods-copy-accessory',
    };
  }

  if (hasExplicitAccessoryMarker(row)) {
    return {
      kind: 'accessory' as const,
      reason: containsAny(row.item, ['watch']) && containsAny(row.item, ['ремешок'])
        ? 'Ремешок Apple Watch — аксессуар, слово Watch не исключает'
        : containsAny(row.item, ['стилус', 'penpro'])
          ? 'Стилус — аксессуар'
          : `явный аксессуар по категории/названию: ${row.category}`,
      rule: isAccessoryCategory(row.category) ? 'accessory-category' : 'accessory-item-marker',
    };
  }

  if (isButtonPhone(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'кнопочный телефон — обычная база',
      rule: 'button-phone-accessory',
    };
  }

  if (isSmartphone(row)) {
    return {
      kind: 'excludedTech' as const,
      reason: 'Смартфон — техника, для опта исключён из базы',
      rule: 'smartphone-tech',
    };
  }

  if (isAmbiguousPhone(row)) {
    if (isReplicaLikePhone(row)) {
      return {
        kind: 'accessory' as const,
        reason: 'похоже на копию/неоригинальный телефон — обычная база, не iPhone без Apple/iPhone в названии',
        rule: 'replica-like-phone-accessory',
      };
    }

    return {
      kind: 'reviewTech' as const,
      reason: 'неясно: смартфон или кнопочный телефон',
      rule: 'ambiguous-phone-review',
    };
  }

  if (isTablet(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Планшет — техника, но для опта входит в оптовую базу',
      rule: 'tablet-tech-included-wholesale',
    };
  }

  if (isAppleWatch(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Apple Watch — техника',
      rule: 'apple-watch-tech',
    };
  }

  if (isNonAppleSmartWatch(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'Hoco/HK/Garmin или другие не-Apple смарт-часы — аксессуар / обычная база',
      rule: 'non-apple-watch-accessory',
    };
  }

  if (isMacBookOrAppleNotebook(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'MacBook / ноутбук Apple — техника',
      rule: 'macbook-tech',
    };
  }

  if (isOriginalAirPods(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Оригинальные AirPods — техника',
      rule: 'original-airpods-tech',
    };
  }

  if (isAmbiguousAirPods(row)) {
    return {
      kind: 'reviewTech' as const,
      reason: 'AirPods: неясно, оригинал или копия',
      rule: 'ambiguous-airpods-review',
    };
  }

  if (isPlayStation(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'PlayStation — техника',
      rule: 'playstation-tech',
    };
  }

  if (isWholesaleCameraOrRecorder(row)) {
    return {
      kind: 'other' as const,
      reason: 'камера/видеорегистратор у опта — входит в оптовую базу',
      rule: 'wholesale-camera-recorder-base',
    };
  }

  if (isToyOrRobot(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'игрушка/робот — обычная база',
      rule: 'toy-robot-accessory',
    };
  }

  if (isSmartGlasses(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'умные очки / очки с камерой — обычная база',
      rule: 'smart-glasses-accessory',
    };
  }

  if (isAffordableHairDryer(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'недорогой фен Xiaomi/Hoco — обычная база',
      rule: 'affordable-hair-dryer-accessory',
    };
  }

  if (isVoiceRecorder(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'диктофон — обычная база',
      rule: 'voice-recorder-accessory',
    };
  }

  const expensiveReviewReason = getNewExpensiveReviewReason(row);
  if (expensiveReviewReason) {
    return {
      kind: 'reviewTech' as const,
      reason: `${expensiveReviewReason} — требуется классификация`,
      rule: 'new-expensive-review',
    };
  }

  if (isReviewTechCategory(row.category)) {
    return {
      kind: 'reviewTech' as const,
      reason: `Категория ${row.category} слишком широкая, правило по названию не найдено`,
      rule: 'broad-review-category',
    };
  }

  return {
    kind: 'other' as const,
    reason: `прочая категория: ${row.category}`,
    rule: 'default-category',
  };
}

function getCalculationDetails(row: SalesRow): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const department: Department = isWholesaleManager(row.manager) ? 'Опт' : 'Розница';
  const categoryReason = getCategoryReason(row);
  const article = getArticle(row.item);
  const creditSale = isCreditSale(row);

  if (department === 'Опт') {
    const calculationType: CalculationType =
    categoryReason.kind === 'excludedTech'
        ? 'WHOLESALE_EXCLUDED_TECH'
        : categoryReason.kind === 'reviewTech'
          ? 'WHOLESALE_REVIEW_TECH'
          : 'WHOLESALE_INCLUDED_1_75';
    const includedInWholesaleBase = calculationType !== 'WHOLESALE_EXCLUDED_TECH';
    const base = includedInWholesaleBase ? row.revenue : 0;
    const percent = includedInWholesaleBase ? 0.0175 : 0;

    return {
      department,
      calculationType,
      calculationLabel: calculationLabels[calculationType],
      article,
      base,
      percent,
      bonus: base * percent,
      formula: calculationFormulas[calculationType],
      includedInWholesaleBase,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (isFilmService(row)) {
    return {
      department,
      calculationType: 'RETAIL_FILM_50',
      calculationLabel: calculationLabels.RETAIL_FILM_50,
      article,
      base: row.revenue,
      percent: 0.5,
      bonus: row.revenue * 0.5,
      formula: calculationFormulas.RETAIL_FILM_50,
      includedInWholesaleBase: null,
      classificationReason: 'категория / вид номенклатуры = Услуги оказываемые',
      matchedRule: 'service-category',
      isCreditSale: creditSale,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (isPlotterMaterial(row)) {
    return {
      department,
      calculationType: 'RETAIL_PLOTTER_MATERIAL_COST_50',
      calculationLabel: calculationLabels.RETAIL_PLOTTER_MATERIAL_COST_50,
      article,
      base: row.cost,
      percent: 0.5,
      bonus: row.cost * 0.5,
      formula: calculationFormulas.RETAIL_PLOTTER_MATERIAL_COST_50,
      includedInWholesaleBase: null,
      classificationReason: 'Икаев Асад + плоттерные плёнки / материалы для плоттера',
      matchedRule: 'asad-plotter-material',
      isCreditSale: creditSale,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (creditSale && (categoryReason.kind === 'excludedTech' || categoryReason.kind === 'retailTech')) {
    return {
      department,
      calculationType: 'CREDIT_GROSS_PROFIT',
      calculationLabel: calculationLabels.CREDIT_GROSS_PROFIT,
      article,
      base: row.grossProfit * 0.91,
      percent: 0.1,
      bonus: row.grossProfit * 0.91 * 0.1,
      formula: calculationFormulas.CREDIT_GROSS_PROFIT,
      includedInWholesaleBase: null,
      classificationReason: getCreditTechReason(row, categoryReason.rule),
      matchedRule: `credit-tech:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'tech',
      creditIncludedInBonus: true,
    };
  }

  if (creditSale && categoryReason.kind === 'accessory') {
    return {
      department,
      calculationType: 'RETAIL_ACCESSORY_5',
      calculationLabel: 'Кредитная продажа, аксессуар: 5%',
      article,
      base: row.revenue,
      percent: 0.05,
      bonus: row.revenue * 0.05,
      formula: calculationFormulas.RETAIL_ACCESSORY_5,
      includedInWholesaleBase: null,
      classificationReason: getCreditAccessoryReason(row, categoryReason.rule),
      matchedRule: `credit-accessory:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'accessory',
      creditIncludedInBonus: false,
    };
  }

  if (creditSale) {
    return {
      department,
      calculationType: 'CREDIT_REVIEW_NO_BONUS',
      calculationLabel: calculationLabels.CREDIT_REVIEW_NO_BONUS,
      article,
      base: 0,
      percent: 0,
      bonus: 0,
      formula: calculationFormulas.CREDIT_REVIEW_NO_BONUS,
      includedInWholesaleBase: null,
      classificationReason: `кредит + товар спорный: требуется классификация. ${categoryReason.reason}`,
      matchedRule: `credit-review:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'review',
      creditIncludedInBonus: false,
    };
  }

  if (categoryReason.kind === 'excludedTech' || categoryReason.kind === 'retailTech') {
    return {
      department,
      calculationType: 'RETAIL_GROSS_PROFIT_10',
      calculationLabel: calculationLabels.RETAIL_GROSS_PROFIT_10,
      article,
      base: row.grossProfit,
      percent: 0.1,
      bonus: row.grossProfit * 0.1,
      formula: calculationFormulas.RETAIL_GROSS_PROFIT_10,
      includedInWholesaleBase: null,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (categoryReason.kind === 'reviewTech') {
    return {
      department,
      calculationType: 'RETAIL_REVIEW_TECH',
      calculationLabel: calculationLabels.RETAIL_REVIEW_TECH,
      article,
      base: row.revenue,
      percent: 0.05,
      bonus: row.revenue * 0.05,
      formula: calculationFormulas.RETAIL_REVIEW_TECH,
      includedInWholesaleBase: null,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  return {
    department,
    calculationType: 'RETAIL_ACCESSORY_5',
    calculationLabel: calculationLabels.RETAIL_ACCESSORY_5,
    article,
    base: row.revenue,
    percent: 0.05,
    bonus: row.revenue * 0.05,
    formula: calculationFormulas.RETAIL_ACCESSORY_5,
    includedInWholesaleBase: null,
    classificationReason: categoryReason.reason,
    matchedRule: categoryReason.rule,
    isCreditSale: false,
    creditProductType: null,
    creditIncludedInBonus: false,
  };
}

function getRuleTargetDetails(
  row: SalesRow,
  currentDetails: Omit<ClassifiedSalesRow, keyof SalesRow>,
  targetCalculationType: PayrollClassificationRule['targetCalculationType'],
): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const article = getArticle(row.item);
  const isCredit = currentDetails.isCreditSale;
  const target: CalculationType =
    targetCalculationType === 'REVIEW_ONLY'
      ? isCredit
        ? 'CREDIT_REVIEW_NO_BONUS'
        : currentDetails.department === 'Опт'
          ? 'WHOLESALE_REVIEW_TECH'
          : 'RETAIL_REVIEW_TECH'
      : targetCalculationType;

  const baseByTarget: Record<CalculationType, number> = {
    WHOLESALE_EXCLUDED_TECH: 0,
    WHOLESALE_REVIEW_TECH: row.revenue,
    WHOLESALE_INCLUDED_1_75: row.revenue,
    CREDIT_GROSS_PROFIT: row.grossProfit * 0.91,
    CREDIT_ACCESSORY_NO_BONUS: row.revenue,
    CREDIT_REVIEW_NO_BONUS: 0,
    RETAIL_REVIEW_TECH: row.revenue,
    RETAIL_FILM_50: row.revenue,
    RETAIL_PLOTTER_MATERIAL_COST_50: row.cost,
    RETAIL_GROSS_PROFIT_10: row.grossProfit,
    RETAIL_ACCESSORY_5: row.revenue,
    MANUAL_EXCLUDED: 0,
  };
  const percentByTarget: Record<CalculationType, number> = {
    WHOLESALE_EXCLUDED_TECH: 0,
    WHOLESALE_REVIEW_TECH: 0.0175,
    WHOLESALE_INCLUDED_1_75: 0.0175,
    CREDIT_GROSS_PROFIT: 0.1,
    CREDIT_ACCESSORY_NO_BONUS: 0.05,
    CREDIT_REVIEW_NO_BONUS: 0,
    RETAIL_REVIEW_TECH: 0.05,
    RETAIL_FILM_50: 0.5,
    RETAIL_PLOTTER_MATERIAL_COST_50: 0.5,
    RETAIL_GROSS_PROFIT_10: 0.1,
    RETAIL_ACCESSORY_5: 0.05,
    MANUAL_EXCLUDED: 0,
  };
  const base = baseByTarget[target];
  const percent = percentByTarget[target];

  return {
    department: currentDetails.department,
    calculationType: target,
    calculationLabel: isCredit && target === 'RETAIL_ACCESSORY_5' ? 'Кредитная продажа, аксессуар' : calculationLabels[target],
    article,
    base,
    percent,
    bonus: base * percent,
    formula: calculationFormulas[target],
    includedInWholesaleBase:
      target === 'WHOLESALE_EXCLUDED_TECH'
        ? false
        : target === 'WHOLESALE_REVIEW_TECH' || target === 'WHOLESALE_INCLUDED_1_75'
          ? true
          : null,
    classificationReason: currentDetails.classificationReason,
    matchedRule: currentDetails.matchedRule,
    isCreditSale: isCredit,
    creditProductType:
      target === 'CREDIT_GROSS_PROFIT'
        ? 'tech'
        : target === 'CREDIT_ACCESSORY_NO_BONUS' || (isCredit && target === 'RETAIL_ACCESSORY_5')
          ? 'accessory'
          : target === 'CREDIT_REVIEW_NO_BONUS'
            ? 'review'
            : null,
    creditIncludedInBonus: target === 'CREDIT_GROSS_PROFIT',
  };
}

function doesClassificationRuleMatch(row: SalesRow, details: Omit<ClassifiedSalesRow, keyof SalesRow>, rule: PayrollClassificationRule) {
  if (!rule.isActive) return false;

  const department = isWholesaleManager(row.manager) ? 'wholesale' : 'retail';
  const saleContext = details.isCreditSale ? 'credit' : 'regular';
  const ruleDepartment = rule.department || 'all';
  const ruleSaleContext = rule.saleContext || 'all';

  if (ruleDepartment !== 'all' && ruleDepartment !== department) return false;
  if (ruleSaleContext !== 'all' && ruleSaleContext !== saleContext) return false;

  const item = normalizeText(row.item);
  const category = normalizeText(row.category);
  const article = normalizeText(getArticle(row.item));
  const ruleItem = normalizeText(rule.itemText ?? '');
  const ruleCategory = normalizeText(rule.categoryText ?? '');
  const ruleArticle = normalizeText(rule.article ?? '');

  if (rule.matchType === 'EXACT_ITEM') {
    return Boolean(ruleItem) && item === ruleItem && (!ruleCategory || category === ruleCategory) && (!ruleArticle || article === ruleArticle);
  }
  if (rule.matchType === 'CONTAINS_ITEM') return Boolean(ruleItem) && item.includes(ruleItem);
  if (rule.matchType === 'CATEGORY') return Boolean(ruleCategory) && category === ruleCategory;
  if (rule.matchType === 'CATEGORY_AND_CONTAINS_ITEM') {
    return Boolean(ruleCategory && ruleItem) && category === ruleCategory && item.includes(ruleItem);
  }
  if (rule.matchType === 'ARTICLE') return Boolean(ruleArticle) && article === ruleArticle;

  return false;
}

function applyClassificationRules(
  row: SalesRow,
  details: Omit<ClassifiedSalesRow, keyof SalesRow>,
  rules: PayrollClassificationRule[],
): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const matchedRule = rules
    .filter((rule) => rule.isActive)
    .sort((left, right) => left.priority - right.priority || left.id - right.id)
    .find((rule) => doesClassificationRuleMatch(row, details, rule));

  if (!matchedRule) return details;

  const overriddenDetails = getRuleTargetDetails(row, details, matchedRule.targetCalculationType);
  const ruleLabel = matchedRule.title || matchedRule.reason || `#${matchedRule.id}`;
  const manualReason =
    overriddenDetails.calculationType === 'RETAIL_ACCESSORY_5'
      ? 'manual-accessory'
      : overriddenDetails.calculationType === 'RETAIL_GROSS_PROFIT_10' || overriddenDetails.calculationType === 'CREDIT_GROSS_PROFIT'
        ? 'manual-tech'
        : overriddenDetails.calculationType === 'MANUAL_EXCLUDED'
          ? 'manual-excluded'
          : 'manual-rule';

  return {
    ...overriddenDetails,
    classificationReason: `${manualReason}: ${ruleLabel}. ${matchedRule.reason || overriddenDetails.classificationReason}`,
    matchedRule: `manual-rule:${matchedRule.id}`,
  };
}

function isAccessoryBonusRow(row: ClassifiedSalesRow) {
  const calculationType = String(row.calculationType).trim();
  if (calculationType === 'RETAIL_ACCESSORY_5' || calculationType === 'CREDIT_ACCESSORY_NO_BONUS') return true;
  if (row.formula === calculationFormulas.RETAIL_ACCESSORY_5 && row.percent === 0.05) return true;
  if (normalizeText(row.calculationLabel).includes('аксессуар')) return true;
  if (normalizeText(row.classificationReason).includes('аксессуар')) return true;
  return row.matchedRule === 'accessory-category' || row.matchedRule === 'accessory-item-marker' || row.matchedRule.startsWith('credit-accessory:');
}

function getAccessoryCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => isAccessoryBonusRow(row));
}

function getRetailTechCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10');
}

function getCreditTechCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT');
}

function getAccessoryCalculationBase(row: ClassifiedSalesRow) { return row.revenue; }
function getRetailTechCalculationBase(row: ClassifiedSalesRow) { return row.grossProfit; }
function getCreditTechCalculationBase(row: ClassifiedSalesRow) { return row.grossProfit; }

export function classifyPayrollSalesRows(rows: SalesRow[], classificationRules: PayrollClassificationRule[] = []): ClassificationResult {
  const normalizedRows = rows
    .map((row) => ({ ...row, manager: getPayrollManagerName(row.manager) }))
    .filter((row) => !isPayrollExcludedEmployee(row.manager));
  const classifiedRows = normalizedRows.map((row) => {
    const details = getCalculationDetails(row);
    return { ...row, ...applyClassificationRules(row, details, classificationRules) };
  });
  const wholesaleRows = classifiedRows.filter((row) => row.department === 'Опт');
  const zalinaRevenue = wholesaleRows.filter((row) => normalizeText(row.manager) === normalizeText('Ахобекова Залина')).reduce((sum, row) => sum + row.revenue, 0);
  const lianaRevenue = wholesaleRows.filter((row) => normalizeText(row.manager) === normalizeText('Хурзокова Лиана')).reduce((sum, row) => sum + row.revenue, 0);
  const wholesale = {
    zalinaRevenue,
    lianaRevenue,
    totalRevenue: wholesaleRows.reduce((sum, row) => sum + row.revenue, 0),
    excludedTechRevenue: wholesaleRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').reduce((sum, row) => sum + row.revenue, 0),
    base: 0,
    bonusEach: 0,
  };
  wholesale.base = wholesale.totalRevenue - wholesale.excludedTechRevenue;
  wholesale.bonusEach = wholesale.base * 0.0175;

  const typeSummaries = (Object.keys(calculationLabels) as CalculationType[]).map((type) => {
    const typeRows = classifiedRows.filter((row) => row.calculationType === type);
    const base = type === 'WHOLESALE_INCLUDED_1_75' ? wholesale.base : typeRows.reduce((sum, row) => sum + row.base, 0);
    const bonus = type === 'WHOLESALE_INCLUDED_1_75' ? wholesale.bonusEach : typeRows.reduce((sum, row) => sum + row.bonus, 0);

    return {
      type,
      label: calculationLabels[type],
      rows: typeRows.length,
      revenue: typeRows.reduce((sum, row) => sum + row.revenue, 0),
      grossProfit: typeRows.reduce((sum, row) => sum + row.grossProfit, 0),
      base,
      formula: calculationFormulas[type],
      bonus,
    };
  });

  const managers = Array.from(new Set(classifiedRows.map((row) => row.manager)));
  const managerSummaries = managers.map((manager) => {
    const managerRows = classifiedRows.filter((row) => row.manager === manager);
    const department: Department = isWholesaleManager(manager) ? 'Опт' : 'Розница';
    const creditBonus = getCreditTechCalculationRows(managerRows).reduce((sum, row) => sum + getCreditTechCalculationBase(row) * 0.91 * 0.1, 0);
    const filmBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.bonus, 0);
    const plotterBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.bonus, 0);
    const techBonus = getRetailTechCalculationRows(managerRows).reduce((sum, row) => sum + getRetailTechCalculationBase(row) * 0.1, 0);
    const accessoryBonus = getAccessoryCalculationRows(managerRows).reduce((sum, row) => sum + getAccessoryCalculationBase(row) * 0.05, 0);
    const wholesaleBonus = department === 'Опт' ? wholesale.bonusEach : 0;

    return {
      manager,
      department,
      revenue: managerRows.reduce((sum, row) => sum + row.revenue, 0),
      grossProfit: managerRows.reduce((sum, row) => sum + row.grossProfit, 0),
      creditBonus,
      filmBonus,
      plotterBonus,
      techBonus,
      accessoryBonus,
      wholesaleBonus,
      totalBonus: creditBonus + filmBonus + plotterBonus + techBonus + accessoryBonus + wholesaleBonus,
    };
  });

  return {
    rows: classifiedRows,
    wholesale,
    typeSummaries,
    managerSummaries,
    disputedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH' || row.calculationType === 'CREDIT_REVIEW_NO_BONUS' || (hasDisputeMarkers(row) && row.matchedRule === 'default-category')),
    accessoryExcludedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH' && isAccessoryCategory(row.category)),
    expensiveReviewRows: classifiedRows.filter((row) => row.matchedRule === 'new-expensive-review'),
    counts: {
      total: classifiedRows.length,
      wholesale: classifiedRows.filter((row) => row.department === 'Опт').length,
      retail: classifiedRows.filter((row) => row.department === 'Розница').length,
      credit: classifiedRows.filter((row) => row.isCreditSale).length,
      film: classifiedRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').length,
      retailTech: classifiedRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').length,
      accessory: classifiedRows.filter((row) => isAccessoryBonusRow(row) || row.calculationType === 'RETAIL_REVIEW_TECH').length,
      wholesaleExcludedTech: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').length,
    },
  };
}

export const PAYROLL_SALES_COMPACT_VERSION = 'payroll-sales-compact-v1' as const;

export type PayrollSalesCompactSnapshot = {
  version: typeof PAYROLL_SALES_COMPACT_VERSION;
  managerSummaries: Array<PayrollManagerBonusSummary & { accessoryBase: number; accessoryRate: number }>;
  wholesale: PayrollSalesClassificationResult['wholesale'];
  typeSummaries: PayrollSalesClassificationResult['typeSummaries'];
  counts: PayrollSalesClassificationResult['counts'];
  costPendingRows: number;
  unresolvedRows: number;
};

export function buildPayrollSalesCompactSnapshot(
  rows: PayrollSalesSourceRow[],
  classificationRules: PayrollSalesClassificationRule[] = [],
  periodKey?: string,
): PayrollSalesCompactSnapshot {
  const periodRows = periodKey
    ? rows.flatMap((row) => {
      const manager = getPayrollSalesManagerNameForPeriod(row.manager, periodKey);
      return manager ? [{ ...row, manager }] : [];
    })
    : rows;
  const classification = classifyPayrollSalesRows(periodRows, classificationRules);
  const accessoryBaseByManager = classification.rows
    .filter(isAccessoryBonusRow)
    .reduce<Map<string, number>>((totals, row) => {
      totals.set(row.manager, (totals.get(row.manager) ?? 0) + row.revenue);
      return totals;
    }, new Map());
  const costDependentTypes: CalculationType[] = ['CREDIT_GROSS_PROFIT', 'RETAIL_PLOTTER_MATERIAL_COST_50', 'RETAIL_GROSS_PROFIT_10'];
  return {
    version: PAYROLL_SALES_COMPACT_VERSION,
    managerSummaries: classification.managerSummaries.map((summary) => ({
      ...summary,
      accessoryBase: accessoryBaseByManager.get(summary.manager) ?? 0,
      accessoryRate: 0.05,
    })),
    wholesale: classification.wholesale,
    typeSummaries: classification.typeSummaries,
    counts: classification.counts,
    costPendingRows: classification.rows
      .filter((row) => costDependentTypes.includes(row.calculationType))
      .reduce((sum, row) => sum + (row.sourceCostCalculationPendingRows ?? 0), 0),
    unresolvedRows: classification.rows.filter((row) => (
      row.calculationType === 'WHOLESALE_REVIEW_TECH'
      || row.calculationType === 'RETAIL_REVIEW_TECH'
      || row.calculationType === 'CREDIT_REVIEW_NO_BONUS'
      || row.matchedRule === 'new-expensive-review'
    )).length,
  };
}
