'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function WorkdayStartComment({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useEffect(() => {
    if (expanded || !paragraph.current) return;
    const element = paragraph.current;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, text]);
  if (!text.trim()) return null;
  return <section className='team-start-comment' aria-label='Комментарий к началу смены'>
    <b>Комментарий к началу смены</b>
    <p ref={paragraph} id={id} className={expanded ? '' : 'is-collapsed'}>{text}</p>
    {(overflows || expanded) && <button type='button' aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? 'Свернуть' : 'Развернуть'}</button>}
  </section>;
}
