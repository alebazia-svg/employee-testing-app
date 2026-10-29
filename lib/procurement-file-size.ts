/** Human-readable attachment size, including files smaller than one megabyte. */
export function procurementFileSize(bytes:number){
 const unit=bytes<1024?'Б':bytes<1024*1024?'КБ':'МБ';
 const size=bytes/(unit==='Б'?1:unit==='КБ'?1024:1024*1024);
 return `${size.toLocaleString('ru-RU',{maximumFractionDigits:1})} ${unit}`;
}
