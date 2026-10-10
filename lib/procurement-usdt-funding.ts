/** Source is a preparation plan, never proof that a transfer has happened. */
export function walletFundingAvailable(amount: unknown, available: number | null) {
  const value=Number(amount);
  return Number.isFinite(value)&&value>0&&available!=null&&Number.isFinite(available)&&value<=available+0.0000001;
}
export function fundingSourceLabel(source?:string|null) {
  return source==='WALLET'?'Из кассы USDT':source==='CASH_EXCHANGE'?'Наличные для обмена в USDT':'Источник USDT не выбран';
}
