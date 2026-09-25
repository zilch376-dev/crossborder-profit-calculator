// 获取页面上的输入框和结果区域，后面会用它们来读取数据和显示结果。
const form = document.getElementById('profitForm');
const clearButton = document.getElementById('clearButton');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('resultSection');
const aiAnalysisButton = document.getElementById('aiAnalysisButton');
const aiAnalysisSection = document.getElementById('aiAnalysisSection');
const exportPdfButton = document.getElementById('exportPdfButton');
const breakEvenForm = document.getElementById('breakEvenForm');
const breakEvenError = document.getElementById('breakEvenError');
const breakEvenResultSection = document.getElementById('breakEvenResultSection');
const simulationResult = document.getElementById('simulationResult');
let latestBreakEvenResult = null;
const quoteForm = document.getElementById('quoteForm');
const quoteError = document.getElementById('quoteError');
const quoteResultSection = document.getElementById('quoteResultSection');
const clearQuoteButton = document.getElementById('clearQuoteButton');
let latestQuoteResult = null;
const comparisonForm = document.getElementById('comparisonForm');
const comparisonError = document.getElementById('comparisonError');
const comparisonResultSection = document.getElementById('comparisonResultSection');
const fillComparisonButton = document.getElementById('fillComparisonButton');
let latestComparisonResult = null;
const productStorageKey = 'crossBorderProfitProductsV4';
const saveProductButton = document.getElementById('saveProductButton');
const productListBody = document.getElementById('productListBody');
const productMessage = document.getElementById('productMessage');
let editingProductSku = null;
const batchFileInput = document.getElementById('batchFile');
const batchError = document.getElementById('batchError');
const batchResultSection = document.getElementById('batchResultSection');
let latestBatchResult = null;
const tradeQuoteForm = document.getElementById('tradeQuoteForm');
const tradeQuoteError = document.getElementById('tradeQuoteError');
const tradeQuoteResultSection = document.getElementById('tradeQuoteResultSection');
let latestTradeQuoteResult = null;

// 这里的费率是方便估算的参考值，实际费率可能因国家、类目和账号而不同。
const platformRates = {
  custom: 0,
  amazon: 15,
  ebay: 13.25,
  shopify: 3,
  tiktok: 5,
  aliexpress: 8
};

const inputIds = [
  'purchaseCost', 'salePrice', 'exchangeRate', 'shippingCost',
  'commissionRate', 'advertisingCost', 'otherCost', 'quantity'
];

const quoteInputIds = [
  'quotePurchaseCost', 'quoteQuantity', 'quoteShippingCost',
  'quoteAdvertisingCost', 'quoteOtherCost', 'quoteCommissionRate',
  'quoteExchangeRate', 'quoteTargetProfitRate'
];

const comparisonInputIds = [
  'comparisonWarningRate',
  'scenarioAPrice', 'scenarioAAdvertising', 'scenarioACommission',
  'scenarioBPrice', 'scenarioBAdvertising', 'scenarioBCommission',
  'scenarioCPrice', 'scenarioCAdvertising', 'scenarioCCommission'
];

const comparisonBaseIds = [
  'purchaseCost', 'quantity', 'shippingCost', 'otherCost', 'exchangeRate'
];

document.getElementById('platform').addEventListener('change', (event) => {
  // 只有用户主动切换平台时才写入模板费率，其他输入变化不会覆盖手动佣金。
  document.getElementById('commissionRate').value = platformRates[event.target.value];
  aiAnalysisSection.hidden = true;
  breakEvenResultSection.hidden = true;
  latestBreakEvenResult = null;
  comparisonResultSection.hidden = true;
  latestComparisonResult = null;
});

document.getElementById('quotePlatform').addEventListener('change', (event) => {
  // 报价助手复用同一套平台模板，佣金仍然允许用户继续手动修改。
  document.getElementById('quoteCommissionRate').value = platformRates[event.target.value];
  quoteResultSection.hidden = true;
  quoteError.hidden = true;
  latestQuoteResult = null;
});

// 输入数据变化后收起旧的 AI 报告，避免 PDF 导出过期分析。
inputIds.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    aiAnalysisSection.hidden = true;
    breakEvenResultSection.hidden = true;
    breakEvenError.hidden = true;
    latestBreakEvenResult = null;
  });
});

document.getElementById('safetyMarginRate').addEventListener('input', () => {
  breakEvenResultSection.hidden = true;
  breakEvenError.hidden = true;
  latestBreakEvenResult = null;
});

quoteInputIds.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    quoteResultSection.hidden = true;
    quoteError.hidden = true;
    latestQuoteResult = null;
  });
});

comparisonInputIds.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    comparisonResultSection.hidden = true;
    comparisonError.hidden = true;
    latestComparisonResult = null;
  });
});

comparisonBaseIds.forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    comparisonResultSection.hidden = true;
    latestComparisonResult = null;
  });
});

// 金额统一保留两位小数，并加上人民币符号，方便阅读。
function formatMoney(value) {
  return formatLocalizedCny(value);
}

function formatUsd(value) {
  return formatLocalizedUsd(value);
}

function getNumber(id) {
  return Number(document.getElementById(id).value);
}

// 主计算器、多方案对比、SKU 保存和批量分析统一调用这一个利润公式。
function calculateProfitMetrics(data) {
  const revenue = data.salePrice * data.exchangeRate * data.quantity;
  const productCost = data.purchaseCost * data.quantity;
  const commission = revenue * (data.commissionRate / 100);
  const totalCost = productCost + data.shippingCost + commission + data.advertisingCost + data.otherCost;
  const netProfit = revenue - totalCost;
  return {
    revenue,
    productCost,
    commission,
    totalCost,
    netProfit,
    unitTotalCost: totalCost / data.quantity,
    unitProfit: netProfit / data.quantity,
    profitRate: netProfit / revenue * 100,
    costRate: totalCost / revenue * 100
  };
}

function getMainCalculatorData() {
  return {
    productName: document.getElementById('productName').value.trim(),
    sku: document.getElementById('sku').value.trim(),
    platform: document.getElementById('platform').value,
    purchaseCost: getNumber('purchaseCost'),
    salePrice: getNumber('salePrice'),
    exchangeRate: getNumber('exchangeRate'),
    shippingCost: getNumber('shippingCost'),
    commissionRate: getNumber('commissionRate'),
    advertisingCost: getNumber('advertisingCost'),
    otherCost: getNumber('otherCost'),
    quantity: getNumber('quantity')
  };
}

function getPlatformName(platformValue) {
  const names = { custom: t('platform.custom'), amazon: 'Amazon', ebay: 'eBay', shopify: 'Shopify', tiktok: 'TikTok Shop', aliexpress: 'AliExpress' };
  return names[platformValue] || platformValue || t('platform.custom');
}

function setPrintMode(mode, title) {
  const originalTitle = document.title;
  document.body.classList.remove('print-main', 'print-batch', 'print-trade');
  document.body.classList.add(`print-${mode}`);
  document.title = title;
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
    document.body.classList.remove('print-main', 'print-batch', 'print-trade');
  }, { once: true });
  requestAnimationFrame(() => window.print());
}

// 检查是否填写了所有必要数据，并检查数字范围是否合理。
function validateInputs() {
  const values = Object.fromEntries(inputIds.map(id => [id, getNumber(id)]));
  const hasMissingValue = inputIds.some(id => document.getElementById(id).value.trim() === '');
  const exchangeRateText = document.getElementById('exchangeRate').value.trim();

  if (exchangeRateText === '' || !Number.isFinite(values.exchangeRate) || values.exchangeRate <= 0) {
    return t('error.exchangeRate');
  }

  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return t('error.allInputs');
  }
  if (values.purchaseCost < 0 || values.salePrice <= 0 ||
      values.shippingCost < 0 || values.advertisingCost < 0 || values.otherCost < 0) {
    return t('error.mainAmounts');
  }
  if (values.commissionRate < 0 || values.commissionRate > 100) {
    return t('error.commissionRange');
  }
  if (!Number.isInteger(values.quantity) || values.quantity < 1) {
    return t('error.quantityInteger');
  }
  return null;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  resultSection.hidden = true;
}

function validateBreakEvenInputs() {
  const requiredIds = [
    'purchaseCost', 'quantity', 'shippingCost', 'advertisingCost',
    'otherCost', 'commissionRate', 'exchangeRate', 'safetyMarginRate'
  ];
  const values = Object.fromEntries(requiredIds.map(id => [id, getNumber(id)]));
  const hasMissingValue = requiredIds.some(id => document.getElementById(id).value.trim() === '');
  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return t('error.breakEvenRequired');
  }
  if (!Number.isInteger(values.quantity) || values.quantity <= 0) {
    return t('error.quantityPositive');
  }
  if (values.exchangeRate <= 0) {
    return t('error.exchangePositive');
  }
  if (values.commissionRate < 0 || values.commissionRate >= 100) {
    return t('error.commissionBelow100');
  }
  if (values.purchaseCost < 0 || values.shippingCost < 0 ||
      values.advertisingCost < 0 || values.otherCost < 0) {
    return t('error.costsNonNegative');
  }
  if (values.safetyMarginRate < 0 || values.safetyMarginRate > 100) {
    return t('error.safetyRange');
  }

  const salePriceInput = document.getElementById('salePrice');
  if (salePriceInput.value.trim() !== '') {
    const salePrice = Number(salePriceInput.value);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      return t('error.currentPrice');
    }
  }
  return null;
}

function showBreakEvenError(message) {
  breakEvenError.textContent = message;
  breakEvenError.hidden = false;
  breakEvenResultSection.hidden = true;
  latestBreakEvenResult = null;
}

function getBreakEvenGapText(currentSalePrice, breakEvenUsd) {
  if (currentSalePrice === null) {
    return { text: t('breakEven.noCurrentPrice'), status: '' };
  }
  const difference = currentSalePrice - breakEvenUsd;
  if (Math.abs(difference) < 0.000001) {
    return { text: t('breakEven.samePrice', { amount: formatUsd(0) }), status: '' };
  }
  if (breakEvenUsd === 0) {
    return {
      text: t('breakEven.aboveNoPercent', { amount: formatUsd(Math.abs(difference)) }),
      status: 'positive'
    };
  }
  const percentageGap = Math.abs(difference) / breakEvenUsd * 100;
  return difference > 0
    ? { text: t('breakEven.above', { amount: formatUsd(difference), percent: percentageGap.toFixed(2) }), status: 'positive' }
    : { text: t('breakEven.below', { amount: formatUsd(Math.abs(difference)), percent: percentageGap.toFixed(2) }), status: 'negative' };
}

breakEvenForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = validateBreakEvenInputs();
  if (error) {
    showBreakEvenError(error);
    return;
  }

  const purchaseCost = getNumber('purchaseCost');
  const quantity = getNumber('quantity');
  const shippingCost = getNumber('shippingCost');
  const advertisingCost = getNumber('advertisingCost');
  const otherCost = getNumber('otherCost');
  const commissionRate = getNumber('commissionRate');
  const exchangeRate = getNumber('exchangeRate');
  const safetyMarginRate = getNumber('safetyMarginRate');
  const commissionDecimal = commissionRate / 100;
  const unitCost = purchaseCost + shippingCost / quantity + advertisingCost / quantity + otherCost / quantity;
  const breakEvenRmb = unitCost / (1 - commissionDecimal);
  const breakEvenUsdValue = breakEvenRmb / exchangeRate;
  const safePriceRmbValue = breakEvenRmb * (1 + safetyMarginRate / 100);
  const safePriceUsdValue = safePriceRmbValue / exchangeRate;
  const salePriceText = document.getElementById('salePrice').value.trim();
  const currentSalePrice = salePriceText === '' ? null : Number(salePriceText);
  const gap = getBreakEvenGapText(currentSalePrice, breakEvenUsdValue);
  const safetyLabel = Number.isInteger(safetyMarginRate) ? safetyMarginRate.toFixed(0) : safetyMarginRate.toFixed(2);

  document.getElementById('breakEvenUnitCost').textContent = formatMoney(unitCost);
  document.getElementById('breakEvenRmb').textContent = t('pdf.unitAmount', { amount: formatMoney(breakEvenRmb) });
  document.getElementById('breakEvenUsd').textContent = formatUsd(breakEvenUsdValue);
  document.getElementById('breakEvenUsdCard').textContent = t('pdf.unitAmount', { amount: formatUsd(breakEvenUsdValue) });
  document.getElementById('safeRmbLabel').textContent = t('breakEven.safeCny', { percent: safetyLabel });
  document.getElementById('safeUsdLabel').textContent = t('breakEven.safeUsd', { percent: safetyLabel });
  document.getElementById('safePriceRmb').textContent = t('pdf.unitAmount', { amount: formatMoney(safePriceRmbValue) });
  document.getElementById('safePriceUsd').textContent = t('pdf.unitAmount', { amount: formatUsd(safePriceUsdValue) });
  const gapElement = document.getElementById('currentPriceGap');
  gapElement.textContent = gap.text;
  gapElement.className = `break-even-gap${gap.status ? ` ${gap.status}` : ''}`;

  latestBreakEvenResult = {
    purchaseCost,
    quantity,
    shippingCost,
    advertisingCost,
    otherCost,
    commissionRate,
    commissionDecimal,
    exchangeRate,
    safetyMarginRate,
    safetyLabel,
    unitCost,
    breakEvenRmb,
    breakEvenUsd: breakEvenUsdValue,
    safePriceRmb: safePriceRmbValue,
    safePriceUsd: safePriceUsdValue,
    gapText: gap.text
  };

  simulationResult.hidden = true;
  breakEvenError.hidden = true;
  breakEvenResultSection.hidden = false;
});

document.querySelectorAll('.simulation-button').forEach(button => {
  button.addEventListener('click', () => {
    if (!latestBreakEvenResult) return;
    const simulationType = button.dataset.simulation;
    let purchaseCost = latestBreakEvenResult.purchaseCost;
    let shippingCost = latestBreakEvenResult.shippingCost;
    let advertisingCost = latestBreakEvenResult.advertisingCost;
    let label = '';
    if (simulationType === 'purchase') {
      purchaseCost *= 1.10;
      label = t('breakEven.purchaseRise');
    } else if (simulationType === 'shipping') {
      shippingCost *= 1.10;
      label = t('breakEven.shippingRise');
    } else {
      advertisingCost *= 1.10;
      label = t('breakEven.advertisingRise');
    }

    const simulatedUnitCost = purchaseCost + shippingCost / latestBreakEvenResult.quantity +
      advertisingCost / latestBreakEvenResult.quantity + latestBreakEvenResult.otherCost / latestBreakEvenResult.quantity;
    const simulatedRmb = simulatedUnitCost / (1 - latestBreakEvenResult.commissionDecimal);
    const simulatedUsd = simulatedRmb / latestBreakEvenResult.exchangeRate;
    simulationResult.textContent = t('breakEven.simulationResult', { label, cny: formatMoney(simulatedRmb), usd: formatUsd(simulatedUsd) });
    simulationResult.hidden = false;
  });
});

function validateQuoteInputs() {
  const values = Object.fromEntries(quoteInputIds.map(id => [id, getNumber(id)]));
  const hasMissingValue = quoteInputIds.some(id => document.getElementById(id).value.trim() === '');

  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return t('error.quoteRequired');
  }
  if (values.quotePurchaseCost < 0 || values.quoteShippingCost < 0 ||
      values.quoteAdvertisingCost < 0 || values.quoteOtherCost < 0) {
    return t('error.costsNonNegative');
  }
  if (!Number.isInteger(values.quoteQuantity) || values.quoteQuantity < 1) {
    return t('error.quantityInteger');
  }
  if (values.quoteExchangeRate <= 0) {
    return t('error.exchangeRate');
  }
  if (values.quoteCommissionRate < 0 || values.quoteCommissionRate > 100) {
    return t('error.commissionRange');
  }
  if (values.quoteTargetProfitRate < 0 || values.quoteTargetProfitRate >= 100) {
    return t('error.targetMarginRange');
  }
  if (values.quoteCommissionRate + values.quoteTargetProfitRate >= 100) {
    return t('error.quoteImpossible');
  }
  return null;
}

function showQuoteError(message) {
  quoteError.textContent = message;
  quoteError.hidden = false;
  quoteResultSection.hidden = true;
  latestQuoteResult = null;
}

quoteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = validateQuoteInputs();
  if (error) {
    showQuoteError(error);
    return;
  }

  const purchaseCost = getNumber('quotePurchaseCost');
  const quantity = getNumber('quoteQuantity');
  const shippingCost = getNumber('quoteShippingCost');
  const advertisingCost = getNumber('quoteAdvertisingCost');
  const otherCost = getNumber('quoteOtherCost');
  const commissionRate = getNumber('quoteCommissionRate');
  const exchangeRate = getNumber('quoteExchangeRate');
  const targetProfitRate = getNumber('quoteTargetProfitRate');
  const commissionDecimal = commissionRate / 100;
  const targetMarginDecimal = targetProfitRate / 100;

  const shippingShare = shippingCost / quantity;
  const advertisingShare = advertisingCost / quantity;
  const otherShare = otherCost / quantity;
  const fixedCost = purchaseCost + shippingShare + advertisingShare + otherShare;
  if (fixedCost <= 0) {
    showQuoteError(t('error.quoteNoCost'));
    return;
  }

  const denominator = 1 - commissionDecimal - targetMarginDecimal;
  if (denominator <= 0) {
    showQuoteError(t('error.quoteImpossible'));
    return;
  }

  // 最低售价：固定成本 ÷（1 - 平台佣金比例 - 目标利润率）。
  const minimumRmb = fixedCost / denominator;
  const minimumUsd = minimumRmb / exchangeRate;
  const ordinaryRmb = minimumRmb * 1.05;
  const conservativeRmb = minimumRmb * 1.10;
  const ordinaryUsd = ordinaryRmb / exchangeRate;
  const conservativeUsd = conservativeRmb / exchangeRate;
  const expectedCommission = ordinaryRmb * commissionDecimal;
  const expectedProfit = ordinaryRmb - expectedCommission - fixedCost;
  const expectedMargin = expectedProfit / ordinaryRmb * 100;

  document.getElementById('quoteBaseCost').textContent = formatMoney(purchaseCost);
  document.getElementById('quoteShippingShare').textContent = formatMoney(shippingShare);
  document.getElementById('quoteAdvertisingShare').textContent = formatMoney(advertisingShare);
  document.getElementById('quoteOtherShare').textContent = formatMoney(otherShare);
  document.getElementById('quoteFixedCost').textContent = formatMoney(fixedCost);
  document.getElementById('quoteMinimumRmb').textContent = formatMoney(minimumRmb);
  document.getElementById('quoteMinimumUsd').textContent = formatUsd(minimumUsd);
  document.getElementById('quoteMinimumUsdCard').textContent = formatUsd(minimumUsd);
  document.getElementById('quoteRange').textContent = `${formatUsd(ordinaryUsd)} - ${formatUsd(conservativeUsd)}`;
  document.getElementById('quoteExpectedProfit').textContent = formatMoney(expectedProfit);
  document.getElementById('quoteExpectedMargin').textContent = `${expectedMargin.toFixed(2)}%`;

  const platformSelect = document.getElementById('quotePlatform');
  const platform = platformSelect.value;
  const platformName = platformSelect.selectedOptions[0].textContent.split('（')[0];
  const costItems = [
    { name: t('pricing.costPurchase'), value: purchaseCost },
    { name: t('pricing.costShipping'), value: shippingShare },
    { name: t('pricing.costAdvertising'), value: advertisingShare },
    { name: t('pricing.costOther'), value: otherShare }
  ].sort((a, b) => b.value - a.value);
  const mainCost = costItems[0];
  const mainCostShare = mainCost.value / fixedCost * 100;
  const costAnalysis = t('pricing.costAnalysisText', { name: mainCost.name, amount: formatMoney(mainCost.value), share: mainCostShare.toFixed(2) });

  const commissionLevel = commissionRate <= 5 ? t('pricing.commissionLow') : commissionRate <= 15 ? t('pricing.commissionMedium') : t('pricing.commissionHigh');
  const commissionAnalysis = t('pricing.commissionAnalysisText', { platform: platformName, rate: commissionRate.toFixed(2), level: commissionLevel, amount: formatMoney(expectedCommission) });

  const marginAssessment = targetProfitRate < 10
    ? t('pricing.marginLow')
    : targetProfitRate <= 30
      ? t('pricing.marginNormal')
      : targetProfitRate <= 45
        ? t('pricing.marginHigh')
        : t('pricing.marginVeryHigh');
  const marginAnalysis = t('pricing.marginAnalysisText', { rate: targetProfitRate.toFixed(2), assessment: marginAssessment });

  const safetyAnalysis = t('pricing.safetyAnalysisText');

  document.getElementById('quoteCostAnalysis').textContent = costAnalysis;
  document.getElementById('quoteCommissionAnalysis').textContent = commissionAnalysis;
  document.getElementById('quoteMarginAnalysis').textContent = marginAnalysis;
  document.getElementById('quoteSafetyAnalysis').textContent = safetyAnalysis;

  latestQuoteResult = {
    platform,
    platformName,
    commissionRate,
    targetProfitRate,
    fixedCost,
    minimumRmb,
    minimumUsd,
    ordinaryUsd,
    conservativeUsd,
    expectedProfit,
    expectedMargin,
    analysis: `${costAnalysis} ${commissionAnalysis} ${marginAnalysis} ${safetyAnalysis}`
  };

  quoteError.hidden = true;
  quoteResultSection.hidden = false;
});

function validateComparisonInputs() {
  const baseValues = Object.fromEntries(comparisonBaseIds.map(id => [id, getNumber(id)]));
  const missingBase = comparisonBaseIds.some(id => document.getElementById(id).value.trim() === '');
  if (missingBase || Object.values(baseValues).some(value => !Number.isFinite(value))) {
    return t('error.comparisonBase');
  }
  if (baseValues.purchaseCost < 0 || baseValues.shippingCost < 0 || baseValues.otherCost < 0) {
    return t('error.comparisonCosts');
  }
  if (!Number.isInteger(baseValues.quantity) || baseValues.quantity < 1) {
    return t('error.comparisonQuantity');
  }
  if (baseValues.exchangeRate <= 0) {
    return t('error.exchangeRate');
  }

  const warningInput = document.getElementById('comparisonWarningRate');
  const warningRate = Number(warningInput.value);
  if (warningInput.value.trim() === '' || !Number.isFinite(warningRate) || warningRate < 0 || warningRate > 100) {
    return t('error.warningRange');
  }

  for (const key of ['A', 'B', 'C']) {
    const priceInput = document.getElementById(`scenario${key}Price`);
    const advertisingInput = document.getElementById(`scenario${key}Advertising`);
    const commissionInput = document.getElementById(`scenario${key}Commission`);
    const price = Number(priceInput.value);
    const advertising = Number(advertisingInput.value);
    const commissionRate = Number(commissionInput.value);
    if ([priceInput, advertisingInput, commissionInput].some(input => input.value.trim() === '') ||
        [price, advertising, commissionRate].some(value => !Number.isFinite(value))) {
      return t('error.scenarioRequired', { scenario: key });
    }
    if (price <= 0) return t('error.scenarioPrice', { scenario: key });
    if (advertising < 0) return t('error.scenarioAdvertising', { scenario: key });
    if (commissionRate < 0 || commissionRate > 100) return t('error.scenarioCommission', { scenario: key });
  }
  return null;
}

function showComparisonError(message) {
  comparisonError.textContent = message;
  comparisonError.hidden = false;
  comparisonResultSection.hidden = true;
  latestComparisonResult = null;
}

fillComparisonButton.addEventListener('click', () => {
  const error = validateInputs();
  if (error) {
    showComparisonError(t('error.completeMain', { message: error }));
    return;
  }

  const currentPrice = document.getElementById('salePrice').value;
  const currentAdvertising = document.getElementById('advertisingCost').value;
  const currentCommission = document.getElementById('commissionRate').value;
  ['A', 'B', 'C'].forEach(key => {
    document.getElementById(`scenario${key}Price`).value = currentPrice;
    document.getElementById(`scenario${key}Advertising`).value = currentAdvertising;
    document.getElementById(`scenario${key}Commission`).value = currentCommission;
  });
  comparisonError.hidden = true;
  comparisonResultSection.hidden = true;
  latestComparisonResult = null;
});

function calculateComparisonScenario(key, base) {
  const salePrice = getNumber(`scenario${key}Price`);
  const advertisingCost = getNumber(`scenario${key}Advertising`);
  const commissionRate = getNumber(`scenario${key}Commission`);
  const metrics = calculateProfitMetrics({ ...base, salePrice, advertisingCost, commissionRate });
  return {
    key,
    salePrice,
    advertisingCost,
    commissionRate,
    ...metrics
  };
}

function setComparisonCell(id, value, className = '') {
  const cell = document.getElementById(id);
  cell.textContent = value;
  cell.className = className;
}

comparisonForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = validateComparisonInputs();
  if (error) {
    showComparisonError(error);
    return;
  }

  const base = {
    purchaseCost: getNumber('purchaseCost'),
    quantity: getNumber('quantity'),
    shippingCost: getNumber('shippingCost'),
    otherCost: getNumber('otherCost'),
    exchangeRate: getNumber('exchangeRate')
  };
  const warningRate = getNumber('comparisonWarningRate');
  const scenarios = ['A', 'B', 'C'].map(key => calculateComparisonScenario(key, base));
  const platformSelect = document.getElementById('platform');
  const platformName = platformSelect.selectedOptions[0].textContent.split('（')[0];
  const context = t('comparison.context', { platform: platformName, rate: warningRate.toFixed(2) });
  document.getElementById('comparisonContext').textContent = context;

  scenarios.forEach(scenario => {
    const statusClass = scenario.netProfit >= 0 ? 'metric-positive' : 'metric-negative';
    const marginClass = scenario.netProfit < 0
      ? 'metric-negative'
      : scenario.profitRate < warningRate ? 'metric-caution' : '';
    const marginWarning = scenario.profitRate < warningRate ? t('common.belowValue', { value: warningRate.toFixed(2) }) : '';
    setComparisonCell(`compare${scenario.key}Status`, scenario.netProfit >= 0 ? t('status.profit') : t('status.loss'), statusClass);
    setComparisonCell(`compare${scenario.key}Revenue`, formatMoney(scenario.revenue));
    setComparisonCell(`compare${scenario.key}ProductCost`, formatMoney(scenario.productCost));
    setComparisonCell(`compare${scenario.key}Commission`, formatMoney(scenario.commission));
    setComparisonCell(`compare${scenario.key}TotalCost`, formatMoney(scenario.totalCost));
    setComparisonCell(`compare${scenario.key}NetProfit`, formatMoney(scenario.netProfit), statusClass);
    setComparisonCell(`compare${scenario.key}UnitProfit`, formatMoney(scenario.unitProfit), statusClass);
    setComparisonCell(`compare${scenario.key}Margin`, `${scenario.profitRate.toFixed(2)}%${marginWarning}`, marginClass);
  });

  const maxAbsoluteProfit = Math.max(...scenarios.map(scenario => Math.abs(scenario.netProfit)), 1);
  scenarios.forEach(scenario => {
    const bar = document.getElementById(`compare${scenario.key}Bar`);
    const width = Math.abs(scenario.netProfit) / maxAbsoluteProfit * 48;
    bar.className = `chart-bar ${scenario.netProfit > 0 ? 'profit' : scenario.netProfit < 0 ? 'loss' : 'neutral'}`;
    bar.style.width = `${width}%`;
    const value = document.getElementById(`compare${scenario.key}BarValue`);
    value.textContent = formatMoney(scenario.netProfit);
    value.className = scenario.netProfit >= 0 ? 'metric-positive' : 'metric-negative';
  });

  latestComparisonResult = { platformName, warningRate, context, scenarios };
  comparisonError.hidden = true;
  comparisonResultSection.hidden = false;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = validateInputs();
  if (error) {
    showError(error);
    return;
  }

  errorMessage.hidden = true;
  const data = getMainCalculatorData();
  const { revenue, productCost, commission, totalCost, netProfit, unitTotalCost, unitProfit, profitRate, costRate } = calculateProfitMetrics(data);

  document.getElementById('revenue').textContent = formatMoney(revenue);
  document.getElementById('productCost').textContent = formatMoney(productCost);
  document.getElementById('commission').textContent = formatMoney(commission);
  document.getElementById('totalCost').textContent = formatMoney(totalCost);
  // 单件总成本把所有总费用平均分摊到每件商品上，包含平台佣金。
  document.getElementById('unitTotalCost').textContent = formatMoney(unitTotalCost);
  document.getElementById('netProfit').textContent = formatMoney(netProfit);
  document.getElementById('unitProfit').textContent = formatMoney(unitProfit);
  document.getElementById('profitRate').textContent = `${profitRate.toFixed(2)}%`;
  document.getElementById('costRate').textContent = `${costRate.toFixed(2)}%`;

  const isProfit = netProfit > 0;
  const status = document.getElementById('profitStatus');
  status.textContent = isProfit ? t('status.profit') : t('status.loss');
  status.className = `status ${isProfit ? 'profit' : 'loss'}`;
  document.getElementById('netProfit').classList.toggle('loss', !isProfit);
  resultSection.hidden = false;
  aiAnalysisSection.hidden = true;
});

aiAnalysisButton.addEventListener('click', () => {
  // 这是本地规则分析：不调用外部 API，根据当前输入重新计算并生成报告。
  const error = validateInputs();
  if (error) {
    showError(error);
    return;
  }

  const data = getMainCalculatorData();
  const { revenue, productCost, commission, totalCost, netProfit, unitProfit, profitRate, costRate } = calculateProfitMetrics(data);
  const { shippingCost, commissionRate, advertisingCost, otherCost, quantity, platform } = data;
  const commissionImpact = commission / revenue * 100;
  const advertisingImpact = advertisingCost / revenue * 100;

  document.getElementById('aiProfitAnalysis').textContent = netProfit > 0
    ? t('ai.profitPositive', { profit: formatMoney(netProfit), unitProfit: formatMoney(unitProfit) })
    : netProfit < 0
      ? t('ai.profitNegative', { loss: formatMoney(Math.abs(netProfit)) })
      : t('ai.profitEven');

  document.getElementById('aiMarginAnalysis').textContent = profitRate >= 30
    ? t('ai.marginGood', { rate: profitRate.toFixed(2) })
    : profitRate >= 15
      ? t('ai.marginMedium', { rate: profitRate.toFixed(2) })
      : profitRate > 0
        ? t('ai.marginLow', { rate: profitRate.toFixed(2) })
        : t('ai.marginNone', { rate: profitRate.toFixed(2) });

  const costItems = [
    { name: t('ai.costPurchase'), value: productCost },
    { name: t('ai.costCommission'), value: commission },
    { name: t('ai.costShipping'), value: shippingCost },
    { name: t('ai.costAdvertising'), value: advertisingCost },
    { name: t('ai.costOther'), value: otherCost }
  ].sort((a, b) => b.value - a.value);
  const topCosts = costItems.slice(0, 3).map(item => t('ai.costItem', { name: item.name, amount: formatMoney(item.value), rate: (item.value / revenue * 100).toFixed(2) }));
  document.getElementById('aiCostAnalysis').textContent = t('ai.costSummary', { total: formatMoney(totalCost), rate: costRate.toFixed(2), items: topCosts.join(t('common.listSeparator')) });

  const platformAnalysis = {
    custom: t('ai.platformCustom', { rate: commissionRate.toFixed(2), commission: formatMoney(commission) }),
    amazon: t('ai.platformAmazon', { rate: commissionRate.toFixed(2), commissionRate: commissionImpact.toFixed(2), adRate: advertisingImpact.toFixed(2) }),
    ebay: t('ai.platformEbay', { rate: commissionRate.toFixed(2), commissionRate: commissionImpact.toFixed(2) }),
    shopify: t('ai.platformShopify', { rate: commissionRate.toFixed(2), adRate: advertisingImpact.toFixed(2) }),
    tiktok: t('ai.platformTiktok', { rate: commissionRate.toFixed(2), adRate: advertisingImpact.toFixed(2) }),
    aliexpress: t('ai.platformAliexpress', { rate: commissionRate.toFixed(2), commissionRate: commissionImpact.toFixed(2) })
  };
  document.getElementById('aiPlatformAnalysis').textContent = platformAnalysis[platform];

  const platformSuggestions = {
    custom: t('ai.suggestCustom'), amazon: t('ai.suggestAmazon'), ebay: t('ai.suggestEbay'),
    shopify: t('ai.suggestShopify'), tiktok: t('ai.suggestTiktok'), aliexpress: t('ai.suggestAliexpress')
  };

  const suggestions = [
    netProfit <= 0
      ? t('ai.suggestLoss')
      : t('ai.suggestBuffer'),
    productCost / revenue >= 0.4
      ? t('ai.suggestPurchaseHigh')
      : t('ai.suggestPurchaseNormal'),
    platformSuggestions[platform]
  ];
  const suggestionList = document.getElementById('aiSuggestions');
  suggestionList.replaceChildren(...suggestions.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));

  aiAnalysisSection.hidden = false;
});

exportPdfButton.addEventListener('click', () => {
  // 使用浏览器原生打印功能在本地生成 PDF，不上传任何数据。
  const error = validateInputs();
  if (error) {
    showError(error);
    return;
  }

  const data = getMainCalculatorData();
  const { productName, sku, purchaseCost, salePrice, exchangeRate, shippingCost, commissionRate, advertisingCost, otherCost, quantity, platform } = data;
  const { revenue, productCost, commission, totalCost, netProfit, profitRate } = calculateProfitMetrics(data);
  const platformName = getPlatformName(platform);
  const now = new Date();
  const dateText = formatLocalizedDate(now);

  document.getElementById('pdfDate').textContent = dateText;
  document.getElementById('pdfProductName').textContent = productName || t('status.notEntered');
  document.getElementById('pdfSku').textContent = sku || t('status.notEntered');
  document.getElementById('pdfPlatform').textContent = platformName;
  document.getElementById('pdfQuantity').textContent = t('pdf.quantity', { quantity });
  document.getElementById('pdfSalePrice').textContent = t('pdf.salePrice', { amount: formatUsd(salePrice) });
  document.getElementById('pdfExchangeRate').textContent = t('pdf.exchangeRate', { rate: exchangeRate });
  document.getElementById('pdfUnitPurchaseCost').textContent = t('pdf.unitAmount', { amount: formatMoney(purchaseCost) });
  document.getElementById('pdfProductCost').textContent = formatMoney(productCost);
  document.getElementById('pdfShippingCost').textContent = formatMoney(shippingCost);
  document.getElementById('pdfCommission').textContent = t('pdf.commission', { amount: formatMoney(commission), rate: commissionRate.toFixed(2) });
  document.getElementById('pdfAdvertisingCost').textContent = formatMoney(advertisingCost);
  document.getElementById('pdfOtherCost').textContent = formatMoney(otherCost);
  document.getElementById('pdfRevenue').textContent = formatMoney(revenue);
  document.getElementById('pdfTotalCost').textContent = formatMoney(totalCost);
  document.getElementById('pdfNetProfit').textContent = formatMoney(netProfit);
  document.getElementById('pdfNetProfit').classList.toggle('negative', netProfit < 0);
  document.getElementById('pdfProfitRate').textContent = `${profitRate.toFixed(2)}%`;

  // 盈亏平衡分析已经生成时，将当前结果加入 PDF。
  const pdfBreakEvenSection = document.getElementById('pdfBreakEvenSection');
  const hasBreakEvenResult = latestBreakEvenResult !== null && !breakEvenResultSection.hidden;
  pdfBreakEvenSection.hidden = !hasBreakEvenResult;
  if (hasBreakEvenResult) {
    document.getElementById('pdfBreakEvenUnitCost').textContent = formatMoney(latestBreakEvenResult.unitCost);
    document.getElementById('pdfBreakEvenCommissionRate').textContent = `${latestBreakEvenResult.commissionRate.toFixed(2)}%`;
    document.getElementById('pdfBreakEvenRmb').textContent = t('pdf.unitAmount', { amount: formatMoney(latestBreakEvenResult.breakEvenRmb) });
    document.getElementById('pdfBreakEvenUsd').textContent = t('pdf.unitAmount', { amount: formatUsd(latestBreakEvenResult.breakEvenUsd) });
    document.getElementById('pdfSafePrice').textContent = t('pdf.safePriceValue', { percent: latestBreakEvenResult.safetyLabel, cny: formatMoney(latestBreakEvenResult.safePriceRmb), usd: formatUsd(latestBreakEvenResult.safePriceUsd) });
    document.getElementById('pdfCurrentPriceGap').textContent = latestBreakEvenResult.gapText;
  }

  // 如果用户已经生成 AI 分析，则把当前报告完整复制到 PDF 版式中。
  const pdfAiSection = document.getElementById('pdfAiSection');
  const hasAiAnalysis = !aiAnalysisSection.hidden;
  pdfAiSection.hidden = !hasAiAnalysis;
  if (hasAiAnalysis) {
    document.getElementById('pdfAiProfit').textContent = document.getElementById('aiProfitAnalysis').textContent;
    document.getElementById('pdfAiMargin').textContent = document.getElementById('aiMarginAnalysis').textContent;
    document.getElementById('pdfAiCost').textContent = document.getElementById('aiCostAnalysis').textContent;
    document.getElementById('pdfAiPlatform').textContent = document.getElementById('aiPlatformAnalysis').textContent;
    const pdfSuggestions = document.getElementById('pdfAiSuggestions');
    const suggestionTexts = [...document.querySelectorAll('#aiSuggestions li')].map(item => item.textContent);
    pdfSuggestions.replaceChildren(...suggestionTexts.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }

  // 报价助手已经生成结果时，将报价内容追加到同一份 PDF 报告。
  const pdfQuoteSection = document.getElementById('pdfQuoteSection');
  const hasQuoteResult = latestQuoteResult !== null && !quoteResultSection.hidden;
  pdfQuoteSection.hidden = !hasQuoteResult;
  if (hasQuoteResult) {
    document.getElementById('pdfQuotePlatform').textContent = latestQuoteResult.platformName;
    document.getElementById('pdfQuoteTargetMargin').textContent = `${latestQuoteResult.targetProfitRate.toFixed(2)}%`;
    document.getElementById('pdfQuoteFixedCost').textContent = formatMoney(latestQuoteResult.fixedCost);
    document.getElementById('pdfQuoteCommissionRate').textContent = `${latestQuoteResult.commissionRate.toFixed(2)}%`;
    document.getElementById('pdfQuoteMinimumRmb').textContent = formatMoney(latestQuoteResult.minimumRmb);
    document.getElementById('pdfQuoteMinimumUsd').textContent = formatUsd(latestQuoteResult.minimumUsd);
    document.getElementById('pdfQuoteRange').textContent = `${formatUsd(latestQuoteResult.ordinaryUsd)} - ${formatUsd(latestQuoteResult.conservativeUsd)}`;
    document.getElementById('pdfQuoteExpectedProfit').textContent = formatMoney(latestQuoteResult.expectedProfit);
    document.getElementById('pdfQuoteAnalysis').textContent = latestQuoteResult.analysis;
  }

  // 多方案对比已生成时，将客观指标表追加到 PDF，不标记“最佳方案”。
  const pdfComparisonSection = document.getElementById('pdfComparisonSection');
  const hasComparisonResult = latestComparisonResult !== null && !comparisonResultSection.hidden;
  pdfComparisonSection.hidden = !hasComparisonResult;
  if (hasComparisonResult) {
    document.getElementById('pdfComparisonContext').textContent = latestComparisonResult.context;
    latestComparisonResult.scenarios.forEach(scenario => {
      const marginWarning = scenario.profitRate < latestComparisonResult.warningRate ? t('common.belowWarning') : '';
      document.getElementById(`pdfCompare${scenario.key}Revenue`).textContent = formatMoney(scenario.revenue);
      document.getElementById(`pdfCompare${scenario.key}TotalCost`).textContent = formatMoney(scenario.totalCost);
      document.getElementById(`pdfCompare${scenario.key}NetProfit`).textContent = formatMoney(scenario.netProfit);
      document.getElementById(`pdfCompare${scenario.key}UnitProfit`).textContent = formatMoney(scenario.unitProfit);
      document.getElementById(`pdfCompare${scenario.key}Margin`).textContent = `${scenario.profitRate.toFixed(2)}%${marginWarning}`;
    });
  }

  // 批量分析已完成时，在主报告中加入简洁摘要。
  const pdfBatchSection = document.getElementById('pdfBatchSection');
  const hasBatchResult = latestBatchResult !== null;
  pdfBatchSection.hidden = !hasBatchResult;
  if (hasBatchResult) {
    const summary = latestBatchResult.summary;
    document.getElementById('pdfBatchTotalCount').textContent = t('pdf.batchCount', { count: summary.totalCount });
    document.getElementById('pdfBatchStatusCount').textContent = t('pdf.batchStatus', { profit: summary.profitCount, loss: summary.lossCount });
    document.getElementById('pdfBatchRevenue').textContent = formatMoney(summary.totalRevenue);
    document.getElementById('pdfBatchProfit').textContent = formatMoney(summary.totalProfit);
    document.getElementById('pdfBatchAverageMargin').textContent = `${summary.averageMargin.toFixed(2)}%`;
    document.getElementById('pdfBatchFileName').textContent = latestBatchResult.fileName;
  }

  // 临时修改网页标题，让浏览器建议一个清楚的 PDF 文件名。
  const fileDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  setPrintMode('main', t('pdf.fileProfit', { date: fileDate }));
});

clearQuoteButton.addEventListener('click', () => {
  quoteForm.reset();
  quoteError.hidden = true;
  quoteResultSection.hidden = true;
  latestQuoteResult = null;
});

clearButton.addEventListener('click', () => {
  form.reset();
  errorMessage.hidden = true;
  resultSection.hidden = true;
  aiAnalysisSection.hidden = true;
  breakEvenError.hidden = true;
  breakEvenResultSection.hidden = true;
  latestBreakEvenResult = null;
  comparisonError.hidden = true;
  comparisonResultSection.hidden = true;
  latestComparisonResult = null;
  editingProductSku = null;
  saveProductButton.textContent = t('action.saveProduct');
});

// ---------- 产品 / SKU 管理 ----------
function getSavedProducts() {
  try {
    const stored = JSON.parse(localStorage.getItem(productStorageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function storeProducts(products) {
  try {
    localStorage.setItem(productStorageKey, JSON.stringify(products));
    return true;
  } catch (error) {
    showProductMessage(t('error.storage'), true);
    return false;
  }
}

function showProductMessage(message, isError = false) {
  productMessage.textContent = message;
  productMessage.className = `message ${isError ? 'error' : 'success'}`;
  productMessage.hidden = false;
}

function formatSavedTime(isoText) {
  const date = new Date(isoText);
  return Number.isNaN(date.getTime()) ? t('common.unknown') : formatLocalizedDateTime(date);
}

function renderProducts() {
  const keyword = document.getElementById('productSearch').value.trim().toLowerCase();
  const products = getSavedProducts().filter(product =>
    product.productName.toLowerCase().includes(keyword) || product.sku.toLowerCase().includes(keyword)
  );
  productListBody.replaceChildren(...products.map(product => {
    const metrics = calculateProfitMetrics(product);
    const row = document.createElement('tr');
    const values = [
      product.productName,
      product.sku,
      getPlatformName(product.platform),
      formatUsd(product.salePrice),
      formatMoney(metrics.netProfit),
      `${metrics.profitRate.toFixed(2)}%`,
      formatSavedTime(product.updatedAt)
    ];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if ((index === 4 || index === 5) && metrics.netProfit < 0) cell.className = 'metric-negative';
      row.appendChild(cell);
    });
    const actionCell = document.createElement('td');
    actionCell.className = 'table-actions';
    [['load', t('action.load')], ['edit', t('action.edit')], ['delete', t('action.delete')]].forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `table-button${action === 'delete' ? ' delete' : ''}`;
      button.dataset.action = action;
      button.dataset.sku = product.sku;
      button.textContent = label;
      actionCell.appendChild(button);
    });
    row.appendChild(actionCell);
    return row;
  }));
  document.getElementById('emptyProductText').hidden = products.length > 0;
}

function fillMainCalculator(product, shouldEdit = false) {
  document.getElementById('productName').value = product.productName;
  document.getElementById('sku').value = product.sku;
  document.getElementById('platform').value = product.platform;
  ['purchaseCost', 'salePrice', 'exchangeRate', 'shippingCost', 'commissionRate', 'advertisingCost', 'otherCost', 'quantity'].forEach(id => {
    document.getElementById(id).value = product[id];
  });
  editingProductSku = shouldEdit ? product.sku : null;
  saveProductButton.textContent = shouldEdit ? t('action.updateProduct') : t('action.saveProduct');
  form.requestSubmit();
  document.getElementById('calculatorSection').scrollIntoView({ behavior: 'smooth' });
  showProductMessage(shouldEdit
    ? t('success.editingProduct', { name: product.productName, sku: product.sku })
    : t('success.loadedProduct', { name: product.productName, sku: product.sku }));
}

saveProductButton.addEventListener('click', () => {
  const error = validateInputs();
  if (error) {
    showProductMessage(t('error.savePrefix', { message: error }), true);
    return;
  }
  const product = getMainCalculatorData();
  if (!product.productName) {
    showProductMessage(t('error.productName'), true);
    return;
  }
  if (!product.sku) {
    showProductMessage(t('error.sku'), true);
    return;
  }

  const products = getSavedProducts();
  const duplicateIndex = products.findIndex(item => item.sku.toLowerCase() === product.sku.toLowerCase());
  const isSameEditingRecord = editingProductSku && product.sku.toLowerCase() === editingProductSku.toLowerCase();
  if (duplicateIndex >= 0 && !isSameEditingRecord && !window.confirm(t('confirm.overwriteSku', { sku: product.sku }))) return;

  product.updatedAt = new Date().toISOString();
  if (editingProductSku && editingProductSku.toLowerCase() !== product.sku.toLowerCase()) {
    const oldIndex = products.findIndex(item => item.sku.toLowerCase() === editingProductSku.toLowerCase());
    if (oldIndex >= 0) products.splice(oldIndex, 1);
  }
  const targetIndex = products.findIndex(item => item.sku.toLowerCase() === product.sku.toLowerCase());
  if (targetIndex >= 0) products[targetIndex] = product;
  else products.unshift(product);

  if (!storeProducts(products)) return;
  editingProductSku = product.sku;
  saveProductButton.textContent = t('action.updateProduct');
  renderProducts();
  showProductMessage(t('success.savedProduct', { name: product.productName }));
});

productListBody.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const products = getSavedProducts();
  const product = products.find(item => item.sku === button.dataset.sku);
  if (!product) {
    showProductMessage(t('error.productNotFound'), true);
    renderProducts();
    return;
  }
  if (button.dataset.action === 'load') fillMainCalculator(product, false);
  if (button.dataset.action === 'edit') fillMainCalculator(product, true);
  if (button.dataset.action === 'delete' && window.confirm(t('confirm.deleteProduct', { name: product.productName, sku: product.sku }))) {
    const nextProducts = products.filter(item => item.sku !== product.sku);
    if (storeProducts(nextProducts)) {
      if (editingProductSku === product.sku) {
        editingProductSku = null;
        saveProductButton.textContent = t('action.saveProduct');
      }
      renderProducts();
      showProductMessage(t('success.deletedProduct'));
    }
  }
});

document.getElementById('productSearch').addEventListener('input', renderProducts);
document.getElementById('clearAllProductsButton').addEventListener('click', () => {
  const products = getSavedProducts();
  if (!products.length) {
    showProductMessage(t('error.noProducts'), true);
    return;
  }
  if (!window.confirm(t('confirm.clearProducts', { count: products.length }))) return;
  if (!window.confirm(t('confirm.clearProductsAgain'))) return;
  if (storeProducts([])) {
    editingProductSku = null;
    saveProductButton.textContent = t('action.saveProduct');
    renderProducts();
    showProductMessage(t('success.clearedProducts'));
  }
});

// ---------- Excel / CSV 批量利润分析 ----------
const batchFieldAliases = {
  sku: ['sku', 'sku编号', '商品sku', '产品sku'],
  productName: ['产品名称', '商品名称', 'productname', 'product', 'name'],
  platform: ['平台', '销售平台', 'platform', 'salesplatform'],
  purchaseCost: ['单件采购成本', '采购成本', 'productcost', 'purchasecost', 'unitpurchasecost'],
  salePrice: ['商品售价usd', '售价usd', '商品售价', 'sellingprice', 'saleprice', 'sellingpriceusd'],
  exchangeRate: ['汇率', '美元兑人民币汇率', 'exchangerate', 'usdcnyrate', 'usdtorate'],
  quantity: ['商品数量', '数量', 'quantity', 'qty'],
  shippingCost: ['物流总费用', '国际物流总费用', '物流费用', 'shippingcost', 'logisticscost', 'totalshippingcost'],
  commissionRate: ['平台佣金比例', '佣金比例', '平台佣金', 'commissionrate', 'platformcommission', 'commission'],
  advertisingCost: ['广告总费用', '广告费用', 'advertisingcost', 'adcost', 'totaladvertisingcost'],
  otherCost: ['其他总费用', '其他费用', 'othercost', 'totalothercost']
};

const batchFieldLabels = {
  sku: 'batch.columnSku', productName: 'batch.columnProductName', platform: 'batch.columnPlatform', purchaseCost: 'batch.columnPurchaseCost',
  salePrice: 'batch.columnSellingPrice', exchangeRate: 'batch.columnExchangeRate', quantity: 'batch.columnQuantity', shippingCost: 'batch.columnShippingCost',
  commissionRate: 'batch.columnCommissionRate', advertisingCost: 'batch.columnAdvertisingCost', otherCost: 'batch.columnOtherCost'
};

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_\-（）()\/%￥¥$：:]/g, '');
}

function normalizePlatform(value) {
  const normalized = normalizeHeader(value);
  const aliases = {
    amazon: 'amazon', 亚马逊: 'amazon', ebay: 'ebay', shopify: 'shopify',
    tiktok: 'tiktok', tiktokshop: 'tiktok', 抖音小店: 'tiktok',
    aliexpress: 'aliexpress', 速卖通: 'aliexpress', custom: 'custom', 自定义: 'custom'
  };
  return aliases[normalized] || String(value || t('platform.custom')).trim();
}

function mapBatchHeaders(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const mapping = {};
  Object.entries(batchFieldAliases).forEach(([field, aliases]) => {
    const accepted = aliases.map(normalizeHeader);
    const index = normalizedHeaders.findIndex(header => accepted.includes(header));
    if (index >= 0) mapping[field] = headers[index];
  });
  return mapping;
}

function validateBatchRow(raw, mapping, rowNumber) {
  const text = field => String(raw[mapping[field]] ?? '').trim();
  const number = field => Number(raw[mapping[field]]);
  const data = {
    sku: text('sku'), productName: text('productName'), platform: normalizePlatform(text('platform')),
    purchaseCost: number('purchaseCost'), salePrice: number('salePrice'), exchangeRate: number('exchangeRate'),
    quantity: number('quantity'), shippingCost: number('shippingCost'), commissionRate: number('commissionRate'),
    advertisingCost: number('advertisingCost'), otherCost: number('otherCost')
  };
  if (!data.sku || !data.productName || !text('platform')) return t('error.batchRowIdentity', { row: rowNumber });
  const numericFields = ['purchaseCost', 'salePrice', 'exchangeRate', 'quantity', 'shippingCost', 'commissionRate', 'advertisingCost', 'otherCost'];
  if (numericFields.some(field => text(field) === '' || !Number.isFinite(data[field]))) return t('error.batchRowNumber', { row: rowNumber });
  if (data.purchaseCost < 0 || data.shippingCost < 0 || data.advertisingCost < 0 || data.otherCost < 0) return t('error.batchRowNegative', { row: rowNumber });
  if (data.salePrice <= 0) return t('error.batchRowPrice', { row: rowNumber });
  if (data.exchangeRate <= 0) return t('error.batchRowRate', { row: rowNumber });
  if (!Number.isInteger(data.quantity) || data.quantity <= 0) return t('error.batchRowQuantity', { row: rowNumber });
  if (data.commissionRate < 0 || data.commissionRate > 100) return t('error.batchRowCommission', { row: rowNumber });
  return { ...data, ...calculateProfitMetrics(data) };
}

function showBatchError(message) {
  batchError.textContent = message;
  batchError.hidden = false;
  batchResultSection.hidden = true;
  latestBatchResult = null;
}

function renderBatchResults() {
  if (!latestBatchResult) return;
  const filter = document.getElementById('batchFilter').value;
  const sort = document.getElementById('batchSort').value;
  let rows = latestBatchResult.rows.filter(row => filter === 'all' || (filter === 'profit' ? row.netProfit >= 0 : row.netProfit < 0));
  rows = [...rows].sort((a, b) => {
    if (sort === 'profit-desc') return b.netProfit - a.netProfit;
    if (sort === 'profit-asc') return a.netProfit - b.netProfit;
    if (sort === 'margin-desc') return b.profitRate - a.profitRate;
    if (sort === 'margin-asc') return a.profitRate - b.profitRate;
    return a.sku.localeCompare(b.sku, 'zh-CN', { numeric: true });
  });
  const body = document.getElementById('batchResultBody');
  body.replaceChildren(...rows.map(item => {
    const row = document.createElement('tr');
    [item.sku, item.productName, getPlatformName(item.platform), formatUsd(item.salePrice), formatMoney(item.netProfit), formatMoney(item.unitProfit), `${item.profitRate.toFixed(2)}%`, item.netProfit >= 0 ? t('status.profit') : t('status.loss')].forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (index >= 4 && (index === 4 || index === 5 || index === 6 || index === 7)) cell.className = item.netProfit >= 0 ? 'metric-positive' : 'metric-negative';
      row.appendChild(cell);
    });
    return row;
  }));
  document.getElementById('batchEmptyFilter').hidden = rows.length > 0;
}

function updateBatchSummary(summary) {
  document.getElementById('batchTotalCount').textContent = summary.totalCount;
  document.getElementById('batchProfitCount').textContent = summary.profitCount;
  document.getElementById('batchLossCount').textContent = summary.lossCount;
  document.getElementById('batchRevenue').textContent = formatMoney(summary.totalRevenue);
  document.getElementById('batchProfit').textContent = formatMoney(summary.totalProfit);
  document.getElementById('batchProfit').className = summary.totalProfit >= 0 ? 'metric-positive' : 'metric-negative';
  document.getElementById('batchAverageMargin').textContent = `${summary.averageMargin.toFixed(2)}%`;
}

document.getElementById('downloadBatchTemplateButton').addEventListener('click', () => {
  const rows = [
    Object.values(batchFieldLabels).map(key => t(key)),
    ['CUP-001', t('batch.sampleProduct'), 'Amazon', '50', '20', '7.10', '10', '100', '15', '50', '20']
  ];
  downloadCsv(t('batch.templateFileName'), rows);
});

document.getElementById('analyzeBatchButton').addEventListener('click', async () => {
  const file = batchFileInput.files[0];
  if (!file) {
    showBatchError(t('error.batchChooseFile'));
    return;
  }
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    showBatchError(t('error.batchFileType'));
    return;
  }
  if (typeof XLSX === 'undefined') {
    showBatchError(t('error.batchLibrary'));
    return;
  }
  try {
    // CSV 按 UTF-8 文本读取，避免中文列名出现乱码；XLSX 使用二进制读取。
    const workbook = /\.csv$/i.test(file.name)
      ? XLSX.read(await file.text(), { type: 'string' })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
    if (!rawRows.length) throw new Error(t('error.batchEmpty'));
    const headers = Object.keys(rawRows[0]);
    const mapping = mapBatchHeaders(headers);
    const missingFields = Object.keys(batchFieldLabels).filter(field => !mapping[field]);
    if (missingFields.length) throw new Error(t('error.batchColumns', { columns: missingFields.map(field => t(batchFieldLabels[field])).join(t('common.listSeparator')) }));
    const rows = rawRows.map((raw, index) => validateBatchRow(raw, mapping, index + 2));
    const firstError = rows.find(item => typeof item === 'string');
    if (firstError) throw new Error(firstError);
    const duplicateSkus = rows.map(row => row.sku.toLowerCase()).filter((sku, index, all) => all.indexOf(sku) !== index);
    if (duplicateSkus.length) throw new Error(t('error.batchDuplicates', { skus: [...new Set(duplicateSkus)].join(t('common.listSeparator')) }));
    const summary = {
      totalCount: rows.length,
      profitCount: rows.filter(row => row.netProfit >= 0).length,
      lossCount: rows.filter(row => row.netProfit < 0).length,
      totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      totalProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
      averageMargin: rows.reduce((sum, row) => sum + row.profitRate, 0) / rows.length
    };
    latestBatchResult = { fileName: file.name, rows, summary };
    document.getElementById('batchFileName').textContent = t('common.filePrefix', { name: file.name });
    updateBatchSummary(summary);
    document.getElementById('batchFilter').value = 'all';
    document.getElementById('batchSort').value = 'sku';
    renderBatchResults();
    batchError.hidden = true;
    batchResultSection.hidden = false;
  } catch (error) {
    showBatchError(error.message || t('error.batchRead'));
  }
});

document.getElementById('batchFilter').addEventListener('change', renderBatchResults);
document.getElementById('batchSort').addEventListener('change', renderBatchResults);

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(fileName, rows) {
  const csv = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('exportBatchCsvButton').addEventListener('click', () => {
  if (!latestBatchResult) return;
  const header = [t('batch.columnSku'), t('batch.columnProductName'), t('batch.columnPlatform'), t('batch.columnSellingPrice'), t('metric.revenueShort'), t('metric.productCost'), t('metric.commission'), t('metric.totalCost'), t('metric.netProfit'), t('metric.unitProfit'), t('metric.margin'), t('status.profitLoss')];
  const rows = latestBatchResult.rows.map(item => [
    item.sku, item.productName, getPlatformName(item.platform), item.salePrice.toFixed(2), item.revenue.toFixed(2),
    item.productCost.toFixed(2), item.commission.toFixed(2), item.totalCost.toFixed(2), item.netProfit.toFixed(2),
    item.unitProfit.toFixed(2), item.profitRate.toFixed(2), item.netProfit >= 0 ? t('status.profit') : t('status.loss')
  ]);
  downloadCsv(t('batch.resultsFileName'), [header, ...rows]);
});

document.getElementById('exportBatchPdfButton').addEventListener('click', () => {
  if (!latestBatchResult) return;
  const now = new Date();
  const summary = latestBatchResult.summary;
  document.getElementById('batchPdfDate').textContent = formatLocalizedDate(now);
  const summaryItems = [
    [t('batch.totalSku'), summary.totalCount], [t('batch.profitLoss'), `${summary.profitCount} / ${summary.lossCount}`],
    [t('metric.totalRevenue'), formatMoney(summary.totalRevenue)], [t('metric.totalProfit'), formatMoney(summary.totalProfit)],
    [t('metric.averageMargin'), `${summary.averageMargin.toFixed(2)}%`], [t('batch.sourceFile'), latestBatchResult.fileName]
  ];
  document.getElementById('batchPdfSummary').replaceChildren(...summaryItems.map(([label, value]) => {
    const item = document.createElement('div');
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    span.textContent = label;
    strong.textContent = value;
    item.append(span, strong);
    return item;
  }));
  document.getElementById('batchPdfBody').replaceChildren(...latestBatchResult.rows.map(item => {
    const row = document.createElement('tr');
    [item.sku, item.productName, getPlatformName(item.platform), formatMoney(item.netProfit), `${item.profitRate.toFixed(2)}%`, item.netProfit >= 0 ? t('status.profit') : t('status.loss')].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    return row;
  }));
  const date = now.toISOString().slice(0, 10);
  setPrintMode('batch', t('pdf.fileBatch', { date }));
});

// ---------- 外贸出口报价助手 ----------
const tradeInputIds = ['tradePurchaseCost', 'tradeQuantity', 'tradeDomesticCost', 'tradePortCost', 'tradeInternationalCost', 'tradeInsuranceCost', 'tradeOtherCost', 'tradeExchangeRate', 'tradeTargetMargin'];
function validateTradeQuoteInputs() {
  const values = Object.fromEntries(tradeInputIds.map(id => [id, getNumber(id)]));
  if (tradeInputIds.some(id => document.getElementById(id).value.trim() === '') || Object.values(values).some(value => !Number.isFinite(value))) return t('error.tradeRequired');
  if (!Number.isInteger(values.tradeQuantity) || values.tradeQuantity <= 0) return t('error.quantityPositive');
  if (values.tradeExchangeRate <= 0) return t('error.exchangeRate');
  const amountIds = ['tradePurchaseCost', 'tradeDomesticCost', 'tradePortCost', 'tradeInternationalCost', 'tradeInsuranceCost', 'tradeOtherCost'];
  if (amountIds.some(id => values[id] < 0)) return t('error.tradeAmounts');
  if (values.tradeTargetMargin < 0 || values.tradeTargetMargin >= 100) return t('error.tradeMargin');
  return null;
}

function calculateTradeQuote() {
  const term = document.getElementById('tradeTerm').value;
  const purchaseCost = getNumber('tradePurchaseCost');
  const quantity = getNumber('tradeQuantity');
  const domesticCost = getNumber('tradeDomesticCost');
  const portCost = getNumber('tradePortCost');
  const internationalCost = getNumber('tradeInternationalCost');
  const insuranceCost = getNumber('tradeInsuranceCost');
  const otherCost = getNumber('tradeOtherCost');
  const exchangeRate = getNumber('tradeExchangeRate');
  const targetMargin = getNumber('tradeTargetMargin');
  const included = {
    domesticCost: ['FOB', 'CFR', 'CIF'].includes(term) ? domesticCost : 0,
    portCost: ['FOB', 'CFR', 'CIF'].includes(term) ? portCost : 0,
    internationalCost: ['CFR', 'CIF'].includes(term) ? internationalCost : 0,
    insuranceCost: term === 'CIF' ? insuranceCost : 0
  };
  const productCost = purchaseCost * quantity;
  const totalCost = productCost + otherCost + included.domesticCost + included.portCost + included.internationalCost + included.insuranceCost;
  const quoteRmb = totalCost / (1 - targetMargin / 100);
  const quoteUsd = quoteRmb / exchangeRate;
  return {
    term, quoteUnit: document.getElementById('tradeQuoteUnit').value, purchaseCost, quantity, productCost,
    domesticCost, portCost, internationalCost, insuranceCost, otherCost, exchangeRate, targetMargin, included,
    totalCost, unitCost: totalCost / quantity, profitAmount: quoteRmb - totalCost,
    quoteRmb, quoteUsd, unitQuoteRmb: quoteRmb / quantity, unitQuoteUsd: quoteUsd / quantity
  };
}

function includedCostText(original, included) {
  return included > 0 || original === 0 ? formatMoney(included) : t('trade.notIncluded', { amount: formatMoney(original) });
}

tradeQuoteForm.addEventListener('submit', event => {
  event.preventDefault();
  const error = validateTradeQuoteInputs();
  if (error) {
    tradeQuoteError.textContent = error;
    tradeQuoteError.hidden = false;
    tradeQuoteResultSection.hidden = true;
    latestTradeQuoteResult = null;
    return;
  }
  const result = calculateTradeQuote();
  const explanations = {
    EXW: t('trade.exwExplanation'), FOB: t('trade.fobExplanation'),
    CFR: t('trade.cfrExplanation'), CIF: t('trade.cifExplanation')
  };
  document.getElementById('tradeQuoteStatus').textContent = t('trade.status', { term: result.term, rate: result.targetMargin.toFixed(2) });
  document.getElementById('tradePrimaryLabel').textContent = result.quoteUnit === 'unit' ? t('trade.primaryUnitUsd') : t('trade.primaryBatchUsd');
  document.getElementById('tradePrimaryQuote').textContent = formatUsd(result.quoteUnit === 'unit' ? result.unitQuoteUsd : result.quoteUsd);
  document.getElementById('tradeTotalCost').textContent = formatMoney(result.totalCost);
  document.getElementById('tradeUnitCost').textContent = formatMoney(result.unitCost);
  document.getElementById('tradeProfitAmount').textContent = formatMoney(result.profitAmount);
  document.getElementById('tradeQuoteRmb').textContent = formatMoney(result.quoteRmb);
  document.getElementById('tradeQuoteUsd').textContent = formatUsd(result.quoteUsd);
  document.getElementById('tradeUnitQuote').textContent = `${formatMoney(result.unitQuoteRmb)} / ${formatUsd(result.unitQuoteUsd)}`;
  document.getElementById('tradeBatchQuote').textContent = `${formatMoney(result.quoteRmb)} / ${formatUsd(result.quoteUsd)}`;
  document.getElementById('tradeProductCost').textContent = formatMoney(result.productCost);
  document.getElementById('tradeDomesticIncluded').textContent = includedCostText(result.domesticCost, result.included.domesticCost);
  document.getElementById('tradePortIncluded').textContent = includedCostText(result.portCost, result.included.portCost);
  document.getElementById('tradeInternationalIncluded').textContent = includedCostText(result.internationalCost, result.included.internationalCost);
  document.getElementById('tradeInsuranceIncluded').textContent = includedCostText(result.insuranceCost, result.included.insuranceCost);
  document.getElementById('tradeOtherIncluded').textContent = formatMoney(result.otherCost);
  document.getElementById('tradeQuoteExplanation').textContent = explanations[result.term];
  result.explanation = explanations[result.term];
  latestTradeQuoteResult = result;
  tradeQuoteError.hidden = true;
  tradeQuoteResultSection.hidden = false;
});

tradeInputIds.forEach(id => document.getElementById(id).addEventListener('input', () => {
  tradeQuoteError.hidden = true;
  tradeQuoteResultSection.hidden = true;
  latestTradeQuoteResult = null;
}));
['tradeTerm', 'tradeQuoteUnit'].forEach(id => document.getElementById(id).addEventListener('change', () => {
  tradeQuoteResultSection.hidden = true;
  latestTradeQuoteResult = null;
}));

document.getElementById('clearTradeQuoteButton').addEventListener('click', () => {
  tradeQuoteForm.reset();
  tradeQuoteError.hidden = true;
  tradeQuoteResultSection.hidden = true;
  latestTradeQuoteResult = null;
});

document.getElementById('exportTradePdfButton').addEventListener('click', () => {
  if (!latestTradeQuoteResult) return;
  const result = latestTradeQuoteResult;
  const now = new Date();
  document.getElementById('tradePdfDate').textContent = formatLocalizedDate(now);
  const rows = [
    [t('field.tradeTerm'), result.term, t('field.targetMarginShort'), `${result.targetMargin.toFixed(2)}%`],
    [t('field.quantity'), t('pdf.quantity', { quantity: result.quantity }), t('batch.columnExchangeRate'), t('pdf.exchangeRate', { rate: result.exchangeRate })],
    [t('trade.totalCost'), formatMoney(result.totalCost), t('trade.unitCost'), formatMoney(result.unitCost)],
    [t('trade.profitAmount'), formatMoney(result.profitAmount), t('field.quoteUnit'), result.quoteUnit === 'unit' ? t('trade.unit') : t('trade.batch')],
    [t('trade.batchCny'), formatMoney(result.quoteRmb), t('trade.batchUsd'), formatUsd(result.quoteUsd)],
    [t('trade.unitQuoteCny'), formatMoney(result.unitQuoteRmb), t('trade.unitQuoteUsd'), formatUsd(result.unitQuoteUsd)],
    [t('trade.productCost'), formatMoney(result.productCost), t('trade.other'), formatMoney(result.otherCost)],
    [t('trade.domestic'), includedCostText(result.domesticCost, result.included.domesticCost), t('trade.port'), includedCostText(result.portCost, result.included.portCost)],
    [t('trade.international'), includedCostText(result.internationalCost, result.included.internationalCost), t('trade.insurance'), includedCostText(result.insuranceCost, result.included.insuranceCost)]
  ];
  document.getElementById('tradePdfBody').replaceChildren(...rows.map(values => {
    const row = document.createElement('tr');
    values.forEach((value, index) => {
      const cell = document.createElement(index % 2 === 0 ? 'th' : 'td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    return row;
  }));
  document.getElementById('tradePdfExplanation').textContent = result.explanation;
  setPrintMode('trade', t('pdf.fileTrade', { term: result.term, date: now.toISOString().slice(0, 10) }));
});

// 切换语言后，重新渲染已经显示的动态结果；所有计算仍使用原始输入和同一套公式。
window.addEventListener('languagechange', () => {
  const hadMainResult = !resultSection.hidden;
  const hadAiAnalysis = !aiAnalysisSection.hidden;
  const hadBreakEvenResult = !breakEvenResultSection.hidden;
  const hadQuoteResult = !quoteResultSection.hidden;
  const hadComparisonResult = !comparisonResultSection.hidden;
  const hadTradeResult = !tradeQuoteResultSection.hidden;

  productMessage.hidden = true;
  errorMessage.hidden = true;
  breakEvenError.hidden = true;
  quoteError.hidden = true;
  comparisonError.hidden = true;
  batchError.hidden = true;
  tradeQuoteError.hidden = true;
  simulationResult.hidden = true;

  saveProductButton.textContent = editingProductSku ? t('action.updateProduct') : t('action.saveProduct');
  renderProducts();
  if (hadMainResult) form.requestSubmit();
  if (hadAiAnalysis) aiAnalysisButton.click();
  if (hadBreakEvenResult) breakEvenForm.requestSubmit();
  if (hadQuoteResult) quoteForm.requestSubmit();
  if (hadComparisonResult) comparisonForm.requestSubmit();
  if (latestBatchResult) {
    updateBatchSummary(latestBatchResult.summary);
    document.getElementById('batchFileName').textContent = t('common.filePrefix', { name: latestBatchResult.fileName });
    renderBatchResults();
  }
  if (hadTradeResult) tradeQuoteForm.requestSubmit();
});

renderProducts();
