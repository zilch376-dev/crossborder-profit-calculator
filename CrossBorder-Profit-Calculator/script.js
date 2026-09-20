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
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(value) {
  return `$${value.toFixed(2)}`;
}

function getNumber(id) {
  return Number(document.getElementById(id).value);
}

// 检查是否填写了所有必要数据，并检查数字范围是否合理。
function validateInputs() {
  const values = Object.fromEntries(inputIds.map(id => [id, getNumber(id)]));
  const hasMissingValue = inputIds.some(id => document.getElementById(id).value.trim() === '');
  const exchangeRateText = document.getElementById('exchangeRate').value.trim();

  if (exchangeRateText === '' || !Number.isFinite(values.exchangeRate) || values.exchangeRate <= 0) {
    return '请输入正确的美元兑人民币汇率，例如 7.10。';
  }

  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return '请填写所有输入项，并确保输入的是有效数字。';
  }
  if (values.purchaseCost < 0 || values.salePrice <= 0 ||
      values.shippingCost < 0 || values.advertisingCost < 0 || values.otherCost < 0) {
    return '采购成本、物流、广告和其他费用不能为负数；售价必须大于 0。';
  }
  if (values.commissionRate < 0 || values.commissionRate > 100) {
    return '平台佣金比例应填写 0 到 100 之间的数字。';
  }
  if (!Number.isInteger(values.quantity) || values.quantity < 1) {
    return '商品数量必须是大于或等于 1 的整数。';
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
    return '请先填写完整的成本、数量、佣金、汇率和安全边际，并确保输入的是有效数字。';
  }
  if (!Number.isInteger(values.quantity) || values.quantity <= 0) {
    return '商品数量必须是大于 0 的整数。';
  }
  if (values.exchangeRate <= 0) {
    return '美元兑人民币汇率必须大于 0。';
  }
  if (values.commissionRate < 0 || values.commissionRate >= 100) {
    return '平台佣金比例必须大于或等于 0，并且小于 100%。';
  }
  if (values.purchaseCost < 0 || values.shippingCost < 0 ||
      values.advertisingCost < 0 || values.otherCost < 0) {
    return '采购、物流、广告和其他费用不能为负数。';
  }
  if (values.safetyMarginRate < 0 || values.safetyMarginRate > 100) {
    return '安全边际应填写 0 到 100 之间的数字。';
  }

  const salePriceInput = document.getElementById('salePrice');
  if (salePriceInput.value.trim() !== '') {
    const salePrice = Number(salePriceInput.value);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      return '当前商品售价必须是大于 0 的有效数字。';
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
    return { text: '尚未输入当前商品售价，暂不计算与盈亏平衡点的距离。', status: '' };
  }
  const difference = currentSalePrice - breakEvenUsd;
  if (Math.abs(difference) < 0.000001) {
    return { text: '当前售价与盈亏平衡点基本相同：$0.00（0.00%）。', status: '' };
  }
  if (breakEvenUsd === 0) {
    return {
      text: `当前售价高于盈亏平衡点：${formatUsd(Math.abs(difference))}。由于盈亏平衡价为 0，无法计算百分比差距。`,
      status: 'positive'
    };
  }
  const percentageGap = Math.abs(difference) / breakEvenUsd * 100;
  return difference > 0
    ? { text: `当前售价高于盈亏平衡点：${formatUsd(difference)}（高出 ${percentageGap.toFixed(2)}%）。`, status: 'positive' }
    : { text: `当前售价低于盈亏平衡点：${formatUsd(Math.abs(difference))}（低于 ${percentageGap.toFixed(2)}%）。`, status: 'negative' };
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
  document.getElementById('breakEvenRmb').textContent = `${formatMoney(breakEvenRmb)} / 件`;
  document.getElementById('breakEvenUsd').textContent = formatUsd(breakEvenUsdValue);
  document.getElementById('breakEvenUsdCard').textContent = `${formatUsd(breakEvenUsdValue)} / 件`;
  document.getElementById('safeRmbLabel').textContent = `${safetyLabel}% 安全边际售价（人民币）`;
  document.getElementById('safeUsdLabel').textContent = `${safetyLabel}% 安全边际售价（美元）`;
  document.getElementById('safePriceRmb').textContent = `${formatMoney(safePriceRmbValue)} / 件`;
  document.getElementById('safePriceUsd').textContent = `${formatUsd(safePriceUsdValue)} / 件`;
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
      label = '采购成本上涨 10%';
    } else if (simulationType === 'shipping') {
      shippingCost *= 1.10;
      label = '物流费用上涨 10%';
    } else {
      advertisingCost *= 1.10;
      label = '广告费用上涨 10%';
    }

    const simulatedUnitCost = purchaseCost + shippingCost / latestBreakEvenResult.quantity +
      advertisingCost / latestBreakEvenResult.quantity + latestBreakEvenResult.otherCost / latestBreakEvenResult.quantity;
    const simulatedRmb = simulatedUnitCost / (1 - latestBreakEvenResult.commissionDecimal);
    const simulatedUsd = simulatedRmb / latestBreakEvenResult.exchangeRate;
    simulationResult.textContent = `${label}后，新的盈亏平衡售价约为 ${formatMoney(simulatedRmb)} / 件，${formatUsd(simulatedUsd)} / 件。原始输入未被修改。`;
    simulationResult.hidden = false;
  });
});

function validateQuoteInputs() {
  const values = Object.fromEntries(quoteInputIds.map(id => [id, getNumber(id)]));
  const hasMissingValue = quoteInputIds.some(id => document.getElementById(id).value.trim() === '');

  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return '请填写所有报价信息，并确保输入的是有效数字。';
  }
  if (values.quotePurchaseCost < 0 || values.quoteShippingCost < 0 ||
      values.quoteAdvertisingCost < 0 || values.quoteOtherCost < 0) {
    return '采购、物流、广告和其他费用不能为负数。';
  }
  if (!Number.isInteger(values.quoteQuantity) || values.quoteQuantity < 1) {
    return '商品数量必须是大于或等于 1 的整数。';
  }
  if (values.quoteExchangeRate <= 0) {
    return '请输入正确的美元兑人民币汇率，例如 7.10。';
  }
  if (values.quoteCommissionRate < 0 || values.quoteCommissionRate > 100) {
    return '平台佣金比例应填写 0 到 100 之间的数字。';
  }
  if (values.quoteTargetProfitRate < 0 || values.quoteTargetProfitRate >= 100) {
    return '目标利润率应填写 0 到 100 之间的数字（不含 100）。';
  }
  if (values.quoteCommissionRate + values.quoteTargetProfitRate >= 100) {
    return '当前平台佣金比例与目标利润率之和过高，无法计算合理售价。';
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
    showQuoteError('请至少填写一项大于 0 的商品成本或费用。');
    return;
  }

  const denominator = 1 - commissionDecimal - targetMarginDecimal;
  if (denominator <= 0) {
    showQuoteError('当前平台佣金比例与目标利润率之和过高，无法计算合理售价。');
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
    { name: '单件采购成本', value: purchaseCost },
    { name: '分摊物流费用', value: shippingShare },
    { name: '分摊广告费用', value: advertisingShare },
    { name: '分摊其他费用', value: otherShare }
  ].sort((a, b) => b.value - a.value);
  const mainCost = costItems[0];
  const mainCostShare = mainCost.value / fixedCost * 100;
  const costAnalysis = `当前主要成本来源是${mainCost.name}，为 ${formatMoney(mainCost.value)} / 件，约占不含佣金单件成本的 ${mainCostShare.toFixed(2)}%。`;

  const commissionLevel = commissionRate <= 5 ? '较低' : commissionRate <= 15 ? '中等' : '较高';
  const commissionAnalysis = `${platformName} 当前使用 ${commissionRate.toFixed(2)}% 的佣金比例，影响程度${commissionLevel}。按普通建议价估算，每件平台佣金约为 ${formatMoney(expectedCommission)}。`;

  const marginAssessment = targetProfitRate < 10
    ? '目标利润率偏低，可能难以覆盖退货、税费和汇率波动。'
    : targetProfitRate <= 30
      ? '目标利润率处于较常见的区间，报价相对平衡。'
      : targetProfitRate <= 45
        ? '目标利润率偏高，请结合市场同类商品价格判断竞争力。'
        : '目标利润率很高，建议重点确认市场是否能接受对应售价。';
  const marginAnalysis = `当前目标利润率为 ${targetProfitRate.toFixed(2)}%。${marginAssessment}`;

  const safetyAnalysis = `普通建议价比最低售价高 5%，偏保守建议价高 10%。该区间提供了基础安全边际，但尚未单独计入退货损失、税费和平台其他费用。`;

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
    return '请先在主利润计算器中填写公共基础数据。';
  }
  if (baseValues.purchaseCost < 0 || baseValues.shippingCost < 0 || baseValues.otherCost < 0) {
    return '公共基础数据中的采购、物流和其他费用不能为负数。';
  }
  if (!Number.isInteger(baseValues.quantity) || baseValues.quantity < 1) {
    return '公共基础数据中的商品数量必须是大于或等于 1 的整数。';
  }
  if (baseValues.exchangeRate <= 0) {
    return '请输入正确的美元兑人民币汇率，例如 7.10。';
  }

  const warningInput = document.getElementById('comparisonWarningRate');
  const warningRate = Number(warningInput.value);
  if (warningInput.value.trim() === '' || !Number.isFinite(warningRate) || warningRate < 0 || warningRate > 100) {
    return '利润率警戒值应填写 0 到 100 之间的数字。';
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
      return `请完整填写方案 ${key} 的售价、广告费用和佣金比例。`;
    }
    if (price <= 0) return `方案 ${key} 的商品售价必须大于 0。`;
    if (advertising < 0) return `方案 ${key} 的广告费用不能为负数。`;
    if (commissionRate < 0 || commissionRate > 100) return `方案 ${key} 的平台佣金比例应填写 0 到 100 之间的数字。`;
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
    showComparisonError(`请先完善主利润计算器：${error}`);
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
  const revenue = salePrice * base.exchangeRate * base.quantity;
  const productCost = base.purchaseCost * base.quantity;
  const commission = revenue * (commissionRate / 100);
  const totalCost = productCost + base.shippingCost + commission + advertisingCost + base.otherCost;
  const netProfit = revenue - totalCost;
  return {
    key,
    salePrice,
    advertisingCost,
    commissionRate,
    revenue,
    productCost,
    commission,
    totalCost,
    netProfit,
    unitProfit: netProfit / base.quantity,
    profitRate: netProfit / revenue * 100
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
  const context = `公共平台：${platformName}；利润率警戒值：${warningRate.toFixed(2)}%。`;
  document.getElementById('comparisonContext').textContent = context;

  scenarios.forEach(scenario => {
    const statusClass = scenario.netProfit >= 0 ? 'metric-positive' : 'metric-negative';
    const marginClass = scenario.netProfit < 0
      ? 'metric-negative'
      : scenario.profitRate < warningRate ? 'metric-caution' : '';
    const marginWarning = scenario.profitRate < warningRate ? `（低于 ${warningRate.toFixed(2)}%）` : '';
    setComparisonCell(`compare${scenario.key}Status`, scenario.netProfit >= 0 ? '盈利' : '亏损', statusClass);
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
  const purchaseCost = getNumber('purchaseCost');
  const salePrice = getNumber('salePrice');
  const exchangeRate = getNumber('exchangeRate');
  const shippingCost = getNumber('shippingCost');
  const commissionRate = getNumber('commissionRate');
  const advertisingCost = getNumber('advertisingCost');
  const otherCost = getNumber('otherCost');
  const quantity = getNumber('quantity');

  // 汇率的含义是“1 美元可以兑换多少人民币”。
  // 计算公式：销售收入 = 美元售价 × 汇率 × 数量。
  const revenue = salePrice * exchangeRate * quantity;
  const productCost = purchaseCost * quantity;
  const commission = revenue * (commissionRate / 100);
  const totalCost = productCost + shippingCost + commission + advertisingCost + otherCost;
  const netProfit = revenue - totalCost;
  const unitProfit = netProfit / quantity;
  const profitRate = (netProfit / revenue) * 100;

  document.getElementById('revenue').textContent = formatMoney(revenue);
  document.getElementById('productCost').textContent = formatMoney(productCost);
  document.getElementById('commission').textContent = formatMoney(commission);
  document.getElementById('totalCost').textContent = formatMoney(totalCost);
  // 单件总成本把所有总费用平均分摊到每件商品上，包含平台佣金。
  document.getElementById('unitTotalCost').textContent = formatMoney(totalCost / quantity);
  document.getElementById('netProfit').textContent = formatMoney(netProfit);
  document.getElementById('unitProfit').textContent = formatMoney(unitProfit);
  document.getElementById('profitRate').textContent = `${profitRate.toFixed(2)}%`;
  document.getElementById('costRate').textContent = `${((totalCost / revenue) * 100).toFixed(2)}%`;

  const isProfit = netProfit > 0;
  const status = document.getElementById('profitStatus');
  status.textContent = isProfit ? '盈利' : '亏损';
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

  const purchaseCost = getNumber('purchaseCost');
  const salePrice = getNumber('salePrice');
  const exchangeRate = getNumber('exchangeRate');
  const shippingCost = getNumber('shippingCost');
  const commissionRate = getNumber('commissionRate');
  const advertisingCost = getNumber('advertisingCost');
  const otherCost = getNumber('otherCost');
  const quantity = getNumber('quantity');
  const revenue = salePrice * exchangeRate * quantity;
  const productCost = purchaseCost * quantity;
  const commission = revenue * (commissionRate / 100);
  const totalCost = productCost + shippingCost + commission + advertisingCost + otherCost;
  const netProfit = revenue - totalCost;
  const profitRate = (netProfit / revenue) * 100;
  const costRate = (totalCost / revenue) * 100;
  const platform = document.getElementById('platform').value;
  const commissionImpact = commission / revenue * 100;
  const advertisingImpact = advertisingCost / revenue * 100;

  document.getElementById('aiProfitAnalysis').textContent = netProfit > 0
    ? `当前处于盈利状态，预计净利润为 ${formatMoney(netProfit)}，每件利润约为 ${formatMoney(netProfit / quantity)}。`
    : netProfit < 0
      ? `当前处于亏损状态，预计亏损 ${formatMoney(Math.abs(netProfit))}，建议先检查售价和主要成本。`
      : '当前处于盈亏平衡状态，暂时没有净利润。';

  document.getElementById('aiMarginAnalysis').textContent = profitRate >= 30
    ? `利润率为 ${profitRate.toFixed(2)}%，目前利润空间较好，但仍需留意平台费率和汇率波动。`
    : profitRate >= 15
      ? `利润率为 ${profitRate.toFixed(2)}%，处于中等水平，建议继续优化采购和广告投入。`
      : profitRate > 0
        ? `利润率为 ${profitRate.toFixed(2)}%，利润空间偏低，成本或汇率稍有变化就可能影响盈利。`
        : `利润率为 ${profitRate.toFixed(2)}%，目前没有形成安全利润空间。`;

  const costItems = [
    { name: '商品采购成本', value: productCost },
    { name: '平台佣金', value: commission },
    { name: '国际物流', value: shippingCost },
    { name: '广告费用', value: advertisingCost },
    { name: '其他费用', value: otherCost }
  ].sort((a, b) => b.value - a.value);
  const topCosts = costItems.slice(0, 3).map(item => `${item.name} ${formatMoney(item.value)}（占销售额 ${(item.value / revenue * 100).toFixed(2)}%）`);
  document.getElementById('aiCostAnalysis').textContent = `总费用为 ${formatMoney(totalCost)}，约占销售额 ${costRate.toFixed(2)}%。主要费用项目为：${topCosts.join('、')}。`;

  const platformAnalysis = {
    custom: `当前使用自定义平台费率 ${commissionRate.toFixed(2)}%，产生佣金 ${formatMoney(commission)}。建议根据实际平台账单继续校准佣金比例。`,
    amazon: `当前选择 Amazon，使用的佣金比例为 ${commissionRate.toFixed(2)}%，佣金占销售额 ${commissionImpact.toFixed(2)}%；广告费用占销售额 ${advertisingImpact.toFixed(2)}%。Amazon 场景下应重点同时观察佣金和广告投入对利润的影响。`,
    ebay: `当前选择 eBay，使用的佣金比例为 ${commissionRate.toFixed(2)}%，佣金占销售额 ${commissionImpact.toFixed(2)}%。建议结合成交费、推广费用和实际账单综合核对。`,
    shopify: `当前选择 Shopify，使用的佣金比例为 ${commissionRate.toFixed(2)}%。独立站通常还需要关注支付处理和获客投入；当前广告费用占销售额 ${advertisingImpact.toFixed(2)}%。`,
    tiktok: `当前选择 TikTok Shop，使用的佣金比例为 ${commissionRate.toFixed(2)}%。内容投放和广告费用会直接影响利润，当前广告费用占销售额 ${advertisingImpact.toFixed(2)}%。`,
    aliexpress: `当前选择 AliExpress，使用的佣金比例为 ${commissionRate.toFixed(2)}%，佣金占销售额 ${commissionImpact.toFixed(2)}%。建议同时关注平台活动折扣和国际物流成本。`
  };
  document.getElementById('aiPlatformAnalysis').textContent = platformAnalysis[platform];

  const platformSuggestions = {
    custom: '根据实际平台账单更新佣金比例，并把支付、退款等平台相关费用计入其他费用。',
    amazon: '针对 Amazon，分别跟踪平台佣金与广告投产比，及时暂停高花费、低转化的广告活动。',
    ebay: '针对 eBay，定期核对成交费和推广费，并比较开启推广前后的单件利润。',
    shopify: '针对 Shopify，重点控制广告获客成本，并把支付处理费用纳入完整成本。',
    tiktok: '针对 TikTok Shop，比较自然内容与付费投放的转化效果，避免广告费用增长快于销售额。',
    aliexpress: '针对 AliExpress，评估平台活动折扣、佣金和国际物流叠加后的真实利润。'
  };

  const suggestions = [
    netProfit <= 0
      ? '当前处于亏损或持平状态，建议先提高售价或降低主要费用，再扩大销量。'
      : '保留一定利润缓冲，应对汇率变化、退款和平台额外费用。',
    productCost / revenue >= 0.4
      ? '优先与供应商重新议价，或优化包装和采购批量，降低单件采购成本。'
      : '继续比较供应商报价，定期复核单件采购成本，避免采购成本逐步上升。',
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

  const purchaseCost = getNumber('purchaseCost');
  const salePrice = getNumber('salePrice');
  const exchangeRate = getNumber('exchangeRate');
  const shippingCost = getNumber('shippingCost');
  const commissionRate = getNumber('commissionRate');
  const advertisingCost = getNumber('advertisingCost');
  const otherCost = getNumber('otherCost');
  const quantity = getNumber('quantity');
  const revenue = salePrice * exchangeRate * quantity;
  const productCost = purchaseCost * quantity;
  const commission = revenue * (commissionRate / 100);
  const totalCost = productCost + shippingCost + commission + advertisingCost + otherCost;
  const netProfit = revenue - totalCost;
  const profitRate = (netProfit / revenue) * 100;
  const platformSelect = document.getElementById('platform');
  const platformName = platformSelect.selectedOptions[0].textContent.split('（')[0];
  const now = new Date();
  const dateText = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  document.getElementById('pdfDate').textContent = dateText;
  document.getElementById('pdfPlatform').textContent = platformName;
  document.getElementById('pdfQuantity').textContent = `${quantity} 件`;
  document.getElementById('pdfSalePrice').textContent = `$${salePrice.toFixed(2)} / 件`;
  document.getElementById('pdfExchangeRate').textContent = `1 美元 = ${exchangeRate} 人民币`;
  document.getElementById('pdfUnitPurchaseCost').textContent = `${formatMoney(purchaseCost)} / 件`;
  document.getElementById('pdfProductCost').textContent = formatMoney(productCost);
  document.getElementById('pdfShippingCost').textContent = formatMoney(shippingCost);
  document.getElementById('pdfCommission').textContent = `${formatMoney(commission)}（费率 ${commissionRate.toFixed(2)}%）`;
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
    document.getElementById('pdfBreakEvenRmb').textContent = `${formatMoney(latestBreakEvenResult.breakEvenRmb)} / 件`;
    document.getElementById('pdfBreakEvenUsd').textContent = `${formatUsd(latestBreakEvenResult.breakEvenUsd)} / 件`;
    document.getElementById('pdfSafePrice').textContent = `${latestBreakEvenResult.safetyLabel}%：${formatMoney(latestBreakEvenResult.safePriceRmb)} / ${formatUsd(latestBreakEvenResult.safePriceUsd)}`;
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
      const marginWarning = scenario.profitRate < latestComparisonResult.warningRate ? '（低于警戒值）' : '';
      document.getElementById(`pdfCompare${scenario.key}Revenue`).textContent = formatMoney(scenario.revenue);
      document.getElementById(`pdfCompare${scenario.key}TotalCost`).textContent = formatMoney(scenario.totalCost);
      document.getElementById(`pdfCompare${scenario.key}NetProfit`).textContent = formatMoney(scenario.netProfit);
      document.getElementById(`pdfCompare${scenario.key}UnitProfit`).textContent = formatMoney(scenario.unitProfit);
      document.getElementById(`pdfCompare${scenario.key}Margin`).textContent = `${scenario.profitRate.toFixed(2)}%${marginWarning}`;
    });
  }

  // 临时修改网页标题，让浏览器建议一个清楚的 PDF 文件名。
  const originalTitle = document.title;
  const fileDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  document.title = `跨境电商利润分析报告_${fileDate}`;
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
  }, { once: true });

  requestAnimationFrame(() => window.print());
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
});
