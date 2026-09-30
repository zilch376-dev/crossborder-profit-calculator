// 页面导航与交互层：只负责界面组织，不修改任何利润或报价计算公式。
const toolPanels = [...document.querySelectorAll('.tool-panel')];
const homeSection = document.getElementById('homeSection');
const toolContextBar = document.getElementById('toolContextBar');
const toolContextTitle = document.getElementById('toolContextTitle');
const menuToggle = document.getElementById('menuToggle');
const primaryNavigation = document.getElementById('primaryNavigation');
const toolTabs = [...document.querySelectorAll('[data-tool-target]')];
let activeToolId = null;
let activeToolGroup = null;
let activeToolTab = null;

const groupTitleKeys = {
  profit: 'ui.profitTools',
  pricing: 'ui.pricingTools',
  data: 'ui.dataTools'
};

function closeMobileMenu() {
  primaryNavigation.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

function setTopNavigationState(route) {
  document.querySelectorAll('#primaryNavigation [data-route]').forEach(link => {
    const active = link.dataset.route === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// 统一双栏工具的页面结构：全宽标题，下方左侧输入、右侧结果。
function normalizeSplitToolLayout() {
  document.querySelectorAll('.split-tool').forEach(panel => {
    const form = panel.querySelector(':scope > form');
    const heading = form?.querySelector(':scope > .section-title');
    const result = panel.querySelector(':scope > .results');
    if (heading) {
      heading.classList.add('tool-page-heading');
      panel.prepend(heading);
    }
    form?.classList.add('tool-input-panel');
    result?.classList.add('tool-output-panel');
  });
}

// 为数字输入补充统一的右侧单位。只调整表单展示，不改变输入值。
const inputUnitKeys = {
  purchaseCost: 'ui.unitCny', shippingCost: 'ui.unitCny', advertisingCost: 'ui.unitCny', otherCost: 'ui.unitCny',
  quotePurchaseCost: 'ui.unitCny', quoteShippingCost: 'ui.unitCny', quoteAdvertisingCost: 'ui.unitCny', quoteOtherCost: 'ui.unitCny',
  scenarioAAdvertising: 'ui.unitCny', scenarioBAdvertising: 'ui.unitCny', scenarioCAdvertising: 'ui.unitCny',
  tradePurchaseCost: 'ui.unitCny', tradeDomesticCost: 'ui.unitCny', tradePortCost: 'ui.unitCny',
  tradeInternationalCost: 'ui.unitCny', tradeInsuranceCost: 'ui.unitCny', tradeOtherCost: 'ui.unitCny',
  salePrice: 'ui.unitUsd', scenarioAPrice: 'ui.unitUsd', scenarioBPrice: 'ui.unitUsd', scenarioCPrice: 'ui.unitUsd',
  exchangeRate: 'ui.unitRate', quoteExchangeRate: 'ui.unitRate', tradeExchangeRate: 'ui.unitRate',
  commissionRate: 'ui.unitPercent', quoteCommissionRate: 'ui.unitPercent', quoteTargetProfitRate: 'ui.unitPercent',
  safetyMarginRate: 'ui.unitPercent', comparisonWarningRate: 'ui.unitPercent', scenarioACommission: 'ui.unitPercent',
  scenarioBCommission: 'ui.unitPercent', scenarioCCommission: 'ui.unitPercent', tradeTargetMargin: 'ui.unitPercent',
  quantity: 'ui.unitQuantity', quoteQuantity: 'ui.unitQuantity', tradeQuantity: 'ui.unitQuantity'
};

function enhanceInputUnits() {
  Object.entries(inputUnitKeys).forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (!input || input.parentElement?.classList.contains('input-with-unit')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'input-with-unit';
    input.before(wrapper);
    wrapper.appendChild(input);
    const unit = document.createElement('span');
    unit.className = 'input-unit';
    unit.dataset.unitKey = key;
    unit.textContent = t(key);
    wrapper.appendChild(unit);
  });
}

function parseDisplayedAmount(id) {
  const text = document.getElementById(id)?.textContent || '';
  const value = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function updateCostStructureBars() {
  const result = document.getElementById('resultSection');
  if (!result || result.hidden) return;
  const total = parseDisplayedAmount('totalCost');
  const values = {
    Product: parseDisplayedAmount('productCost'),
    Commission: parseDisplayedAmount('commission'),
    Shipping: Number(document.getElementById('shippingCost').value) || 0,
    Advertising: Number(document.getElementById('advertisingCost').value) || 0,
    Other: Number(document.getElementById('otherCost').value) || 0
  };
  Object.entries(values).forEach(([name, amount]) => {
    const percentage = total > 0 ? Math.max(0, Math.min(100, amount / total * 100)) : 0;
    const rounded = Number(percentage.toFixed(1));
    const progress = document.getElementById(`costBar${name}`);
    const label = document.getElementById(`costShare${name}`);
    if (progress && Number(progress.value) !== rounded) progress.value = rounded;
    if (label && label.textContent !== `${rounded.toFixed(1)}%`) label.textContent = `${rounded.toFixed(1)}%`;
  });
}

function updateToolTabs(group, selectedTab = null) {
  toolTabs.forEach(button => {
    const visible = button.dataset.toolGroup === group;
    button.hidden = !visible;
    const active = visible && (selectedTab ? button === selectedTab : button.dataset.toolTarget === activeToolId && !button.dataset.focusTarget);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function showHome(updateHash = true) {
  activeToolId = null;
  activeToolGroup = null;
  activeToolTab = null;
  homeSection.hidden = false;
  toolContextBar.hidden = true;
  toolPanels.forEach(panel => {
    panel.hidden = true;
    panel.classList.remove('active');
  });
  setTopNavigationState('home');
  closeMobileMenu();
  if (updateHash) history.pushState(null, '', '#homeSection');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTool(targetId, options = {}) {
  const panel = document.getElementById(targetId);
  if (!panel?.classList.contains('tool-panel')) return;
  activeToolId = targetId;
  activeToolGroup = panel.dataset.toolGroup;
  activeToolTab = options.selectedTab || null;
  homeSection.hidden = true;
  toolContextBar.hidden = false;
  toolPanels.forEach(item => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle('active', active);
  });
  toolContextTitle.textContent = t(groupTitleKeys[activeToolGroup]);
  updateToolTabs(activeToolGroup, activeToolTab);
  setTopNavigationState(activeToolGroup);
  closeMobileMenu();
  if (options.updateHash !== false) history.pushState(null, '', `#${targetId}`);
  requestAnimationFrame(() => {
    const top = toolContextBar.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top: Math.max(0, top), behavior: options.instant ? 'auto' : 'smooth' });
    if (!options.focusTarget) return;
    const focusElement = document.getElementById(options.focusTarget);
    if (focusElement && !document.getElementById('resultSection').hidden) {
      focusElement.click();
      document.getElementById('aiAnalysisSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      document.getElementById('purchaseCost')?.focus({ preventScroll: true });
    }
  });
}

function createAdvancedSettings() {
  const form = document.getElementById('profitForm');
  const basicGrid = form.querySelector('.input-grid');
  basicGrid.classList.add('essential-input-grid');
  ['purchaseCost', 'salePrice', 'quantity', 'platform', 'exchangeRate'].forEach(id => {
    const field = document.getElementById(id)?.closest('label');
    if (field) basicGrid.appendChild(field);
  });

  const details = document.createElement('details');
  details.id = 'mainAdvancedSettings';
  details.className = 'advanced-settings';
  const summary = document.createElement('summary');
  summary.innerHTML = `<span>${t('ui.moreFees')}</span><small>${t('ui.moreFeesHint')}</small>`;
  const advancedGrid = document.createElement('div');
  advancedGrid.className = 'input-grid advanced-input-grid';
  ['productName', 'sku', 'shippingCost', 'commissionRate', 'advertisingCost', 'otherCost'].forEach(id => {
    const field = document.getElementById(id)?.closest('label');
    if (field) advancedGrid.appendChild(field);
  });
  details.append(summary, advancedGrid);
  form.insertBefore(details, document.getElementById('errorMessage'));

  const actions = form.querySelector('.actions');
  const shortcut = document.createElement('button');
  shortcut.type = 'button';
  shortcut.id = 'saveProductShortcut';
  shortcut.className = 'button tertiary';
  shortcut.textContent = t('ui.saveSku');
  const shortcutMessage = document.createElement('div');
  shortcutMessage.id = 'mainSaveMessage';
  shortcutMessage.className = 'message';
  shortcutMessage.setAttribute('role', 'status');
  shortcutMessage.hidden = true;
  shortcut.addEventListener('click', () => {
    details.open = true;
    const sourceMessage = document.getElementById('productMessage');
    sourceMessage.hidden = true;
    document.getElementById('saveProductButton').click();
    requestAnimationFrame(() => {
      if (sourceMessage.hidden) return;
      shortcutMessage.textContent = sourceMessage.textContent;
      shortcutMessage.className = sourceMessage.className;
      shortcutMessage.hidden = false;
    });
  });
  actions.appendChild(shortcut);
  actions.after(shortcutMessage);

  form.addEventListener('submit', () => {
    requestAnimationFrame(() => {
      if (!document.getElementById('errorMessage').hidden) details.open = true;
    });
  });
  return { details, summary, shortcut };
}

function createResultPlaceholder(panelId, resultId, titleKey, textKey) {
  const panel = document.getElementById(panelId);
  const result = document.getElementById(resultId);
  const placeholder = document.createElement('div');
  placeholder.className = 'result-placeholder';
  placeholder.innerHTML = `<span aria-hidden="true">↗</span><h3>${t(titleKey)}</h3><p>${t(textKey)}</p>`;
  panel.insertBefore(placeholder, result);
  const sync = () => { placeholder.hidden = !result.hidden; };
  new MutationObserver(sync).observe(result, { attributes: true, attributeFilter: ['hidden'] });
  sync();
  return { placeholder, titleKey, textKey };
}

normalizeSplitToolLayout();
enhanceInputUnits();
const advancedUi = createAdvancedSettings();
const resultPlaceholders = [
  createResultPlaceholder('calculatorSection', 'resultSection', 'ui.analysisEmptyTitle', 'ui.analysisEmptyText'),
  createResultPlaceholder('breakEvenSection', 'breakEvenResultSection', 'ui.breakEvenPlaceholderTitle', 'ui.breakEvenPlaceholderText'),
  createResultPlaceholder('quoteAssistantSection', 'quoteResultSection', 'ui.pricingPlaceholderTitle', 'ui.pricingPlaceholderText'),
  createResultPlaceholder('tradeQuoteSection', 'tradeQuoteResultSection', 'ui.analysisEmptyTitle', 'ui.analysisEmptyText')
];

const mainResultObserver = new MutationObserver(updateCostStructureBars);
mainResultObserver.observe(document.getElementById('resultSection'), { attributes: true, childList: true, characterData: true, subtree: true });
document.getElementById('profitForm').addEventListener('submit', () => requestAnimationFrame(updateCostStructureBars));

function updateTradeTermDescription() {
  const term = document.getElementById('tradeTerm').value;
  document.getElementById('tradeTermCurrentCode').textContent = term;
  document.getElementById('tradeTermDescription').textContent = t(`ui.tradeTermName${term}`);
  document.querySelectorAll('[data-trade-term]').forEach(button => {
    button.textContent = button.dataset.tradeTerm;
  });
}

function updateTradeTermUi() {
  const termSelect = document.getElementById('tradeTerm');
  const term = termSelect.value;
  updateTradeTermDescription();
  document.querySelectorAll('[data-trade-term]').forEach(button => {
    const active = button.dataset.tradeTerm === term;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const visibility = {
    tradeDomesticCost: ['FOB', 'CFR', 'CIF'].includes(term),
    tradePortCost: ['FOB', 'CFR', 'CIF'].includes(term),
    tradeInternationalCost: ['CFR', 'CIF'].includes(term),
    tradeInsuranceCost: term === 'CIF'
  };
  Object.entries(visibility).forEach(([id, visible]) => {
    const input = document.getElementById(id);
    const field = input.closest('label');
    field.hidden = !visible;
    if (!visible && input.value.trim() === '') input.value = '0';
  });
}

document.querySelectorAll('[data-trade-term]').forEach(button => {
  button.addEventListener('click', () => {
    const select = document.getElementById('tradeTerm');
    select.value = button.dataset.tradeTerm;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
});
document.getElementById('tradeTerm').addEventListener('change', updateTradeTermUi);
document.getElementById('clearTradeQuoteButton').addEventListener('click', () => requestAnimationFrame(updateTradeTermUi));
updateTradeTermUi();

const batchDropZone = document.getElementById('batchDropZone');
const batchDropTrigger = document.getElementById('batchDropTrigger');
const batchDropFileInput = document.getElementById('batchFile');
function updateDropZoneFile() {
  const strong = batchDropZone.querySelector('.drop-zone-copy strong');
  const small = batchDropZone.querySelector('.drop-zone-copy small');
  if (batchDropFileInput.files.length) {
    batchDropZone.classList.add('has-file');
    strong.textContent = t('ui.fileReady', { name: batchDropFileInput.files[0].name });
    small.textContent = t('ui.fileReadyHint');
  } else {
    batchDropZone.classList.remove('has-file');
    strong.textContent = t('ui.dropFile');
    small.textContent = t('ui.dropFileHint');
  }
}
['dragenter', 'dragover'].forEach(type => batchDropZone.addEventListener(type, event => {
  event.preventDefault();
  batchDropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(type => batchDropZone.addEventListener(type, event => {
  event.preventDefault();
  batchDropZone.classList.remove('dragging');
}));
batchDropZone.addEventListener('drop', event => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  batchDropFileInput.files = transfer.files;
  batchDropFileInput.dispatchEvent(new Event('change', { bubbles: true }));
});
batchDropZone.addEventListener('click', event => {
  if (event.target.closest('button, input, label')) return;
  batchDropFileInput.click();
});
batchDropTrigger.addEventListener('click', () => batchDropFileInput.click());
batchDropFileInput.addEventListener('change', updateDropZoneFile);
updateDropZoneFile();

// 只过滤已渲染的批量结果行，不触发或改变批量利润计算。
const batchSearch = document.getElementById('batchSearch');
function filterBatchRows() {
  if (!batchSearch) return;
  const query = batchSearch.value.trim().toLocaleLowerCase();
  document.querySelectorAll('#batchResultBody tr').forEach(row => {
    row.hidden = query.length > 0 && !row.textContent.toLocaleLowerCase().includes(query);
  });
}
batchSearch?.addEventListener('input', filterBatchRows);
if (document.getElementById('batchResultBody')) {
  new MutationObserver(() => {
    filterBatchRows();
    document.querySelectorAll('#batchResultBody tr').forEach(row => {
      const statusCell = row.lastElementChild;
      if (!statusCell) return;
      const statusText = statusCell.textContent.trim();
      statusCell.classList.toggle('status-positive', statusText === t('status.profit'));
      statusCell.classList.toggle('status-negative', statusText === t('status.loss'));
    });
  }).observe(document.getElementById('batchResultBody'), { childList: true });
}

menuToggle.addEventListener('click', () => {
  const open = primaryNavigation.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMobileMenu();
});

document.querySelectorAll('[data-tool-link]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    openTool(link.dataset.toolLink);
  });
});
document.querySelectorAll('#primaryNavigation [data-route], .brand[data-route]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const route = link.dataset.route;
    if (route === 'home') showHome();
    if (route === 'profit') openTool('calculatorSection');
    if (route === 'pricing') openTool('quoteAssistantSection');
    if (route === 'data') openTool('productManagerSection');
  });
});
toolTabs.forEach(button => {
  button.addEventListener('click', () => openTool(button.dataset.toolTarget, {
    selectedTab: button,
    focusTarget: button.dataset.focusTarget
  }));
});

window.addEventListener('popstate', () => {
  const targetId = location.hash.slice(1);
  if (!targetId || targetId === 'homeSection') showHome(false);
  else if (document.getElementById(targetId)?.classList.contains('tool-panel')) openTool(targetId, { updateHash: false, instant: true });
});

window.addEventListener('languagechange', () => {
  if (activeToolGroup) toolContextTitle.textContent = t(groupTitleKeys[activeToolGroup]);
  advancedUi.summary.innerHTML = `<span>${t('ui.moreFees')}</span><small>${t('ui.moreFeesHint')}</small>`;
  advancedUi.shortcut.textContent = t('ui.saveSku');
  resultPlaceholders.forEach(item => {
    item.placeholder.querySelector('h3').textContent = t(item.titleKey);
    item.placeholder.querySelector('p').textContent = t(item.textKey);
  });
  menuToggle.setAttribute('aria-label', t('ui.openMenu'));
  document.querySelectorAll('.input-unit[data-unit-key]').forEach(unit => { unit.textContent = t(unit.dataset.unitKey); });
  updateDropZoneFile();
  updateTradeTermDescription();
  updateCostStructureBars();
});

const initialTarget = location.hash.slice(1);
if (document.getElementById(initialTarget)?.classList.contains('tool-panel')) {
  openTool(initialTarget, { updateHash: false, instant: true });
} else {
  showHome(false);
}
