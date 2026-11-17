/**
 * Dither UI — Motion-First Interactive React Building Blocks (Zero-Build React 18 UMD)
 * Inspired by https://ditherui.dev/ — combines pixel-dither textures, corner reticles,
 * AI citation pills, pixel-matrix loaders, and S-Tier GPU compositor spring physics.
 */
(function () {
  if (typeof window === 'undefined') return;

  function DitherPixelLoader({ active = true, size = 14, color = '#38bdf8', label = '' }) {
    if (!window.React) return null;
    const h = window.React.createElement;
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const cellSize = Math.max(3, Math.floor(size / 4));
    return h(
      'span',
      {
        className: `dither-pixel-loader ${active ? 'is-active' : ''}`,
        style: {
          display: 'inline-grid',
          gridTemplateColumns: `repeat(3, ${cellSize}px)`,
          gap: '2px',
          verticalAlign: 'middle'
        },
        title: label || 'Dither Pixel Matrix'
      },
      cells.map((idx) =>
        h('span', {
          key: idx,
          className: 'dither-pixel-cell',
          style: {
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            backgroundColor: color,
            animationDelay: `${(idx % 5) * 95}ms`
          }
        })
      )
    );
  }

  function DitherCard({ title, badge, children, className = '', style = {}, onClick }) {
    if (!window.React) return null;
    const h = window.React.createElement;
    return h(
      'div',
      {
        className: `dither-card ${className}`,
        style,
        onClick
      },
      h('span', { className: 'dither-corner dither-corner-tl', 'aria-hidden': 'true' }),
      h('span', { className: 'dither-corner dither-corner-tr', 'aria-hidden': 'true' }),
      h('span', { className: 'dither-corner dither-corner-bl', 'aria-hidden': 'true' }),
      h('span', { className: 'dither-corner dither-corner-br', 'aria-hidden': 'true' }),
      (title || badge) &&
        h(
          'div',
          { className: 'dither-card-header' },
          title && h('span', { className: 'dither-card-title' }, title),
          badge && h('span', { className: 'dither-citation-pill' }, badge)
        ),
      children
    );
  }

  function DitherButton({ children, variant = 'primary', onClick, title, disabled = false, style = {} }) {
    if (!window.React) return null;
    const h = window.React.createElement;
    return h(
      'button',
      {
        type: 'button',
        className: `btn btn-sm btn-${variant} dither-btn`,
        onClick,
        title,
        disabled,
        style
      },
      children
    );
  }

  function DitherCitationPill({ source, score, onClick }) {
    if (!window.React) return null;
    const h = window.React.createElement;
    return h(
      'button',
      {
        type: 'button',
        className: 'dither-citation-pill',
        onClick,
        title: score ? `BM25 Relevance Score: ${score}` : source
      },
      h('span', { className: 'dither-dot' }),
      h('span', null, source),
      score !== undefined && h('strong', { style: { marginLeft: '4px', color: '#38bdf8' } }, `${score}`)
    );
  }

  window.DitherUI = {
    DitherPixelLoader,
    DitherCard,
    DitherButton,
    DitherCitationPill
  };
})();
