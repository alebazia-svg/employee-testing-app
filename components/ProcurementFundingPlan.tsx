'use client';
import {useRef, useState} from 'react';
import {ChevronDown, WalletCards, Landmark, CalendarDays, AlertCircle, RotateCcw} from 'lucide-react';
import {fundingScenario, ownerAmount, RENT_RESERVE_MINOR, type FundingEvidence, type FundingStep} from '@/lib/procurement-funding-scenario';
import './procurement-funding-plan.css';

const rub = (n: number) => n.toLocaleString('ru-RU', {maximumFractionDigits: 2}) + '\u00a0₽';
const day = (s: string) => new Date(s.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', timeZone: 'Europe/Moscow'});
const method = (s: string) => ({USDT: 'Обмен на USDT', CNY: 'Перевод в юанях', CASH: 'Наличные', ACCOUNTABLE_QR: 'Оплата по QR', BANK: 'Перевод на карту'}[s] ?? 'Способ оплаты не определён');
function Steps({steps}: {steps: FundingStep[]}) {
  return <ol className="fp-steps">{steps.map((s, i) => <li key={s.source + s.date + i}>
    <span className="fp-step-icon">{i + 1}</span><div><b>{s.source}</b><small>{s.kind === 'withdrawal' ? 'Вариант снятия ' : 'К '}{day(s.date)}</small></div>
    <strong>{s.kind === 'wallet' ? s.amount.toLocaleString('ru-RU') + '\u00a0USDT' : rub(s.amount)}</strong>
  </li>)}</ol>;
}
export default function Funding({data, stale=false, refreshing=false}: {data: FundingEvidence; stale?:boolean; refreshing?:boolean}) {
  const active = data.plans.filter(p => ['SUBMITTED', 'APPROVED'].includes(p.status)).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.id.localeCompare(b.id));
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = active.filter(p=>!excluded.includes(p.id)).map(p=>p.id);
  const [expanded, setExpanded] = useState('');
  const [includeManagerCash, setIncludeManagerCash] = useState(false);
  const conditions = useRef<HTMLElement>(null);
  const plan = fundingScenario(data, selected, {includeManagerCash}), t = data.tbank;
  const nearestDate = plan.rows[0]?.plannedDate;
  const nearest = plan.rows.filter(p => p.plannedDate === nearestDate);
  const nearestGap = nearest.reduce((sum, p) => sum + (p.gap ?? 0), 0);
  const nearestUnknown = nearest.some(p => p.unknown);
  const knownLimit = t.status === 'verified' && t.freeRemainingMinor !== null;
  const boxes = [...data.manager.cashboxes].sort((a, b) => b.balance - a.balance);
  const cashTotal = boxes.reduce((sum, c) => sum + c.balance, 0);
  const conditional = !plan.reservationsComplete || !plan.sourcesKnown;
  const managerCapacity = plan.boxes.reduce((sum,b)=>sum+b.available,0)/100;
  const tbankCandidate = knownLimit && t.freeRemainingMinor! > 0 && (ownerAmount(data,'Т-Банк КБР')??0)>0;
  const cashFallbackRelevant = plan.rows.some(r=>['CASH','USDT','CNY'].includes(r.paymentMethod)&&!r.walletCovered&&!r.unknown&&(includeManagerCash||r.gap!>0));
  const toggle = (id: string, checked: boolean) => setExcluded(ids => checked ? ids.filter(i=>i!==id) : [...new Set([...ids,id])]);
  return <div className="funding-preview">
    {stale && <p role="status" className="fp-warning">Свежий расчёт пока недоступен. Показаны последние полученные сведения; не используйте их для выдачи без обновления. Обновление повторится автоматически.</p>}
    <p className="fp-updated" role="status">{refreshing&&!stale ? 'Обновляем данные · пока показан предыдущий расчёт от ' : 'Расчёт от '}{data.capturedAt ? new Date(data.capturedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}) : day(data.asOf)}</p>
    <div className="fp-intro"><h2>Подготовка денег</h2><span className="fp-total">{plan.totalComplete ? 'По выбранным заявкам' : 'Известная часть'} <b>{rub(plan.total)}</b></span></div>
    <div className="fp-context"><span className="fp-badge">План подготовки</span><span>{conditional ? 'Предварительно: не все обязательства подтверждены.' : 'Сначала готовые деньги, затем банк. Кассы менеджеров — по вашему выбору.'}</span><button type="button" onClick={() => {conditions.current?.scrollIntoView({block:'start'}); conditions.current?.focus({preventScroll:true});}}>Что учтено</button></div>
    <div className="fp-main">
      <div className="fp-left">
        {nearest.length ? <section className="fp-card fp-priority">
          <header><div className="fp-priority-date"><CalendarDays size={20}/><h3>{nearestDate!.slice(0, 10) < data.asOf ? 'Срок прошёл · ' : 'Ближайшая выплата · '}{day(nearestDate!)}</h3></div><span className="fp-badge fp-attention">{nearestUnknown ? 'Нужны данные' : nearestGap > 0 ? 'Осталось подобрать источник' : 'Вариант подготовки'}</span></header>
          {nearest.map(r => <div className="fp-nearest" key={r.id}>
            <div className="fp-payment-head"><label><input type="checkbox" aria-label={'Включить ' + r.supplier} checked onChange={e => toggle(r.id, e.target.checked)}/><span><b>{r.supplier}</b><small>{method(r.paymentMethod)}{r.foreignAmount && r.paymentMethod === 'USDT' ? ' · ' + r.foreignAmount.toLocaleString('ru-RU') + ' USDT' : ''}</small></span></label>
              <div className="fp-payment-amount"><strong>{r.need === null ? 'Сумма не подтверждена' : r.walletCovered ? r.foreignAmount?.toLocaleString('ru-RU') + '\u00a0USDT' : rub(r.need)}</strong><small>{r.walletCovered ? 'Из кассы USDT' : ['USDT', 'CNY'].includes(r.paymentMethod) ? 'Рублёвый ориентир заявки' : 'Подготовить к оплате'}</small></div>
            </div>
            {r.unknown ? <p className="fp-warning">{r.blockedByEarlier ? 'Сначала нужен расчёт более ранней заявки: иначе одни деньги могут быть предложены дважды.' : 'Для этой заявки не подтверждены сумма или остаток нужной валюты. Распределение не выполнено.'}</p> : <>
              <div className="fp-step-label">{includeManagerCash ? 'Вариант с кассами менеджеров' : 'Основной вариант'}</div><Steps steps={r.steps}/>
              {r.gap! > 0 && <div className="fp-shortfall"><span>Подобрать источник ещё на</span><strong>{rub(r.gap!)}</strong></div>}
            </>}
          </div>)}
          <div className="fp-next-action"><AlertCircle size={19}/><div><b>{nearestUnknown ? 'Сначала — подтверждение исходных данных' : nearestGap > 0 ? (tbankCandidate ? 'Проверить возможность снятия через Т-Банк' : 'Проверить дополнительное снятие или другой источник') : 'Перед выдачей — проверить доступность денег'}</b>
            <p>{nearestUnknown ? 'Сумма не заменена нулём. Известные остатки показаны отдельно.' : nearestGap > 0 ? (tbankCandidate ? `По выписке на ${day(t.statementDate)} осталось ${rub(t.freeRemainingMinor!/100)} переводов без комиссии. Перед использованием проверьте актуальный лимит и условия снятия. Эта сумма пока не включена в план.` : 'Вариант не покрывает всю оплату — это не означает, что денег нет. Сегодняшний доступный лимит снятия не подтверждён и в расчёт не включён.') : 'Будущие снятия нужно успеть выполнить к оплате. Расчёт не создаёт выдачу и не учитывает комиссии.'}</p></div></div>
          {cashFallbackRelevant && plan.managersAllowed && (managerCapacity>0||includeManagerCash) && <div className="fp-alternative">
            <label><input type="checkbox" checked={includeManagerCash} onChange={e=>setIncludeManagerCash(e.target.checked)}/><span>Подключить кассы менеджеров</span></label>
            <p>{includeManagerCash ? 'Для всех выбранных выплат, только если не хватает сейфа и банка. Перед выдачей оставьте необходимую наличность для работы магазина.' : `Для выбранных выплат доступно до ${rub(managerCapacity)} после учтённых обязательств. Основной вариант эти деньги не затрагивает.`}</p>
          </div>}
        </section> : <section className="fp-card fp-empty"><h3>{active.length ? 'Нет выбранных выплат' : 'Нет заявок к оплате'}</h3>{active.length > 0 && <><p>Отметьте заявки ниже — источники и даты пересчитаются.</p><button onClick={() => setExcluded([])}>Вернуть все заявки</button></>}</section>}
        <section className="fp-card fp-queue"><header><h3>Остальные выплаты</h3><button className="fp-reset" onClick={() => {setExcluded([]); setExpanded('');setIncludeManagerCash(false);}}><RotateCcw size={13}/> Сбросить выбор</button></header>
          {active.filter(p => !nearest.some(n => n.id === p.id)).map(p => {
            const r = plan.rows.find(row => row.id === p.id);
            return <article className={'fp-queue-row ' + (!r ? 'fp-excluded' : '')} key={p.id}>
              <div className="fp-queue-head"><label><input type="checkbox" aria-label={'Включить ' + p.supplier} checked={!!r} onChange={e => toggle(p.id, e.target.checked)}/><span><b>{p.supplier}</b><small>{day(p.plannedDate)} · {method(p.paymentMethod)}</small></span></label><strong>{!r ? 'Не включена' : r.need === null ? 'Нужны данные' : r.walletCovered ? p.foreignAmount?.toLocaleString('ru-RU') + '\u00a0USDT' : rub(r.need)}</strong></div>
              {r && <><button className="fp-detail" aria-expanded={expanded === p.id} onClick={() => setExpanded(expanded === p.id ? '' : p.id)}>{r.unknown ? 'Почему нет расчёта' : r.gap! > 0 ? 'В варианте не покрыто ' + rub(r.gap!) : 'Источники и даты'}<ChevronDown size={14}/></button>
                {expanded === p.id && <div className="fp-row-details">{r.unknown ? <p>Недостаточно данных этой или более ранней выбранной заявки. Её потребность нельзя считать нулевой.</p> : <><Steps steps={r.steps}/><p>На счёте ВТБ после этого сценария: {rub(r.bankAfter)}. Это не свободный остаток: неподтверждённые обязательства ещё не вычтены.</p></>}</div>}</>}
            </article>;
          })}
          {active.length === nearest.length && <p className="fp-empty-line">Других заявок нет.</p>}
        </section>
        <section ref={conditions} tabIndex={-1} className="fp-card fp-conditions" id="funding-conditions"><header><h3>Что учтено в расчёте</h3></header>
          <dl><div><dt>Аренда и коммунальные · ежемесячный ориентир</dt><dd>{rub(RENT_RESERVE_MINOR / 100)}</dd></div><div><dt>Зарплата</dt><dd>{plan.salaryMinor === null ? 'Резерв не подтверждён' : rub(plan.salaryMinor / 100)}</dd></div>
          {data.manager.unassignedCount > 0 && <div><dt>Заявки 1С без назначенной кассы · {data.manager.unassignedCount}</dt><dd>{rub(data.manager.unassignedAmount)}</dd></div>}</dl>
          <p>Аренда и подтверждённый остаток зарплаты удержаны из источников сценария.{data.manager.unassignedCount > 0 ? ' Заявки без кассы не вычтены повторно: их пересечение с оплатами портала ещё не проверено.' : data.forecastPolicy?.excludedCount ? ' Согласованные вами старые заявки 1С исключены из прогноза; сами документы не изменены.' : ''}{plan.salaryMinor === null ? ' Неизвестный резерв зарплаты не заменён нулём.' : ''}</p>
          {plan.reserveGap > 0 && <p className="fp-warning">Даже для известного резерва в выбранных источниках недостаёт {rub(plan.reserveGap)}.</p>}
          <details><summary>Источники и ограничения <ChevronDown size={14}/></summary><p>Заявки — снимок портала на {day(data.observedAt)}; остатки 1С — на {day(data.asOf)}. Пересчёт выбора не обновляет снимок и не меняет заявки.</p><p>ВТБ: настроенный лимит снятия 350 000 ₽ в день распределён между заявками один раз. Будущие снятия — вариант; время выдачи, доступность банкомата и комиссии не подтверждены. Выплата в день снятия требует проверки времени.</p><p>Т-Банк: лимит за {day(t.statementDate)} сохранён для справки и не используется для текущего снятия. Пополнение лимита в будущем автоматически не предполагается.</p><p>USDT: если остатка хватает на всю заявку — используется касса USDT; иначе вся заявка рассматривается как обмен за рубли. Последний курс в 1С: {data.rate.rate === null ? 'не подтверждён' : data.rate.rate + ' ₽'}{data.rate.conversionAt ? ' от ' + day(data.rate.conversionAt) : ''}. Рублёвый ориентир взят из заявки, не пересчитан по округлённой сумме USDT.</p></details>
        </section>
      </div>
      <aside className="fp-side">
        <section className="fp-card fp-bank"><header><h3><Landmark size={18}/> Т-Банк</h3>{knownLimit && <span className="fp-source-date">На {day(t.statementDate)}</span>}</header>
          <div className="fp-bank-limit"><span>Осталось без комиссии</span><strong>{knownLimit ? rub(t.freeRemainingMinor! / 100) : 'Выписка требует проверки'}</strong></div>
          {knownLimit && <dl>{t.tierOneRemainingMinor !== null && <div><dt>Далее · 1% + 59 ₽</dt><dd>{rub(t.tierOneRemainingMinor / 100)}</dd></div>}<div><dt>Новый период</dt><dd>{day(t.renewsOn)}</dd></div></dl>}
          <p className="fp-bank-note">{!knownLimit ? 'Лимит не подтверждён и не используется в расчёте.' : t.current ? 'По доступной выписке; условия снятия проверяются отдельно.' : 'Операции после ' + day(t.statementDate) + ' не учтены. Это ориентир, не текущий лимит.'}</p>
          {knownLimit && <details><summary>Расчёт лимита <ChevronDown size={13}/></summary><p>Период {day(t.periodFrom)} — {day(t.renewsOn)}. По настроенному тарифу: {t.freeLimitMinor === null ? 'лимит не подтверждён' : 'лимит ' + rub(t.freeLimitMinor / 100)}; {t.transferredMinor === null ? 'расход не подтверждён' : 'использовано ' + rub(t.transferredMinor / 100)}.</p></details>}
        </section>
        <section className="fp-card fp-cash"><header><h3><WalletCards size={18}/> Кассы менеджеров</h3><span className="fp-source-date">По 1С</span></header>
          <div className="fp-cash-total"><span>Учётный остаток</span><b>{data.managerAvailable===false?'Данные не получены':rub(cashTotal)}</b></div><dl>{boxes.map(b => <div key={b.ref}><dt>{b.name.replace('Касса ', '').trim()}</dt><dd>{rub(b.balance)}</dd></div>)}</dl>
          <p className="fp-bank-note">{plan.managersAllowed ? includeManagerCash ? 'Подключены к расчёту: сначала используется крупнейшая доступная касса, только если не хватает сейфа и банка.' : 'Не используются в основном варианте. Их можно подключить к расчёту отдельно.' : 'Не распределены в варианте: не все остатки и обязательства подтверждены. Это не означает, что кассы пусты.'}</p>
        </section>
        <section className="fp-card fp-accounts"><header><h3>Ваши счета и кассы</h3><span className="fp-source-date">По 1С</span></header><dl>{data.owner.accountNames.map(n => {const amount = ownerAmount(data, n); return <div key={n}><dt>{n}</dt><dd className={amount !== null && amount < 0 ? 'fp-negative' : ''}>{amount === null ? 'Не подтверждён' : rub(amount)}</dd></div>;})}{data.extraCash.map(c => <div key={c.name}><dt>{c.name}</dt><dd>{rub(c.balance)}</dd></div>)}</dl><p className="fp-account-note">Отрицательный остаток и расходный сейф не используются в варианте.</p></section>
      </aside>
    </div>
  </div>;
}
