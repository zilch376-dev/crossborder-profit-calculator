const endpoint = process.argv[2] || 'http://127.0.0.1:9223';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function connect() {
  let pages;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      pages = await fetch(`${endpoint}/json/list`).then(response => response.json());
      if (pages.length) break;
    } catch (error) {
      // 浏览器可能还在启动，稍后重试。
    }
    await delay(250);
  }
  if (!pages?.length) throw new Error('Could not connect to the browser.');

  const page = pages.find(item => item.type === 'page' && item.url.includes('CrossBorder-Profit-Calculator/index.html'))
    || pages.find(item => item.type === 'page') || pages[0];
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.';
      throw new Error(detail);
    }
    return result.result.value;
  };

  return { send, evaluate, close: () => socket.close() };
}

const checks = [];
function check(name, condition, actual) {
  checks.push({ name, passed: Boolean(condition), actual });
  console.log(`${condition ? 'PASS' : 'FAIL'} | ${name}${actual === undefined ? '' : ` | ${JSON.stringify(actual)}`}`);
}

(async () => {
  const browser = await connect();
  const { evaluate, send } = browser;
  await send('Runtime.enable');
  await delay(600);

  await evaluate(`localStorage.clear(); location.reload()`);
  await delay(900);

  let state = await evaluate(`({
    language: getCurrentLanguage(),
    htmlLang: document.documentElement.lang,
    title: document.title,
    heading: document.querySelector('h1').textContent.trim(),
    exchangePlaceholder: document.getElementById('exchangeRate').placeholder,
    date: formatLocalizedDate(new Date(2026, 8, 25)),
    cny: formatLocalizedCny(1234.56),
    usd: formatLocalizedUsd(123.45),
    tradeOptions: [...document.getElementById('tradeTerm').options].map(option => option.textContent.trim())
  })`);
  check('默认语言为中文', state.language === 'zh' && state.htmlLang === 'zh-CN', state);
  check('中文标题和汇率提示', state.heading === '跨境电商利润计算器' && state.exchangePlaceholder === '例如：7.10', state);
  check('中文日期和货币格式', state.date === '2026年9月25日' && state.cny === '¥1,234.56' && state.usd === '$123.45', state);
  check('中文 Incoterms 说明', state.tradeOptions[0].includes('工厂交货') && state.tradeOptions[3].includes('保险费加运费'), state.tradeOptions);

  state = await evaluate(`(() => {
    const values = {
      productName: 'Test Mug', sku: 'TEST-001', purchaseCost: 50, salePrice: 20,
      exchangeRate: 7.1, shippingCost: 100, advertisingCost: 30, otherCost: 20, quantity: 5
    };
    Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
    platform.value = 'amazon'; platform.dispatchEvent(new Event('change', { bubbles: true }));
    profitForm.requestSubmit();
    return {
      commissionRate: commissionRate.value,
      visible: !resultSection.hidden,
      revenue: revenue.textContent,
      totalCost: totalCost.textContent,
      netProfit: netProfit.textContent,
      unitProfit: unitProfit.textContent,
      margin: profitRate.textContent,
      status: profitStatus.textContent
    };
  })()`);
  check('平台模板自动填写 Amazon 15%', state.commissionRate === '15', state.commissionRate);
  check('中文利润公式结果正确', state.visible && state.revenue === '¥710.00' && state.totalCost === '¥506.50' && state.netProfit === '¥203.50' && state.unitProfit === '¥40.70' && state.margin === '28.66%' && state.status === '盈利', state);

  state = await evaluate(`(() => {
    exchangeRate.value = 0;
    profitForm.requestSubmit();
    const message = errorMessage.textContent.trim();
    exchangeRate.value = 7.1;
    profitForm.requestSubmit();
    return message;
  })()`);
  check('中文汇率错误提示', state === '请输入正确的美元兑人民币汇率，例如 7.10。', state);

  state = await evaluate(`(() => {
    aiAnalysisButton.click();
    breakEvenForm.requestSubmit();
    Object.assign(quotePurchaseCost, { value: 50 });
    quoteQuantity.value = 5; quoteShippingCost.value = 100; quoteAdvertisingCost.value = 30;
    quoteOtherCost.value = 20; quotePlatform.value = 'amazon';
    quotePlatform.dispatchEvent(new Event('change', { bubbles: true }));
    quoteExchangeRate.value = 7.1; quoteTargetProfitRate.value = 25;
    quoteForm.requestSubmit();
    fillComparisonButton.click();
    scenarioBPrice.value = 22; scenarioCPrice.value = 18;
    comparisonForm.requestSubmit();
    return {
      ai: !aiAnalysisSection.hidden,
      breakEven: breakEvenUsdCard.textContent,
      quote: quoteMinimumUsdCard.textContent,
      quoteRange: quoteRange.textContent,
      comparison: !comparisonResultSection.hidden,
      comparisonA: compareANetProfit.textContent,
      comparisonB: compareBNetProfit.textContent,
      comparisonC: compareCNetProfit.textContent
    };
  })()`);
  check('AI、盈亏平衡、报价和方案对比可正常生成', state.ai && state.comparison && state.breakEven === '$13.26 / 件' && state.quote === '$18.78', state);
  check('三方案仍使用统一利润公式', state.comparisonA === '¥203.50' && state.comparisonB === '¥263.85' && state.comparisonC === '¥143.15', state);

  state = await evaluate(`(() => {
    window.confirm = () => true;
    saveProductButton.click();
    return {
      count: document.querySelectorAll('#productListBody tr').length,
      storage: JSON.parse(localStorage.getItem('crossBorderProfitProductsV4') || '[]').length,
      message: productMessage.textContent.trim()
    };
  })()`);
  check('SKU 保存到 localStorage', state.count === 1 && state.storage === 1, state);

  state = await evaluate(`new Promise(resolve => {
    const csv = 'SKU,产品名称,平台,单件采购成本,商品售价USD,汇率,商品数量,物流总费用,平台佣金比例,广告总费用,其他总费用\\nB-001,Batch Mug,Amazon,50,20,7.1,5,100,15,30,20';
    const file = new File([csv], 'sample.csv', { type: 'text/csv' });
    const transfer = new DataTransfer(); transfer.items.add(file); batchFile.files = transfer.files;
    batchFile.dispatchEvent(new Event('change', { bubbles: true }));
    analyzeBatchButton.click();
    setTimeout(() => resolve({
      visible: !batchResultSection.hidden,
      count: batchTotalCount.textContent,
      profit: batchProfit.textContent,
      rows: document.querySelectorAll('#batchResultBody tr').length,
      error: batchError.textContent.trim()
    }), 500);
  })`);
  check('中文 CSV 批量分析可正常导入', state.visible && state.count === '1' && state.profit === '¥203.50' && state.rows === 1 && !state.error, state);

  state = await evaluate(`(() => {
    let captured = '';
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { captured = this.download; };
    downloadBatchTemplateButton.click();
    HTMLAnchorElement.prototype.click = original;
    return { fileName: captured, header: Object.values(batchFieldLabels).map(t).join(',') };
  })()`);
  check('中文 CSV 模板文件名和表头', state.fileName === '批量利润分析模板_中文.csv' && state.header.includes('产品名称') && state.header.includes('商品售价USD'), state);

  state = await evaluate(`(() => {
    tradeTerm.value = 'CIF'; tradeTerm.dispatchEvent(new Event('change', { bubbles: true }));
    tradeQuoteUnit.value = 'unit'; tradeQuoteUnit.dispatchEvent(new Event('change', { bubbles: true })); tradePurchaseCost.value = 50;
    tradeQuantity.value = 100; tradeDomesticCost.value = 500; tradePortCost.value = 300;
    tradeInternationalCost.value = 2000; tradeInsuranceCost.value = 200; tradeOtherCost.value = 100;
    tradeExchangeRate.value = 7.1; tradeTargetMargin.value = 20;
    tradeQuoteForm.requestSubmit();
    return { visible: !tradeQuoteResultSection.hidden, totalCost: tradeTotalCost.textContent, unitUsd: tradeUnitQuote.textContent };
  })()`);
  check('CIF 外贸报价结果正确', state.visible && state.totalCost === '¥8,100.00' && state.unitUsd === '¥101.25 / $14.26', state);

  state = await evaluate(`(() => {
    window.print = () => {};
    exportPdfButton.click();
    const main = {
      title: document.querySelector('#pdfReport h1').textContent.trim(), date: pdfDate.textContent.trim(),
      revenue: pdfRevenue.textContent.trim(), disclaimer: document.querySelector('#pdfReport .pdf-footer').textContent.trim()
    };
    window.dispatchEvent(new Event('afterprint'));
    exportBatchPdfButton.click();
    const batch = { title: document.querySelector('#batchPdfReport h1').textContent.trim(), date: batchPdfDate.textContent.trim() };
    window.dispatchEvent(new Event('afterprint'));
    exportTradePdfButton.click();
    const trade = { title: document.querySelector('#tradePdfReport h1').textContent.trim(), date: tradePdfDate.textContent.trim() };
    window.dispatchEvent(new Event('afterprint'));
    return { main, batch, trade };
  })()`);
  check('中文利润、批量和外贸 PDF 内容', state.main.title === '跨境电商利润分析报告' && state.main.date.includes('年') && state.main.revenue === '¥710.00' && /[一-龥]/.test(state.main.disclaimer) && state.batch.title === '批量利润分析摘要' && state.batch.date.includes('年') && state.trade.title === '外贸出口报价单' && state.trade.date.includes('年'), state);

  await evaluate(`langEn.click()`);
  await delay(500);
  state = await evaluate(`({
    language: getCurrentLanguage(),
    stored: localStorage.getItem('crossBorderProfitLanguage'),
    htmlLang: document.documentElement.lang,
    title: document.title,
    heading: document.querySelector('h1').textContent.trim(),
    exchangeLabel: exchangeRate.closest('label').querySelector('span').textContent.trim(),
    exchangePlaceholder: exchangeRate.placeholder,
    date: formatLocalizedDate(new Date(2026, 8, 25)),
    cny: formatLocalizedCny(1234.56),
    usd: formatLocalizedUsd(123.45),
    revenue: revenue.textContent,
    netProfit: netProfit.textContent,
    status: profitStatus.textContent,
    aiText: aiProfitAnalysis.textContent.trim(),
    quote: quoteMinimumUsdCard.textContent,
    batchProfit: batchProfit.textContent,
    trade: tradeUnitQuote.textContent,
    tradeOptions: [...tradeTerm.options].map(option => option.textContent.trim()),
    visibleChinese: [...document.body.querySelectorAll('*')]
      .filter(element => element.offsetParent !== null && element.id !== 'langZh')
      .flatMap(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.nodeValue.trim()))
      .filter(text => /[一-龥]/.test(text))
  })`);
  check('切换 English 并保存语言偏好', state.language === 'en' && state.stored === 'en' && state.htmlLang === 'en', state);
  check('英文标题、标签和占位提示', state.heading === 'Cross-border E-commerce Profit Calculator' && state.exchangeLabel.startsWith('USD to CNY Exchange Rate') && state.exchangePlaceholder === 'For example: 7.10', state);
  check('英文日期和货币格式', state.date === 'Sep 25, 2026' && state.cny === 'CNY ¥1,234.56' && state.usd === 'USD $123.45', state);
  check('已有动态结果同步切换英文', state.revenue === 'CNY ¥710.00' && state.netProfit === 'CNY ¥203.50' && state.status === 'Profit' && state.quote === 'USD $18.78' && state.batchProfit === 'CNY ¥203.50' && state.trade === 'CNY ¥101.25 / USD $14.26', state);
  check('AI 分析同步切换英文', state.aiText && !/[一-龥]/.test(state.aiText), state.aiText);
  check('英文页面无遗漏中文可见文案', state.visibleChinese.length === 0, state.visibleChinese);
  check('英文 Incoterms 保留标准缩写', JSON.stringify(state.tradeOptions) === JSON.stringify(['EXW', 'FOB', 'CFR', 'CIF']), state.tradeOptions);

  state = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('#productListBody button')];
    purchaseCost.value = 999;
    buttons.find(button => button.dataset.action === 'load').click();
    return {
      labels: buttons.map(button => button.textContent.trim()),
      purchaseCost: purchaseCost.value,
      message: productMessage.textContent.trim()
    };
  })()`);
  check('英文 SKU 操作按钮和加载功能', JSON.stringify(state.labels) === JSON.stringify(['Load', 'Edit', 'Delete']) && state.purchaseCost === '50' && state.message.includes('loaded'), state);

  state = await evaluate(`(() => {
    exchangeRate.value = 0; profitForm.requestSubmit();
    const message = errorMessage.textContent.trim();
    exchangeRate.value = 7.1; profitForm.requestSubmit(); aiAnalysisButton.click();
    return message;
  })()`);
  check('英文汇率错误提示', state === 'Please enter a valid USD to CNY exchange rate, for example 7.10.', state);

  state = await evaluate(`(() => {
    let captured = '';
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { captured = this.download; };
    downloadBatchTemplateButton.click();
    HTMLAnchorElement.prototype.click = original;
    return { fileName: captured, header: Object.values(batchFieldLabels).map(t).join(',') };
  })()`);
  check('英文 CSV 模板文件名和表头', state.fileName === 'bulk_profit_analysis_template_en.csv' && state.header.includes('Product Name') && state.header.includes('Selling Price'), state);

  state = await evaluate(`new Promise(resolve => {
    const sheet = XLSX.utils.json_to_sheet([{
      SKU: 'X-001', 'Product Name': 'XLSX Mug', Platform: 'Amazon', 'Product Cost': 50,
      'Selling Price': 20, 'Exchange Rate': 7.1, Quantity: 5, 'Shipping Cost': 100,
      'Commission Rate': 15, 'Advertising Cost': 30, 'Other Cost': 20
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Profit Data');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([data], 'english-template.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const transfer = new DataTransfer(); transfer.items.add(file); batchFile.files = transfer.files;
    batchFile.dispatchEvent(new Event('change', { bubbles: true }));
    analyzeBatchButton.click();
    setTimeout(() => resolve({ visible: !batchResultSection.hidden, count: batchTotalCount.textContent, profit: batchProfit.textContent, error: batchError.textContent.trim() }), 600);
  })`);
  check('英文列名 XLSX 批量分析可正常导入', state.visible && state.count === '1' && state.profit === 'CNY ¥203.50' && !state.error, state);

  state = await evaluate(`(() => {
    window.print = () => {};
    exportPdfButton.click();
    const result = {
      mode: document.body.classList.contains('print-main'),
      title: document.querySelector('#pdfReport h1').textContent.trim(),
      date: pdfDate.textContent.trim(),
      revenue: pdfRevenue.textContent.trim(),
      disclaimer: document.querySelector('#pdfReport .pdf-footer').textContent.trim()
    };
    window.dispatchEvent(new Event('afterprint'));
    return result;
  })()`);
  check('英文 PDF 报告内容同步切换', state.mode && state.title === 'Cross-border E-commerce Profit Analysis Report' && state.date.includes('Sep') && state.revenue === 'CNY ¥710.00' && !/[一-龥]/.test(state.disclaimer), state);

  state = await evaluate(`(() => {
    window.print = () => {};
    exportBatchPdfButton.click();
    const batch = {
      title: document.querySelector('#batchPdfReport h1').textContent.trim(),
      date: batchPdfDate.textContent.trim(),
      summary: batchPdfSummary.textContent.trim()
    };
    window.dispatchEvent(new Event('afterprint'));
    exportTradePdfButton.click();
    const trade = {
      title: document.querySelector('#tradePdfReport h1').textContent.trim(),
      date: tradePdfDate.textContent.trim(),
      explanation: tradePdfExplanation.textContent.trim()
    };
    window.dispatchEvent(new Event('afterprint'));
    return { batch, trade };
  })()`);
  check('英文批量和外贸 PDF 内容同步切换', state.batch.title === 'Bulk Profit Analysis Summary' && state.batch.date.includes('Sep') && !/[一-龥]/.test(state.batch.summary) && state.trade.title === 'Export Quotation' && state.trade.date.includes('Sep') && !/[一-龥]/.test(state.trade.explanation), state);

  await evaluate(`location.reload()`);
  await delay(1000);
  state = await evaluate(`({ language: getCurrentLanguage(), title: document.title, stored: localStorage.getItem('crossBorderProfitLanguage') })`);
  check('刷新后保留 English', state.language === 'en' && state.stored === 'en' && state.title === 'Cross-border E-commerce Profit Calculator', state);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(250);
  state = await evaluate(`({
    viewport: innerWidth,
    bodyWidth: document.body.scrollWidth,
    containerWidth: Math.round(document.querySelector('.container').getBoundingClientRect().width),
    switchRight: Math.round(document.querySelector('.language-switcher').getBoundingClientRect().right),
    cards: getComputedStyle(document.querySelector('.feature-grid')).gridTemplateColumns
  })`);
  check('手机宽度无横向溢出', state.bodyWidth <= state.viewport && state.containerWidth <= state.viewport && state.switchRight <= state.viewport, state);
  check('手机功能卡片为单列', state.cards.split(' ').length === 1, state.cards);

  await send('Emulation.clearDeviceMetricsOverride');
  const failed = checks.filter(item => !item.passed);
  console.log(`SUMMARY | ${checks.length - failed.length}/${checks.length} passed`);
  browser.close();
  if (failed.length) process.exitCode = 1;
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
