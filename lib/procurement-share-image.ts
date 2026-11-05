/** A transfer copy only: keep the complete source image above a separate white footer. */
export async function requisitesImageWithAmount(file: File, transferText: string): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Сумму можно добавить к изображению. Этот файл не является картинкой.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Не удалось открыть изображение для отправки.'));
      image.src = url;
    });
    const width = Math.max(image.naturalWidth, 480);
    const height = image.naturalHeight;
    const fontSize = Math.max(28, Math.min(96, Math.round(width * 0.065)));
    const lines = transferText.split('\n').filter(Boolean);
    const fonts = lines.map((line, index) => index === 0 ? fontSize : Math.max(18, Math.min(fontSize, Math.floor((width - 48) / (line.length * 0.65)))));
    const lineHeights = fonts.map(size => Math.ceil(size * 1.6));
    const footer = lineHeights.reduce((sum, h) => sum + h, 0) + fontSize;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height + footer;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не удалось подготовить изображение для отправки.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height + footer);
    // No crop, resize, QR extraction or re-encoding of the QR contents.
    ctx.drawImage(image, Math.floor((width - image.naturalWidth) / 2), 0);
    ctx.fillStyle = '#111';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let top = height + fontSize / 2;
    lines.forEach((line, index) => {
      ctx.font = `${index === 0 ? 600 : 400} ${fonts[index]}px ${index === 0 ? 'system-ui, sans-serif' : 'monospace'}`;
      ctx.fillText(line, width / 2, top + lineHeights[index] / 2, width - 48);
      top += lineHeights[index];
    });
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('Не удалось сохранить копию для отправки.')), 'image/png',
    ));
    return new File([blob], 'qr-code-with-amount.png', { type: 'image/png' });
  } finally { URL.revokeObjectURL(url); }
}

/** Text-only requisites become one readable card when included in a multi-payment bundle. */
export async function requisitesTextImage(text:string):Promise<File>{
 const canvas=document.createElement('canvas');canvas.width=1000;
 const lines=text.split('\n').flatMap(line=>line.match(/.{1,48}/gu)||['']);
 canvas.height=80+lines.length*52;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось подготовить реквизиты.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';
 lines.forEach((line,i)=>{ctx.font=`${i===0?'600 40px system-ui':'30px monospace'}`;ctx.fillText(line,500,66+i*52,936);});
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Не удалось подготовить реквизиты.')),'image/png'));
 return new File([blob],'requisites-with-amount.png',{type:'image/png'});
}
