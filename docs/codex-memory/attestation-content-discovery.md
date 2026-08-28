# Attestation Content Discovery

Last reviewed: 2026-08-28.

## Purpose And Phase

This document preserves the evidence and content scope for useful employee
attestations. It is a discovery contract, not an implemented test bank.

Implementation remains `AFTER LAUNCH` in `master-plan.md`. Launch hardening and
the real-employee PWA pilot must not be delayed by this work.

## Product Principle

- Questions must be based on verified Offonika operations, configuration and
  owner-approved rules, not generic 1C trivia.
- A common operational core is combined with separate Retail and Wholesale
  modules.
- Novice questions check the safe standard path. Experienced questions use
  realistic ambiguous cases, linked documents and correction paths.
- A common historical action is evidence of current practice, not proof that it
  is the correct answer.
- Wrong answers must be plausible work mistakes. Wording must not deliberately
  deceive the employee.
- The first version is developmental: explanation after an answer and knowledge
  gaps for ADMIN. It must not create automatic payroll penalties.

## Verified Read-Only Evidence

### Actual document families

A bounded production 1C event-log review for 2026-08-25 through 2026-08-28
confirmed manager interaction with these document families:

- `Реализация товаров и услуг`;
- `Чек ККМ`;
- `Перемещение товаров`;
- `Приходный кассовый ордер`;
- `Расходный кассовый ордер`;
- `Заявка на расходование денежных средств`;
- `Приобретение товаров и услуг`;
- `Возврат товаров от клиента`;
- `Кассовая смена`;
- `Отчет о розничных продажах`;
- `Установка цен номенклатуры`;
- `Заказ поставщику`;
- `Оприходование излишков товаров`.

The endpoint is bounded and some user windows reached its 2,000-event limit, so
the list proves presence but must not be treated as complete volume ranking.
The 1C username mapping for every current portal employee is not yet complete.

### MegaPrice sales path

The installed extension source confirms that the MegaPrice extended sales
assistant searches the product catalog and supplier price lists, adds a
product/characteristic to the cart and calls the sale-document path
`ЗаполнитьИОткрытьРеализациюНаСервере`. This supports testing the real
MegaPrice-to-realization workflow. The exact owner-approved sequence involving
the cashier workplace/RMK still needs a process walkthrough before questions
are finalized.

### Nomenclature creation

The production read-only `product-created-cards` evidence found 889 created
product cards for 2026-06-01 through 2026-08-28. Twenty-two cards were created
under two current-manager 1C accounts.

For those 22 cards:

- product type and nomenclature kind were populated;
- all lacked article, barcode and additional attributes in the current
  `product-metadata` read model;
- some lacked a product category or manufacturer/brand;
- price group was empty for all 22.

These are discovery signals, not employee errors. Before creating scored
questions, determine which fields are mandatory at creation for each product
kind, which are inherited or generated automatically, and which are intentionally
filled later.

The 1C metadata also confirms configuration objects for MegaPrice uniqueness
control, article generation and automatic barcode creation, but their live
values and exact user workflow have not yet been verified.

## Content Architecture

### Common 1C core

- choose the correct document for the business event;
- create from the correct source document when a linked chain is required;
- fill required analytics and evidence;
- search before creating a new object or document;
- avoid duplicates and understand what must not be repeated after a timeout;
- distinguish an employee correction from an ADMIN/1C-administrator action;
- escalate safely when the source is unavailable or the evidence is ambiguous.

### Sales and cash

- MegaPrice, realization and RMK/KKM roles in the real sale path;
- payment method and the consequences of confusing cash, acquiring and PKO;
- required product characteristics/series for relevant electronics;
- document checks before posting;
- cash shift opening/closing and recovery from a technical failure.

### Returns and corrections

- return path when the original sale was a realization;
- return path when the original sale was a KKM receipt;
- correct source-document linkage;
- cases that require fiscal correction or ADMIN review;
- preventing a second return or unrelated replacement document.

### Expenses

- purpose and correct expense request type;
- payment breakdown and required comment/evidence;
- correct expense/cash-flow analytics for recurring real scenarios;
- supplier payment, customer refund and other expense distinctions.

### Purchases and stock

- supplier order versus acquisition/receipt;
- product, characteristic, quantity, supplier, warehouse and source linkage;
- price setting after receipt where required;
- movements and surplus posting only for the correct real-world event.

### Nomenclature

- sufficiently broad search before creation and duplicate recognition;
- correct nomenclature kind, type, folder and product category;
- consistent model/name structure, manufacturer and brand;
- characteristics versus separate cards for the configured product kind;
- series/IMEI requirements for relevant phones, tablets and other electronics;
- article, barcode and additional attributes only according to verified rules;
- operational consequences of a duplicate or incomplete card.

### Role modules

- Retail: RMK/KKM, fiscal sale, customer return, cash shift and retail cash
  discipline.
- Wholesale: realization, customer debt/payment situations, returns and the
  correct use of PKO without treating legitimate deferred payment as an error.
- Purchasing responsibilities that are actually assigned to a manager must be
  a separate role module, not forced into every employee's score.

## Evidence Still Required Before Writing Final Questions

1. Map every current portal employee to the exact 1C user account.
2. Observe a standard owner-approved walkthrough for each major document path.
3. Verify live MegaPrice uniqueness/article/barcode settings and the actual
   nomenclature creation form.
4. Establish mandatory fields by product kind, especially smartphones,
   tablets, watches, accessories and services.
5. Reconcile observed document chains with correct 1C configuration; do not
   infer the rule only from event frequency.
6. Separate genuine mistakes from legitimate Retail/Wholesale differences.
7. Convert verified rules into scenario cards with one defensible answer,
   explanation, competency tag, severity and source reference.

## Next Deliverable

After the PWA pilot gate, prepare an owner-reviewable competency matrix and a
small calibrated sample before implementing the assessment UI:

- common novice sample;
- common experienced sample;
- Retail module sample;
- Wholesale module sample;
- nomenclature and expense-request sample based on verified live rules.

