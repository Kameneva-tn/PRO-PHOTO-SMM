/**
 * ProPhoto — прийом заявок у Google Таблицю.
 *
 * Як підключити (детально в server/README.md):
 * 1. Створи Google Таблицю.
 * 2. Розширення → Apps Script.
 * 3. Встав увесь цей код замість того, що там було.
 * 4. Натисни "Розгорнути" → "Новий розгортання" → тип "Веб-застосунок".
 *    - Виконувати як: Я
 *    - Хто має доступ: Усі (Anyone)
 * 5. Скопіюй URL веб-застосунку і встав у .env як SHEETS_WEBHOOK_URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Якщо таблиця порожня — додаємо рядок-заголовок
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Дата', 'Order ID', "Ім'я", 'Телефон', 'Email',
        'Пакет', 'Сума', 'Джерело', 'Статус', 'Повідомлення'
      ]);
    }

    sheet.appendRow([
      data.created_at || new Date().toLocaleString('uk-UA'),
      data.order_id || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.package || '',
      data.amount || '',
      data.source || '',
      data.status || 'new',
      data.message || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
