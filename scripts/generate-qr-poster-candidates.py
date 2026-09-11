from pathlib import Path
import subprocess
import sys

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "pdfs"
PDF_OUTPUT = ROOT / "output" / "pdf"
PREVIEW_OUTPUT = ROOT / "public" / "print" / "candidates"
ACTIVE_OUTPUT = ROOT / "public" / "print"
QR_CLI = ROOT / "node_modules" / ".bin" / "qrcode"

INK = HexColor("#171C24")
BLUE = HexColor("#263B5C")
YELLOW = HexColor("#FFC247")
PAPER = HexColor("#F7F4EC")
SURFACE = HexColor("#FFFFFF")
MUTED = HexColor("#667085")
LINE = HexColor("#D9DEE4")

pdfmetrics.registerFont(TTFont("Portal", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("PortalBold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))


def set_text(c, value, x, y, size, color=INK, bold=False):
    c.setFont("PortalBold" if bold else "Portal", size)
    c.setFillColor(color)
    c.drawString(x, y, value)


def scan_badge(c, x, y, size, dark=True):
    c.setFillColor(INK if dark else white)
    c.roundRect(x, y, size, size, 2.7 * mm, fill=1, stroke=0)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.setLineWidth(size * 0.075)
    c.setStrokeColor(white if dark else INK)
    arm = size * .20
    inset = size * .27
    for sx, sy, dx, dy in ((1, 1, 1, 1), (-1, 1, -1, 1), (1, -1, 1, -1), (-1, -1, -1, -1)):
        px = x + size / 2 + sx * inset
        py = y + size / 2 + sy * inset
        c.line(px, py, px - dx * arm, py)
        c.line(px, py, px, py - dy * arm)
    c.setFillColor(YELLOW)
    c.circle(x + size / 2, y + size / 2, size * .09, fill=1, stroke=0)


def qr_file(department):
    path = TMP / f"candidate-{department}-qr.png"
    subprocess.run([
        str(QR_CLI), "-e", "M", "-w", "1000", "-q", "2",
        "-d", "171C24FF", "-l", "FFFFFFFF", "-o", str(path),
        f"offonika-workday-start:{department}",
    ], check=True)
    return path


def qr_card(c, qr_path, x, y, size, shadow=True):
    if shadow:
        c.setFillColor(HexColor("#D8D5CD"))
        c.roundRect(x + 1.4 * mm, y - 1.4 * mm, size, size, 4.2 * mm, fill=1, stroke=0)
    c.setFillColor(SURFACE)
    c.roundRect(x, y, size, size, 4.2 * mm, fill=1, stroke=0)
    inset = 5 * mm
    c.drawImage(str(qr_path), x + inset, y + inset, size - 2 * inset, size - 2 * inset, preserveAspectRatio=True, mask="auto")


def department_pill(c, label, x, y, width, dark=False):
    c.setFillColor(YELLOW if not dark else HexColor("#313741"))
    c.roundRect(x, y, width, 8 * mm, 4 * mm, fill=1, stroke=0)
    c.setFont("PortalBold", 7.4)
    c.setFillColor(INK if not dark else white)
    c.drawCentredString(x + width / 2, y + 2.65 * mm, label.upper())


def render_pdf(pdf_path, png_path):
    subprocess.run([
        "pdftoppm", "-f", "1", "-singlefile", "-png",
        "-scale-to-x", "1481", "-scale-to-y", "-1",
        str(pdf_path), str(png_path.with_suffix("")),
    ], check=True)


def build_editorial(department, label):
    qr_path = qr_file(department)
    pdf_path = PDF_OUTPUT / f"qr-poster-a-editorial-{department}.pdf"
    png_path = PREVIEW_OUTPUT / f"qr-poster-a-editorial-{department}.png"
    c = canvas.Canvas(str(pdf_path), pagesize=A5)
    width, height = A5

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(HexColor("#F1EDE3"))
    c.circle(width + 8 * mm, height - 28 * mm, 44 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFF0C8"))
    c.circle(width - 8 * mm, height - 18 * mm, 13 * mm, fill=1, stroke=0)

    scan_badge(c, 13 * mm, height - 25 * mm, 12 * mm)
    set_text(c, "НАЧАЛО РАБОЧЕГО ДНЯ", 30 * mm, height - 20.8 * mm, 8.2, BLUE, bold=True)
    department_pill(c, label, width - 45 * mm, height - 23 * mm, 31 * mm)

    set_text(c, "Начни смену", 13 * mm, height - 49 * mm, 25, bold=True)
    set_text(c, "одним сканированием", 13 * mm, height - 62 * mm, 25, bold=True)
    set_text(c, "Открой приложение и наведи камеру на QR-код.", 13 * mm, height - 72 * mm, 9.2, MUTED)

    qr_size = 75 * mm
    qr_card(c, qr_path, (width - qr_size) / 2, 61 * mm, qr_size)

    steps = [("1", "Открой приложение"), ("2", "Сканируй QR"), ("3", "Выбери смену")]
    start_x = 13 * mm
    step_width = (width - 26 * mm) / 3
    for index, (number, value) in enumerate(steps):
        x = start_x + index * step_width
        c.setFillColor(INK)
        c.circle(x + 4 * mm, 43 * mm, 4 * mm, fill=1, stroke=0)
        c.setFillColor(YELLOW)
        c.circle(x + 4 * mm, 43 * mm, 1.15 * mm, fill=1, stroke=0)
        set_text(c, number, x + 2.8 * mm, 41.7 * mm, 6.5, white, bold=True)
        set_text(c, value, x, 32 * mm, 7.7, INK, bold=True)

    c.setFillColor(INK)
    c.roundRect(13 * mm, 12 * mm, width - 26 * mm, 11 * mm, 5.5 * mm, fill=1, stroke=0)
    c.setFont("PortalBold", 8)
    c.setFillColor(white)
    c.drawCentredString(width / 2, 15.9 * mm, "После сканирования подтверди начало рабочего дня")
    c.showPage()
    c.save()
    render_pdf(pdf_path, png_path)


def build_wayfinding(department, label, activate=False):
    qr_path = qr_file(department)
    if activate:
        pdf_path = ACTIVE_OUTPUT / f"portal-workday-{department}-a5.pdf"
        png_path = ACTIVE_OUTPUT / f"portal-workday-{department}-a5.png"
    else:
        pdf_path = PDF_OUTPUT / f"qr-poster-b-wayfinding-{department}.pdf"
        png_path = PREVIEW_OUTPUT / f"qr-poster-b-wayfinding-{department}.png"
    c = canvas.Canvas(str(pdf_path), pagesize=A5)
    width, height = A5

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    top_height = 76 * mm
    c.setFillColor(INK)
    c.rect(0, height - top_height, width, top_height, fill=1, stroke=0)
    c.setFillColor(HexColor("#202733"))
    c.circle(width - 2 * mm, height - 8 * mm, 47 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#2C3037"))
    c.circle(width - 4 * mm, height - 12 * mm, 28 * mm, fill=1, stroke=0)

    scan_badge(c, 13 * mm, height - 24 * mm, 11 * mm, dark=False)
    set_text(c, "НАЧАЛО РАБОЧЕГО ДНЯ", 29 * mm, height - 20.2 * mm, 8.2, white, bold=True)
    department_pill(c, label, width - 45 * mm, height - 23 * mm, 31 * mm, dark=True)
    set_text(c, "Здесь начинается", 13 * mm, height - 45 * mm, 25, white, bold=True)
    set_text(c, "твой рабочий день", 13 * mm, height - 59 * mm, 25, white, bold=True)
    c.setFillColor(YELLOW)
    c.roundRect(13 * mm, height - 67 * mm, 31 * mm, 1.6 * mm, .8 * mm, fill=1, stroke=0)

    qr_card(c, qr_path, 13 * mm, 46 * mm, 74 * mm, shadow=False)
    set_text(c, "НАВЕДИ КАМЕРУ", 13 * mm, 38 * mm, 7.2, BLUE, bold=True)
    set_text(c, "QR работает для выбранного отдела", 13 * mm, 32.5 * mm, 7.2, MUTED)

    steps = [("01", "Открой", "приложение"), ("02", "Отсканируй", "этот QR"), ("03", "Подтверди", "свою смену")]
    step_x = 96 * mm
    for index, (number, first, second) in enumerate(steps):
        y = 102 * mm - index * 28 * mm
        set_text(c, number, step_x, y + 7 * mm, 7, HexColor("#8A650E"), bold=True)
        set_text(c, first, step_x, y, 10, INK, bold=True)
        set_text(c, second, step_x, y - 5 * mm, 10, INK, bold=True)
        if index < 2:
            c.setStrokeColor(LINE)
            c.setLineWidth(.35 * mm)
            c.line(step_x, y - 11 * mm, width - 13 * mm, y - 11 * mm)

    c.setFillColor(HexColor("#FFF1C9"))
    c.roundRect(13 * mm, 12 * mm, width - 26 * mm, 11 * mm, 5.5 * mm, fill=1, stroke=0)
    c.setFont("PortalBold", 8)
    c.setFillColor(INK)
    c.drawCentredString(width / 2, 15.9 * mm, "Сканирование фиксирует время начала рабочего дня")
    c.showPage()
    c.save()
    render_pdf(pdf_path, png_path)


if __name__ == "__main__":
    TMP.mkdir(parents=True, exist_ok=True)
    PDF_OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEW_OUTPUT.mkdir(parents=True, exist_ok=True)
    ACTIVE_OUTPUT.mkdir(parents=True, exist_ok=True)
    activate_wayfinding = "--activate-wayfinding" in sys.argv
    for department, label in (("retail", "Розница"), ("wholesale", "Опт")):
        if activate_wayfinding:
            build_wayfinding(department, label, activate=True)
        else:
            build_editorial(department, label)
            build_wayfinding(department, label)
