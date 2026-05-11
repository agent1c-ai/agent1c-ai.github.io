from pathlib import Path
from tempfile import gettempdir

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE as SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "hackathon" / "agent1c-colosseum-hackathon-pitch-deck.pptx"
LEGACY_OUT_PATH = ROOT / "hackathon" / "agent1c-solana-hackathon-pitch-deck.pptx"

HEDGEHOG_IMAGE = ROOT / "assets" / "hedgey-clippy.png"
HEDGEHOG_ALT_IMAGE = ROOT / "assets" / "hedgey1.png"
OLLIE_IMAGE = ROOT / "assets" / "ollie.png"
PRODUCT_SCREENSHOT = ROOT / "hackathon" / "agent1c-desktop-solana-dapps.png"

APP_ICONS = [
    ("Magic Eden", ROOT / "assets" / "app-icons" / "magic-eden.png"),
    ("Save Finance", ROOT / "assets" / "app-icons" / "save-finance.png"),
    ("GeckoTerminal", ROOT / "assets" / "app-icons" / "geckoterminal.png"),
    ("HeliumGeek", ROOT / "assets" / "app-icons" / "heliumgeek.png"),
    ("DePINscan", ROOT / "assets" / "app-icons" / "depinscan.ico"),
    ("Dialect", ROOT / "assets" / "app-icons" / "dialect.png"),
]


def rgb(value):
    value = value.strip().lstrip("#")
    return RGBColor(int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


BG_DARK = rgb("08111F")
BG_DARK_2 = rgb("11243D")
BG_DARK_3 = rgb("183657")
BG_LIGHT = rgb("F7F1E8")
BG_SOFT = rgb("E8F2F1")
INK = rgb("102033")
INK_SOFT = rgb("455D73")
INK_LIGHT = rgb("F8F6F0")
MINT = rgb("2FE6C8")
SKY = rgb("55BFF7")
PINK = rgb("FF4FB8")
CORAL = rgb("FF7A59")
GOLD = rgb("FFC857")
VIOLET = rgb("7957FF")
PANEL = rgb("FFFFFF")
PANEL_DARK = rgb("14263F")
PANEL_SOFT = rgb("EEF7F7")
LINE = rgb("D2DEE2")

TITLE_FONT = "Trebuchet MS"
BODY_FONT = "Trebuchet MS"


def prepare_assets():
    generated = Path(gettempdir()) / "agent1c-pitch-assets"
    generated.mkdir(parents=True, exist_ok=True)
    prepared = []
    for label, path in APP_ICONS:
        if path.suffix.lower() == ".ico" and path.exists():
            out = generated / f"{path.stem}.png"
            Image.open(path).save(out)
            prepared.append((label, out))
        else:
            prepared.append((label, path))
    return prepared


def add_shape(slide, kind, x, y, w, h, fill, line=None, radius=False):
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line or fill
    if radius and hasattr(shape, "adjustments") and len(shape.adjustments) > 0:
        shape.adjustments[0] = 0.18
    return shape


def add_rect(slide, x, y, w, h, fill, line=None, radius=False):
    kind = SHAPE.ROUNDED_RECTANGLE if radius else SHAPE.RECTANGLE
    return add_shape(slide, kind, x, y, w, h, fill, line=line, radius=radius)


def add_oval(slide, x, y, w, h, fill, line=None):
    return add_shape(slide, SHAPE.OVAL, x, y, w, h, fill, line=line)


def add_text(
    slide,
    text,
    x,
    y,
    w,
    h,
    *,
    size=18,
    color=INK,
    bold=False,
    font=BODY_FONT,
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.TOP,
    line_spacing=1.05,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = 0
    frame.margin_right = 0
    frame.margin_top = 0
    frame.margin_bottom = 0
    frame.vertical_anchor = valign
    for idx, line in enumerate(str(text).split("\n")):
        para = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        para.text = line
        para.alignment = align
        para.space_after = Pt(0)
        para.line_spacing = line_spacing
        font_obj = para.font
        font_obj.name = font
        font_obj.size = Pt(size)
        font_obj.color.rgb = color
        font_obj.bold = bold
    return box


def add_bullets(slide, items, x, y, w, h, *, size=16, color=INK, leading=1.12):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = 0
    frame.margin_right = 0
    frame.margin_top = 0
    frame.margin_bottom = 0
    for idx, item in enumerate(items):
        para = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        para.text = f"- {item}"
        para.alignment = PP_ALIGN.LEFT
        para.space_after = Pt(7)
        para.line_spacing = leading
        font_obj = para.font
        font_obj.name = BODY_FONT
        font_obj.size = Pt(size)
        font_obj.color.rgb = color
    return box


def add_footer(slide, page, *, dark=False):
    color = rgb("C9D5E1") if dark else INK_SOFT
    add_text(slide, "Agent1c.ai | Colosseum Solana Hackathon Pitch", 0.55, 7.06, 5.3, 0.22, size=9.5, color=color)
    add_text(slide, str(page), 12.38, 7.06, 0.35, 0.22, size=9.5, color=color, align=PP_ALIGN.RIGHT)


def add_kicker(slide, text, x=0.62, y=0.58, w=2.35, fill=MINT, color=BG_DARK):
    add_rect(slide, x, y, w, 0.34, fill, radius=True)
    add_text(slide, text, x + 0.12, y + 0.075, w - 0.24, 0.13, size=9.5, color=color, bold=True, align=PP_ALIGN.CENTER)


def add_title(slide, title, subtitle=None, *, dark=False, x=0.62, y=1.04, w=7.5):
    add_text(slide, title, x, y, w, 1.05, size=26, color=INK_LIGHT if dark else INK, bold=True, font=TITLE_FONT, line_spacing=0.96)
    if subtitle:
        add_text(slide, subtitle, x, y + 1.22, min(w, 7.0), 0.55, size=12.5, color=rgb("C6D5E2") if dark else INK_SOFT)


def add_card(slide, x, y, w, h, title, body, *, fill=PANEL, line=None, title_color=INK, body_color=INK_SOFT):
    add_rect(slide, x, y, w, h, fill, line=line or fill, radius=True)
    add_text(slide, title, x + 0.18, y + 0.15, w - 0.36, 0.32, size=13, color=title_color, bold=True)
    add_text(slide, body, x + 0.18, y + 0.56, w - 0.36, h - 0.68, size=11.2, color=body_color, line_spacing=1.05)


def add_chip(slide, text, x, y, w=1.65, *, dark=False, fill=None, color=None):
    fill = fill or (BG_DARK_3 if dark else PANEL)
    line = MINT if dark else LINE
    color = color or (INK_LIGHT if dark else INK)
    add_rect(slide, x, y, w, 0.36, fill, line=line, radius=True)
    add_text(slide, text, x + 0.08, y + 0.09, w - 0.16, 0.13, size=9.4, color=color, bold=True, align=PP_ALIGN.CENTER)


def add_picture_fit(slide, path, x, y, w, h):
    path = Path(path)
    if not path.exists():
        return None
    with Image.open(path) as img:
        iw, ih = img.size
    scale = min(w / iw, h / ih)
    pw = iw * scale
    ph = ih * scale
    px = x + (w - pw) / 2
    py = y + (h - ph) / 2
    return slide.shapes.add_picture(str(path), Inches(px), Inches(py), width=Inches(pw), height=Inches(ph))


def add_background(slide, *, dark=False, alt=False):
    if dark:
        add_rect(slide, 0, 0, 13.333, 7.5, BG_DARK)
        add_oval(slide, 10.72, -0.9, 3.1, 3.1, BG_DARK_2)
        add_oval(slide, -0.55, 6.18, 1.7, 1.7, rgb("15263D"))
        add_rect(slide, 0.62, 0.39, 0.55, 0.07, MINT)
        add_rect(slide, 1.25, 0.39, 0.4, 0.07, PINK)
        add_rect(slide, 1.72, 0.39, 0.34, 0.07, GOLD)
        return
    add_rect(slide, 0, 0, 13.333, 7.5, BG_SOFT if alt else BG_LIGHT)
    add_rect(slide, 0, 0, 13.333, 0.17, MINT if alt else CORAL)
    add_oval(slide, 11.18, -0.55, 2.1, 2.1, rgb("DCECEC") if alt else rgb("EFE2D5"))
    add_oval(slide, -0.52, 6.08, 1.55, 1.55, rgb("D8E9EA") if alt else rgb("F1DED0"))


def add_hedgehog(slide, x, y, w=1.2, alt=False):
    path = HEDGEHOG_ALT_IMAGE if alt and HEDGEHOG_ALT_IMAGE.exists() else HEDGEHOG_IMAGE
    if path.exists():
        return slide.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w))
    return None


def add_speech(slide, text, x, y, w, h, *, dark=False):
    fill = rgb("FFF8CE") if not dark else PANEL_DARK
    line = rgb("1B2530") if not dark else MINT
    color = INK if not dark else INK_LIGHT
    add_rect(slide, x, y, w, h, fill, line=line, radius=True)
    add_text(slide, text, x + 0.16, y + 0.14, w - 0.32, h - 0.25, size=12.2, color=color, bold=True, line_spacing=1.02)


def add_icon_row(slide, icons, x, y, size=0.42, gap=0.18):
    for idx, (_, path) in enumerate(icons):
        add_picture_fit(slide, path, x + idx * (size + gap), y, size, size)


def slide_cover(prs, icons):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "COLOSSEUM HACKATHON", 0.62, 0.72, w=2.75, fill=GOLD)
    add_text(slide, "Agent1c.ai", 0.62, 1.33, 5.4, 0.56, size=34, color=INK_LIGHT, bold=True, font=TITLE_FONT)
    add_text(slide, "The web-based Solana OS with an AI agent inside.", 0.62, 2.05, 6.6, 0.55, size=23, color=MINT, bold=True, font=TITLE_FONT)
    add_text(
        slide,
        "A desktop on the web where Solana dapps become native app panels, wallet context becomes workspace context, and Hitomi helps users operate across it.",
        0.62,
        2.88,
        6.15,
        0.82,
        size=15,
        color=rgb("C8D5E2"),
    )
    add_chip(slide, "Dapp launcher", 0.62, 4.15, w=1.75, dark=True)
    add_chip(slide, "AI compute", 2.6, 4.15, w=1.55, dark=True)
    add_chip(slide, "Wallet context", 4.38, 4.15, w=1.8, dark=True)
    add_rect(slide, 0.62, 5.0, 6.35, 0.86, BG_DARK_2, line=BG_DARK_3, radius=True)
    add_text(slide, "Launch goal: make Agent1c the first tab serious Solana users open.", 0.92, 5.28, 5.72, 0.2, size=14, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)

    add_oval(slide, 8.58, 0.93, 3.25, 3.25, rgb("143748"))
    add_oval(slide, 8.95, 1.27, 2.52, 2.52, rgb("1D4C57"))
    add_hedgehog(slide, 8.92, 1.15, w=2.48)
    add_speech(slide, "hi, i'm Hitomi (^_^)\nlet's make Solana feel like an OS.", 7.83, 4.65, 4.15, 0.82, dark=True)
    add_icon_row(slide, icons, 8.25, 5.78, size=0.43, gap=0.22)
    add_footer(slide, 1, dark=True)


def slide_problem(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide)
    add_kicker(slide, "PROBLEM", fill=CORAL, color=INK_LIGHT)
    add_title(slide, "Solana UX is fast, but the workspace is fragmented.", "Power users still run their onchain life from scattered tabs, dashboards, chats, and notes.")
    add_bullets(
        slide,
        [
            "Wallets are great for signing, but weak at memory, context, and orchestration.",
            "Dapps are excellent in their own silo, but users operate across many protocols.",
            "AI lives in a separate tab, so it rarely sees the user's actual workspace.",
            "DePIN operators and DeFi users both need a command surface, not another bookmark list.",
        ],
        0.72,
        2.85,
        5.7,
        2.55,
        size=16.3,
    )
    add_card(slide, 7.05, 2.45, 4.75, 0.88, "Current session", "wallet + explorer + app + chat + notes + analytics", fill=PANEL_SOFT)
    add_card(slide, 7.05, 3.58, 4.75, 0.88, "User feeling", "too many tabs, too little memory (>_<)", fill=PANEL_SOFT)
    add_card(slide, 7.05, 4.71, 4.75, 0.88, "Opportunity", "own the home surface where Solana work actually happens", fill=PANEL_SOFT)
    add_footer(slide, 2)


def slide_solution(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "SOLUTION", fill=MINT)
    add_title(slide, "Agent1c.ai turns the browser into a Solana desktop.", "Dapps launch as windows. The agent lives inside the workspace. Context can persist across sessions.", dark=True, w=7.2)
    if PRODUCT_SCREENSHOT.exists():
        add_rect(slide, 6.65, 1.42, 5.85, 4.3, rgb("02070F"), line=MINT, radius=True)
        add_picture_fit(slide, PRODUCT_SCREENSHOT, 6.86, 1.66, 5.42, 3.82)
    else:
        add_rect(slide, 6.65, 1.42, 5.85, 4.3, rgb("B8B8B8"), line=MINT, radius=True)
        add_text(slide, "Agent1c desktop preview", 7.1, 2.0, 4.8, 0.32, size=18, color=INK, bold=True, align=PP_ALIGN.CENTER)
        add_card(slide, 7.05, 2.65, 1.35, 1.05, "Magic Eden", "dapp panel", fill=PANEL)
        add_card(slide, 8.7, 2.65, 1.35, 1.05, "Save", "dapp panel", fill=PANEL)
        add_card(slide, 10.35, 2.65, 1.35, 1.05, "Hitomi", "AI agent", fill=PANEL)
    add_card(slide, 0.72, 3.28, 1.95, 1.45, "1", "Open Agent1c.ai in any browser.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 2.98, 3.28, 1.95, 1.45, "2", "Launch Solana apps as desktop panels.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D5E2"))
    add_card(slide, 5.24, 3.28, 1.95, 1.45, "3", "Let Hitomi reason over the workspace.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D5E2"))
    add_footer(slide, 3, dark=True)


def slide_dapp_launcher(prs, icons):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, alt=True)
    add_kicker(slide, "LIVE DAPP LAUNCHER", w=2.75, fill=MINT)
    add_title(slide, "Solana dapps now behave like native HedgeyOS apps.", "The fastest product wedge is simple: iframe-friendly dapps become desktop icons and app panels.")
    card_w = 1.72
    start_x = 0.72
    for idx, (label, path) in enumerate(icons):
        x = start_x + idx * 1.94
        add_rect(slide, x, 3.02, card_w, 1.75, PANEL, line=LINE, radius=True)
        add_picture_fit(slide, path, x + 0.47, 3.22, 0.76, 0.76)
        add_text(slide, label, x + 0.13, 4.18, card_w - 0.26, 0.25, size=10.6, color=INK, bold=True, align=PP_ALIGN.CENTER)
        add_text(slide, "iframe panel", x + 0.13, 4.48, card_w - 0.26, 0.16, size=8.8, color=INK_SOFT, align=PP_ALIGN.CENTER)
    add_rect(slide, 0.72, 5.38, 11.34, 0.74, INK, radius=True)
    add_text(slide, "This makes Agent1c a distribution surface for Solana apps, not just another AI chat interface.", 1.0, 5.61, 10.75, 0.21, size=13.8, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 4)


def slide_hitomi(prs, icons):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "AI COMPANION", w=2.35, fill=PINK, color=INK_LIGHT)
    add_title(slide, "Hitomi is the agent inside the OS.", "The assistant is not bolted onto the side; she sits inside the same desktop where the user works.", dark=True, w=7.8)
    add_hedgehog(slide, 0.85, 3.22, w=1.55)
    add_speech(slide, "i can remember the workspace,\nopen tools, and explain what changed. o7", 2.42, 3.38, 3.65, 0.95, dark=True)
    add_card(slide, 6.85, 2.35, 4.75, 0.92, "Workspace context", "Windows, notes, files, app state, and wallet context can become prompt context.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 6.85, 3.5, 4.75, 0.92, "Tool execution", "Hitomi can route through explicit tools instead of guessing what happened.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D5E2"))
    add_card(slide, 6.85, 4.65, 4.75, 0.92, "Delight layer", "The hedgehog and emoticon style make the OS memorable without hiding the serious workflow.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D5E2"))
    add_icon_row(slide, icons[:4], 2.52, 4.78, size=0.36, gap=0.16)
    add_footer(slide, 5, dark=True)


def slide_solana_status(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide)
    add_kicker(slide, "SOLANA STATUS", w=2.45, fill=GOLD)
    add_title(slide, "The current integration is real and deliberately read-only.", "That gives judges something testable now while keeping transaction risk out of the demo.")
    add_card(slide, 0.72, 2.78, 2.62, 1.72, "Wallet auth", "Solana wallet detection and Supabase Web3 sign-in path.", fill=PANEL)
    add_card(slide, 3.62, 2.78, 2.62, 1.72, "Wallet reads", "RPC balance, recent signatures, and parsed transaction summaries.", fill=PANEL)
    add_card(slide, 6.52, 2.78, 2.62, 1.72, "Hitomi tools", "Wallet overview and refresh tools return structured read-only context.", fill=PANEL)
    add_card(slide, 9.42, 2.78, 2.62, 1.72, "Dapp apps", "Six iframe-friendly Solana dapps are already in the desktop.", fill=PANEL)
    add_rect(slide, 1.25, 5.35, 10.25, 0.72, rgb("102033"), radius=True)
    add_text(slide, "Important demo rule: no signing, sending, swaps, custody, or private key access in the current build.", 1.62, 5.58, 9.5, 0.2, size=13.2, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 6)


def slide_workflows(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "WORKFLOWS", fill=MINT)
    add_title(slide, "The OS framing works for DeFi and DePIN.", "Both categories need continuity, memory, and an operator surface.", dark=True, w=7.4)
    add_card(slide, 0.82, 3.08, 5.25, 2.25, "DeFi power user", "Open NFT markets, lending, charts, notes, and wallet context in one session. Hitomi summarizes what changed and helps route the next action.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 6.98, 3.08, 5.25, 2.25, "DePIN operator", "Keep maps, rewards, uptime dashboards, device notes, and alerts in one cloud workspace. The agent becomes the operations companion.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D5E2"))
    add_text(slide, "(*_*) fewer tabs -> better decisions -> more sessions", 2.9, 5.9, 7.6, 0.26, size=16, color=SKY, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 7, dark=True)


def slide_why_now(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, alt=True)
    add_kicker(slide, "WHY NOW", fill=CORAL, color=INK_LIGHT)
    add_title(slide, "AI compute and Solana composability create the opening.", "The winning product is the one that owns the workspace, not a single isolated action.")
    add_card(slide, 0.72, 2.85, 3.45, 2.05, "Browsers are ready", "A full web desktop can be distributed instantly through GitHub Pages and any modern browser.", fill=PANEL)
    add_card(slide, 4.45, 2.85, 3.45, 2.05, "Dapps are ready", "Iframe-friendly apps let us expand the operating surface immediately.", fill=PANEL)
    add_card(slide, 8.18, 2.85, 3.45, 2.05, "Agents are ready", "The useful AI interface is contextual, persistent, and tool-driven.", fill=PANEL)
    add_rect(slide, 1.1, 5.55, 10.45, 0.58, INK, radius=True)
    add_text(slide, "Agent1c is positioned as the connective tissue between all three.", 1.45, 5.75, 9.75, 0.16, size=13.2, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 8)


def slide_business_model(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "BUSINESS MODEL", w=2.6, fill=GOLD)
    add_title(slide, "Agent1c monetizes AI compute and premium workspace access.", "The model starts simple, then becomes more Solana-native as the community grows.", dark=True, w=7.6)
    add_card(slide, 0.82, 3.0, 3.3, 2.05, "1. Credits", "Users buy AI compute credits for Hitomi and higher-volume agent sessions.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 4.38, 3.0, 3.3, 2.05, "2. Subscription", "Monthly plans unlock larger compute buckets, saved workspaces, and premium OS features.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D5E2"))
    add_card(slide, 7.94, 3.0, 3.3, 2.05, "3. Dapp surface", "Featured dapp placement, partner launchers, and workflow templates as distribution grows.", fill=PANEL_DARK, title_color=PINK, body_color=rgb("C8D5E2"))
    add_footer(slide, 9, dark=True)


def slide_staking_promise(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide)
    add_kicker(slide, "WINNER COMMITMENT", w=3.1, fill=PINK, color=INK_LIGHT)
    add_title(slide, "If we win, we will launch token-staked AI compute access.", "The promise: stake the Agent1c utility token to unlock free AI compute allowance while the stake remains locked.", w=8.5)
    add_card(slide, 0.82, 3.05, 2.85, 1.45, "Stake", "Lock Agent1c utility tokens for a chosen period.", fill=PANEL)
    add_text(slide, "->", 3.87, 3.54, 0.35, 0.22, size=20, color=INK, bold=True)
    add_card(slide, 4.36, 3.05, 2.85, 1.45, "Unlock", "Receive a recurring AI compute allowance without card payment.", fill=PANEL)
    add_text(slide, "->", 7.42, 3.54, 0.35, 0.22, size=20, color=INK, bold=True)
    add_card(slide, 7.9, 3.05, 2.85, 1.45, "Use", "Spend allowance on Hitomi, tools, and premium workspace actions.", fill=PANEL)
    add_hedgehog(slide, 10.82, 2.8, w=1.0, alt=True)
    add_rect(slide, 1.05, 5.22, 10.75, 0.92, INK, radius=True)
    add_text(slide, "This is a utility access model: no APY promise, no passive income claim, final token terms subject to legal and compliance review.", 1.42, 5.48, 10.0, 0.32, size=12.4, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 10)


def slide_roadmap(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "ROADMAP", fill=MINT)
    add_title(slide, "A tight path from hackathon demo to launchable product.", "Each phase makes the OS more useful without taking custody or hiding risk.", dark=True)
    add_card(slide, 0.82, 2.95, 2.75, 2.1, "Now", "Remote-testable web desktop, Hitomi, Solana auth, wallet reads, and six dapp panels.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 3.78, 2.95, 2.75, 2.1, "30 days", "More iframe-safe dapps, better launcher metadata, workspace templates, and wallet summary UI.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D5E2"))
    add_card(slide, 6.74, 2.95, 2.75, 2.1, "60 days", "Agent workflows for research, notes, monitoring, DePIN operations, and dapp routing.", fill=PANEL_DARK, title_color=PINK, body_color=rgb("C8D5E2"))
    add_card(slide, 9.7, 2.95, 2.75, 2.1, "Winner path", "Launch token-staked compute access MVP and start community distribution.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D5E2"))
    add_footer(slide, 11, dark=True)


def slide_competition(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, alt=True)
    add_kicker(slide, "POSITIONING", fill=GOLD)
    add_title(slide, "Agent1c is not competing as one more dapp.", "It combines the surfaces users already need into one persistent command environment.")
    add_card(slide, 0.76, 2.75, 2.72, 1.7, "Wallets", "Strong signing, weak workspace memory.", fill=PANEL)
    add_card(slide, 3.72, 2.75, 2.72, 1.7, "Dashboards", "Strong visibility, weak orchestration.", fill=PANEL)
    add_card(slide, 6.68, 2.75, 2.72, 1.7, "Dapp directories", "Strong discovery, weak continuity.", fill=PANEL)
    add_card(slide, 9.64, 2.75, 2.72, 1.7, "Generic agents", "Strong chat, weak onchain workspace.", fill=PANEL)
    add_rect(slide, 1.1, 5.35, 10.55, 0.74, INK, radius=True)
    add_text(slide, "Agent1c: wallet-native context + dapp panels + AI companion + persistent desktop.", 1.48, 5.58, 9.85, 0.2, size=13.6, color=INK_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 12)


def slide_hackathon_ask(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, dark=True)
    add_kicker(slide, "HACKATHON ASK", w=2.55, fill=CORAL, color=INK_LIGHT)
    add_title(slide, "Help us turn Agent1c into Solana's AI workspace.", "We are using the hackathon to validate the OS category and accelerate distribution.", dark=True, w=8.0)
    add_card(slide, 0.82, 3.0, 3.45, 1.9, "Judges", "Evaluate the product as a new home surface for Solana activity, not only as a wallet feature.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D5E2"))
    add_card(slide, 4.55, 3.0, 3.45, 1.9, "Dapp teams", "Give us iframe-safe routes, metadata, and workflows that should become native panels.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D5E2"))
    add_card(slide, 8.28, 3.0, 3.45, 1.9, "Community", "Test the desktop, request apps, and shape the staking-for-compute launch model.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D5E2"))
    add_text(slide, "Winning unlocks the public token-staked compute access milestone.", 1.88, 5.63, 9.55, 0.26, size=16, color=PINK, bold=True, align=PP_ALIGN.CENTER)
    add_footer(slide, 13, dark=True)


def slide_close(prs, icons):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide)
    add_kicker(slide, "CLOSE", fill=MINT)
    add_title(slide, "Make Agent1c the first tab for Solana.", "A web OS, a dapp launcher, an AI companion, and a community-native compute model.")
    add_rect(slide, 1.15, 3.0, 5.4, 1.42, PANEL, line=LINE, radius=True)
    add_text(slide, "agent1c.ai", 1.52, 3.28, 4.65, 0.42, size=27, color=INK, bold=True, font=TITLE_FONT, align=PP_ALIGN.CENTER)
    add_text(slide, "The Solana OS with Hitomi inside (^_^)", 1.52, 3.83, 4.65, 0.24, size=13, color=INK_SOFT, bold=True, align=PP_ALIGN.CENTER)
    add_icon_row(slide, icons, 1.86, 4.78, size=0.45, gap=0.25)
    add_hedgehog(slide, 8.1, 2.62, w=1.82)
    if OLLIE_IMAGE.exists():
        slide.shapes.add_picture(str(OLLIE_IMAGE), Inches(9.88), Inches(2.96), width=Inches(1.28))
    add_speech(slide, "ship the OS.\nwin the hackathon.\nstake for compute. o7", 7.45, 5.15, 4.2, 0.88)
    add_footer(slide, 14)


def build_deck():
    icons = prepare_assets()
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    slide_cover(prs, icons)
    slide_problem(prs)
    slide_solution(prs)
    slide_dapp_launcher(prs, icons)
    slide_hitomi(prs, icons)
    slide_solana_status(prs)
    slide_workflows(prs)
    slide_why_now(prs)
    slide_business_model(prs)
    slide_staking_promise(prs)
    slide_roadmap(prs)
    slide_competition(prs)
    slide_hackathon_ask(prs)
    slide_close(prs, icons)

    prs.save(str(OUT_PATH))
    prs.save(str(LEGACY_OUT_PATH))
    return OUT_PATH


if __name__ == "__main__":
    out = build_deck()
    print(out)
