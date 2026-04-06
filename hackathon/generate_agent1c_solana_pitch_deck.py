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


BG_DARK = rgb("091120")
BG_DARK_2 = rgb("10243C")
BG_LIGHT = rgb("F7F3EA")
BG_SOFT = rgb("EAF2F5")
INK_LIGHT = rgb("F7F4EE")
INK_DARK = rgb("14233B")
INK_MUTED = rgb("4F637D")
MINT = rgb("35E4C4")
SKY = rgb("69CFFF")
CORAL = rgb("FF7A59")
GOLD = rgb("FFC857")
GREEN = rgb("5ED27A")
PANEL_DARK = rgb("16243C")
PANEL_LIGHT = rgb("FFFFFF")
PANEL_SOFT = rgb("EEF4F7")

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


def add_bullets(slide, items, x, y, w, h, *, size=18, color=INK_DARK, leading=1.12):
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


def add_kicker(slide, text, x, y, w=2.5, h=0.38, fill=MINT, text_color=BG_DARK):
    add_rect(slide, x, y, w, h, fill, radius=True)
    add_text(
        slide,
        text,
        x + 0.13,
        y + 0.06,
        w - 0.26,
        h - 0.12,
        size=11,
        color=text_color,
        bold=True,
    )


def add_footer(slide, page, *, appendix=False, dark=False):
    color = INK_LIGHT if dark else INK_MUTED
    label = "Appendix" if appendix else "Pitch Deck"
    add_text(slide, f"Agent1c.ai  |  Solana Hackathon  |  {label}", 0.7, 7.03, 5.0, 0.22, size=10, color=color)
    add_text(slide, str(page), 12.1, 7.01, 0.45, 0.24, size=10, color=color, align=PP_ALIGN.RIGHT)


def decorate_dark(slide):
    add_rect(slide, 0, 0, 13.333, 7.5, BG_DARK)
    add_oval(slide, 10.35, -1.2, 4.3, 4.3, BG_DARK_2)
    add_oval(slide, -0.95, 5.75, 2.5, 2.5, rgb("15233B"))
    add_rect(slide, 0.7, 0.58, 0.65, 0.08, MINT)
    add_rect(slide, 1.42, 0.58, 0.46, 0.08, CORAL)
    add_rect(slide, 1.94, 0.58, 0.36, 0.08, GOLD)


def decorate_light(slide, alt=False):
    add_rect(slide, 0, 0, 13.333, 7.5, BG_SOFT if alt else BG_LIGHT)
    add_rect(slide, 0, 0, 13.333, 0.18, MINT if alt else CORAL)
    add_oval(slide, 11.2, -0.65, 2.45, 2.45, rgb("DEEDEF") if alt else rgb("F1E6D8"))
    add_oval(slide, -0.55, 6.15, 1.8, 1.8, rgb("DCEBEE") if alt else rgb("F0E0D1"))


def add_title_block(slide, title, subtitle, *, dark=False):
    title_color = INK_LIGHT if dark else INK_DARK
    sub_color = rgb("C5D2E2") if dark else INK_MUTED
    add_text(slide, title, 0.7, 1.02, 7.1, 1.1, size=30, color=title_color, bold=True, font=TITLE_FONT)
    add_text(slide, subtitle, 0.7, 1.9, 6.3, 0.75, size=14, color=sub_color)


def add_card(slide, x, y, w, h, title, body, *, fill=PANEL_LIGHT, title_color=INK_DARK, body_color=INK_MUTED):
    add_rect(slide, x, y, w, h, fill, radius=True)
    add_text(slide, title, x + 0.18, y + 0.16, w - 0.36, 0.38, size=14, color=title_color, bold=True)
    add_text(slide, body, x + 0.18, y + 0.56, w - 0.36, h - 0.72, size=12, color=body_color)


def add_number_card(slide, num, title, body, x, y, w, h, *, fill=PANEL_DARK, accent=MINT):
    add_rect(slide, x, y, w, h, fill, radius=True)
    add_oval(slide, x + 0.18, y + 0.18, 0.52, 0.52, accent)
    add_text(slide, str(num), x + 0.18, y + 0.22, 0.52, 0.3, size=14, color=BG_DARK, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, title, x + 0.82, y + 0.17, w - 1.0, 0.34, size=14, color=INK_LIGHT, bold=True)
    add_text(slide, body, x + 0.18, y + 0.74, w - 0.36, h - 0.9, size=12, color=rgb("C9D5E3"))


def slide_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "SOLANA HACKATHON 2026", 0.7, 0.78, w=2.55, fill=GOLD)
    add_text(slide, "Agent1c.ai", 0.7, 1.38, 5.2, 0.7, size=32, color=INK_LIGHT, bold=True, font=TITLE_FONT)
    add_text(
        slide,
        "The Solana DeFi + DePIN OS",
        0.7,
        2.08,
        6.7,
        0.65,
        size=26,
        color=MINT,
        bold=True,
        font=TITLE_FONT,
    )
    add_text(
        slide,
        "A cloud-accessible operating system for your entire onchain life.\nOne wallet-native desktop. One agentic layer. One landing page for the Solana ecosystem.",
        0.7,
        2.95,
        6.0,
        1.15,
        size=17,
        color=rgb("C8D3E2"),
    )
    add_rect(slide, 0.7, 5.1, 6.05, 1.15, PANEL_DARK, radius=True)
    for idx, label in enumerate(["DeFi workspace", "DePIN control plane", "Agentic dapp OS"]):
        chip_x = 0.95 + idx * 1.95
        add_rect(slide, chip_x, 5.43, 1.65, 0.45, BG_DARK_2, line=MINT, radius=True)
        add_text(slide, label, chip_x + 0.1, 5.56, 1.45, 0.2, size=10, color=INK_LIGHT, align=PP_ALIGN.CENTER)
    add_oval(slide, 8.55, 1.15, 3.4, 3.4, rgb("113A45"))
    add_oval(slide, 8.92, 1.52, 2.66, 2.66, rgb("1B4A55"))
    if HEDGEHOG_IMAGE.exists():
        slide.shapes.add_picture(str(HEDGEHOG_IMAGE), Inches(8.96), Inches(1.37), width=Inches(2.62))
    add_text(
        slide,
        "The future homepage of the Solana ecosystem should feel less like a dashboard\nand more like an operating system.",
        7.22,
        5.18,
        4.75,
        0.8,
        size=14,
        color=rgb("C8D3E2"),
    )
    add_footer(slide, 1, dark=True)


def slide_problem(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "PROBLEM", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_text(
        slide,
        "Onchain life is fragmented.\nDeFi and DePIN make that fragmentation worse.",
        0.7,
        1.02,
        6.3,
        1.1,
        size=29,
        color=INK_DARK,
        bold=True,
        font=TITLE_FONT,
    )
    add_bullets(
        slide,
        [
            "Users bounce across wallets, dapps, explorers, dashboards, Discord, Telegram, spreadsheets, and browser tabs.",
            "Every surface knows one tiny slice of the user's state, but none understands the full onchain workflow.",
            "DeFi adds portfolio complexity. DePIN adds devices, uptime, rewards, maps, and operations.",
        ],
        0.7,
        2.58,
        5.55,
        2.7,
        size=17,
    )
    add_rect(slide, 7.0, 1.34, 5.2, 4.85, PANEL_LIGHT, line=rgb("E5DDD1"), radius=True)
    add_card(slide, 7.34, 1.72, 4.55, 0.88, "Wallet", "Good for signing, weak at context.", fill=PANEL_SOFT)
    add_card(slide, 7.34, 2.84, 4.55, 0.88, "Single dapp", "Powerful inside one silo.", fill=PANEL_SOFT)
    add_card(slide, 7.34, 3.96, 4.55, 0.88, "Dashboard", "Observes state, rarely operates it.", fill=PANEL_SOFT)
    add_card(slide, 7.34, 5.08, 4.55, 0.88, "Assistant tab", "Talks separately from the actual workflow.", fill=PANEL_SOFT)
    add_rect(slide, 0.7, 6.2, 11.45, 0.56, INK_DARK, radius=True)
    add_text(
        slide,
        "Solana has network-level composability, but the user experience is still app-by-app, tab-by-tab, and task-by-task.",
        0.92,
        6.37,
        10.95,
        0.22,
        size=14,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 2)


def slide_failure(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "WHY CURRENT PRODUCTS STOP SHORT", 0.7, 0.72, w=3.4, fill=MINT)
    add_title_block(
        slide,
        "Wallets are not operating systems.\nDashboards are not copilots.",
        "The core failure is architectural: users still have to be the orchestrator.",
        dark=True,
    )
    cards = [
        ("Wallet-first UX", "Great for approval flows, but poor at planning, memory, and multi-step work."),
        ("Dapp-first UX", "Each app optimizes for itself, not for the user's total onchain workflow."),
        ("Chat-first UX", "An AI tab without native control of the workspace becomes another place to copy and paste."),
        ("Read-only analytics", "Insight alone does not simplify the work of navigating an ecosystem."),
    ]
    positions = [(0.7, 2.62), (6.8, 2.62), (0.7, 4.52), (6.8, 4.52)]
    for (title, body), (x, y) in zip(cards, positions):
        add_card(slide, x, y, 5.8, 1.46, title, body, fill=PANEL_DARK, title_color=INK_LIGHT, body_color=rgb("C8D3E2"))
    add_footer(slide, 3, dark=True)


def slide_vision(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "VISION", 0.7, 0.62, fill=MINT)
    add_title_block(
        slide,
        "Imagine an operating system for your onchain life.",
        "That framing changes everything: the problem, the product, the distribution, and the role of the agent.",
    )
    add_bullets(
        slide,
        [
            "Your wallet is identity, not just a signing popup.",
            "Your dapps are windows and apps inside one coherent desktop.",
            "Your history, notes, alerts, tools, and decisions persist in one place.",
            "Your AI is not beside the OS. Your AI is part of the OS.",
        ],
        0.7,
        2.56,
        5.3,
        2.55,
        size=18,
    )
    add_rect(slide, 6.55, 1.52, 5.45, 4.9, PANEL_LIGHT, line=rgb("DCE6E8"), radius=True)
    add_card(slide, 6.9, 1.9, 4.72, 1.0, "New category", "Not a chatbot, not a wallet, not a dashboard. A Solana-native cloud desktop.", fill=PANEL_SOFT)
    add_card(slide, 6.9, 3.12, 4.72, 1.0, "New homepage", "A landing page for the ecosystem, where users start and end their onchain session.", fill=PANEL_SOFT)
    add_card(slide, 6.9, 4.34, 4.72, 1.0, "New expectation", "The agent can reason across apps because the apps live inside the same workspace.", fill=PANEL_SOFT)
    add_footer(slide, 4)


def slide_product(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "PRODUCT", 0.7, 0.72, fill=GOLD)
    add_title_block(
        slide,
        "Agent1c.ai is the cloud-accessible Solana DeFi + DePIN OS.",
        "A browser-native desktop where the app launcher becomes a dapp launcher and the desktop becomes the user's persistent onchain workspace.",
        dark=True,
    )
    add_card(slide, 0.7, 2.65, 3.55, 2.15, "Desktop shell", "Windows, browser, notes, files, launcher, and visible state turn the product into a place the user can actually work from.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 4.55, 2.65, 3.55, 2.15, "Dapp landing page", "The current app surfaces evolve into the home screen for Solana ecosystem experiences, tools, and flows.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 8.4, 2.65, 3.55, 2.15, "Agentic operating layer", "Hitomi helps the user navigate the ecosystem, maintain context, and eventually orchestrate multi-app workflows.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_rect(slide, 0.7, 5.45, 11.3, 0.6, BG_DARK_2, radius=True)
    add_text(
        slide,
        "The mental model is simple: Agent1c becomes the place you open when you want to do anything serious on Solana.",
        1.0,
        5.64,
        10.7,
        0.2,
        size=15,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 5, dark=True)


def slide_agentic(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "AGENTIC DIFFERENCE", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_title_block(
        slide,
        "The agent is the operating model, not a decorative assistant.",
        "Once the desktop becomes the system of engagement, the AI can finally work across the user's real environment.",
    )
    add_number_card(slide, 1, "See the workspace", "Apps, windows, notes, browser, and wallet context exist inside one visible environment.", 0.7, 2.52, 2.8, 1.55, fill=INK_DARK, accent=MINT)
    add_number_card(slide, 2, "Reason across apps", "The agent is no longer trapped inside one dapp's bounded UI or one stateless conversation.", 3.62, 2.52, 2.8, 1.55, fill=INK_DARK, accent=SKY)
    add_number_card(slide, 3, "Coordinate workflows", "Multi-step onchain tasks become a native OS behavior instead of a user chore.", 6.54, 2.52, 2.8, 1.55, fill=INK_DARK, accent=CORAL)
    add_number_card(slide, 4, "Keep continuity", "The user's onchain life becomes a continuous workspace, not a sequence of disconnected sessions.", 9.46, 2.52, 2.8, 1.55, fill=INK_DARK, accent=GOLD)
    add_rect(slide, 0.7, 4.7, 11.55, 1.3, PANEL_LIGHT, line=rgb("E2DACE"), radius=True)
    add_text(slide, "Big idea", 1.0, 4.95, 1.0, 0.24, size=14, color=CORAL, bold=True)
    add_text(
        slide,
        "Every dapp is smarter when it is part of a larger workspace with memory, notes, routing, alerts, and an agent that can see across surfaces.",
        1.0,
        5.3,
        10.8,
        0.38,
        size=15,
        color=INK_DARK,
    )
    add_footer(slide, 6)


def slide_defi(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "DEFI OS", 0.7, 0.72, fill=MINT)
    add_title_block(
        slide,
        "For DeFi, Agent1c becomes the user's command center.",
        "The future product is not one more DeFi app. It is the workspace where DeFi activity is monitored, understood, and executed.",
        dark=True,
    )
    cards = [
        ("Portfolio context", "Wallets, positions, watchlists, notes, and recent decisions stay in one environment."),
        ("Research + action", "The browser, the agent, and the dapp surfaces live together instead of in separate tabs."),
        ("Cross-dapp orchestration", "The system can help route the user across lending, LPs, staking, governance, and treasury flows."),
        ("Persistent memory", "The OS remembers what the user was doing, what changed, and what requires attention."),
    ]
    positions = [(0.7, 2.62), (6.8, 2.62), (0.7, 4.52), (6.8, 4.52)]
    for (title, body), (x, y) in zip(cards, positions):
        add_card(slide, x, y, 5.8, 1.46, title, body, fill=PANEL_DARK, title_color=MINT if x < 1 else SKY, body_color=rgb("C8D3E2"))
    add_footer(slide, 7, dark=True)


def slide_depin(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "DEPIN OS", 0.7, 0.62, fill=MINT)
    add_title_block(
        slide,
        "For DePIN, Agent1c becomes an operations layer.",
        "DePIN is especially suited to an OS framing because the user is managing networks, hardware, rewards, and status over time.",
    )
    add_bullets(
        slide,
        [
            "Track device fleets, rewards, uptime, and role-specific dashboards from one cloud workspace.",
            "Use the agent to summarize what changed, what is underperforming, and where attention is needed.",
            "Treat DePIN management as ongoing operations work instead of occasional visits to siloed dashboards.",
            "Let the OS become the home surface for the long tail of ecosystem-specific tools.",
        ],
        0.7,
        2.6,
        5.45,
        2.8,
        size=17,
    )
    add_rect(slide, 6.65, 1.65, 5.35, 4.95, PANEL_LIGHT, line=rgb("DCE6E8"), radius=True)
    add_card(slide, 7.0, 2.02, 4.65, 0.96, "What changes", "The user stops thinking in terms of \"which tab do I need?\" and starts thinking in terms of \"what does my network need?\"", fill=PANEL_SOFT)
    add_card(slide, 7.0, 3.22, 4.65, 0.96, "Why cloud matters", "DePIN operators need access anywhere, from any browser, without requiring the same local machine every time.", fill=PANEL_SOFT)
    add_card(slide, 7.0, 4.42, 4.65, 0.96, "Why agentic matters", "A DePIN OS should not just display state. It should help interpret and route the operator's attention.", fill=PANEL_SOFT)
    add_footer(slide, 8)


def slide_cloud(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "CLOUD ANYWHERE", 0.7, 0.72, fill=GOLD)
    add_title_block(
        slide,
        "The OS has to be accessible from anywhere.",
        "Cloud access is not a convenience detail. It is part of the category definition.",
        dark=True,
    )
    add_bullets(
        slide,
        [
            "Users should be able to open their onchain workspace from any browser, on any machine.",
            "The workspace should travel with the user, not be trapped on one laptop and one wallet extension session.",
            "Cloud access is what turns Agent1c into a landing page for the ecosystem instead of a niche local tool.",
        ],
        0.7,
        2.72,
        5.7,
        2.2,
        size=17,
        color=rgb("C8D3E2"),
    )
    add_card(slide, 7.05, 2.2, 4.8, 1.02, "Anywhere access", "Open the OS where you are, not where your workstation happens to be.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 7.05, 3.48, 4.8, 1.02, "Ecosystem entry point", "Dapps become reachable through one familiar home surface instead of hundreds of bookmarks.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 7.05, 4.76, 4.8, 1.02, "Agent continuity", "The assistant retains context because the workspace itself is persistent.", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 9, dark=True)


def slide_ecosystem(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "ECOSYSTEM LANDING PAGE", 0.7, 0.62, w=3.25, fill=CORAL, text_color=INK_LIGHT)
    add_title_block(
        slide,
        "Today's app launcher becomes tomorrow's Solana dapp launcher.",
        "That is the bridge from the current product surface to the future category.",
    )
    add_card(slide, 0.7, 2.55, 3.45, 2.15, "Current repo surface", "The product already has a desktop shell, an app launcher, browser windows, notes, and multiple app entries in `apps.json`.", fill=PANEL_LIGHT)
    add_card(slide, 4.5, 2.55, 3.45, 2.15, "Future reinterpretation", "Those app slots become curated Solana ecosystem entry points: DeFi, DePIN, infra, research, communities, and more.", fill=PANEL_LIGHT)
    add_card(slide, 8.3, 2.55, 3.45, 2.15, "Platform effect", "Users enter through Agent1c first, then flow into the ecosystem through a workspace that keeps context.", fill=PANEL_LIGHT)
    add_rect(slide, 0.7, 5.15, 11.0, 0.85, INK_DARK, radius=True)
    add_text(
        slide,
        "This is why placeholder and self-made apps matter strategically: they prove the shell pattern that future Solana dapps can occupy.",
        1.0,
        5.42,
        10.45,
        0.24,
        size=15,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 10)


def slide_solana(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "WHY SOLANA", 0.7, 0.72, fill=MINT)
    add_title_block(
        slide,
        "Solana is the right ecosystem for an operating-system thesis.",
        "The network already has the density, speed, and user behavior that make a unified onchain workspace compelling.",
        dark=True,
    )
    cards = [
        ("Composability", "An OS layer matters most where users naturally move between many protocols and surfaces."),
        ("Real-time usage", "Fast networks create more reasons to stay in an always-on workspace instead of a one-off web page."),
        ("Wallet-native culture", "Solana users already understand wallet-driven identity, which makes the OS login model legible."),
        ("DeFi + DePIN breadth", "Few ecosystems make the DeFi + DePIN combined category vision feel this native."),
    ]
    positions = [(0.7, 2.6), (6.8, 2.6), (0.7, 4.48), (6.8, 4.48)]
    for idx, ((title, body), (x, y)) in enumerate(zip(cards, positions)):
        accent = [MINT, SKY, CORAL, GOLD][idx]
        add_card(slide, x, y, 5.8, 1.42, title, body, fill=PANEL_DARK, title_color=accent, body_color=rgb("C8D3E2"))
    add_footer(slide, 11, dark=True)


def slide_rollout(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "BUILD PATH", 0.7, 0.62, fill=MINT)
    add_title_block(
        slide,
        "The path to the full vision is already visible.",
        "The category pitch is future-facing, but the build path can be explained step by step.",
    )
    add_number_card(slide, 1, "Today", "Cloud desktop shell, app launcher, browser, Solana sign-in, and read-only wallet context exist as the starting wedge.", 0.7, 2.58, 2.85, 1.7, fill=INK_DARK, accent=MINT)
    add_number_card(slide, 2, "Next", "Turn launcher surfaces into ecosystem-native dapp entry points and deepen Solana-specific context.", 3.67, 2.58, 2.85, 1.7, fill=INK_DARK, accent=SKY)
    add_number_card(slide, 3, "Then", "Let Hitomi coordinate richer cross-app DeFi and DePIN workflows across the workspace.", 6.64, 2.58, 2.85, 1.7, fill=INK_DARK, accent=CORAL)
    add_number_card(slide, 4, "Later", "Agent1c becomes the default browser home for serious onchain users and teams.", 9.61, 2.58, 2.85, 1.7, fill=INK_DARK, accent=GOLD)
    add_rect(slide, 0.7, 4.85, 11.65, 1.1, PANEL_LIGHT, line=rgb("DCE6E8"), radius=True)
    add_text(slide, "Important", 1.0, 5.12, 1.2, 0.22, size=14, color=CORAL, bold=True)
    add_text(
        slide,
        "The wedge does not need to be the full OS on day one. It only needs to make the OS feel inevitable.",
        1.0,
        5.48,
        10.9,
        0.24,
        size=15,
        color=INK_DARK,
        bold=True,
    )
    add_footer(slide, 12)


def slide_platform(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "PLATFORM THESIS", 0.7, 0.72, fill=GOLD)
    add_title_block(
        slide,
        "If Agent1c wins, it becomes more than an app.",
        "It becomes distribution, workspace, context layer, and agentic shell for the Solana ecosystem.",
        dark=True,
    )
    add_bullets(
        slide,
        [
            "Users start from Agent1c instead of starting from a bookmark folder.",
            "Protocols gain a richer home surface inside a context-preserving workspace.",
            "The OS becomes the place where ecosystem discovery, operations, and execution all converge.",
            "That gives Agent1c a chance to become the persistent front door to Solana.",
        ],
        0.7,
        2.75,
        5.85,
        2.75,
        size=17,
        color=rgb("C8D3E2"),
    )
    add_card(slide, 7.05, 2.25, 4.85, 1.05, "User value", "Less fragmentation. More continuity. Better operating leverage.", fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_card(slide, 7.05, 3.55, 4.85, 1.05, "Protocol value", "A richer, agent-friendly environment than a standalone browser tab.", fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_card(slide, 7.05, 4.85, 4.85, 1.05, "Category value", "A real answer to the question: what does an onchain operating system actually look like?", fill=PANEL_DARK, title_color=GOLD, body_color=rgb("C8D3E2"))
    add_footer(slide, 13, dark=True)


def slide_close(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide)
    add_kicker(slide, "CLOSING", 0.7, 0.62, fill=CORAL, text_color=INK_LIGHT)
    add_text(
        slide,
        "The future of onchain UX is not\nmore tabs.\nIt is an operating system.",
        0.7,
        1.05,
        6.7,
        1.7,
        size=30,
        color=INK_DARK,
        bold=True,
        font=TITLE_FONT,
    )
    add_bullets(
        slide,
        [
            "Agent1c.ai is that OS thesis for Solana.",
            "DeFi and DePIN are where the need is sharpest.",
            "The agentic layer is what makes the OS worth opening every day.",
        ],
        0.7,
        3.15,
        5.8,
        1.9,
        size=18,
    )
    add_rect(slide, 7.25, 1.42, 4.7, 4.8, PANEL_LIGHT, line=rgb("DCE6E8"), radius=True)
    add_text(slide, "Agent1c.ai", 7.82, 1.95, 3.6, 0.4, size=24, color=INK_DARK, bold=True, font=TITLE_FONT, align=PP_ALIGN.CENTER)
    add_text(slide, "The Solana DeFi + DePIN OS", 7.72, 2.42, 3.8, 0.25, size=14, color=INK_MUTED, align=PP_ALIGN.CENTER)
    for idx, label in enumerate(["Cloud-accessible", "Wallet-native", "Agentic by design"]):
        y = 3.02 + idx * 0.72
        add_rect(slide, 8.23, y, 2.76, 0.5, INK_DARK, radius=True)
        add_text(slide, label, 8.34, y + 0.16, 2.54, 0.18, size=12, color=INK_LIGHT, align=PP_ALIGN.CENTER)
    if HEDGEHOG_IMAGE.exists():
        slide.shapes.add_picture(str(HEDGEHOG_IMAGE), Inches(9.02), Inches(5.18), width=Inches(1.1))
    add_footer(slide, 14)


def slide_appendix_current(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "APPENDIX", 0.7, 0.72, fill=SKY, text_color=BG_DARK)
    add_title_block(
        slide,
        "What already exists in the repo today",
        "The vision is future-state, but it is being built on real product surfaces that already exist.",
        dark=True,
    )
    cards = [
        ("Desktop shell", "Static web desktop, window manager, browser, notes, launcher, and cloud runtime."),
        ("Cloud path", "Hosted `.ai` flow with cloud auth and managed AI runtime."),
        ("App launcher", "`apps.json` already defines launcher surfaces that can evolve into dapp surfaces."),
        ("Solana wedge", "Solana sign-in, wallet identity parsing, and read-only wallet tools are already implemented."),
    ]
    positions = [(0.7, 2.42), (3.95, 2.42), (7.2, 2.42), (10.45, 2.42)]
    for (title, body), (x, y) in zip(cards, positions):
        add_card(slide, x, y, 2.55, 3.05, title, body, fill=PANEL_DARK, title_color=MINT, body_color=rgb("C8D3E2"))
    add_footer(slide, 15, appendix=True, dark=True)


def slide_appendix_arch(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_light(slide, alt=True)
    add_kicker(slide, "APPENDIX", 0.7, 0.62, fill=SKY)
    add_title_block(
        slide,
        "Future system architecture at a glance",
        "A simple way to explain how the end-state product hangs together.",
    )
    add_card(slide, 0.7, 2.7, 2.7, 2.1, "Wallet identity", "The wallet anchors the user's onchain identity, continuity, and permissions.", fill=PANEL_LIGHT)
    add_card(slide, 3.65, 2.7, 2.7, 2.1, "Agentic desktop", "One cloud workspace with windows, memory, browser, notes, and launcher surfaces.", fill=PANEL_LIGHT)
    add_card(slide, 6.6, 2.7, 2.7, 2.1, "Dapp surfaces", "The launcher opens ecosystem-native DeFi and DePIN app experiences inside the OS.", fill=PANEL_LIGHT)
    add_card(slide, 9.55, 2.7, 2.7, 2.1, "Agent orchestration", "Hitomi reasons across the workspace and helps users navigate multi-app tasks.", fill=PANEL_LIGHT)
    add_text(slide, "→", 3.4, 3.55, 0.18, 0.2, size=20, color=CORAL, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, "→", 6.35, 3.55, 0.18, 0.2, size=20, color=CORAL, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, "→", 9.3, 3.55, 0.18, 0.2, size=20, color=CORAL, bold=True, align=PP_ALIGN.CENTER)
    add_rect(slide, 0.7, 5.45, 11.55, 0.78, INK_DARK, radius=True)
    add_text(
        slide,
        "That is the category claim in one line: a wallet-native cloud desktop that becomes the operating system for the Solana ecosystem.",
        1.0,
        5.7,
        10.95,
        0.22,
        size=14,
        color=INK_LIGHT,
        bold=True,
        align=PP_ALIGN.CENTER,
    )
    add_footer(slide, 16, appendix=True)


def slide_appendix_placeholders(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    decorate_dark(slide)
    add_kicker(slide, "APPENDIX", 0.7, 0.72, fill=SKY, text_color=BG_DARK)
    add_title_block(
        slide,
        "Reserved research blocks for the final hackathon version",
        "These are intentionally structured now so we can layer in external validation without rewriting the whole narrative.",
        dark=True,
    )
    placeholders = [
        ("Market sizing", "TAM / SAM / SOM or whichever ecosystem framing we want judges to see."),
        ("Competitive map", "Wallets, dashboards, agent products, browser extensions, and adjacent OS-like tools."),
        ("Traction proof", "Metrics, demos, user quotes, ecosystem partner interest, or usage evidence."),
        ("Go-to-market", "Who adopts first: DeFi power users, DePIN operators, onchain teams, or ecosystem-native creators."),
    ]
    positions = [(0.7, 2.55), (6.6, 2.55), (0.7, 4.38), (6.6, 4.38)]
    for (title, body), (x, y) in zip(placeholders, positions):
        add_card(slide, x, y, 5.1, 1.35, title, body, fill=PANEL_DARK, title_color=SKY, body_color=rgb("C8D3E2"))
    add_footer(slide, 17, appendix=True, dark=True)


def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    slide_cover(prs)
    slide_problem(prs)
    slide_failure(prs)
    slide_vision(prs)
    slide_product(prs)
    slide_agentic(prs)
    slide_defi(prs)
    slide_depin(prs)
    slide_cloud(prs)
    slide_ecosystem(prs)
    slide_solana(prs)
    slide_rollout(prs)
    slide_platform(prs)
    slide_close(prs)
    slide_appendix_current(prs)
    slide_appendix_arch(prs)
    slide_appendix_placeholders(prs)
    prs.save(str(OUT_PATH))


if __name__ == "__main__":
    build_deck()
    print(OUT_PATH)
