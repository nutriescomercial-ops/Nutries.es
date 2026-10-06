(async function () {
  const { client, escape, safeUrl, finalPrice } = window.NutriesCatalog;
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
  const form = $('productForm');
  let db, products = [], authorized = false, uploadFile = null, previewUrl = null, dirty = false, saving = false;
  function icons() { window.lucide?.createIcons(); }
  function status(message, error = false, target = 'status') { $(target).textContent = message; $(target).classList.toggle('error', error); }
  function lock() { authorized = false; $('dashboard').hidden = true; $('login').hidden = false; $('editor').close(); products = []; }
  function renderList() {
    const query = $('adminSearch').value.trim().toLocaleLowerCase('pt-BR');
    const filtered = products.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(query));
    $('productCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`;
    $('productList').innerHTML = filtered.length ? filtered.map(p => `<article class="product-row"><img src="${escape(safeUrl(p.image_url,true))}" alt="${escape(p.name)}" /><div><strong>${escape(p.name)}</strong><small>${escape(p.category)}</small></div><div class="price-cell">${p.offer_type !== 'none' ? `<del>${money.format(p.price)}</del>` : ''}<strong>${money.format(finalPrice(p))}</strong></div><span class="state ${p.published ? '' : 'draft'}">${p.published ? 'Publicado' : 'Rascunho'}</span><button class="secondary" type="button" data-edit="${escape(p.id)}"><i data-lucide="pencil"></i> Editar</button></article>`).join('') : '<p class="empty-list">Nenhum produto encontrado.</p>';
    icons();
  }
  async function loadProducts() {
    const { data, error } = await db.from('products').select('*').order('position').order('created_at');
    if (error) throw error;
    products = data; renderList();
  }
  async function loadOwners() {
    const { data, error } = await db.from('store_owners').select('email').order('created_at');
    if (error) throw error;
    $('ownerList').innerHTML = data.map(o => `<li>${escape(o.email)}</li>`).join('');
  }
  async function authenticate() {
    lock(); status('Verificando acesso...');
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) { status('Entre com um e-mail autorizado.'); return; }
    const { data: owners, error: ownerError } = await db.from('store_owners').select('email').eq('email', data.user.email.toLowerCase());
    if (ownerError) { status('Nao foi possivel verificar as permissoes. Tente recarregar.',true); return; }
    if (!owners?.length) { await db.auth.signOut(); status('Este e-mail nao esta autorizado a administrar a loja.',true); return; }
    authorized = true; $('login').hidden = true; $('dashboard').hidden = false; $('account').textContent = data.user.email;
    try { await loadProducts(); await loadOwners(); status(''); } catch { lock(); status('Nao foi possivel carregar a administracao. Tente recarregar.',true); }
  }
  function clearPreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; }
  function showPhoto(url) { $('photoPreview').hidden = !url; $('photoPreview').src = url || ''; }
  function updateOffer() {
    form.elements.offer_value.disabled = form.elements.offer_type.value === 'none';
    const p = Object.fromEntries(new FormData(form));
    if (p.offer_type === 'none') form.elements.offer_value.value = 0;
    const result = finalPrice(p);
    $('offerPreview').textContent = Number(p.price) > 0 && result > 0 ? `Preco de venda: ${money.format(result)}` : '';
  }
  function edit(product = null) {
    if (!authorized) return;
    form.reset(); clearPreview(); uploadFile = null; $('photoFile').value = ''; dirty = false; status('', false, 'editorStatus');
    for (const [key,value] of Object.entries(product || {})) {
      if (!form.elements[key]) continue;
      if (key === 'published') form.elements[key].checked = value; else form.elements[key].value = value;
    }
    $('editorTitle').textContent = product ? 'Editar produto' : 'Novo produto';
    showPhoto(safeUrl(product?.image_url || '',true)); updateOffer(); $('editor').showModal();
  }
  function closeEditor() {
    if (saving) return;
    if (dirty && !confirm('Descartar as alteracoes nao salvas?')) return;
    $('editor').close(); clearPreview();
  }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try {
      const email = new FormData(event.target).get('email').trim().toLowerCase();
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/admin`, shouldCreateUser:true } });
      if (error) throw error;
      status('Verifique seu e-mail para concluir o acesso.');
    } catch { status('Nao foi possivel enviar o link. Aguarde um minuto e tente novamente.',true); }
    finally { button.disabled = false; }
  });
  $('logout').addEventListener('click', async () => { const { error } = await db.auth.signOut(); if (error) { status('Nao foi possivel sair. Tente novamente.',true); return; } lock(); status('Sessao encerrada.'); });
  $('newProduct').addEventListener('click', () => edit());
  $('adminSearch').addEventListener('input', renderList);
  $('productList').addEventListener('click', event => { const button = event.target.closest('[data-edit]'); if (button) edit(products.find(p => p.id === button.dataset.edit)); });
  ['closeEditor','cancelEditor'].forEach(id => $(id).addEventListener('click',closeEditor));
  $('editor').addEventListener('cancel',event => { event.preventDefault(); closeEditor(); });
  form.addEventListener('input',() => { dirty = true; updateOffer(); });
  form.elements.image_url.addEventListener('change', () => { if (!uploadFile) showPhoto(safeUrl(form.elements.image_url.value,true)); });
  $('photoFile').addEventListener('change', () => {
    clearPreview(); uploadFile = null;
    const file = $('photoFile').files[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5242880) { $('photoFile').value = ''; status('Use JPG, PNG ou WebP de ate 5 MB.',true,'editorStatus'); return; }
    uploadFile = file; dirty = true; previewUrl = URL.createObjectURL(file); showPhoto(previewUrl); status('',false,'editorStatus');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!authorized || saving) return;
    const values = Object.fromEntries(new FormData(form));
    const p = { name:values.name.trim(), description:values.description.trim(), category:values.category, price:Number(values.price), offer_type:values.offer_type, offer_value:values.offer_type === 'none' ? 0 : Number(values.offer_value), offer_label:values.offer_label.trim(), image_url:safeUrl(values.image_url,true), checkout_url:safeUrl(values.checkout_url.trim()), published:form.elements.published.checked, position:Number(values.position) };
    if (values.checkout_url && !p.checkout_url) { status('O checkout precisa ser um link HTTPS publico valido.',true,'editorStatus'); return; }
    if (p.offer_type !== 'none' && (!(p.offer_value > 0) || (p.offer_type === 'percent' && p.offer_value >= 100) || (p.offer_type === 'fixed' && p.offer_value >= p.price) || finalPrice(p) < 0.01)) { status('O desconto deve ser positivo e menor que o preco total.',true,'editorStatus'); return; }
    if (!p.image_url && !uploadFile) { status('Adicione a foto do produto.',true,'editorStatus'); return; }
    if (p.checkout_url && /(^|\.)bling\.com\.br$/.test(new URL(p.checkout_url).hostname)) { status('Use o link publico da loja/produto, nao uma pagina interna do ERP Bling.',true,'editorStatus'); return; }
    saving = true; $('saveProduct').disabled = true; status('Salvando...',false,'editorStatus');
    let uploadedPath, saved = false;
    try {
      if (uploadFile) {
        const ext = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[uploadFile.type];
        uploadedPath = `${crypto.randomUUID()}.${ext}`;
        const { error } = await db.storage.from('product-images').upload(uploadedPath,uploadFile,{upsert:false,contentType:uploadFile.type});
        if (error) throw error;
        p.image_url = db.storage.from('product-images').getPublicUrl(uploadedPath).data.publicUrl;
      }
      let result;
      if (values.id) result = await db.from('products').update(p).eq('id',values.id).eq('updated_at',values.updated_at).select('id');
      else result = await db.from('products').insert(p).select('id');
      if (result.error) throw result.error;
      if (!result.data.length) throw new Error('Outra pessoa alterou o produto. Feche o editor e recarregue antes de salvar.');
      uploadedPath = null; saved = true; dirty = false; $('editor').close(); clearPreview();
      await loadProducts(); status('Produto salvo.');
    } catch (error) {
      if (uploadedPath) await db.storage.from('product-images').remove([uploadedPath]);
      if (saved) status('Produto salvo, mas a lista nao atualizou. Recarregue a pagina.',true);
      else status(error.message?.startsWith('Outra pessoa') ? error.message : 'Nao foi possivel salvar. Confira sua conexao e tente novamente.',true,'editorStatus');
    } finally { saving = false; $('saveProduct').disabled = false; }
  });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',() => {
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
    $('productsPanel').hidden = button.dataset.tab !== 'products'; $('ownersPanel').hidden = button.dataset.tab !== 'owners';
  }));
  $('ownerForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!authorized) return;
    const email = new FormData(event.target).get('email').trim().toLowerCase();
    if (!confirm(`Autorizar ${email} a alterar produtos, ofertas, fotos e proprietarios da NutriES?`)) return;
    event.submitter.disabled = true;
    try { const { error } = await db.from('store_owners').insert({email}); if (error) throw error; await loadOwners(); event.target.reset(); status('Proprietario autorizado.'); }
    catch { status('Nao foi possivel autorizar. Confira se o e-mail ja esta na lista.',true); }
    finally { event.submitter.disabled = false; }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  icons();
  try {
    db = await client();
    if (!db) { status('Area administrativa em configuracao. O acesso ainda nao foi ativado.',true); return; }
    await authenticate();
    db.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { lock(); status('Sessao encerrada.'); } });
  } catch { status('Servico temporariamente indisponivel. Tente recarregar.',true); }
})();
