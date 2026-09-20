// 获取页面上的输入框和结果区域，后面会用它们来读取数据和显示结果。
const form = document.getElementById('profitForm');
const clearButton = document.getElementById('clearButton');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('resultSection');
const targetForm = document.getElementById('targetForm');
const targetError = document.getElementById('targetError');
const targetResult = document.getElementById('targetResult');
const aiAnalysisButton = document.getElementById('aiAnalysisButton');
const aiAnalysisSection = document.getElementById('aiAnalysisSection');

// 这里的费率是方便估算的参考值，实际费率可能因国家、类目和账号而不同。
const platformRates = {
  custom: 0,
  amazon: 15,
  ebay: 13.25,
  tiktok: 6,
  shopify: 0
};

const inputIds = [
  'purchaseCost', 'salePrice', 'exchangeRate', 'shippingCost',
  'commissionRate', 'advertisingCost', 'otherCost', 'quantity'
];

document.getElementById('platform').addEventListener('change', (event) => {
  document.getElementById('commissionRate').value = platformRates[event.target.value];
  targetResult.hidden = true;
});

// 金额统一保留两位小数，并加上人民币符号，方便阅读。
function formatMoney(value) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  targetResult.hidden = true;
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

  const suggestions = [
    netProfit <= 0
      ? '当前处于亏损或持平状态，建议先提高售价或降低主要费用，再扩大销量。'
      : '保留一定利润缓冲，应对汇率变化、退款和平台额外费用。',
    productCost / revenue >= 0.4
      ? '优先与供应商重新议价，或优化包装和采购批量，降低单件采购成本。'
      : '继续比较供应商报价，定期复核单件采购成本，避免采购成本逐步上升。',
    advertisingCost / revenue >= 0.1
      ? '检查广告投产比，暂停低转化关键词，把预算集中到高转化商品和人群。'
      : shippingCost / revenue >= 0.1
        ? '比较不同物流渠道和运输方案，争取降低国际物流总费用。'
        : '定期核对平台实际账单和物流报价，避免额外费用逐步侵蚀利润。'
  ];
  const suggestionList = document.getElementById('aiSuggestions');
  suggestionList.replaceChildren(...suggestions.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));

  // 用 10% 至 20% 的目标利润率估算一个实用的建议售价区间。
  const fixedCosts = purchaseCost * quantity + shippingCost + advertisingCost + otherCost;
  const lowDenominator = 1 - commissionRate / 100 - 0.10;
  const highDenominator = 1 - commissionRate / 100 - 0.20;
  const lowPrice = lowDenominator > 0 ? fixedCosts / (quantity * exchangeRate * lowDenominator) : null;
  const highPrice = highDenominator > 0 ? fixedCosts / (quantity * exchangeRate * highDenominator) : null;
  document.getElementById('aiPriceRange').textContent = lowPrice !== null && highPrice !== null
    ? `按 10% 至 20% 目标利润率估算，建议售价范围约为 $${lowPrice.toFixed(2)} - $${highPrice.toFixed(2)} / 件。实际售价还应结合市场竞争和平台账单调整。`
    : '当前平台佣金比例过高，无法计算 10% 至 20% 目标利润率对应的售价范围，请先降低佣金比例或调整费用。';

  aiAnalysisSection.hidden = false;
});

targetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  targetError.hidden = true;
  targetResult.hidden = true;

  const baseError = validateInputsWithoutSalePrice();
  const targetInput = document.getElementById('targetProfitRate');
  const targetValue = Number(targetInput.value);
  if (baseError) {
    showTargetError(`请先完善当前商品信息：${baseError}`);
    return;
  }
  if (targetInput.value.trim() === '' || !Number.isFinite(targetValue)) {
    showTargetError('请输入目标利润率。');
    return;
  }
  if (targetValue < 0 || targetValue >= 100) {
    showTargetError('目标利润率应填写 0 到 100 之间的数字（不含 100）。');
    return;
  }

  const purchaseCost = getNumber('purchaseCost');
  const exchangeRate = getNumber('exchangeRate');
  const shippingCost = getNumber('shippingCost');
  const commissionRate = getNumber('commissionRate');
  const advertisingCost = getNumber('advertisingCost');
  const otherCost = getNumber('otherCost');
  const quantity = getNumber('quantity');
  const commissionDecimal = commissionRate / 100;
  const targetDecimal = targetValue / 100;
  const denominator = 1 - commissionDecimal - targetDecimal;

  // 目标利润率 = 净利润 / 销售收入，因此售价公式的分母必须大于 0。
  if (denominator <= 0) {
    showTargetError('当前平台佣金比例和目标利润率过高，数学上无法计算出可行售价。请降低其中一个比例。');
    return;
  }

  const fixedCosts = purchaseCost * quantity + shippingCost + advertisingCost + otherCost;
  const suggestedPrice = fixedCosts / (quantity * exchangeRate * denominator);
  if (!Number.isFinite(suggestedPrice) || suggestedPrice < 0) {
    showTargetError('当前输入无法计算出有效售价，请检查成本、数量和汇率。');
    return;
  }

  document.getElementById('suggestedPrice').textContent = `$${suggestedPrice.toFixed(2)}`;
  document.getElementById('targetExplanation').textContent = `按目标利润率 ${targetValue.toFixed(2)}% 和平台佣金 ${commissionRate.toFixed(2)}% 估算，这是每件商品的建议最低售价。`;
  targetResult.hidden = false;
});

function validateInputsWithoutSalePrice() {
  const ids = inputIds.filter(id => id !== 'salePrice');
  const values = Object.fromEntries(ids.map(id => [id, getNumber(id)]));
  const hasMissingValue = ids.some(id => document.getElementById(id).value.trim() === '');
  const exchangeRateText = document.getElementById('exchangeRate').value.trim();

  if (exchangeRateText === '' || !Number.isFinite(values.exchangeRate) || values.exchangeRate <= 0) {
    return '请输入正确的美元兑人民币汇率，例如 7.10。';
  }

  if (hasMissingValue || Object.values(values).some(value => !Number.isFinite(value))) {
    return '请填写所有必要输入项，并确保输入的是有效数字。';
  }
  if (values.purchaseCost < 0 || values.shippingCost < 0 ||
      values.advertisingCost < 0 || values.otherCost < 0) {
    return '采购成本、物流、广告和其他费用不能为负数。';
  }
  if (values.commissionRate < 0 || values.commissionRate > 100) {
    return '平台佣金比例应填写 0 到 100 之间的数字。';
  }
  if (!Number.isInteger(values.quantity) || values.quantity < 1) {
    return '商品数量必须是大于或等于 1 的整数。';
  }
  return null;
}

function showTargetError(message) {
  targetError.textContent = message;
  targetError.hidden = false;
}

clearButton.addEventListener('click', () => {
  form.reset();
  targetForm.reset();
  errorMessage.hidden = true;
  resultSection.hidden = true;
  targetError.hidden = true;
  targetResult.hidden = true;
  aiAnalysisSection.hidden = true;
});
