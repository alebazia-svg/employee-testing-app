"""Reproduce MOBO A5 artwork with vector text and QR, in light or graphite-header form.

Run with the Codex bundled Python (ReportLab, pypdf and pdfplumber).
Regenerates the approved A5 print assets. Existing canonical QR payloads are retained.
"""
from pathlib import Path
import json
import subprocess
import argparse

from reportlab.lib.colors import HexColor, CMYKColor, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/mobo-copper-qr'
ICON = ROOT / 'public/print/assets/mobo-app-copper-512.png'
WIDTH, HEIGHT = 148 * mm, 210 * mm
BG = '#F6F3EA'
INK = '#1B2028'
MUTED = '#4E5050'
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
pdfmetrics.registerFont(TTFont('MoboText', str(FONT_DIR / 'Arial.ttf')))
pdfmetrics.registerFont(TTFont('MoboBold', str(FONT_DIR / 'Arial Bold.ttf')))


def label(c, value, x, baseline, size, bold=False, color=INK, max_width=None, center=False):
    font = 'MoboBold' if bold else 'MoboText'
    if max_width is not None:
        assert pdfmetrics.stringWidth(value, font, size) <= max_width * mm, value
    c.setFont(font, size)
    c.setFillColor(HexColor(color))
    (c.drawCentredString if center else c.drawString)(x * mm, HEIGHT - baseline * mm, value)


def rounded(c, x, top, width, height, radius, color, alpha=None):
    c.setFillColor(HexColor(color))
    if alpha is not None:
        c.setFillAlpha(alpha)
    c.roundRect(x * mm, HEIGHT - (top + height) * mm,
                width * mm, height * mm, radius * mm, fill=1, stroke=0)


def inline_label(c, runs, x, baseline, size, max_width=122):
    widths = [pdfmetrics.stringWidth(text, 'MoboBold' if bold else 'MoboText', size)
              for text, bold in runs]
    assert sum(widths) <= max_width * mm
    cursor = x
    for (text, bold), width in zip(runs, widths):
        label(c, text, cursor, baseline, size, bold=bold, color=MUTED)
        cursor += width / mm


def draw_icon(c):
    # Exact published PWA asset from team.mobo-opt.ru (verified 2026-10-05).
    # SHA256: 168cbe08ef562ff29dab1b3a97a34a76410275a52fa005c61c30fa19dfd0a71d
    # Preserve its material/geometry; only a short external shadow is added.
    x, top, size, radius = 13, 12, 15, 3.3
    for spread, shift, alpha in [(1.0, .75, .010), (.65, .55, .014), (.35, .35, .019), (.1, .2, .026)]:
        c.saveState()
        rounded(c, x-spread, top+shift-spread, size+2*spread,
                size+2*spread, radius+spread, '#494133', alpha=alpha)
        c.restoreState()
    c.saveState()
    p = c.beginPath()
    p.roundRect(x*mm, HEIGHT-(top+size)*mm, size*mm, size*mm, radius*mm)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(str(ICON), x*mm, HEIGHT-(top+size)*mm,
                size*mm, size*mm, mask='auto')
    c.restoreState()


def matrix_for(department):
    # Same QR library and payloads used by the portal. M correction, four-module quiet zone.
    script = """const QR=require('qrcode');
const q=QR.create(process.argv[1],{errorCorrectionLevel:'M'});
console.log(JSON.stringify({size:q.modules.size,data:Array.from(q.modules.data)}));"""
    return json.loads(subprocess.check_output(
        ['node', '-e', script, f'offonika-workday-start:{department}'], cwd=ROOT, text=True))


def draw_qr(c, matrix):
    x, top, card = 11, 82.3, 72
    rounded(c, x, top, card, card, 4.5, '#FFFFFF')
    n = matrix['size']
    total = 70 * mm
    module = total / (n + 8)
    left = (x + 1) * mm + 4 * module
    bottom = HEIGHT - (top + 1) * mm - 4 * module
    c.setFillColor(CMYKColor(0, 0, 0, 1))
    p = c.beginPath()
    for row in range(n):
        col = 0
        while col < n:
            if not matrix['data'][row*n+col]:
                col += 1
                continue
            first = col
            while col < n and matrix['data'][row*n+col]:
                col += 1
            p.rect(left+first*module, bottom-(row+1)*module,
                   (col-first)*module, module)
    c.drawPath(p, fill=1, stroke=0)
    return {'matrix_modules': n, 'module_mm': module/mm,
            'quiet_zone_mm': 4*module/mm, 'card_mm': card}


def draw_header_circles(c, graphite=False):
    # Restore the offset, filled discs from the graphite reference, translated
    # into warm stone tones. PDF axial shadings keep transitions vector-sharp.
    for cx, top, radius, tones in [
        (142.5, 11.5, 43.5, ['#252D36', '#242A32', '#222932'] if graphite else ['#E6E0D5', '#EFEBE2', '#E2DDD3']),
        (144, 12, 27.5, ['#34383D', '#30353A', '#373B40'] if graphite else ['#F3F0E9', '#E6E0D6', '#DAD4C8']),
    ]:
        c.saveState()
        p = c.beginPath()
        p.circle(cx*mm, HEIGHT-top*mm, radius*mm)
        c.clipPath(p, stroke=0, fill=0)
        c.linearGradient((cx-radius)*mm, HEIGHT-(top-radius)*mm,
                         (cx+radius)*mm, HEIGHT-(top+radius)*mm,
                         [HexColor(tone) for tone in tones], [0, .55, 1])
        c.restoreState()


def build(department, department_label, theme='light', destination=OUT):
    graphite = theme == 'graphite'
    header_text = '#FFFFFF' if graphite else INK
    path = destination / f'mobo-workday-{department}-{theme}-a5.pdf'
    c = canvas.Canvas(str(path), pagesize=(WIDTH, HEIGHT), pageCompression=1)
    c.setTitle(f'MOBO — {department_label} — начало рабочего дня — A5')
    c.setAuthor('MOBO')
    c.setSubject(f'Плакат отдела {department_label}. Печать A5, 100%.')
    c.setFillColor(HexColor(BG))
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    if graphite:
        c.setFillColor(HexColor('#1B2028'))
        c.rect(0, HEIGHT-75*mm, WIDTH, 75*mm, fill=1, stroke=0)
    draw_header_circles(c, graphite)

    draw_icon(c)
    label(c, 'Приложение MOBO', 34, 21.7, 11.6, bold=True, max_width=60, color=header_text)
    # A porcelain badge with a restrained warm edge remains distinct over both discs.
    rounded(c, 95.5, 15, 42, 10.8, 5.4, '#30363F' if graphite else '#FFFCF5')
    c.setStrokeColor(HexColor('#4A5058' if graphite else '#CCC4B6'))
    c.setLineWidth(.22*mm)
    c.roundRect(95.5*mm, HEIGHT-25.8*mm, 42*mm, 10.8*mm, 5.4*mm,
                fill=0, stroke=1)
    label(c, department_label.upper(), 116.5, 21.9, 9.3, bold=True, center=True, color=header_text)

    label(c, 'Здесь начинается', 13, 50.5, 30, bold=True, max_width=122, color=header_text)
    label(c, 'твой рабочий день', 13, 62, 30, bold=True, max_width=122, color=header_text)
    rounded(c, 13, 67.95, 37.5, 1.5, .75, '#E4A16C')

    qr = draw_qr(c, matrix_for(department))
    for index, (top, lines) in enumerate([
        (84, ('Открой', 'приложение')),
        (110, ('Нажми «Начать', 'рабочий день»')),
        (142, ('Выбери', 'свою смену')),
    ]):
        label(c, f'{index+1:02}', 90, top+4.5, 9.5, bold=True, color='#975B36')
        for offset, line in enumerate(lines):
            label(c, line, 90, top+11+offset*5.8, 14, bold=True, max_width=47)
        if index == 1:
            label(c, 'Отсканируй QR', 90, 134.5, 11.5, bold=True, color='#975B36', max_width=47)
        if index < 2:
            c.setStrokeColor(HexColor('#D4D1C8'))
            c.setLineWidth(.25*mm)
            separator = 106.5 if index == 0 else 139
            c.line(90*mm, HEIGHT-separator*mm, 137*mm, HEIGHT-separator*mm)

    rounded(c, 10, 164.5, 128, 11, 5.5, '#EED1B7')
    label(c, 'Сканирование фиксирует время начала рабочего дня',
          74, 171.15, 9.2, bold=True, center=True, max_width=118)
    inline_label(c, [('Установка: открой ', False), ('team.mobo-opt.ru', True)], 13, 181, 10)
    # Two equal installation columns, retaining the larger readable text.
    for x, heading, lines in [
        (13, 'iPhone · Safari', ('Поделиться →', 'На экран «Домой» →', 'Добавить')),
        (79, 'Android · Chrome', ('Три точки →', 'Установить и создать ярлык →', 'Установить')),
    ]:
        label(c, heading, x, 188, 9.5, bold=True, color='#975B36', max_width=56)
        for index, line in enumerate(lines):
            label(c, line, x, 193+index*4.5, 9.5, color=MUTED, max_width=56)
    c.setStrokeColor(HexColor('#D4D1C8'))
    c.setLineWidth(.25*mm)
    c.line(73*mm, HEIGHT-185*mm, 73*mm, HEIGHT-203*mm)
    c.linkURL('https://team.mobo-opt.ru',
              (13*mm, HEIGHT-182*mm, 135*mm, HEIGHT-177*mm), relative=0)
    c.showPage()
    c.save()
    return {'department': department, 'label': department_label,
            'pdf': path.name, 'payload': f'offonika-workday-start:{department}', **qr}


if __name__ == '__main__':
    import shutil
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=OUT)
    parser.add_argument('--activate', action='store_true', help='Update local portal PDF/PNG assets')
    args = parser.parse_args()
    destination = args.output_dir
    destination.mkdir(parents=True, exist_ok=True)
    posters = []
    for department, title in [('retail', 'Розница'), ('wholesale', 'Опт')]:
        result = build(department, title, 'graphite', destination)
        pdf = destination / result['pdf']
        subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-r', '300', '-png',
                        str(pdf), str(pdf.with_suffix(''))], check=True)
        if args.activate:
            for ext in ['.pdf', '.png']:
                shutil.copy2(pdf.with_suffix(ext), ROOT / 'public/print' / f'portal-workday-{department}-a5{ext}')
        posters.append(result)
    spec = {'theme': 'graphite-copper', 'page_mm': [148, 210],
            'icon': str(ICON.relative_to(ROOT)), 'posters': posters}
    (destination / 'print-spec.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(spec, ensure_ascii=False, indent=2))
