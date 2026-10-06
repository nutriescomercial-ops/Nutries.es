const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const config = require('../api/config');

function catalog() {
  const window = {};
  vm.runInNewContext(fs.readFileSync('catalog.js','utf8'), {window,document:{querySelector:()=>null},URL,Intl,AbortSignal});
  return window.NutriesCatalog;
}
test('ofertas em reais, percentual e arredondamento', () => {
  const c = catalog();
  assert.equal(c.finalPrice({price:100,offer_type:'percent',offer_value:25}),75);
  assert.equal(c.finalPrice({price:100,offer_type:'fixed',offer_value:12.5}),87.5);
  assert.equal(c.finalPrice({price:29.9,offer_type:'none',offer_value:0}),29.9);
  assert.equal(c.finalPrice({price:29.9,offer_type:'percent',offer_value:10}),26.91);
});
test('catalogo escapa campos e bloqueia URLs executaveis', () => {
  const c = catalog();
  assert.equal(c.safeUrl('javascript:alert(1)'), '');
  assert.equal(c.safeUrl('https://user:secret@example.com'), '');
  assert.equal(c.safeUrl('/assets/photo.jpeg',true), '/assets/photo.jpeg');
  assert.equal(c.safeUrl('//evil.example/image',true),'');
  const html = c.card({id:'x',name:'<img onerror="x">',description:'<script>x</script>',image_url:'javascript:x',checkout_url:'javascript:x',category:'naturais',price:10,offer_type:'none'});
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('&lt;img'));
});
test('configuracao nunca publica service_role ou secret', () => {
  const old = {...process.env};
  process.env.SUPABASE_URL='https://example.supabase.co';
  const response = () => { let value; config({}, {setHeader(){},status(){return this;},json(v){value=v;}}); return value; };
  process.env.SUPABASE_ANON_KEY='sb_secret_123'; assert.equal(response().configured,false);
  process.env.SUPABASE_ANON_KEY='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x'; assert.equal(response().key,'');
  process.env.SUPABASE_ANON_KEY='sb_publishable_123'; assert.equal(response().configured,true);
  process.env.SUPABASE_URL='http://evil.example'; assert.equal(response().configured,false);
  process.env=old;
});

async function admin(owner = true, configured = true) {
  const dom = new JSDOM(fs.readFileSync('admin.html','utf8'), {url:'https://nutries-es.com.br/admin',runScripts:'outside-only'});
  const w = dom.window;
  const rows = [{id:'p1',name:'Produto de teste',description:'Produto',category:'naturais',price:100,offer_type:'none',offer_value:0,offer_label:'',image_url:'/assets/produto-vendas-1.jpeg',checkout_url:'',published:true,position:1,updated_at:'2026-10-06T00:00:00Z'}];
  let writes=0;
  const db = { auth:{getUser:async()=>({data:{user:{email:'nutriescomercial@gmail.com'}}}),signOut:async()=>({}),onAuthStateChange(){},signInWithOtp:async()=>({})},from(table) {
    let action='select', payload, clauses=[];
    const q={select(){return q;},order(){return q;},eq(k,v){clauses.push([k,v]);return q;},insert(p){action='insert';payload=p;return q;},update(p){action='update';payload=p;return q;},then(resolve,reject) {
      let data;
      if (action==='select') data = table === 'store_owners' ? (owner ? [{email:'nutriescomercial@gmail.com'}] : []) : rows;
      else { writes++; if(!owner)return Promise.resolve({error:{message:'RLS'}}).then(resolve,reject); const id=clauses.find(([k])=>k==='id')?.[1]; if(action==='insert'){rows.push({...payload,id:'p2',updated_at:'now'});data=[{id:'p2'}];}else{Object.assign(rows.find(p=>p.id===id),payload);data=[{id}];} }
      return Promise.resolve({data,error:null}).then(resolve,reject);
    }}; return q;
  }};
  w.lucide={createIcons(){}};
  w.confirm=()=>true;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.eval(fs.readFileSync('catalog.js','utf8'));
  w.NutriesCatalog.client=async()=>configured ? db : null;
  w.eval(fs.readFileSync('admin.js','utf8'));
  await new Promise(resolve=>setTimeout(resolve,30));
  return {w,rows,get writes(){return writes;}};
}
test('sem banco, painel bloqueado sem login de mentira', async () => {
  const {w} = await admin(true,false);
  assert.equal(w.document.getElementById('dashboard').hidden,true);
  assert.equal(w.document.getElementById('login').hidden,true);
  assert.match(w.document.getElementById('status').textContent,/nao foi ativado/);
  w.close();
});
test('usuario confirmado nao proprietario nao acessa editor',async()=>{
  const {w}=await admin(false);
  assert.equal(w.document.getElementById('dashboard').hidden,true);
  assert.match(w.document.getElementById('status').textContent,/nao esta autorizado/);
  w.document.getElementById('newProduct').click();
  assert.equal(w.document.getElementById('editor').open,false);
  w.close();
});
test('proprietario edita oferta, salva e filtra produtos',async()=>{
  const a=await admin(); const {w}=a; const d=w.document;
  assert.equal(d.getElementById('dashboard').hidden,false);
  d.querySelector('[data-edit]').click();
  const f=d.getElementById('productForm');
  f.elements.offer_type.value='percent';f.elements.offer_value.value='20';
  f.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.match(d.getElementById('offerPreview').textContent,/80,00/);
  f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(a.rows[0].offer_value,20);assert.equal(a.writes,1);
  assert.equal(d.getElementById('editor').open,false);
  d.getElementById('adminSearch').value='inexistente';d.getElementById('adminSearch').dispatchEvent(new w.Event('input'));
  assert.match(d.getElementById('productList').textContent,/Nenhum/);
  w.close();
});
test('editor rejeita desconto excessivo e painel interno do ERP',async()=>{
  const a=await admin();const d=a.w.document;d.querySelector('[data-edit]').click();const f=d.getElementById('productForm');
  f.elements.offer_type.value='fixed';f.elements.offer_value.value='101';
  f.dispatchEvent(new a.w.Event('submit',{cancelable:true}));
  assert.match(d.getElementById('editorStatus').textContent,/desconto/);
  f.elements.offer_type.value='none';f.elements.checkout_url.value='https://www.bling.com.br/inicio#/';
  f.dispatchEvent(new a.w.Event('submit',{cancelable:true}));
  assert.match(d.getElementById('editorStatus').textContent,/pagina interna/);
  assert.equal(a.writes,0);a.w.close();
});
