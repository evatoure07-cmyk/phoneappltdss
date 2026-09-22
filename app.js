const C = window.LTD_CONFIG;
const hasSupabase = Boolean(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
const sb = hasSupabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

const demo = {
  user: null,
  profile: null,
  cart: [],
  products: [
    {id:'p1',name:'Eau purifiée',description:'Bouteille fraîche',price:0,category:'Boissons',emoji:'💧',active:true},
    {id:'p2',name:'Sandwich',description:'Article à remplacer avec la carte',price:0,category:'Nourriture',emoji:'🥪',active:true},
    {id:'p3',name:'Café',description:'Article à remplacer avec la carte',price:0,category:'Boissons',emoji:'☕',active:true},
    {id:'p4',name:'Kit pratique',description:'Article à remplacer avec la carte',price:0,category:'Divers',emoji:'🧰',active:true}
  ],
  announcements: [
    {id:'a1',title:'Recrutement ouvert',body:'Les recrutements du LTD ont lieu le dimanche. Présentez-vous motivé(e) et disponible.',type:'recruitment',featured:true,created_at:new Date().toISOString()},
    {id:'a2',title:'Nouveau service de livraison',body:'Commandez depuis votre téléphone RP et suivez votre commande jusqu’à la livraison.',type:'news',featured:false,created_at:new Date().toISOString()}
  ],
  contacts: [
    {id:'c1',label:'Patron',name:'Blake Mars',phone:'À renseigner'},
    {id:'c2',label:'Co-patronne',name:'Luciana Angel Mars',phone:'À renseigner'},
    {id:'c3',label:'LTD Sandy Shores',name:'Accueil',phone:'À renseigner'}
  ],
  orders: JSON.parse(localStorage.getItem('ltd_demo_orders')||'[]')
};

const $ = s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function money(v){return `${Number(v||0).toLocaleString('fr-FR')} $`}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2200)}
function iconRefresh(){if(window.lucide) lucide.createIcons()}
function openModal(html){$('#modalContent').innerHTML=html;$('#modalBackdrop').classList.remove('hidden');iconRefresh()}
function closeModal(){ $('#modalBackdrop').classList.add('hidden') }
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});

async function getCurrentProfile(){
  if(!hasSupabase) return demo.profile;
  const {data:{user}}=await sb.auth.getUser(); if(!user) return null;
  const {data}=await sb.from('profiles').select('*').eq('id',user.id).single();
  demo.user=user; demo.profile=data; return data;
}

async function getProducts(){ if(!hasSupabase)return demo.products; const {data,error}=await sb.from('products').select('*').eq('active',true).order('category').order('name'); if(error){console.error(error);return []} return data||[] }
async function getAnnouncements(){ if(!hasSupabase)return demo.announcements; const {data}=await sb.from('announcements').select('*').eq('active',true).order('created_at',{ascending:false}); return data||[] }
async function getContacts(){ if(!hasSupabase)return demo.contacts; const {data}=await sb.from('contacts').select('*').eq('active',true).order('sort_order'); return data||[] }

function nav(name){
  $$('.view').forEach(v=>v.classList.remove('active')); $(`#${name}View`)?.classList.add('active');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='shop')renderShop(); if(name==='orders')renderOrders(); if(name==='news')renderNews(); if(name==='staff')renderStaff(); if(name==='admin')renderAdmin();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{const n=e.target.closest('[data-nav]'); if(n)nav(n.dataset.nav)});

async function renderHome(){
  const anns=await getAnnouncements(); const contacts=await getContacts();
  $('#homeAnnouncements').innerHTML=(anns.slice(0,3).map(a=>announcementHTML(a)).join('')||'<div class="empty">Aucune annonce.</div>');
  $('#contactsList').innerHTML=contacts.map(c=>`<article class="contact-card"><span>${c.label}</span><strong>${c.name}</strong><a href="tel:${c.phone}">${c.phone}</a></article>`).join('');
  iconRefresh();
}
function announcementHTML(a){return `<article class="announcement ${a.featured?'featured':''}"><div class="meta"><span>${a.type==='recruitment'?'RECRUTEMENT':'ACTUALITÉ'}</span><span>${new Date(a.created_at).toLocaleDateString('fr-FR')}</span></div><h4>${a.title}</h4><p>${a.body}</p></article>`}
async function renderNews(){const anns=await getAnnouncements();$('#newsList').innerHTML=anns.map(announcementHTML).join('')||'<div class="empty">Aucune annonce.</div>';iconRefresh()}

let activeCategory='Tous';
async function renderShop(){
  const all=await getProducts(); demo.products=all; const cats=['Tous',...new Set(all.map(p=>p.category))];
  $('#categoryChips').innerHTML=cats.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');
  const q=($('#productSearch').value||'').toLowerCase(); const list=all.filter(p=>(activeCategory==='Tous'||p.category===activeCategory)&&(p.name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)));
  $('#productGrid').innerHTML=list.map(p=>`<article class="product-card"><div class="product-visual">${p.emoji||'🛒'}</div><h4>${p.name}</h4><p>${p.description||''}</p><div class="product-foot"><strong>${money(p.price)}</strong><button class="add-btn" data-add="${p.id}">+</button></div></article>`).join('')||'<div class="empty">Aucun article.</div>';
  updateCartCount(); iconRefresh();
}
$('#productSearch').addEventListener('input',renderShop);
document.addEventListener('click',e=>{const c=e.target.closest('[data-cat]'); if(c){activeCategory=c.dataset.cat;renderShop()} const a=e.target.closest('[data-add]');if(a)addToCart(a.dataset.add)});
function addToCart(id){const p=demo.products.find(x=>String(x.id)===String(id));if(!p)return;const row=demo.cart.find(x=>String(x.id)===String(id));row?row.qty++:demo.cart.push({...p,qty:1});updateCartCount();toast(`${p.name} ajouté`)}
function updateCartCount(){ $('#cartCount').textContent=demo.cart.reduce((a,b)=>a+b.qty,0) }
$('#cartButton').addEventListener('click',showCart);
function showCart(){
  if(!demo.cart.length)return openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Votre panier</h3><div class="empty">Le panier est vide.</div>`);
  const subtotal=demo.cart.reduce((a,b)=>a+b.price*b.qty,0); const pts=demo.profile?.loyalty_points||0; const eligible=pts>=C.LOYALTY_REWARD_POINTS;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Votre panier</h3><div>${demo.cart.map(x=>`<div class="cart-row"><div><strong>${x.name}</strong><div class="eyebrow">${money(x.price)}</div></div><div class="qty-controls"><button onclick="changeQty('${x.id}',-1)">−</button><span>${x.qty}</span><button onclick="changeQty('${x.id}',1)">+</button></div><strong>${money(x.price*x.qty)}</strong></div>`).join('')}</div><div class="loyalty-box"><strong>${pts} points fidélité</strong><div>À ${C.LOYALTY_REWARD_POINTS} points : livraison offerte.</div><div class="loyalty-progress"><span style="width:${Math.min(100,(pts/C.LOYALTY_REWARD_POINTS)*100)}%"></span></div></div><div class="form-group"><label>Lieu de livraison RP</label><input id="deliveryAddress" placeholder="Ex : parking Maze Bank, domicile, entreprise…"></div><div class="form-group"><label>Note pour le livreur</label><textarea id="orderNote" placeholder="Précisions facultatives"></textarea></div>${eligible?`<label style="display:flex;gap:9px;align-items:center"><input type="checkbox" id="redeemPoints"> Utiliser 100 points pour offrir la livraison</label>`:''}<div class="totals"><div class="total-line"><span>Sous-total</span><strong>${money(subtotal)}</strong></div><div class="total-line"><span>Livraison</span><strong id="deliveryPrice">${money(C.DELIVERY_FEE)}</strong></div><div class="total-line grand"><span>Total</span><strong id="grandTotal">${money(subtotal+C.DELIVERY_FEE)}</strong></div></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Continuer</button><button class="btn primary" onclick="checkout()">Valider la commande</button></div>`);
  $('#redeemPoints')?.addEventListener('change',e=>{const fee=e.target.checked?0:C.DELIVERY_FEE;$('#deliveryPrice').textContent=money(fee);$('#grandTotal').textContent=money(subtotal+fee)});
}
window.changeQty=(id,d)=>{const r=demo.cart.find(x=>String(x.id)===String(id)); if(!r)return;r.qty+=d;if(r.qty<=0)demo.cart=demo.cart.filter(x=>String(x.id)!==String(id));updateCartCount();showCart()}
window.checkout=async()=>{
  const address=$('#deliveryAddress').value.trim(); if(!address)return toast('Indique un lieu de livraison.');
  if(!demo.profile)return showAuth('signup');
  const subtotal=demo.cart.reduce((a,b)=>a+b.price*b.qty,0); const redeem=Boolean($('#redeemPoints')?.checked); const fee=redeem?0:C.DELIVERY_FEE;
  const payload={user_id:demo.profile.id,customer_name:demo.profile.display_name||'Client',delivery_address:address,note:$('#orderNote').value.trim(),subtotal,delivery_fee:fee,total:subtotal+fee,status:'pending',used_loyalty_reward:redeem,loyalty_awarded:false};
  if(hasSupabase){
    const {data:o,error}=await sb.from('orders').insert(payload).select().single(); if(error)return toast('Erreur commande.');
    const items=demo.cart.map(x=>({order_id:o.id,product_id:x.id,product_name:x.name,unit_price:x.price,quantity:x.qty,line_total:x.price*x.qty})); await sb.from('order_items').insert(items);
    if(redeem) await getCurrentProfile(); // le retrait des points est géré côté base
  }else{
    const o={...payload,id:'D'+Date.now(),created_at:new Date().toISOString(),items:demo.cart}; demo.orders.unshift(o);localStorage.setItem('ltd_demo_orders',JSON.stringify(demo.orders));
    if(redeem)demo.profile.loyalty_points=Math.max(0,(demo.profile.loyalty_points||0)-100);
  }
  demo.cart=[];updateCartCount();closeModal();toast('Commande envoyée au LTD !');nav('orders');
}

async function renderOrders(){
  if(!demo.profile){$('#ordersList').innerHTML=`<div class="empty">Connectez-vous pour voir vos commandes.<br><br><button class="btn primary" onclick="showAuth('login')">Se connecter</button></div>`;return}
  let orders=[]; if(hasSupabase){const {data}=await sb.from('orders').select('*,order_items(*)').eq('user_id',demo.profile.id).order('created_at',{ascending:false});orders=data||[]} else orders=demo.orders.filter(o=>o.user_id===demo.profile.id);
  $('#ordersList').innerHTML=orders.map(orderHTML).join('')||'<div class="empty">Aucune commande pour le moment.</div>';iconRefresh()
}
function statusLabel(s){return ({pending:'En attente',accepted:'Acceptée',preparing:'Préparation',out_for_delivery:'En livraison',delivered:'Livrée',cancelled:'Annulée'})[s]||s}
function orderHTML(o,staff=false){return `<article class="order-card"><div class="meta"><span>#${String(o.id).slice(-6).toUpperCase()}</span><span>${new Date(o.created_at).toLocaleString('fr-FR')}</span></div><h4>${o.customer_name||'Client'} • ${money(o.total)}</h4><p>${o.delivery_address}</p><div style="margin-top:10px"><span class="status ${o.status}">${statusLabel(o.status)}</span></div>${staff?staffActions(o):''}</article>`}
function staffActions(o){const statuses=['accepted','preparing','out_for_delivery','delivered','cancelled'];return `<div class="order-actions">${statuses.filter(s=>s!==o.status).map(s=>`<button onclick="setOrderStatus('${o.id}','${s}')">${statusLabel(s)}</button>`).join('')}</div>`}

async function renderStaff(filter='active'){
  if(!demo.profile||!['employee','admin'].includes(demo.profile.role)){ $('#staffOrders').innerHTML='<div class="empty">Accès employé requis.</div>';return }
  let orders=[];if(hasSupabase){let q=sb.from('orders').select('*').order('created_at',{ascending:false});if(filter==='active')q=q.not('status','in','(delivered,cancelled)');const{data}=await q;orders=data||[]}else orders=demo.orders.filter(o=>filter==='all'||!['delivered','cancelled'].includes(o.status));
  $('#staffOrders').innerHTML=orders.map(o=>orderHTML(o,true)).join('')||'<div class="empty">Aucune commande.</div>';iconRefresh()
}
$$('.staff-tab').forEach(b=>b.addEventListener('click',()=>{$$('.staff-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderStaff(b.dataset.filter)}));$('#refreshStaff').addEventListener('click',()=>renderStaff($('.staff-tab.active')?.dataset.filter||'active'));
window.setOrderStatus=async(id,status)=>{
  if(hasSupabase){
    const {data:o}=await sb.from('orders').select('*').eq('id',id).single();
    const upd={status}; if(status==='delivered')upd.delivered_at=new Date().toISOString(); await sb.from('orders').update(upd).eq('id',id);
    // L'attribution des points est gérée automatiquement par un trigger Supabase lors du passage à 'delivered'.
  }else{const o=demo.orders.find(x=>String(x.id)===String(id));if(o){o.status=status;if(status==='delivered'&&!o.loyalty_awarded){o.loyalty_awarded=true; if(demo.profile?.id===o.user_id)demo.profile.loyalty_points=(demo.profile.loyalty_points||0)+C.POINTS_PER_COMPLETED_ORDER}localStorage.setItem('ltd_demo_orders',JSON.stringify(demo.orders))}}
  toast(`Commande : ${statusLabel(status)}`);renderStaff($('.staff-tab.active')?.dataset.filter||'active');
}

function showAuth(mode='login'){
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${mode==='login'?'Connexion':'Créer un compte'}</h3>${mode==='signup'?'<div class="form-group"><label>Nom RP</label><input id="authName" placeholder="Prénom Nom"></div>':''}<div class="form-group"><label>Email</label><input id="authEmail" type="email" placeholder="vous@exemple.com"></div><div class="form-group"><label>Mot de passe</label><input id="authPass" type="password" placeholder="••••••••"></div><div class="modal-actions"><button class="btn ghost" onclick="showAuth('${mode==='login'?'signup':'login'}')">${mode==='login'?'Créer un compte':'J’ai déjà un compte'}</button><button class="btn primary" onclick="submitAuth('${mode}')">${mode==='login'?'Se connecter':'Créer'}</button></div>${!hasSupabase?'<p style="color:var(--muted);font-size:11px">Mode démo actif : le compte reste sur cet appareil tant que Supabase n’est pas configuré.</p>':''}`)
}
window.showAuth=showAuth;
window.submitAuth=async mode=>{
  const email=$('#authEmail').value.trim(),pass=$('#authPass').value;if(!email||!pass)return toast('Complète les champs.');
  if(hasSupabase){
    if(mode==='signup'){const name=$('#authName').value.trim()||'Client';const {data,error}=await sb.auth.signUp({email,password:pass,options:{data:{display_name:name}}});if(error)return toast(error.message);toast('Compte créé. Vérifie ton email si demandé.');closeModal();await initAuth()}
    else{const {error}=await sb.auth.signInWithPassword({email,password:pass});if(error)return toast(error.message);closeModal();await initAuth();toast('Connexion réussie')}
  }else{demo.user={id:'demo-user',email};demo.profile={id:'demo-user',display_name:$('#authName')?.value||email.split('@')[0],role:'customer',loyalty_points:0};localStorage.setItem('ltd_demo_profile',JSON.stringify(demo.profile));closeModal();await initAuth();toast('Compte démo actif')}
}
$('#accountBtn').addEventListener('click',async()=>{
  if(!demo.profile)return showAuth('login');
  const isAdmin=demo.profile.role==='admin';
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${demo.profile.display_name||'Mon compte'}</h3><div class="loyalty-box"><strong>${demo.profile.loyalty_points||0} / ${C.LOYALTY_REWARD_POINTS} points</strong><div class="loyalty-progress"><span style="width:${Math.min(100,((demo.profile.loyalty_points||0)/C.LOYALTY_REWARD_POINTS)*100)}%"></span></div></div><p>Rôle : <strong>${demo.profile.role||'customer'}</strong></p>${isAdmin?'<button class="btn primary" style="width:100%;justify-content:center" onclick="closeModal();nav(\'admin\')">Administration</button><br><br>':''}<button class="btn ghost danger" style="width:100%;justify-content:center" onclick="logout()">Se déconnecter</button>`)
});
window.logout=async()=>{if(hasSupabase)await sb.auth.signOut();demo.user=null;demo.profile=null;localStorage.removeItem('ltd_demo_profile');closeModal();await initAuth();toast('Déconnecté')}

async function renderAdmin(){
  if(!demo.profile||demo.profile.role!=='admin')return $('#adminView').innerHTML='<div class="empty">Accès administrateur requis.</div>';
  if(hasSupabase){const{data}=await sb.from('profiles').select('id,display_name,role,loyalty_points').in('role',['employee','admin']).order('display_name');$('#staffUsers').innerHTML=(data||[]).map(u=>`<article class="order-card"><strong>${u.display_name||'Sans nom'}</strong><p>${u.role}</p></article>`).join('')}else $('#staffUsers').innerHTML='<div class="empty">Ajoute Supabase pour gérer plusieurs employés.</div>'; iconRefresh();
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-admin]');if(!a)return;if(a.dataset.admin==='announcement')adminAnnouncement();if(a.dataset.admin==='product')adminProduct();if(a.dataset.admin==='contacts')toast('Gestion des contacts : via Supabase ou à ajouter dans la prochaine version.');if(a.dataset.admin==='settings')toast('Paramètres généraux : modifiables dans config.js.')});
function adminAnnouncement(){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Nouvelle annonce</h3><div class="form-group"><label>Titre</label><input id="annTitle"></div><div class="form-group"><label>Texte</label><textarea id="annBody"></textarea></div><div class="form-group"><label>Type</label><select id="annType"><option value="news">Actualité</option><option value="recruitment">Recrutement</option></select></div><label><input type="checkbox" id="annFeatured"> Mettre à la une</label><div class="modal-actions"><button class="btn primary" onclick="saveAnnouncement()">Publier</button></div>`)}
window.saveAnnouncement=async()=>{const x={title:$('#annTitle').value.trim(),body:$('#annBody').value.trim(),type:$('#annType').value,featured:$('#annFeatured').checked,active:true};if(!x.title||!x.body)return toast('Titre et texte obligatoires.');if(hasSupabase)await sb.from('announcements').insert(x);else demo.announcements.unshift({...x,id:'a'+Date.now(),created_at:new Date().toISOString()});closeModal();renderHome();toast('Annonce publiée')}
function adminProduct(){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Ajouter un produit</h3><div class="form-group"><label>Nom</label><input id="prodName"></div><div class="form-group"><label>Description</label><input id="prodDesc"></div><div class="form-group"><label>Prix</label><input id="prodPrice" type="number"></div><div class="form-group"><label>Catégorie</label><input id="prodCat" placeholder="Boissons, nourriture…"></div><div class="form-group"><label>Emoji / icône</label><input id="prodEmoji" value="🛒"></div><div class="modal-actions"><button class="btn primary" onclick="saveProduct()">Ajouter</button></div>`)}
window.saveProduct=async()=>{const x={name:$('#prodName').value.trim(),description:$('#prodDesc').value.trim(),price:Number($('#prodPrice').value||0),category:$('#prodCat').value.trim()||'Divers',emoji:$('#prodEmoji').value.trim()||'🛒',active:true};if(!x.name)return toast('Nom obligatoire.');if(hasSupabase)await sb.from('products').insert(x);else demo.products.push({...x,id:'p'+Date.now()});closeModal();renderShop();toast('Produit ajouté')}

async function initAuth(){
  if(!hasSupabase){demo.profile=JSON.parse(localStorage.getItem('ltd_demo_profile')||'null')}else await getCurrentProfile();
  const staff=['employee','admin'].includes(demo.profile?.role);$('#staffNav').classList.toggle('hidden',!staff); if(!staff && $('#staffView').classList.contains('active'))nav('home');
  renderHome();
}

(async function init(){iconRefresh();await initAuth();renderShop(); if(hasSupabase){sb.auth.onAuthStateChange(()=>setTimeout(initAuth,100))}})();
