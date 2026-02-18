/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Edição Inline de Destaques                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function enableHighlightInlineEdit() {
  document.querySelectorAll('.highlight-edit-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const card = btn.closest('.highlight-card');
      const textSpan = card.querySelector('.highlight-text');
      if (!textSpan) return;

      if (card.querySelector('input')) return;

      const oldText = textSpan.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = oldText;
      input.className = 'highlight-edit-input';
      input.style.width = (textSpan.offsetWidth + 20) + 'px';

      textSpan.replaceWith(input);
      input.focus();

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const newText = input.value.trim();
          const newSpan = document.createElement('span');
          newSpan.className = 'highlight-text';
          newSpan.textContent = newText;
          input.replaceWith(newSpan);
        }
        if (e.key === 'Escape') {
          input.replaceWith(textSpan);
        }
      });

      input.addEventListener('blur', function () {
        input.replaceWith(textSpan);
      });
    });
  });
}
