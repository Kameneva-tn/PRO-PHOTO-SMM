# ProPhoto Academy — Курс SMM Instagram (лендинг)

Односторінковий лендинг курсу «Сама собі SMM: інста, яка продає».
Чистий стек: **HTML + CSS + JavaScript**, без фреймворків і без білдерів.

## Структура

```
prophoto-smm/
├── index.html          # розмітка сторінки
├── css/
│   └── styles.css      # усі стилі
├── js/
│   └── main.js         # навігація, акордеон програми, модалки, форми
├── assets/             # логотип, фавікон, зображення робіт
└── README.md
```

## Запуск локально

Просто відкрий `index.html` у браузері. Або підніми локальний сервер:

```bash
python3 -m http.server 8000
# відкрий http://localhost:8000
```

## Розділи

- Hero з датою, ціною та кнопками
- Статистика (роки/випускники/групи/години)
- «Для кого цей курс»
- Програма курсу (розкривний акордеон, 15 лекцій)
- Порівняння пакетів (BASE / Platinum Expert / Вільний слухач)
- Лектори
- Як проходить курс
- Галерея робіт
- Відгуки
- Форма заявки + модальні вікна

## Форми

Форми відправляють дані на бекенд (папка `server/`): заявка зберігається в базу,
у Telegram-групу приходить сповіщення, а для пакетів запускається оплата LiqPay.

Щоб під'єднати сайт до бекенду, у `js/main.js` встав адресу сервера:
```js
const API_BASE = "https://твій-бекенд.onrender.com";
```
Повна інструкція (БД, LiqPay, Telegram, деплой, адмінка) — у `server/README.md`.

## Як залити на GitHub

```bash
cd prophoto-smm
git init
git add .
git commit -m "Initial commit: ProPhoto SMM landing"
git branch -M main
git remote add origin https://github.com/ВАШ_НІК/НАЗВА_РЕПО.git
git push -u origin main
```

### Безкоштовний хостинг через GitHub Pages
1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** → гілка `main`, папка `/root`
3. Через хвилину сайт буде за адресою `https://ВАШ_НІК.github.io/НАЗВА_РЕПО/`

---

> Контент відтворено з навчальною метою на основі публічної сторінки курсу.
> Права на текст, зображення та бренд належать ProPhoto Academy.
