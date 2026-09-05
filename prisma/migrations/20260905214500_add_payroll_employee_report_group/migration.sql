ALTER TABLE "PayrollEmployeeResult"
ADD COLUMN "reportGroup" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User"
ADD COLUMN "payrollSalaryType" TEXT,
ADD COLUMN "payrollReportGroup" TEXT,
ADD COLUMN "payrollFixedSalary" DOUBLE PRECISION,
ADD COLUMN "payrollRuleFrom" TEXT,
ADD COLUMN "payrollRuleThrough" TEXT;

UPDATE "PayrollEmployeeResult"
SET "reportGroup" = CASE "salaryType"
  WHEN 'purchase_manager' THEN 'Закупки'
  WHEN 'wholesale_percent' THEN 'Оптовые продажи'
  WHEN 'retail_sales_bonus' THEN 'Розничные продажи'
  WHEN 'vl_percent' THEN 'Операционное управление'
  WHEN 'fixed_salary' THEN 'Фиксированный оклад'
  ELSE 'Требует настройки'
END;

UPDATE "User"
SET "payrollSalaryType" = CASE
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") = 'Тохов Астемир' THEN 'purchase_manager'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Ахобекова Залина', 'Хурзокова Лиана') THEN 'wholesale_percent'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Чеченова Милана', 'Абшаева Зухра', 'Костеренко Магомед', 'Икаев Асад', 'Кумахова Диана') THEN 'retail_sales_bonus'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") = 'Кештова Бэла' THEN 'vl_percent'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Улубиев Марат', 'Даудова Татьяна', 'Дагиров Ибрагим', 'Атабиева Марианна', 'Жамбекова Саида') THEN 'fixed_salary'
      ELSE NULL
    END,
    "payrollReportGroup" = CASE
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") = 'Тохов Астемир' THEN 'Закупки'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Ахобекова Залина', 'Хурзокова Лиана') THEN 'Оптовые продажи'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Чеченова Милана', 'Абшаева Зухра', 'Костеренко Магомед', 'Икаев Асад', 'Кумахова Диана') THEN 'Розничные продажи'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") = 'Кештова Бэла' THEN 'Операционное управление'
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN ('Улубиев Марат', 'Даудова Татьяна', 'Дагиров Ибрагим', 'Атабиева Марианна', 'Жамбекова Саида') THEN 'Фиксированный оклад'
      ELSE NULL
    END,
    "payrollFixedSalary" = CASE COALESCE(NULLIF(BTRIM("payrollName"), ''), "name")
      WHEN 'Улубиев Марат' THEN 10000
      WHEN 'Даудова Татьяна' THEN 15000
      WHEN 'Дагиров Ибрагим' THEN 40000
      WHEN 'Атабиева Марианна' THEN 30000
      WHEN 'Жамбекова Саида' THEN 30000
      ELSE NULL
    END,
    "payrollRuleThrough" = CASE
      WHEN COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") = 'Дагиров Ибрагим' THEN '2026-06'
      ELSE NULL
    END
WHERE COALESCE(NULLIF(BTRIM("payrollName"), ''), "name") IN (
  'Кештова Бэла', 'Ахобекова Залина', 'Хурзокова Лиана', 'Чеченова Милана', 'Абшаева Зухра',
  'Костеренко Магомед', 'Икаев Асад', 'Кумахова Диана', 'Улубиев Марат', 'Даудова Татьяна',
  'Дагиров Ибрагим', 'Атабиева Марианна', 'Жамбекова Саида', 'Тохов Астемир'
);
