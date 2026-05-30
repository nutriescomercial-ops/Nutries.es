const filters = document.querySelectorAll('.filter');
const cards = document.querySelectorAll('.product-card');
const menuToggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const slides = document.querySelectorAll('.banner-slide');
const dots = document.querySelectorAll('.banner-dot');
const searchInput = document.querySelector('#siteSearch');
const resultCount = document.querySelector('.result-count');
const emptyState = document.querySelector('.empty-state');
const categoryLinks = document.querySelectorAll('[data-filter-link]');
const cartButton = document.querySelector('.cart-button');
const cartDrawer = document.querySelector('.cart-drawer');
const cartClose = document.querySelector('.cart-close');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const cartTotal = document.querySelector('.cart-total');
const cartWhatsapp = document.querySelector('.cart-whatsapp');
const contactForm = document.querySelector('.contact-form');
const whatsappNumber = '5527999047362';

let currentSlide = 0;
let sliderTimer;
let activeFilter = 'all';
const cart = new Map();

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

if (menuToggle && menu) {
  menuToggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function applyCatalogFilters() {
  const query = normalize(searchInput?.value.trim() || '');
  let visible = 0;

  cards.forEach((card) => {
    const category = card.dataset.category;
    const searchable = normalize([
      card.dataset.name,
      card.dataset.tags,
      card.textContent
    ].join(' '));
    const matchesFilter = activeFilter === 'all' || category === activeFilter;
    const matchesQuery = !query || searchable.includes(query);
    const show = matchesFilter && matchesQuery;

    card.classList.toggle('is-hidden', !show);
    if (show) visible += 1;
  });

  if (resultCount) {
    resultCount.textContent = `${visible} ${visible === 1 ? 'produto' : 'produtos'}`;
  }

  if (emptyState) {
    emptyState.hidden = visible !== 0;
  }
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    activeFilter = button.dataset.filter;
    applyCatalogFilters();
  });
});

categoryLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const target = link.dataset.filterLink;
    const filterButton = document.querySelector(`.filter[data-filter="${target}"]`);
    if (filterButton) {
      filterButton.click();
    }
  });
});

if (searchInput) {
  searchInput.addEventListener('input', applyCatalogFilters);
}

function setSlide(index) {
  currentSlide = index;
  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
  dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
}

function startSlider() {
  if (!slides.length) return;
  sliderTimer = setInterval(() => {
    const next = (currentSlide + 1) % slides.length;
    setSlide(next);
  }, 3800);
}

dots.forEach((dot) => {
  dot.addEventListener('click', () => {
    const index = Number(dot.dataset.slide);
    setSlide(index);
    clearInterval(sliderTimer);
    startSlider();
  });
});

function productFromCard(card) {
  return {
    id: card.dataset.name,
    name: card.dataset.name,
    price: Number(card.dataset.price),
    image: card.querySelector('img')?.getAttribute('src') || ''
  };
}

function openCart() {
  cartDrawer?.classList.add('is-open');
  cartDrawer?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-open');
}

function closeCart() {
  cartDrawer?.classList.remove('is-open');
  cartDrawer?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cart-open');
}

function updateWhatsappLink() {
  if (!cartWhatsapp) return;

  if (!cart.size) {
    cartWhatsapp.href = `https://wa.me/${whatsappNumber}`;
    return;
  }

  const lines = Array.from(cart.values()).map((item) => (
    `- ${item.quantity}x ${item.name} (${money.format(item.price)} cada)`
  ));
  const total = Array.from(cart.values()).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const message = [
    'Ola, NutriES. Quero uma cotacao dos produtos abaixo:',
    ...lines,
    `Subtotal estimado: ${money.format(total)}`
  ].join('\n');

  cartWhatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function renderCart() {
  if (!cartItems || !cartCount || !cartTotal) return;

  const items = Array.from(cart.values());
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = String(quantity);
  cartTotal.textContent = money.format(total);

  if (!items.length) {
    cartItems.innerHTML = '<p class="cart-empty">Seu carrinho esta vazio.</p>';
    updateWhatsappLink();
    return;
  }

  cartItems.innerHTML = items.map((item) => `
    <article class="cart-item">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <span>${money.format(item.price)} cada</span>
      </div>
      <div class="qty-controls" aria-label="Quantidade de ${item.name}">
        <button type="button" data-cart-action="decrease" data-id="${item.id}" aria-label="Diminuir quantidade">-</button>
        <strong>${item.quantity}</strong>
        <button type="button" data-cart-action="increase" data-id="${item.id}" aria-label="Aumentar quantidade">+</button>
      </div>
    </article>
  `).join('');

  updateWhatsappLink();
}

cards.forEach((card) => {
  const addButton = card.querySelector('.add-cart');
  addButton?.addEventListener('click', () => {
    const product = productFromCard(card);
    const existing = cart.get(product.id);
    cart.set(product.id, {
      ...product,
      quantity: existing ? existing.quantity + 1 : 1
    });
    renderCart();
    openCart();
  });
});

cartItems?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cart-action]');
  if (!button) return;

  const id = button.dataset.id;
  const item = cart.get(id);
  if (!item) return;

  if (button.dataset.cartAction === 'increase') {
    item.quantity += 1;
  } else {
    item.quantity -= 1;
  }

  if (item.quantity <= 0) {
    cart.delete(id);
  } else {
    cart.set(id, item);
  }

  renderCart();
});

cartButton?.addEventListener('click', openCart);
cartClose?.addEventListener('click', closeCart);
cartDrawer?.addEventListener('click', (event) => {
  if (event.target === cartDrawer) closeCart();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCart();
});

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const message = [
    'Ola, NutriES. Vim pelo site e gostaria de atendimento comercial.',
    `Nome: ${formData.get('nome')}`,
    `Farmacia/Empresa: ${formData.get('empresa')}`,
    `Telefone: ${formData.get('telefone')}`,
    `Mensagem: ${formData.get('mensagem') || 'Nao informada'}`
  ].join('\n');

  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});

if (slides.length) {
  setSlide(0);
  startSlider();
}

applyCatalogFilters();
renderCart();
