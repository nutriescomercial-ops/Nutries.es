// Local-only rendering fixture. Never deployed and never used for real login.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const fixture = `window.supabase={createClient:()=>({
  auth:{getUser:async()=>({data:{user:{email:'nutriescomercial@gmail.com'}}}),onAuthStateChange(){},signOut:async()=>({})},
  from(table){const q={select(){return q;},eq(){return q;},order(){return q;},then(resolve){return Promise.resolve({data:table==='store_owners'?[{email:'nutriescomercial@gmail.com'}]:[
  {id:'preview-product',name:'Coenzima Q10 100mg',description:'Produto de teste visual',category:'suplementos',price:79.9,offer_type:'percent',offer_value:15,offer_label:'Oferta da semana',image_url:'/assets/produto-vendas-2.jpeg',checkout_url:'',published:true,position:1,updated_at:'2026-10-06T00:00:00Z'}],error:null}).then(resolve);}};return q;}
})};`;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({configured:true,url:'https://example.supabase.co',key:'sb_publishable_fixture'}));return;}
  if(url.pathname==='/assets/supabase.min.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture);return;}
  const relative=url.pathname==='/admin'?'admin.html':url.pathname.slice(1);
  if(!['admin.html','admin.css','admin.js','catalog.js','assets/lucide.min.js','assets/logo-oficial.png','assets/produto-vendas-2.jpeg'].includes(relative)){res.writeHead(404);res.end();return;}
  const ext=path.extname(relative);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpeg':'image/jpeg'})[ext]);
  res.end(fs.readFileSync(path.join(root,relative)));
}).listen(3032,'127.0.0.1',()=>console.log('Local UI fixture: http://127.0.0.1:3032/admin'));
