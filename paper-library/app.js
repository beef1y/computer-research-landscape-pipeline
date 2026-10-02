const DATA_URL = 'data/papers.json';
const STORAGE_KEY = 'paper-library-state-v2';

const state = {
  papers: [],
  unassignedIds: [],
  groups: [],
  activeView: 'unassigned',
  selectedId: null,
  search: '',
  layout: {
    groups: 245,
    detail: 320
  },
  columnWidths: [52, 132, 250, 260, 260, 250, 240, 280, 320, 94]
};

let dragContext = null;
let dragPreview = null;
let columnResizeContext = null;
let splitterResizeContext = null;

const els = {
  totalCount: document.getElementById('totalCount'),
  unassignedCount: document.getElementById('unassignedCount'),
  groupsList: document.getElementById('groupsList'),
  groupDropZone: document.getElementById('groupDropZone'),
  papersBody: document.getElementById('papersBody'),
  emptyState: document.getElementById('emptyState'),
  emptyMessage: document.getElementById('emptyMessage'),
  viewEyebrow: document.getElementById('viewEyebrow'),
  viewTitle: document.getElementById('viewTitle'),
  searchInput: document.getElementById('searchInput'),
  detailContent: document.getElementById('detailContent'),
  papersTable: document.querySelector('.papers-table'),
  papersColgroup: document.getElementById('papersColgroup'),
  workspace: document.querySelector('.workspace'),
  groupDialog: document.getElementById('groupDialog'),
  groupForm: document.getElementById('groupForm'),
  dialogEyebrow: document.getElementById('dialogEyebrow'),
  dialogTitle: document.getElementById('dialogTitle'),
  groupNameInput: document.getElementById('groupNameInput'),
  groupDescriptionInput: document.getElementById('groupDescriptionInput'),
  editingGroupId: document.getElementById('editingGroupId'),
  parentGroupId: document.getElementById('parentGroupId'),
  newSubgroupButton: document.getElementById('newSubgroupButton'),
  unassignedViewButton: document.getElementById('unassignedViewButton')
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function richText(value) {
  const source = String(value == null ? '' : value).replace(/<br\s*\/?>/gi, '\n');
  const codeSegments = [];
  let escaped = escapeHtml(source).replace(/`([^`\n]+)`/g, function(_, code) {
    const token = '\u0000CODE' + codeSegments.length + '\u0000';
    codeSegments.push('<code>' + code + '</code>');
    return token;
  });

  escaped = escaped
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

  const lines = escaped.split(/\r?\n/);
  const rendered = [];
  let listType = null;

  function closeList() {
    if (listType) rendered.push('</' + listType + '>');
    listType = null;
  }

  lines.forEach(function(line) {
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        rendered.push('<' + nextType + '>');
        listType = nextType;
      }
      rendered.push('<li>' + (unordered ? unordered[1] : ordered[1]) + '</li>');
      return;
    }
    closeList();
    rendered.push(line ? '<span>' + line + '</span><br>' : '<br>');
  });
  closeList();

  return rendered.join('').replace(/\u0000CODE(\d+)\u0000/g, function(_, index) {
    return codeSegments[Number(index)];
  });
}

function titleCompare(a, b) {
  return a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' }) || a.venueYear.localeCompare(b.venueYear, 'en', { sensitivity: 'base' });
}

function sortedIds(ids) {
  return ids.slice().sort(function(a, b) {
    return titleCompare(getPaper(a), getPaper(b));
  });
}

function getPaper(id) {
  return state.papers.find(function(paper) { return paper.id === id; });
}

function getGroup(id) {
  return state.groups.find(function(group) { return group.id === id; });
}

function getChildGroups(parentId) {
  return state.groups.filter(function(group) { return group.parentId === parentId; });
}

function getGroupDescendantIds(groupId) {
  return getChildGroups(groupId).flatMap(function(child) {
    return [child.id].concat(getGroupDescendantIds(child.id));
  });
}

function groupTotalPaperCount(groupId) {
  const group = getGroup(groupId);
  if (!group) return 0;
  return group.paperIds.length + getChildGroups(groupId).reduce(function(total, child) {
    return total + groupTotalPaperCount(child.id);
  }, 0);
}

function loadSavedState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (error) {
    saved = null;
  }

  const validIds = new Set(state.papers.map(function(paper) { return paper.id; }));
  const assigned = new Set();
  const groups = Array.isArray(saved && saved.groups) ? saved.groups : [];
  const rawGroupIds = new Set(groups.map(function(group) { return String(group.id); }));
  state.groups = groups.map(function(group, index) {
    const paperIds = Array.isArray(group.paperIds) ? group.paperIds.filter(function(id) {
      if (!validIds.has(id) || assigned.has(id)) return false;
      assigned.add(id);
      return true;
    }) : [];
    return {
      id: String(group.id || ('group-' + Date.now() + '-' + index)),
      name: String(group.name || '未命名分组').slice(0, 48),
      description: String(group.description || '').slice(0, 180),
      parentId: group.parentId && rawGroupIds.has(String(group.parentId)) ? String(group.parentId) : null,
      paperIds: paperIds
    };
  });
  state.groups.forEach(function(group) {
    const parent = group.parentId ? getGroup(group.parentId) : null;
    if (parent && parent.parentId) group.parentId = null;
  });

  const savedUnassigned = Array.isArray(saved && saved.unassignedIds) ? saved.unassignedIds : [];
  const unassigned = savedUnassigned.filter(function(id) { return validIds.has(id) && !assigned.has(id); });
  const included = new Set(unassigned);
  state.papers.forEach(function(paper) {
    if (!included.has(paper.id) && !assigned.has(paper.id)) unassigned.push(paper.id);
  });
  state.unassignedIds = unassigned;
  state.activeView = saved && saved.activeView === 'unassigned' ? 'unassigned' : (getGroup(saved && saved.activeView) ? saved.activeView : 'unassigned');
  state.selectedId = null;
  if (saved && saved.layout) {
    state.layout.groups = clamp(Number(saved.layout.groups), 180, 420);
    state.layout.detail = clamp(Number(saved.layout.detail), 240, 520);
  }
  if (saved && Array.isArray(saved.columnWidths) && saved.columnWidths.length === state.columnWidths.length) {
    state.columnWidths = saved.columnWidths.map(function(width, index) {
      return clamp(Number(width), minimumColumnWidth(index), 720);
    });
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    unassignedIds: state.unassignedIds,
    groups: state.groups,
    activeView: state.activeView,
    layout: state.layout,
    columnWidths: state.columnWidths
  }));
}

function currentIds() {
  if (state.activeView === 'unassigned') return state.unassignedIds;
  const group = getGroup(state.activeView);
  return group ? group.paperIds : state.unassignedIds;
}

function visiblePapers() {
  const query = state.search.trim().toLowerCase();
  return currentIds().map(getPaper).filter(function(paper) {
    if (!query) return true;
    return [paper.venueYear, paper.title, paper.Q, paper.delta, paper.D, paper.metric, paper.baseline, paper.groundTruth, paper.conclusion]
      .join(' ').toLowerCase().includes(query);
  });
}

function render() {
  applyLayout();
  applyColumnWidths();
  renderGroups();
  renderMainTable();
  renderDetail();
  els.totalCount.textContent = state.papers.length + ' 篇论文';
  els.unassignedCount.textContent = state.unassignedIds.length;
}

function renderGroups() {
  if (!state.groups.length) {
    els.groupsList.innerHTML = '<div class="empty-groups">还没有自定义分组</div>';
    return;
  }
  els.groupsList.innerHTML = state.groups.filter(function(group) { return !group.parentId; }).map(renderGroupBranch).join('');
}

function renderGroupBranch(group) {
  const children = getChildGroups(group.id);
  const isActive = state.activeView === group.id;
  const childCount = children.length;
  const totalCount = groupTotalPaperCount(group.id);
  const directCount = group.paperIds.length;
  const countLabel = childCount ? (directCount + '/' + totalCount) : String(totalCount);
  const subgroupButton = !group.parentId ? '<button class="mini-button" type="button" data-action="new-child-group" data-group-id="' + escapeHtml(group.id) + '">+ 子分组</button>' : '';
  const markup = '<article class="group-item' + (group.parentId ? ' is-child' : '') + (isActive ? ' is-active' : '') + '" draggable="true" data-group-id="' + escapeHtml(group.id) + '">' +
    '<div class="group-item-header">' +
    '<div class="group-item-main"><div class="group-item-name">' + escapeHtml(group.name) + '</div>' +
    (group.description ? '<div class="group-item-description">' + escapeHtml(group.description) + '</div>' : '') +
    (childCount ? '<div class="group-item-subgroup-count">' + childCount + ' 个子分组 · 直接文章/总文章</div>' : '') + '</div>' +
    '<span class="group-item-count">' + countLabel + '</span>' +
    '</div>' +
    '<div class="group-item-actions">' + subgroupButton +
    '<button class="mini-button" type="button" data-action="edit-group" data-group-id="' + escapeHtml(group.id) + '">编辑</button>' +
    '<button class="mini-button danger" type="button" data-action="delete-group" data-group-id="' + escapeHtml(group.id) + '">删除</button>' +
    '</div>' +
    '</article>';
  return markup + (children.length ? '<div class="group-children">' + children.map(renderGroupBranch).join('') + '</div>' : '');
}

function renderMainTable() {
  const group = state.activeView === 'unassigned' ? null : getGroup(state.activeView);
  const papers = visiblePapers();
  els.viewEyebrow.textContent = group ? '当前分组' : '未分组论文';
  els.viewTitle.textContent = group ? group.name : '按标题浏览';
  els.newSubgroupButton.hidden = !(group && !group.parentId);
  els.searchInput.value = state.search;
  els.emptyState.hidden = papers.length !== 0;
  els.emptyMessage.textContent = state.search ? '没有匹配当前搜索的论文。' : (group ? '这个分组还没有论文。' : '所有文章都已加入分组。');
  els.papersBody.innerHTML = papers.map(renderRow).join('');
  if (!papers.length) return;
  bindPaperRows();
}

function renderRow(paper) {
  const selected = state.selectedId === paper.id;
  const inGroupView = state.activeView !== 'unassigned';
  return '<tr draggable="true" data-paper-id="' + escapeHtml(paper.id) + '" class="' + (selected ? 'is-selected' : '') + '">' +
    '<td class="drag-column"><span class="drag-handle" aria-label="拖拽排序" data-tooltip="拖拽排序">⋮⋮</span></td>' +
    '<td><span class="venue-text">' + richText(paper.venueYear) + '</span></td>' +
    '<td><button class="title-button" type="button" data-action="select-paper" data-paper-id="' + escapeHtml(paper.id) + '">' + richText(paper.title) + '</button></td>' +
    '<td class="cell-rich">' + richText(paper.Q) + '</td>' +
    '<td class="cell-rich">' + richText(paper.delta) + '</td>' +
    '<td class="cell-rich">' + richText(paper.metric) + '</td>' +
    '<td class="cell-rich">' + richText(paper.baseline) + '</td>' +
    '<td class="cell-rich">' + richText(paper.groundTruth) + '</td>' +
    '<td class="cell-rich">' + richText(paper.conclusion) + '</td>' +
    '<td><div class="row-actions">' + (inGroupView ? '<button class="table-action remove" type="button" data-action="remove-from-group" data-paper-id="' + escapeHtml(paper.id) + '">移出分组</button>' : '<button class="table-action" type="button" data-action="select-paper" data-paper-id="' + escapeHtml(paper.id) + '">查看</button>') + '</div></td>' +
    '</tr>';
}

function renderDetail() {
  const paper = getPaper(state.selectedId);
  if (!paper) {
    els.detailContent.innerHTML = '<div class="detail-empty"><span class="detail-empty-mark">↗</span><strong>选择一篇论文</strong><p>点击表格中的文章，查看完整的研究链内容。</p></div>';
    return;
  }
  const inGroup = state.groups.find(function(group) { return group.paperIds.includes(paper.id); });
  els.detailContent.innerHTML = '<h3 class="detail-title">' + richText(paper.title) + '</h3>' +
    '<div class="detail-venue">' + richText(paper.venueYear) + '</div>' +
    '<div class="detail-actions">' + (inGroup ? '<button class="button button-secondary" type="button" data-detail-action="remove" data-paper-id="' + escapeHtml(paper.id) + '">移出“' + escapeHtml(inGroup.name) + '”</button>' : '<span class="count-label">当前在原表</span>') + '</div>' +
    detailSection('Q', paper.Q) +
    detailSection('Δ', paper.delta) +
    detailSection('D', formatD(paper.D)) +
    detailSection('metric', paper.metric) +
    detailSection('baseline', paper.baseline) +
    detailSection('ground truth', paper.groundTruth) +
    detailSection('结论', paper.conclusion);
  const removeButton = els.detailContent.querySelector('[data-detail-action="remove"]');
  if (removeButton) removeButton.addEventListener('click', function() { moveToUnassigned(paper.id); });
}

function formatD(value) {
  if (!value) return '未报告';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join('；');
  if (typeof value === 'object') return [value.primary, ...(Array.isArray(value.secondary) ? value.secondary : [])].filter(Boolean).join('；') || '未报告';
  return String(value);
}

function detailSection(label, value) {
  return '<section class="detail-section"><h3>' + escapeHtml(label) + '</h3><p class="cell-rich">' + richText(value) + '</p></section>';
}

function bindPaperRows() {
  els.papersBody.querySelectorAll('tr[data-paper-id]').forEach(function(row) {
    row.addEventListener('click', function(event) {
      if (event.target.closest('button')) return;
      selectPaper(row.dataset.paperId);
    });
    row.addEventListener('dragstart', function(event) {
      dragContext = { type: 'paper', id: row.dataset.paperId, sourceView: state.activeView };
      row.classList.add('is-dragging');
      dragPreview = createDragPreview(getPaper(row.dataset.paperId).title);
      event.dataTransfer.setDragImage(dragPreview, 16, 17);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.dataset.paperId);
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('is-dragging');
      clearDragStyles();
      removeDragPreview();
      dragContext = null;
    });
    row.addEventListener('dragover', function(event) {
      if (!dragContext || dragContext.type !== 'paper') return;
      event.preventDefault();
      row.classList.add('is-dragover');
    });
    row.addEventListener('dragleave', function() { row.classList.remove('is-dragover'); });
    row.addEventListener('drop', function(event) {
      event.preventDefault();
      row.classList.remove('is-dragover');
      if (!dragContext || dragContext.type !== 'paper') return;
      if (dragContext.id === row.dataset.paperId) return;
      if (dragContext.sourceView !== state.activeView) {
        movePaperToView(dragContext.id, state.activeView, row.dataset.paperId);
      } else {
        moveBefore(currentIds(), dragContext.id, row.dataset.paperId);
      }
      persistAndRender();
    });
  });
}

function bindEvents() {
  document.getElementById('newGroupButton').addEventListener('click', function() { openGroupDialog(); });
  els.newSubgroupButton.addEventListener('click', function() {
    const group = getGroup(state.activeView);
    if (group && !group.parentId) openGroupDialog(null, group.id);
  });
  document.getElementById('resetButton').addEventListener('click', resetClassification);
  document.getElementById('titleSortButton').addEventListener('click', sortCurrentView);
  document.getElementById('closeDetailButton').addEventListener('click', function() { state.selectedId = null; renderDetail(); renderMainTable(); });
  els.unassignedViewButton.addEventListener('click', function() {
    state.activeView = 'unassigned';
    state.search = '';
    persistAndRender();
  });
  els.searchInput.addEventListener('input', function(event) { state.search = event.target.value; renderMainTable(); });
  els.groupForm.addEventListener('submit', saveGroupFromDialog);
  document.getElementById('cancelDialogButton').addEventListener('click', closeGroupDialog);
  document.getElementById('cancelDialogAction').addEventListener('click', closeGroupDialog);
  els.groupsList.addEventListener('click', handleGroupClick);
  els.groupsList.addEventListener('dragstart', handleGroupDragStart);
  els.groupsList.addEventListener('dragend', function() {
    clearDragStyles();
    removeDragPreview();
    dragContext = null;
  });
  els.groupsList.addEventListener('dragover', handleGroupDragOver);
  els.groupsList.addEventListener('dragleave', handleGroupDragLeave);
  els.groupsList.addEventListener('drop', handleGroupDrop);
  bindSplitters();
  bindColumnResizers();
  els.groupDropZone.addEventListener('dragover', function(event) {
    if (!dragContext || dragContext.type !== 'group') return;
    event.preventDefault();
    els.groupDropZone.classList.add('is-dragover');
  });
  els.groupDropZone.addEventListener('dragleave', function() { els.groupDropZone.classList.remove('is-dragover'); });
  els.groupDropZone.addEventListener('drop', function(event) {
    event.preventDefault();
    els.groupDropZone.classList.remove('is-dragover');
    if (!dragContext || dragContext.type !== 'group') return;
    const group = getGroup(dragContext.id);
    if (group) {
      group.parentId = null;
      const groupIndex = state.groups.findIndex(function(item) { return item.id === group.id; });
      if (groupIndex >= 0) state.groups.push(state.groups.splice(groupIndex, 1)[0]);
    }
    persistAndRender();
  });
  els.papersBody.addEventListener('dragover', function(event) {
    if (!dragContext || dragContext.type !== 'paper') return;
    if (state.activeView === 'unassigned' && dragContext.sourceView !== 'unassigned') event.preventDefault();
  });
  els.papersBody.addEventListener('drop', function(event) {
    if (!dragContext || dragContext.type !== 'paper' || state.activeView !== 'unassigned' || dragContext.sourceView === 'unassigned') return;
    event.preventDefault();
    moveToUnassigned(dragContext.id);
  });
  els.papersBody.addEventListener('click', function(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'select-paper') selectPaper(button.dataset.paperId);
    if (action === 'remove-from-group') moveToUnassigned(button.dataset.paperId);
  });
}

function handleGroupClick(event) {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const group = getGroup(actionButton.dataset.groupId);
    if (!group) return;
    if (actionButton.dataset.action === 'new-child-group') openGroupDialog(null, group.id);
    if (actionButton.dataset.action === 'edit-group') openGroupDialog(group);
    if (actionButton.dataset.action === 'delete-group') deleteGroup(group);
    return;
  }
  const item = event.target.closest('[data-group-id]');
  if (item) {
    state.activeView = item.dataset.groupId;
    state.search = '';
    persistAndRender();
  }
}

function handleGroupDragStart(event) {
  const item = event.target.closest('[data-group-id]');
  if (!item) return;
  dragContext = { type: 'group', id: item.dataset.groupId };
  dragPreview = createDragPreview(getGroup(item.dataset.groupId).name);
  event.dataTransfer.setDragImage(dragPreview, 16, 17);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', item.dataset.groupId);
}

function handleGroupDragOver(event) {
  const item = event.target.closest('[data-group-id]');
  if (!item || !dragContext) return;
  if (dragContext.type === 'paper') {
    event.preventDefault();
    item.classList.add('is-dragover');
  } else if (dragContext.type === 'group' && dragContext.id !== item.dataset.groupId) {
    const dragged = getGroup(dragContext.id);
    const target = getGroup(item.dataset.groupId);
    if (dragged && target && dragged.parentId === target.parentId) {
      event.preventDefault();
      item.classList.add('is-dragover');
    }
  }
}

function handleGroupDragLeave(event) {
  const item = event.target.closest('[data-group-id]');
  if (item) item.classList.remove('is-dragover');
}

function handleGroupDrop(event) {
  const item = event.target.closest('[data-group-id]');
  if (!item || !dragContext) return;
  event.preventDefault();
  item.classList.remove('is-dragover');
  const currentView = state.activeView;
  if (dragContext.type === 'paper') {
    addPaperToGroup(dragContext.id, item.dataset.groupId);
  } else if (dragContext.type === 'group' && dragContext.id !== item.dataset.groupId) {
    moveGroupBefore(dragContext.id, item.dataset.groupId);
  }
  state.activeView = currentView;
  persistAndRender();
}

function addPaperToGroup(paperId, groupId) {
  removeFromEveryList(paperId);
  const group = getGroup(groupId);
  if (group && !group.paperIds.includes(paperId)) group.paperIds.push(paperId);
  state.selectedId = paperId;
}

function moveToUnassigned(paperId) {
  removeFromEveryList(paperId);
  state.unassignedIds.push(paperId);
  state.activeView = 'unassigned';
  state.selectedId = paperId;
  persistAndRender();
}

function movePaperToView(paperId, viewId, beforeId) {
  removeFromEveryList(paperId);
  if (viewId === 'unassigned') {
    insertBefore(state.unassignedIds, paperId, beforeId);
  } else {
    const group = getGroup(viewId);
    if (group) insertBefore(group.paperIds, paperId, beforeId);
  }
  state.selectedId = paperId;
}

function removeFromEveryList(paperId) {
  state.unassignedIds = state.unassignedIds.filter(function(id) { return id !== paperId; });
  state.groups.forEach(function(group) {
    group.paperIds = group.paperIds.filter(function(id) { return id !== paperId; });
  });
}

function insertBefore(list, id, beforeId) {
  const index = list.indexOf(beforeId);
  if (index < 0) list.push(id); else list.splice(index, 0, id);
}

function moveBefore(list, id, beforeId) {
  const from = list.indexOf(id);
  const to = list.indexOf(beforeId);
  if (from < 0 || to < 0 || from === to) return;
  list.splice(from, 1);
  list.splice(list.indexOf(beforeId), 0, id);
}

function moveGroupBefore(groupId, beforeId) {
  const dragged = getGroup(groupId);
  const target = getGroup(beforeId);
  if (!dragged || !target || dragged.parentId !== target.parentId) return;
  const from = state.groups.findIndex(function(group) { return group.id === groupId; });
  const to = state.groups.findIndex(function(group) { return group.id === beforeId; });
  if (from < 0 || to < 0 || from === to) return;
  const group = state.groups.splice(from, 1)[0];
  state.groups.splice(state.groups.findIndex(function(item) { return item.id === beforeId; }), 0, group);
}

function selectPaper(id) {
  state.selectedId = id;
  renderDetail();
  renderMainTable();
  const row = els.papersBody.querySelector('[data-paper-id="' + CSS.escape(id) + '"]');
  if (row) row.scrollIntoView({ block: 'nearest' });
}

function sortCurrentView() {
  if (state.activeView === 'unassigned') state.unassignedIds = sortedIds(state.unassignedIds);
  else {
    const group = getGroup(state.activeView);
    if (group) group.paperIds = sortedIds(group.paperIds);
  }
  persistAndRender();
}

function openGroupDialog(group, parentId) {
  const editing = Boolean(group);
  const parent = parentId ? getGroup(parentId) : null;
  els.dialogEyebrow.textContent = editing ? '编辑分类' : (parent ? '新建子分类' : '新建分类');
  els.dialogTitle.textContent = editing ? '编辑分组' : (parent ? '创建子分组' : '创建分组');
  els.groupNameInput.value = editing ? group.name : '';
  els.groupDescriptionInput.value = editing ? group.description : '';
  els.editingGroupId.value = editing ? group.id : '';
  els.parentGroupId.value = editing ? (group.parentId || '') : (parent ? parent.id : '');
  els.groupDialog.showModal();
  window.setTimeout(function() { els.groupNameInput.focus(); }, 0);
}

function closeGroupDialog() {
  els.groupDialog.close();
}

function saveGroupFromDialog(event) {
  event.preventDefault();
  const name = els.groupNameInput.value.trim();
  if (!name) return;
  const description = els.groupDescriptionInput.value.trim();
  const editingId = els.editingGroupId.value;
  const requestedParentId = els.parentGroupId.value;
  if (editingId) {
    const group = getGroup(editingId);
    if (group) {
      group.name = name;
      group.description = description;
    }
  } else {
    const parent = requestedParentId ? getGroup(requestedParentId) : null;
    const group = { id: 'group-' + Date.now(), name: name, description: description, parentId: parent && !parent.parentId ? parent.id : null, paperIds: [] };
    state.groups.push(group);
  }
  closeGroupDialog();
  persistAndRender();
}

function deleteGroup(group) {
  const subtree = [group.id].concat(getGroupDescendantIds(group.id));
  const subtreeSet = new Set(subtree);
  const containedPaperIds = state.groups.filter(function(item) { return subtreeSet.has(item.id); }).flatMap(function(item) { return item.paperIds; });
  if (!window.confirm('删除“' + group.name + '”及其子分组？其中的文章会回到原表。')) return;
  state.unassignedIds = state.unassignedIds.concat(containedPaperIds);
  state.groups = state.groups.filter(function(item) { return !subtreeSet.has(item.id); });
  if (subtreeSet.has(state.activeView)) state.activeView = 'unassigned';
  if (state.selectedId && containedPaperIds.includes(state.selectedId)) state.selectedId = null;
  persistAndRender();
}

function resetClassification() {
  if (!window.confirm('重置所有分组和手动排序？文章会按标题回到原表。')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.groups = [];
  state.unassignedIds = sortedIds(state.papers.map(function(paper) { return paper.id; }));
  state.activeView = 'unassigned';
  state.selectedId = null;
  state.search = '';
  render();
}

function clearDragStyles() {
  document.querySelectorAll('.is-dragover').forEach(function(element) { element.classList.remove('is-dragover'); });
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function minimumColumnWidth(index) {
  const minimums = [44, 92, 150, 160, 160, 160, 150, 170, 190, 76];
  return minimums[index] || 100;
}

function applyLayout() {
  els.workspace.style.setProperty('--groups-width', state.layout.groups + 'px');
  els.workspace.style.setProperty('--detail-width', state.layout.detail + 'px');
}

function applyColumnWidths() {
  Array.from(els.papersColgroup.children).forEach(function(column, index) {
    column.style.width = state.columnWidths[index] + 'px';
  });
  els.papersTable.style.width = state.columnWidths.reduce(function(total, width) {
    return total + width;
  }, 0) + 'px';
}

function bindSplitters() {
  els.workspace.querySelectorAll('.column-splitter').forEach(function(splitter) {
    splitter.addEventListener('pointerdown', function(event) {
      event.preventDefault();
      splitterResizeContext = {
        kind: splitter.dataset.splitter,
        startX: event.clientX,
        groups: state.layout.groups,
        detail: state.layout.detail
      };
      splitter.setPointerCapture(event.pointerId);
      document.body.classList.add('is-resizing');
    });
    splitter.addEventListener('pointermove', function(event) {
      if (!splitterResizeContext) return;
      const delta = event.clientX - splitterResizeContext.startX;
      if (splitterResizeContext.kind === 'groups') {
        state.layout.groups = clamp(splitterResizeContext.groups + delta, 180, 420);
      } else {
        state.layout.detail = clamp(splitterResizeContext.detail - delta, 240, 520);
      }
      applyLayout();
    });
    splitter.addEventListener('pointerup', finishSplitterResize);
    splitter.addEventListener('pointercancel', finishSplitterResize);
    splitter.addEventListener('keydown', function(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 12 : -12;
      if (splitter.dataset.splitter === 'groups') {
        state.layout.groups = clamp(state.layout.groups + direction, 180, 420);
      } else {
        state.layout.detail = clamp(state.layout.detail - direction, 240, 520);
      }
      applyLayout();
      saveState();
    });
  });
}

function finishSplitterResize() {
  if (!splitterResizeContext) return;
  splitterResizeContext = null;
  document.body.classList.remove('is-resizing');
  saveState();
}

function bindColumnResizers() {
  els.papersTable.querySelectorAll('.column-resizer').forEach(function(handle) {
    handle.addEventListener('pointerdown', function(event) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(handle.dataset.columnIndex);
      columnResizeContext = {
        index: index,
        startX: event.clientX,
        width: state.columnWidths[index]
      };
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('is-resizing-column');
    });
    handle.addEventListener('pointermove', function(event) {
      if (!columnResizeContext) return;
      const index = columnResizeContext.index;
      state.columnWidths[index] = clamp(
        columnResizeContext.width + event.clientX - columnResizeContext.startX,
        minimumColumnWidth(index),
        720
      );
      applyColumnWidths();
    });
    handle.addEventListener('pointerup', finishColumnResize);
    handle.addEventListener('pointercancel', finishColumnResize);
  });
}

function finishColumnResize() {
  if (!columnResizeContext) return;
  columnResizeContext = null;
  document.body.classList.remove('is-resizing-column');
  saveState();
}

function createDragPreview(label) {
  removeDragPreview();
  const preview = document.createElement('div');
  preview.className = 'drag-ghost';
  preview.textContent = label;
  document.body.appendChild(preview);
  return preview;
}

function removeDragPreview() {
  if (!dragPreview) return;
  dragPreview.remove();
  dragPreview = null;
}

function persistAndRender() {
  saveState();
  render();
}

async function start() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('无法读取论文数据');
  state.papers = await response.json();
  if (!localStorage.getItem(STORAGE_KEY)) {
    try {
      const groupResponse = await fetch('data/group-state.json', { cache: 'no-store' });
      if (groupResponse.ok) localStorage.setItem(STORAGE_KEY, JSON.stringify(await groupResponse.json()));
    } catch (error) {
      // The page can still start with all papers unassigned.
    }
  }
  loadSavedState();
  bindEvents();
  render();
}

start().catch(function(error) {
  console.error(error);
  document.body.innerHTML = '<main style="padding:32px;font-family:system-ui"><h1>论文数据加载失败</h1><p>请通过本地服务器打开此页面，而不是直接双击 HTML 文件。</p></main>';
});
