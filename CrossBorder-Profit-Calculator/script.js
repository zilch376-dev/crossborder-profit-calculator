// 获取页面上的输入框和结果区域，后面会用它们来读取数据和显示结果。
const form = document.getElementById('profitForm');
const clearButton = document.getElementById('clearButton');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('resultSection');
const targetForm = document.getElementById('targetForm');
const targetError = document.getElementById('targetError');
const targetResult = document.getElementById('targetResult');

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
});
