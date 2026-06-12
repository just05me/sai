"""MessageStream — chat message bubble with markdown rendering for AI replies."""

from PySide6.QtWidgets import (
    QFrame, QVBoxLayout, QLabel, QTextBrowser, QSizePolicy,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont, QTextOption

from src.utils.constants import (
    SURFACE0, TEXT, SANTI, SUBTEXT0,
    LIGHT_SURFACE0, LIGHT_TEXT, LIGHT_SUBTEXT,
)


FONT_ROLE = QFont("JetBrains Mono", 9, QFont.Bold)
FONT_BODY = QFont("Inter", 11)
FONT_BODY.setStyleHint(QFont.SansSerif)


class MessageStream(QFrame):
    """Single flat message block with divider.

    - User messages render as plain text (mono).
    - AI messages render as markdown via QTextBrowser (lists, code, headings, …).
    """

    def __init__(self, role: str, text: str, is_dark: bool = True, parent=None):
        super().__init__(parent)
        self.setObjectName("messageStream")
        self._role = role
        self._text = text
        self._is_dark = is_dark
        self._render_markdown = (role == "sai")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(6)

        role_label = "Вы" if role == "user" else "Sai"
        self._header = QLabel(role_label)
        self._header.setFont(FONT_ROLE)
        layout.addWidget(self._header)

        if self._render_markdown:
            self._body = QTextBrowser()
            self._body.setOpenExternalLinks(True)
            self._body.setReadOnly(True)
            self._body.setFrameStyle(QFrame.NoFrame)
            self._body.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
            self._body.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
            self._body.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Minimum)
            self._body.document().setDefaultFont(FONT_BODY)
            opt = QTextOption()
            opt.setWrapMode(QTextOption.WordWrap)
            self._body.document().setDefaultTextOption(opt)
            self._body.document().contentsChanged.connect(self._adjust_height)
            self._set_markdown(text)
        else:
            self._body = QLabel(text)
            self._body.setFont(FONT_BODY)
            self._body.setWordWrap(True)
            self._body.setTextInteractionFlags(
                Qt.TextSelectableByMouse | Qt.LinksAccessibleByMouse
            )
            self._body.setOpenExternalLinks(True)
            self._body.setAlignment(Qt.AlignTop | Qt.AlignLeft)
            self._body.setMinimumHeight(20)

        layout.addWidget(self._body)
        self._apply_theme()

    def _set_markdown(self, text: str):
        """Render text as markdown into the QTextBrowser body."""
        if not text:
            self._body.clear()
        else:
            self._body.setMarkdown(text)
        # Re-apply styles since setMarkdown can reset some defaults.
        self._apply_body_theme()
        self._adjust_height()

    def _adjust_height(self):
        if not isinstance(self._body, QTextBrowser):
            return
        # Resize the text browser to fit its content so the outer scroll
        # area handles all chat scrolling (no nested scrollbars).
        doc = self._body.document()
        doc.setTextWidth(self._body.viewport().width())
        h = int(doc.size().height()) + 8
        self._body.setMinimumHeight(max(h, 20))
        self._body.setMaximumHeight(max(h, 20))

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._adjust_height()

    def append_text(self, extra: str):
        """Append text to the body (used for streaming)."""
        self._text += extra
        if self._render_markdown:
            self._set_markdown(self._text)
        else:
            self._body.setText(self._text)

    def set_text(self, text: str, markdown: bool | None = None):
        self._text = text
        if markdown is None:
            markdown = self._render_markdown
        if markdown and isinstance(self._body, QTextBrowser):
            self._set_markdown(text)
        elif isinstance(self._body, QLabel):
            self._body.setText(text)
        else:
            self._body.setPlainText(text)
            self._adjust_height()

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self._apply_theme()

    def _apply_body_theme(self):
        is_dark = self._is_dark
        text_color = TEXT if is_dark else LIGHT_TEXT
        muted = SUBTEXT0 if is_dark else LIGHT_SUBTEXT
        code_bg = "#262637" if is_dark else "#e8e8ef"
        code_border = "#45475a" if is_dark else "#cdd0d8"
        link = "#a4c4ff" if is_dark else "#3b6bc4"

        if isinstance(self._body, QTextBrowser):
            self._body.document().setDefaultStyleSheet(f"""
                body {{ color: {text_color}; }}
                p {{ margin: 0 0 8px 0; line-height: 1.45; }}
                h1, h2, h3, h4 {{
                    color: {text_color};
                    margin: 10px 0 6px 0;
                    font-weight: 600;
                }}
                h1 {{ font-size: 16pt; }}
                h2 {{ font-size: 14pt; }}
                h3 {{ font-size: 12pt; }}
                ul, ol {{ margin: 4px 0 8px 18px; }}
                li {{ margin: 2px 0; }}
                code {{
                    background: {code_bg};
                    border: 1px solid {code_border};
                    border-radius: 4px;
                    padding: 1px 4px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10pt;
                }}
                pre {{
                    background: {code_bg};
                    border: 1px solid {code_border};
                    border-radius: 6px;
                    padding: 10px 12px;
                    margin: 6px 0;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10pt;
                    color: {text_color};
                }}
                blockquote {{
                    border-left: 3px solid {SANTI};
                    margin: 4px 0;
                    padding: 2px 10px;
                    color: {muted};
                    background: {code_bg};
                }}
                a {{ color: {link}; text-decoration: none; }}
                a:hover {{ text-decoration: underline; }}
                strong {{ color: {text_color}; }}
                em {{ color: {muted}; }}
                hr {{ border: 0; border-top: 1px solid {code_border}; margin: 10px 0; }}
                table {{ border-collapse: collapse; margin: 6px 0; }}
                th, td {{
                    border: 1px solid {code_border};
                    padding: 4px 8px;
                }}
                th {{ background: {code_bg}; }}
            """)
            # Re-render to pick up style changes.
            if self._text:
                self._body.setMarkdown(self._text)
        elif isinstance(self._body, QLabel):
            self._body.setStyleSheet(
                f"color: {text_color}; background: transparent;"
            )

    def _apply_theme(self):
        is_dark = self._is_dark
        bg_user = "#262637" if is_dark else "#e8e8ef"
        bg_ai = SURFACE0 if is_dark else LIGHT_SURFACE0
        border = "#313244" if is_dark else "#d0d0da"
        text_color = TEXT if is_dark else LIGHT_TEXT
        bg = bg_user if self._role == "user" else bg_ai

        self.setStyleSheet(f"""
            #messageStream {{
                background: {bg};
                border: none;
                border-top: 1px solid {border};
            }}
            QLabel {{
                background: transparent;
                color: {text_color};
            }}
            QTextBrowser {{
                background: transparent;
                border: none;
                color: {text_color};
            }}
        """)
        header_color = SANTI if self._role == "sai" else text_color
        self._header.setStyleSheet(
            f"color: {header_color}; background: transparent;"
        )
        self._apply_body_theme()
