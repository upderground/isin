/**
 * Jira wiki markup → HTML для прототипа (подмножество: h1–h6, *bold*, {panel}).
 * Вход: строка в формате Jira wiki. Выход: HTML для вставки в contenteditable.
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** *text* → <strong> */
  function parseInline(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    return escaped.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  }

  /** Блок текста: строки h3., пустые пропускаем, обычные → <p>. Без лишних отступов. */
  function parseBlock(text) {
    if (!text || !text.trim()) return '';
    var lines = text.split(/\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === '') continue;
      var headingMatch = line.match(/^h([1-6])\.\s*(.*)$/);
      if (headingMatch) {
        var level = headingMatch[1];
        var rest = headingMatch[2];
        out.push('<h' + level + '>' + parseInline(rest) + '</h' + level + '>');
        continue;
      }
      out.push('<p>' + parseInline(line) + '</p>');
    }
    return out.join('');
  }

  /** Параметры панели из строки title=X|borderStyle=... */
  function parsePanelParams(str) {
    var params = {};
    var parts = str.split('|');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var eq = p.indexOf('=');
      if (eq >= 0) {
        params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
      }
    }
    return params;
  }

  /** Один блок {panel:...} ... {panel} → HTML (тело панели может содержать вложенные панели и h3.) */
  function renderPanel(paramsStr, body) {
    var params = parsePanelParams(paramsStr);
    var title = params.title || '';
    var titleBGColor = params.titleBGColor || '#f0f0f0';
    var borderColor = params.borderColor || '#ddd';
    var bgColor = params.bgColor || '#ffffff';
    var borderStyle = params.borderStyle || 'solid';
    var bodyHtml = jiraWikiToHtml(body);
    return (
      '<div class="jira-visual-panel" style="border:1px ' +
      borderStyle +
      ' ' +
      borderColor +
      ';background:' +
      bgColor +
      ';">' +
      '<div class="jira-visual-panel-title" style="background:' +
      titleBGColor +
      ';border-bottom:1px ' +
      borderStyle +
      ' ' +
      borderColor +
      ';">' +
      escapeHtml(title) +
      '</div>' +
      '<div class="jira-visual-panel-body">' +
      bodyHtml +
      '</div></div>'
    );
  }

  /** Находит позицию парной закрывающей {panel} для открывающего {panel:...} на позиции start. */
  function findPanelEnd(wiki, start) {
    var depth = 1;
    var i = start;
    var openTag = '{panel:';
    var closeTag = '{panel}';
    while (i < wiki.length) {
      if (wiki.slice(i, i + 7) === openTag) {
        depth++;
        i += 7;
        continue;
      }
      if (wiki.slice(i, i + 7) === closeTag) {
        depth--;
        if (depth === 0) return i;
        i += 7;
        continue;
      }
      i++;
    }
    return -1;
  }

  /**
   * Конвертирует Jira wiki разметку в HTML.
   * @param {string} wiki - строка в формате Jira wiki (h3., *bold*, {panel:...}...{panel})
   * @returns {string} HTML
   */
  function jiraWikiToHtml(wiki) {
    if (!wiki || typeof wiki !== 'string') return '';
    wiki = wiki.replace(/\n{2,}/g, '\n');
    var result = '';
    var pos = 0;
    var openTag = '{panel:';
    var closeTag = '{panel}';
    while (pos < wiki.length) {
      var openIdx = wiki.indexOf(openTag, pos);
      if (openIdx === -1) {
        result += parseBlock(wiki.slice(pos));
        break;
      }
      var paramsEnd = wiki.indexOf('}', openIdx);
      if (paramsEnd === -1) {
        result += parseBlock(wiki.slice(pos, openIdx + 1));
        pos = openIdx + 1;
        continue;
      }
      result += parseBlock(wiki.slice(pos, openIdx));
      var paramsStr = wiki.slice(openIdx + 7, paramsEnd);
      var bodyStart = paramsEnd + 1;
      var bodyEnd = findPanelEnd(wiki, bodyStart);
      if (bodyEnd === -1) {
        result += parseBlock(wiki.slice(openIdx));
        break;
      }
      var body = wiki.slice(bodyStart, bodyEnd);
      result += renderPanel(paramsStr, body);
      pos = bodyEnd + 7;
    }
    return result || '<p><br></p>';
  }

  /**
   * Инициализирует визуальный редактор в контейнере.
   * @param {HTMLElement} container - элемент, внутри которого будет contenteditable
   * @param {string} wikiMarkup - начальная разметка Jira wiki
   * @param {Object} [opts] - опции: { syncTo: HTMLElement } — textarea для обратной синхронизации (пока не реализована)
   */
  function initVisualEditor(container, wikiMarkup, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var edit = document.createElement('div');
    edit.className = 'jira-visual-editor';
    edit.contentEditable = 'true';
    edit.setAttribute('data-placeholder', 'Описание');
    edit.innerHTML = jiraWikiToHtml(wikiMarkup || '');
    container.appendChild(edit);
    return edit;
  }

  global.JiraWikiRender = {
    jiraWikiToHtml: jiraWikiToHtml,
    initVisualEditor: initVisualEditor
  };
})(typeof window !== 'undefined' ? window : this);
