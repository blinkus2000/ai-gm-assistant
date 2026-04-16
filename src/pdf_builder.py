"""
PDF Builder — generates illustrated PDF adventure modules using fpdf2.

Takes generated module content, creates illustrations via Gemini image gen,
and compiles everything into a styled PDF. Uses fpdf2 (pure Python, no
system dependencies required).
"""

from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path

from fpdf import FPDF

from .generator import GeneratedModule, generate_illustration
from .paths import get_data_dir

logger = logging.getLogger(__name__)

OUTPUT_DIR = get_data_dir() / "modules"

# Google Fonts directory — we'll download if needed
FONTS_DIR = get_data_dir() / "fonts"


class ModulePDF(FPDF):
    """Custom PDF with TTRPG module styling."""

    def __init__(self, title: str, campaign_name: str, game_system: str):
        super().__init__()
        self.module_title = title
        self.campaign_name = campaign_name
        self.game_system = game_system

        # Use built-in fonts (no TTF needed)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(139, 115, 85)
            self.cell(0, 8, self.module_title, align="C")
            self.ln(4)
            # Decorative line
            self.set_draw_color(139, 115, 85)
            self.set_line_width(0.3)
            self.line(20, self.get_y(), self.w - 20, self.get_y())
            self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(139, 115, 85)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def title_page(self):
        """Render a styled title page."""
        self.add_page()
        self.ln(60)

        # Decorative top line
        self.set_draw_color(123, 45, 38)
        self.set_line_width(1)
        self.line(40, self.get_y(), self.w - 40, self.get_y())
        self.ln(10)

        # Title
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(123, 45, 38)
        self.multi_cell(0, 14, self.module_title, align="C")
        self.ln(8)

        # Decorative bottom line
        self.set_draw_color(139, 115, 85)
        self.set_line_width(0.5)
        self.line(50, self.get_y(), self.w - 50, self.get_y())
        self.ln(10)

        # Campaign / System meta
        self.set_font("Helvetica", "", 14)
        self.set_text_color(139, 115, 85)
        self.cell(0, 8, self.campaign_name, align="C")
        self.ln(8)
        self.set_font("Helvetica", "I", 12)
        self.cell(0, 8, self.game_system, align="C")
        self.ln(20)

        # Bottom decoration
        self.set_draw_color(123, 45, 38)
        self.set_line_width(1)
        y = self.h - 60
        self.line(40, y, self.w - 40, y)

    def section_heading(self, text: str):
        """Render a section heading with decorative underline."""
        self.ln(6)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(123, 45, 38)
        self.multi_cell(0, 9, text)

        # Underline
        self.set_draw_color(139, 115, 85)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y() + 1, self.w - self.r_margin, self.get_y() + 1)
        self.ln(6)

    def body_text(self, text: str):
        """Render body text with basic markdown-like formatting."""
        self.set_font("Helvetica", "", 11)
        self.set_text_color(26, 26, 26)

        # Process line by line for basic formatting
        for line in text.split("\n"):
            stripped = line.strip()

            if not stripped:
                self.ln(4)
                continue

            # Sub-heading (### or ##)
            if stripped.startswith("### "):
                self.ln(3)
                self.set_font("Helvetica", "B", 12)
                self.set_text_color(74, 55, 40)
                self.multi_cell(0, 7, stripped[4:])
                self.set_font("Helvetica", "", 11)
                self.set_text_color(26, 26, 26)
                continue

            if stripped.startswith("## "):
                self.ln(4)
                self.set_font("Helvetica", "B", 14)
                self.set_text_color(123, 45, 38)
                self.multi_cell(0, 8, stripped[3:])
                self.set_font("Helvetica", "", 11)
                self.set_text_color(26, 26, 26)
                continue

            # Read-aloud text (starts with >)
            if stripped.startswith("> ") or stripped.startswith(">"):
                text_content = stripped.lstrip("> ")
                self.set_fill_color(245, 235, 224)
                self.set_draw_color(123, 45, 38)
                y = self.get_y()
                # Draw left border
                self.set_line_width(1)
                self.set_font("Helvetica", "I", 11)
                self.set_text_color(80, 60, 40)
                old_x = self.l_margin
                self.set_x(old_x + 6)
                self.multi_cell(self.w - self.l_margin - self.r_margin - 10, 7, text_content, fill=True)
                self.line(old_x + 2, y, old_x + 2, self.get_y())
                self.set_font("Helvetica", "", 11)
                self.set_text_color(26, 26, 26)
                self.ln(2)
                continue

            # Bullet points
            if stripped.startswith("- ") or stripped.startswith("* "):
                bullet_text = stripped[2:]
                self.cell(6, 7, chr(8226))  # Bullet char
                self.multi_cell(0, 7, bullet_text)
                continue

            # Regular paragraph
            self.multi_cell(0, 7, stripped)

    def add_illustration(self, image_bytes: bytes, caption: str = ""):
        """Embed an illustration image."""
        try:
            img_stream = io.BytesIO(image_bytes)
            # Calculate dimensions to fit page width with margins
            max_width = self.w - self.l_margin - self.r_margin
            # Use a reasonable height
            img_height = max_width * 0.5625  # 16:9 ratio

            # Check if we need a page break
            if self.get_y() + img_height + 10 > self.h - 30:
                self.add_page()

            # Border
            self.set_draw_color(139, 115, 85)
            self.set_line_width(0.3)
            x = self.l_margin
            y = self.get_y()

            self.image(img_stream, x=x, y=y, w=max_width, h=img_height)

            self.set_y(y + img_height + 2)

            if caption:
                self.set_font("Helvetica", "I", 9)
                self.set_text_color(139, 115, 85)
                self.cell(0, 6, caption, align="C")
                self.ln(4)

            self.set_font("Helvetica", "", 11)
            self.set_text_color(26, 26, 26)
        except Exception as e:
            logger.warning("Failed to embed illustration: %s", e)

    def stat_block(self, title: str, content: str):
        """Render a stat block box."""
        self.ln(4)
        # Top border
        self.set_draw_color(123, 45, 38)
        self.set_line_width(1)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)

        # Title
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(123, 45, 38)
        self.cell(0, 8, title)
        self.ln(6)

        # Thin divider
        self.set_draw_color(139, 115, 85)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

        # Content
        self.set_font("Helvetica", "", 10)
        self.set_text_color(26, 26, 26)
        self.multi_cell(0, 6, content)
        self.ln(2)

        # Bottom border
        self.set_draw_color(123, 45, 38)
        self.set_line_width(1)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)


def build_module_pdf(
    module: GeneratedModule,
    campaign_name: str,
    game_system: str,
    include_illustrations: bool = True,
) -> Path:
    """
    Compile a GeneratedModule into a styled PDF.

    Returns the path to the generated PDF file.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in module.title)
    output_filename = f"{safe_title}_{uuid.uuid4().hex[:6]}.pdf"
    output_path = OUTPUT_DIR / output_filename

    pdf = ModulePDF(
        title=module.title,
        campaign_name=campaign_name,
        game_system=game_system,
    )
    pdf.alias_nb_pages()

    # Title page
    pdf.title_page()

    # Introduction
    pdf.add_page()
    pdf.section_heading("Introduction")
    pdf.body_text(module.introduction)

    # Sections
    for section in module.sections:
        pdf.add_page()
        pdf.section_heading(section.heading)

        # Illustration
        if include_illustrations and section.illustration_prompt:
            logger.info("Generating illustration for: %s", section.heading)
            img_bytes = generate_illustration(section.illustration_prompt)
            if img_bytes:
                pdf.add_illustration(img_bytes, section.heading)

        pdf.body_text(section.content)

    # Appendix
    if module.appendix:
        pdf.add_page()
        pdf.section_heading("Appendix")
        pdf.body_text(module.appendix)

    # Write PDF
    logger.info("Writing PDF: %s", output_path)
    pdf.output(str(output_path))
    logger.info("PDF generated: %s", output_path)

    return output_path
