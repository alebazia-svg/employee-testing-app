CREATE TABLE "PayrollPurchaseSupplierRule" (
    "id" SERIAL NOT NULL,
    "supplierName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPurchaseSupplierRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollPurchaseSupplierRule_normalizedName_key"
ON "PayrollPurchaseSupplierRule"("normalizedName");

CREATE INDEX "PayrollPurchaseSupplierRule_isActive_supplierName_idx"
ON "PayrollPurchaseSupplierRule"("isActive", "supplierName");

INSERT INTO "PayrollPurchaseSupplierRule" ("supplierName", "normalizedName", "isActive", "source", "updatedAt") VALUES
('Luxo', 'luxo', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('П43/45 Муртаза', 'п43/45 муртаза', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Remax', 'remax', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('В12', 'в12', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Б89', 'б89', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Daben Ada', 'daben ada', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Кештов Амирби Юрьевич', 'кештов амирби юрьевич', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Set Sail Film пленки', 'set sail film пленки', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Керефова Альбина', 'керефова альбина', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Phone26 Горяч', 'phone26 горяч', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('МегаАкс АбдулХалик', 'мегаакс абдулхалик', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Baseus Jackson', 'baseus jackson', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Глазурь Ростов', 'глазурь ростов', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Смарт 05', 'смарт 05', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('А100 Миво', 'а100 миво', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Usbmag', 'usbmag', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Tural', 'tural', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('П17', 'п17', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('Breaking', 'breaking', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('3-11 Курбан', '3-11 курбан', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('П37', 'п37', true, 'approved-august-2026', CURRENT_TIMESTAMP),
('95-RU', '95-ru', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Зелим Чечня', 'зелим чечня', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Скупка б/у', 'скупка б/у', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Е1 Евротел', 'е1 евротел', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('ЗАРЯ ООО', 'заря ооо', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Кумыков Казбек (Смарт Мобайл)', 'кумыков казбек (смарт мобайл)', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Хупсергенов Азамат iCenter', 'хупсергенов азамат icenter', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Карго Юра', 'карго юра', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Боготов Аскер (Gadget, Orange)', 'боготов аскер (gadget, orange)', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Купов Мухаммед', 'купов мухаммед', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Дарфон Анзор (Вэйфон)', 'дарфон анзор (вэйфон)', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('ДарФон', 'дарфон', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('А15', 'а15', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('ТММ Групп', 'тмм групп', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('A110 Bmcase', 'a110 bmcase', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Южные Ворота 888', 'южные ворота 888', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Настуев Алим ЦУМ', 'настуев алим цум', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Кумахова Диана', 'кумахова диана', false, 'excluded-august-2026', CURRENT_TIMESTAMP),
('Автобус', 'автобус', false, 'excluded-august-2026', CURRENT_TIMESTAMP);
