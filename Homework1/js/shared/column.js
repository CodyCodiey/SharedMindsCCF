/**
 * A column of speech that flows down the page and scrolls itself, used by the
 * versions that keep a readable transcript. Positions are assigned once, when
 * a word arrives, and recomputed only when the window changes size.
 */
export function createColumn(options) {
  const o = {
    fontSize: 26,
    fontFamily: '"Times New Roman", Times, serif',
    lineHeight: 42,
    margin: 52,
    left: 0,           // fraction of the width the column starts at
    focusRatio: 0.7,
    ease: 0.09,
    fullDistance: 380,
    fadeDistance: 1400,
    minAlpha: 0.13,
    cullDistance: 2400,
    ...options,
  };

  const state = {
    tokens: [],
    width: 0, height: 0,
    cursorX: 0, cursorY: 0,
    cameraY: 0,
  };

  const leftEdge = () => state.width * o.left + o.margin;
  const rightEdge = () => state.width - o.margin;
  const setFont = (ctx) => { ctx.font = `${o.fontSize}px ${o.fontFamily}`; };

  function resetCursor() {
    state.cursorX = leftEdge();
    state.cursorY = o.lineHeight * 2;
  }

  function place(ctx, token) {
    const space = ctx.measureText(' ').width;
    const w = ctx.measureText(token.text).width;
    if (state.cursorX > leftEdge() && state.cursorX + w > rightEdge()) {
      state.cursorX = leftEdge();
      state.cursorY += o.lineHeight;
    }
    token.x = state.cursorX;
    token.y = state.cursorY;
    token.w = w;
    state.cursorX += w + space;
  }

  function breakLine() {
    state.cursorX = leftEdge();
    state.cursorY += o.lineHeight * 1.4;
  }

  return {
    options: o,
    state,
    get tokens() { return state.tokens; },

    resize(ctx, width, height) {
      const anchor = state.tokens.length
        ? state.tokens[state.tokens.length - 1].y : state.cursorY;
      const offset = anchor - state.cameraY;
      state.width = width;
      state.height = height;
      setFont(ctx);
      resetCursor();
      let lastThought = null;
      for (const token of state.tokens) {
        if (lastThought !== null && token.thought !== lastThought) breakLine();
        lastThought = token.thought;
        place(ctx, token);
      }
      const moved = state.tokens.length
        ? state.tokens[state.tokens.length - 1].y : state.cursorY;
      state.cameraY = moved - offset;
    },

    add(ctx, tokens, thought) {
      setFont(ctx);
      const previous = state.tokens[state.tokens.length - 1];
      if (previous && previous.thought !== thought) breakLine();
      for (const token of tokens) {
        token.thought = thought;
        place(ctx, token);
        state.tokens.push(token);
      }
    },

    tick() {
      const target = state.cursorY - state.height * o.focusRatio;
      state.cameraY += (target - state.cameraY) * o.ease;
    },

    focusY() {
      return state.cameraY + state.height * o.focusRatio;
    },

    /** How present a line still is, from its distance above the focus line. */
    depth(y) {
      const d = this.focusY() - y;
      if (d > o.cullDistance) return 0;
      if (d <= o.fullDistance) return 1;
      const k = Math.min(1, (d - o.fullDistance) / (o.fadeDistance - o.fullDistance));
      const e = k * k * (3 - 2 * k);
      return 1 + (o.minAlpha - 1) * e;
    },

    setFont,
    leftEdge,
    rightEdge,

    /** Words still being spoken, laid out ahead of the cursor but not kept. */
    drawGhost(ctx, ghost, style) {
      if (!ghost) return;
      ctx.font = `italic ${o.fontSize}px ${o.fontFamily}`;
      ctx.textAlign = 'left';
      const space = ctx.measureText(' ').width;
      let x = state.cursorX;
      let y = state.cursorY;
      ctx.fillStyle = style;
      for (const word of ghost.split(/\s+/)) {
        if (!word) continue;
        const w = ctx.measureText(word).width;
        if (x > leftEdge() && x + w > rightEdge()) { x = leftEdge(); y += o.lineHeight; }
        ctx.fillText(word, x, y - state.cameraY);
        x += w + space;
      }
    },

    reset() {
      state.tokens = [];
      resetCursor();
      state.cameraY = state.cursorY - state.height * o.focusRatio;
    },
  };
}
