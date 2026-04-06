from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE as SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "hackathon" / "agent1c-solana-hackathon-pitch-deck.pptx"
HEDGEHOG_IMAGE = ROOT / "assets" / "hedgey-clippy.png"


def rgb(value):
    value = value.strip().lstrip("#")
    return RGBColor(int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


BG_DARK = rgb("0A1222")
BG_DARK_2 = rgb("12233D")
BG_LIGHT = rgb("F7F2E8")
BG_SOFT = rgb("EAF2F5")
INK_LIGHT = rgb("F7F4EE")
INK_DARK = rgb("14233B")
INK_MUTED = rgb("4E637C")
MINT = rgb("35E4C4")
SKY = rgb("69CFFF")
CORAL = rgb("FF7A59")
GOLD = rgb("FFC857")
PANEL_DARK = rgb("17263F")
PANEL_LIGHT = rgb("FFFFFF")
PANEL_SOFT = rgb("EDF4F7")

TITLE_FONT = "Trebuchet MS"
BODY_FONT = "Trebuchet MS"


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
    color=INK_DARK,
    bold=False,
    font=BODY_FONT,
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.TOP,
    line_spacing=1.08,
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
    lines = str(text).split("\n")
    for idx, line in enumerate(lines):
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


def add_bullets(slide, items, x, y, w, h, *, size=17, color=INK_DARK, leading=1.14):
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
        para.text = f"• {item}"
        para.alignment = PP_ALIGN.LEFT
        para.space_after = Pt(8)
        para.line_spacing = leading
        font_obj = para.font
        font_obj.name = BODY_FONT
        font_obj.size = Pt(size)
        font_obj.color.rgb = color
    return box


def add_kicker(slide, text, x, y, w=2.3, h=0.38, fill=MINT, text_color=BG_DARK):
    add_rect(slide, x, y, w, h, fill, radius=True)
    add_text(
        slide,
        text,
        x + 0.12,
        y + 0.06,
        w - 0.24,
        h - 0.12,
        size=11,
        color=text_color,
        bold=True,
    )


def add_footer(slide, page, *, appendix=False, dark=False):
    color = INK_LIGHT if dark else INK_MUTED
    label = "Appendix" if appendix else "Pitch Deck"
    add_text(slide, f"Agent1c.ai  |  Solana Hackathon  |  {label}", 0.7, 7.02, 5.2, 0.22, size=10, color=color)
    add_text(slide, str(page), 12.08, 7.0, 0.45, 0.24, size=10, color=color, align=PP_ALIGN.RIGHT)


def decorate_dark(slide):
    add_rect(slide, 0, 0, 13.333, 7.5, BG_DARK)
    add_oval(slide, 10.75, -0.8, 2.9, 2.9, BG_DARK_2)
    add_oval(slide, -0.55, 6.1, 1.65, 1.65, rgb("16243C"))
    add_rect(slide, 0.7, 0.58, 0.62, 0.08, MINT)
    add_rect(slide, 1.38, 0.58, 0.42, 0.08, CORAL)
    add_rect(slide, 1.86, 0.58, 0.32, 0.08, GOLD)


def decorate_light(slide, alt=False):
    add_rect(slide, 0, 0, 13.333, 7.5, BG_SOFT if alt else BG_LIGHT)
    add_rect(slide, 0, 0, 13.333, 0.17, MINT if alt else CORAL)
    add_oval(slide, 11.35, -0.45, 1.9, 1.9, rgb("DDECEE") if alt else rgb("F0E5D9"))
    add_oval(slide, -0.45, 6.15, 1.35, 1.35, rgb("DCEAEC") if alt else rgb("F0E0D1"))


def add_title_block(slide, title, subtitle, *, dark=False, width=7.6):
    title_color = INK_LIGHT if dark else INK_DARK
    sub_color = rgb("C5D3E3") if dark else INK_MUTED
    add_text(slide, title, 0.7, 1.0, width, 1.25, size=25, color=title_color, bold=True, font=TITLE_FONT, line_spacing=1.0)
    if subtitle:
        add_text(slide, subtitle, 0.7, 2.2, min(width, 7.1), 0.42, size=12, color=sub_color)


def add_card(slide, x, y, w, h, title, body, *, fill=PANEL_LIGHT, title_color=INK_DARK, body_color=INK_MUTED):
    add_rect(slide, x, y, w, h, fill, radius=True)
    add_text(slide, title, x + 0.18, y + 0.16, w - 0.36, 0.3, size=13, color=title_color, bold=True)
    add_text(slide, body, x + 0.18, y + 0.52, w - 0.36, h - 0.68, size=11.5, color=body_color, line_spacing=1.05)


def add_metric_chip(slide, text, x, y, *, dark=False):
    fill = BG_DARK_2 if dark else PANEL_LIGHT
    line = MINT if dark else INK_DARK
    text_color = INK_LIGHT if dark else INK_DARK
    add_rect(slide, x, y, 1.9, 0.42, fill, line=line, radius=True)
    add_text(slide, text, x + 0.1, y + 0.12, 1.7, 0.16, size=10.5, color=text_color, align=PP_ALIGN.CENTER)


def slide_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "SOLANA HACKATHON 2026", 0.7, 0.78, w=2.55, fill=GOLD)
    add_text(slide, "Agent1c.ai", 0.7, 1.38, 5.2, 0.5, size=31, color=INK_LIGHT, bold=True, font=TITLE_FONT)
    add_text(slide, "The Solana DeFi + DePIN OS", 0.7, 2.0, 6.2, 0.5, size=24, color=MINT, bold=True, font=TITLE_FONT)
    add_text(
        slide,
        "A cloud-accessible operating system for your entire onchain life.\nOne landing page for Solana dapps. One agentic workspace for everything after login.",
        0.7,
        2.82,
        6.2,
        0.9,
        size=16,
        color=rgb("C8D3E2"),
    )
    add_metric_chip(slide, "DeFi workspace", 0.7, 4.45, dark=True)
    add_metric_chip(slide, "DePIN control plane", 2.8, 4.45, dark=True)
    add_metric_chip(slide, "Agentic dapp OS", 5.1, 4.45, dark=True)
    add_rect(slide, 0.7, 5.2, 6.35, 0.95, PANEL_DARK, radius=True)
    add_text(
        slide,
        "The pitch: make Agent1c the place users open first when they want to do anything serious on Solana.",
        1.0,
        5.48,
        5.75,
        0.24,
        size=14,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_oval(slide, 8.8, 1.25, 3.0, 3.0, rgb("123A45"))
    add_oval(slide, 9.15, 1.6, 2.3, 2.3, rgb("1C4953"))
    if HEDGEHOG_IMAGE.exists():
        slide.shapes.add_picture(str(HEDGEHOG_IMAGE), Inches(9.14), Inches(1.47), width=Inches(2.28))
    add_text(
        slide,
        "Not another wallet.\nNot another dashboard.\nAn operating system.",
        7.9,
        5.08,
        3.7,
        0.8,
        size=16,
        color=rgb("C8D3E2"),
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 1, dark=True)


def slide_problem(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "PROBLEM", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_title_block(
        slide,
        "Solana users still live in fragments.",
        "DeFi and DePIN multiply the number of surfaces a serious user has to manage.",
    )
    add_bullets(
        slide,
        [
            "Wallets, dapps, explorers, dashboards, chats, and notes all hold separate slices of context.",
            "Users manually stitch together what happened, what matters, and what to do next.",
            "The more onchain activity grows, the worse the tab sprawl gets.",
        ],
        0.7,
        2.95,
        5.45,
        2.2,
        size=17,
    )
    add_card(slide, 7.0, 2.7, 4.8, 0.95, "Wallet", "Good for signing. Weak at memory and workflow.", fill=PANEL_SOFT)
    add_card(slide, 7.0, 3.85, 4.8, 0.95, "Single dapp", "Strong inside one silo. Weak across the ecosystem.", fill=PANEL_SOFT)
    add_card(slide, 7.0, 5.0, 4.8, 0.95, "Dashboard", "Observes state, but rarely helps operate it.", fill=PANEL_SOFT)
    add_footer(slide, 2)


def slide_vision(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "VISION", 0.7, 0.72, fill=MINT)
    add_title_block(
        slide,
        "Imagine an operating system for your onchain life.",
        "That framing changes the product from a tool into a home surface.",
        dark=True,
    )
    add_bullets(
        slide,
        [
            "Your wallet becomes identity, not just a popup.",
            "Your dapps become windows inside one desktop.",
            "Your notes, alerts, history, and context live in one place.",
            "Your AI becomes part of the OS, not a side tab.",
        ],
        0.7,
        2.95,
        5.35,
        2.45,
        size=17,
        color=rgb("C8D3E2"),
    )
    add_card(slide, 6.7, 2.8, 5.0, 1.0, "New category", "A cloud Solana desktop, not just a wallet or dashboard.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 6.7, 4.02, 5.0, 1.0, "New homepage", "Users start and end their Solana session in one place.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 6.7, 5.24, 5.0, 1.0, "New expectation", "The agent can reason across apps because the apps share a workspace.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 3, dark=True)


def slide_product(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "PRODUCT", 0.7, 0.62, fill=MINT)
    add_title_block(
        slide,
        "Agent1c.ai is the cloud-accessible Solana DeFi + DePIN OS.",
        "A browser-native desktop where the app launcher becomes the Solana dapp launcher.",
    )
    add_card(slide, 0.7, 3.0, 3.55, 1.95, "Wallet-native identity", "The user enters through an onchain identity layer instead of a generic web account.", fill=PANEL_LIGHT)
    add_card(slide, 4.55, 3.0, 3.55, 1.95, "Dapp landing page", "Today's launcher evolves into the entry point for ecosystem apps and workflows.", fill=PANEL_LIGHT)
    add_card(slide, 8.4, 3.0, 3.55, 1.95, "Agentic operating layer", "Hitomi helps the user navigate, remember, and eventually orchestrate work across the desktop.", fill=PANEL_LIGHT)
    add_rect(slide, 0.7, 5.45, 11.25, 0.72, INK_DARK, radius=True)
    add_text(
        slide,
        "Mental model: Agent1c becomes the place you open when you want to do anything serious on Solana.",
        1.0,
        5.68,
        10.7,
        0.22,
        size=14,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 4)


def slide_openclaw(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "OPENCLAW POSITIONING", 0.7, 0.72, w=3.0, fill=GOLD)
    add_title_block(
        slide,
        "Agent1c can be used like a customizable, onchain OpenClaw for Solana.",
        "The difference is that the operator lives inside a wallet-native cloud desktop built for the ecosystem.",
        dark=True,
        width=8.8,
    )
    add_card(slide, 0.7, 3.0, 3.55, 1.9, "Operator feel", "The agent has tools, memory, workspace context, and a persistent environment to work from.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 4.55, 3.0, 3.55, 1.9, "Customizable", "Users can shape the desktop, the launcher, the tools, and the workflows to match how they operate.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 8.4, 3.0, 3.55, 1.9, "Onchain-native", "The operator is built for wallets, dapps, and Solana workflows instead of generic web tasks.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 5, dark=True)


def slide_use_cases(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "USE CASES", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_title_block(
        slide,
        "Why this matters for both DeFi and DePIN",
        "The OS framing gets stronger as user workflows become more continuous and more operational.",
    )
    add_card(slide, 0.7, 2.95, 5.45, 2.6, "DeFi OS", "Portfolio context, research, execution paths, watchlists, notes, and protocol hopping all belong in one workspace instead of ten tabs.", fill=PANEL_LIGHT)
    add_card(slide, 6.65, 2.95, 5.45, 2.6, "DePIN OS", "Device fleets, rewards, uptime, maps, alerts, and operator workflows need a home surface that feels more like operations software than a dashboard.", fill=PANEL_LIGHT)
    add_footer(slide, 6)


def slide_business_model(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "BUSINESS MODEL", 0.7, 0.72, fill=MINT)
    add_title_block(
        slide,
        "Two paths to AI credits and premium access",
        "One model for mainstream users. One model that is native to the community and the token.",
        dark=True,
    )
    add_card(
        slide,
        0.9,
        3.0,
        5.0,
        2.2,
        "1. Subscription",
        "Card-based plans for normies who just want the product to work.\nMonthly recurring access buys larger AI credit buckets, convenience, and premium workspace features.",
        fill=PANEL_DARK,
        title_color=MINT,
        body_color=rgb("C8D3E2"),
    )
    add_card(
        slide,
        7.05,
        3.0,
        5.0,
        2.2,
        "2. Token lock model",
        "Buy `agent1c` community tokens and lock them for fixed periods to unlock more AI credits and higher access tiers.\nThat rewards aligned users while giving the token a clear utility loop.",
        fill=PANEL_DARK,
        title_color=GOLD,
        body_color=rgb("C8D3E2"),
    )
    add_rect(slide, 0.9, 5.7, 11.15, 0.7, BG_DARK_2, radius=True)
    add_text(
        slide,
        "Hybrid model: easy card onboarding for mass users, token-aligned upside for the community.",
        1.2,
        5.93,
        10.55,
        0.22,
        size=14,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 7, dark=True)


def slide_why_now(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "WHY SOLANA, WHY CLOUD", 0.7, 0.62, w=2.95, fill=MINT)
    add_title_block(
        slide,
        "This thesis works because Solana users already behave like OS users.",
        "They move across many apps, many workflows, and many moments of the day.",
    )
    add_card(slide, 0.7, 3.0, 3.55, 1.95, "Solana fit", "Fast, composable ecosystems create more demand for a persistent workspace than a single-page app ever can.", fill=PANEL_LIGHT)
    add_card(slide, 4.55, 3.0, 3.55, 1.95, "Cloud fit", "An onchain OS has to be accessible anywhere, from any browser, not trapped on one machine.", fill=PANEL_LIGHT)
    add_card(slide, 8.4, 3.0, 3.55, 1.95, "Category fit", "The more fragmented the ecosystem gets, the more valuable a coherent home surface becomes.", fill=PANEL_LIGHT)
    add_footer(slide, 8)


def slide_build_path(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "BUILD PATH", 0.7, 0.72, fill=GOLD)
    add_title_block(
        slide,
        "The wedge today points toward the full OS tomorrow.",
        "This is a staged build, not a single giant leap.",
        dark=True,
    )
    add_card(slide, 0.7, 3.0, 2.75, 1.75, "Today", "Cloud desktop shell, app launcher, browser, Solana login, and read-only wallet context.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 3.65, 3.0, 2.75, 1.75, "Next", "Turn launcher surfaces into clearer Solana dapp entry points and richer wallet-aware context.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 6.6, 3.0, 2.75, 1.75, "Then", "Use Hitomi to coordinate deeper DeFi and DePIN workflows across the workspace.", fill=PANEL_DARK, title_color=CORAL, body_color=rgb("C8D3E2"))
    add_card(slide, 9.55, 3.0, 2.75, 1.75, "Later", "Become the default home surface for serious Solana users and teams.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 9, dark=True)


def slide_close(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "CLOSING", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_title_block(
        slide,
        "The future of onchain UX is not more tabs.",
        "It is a wallet-native, cloud-accessible, agentic operating system.",
        width=8.0,
    )
    add_bullets(
        slide,
        [
            "Agent1c.ai is that thesis for Solana.",
            "DeFi and DePIN are where the need is sharpest.",
            "The agentic layer is what makes the OS worth opening every day.",
        ],
        0.7,
        3.1,
        5.5,
        2.0,
        size=18,
    )
    add_rect(slide, 7.25, 2.55, 4.7, 2.7, PANEL_LIGHT, line=rgb("DBE5E8"), radius=True)
    add_text(slide, "Agent1c.ai", 7.8, 3.0, 3.6, 0.3, size=24, color=INK_DARK, bold=True, font=TITLE_FONT, align=PP_ALIGN.CENTER)
    add_text(slide, "The Solana DeFi + DePIN OS", 7.72, 3.45, 3.8, 0.2, size=14, color=INK_MUTED, align=PP_ALIGN.CENTER)
    add_metric_chip(slide, "Cloud-accessible", 7.78, 4.02)
    add_metric_chip(slide, "Wallet-native", 9.88, 4.02)
    add_metric_chip(slide, "Agentic by design", 8.83, 4.58)
    if HEDGEHOG_IMAGE.exists():
        slide.shapes.add_picture(str(HEDGEHOG_IMAGE), Inches(10.0), Inches(5.45), width=Inches(0.95))
    add_footer(slide, 10)


def slide_appendix_current(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "APPENDIX", 0.7, 0.72, fill=SKY, text_color=BG_DARK)
    add_title_block(
        slide,
        "What already exists in the repo today",
        "The vision is future-state, but the starting product surface is real.",
        dark=True,
    )
    add_card(slide, 0.7, 3.0, 2.75, 1.95, "Desktop shell", "Static web desktop, windows, browser, notes, launcher, and cloud runtime.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 3.65, 3.0, 2.75, 1.95, "Cloud path", "Hosted `.ai` flow with cloud auth and managed AI runtime.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 6.6, 3.0, 2.75, 1.95, "App launcher", "`apps.json` already defines a launcher surface that can become the dapp home screen.", fill=PANEL_DARK, title_color=CORAL, body_color=rgb("C8D3E2"))
    add_card(slide, 9.55, 3.0, 2.75, 1.95, "Solana wedge", "Solana sign-in plus read-only wallet context are already implemented.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 11, appendix=True, dark=True)


def slide_appendix_solana(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "APPENDIX", 0.7, 0.62, fill=SKY)
    add_title_block(
        slide,
        "Current Solana proof points in the codebase",
        "These are the repo-backed elements that support the pitch right now.",
    )
    add_card(slide, 0.7, 3.0, 3.55, 1.95, "`js/agent1cauth.js`", "Solana wallet detection and Supabase `signInWithWeb3` auth flow.", fill=PANEL_LIGHT)
    add_card(slide, 4.55, 3.0, 3.55, 1.95, "`js/solana-wallet.js`", "Read-only RPC balance reads, recent signatures, and parsed transaction summaries.", fill=PANEL_LIGHT)
    add_card(slide, 8.4, 3.0, 3.55, 1.95, "`js/agent1c.js` + tools", "Runtime wallet state plus `solana_wallet_overview` and `solana_wallet_refresh` for Hitomi.", fill=PANEL_LIGHT)
    add_footer(slide, 12, appendix=True)


def slide_appendix_placeholders(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "APPENDIX", 0.7, 0.72, fill=SKY, text_color=BG_DARK)
    add_title_block(
        slide,
        "Reserved blocks for the final hackathon version",
        "These are the sections to fill with outside research and live proof before submission.",
        dark=True,
    )
    add_card(slide, 0.7, 3.0, 5.1, 1.45, "Market sizing", "TAM / SAM / SOM or the specific Solana ecosystem framing we want judges to see.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 6.2, 3.0, 5.1, 1.45, "Competition", "Wallets, dashboards, browser assistants, agent products, and adjacent OS-style tools.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 0.7, 4.95, 5.1, 1.45, "Traction", "Usage, demo proof, partner interest, or ecosystem-native signals we want to highlight.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 6.2, 4.95, 5.1, 1.45, "Go-to-market", "Which user wedge we emphasize first: DeFi power users, DePIN operators, teams, or creators.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_footer(slide, 13, appendix=True, dark=True)


def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    slide_cover(prs)
    slide_problem(prs)
    slide_vision(prs)
    slide_product(prs)
    slide_openclaw(prs)
    slide_use_cases(prs)
    slide_business_model(prs)
    slide_why_now(prs)
    slide_build_path(prs)
    slide_close(prs)
    slide_appendix_current(prs)
    slide_appendix_solana(prs)
    slide_appendix_placeholders(prs)
    prs.save(str(OUT_PATH))


if __name__ == "__main__":
    build_deck()
    print(OUT_PATH)
