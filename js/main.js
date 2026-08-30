/* ===== Program data ===== */
const PROGRAM = [
  ['00', 'Вступна лекція', 'Важливість візуалу та стратегії ведення соцмереж. Налаштування камери телефону.'],
  ['01', 'Контент — інструмент продажів', 'Що нас чіпляє у візуалі та який візуал продає. Міфи про частоту постингу. Потрібне обладнання для ведення блогу на різний бюджет. Базові схеми світла.'],
  ['02', 'Чому не працює SMM за невеликий бюджет', 'Сам собі фотограф: автопортрети, самостійні зйомки та селфі. Необхідне обладнання. Позування та психологія поз. Детальний розбір схем світла.'],
  ['03', 'Обробка фото у додатках', 'Практичні техніки ретуші та обробки знімків на мобільних застосунках.'],
  ['04', 'Розмовні відео — як розвивати експертний блог', 'Розкриття себе та експертної теми через відео. Як коригувати різні типи обличчя, створювати ліфтинг-ефект і об\u2019єм за допомогою світла.'],
  ['05', 'Монтаж, який чіпляє підписника', 'Обробка та кольорокорекція розмовних відео.'],
  ['06', 'Сам собі Reels-мейкер', 'Як самостійно створювати трендові та лайфстайл-відео. Чому не потрібно гнатися за трендами, але варто вміти їх робити та відстежувати.'],
  ['07', 'Монтаж, переходи та ключі', 'Робота у додатках для монтажу: переходи, ключові кадри, ефекти.'],
  ['08', 'Сценарії для Reels та побудова шляху клієнта', 'Через серії відео, каруселей та сторіс: прогріви, лід-магніти, прямі та нативні продажі.'],
  ['09', 'Маркетинг соціальних мереж', 'Яку мережу обрати, як вони працюють і як не заплутатися в алгоритмах.'],
  ['10', 'Архетипи брендів', 'Як визначити архетип власного бренду та транслювати його в контенті.'],
  ['11', 'Смачний та змістовний копірайтинг', 'Доповнити візуал текстами, які закохують, розкривають вас не лише з експертного боку та продають.'],
  ['12', 'Кольори бренду. Психологія кольору', 'Як обрати кольорову палітру бренду й використовувати психологію кольору.'],
  ['13', 'Розробка особистої стратегії розвитку та просування', 'Побудова власної стратегії ведення та просування блогу крок за кроком.'],
  ['14', 'Налаштування таргетованої реклами', 'Запуск таргету без зливу бюджету: базові налаштування та аналітика.'],
];

/* ===== Backend integration ===== */
// Адреса бекенду на Render:
const API_BASE = "https://pro-photo-smm.onrender.com";

function apiUrl(p) { return (API_BASE || "") + p; }

// Redirect the browser to LiqPay checkout using the signed data from our server
function goToLiqPay(data, signature) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://www.liqpay.ua/api/3/checkout';
  form.acceptCharset = 'utf-8';
  form.innerHTML =
    `<input type="hidden" name="data" value="${data}">` +
    `<input type="hidden" name="signature" value="${signature}">`;
  document.body.appendChild(form);
  form.submit();
}

/* ===== Build program list (expandable) ===== */
(function buildProgram() {
  const wrap = document.getElementById('proglist');
  if (!wrap) return;
  PROGRAM.forEach(([num, title, body]) => {
    const row = document.createElement('div');
    row.className = 'prog-row';
    row.innerHTML = `
      <button class="prog-head" type="button" aria-expanded="false">
        <div class="prog-index">
          <span class="prog-label">лекція</span>
          <span class="prog-num">${num}</span>
        </div>
        <div class="prog-title">${title}</div>
        <span class="prog-toggle" aria-hidden="true">+</span>
      </button>
      <div class="prog-body"><p>${body}</p></div>`;
    wrap.appendChild(row);

    const head = row.querySelector('.prog-head');
    const bodyEl = row.querySelector('.prog-body');
    head.addEventListener('click', () => {
      const open = row.classList.contains('is-open');
      wrap.querySelectorAll('.prog-row').forEach(r => {
        r.classList.remove('is-open');
        r.querySelector('.prog-body').style.maxHeight = null;
        r.querySelector('.prog-head').setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        row.classList.add('is-open');
        bodyEl.style.maxHeight = bodyEl.scrollHeight + 'px';
        head.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

/* ===== Mobile nav ===== */
(function nav() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('nav');
  if (!burger || !menu) return;
  const toggle = (force) => {
    const open = force !== undefined ? force : !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  };
  burger.addEventListener('click', () => toggle());
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
})();

/* ===== Modal ===== */
(function modal() {
  const modal = document.getElementById('modal');
  if (!modal) return;
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSubtitle');
  const orderEl = document.getElementById('modalOrder');
  const orderPkg = document.getElementById('orderPkg');
  const orderPrice = document.getElementById('orderPrice');

  const open = (type, data = {}) => {
    orderEl.hidden = true;
    modal.dataset.type = type;
    modal.dataset.pkg = data.pkg || '';
    modal.dataset.amount = (data.price || '').replace(/[^\d]/g, '');
    if (type === 'order') {
      titleEl.textContent = 'Оформлення замовлення';
      subEl.textContent = 'Залиште свої контакти для оформлення покупки — ми зв\u2019яжемося з вами.';
      orderEl.hidden = false;
      orderPkg.textContent = data.pkg || '';
      orderPrice.textContent = data.price || '';
    } else if (type === 'lead') {
      titleEl.textContent = 'Записатися на курс';
      subEl.textContent = 'Заповніть форму — ми зв\u2019яжемося з вами та підкажемо найкраще рішення.';
    } else {
      titleEl.textContent = 'Зв\u2019язатися з нами';
      subEl.textContent = 'Залиште свої контакти — ми зв\u2019яжемося з вами та підкажемо найкраще рішення.';
    }
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      open(btn.dataset.modalOpen, { pkg: btn.dataset.pkg, price: btn.dataset.price });
    });
  });
  modal.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
})();

/* ===== Forms → backend ===== */
(function forms() {
  document.querySelectorAll('.lead-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const success = form.querySelector('.lead-form__success');
      const fd = new FormData(form);
      const btn = form.querySelector('button[type="submit"], button:not([type])');

      const modal = form.closest('.modal');
      const type = modal ? modal.dataset.type : (form.id === 'leadForm' ? 'lead' : 'contact');
      const pkg = modal ? (modal.dataset.pkg || '') : '';
      const amount = modal ? Number(modal.dataset.amount || 0) : 0;

      const payload = {
        name: fd.get('name') || '',
        phone: fd.get('phone') || '',
        email: fd.get('email') || '',
        message: fd.get('message') || '',
        package: pkg,
        amount: amount,
        source: type || 'lead',
      };

      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Надсилаємо…'; }

      try {
        if (type === 'order' && amount > 0) {
          const r = await fetch(apiUrl('/api/pay'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const j = await r.json();
          if (j.ok && j.data && j.signature) {
            goToLiqPay(j.data, j.signature);
            return;
          }
          throw new Error(j.error || 'Помилка оплати');
        }

        const r = await fetch(apiUrl('/api/lead'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'Помилка');

        form.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
        if (btn) btn.style.display = 'none';
        if (success) success.hidden = false;
      } catch (err) {
        alert('Не вдалося надіслати заявку: ' + err.message + '\nСпробуйте ще раз або зателефонуйте нам.');
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Надіслати'; }
      }
    });
  });
})();

/* ===== Header shadow on scroll ===== */
window.addEventListener('scroll', () => {
  const h = document.querySelector('.header');
  if (h) h.style.boxShadow = window.scrollY > 10 ? '0 8px 30px rgba(0,0,0,.4)' : 'none';
});
