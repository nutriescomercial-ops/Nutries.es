(function () {
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeUrl(value, image = false) {
    if (image && /^\/assets\/[a-zA-Z0-9._-]+$/.test(value)) return value;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function finalPrice(product) {
    const price = Number(product.price), value = Number(product.offer_value);
    return Math.round((product.offer_type === 'percent' ? price * (1 - value / 100) : product.offer_type === 'fixed' ? price - value : price) * 100) / 100;
  }
  async function client() {
    const response = await fetch('/api/config', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Nao foi possivel carregar a configuracao.');
    const config = await response.json();
    if (!config.configured) return null;
    if (!window.supabase) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/supabase.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Servico de autenticacao indisponivel.'));
      document.head.append(script);
    });
    return window.supabase.createClient(config.url, config.key);
  }
  function card(product) {
    const price = finalPrice(product);
    const image = safeUrl(product.image_url, true), checkout = safeUrl(product.checkout_url);
    const categories = { vitaminas:'Vitaminas', suplementos:'Suplementos', naturais:'Naturais' };
    return `<article class="product-card" data-id="${escape(product.id)}" data-category="${escape(product.category)}" data-name="${escape(product.name)}" data-price="${price}" data-tags="${escape(product.description)}">
      ${product.offer_type !== 'none' ? `<span class="product-badge">${escape(product.offer_label || 'Oferta')}</span>` : ''}
      <img src="${escape(image)}" alt="${escape(product.name)}" loading="lazy" />
      <div class="product-info"><p class="product-category">${categories[product.category] || ''}</p><h3>${escape(product.name)}</h3><p>${escape(product.description)}</p>
      ${product.offer_type !== 'none' ? `<del>${currency.format(product.price)}</del>` : ''}<strong class="price">${currency.format(price)}</strong></div>
      <div class="product-actions"><button class="add-cart" type="button">Adicionar</button>${checkout ? `<a href="${escape(checkout)}" target="_blank" rel="noopener noreferrer">Comprar</a>` : `<a href="https://wa.me/5527999047362" target="_blank" rel="noopener noreferrer">Consultar</a>`}</div></article>`;
  }
  window.NutriesCatalog = { client, card, escape, safeUrl, finalPrice };
  window.nutriesCatalogReady = (async () => {
    if (!document.querySelector('.products-grid')) return;
    try {
      const db = await client();
      if (!db) return;
      const { data, error } = await db.from('products').select('*').eq('published', true).order('position').order('created_at');
      if (error) throw error;
      document.querySelector('.products-grid').innerHTML = data.map(card).join('');
    } catch (error) {
      console.warn('Catalogo online indisponivel; preservando o catalogo atual.', error.message);
      const status = document.createElement('p');
      status.className = 'catalog-warning';
      status.textContent = 'Catalogo temporariamente indisponivel. Confirme precos e disponibilidade pelo WhatsApp.';
      document.querySelector('.products-grid').before(status);
    }
  })();
})();
