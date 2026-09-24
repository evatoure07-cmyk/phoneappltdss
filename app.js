const C = window.LTD_CONFIG || {};
const hasSupabase = Boolean(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
const sb = hasSupabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

const LS = {
  profile: 'ltd_v2_profile', orders: 'ltd_v2_orders', products: 'ltd_v2_products',
  announcements: 'ltd_v2_announcements', contacts: 'ltd_v2_contacts', settings: 'ltd_v2_settings',
  promotions: 'ltd_v2_promotions', jobs: 'ltd_v2_jobs', applications: 'ltd_v2_applications', partnerships: 'ltd_v3_partnerships', packItems: 'ltd_v5_pack_items'
};

const defaults = {
  settings: {
    id: 'main', business_name: C.BUSINESS_NAME || 'LTD Sandy Shores',
    address: C.ADDRESS || 'Route 68 — Sandy Shores, Blaine County', phone: C.PHONE || 'À renseigner',
    delivery_fee: Number(C.DELIVERY_FEE ?? 100), delivery_eta_min: Number(C.DELIVERY_ETA_MIN ?? 10),
    delivery_eta_max: Number(C.DELIVERY_ETA_MAX ?? 20), min_order: Number(C.MIN_ORDER ?? 0),
    loyalty_reward_points: Number(C.LOYALTY_REWARD_POINTS ?? 100), points_per_order: Number(C.POINTS_PER_COMPLETED_ORDER ?? 10),
    recruitment_day: C.RECRUITMENT_DAY || 'Dimanche', business_open: C.DEFAULT_OPEN !== false,
    hours_text: C.HOURS_TEXT || "Ouvert selon les disponibilités de l'équipe", pickup_enabled: true,
    delivery_enabled: true, announcement_banner: ''
  },
  products: [
    {id:'p1',name:'Eau purifiée',description:'Bouteille fraîche',price:0,category:'Boissons',emoji:'💧',active:true,available:true,stock:null,popular:true,is_new:false},
    {id:'p2',name:'Sandwich',description:'À remplacer avec la carte du LTD',price:0,category:'Nourriture',emoji:'🥪',active:true,available:true,stock:null,popular:false,is_new:false},
    {id:'p3',name:'Café',description:'À remplacer avec la carte du LTD',price:0,category:'Boissons',emoji:'☕',active:true,available:true,stock:null,popular:false,is_new:true},
    {id:'p4',name:'Kit pratique',description:'À remplacer avec la carte du LTD',price:0,category:'Divers',emoji:'🧰',active:true,available:true,stock:null,popular:false,is_new:false}
  ],
  announcements: [
    {id:'a1',title:'Recrutement ouvert',body:'Les recrutements du LTD ont lieu le dimanche. Venez rencontrer notre équipe et découvrir les postes disponibles.',type:'recruitment',featured:true,active:true,created_at:new Date().toISOString()},
    {id:'a2',title:'Service de livraison',body:'Commandez vos produits depuis votre téléphone et suivez chaque étape de votre commande.',type:'news',featured:false,active:true,created_at:new Date().toISOString()}
  ],
  contacts: [
    {id:'c1',label:'Gérant',name:'Blake Mars',phone:'À renseigner',sort_order:1,active:true},
    {id:'c2',label:'Cogérante',name:'Luciana Angel Mars',phone:'À renseigner',sort_order:2,active:true},
    {id:'c3',label:'Accueil LTD',name:'LTD Sandy Shores',phone:'À renseigner',sort_order:3,active:true}
  ],
  promotions: [],
  jobs: [
    {id:'j1',title:'Vendeur / Vendeuse',description:'Accueil clients, ventes et tenue de la boutique.',active:true},
    {id:'j2',title:'Pompiste',description:'Gestion des stations, livraisons d’essence et suivi des stocks.',active:true},
    {id:'j3',title:'Livreur / Livreuse',description:'Préparation et acheminement des commandes clients.',active:true}
  ]
};

const demo = {
  profile: null, user: null, cart: [], products: [], announcements: [], contacts: [], promotions: [], jobs: [],
  orders: JSON.parse(localStorage.getItem(LS.orders) || '[]'),
  applications: JSON.parse(localStorage.getItem(LS.applications) || '[]'),
  partnerships: JSON.parse(localStorage.getItem(LS.partnerships) || '[]'),
  packItems: JSON.parse(localStorage.getItem(LS.packItems) || '[]'), permissions: []
};
let settings = {...defaults.settings};
let activeCategory = 'Tous';
let currentPromo = null;
let currentOrderMode = 'delivery';
let staffFilter = 'active';
let realtimeChannel = null;
let modalLocked = false;
let passwordPromptedFor = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const byId = id => document.getElementById(id);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2,7)}`;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const num = v => Number(v || 0);
const money = v => `${num(v).toLocaleString('fr-FR', {maximumFractionDigits:2})} $`;
const formatDate = v => new Date(v).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const STAFF_ROLES = {
  patron:'Gérant', copatron:'Cogérante',
  vendeur_novice:'Vendeur novice', vendeur_intermediaire:'Vendeur intermédiaire', vendeur_experimente:'Vendeur expérimenté',
  pompiste_novice:'Pompiste novice', pompiste_intermediaire:'Pompiste intermédiaire', pompiste_experimente:'Pompiste expérimenté',
  chef_equipe:'Chef d’équipe', livreur:'Livreur', responsable_pompiste:'Responsable pompiste', responsable_vente:'Responsable vente'
};
const PERMISSION_DEFS = [
  {key:'orders_view',label:'Voir les commandes',desc:'Accéder aux commandes clients et à leur suivi.'},
  {key:'orders_claim',label:'Prendre une commande',desc:'S’attribuer une commande disponible.'},
  {key:'orders_manage',label:'Gérer les commandes',desc:'Changer les statuts, livrer ou annuler.'},
  {key:'catalog_manage',label:'Gérer le catalogue',desc:'Ajouter et modifier les produits.'},
  {key:'packs_manage',label:'Gérer les packs',desc:'Créer les packs et choisir le pack du mois.'},
  {key:'announcements_manage',label:'Gérer les annonces',desc:'Publier et supprimer les nouveautés.'},
  {key:'promotions_manage',label:'Gérer les promotions',desc:'Créer ou désactiver des offres.'},
  {key:'recruitment_manage',label:'Gérer le recrutement',desc:'Choisir les postes qui recrutent.'},
  {key:'contacts_manage',label:'Gérer les contacts',desc:'Modifier les contacts généraux du LTD.'},
  {key:'team_manage',label:'Voir l’équipe',desc:'Consulter les comptes employés.'},
  {key:'customers_manage',label:'Gérer les clients',desc:'Consulter les clients et ajuster la fidélité.'},
  {key:'partnerships_manage',label:'Gérer les partenariats',desc:'Lire et traiter les demandes partenaires.'},
  {key:'settings_manage',label:'Gérer les paramètres',desc:'Horaires, livraison, adresse et réglages du site.'},
  {key:'stats_view',label:'Voir les statistiques',desc:'Afficher le chiffre d’affaires et les statistiques.'}
];
const MANAGEMENT_PERMS = new Set(['catalog_manage','packs_manage','announcements_manage','promotions_manage','recruitment_manage','contacts_manage','team_manage','customers_manage','partnerships_manage','settings_manage','stats_view']);
let myPermissions = new Set();
const detailedRole = () => demo.profile?.staff_role || null;
const isStaff = () => Boolean(detailedRole()) || ['employee','manager','admin'].includes(demo.profile?.role);
const isDirection = () => ['patron','copatron'].includes(detailedRole()) || ['manager','admin'].includes(demo.profile?.role);
const can = permission => isDirection() || myPermissions.has(permission);
const canManageAnything = () => isDirection() || [...MANAGEMENT_PERMS].some(p=>myPermissions.has(p));
const iconRefresh = () => window.lucide && lucide.createIcons();

const STAFF_EMAIL_DOMAIN = 'ltd-sandy-shores.example';
const DIRECTION_USERNAMES = new Set(['luciana.angelmars','blake.mars']);
const EMPLOYEE_ROLE_ENTRIES = Object.entries(STAFF_ROLES).filter(([k])=>!['patron','copatron'].includes(k));
function normalizeStaffUsername(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'.').replace(/[^a-z0-9._-]/g,'').replace(/\.{2,}/g,'.').replace(/^\.|\.$/g,'');
}
function staffEmail(username){ return `${normalizeStaffUsername(username)}@${STAFF_EMAIL_DOMAIN}`; }
function makeUsername(first,last){ return normalizeStaffUsername(`${first}.${last}`); }
function randomTempPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes=new Uint32Array(16);crypto.getRandomValues(bytes);
  return 'LTD!' + [...bytes].map(x=>alphabet[x%alphabet.length]).join('');
}
async function invokeAdminUsers(body){
  if(!hasSupabase) throw new Error('Cette action nécessite Supabase.');
  const {data,error}=await sb.functions.invoke('admin-users',{body});
  if(error){
    const detail=error?.context?.body || error.message;
    throw new Error(typeof detail==='string'?detail:'Fonction de gestion des comptes indisponible. Vérifiez son déploiement dans Supabase.');
  }
  if(data?.error) throw new Error(data.error);
  return data;
}


function storageGet(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function storageSet(key, value){ localStorage.setItem(key, JSON.stringify(value)) }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add('hidden'),2400) }
function openModal(html,locked=false){ modalLocked=locked; $('#modalContent').innerHTML=html; $('#modalBackdrop').classList.remove('hidden'); iconRefresh() }
function closeModal(force=false){ if(modalLocked&&!force)return; modalLocked=false; $('#modalBackdrop').classList.add('hidden') }
window.closeModal = closeModal;
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop'&&!modalLocked)closeModal()});

function seedDemo(){
  demo.products = storageGet(LS.products, defaults.products);
  demo.announcements = storageGet(LS.announcements, defaults.announcements);
  demo.contacts = storageGet(LS.contacts, defaults.contacts);
  demo.promotions = storageGet(LS.promotions, defaults.promotions);
  demo.jobs = storageGet(LS.jobs, defaults.jobs);
  demo.packItems = storageGet(LS.packItems, []);
  settings = {...defaults.settings, ...storageGet(LS.settings, {})};
  demo.profile = storageGet(LS.profile, null);
  const queryRole = new URLSearchParams(location.search).get('demoRole');
  if(!hasSupabase && queryRole && ['customer','employee','manager','admin'].includes(queryRole)){
    demo.profile = demo.profile || {id:'demo-user',display_name:'Compte test',phone:'555-0100',favorite_address:'',loyalty_points:30,role:queryRole};
    demo.profile.role = queryRole; storageSet(LS.profile,demo.profile);
  }
}

async function getCurrentProfile(){
  if(!hasSupabase) return demo.profile;
  const {data:{user}} = await sb.auth.getUser();
  if(!user){demo.user=null;demo.profile=null;return null}
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(error){console.error(error);return null}
  demo.user=user; demo.profile=data; return data;
}
async function loadMyPermissions(){
  myPermissions=new Set();
  if(!demo.profile || isDirection())return myPermissions;
  if(hasSupabase){
    const {data,error}=await sb.rpc('get_my_permissions');
    if(!error && Array.isArray(data)) data.forEach(x=>myPermissions.add(x));
  }else{
    const defaultsByRole={
      vendeur_novice:['orders_view','orders_claim'],vendeur_intermediaire:['orders_view','orders_claim','orders_manage'],vendeur_experimente:['orders_view','orders_claim','orders_manage'],
      pompiste_novice:[],pompiste_intermediaire:[],pompiste_experimente:[],livreur:['orders_view','orders_claim','orders_manage'],
      chef_equipe:['orders_view','orders_claim','orders_manage','stats_view'],responsable_pompiste:['orders_view','team_manage'],responsable_vente:['orders_view','orders_claim','orders_manage','catalog_manage','packs_manage','announcements_manage','recruitment_manage','stats_view']
    };
    (defaultsByRole[detailedRole()]||[]).forEach(x=>myPermissions.add(x));
  }
  demo.permissions=[...myPermissions];
  return myPermissions;
}
async function getPublicStaffContacts(){
  if(!hasSupabase){
    if(!demo.profile?.staff_role || demo.profile.show_phone===false)return [];
    return [{id:demo.profile.id,name:demo.profile.display_name,phone:demo.profile.phone,label:STAFF_ROLES[demo.profile.staff_role]||'Employé',avatar_url:demo.profile.avatar_url||'',bio:demo.profile.profile_bio||''}];
  }
  const {data,error}=await sb.rpc('get_public_staff_contacts');
  if(error){console.error(error);return []}
  return data||[];
}
async function getSettings(){
  if(!hasSupabase) return settings;
  const {data,error}=await sb.from('site_settings').select('*').eq('id','main').maybeSingle();
  if(!error && data) settings={...defaults.settings,...data};
  return settings;
}
async function getProducts(includeInactive=false){
  if(!hasSupabase) return includeInactive ? demo.products : demo.products.filter(p=>p.active!==false);
  let q=sb.from('products').select('*').order('category').order('name'); if(!includeInactive)q=q.eq('active',true);
  const {data,error}=await q; if(error){console.error(error);return []} return data||[];
}
async function getAnnouncements(includeInactive=false){
  if(!hasSupabase) return demo.announcements.filter(a=>includeInactive||a.active!==false).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  let q=sb.from('announcements').select('*').order('created_at',{ascending:false}); if(!includeInactive)q=q.eq('active',true);
  const {data}=await q; return data||[];
}
async function getContacts(){
  if(!hasSupabase) return demo.contacts.filter(c=>c.active!==false).sort((a,b)=>num(a.sort_order)-num(b.sort_order));
  const {data}=await sb.from('contacts').select('*').eq('active',true).order('sort_order'); return data||[];
}
async function getPromotions(includeInactive=false){
  const now=new Date();
  let list=[];
  if(!hasSupabase) list=demo.promotions;
  else {const {data}=await sb.from('promotions').select('*').order('created_at',{ascending:false});list=data||[]}
  if(includeInactive)return list;
  return list.filter(p=>p.active!==false && (!p.starts_at||new Date(p.starts_at)<=now) && (!p.ends_at||new Date(p.ends_at)>=now));
}
async function getJobs(includeInactive=false){
  if(!hasSupabase)return includeInactive?demo.jobs:demo.jobs.filter(j=>j.active!==false);
  let q=sb.from('jobs').select('*').order('title');
  if(!includeInactive) q=q.eq('active',true);
  const {data,error}=await q;if(error){console.error(error);return []}return data||[];
}

function nav(name){
  if(name==='staff'&&!isStaff())return showEmployeeAccess();
  if(name==='admin'&&!canManageAnything())return toast('Votre rôle n’a pas accès à l’administration.');
  $$('.view').forEach(v=>v.classList.remove('active'));const target=$(`#${name}View`);target?.classList.remove('active');void target?.offsetWidth;target?.classList.add('active');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='home')renderHome();if(name==='shop')renderShop();if(name==='packs')renderPacks();if(name==='orders')renderOrders();if(name==='news')renderNews();if(name==='recruitment')renderRecruitment();if(name==='contact')renderContact();if(name==='staff')renderStaff(staffFilter);if(name==='admin')renderAdmin();window.scrollTo({top:0,behavior:'smooth'});
}
window.nav=nav;
document.addEventListener('click',e=>{const n=e.target.closest('[data-nav]');if(n)nav(n.dataset.nav)});

function applySettingsToUI(){
  const open=Boolean(settings.business_open);
  $('#businessStatusMini') && ($('#businessStatusMini').textContent=open?'Ouvert':'Fermé');
  $('.status-dot')?.classList.toggle('closed',!open);
  if($('#heroStatus')){ $('#heroStatus').textContent=open?'OUVERT':'FERMÉ'; $('#heroStatus').classList.toggle('closed',!open); }
  $('#homeDeliveryFee') && ($('#homeDeliveryFee').textContent=money(settings.delivery_fee));
  $('#homeEta') && ($('#homeEta').textContent=`${settings.delivery_eta_min}–${settings.delivery_eta_max} min`);
  $('#businessAddress') && ($('#businessAddress').textContent=settings.address);
  $('#businessHours') && ($('#businessHours').textContent=settings.hours_text);
  $('#contactBusinessAddress') && ($('#contactBusinessAddress').textContent=settings.address);
  $('#contactBusinessHours') && ($('#contactBusinessHours').textContent=settings.hours_text);
  $('#recruitDayNews') && ($('#recruitDayNews').textContent=String(settings.recruitment_day).toLowerCase());
  $('#shopClosedBanner')?.classList.toggle('hidden',open);
}

async function renderHome(){
  await getSettings(); applySettingsToUI();
  const [anns,contacts,products]=await Promise.all([getAnnouncements(),getContacts(),getProducts()]);
  demo.products=products;
  $('#homeAnnouncements').innerHTML=anns.slice(0,3).map(announcementHTML).join('')||'<div class="empty">Aucune nouveauté pour le moment.</div>';
  const month=products.filter(p=>p.popular && p.available!==false && !p.is_pack).slice(0,4);
  const monthFallback=month.length?month:products.filter(p=>p.available!==false && !p.is_pack).slice(0,4);
  $('#homeMonthProducts').innerHTML=monthFallback.map(homeProductHTML).join('')||'<div class="empty wide-empty">Les produits du mois seront bientôt annoncés.</div>';
  const arrivals=products.filter(p=>p.is_new && p.available!==false && !p.is_pack).slice(0,4);
  $('#homeNewProducts').innerHTML=arrivals.map(homeProductHTML).join('')||'<div class="empty wide-empty">Les nouvelles arrivées seront bientôt disponibles.</div>';
  const packMonth=products.find(p=>p.is_pack && p.is_pack_of_month && p.available!==false);
  if($('#packMonthKicker')) $('#packMonthKicker').textContent=packMonth?'PACK DU MOIS':'PACKS & OFFRES';
  if($('#packMonthDesc')) $('#packMonthDesc').textContent=packMonth?`${packMonth.name} — ${packMonth.description||'Découvrez la sélection du mois.'}`:'Des sélections prêtes à commander pour vos besoins du quotidien, vos équipes et vos événements.';
  if($('#contactsList')) $('#contactsList').innerHTML=contacts.map(contactHTML).join('')||'<div class="empty">Contacts bientôt disponibles.</div>';
  updateCartCount();
  iconRefresh();
}
function homeProductHTML(p){
  return `<button class="home-product-card" onclick="openCatalogProduct('${p.id}')"><div class="home-product-visual">${esc(p.emoji||'🛒')}${p.is_new?'<span>Nouveau</span>':''}</div><strong>${esc(p.name)}</strong><small>${money(p.price)}</small></button>`;
}
window.openCatalogProduct=id=>{
  const product=demo.products.find(p=>String(p.id)===String(id));
  activeCategory='Tous'; nav('shop');
  setTimeout(()=>{ const search=$('#productSearch'); if(search){search.value=product?.name||'';renderShop();} },40);
};
function contactHTML(c){
  const avatar=c.avatar_url?`<div class="contact-avatar"><img src="${esc(c.avatar_url)}" alt=""></div>`:`<div class="contact-avatar">${esc((c.name||'?').slice(0,1).toUpperCase())}</div>`;
  if(c.avatar_url || c.staff_role || c.bio){
    const phone=validPhone(c.phone)?`<a href="tel:${esc(c.phone)}" data-phone="${esc(c.phone)}">${esc(c.phone)}</a>`:'<span>Numéro privé</span>';
    return `<article class="contact-card with-avatar">${avatar}<div class="contact-copy"><span>${esc(c.label||STAFF_ROLES[c.staff_role]||'Équipe')}</span><strong>${esc(c.name)}</strong>${c.bio?`<small class="subtle">${esc(c.bio)}</small>`:''}${phone}</div></article>`;
  }
  return `<article class="contact-card"><span>${esc(c.label)}</span><strong>${esc(c.name)}</strong><a href="${validPhone(c.phone)?`tel:${esc(c.phone)}`:'#'}" data-phone="${esc(c.phone)}">${esc(c.phone)}</a></article>`;
}
function announcementHTML(a){
  const type=({recruitment:'RECRUTEMENT',alert:'INFORMATION',promotion:'OFFRE',news:'ACTUALITÉ'})[a.type]||'ACTUALITÉ';
  return `<article class="announcement ${a.featured?'featured':''}"><div class="meta"><span>${type}${a.featured?' • NOUVEAU':''}</span><span>${new Date(a.created_at).toLocaleDateString('fr-FR')}</span></div><h4>${esc(a.title)}</h4><p>${esc(a.body)}</p></article>`;
}
async function renderNews(){
  const anns=await getAnnouncements();
  $('#newsList').innerHTML=anns.map(announcementHTML).join('')||'<div class="empty">Aucune actualité.</div>';
  iconRefresh();
}
async function renderRecruitment(){
  await getSettings(); applySettingsToUI(); demo.jobs=await getJobs(true);
  $('#jobsList').innerHTML=demo.jobs.map(j=>`<div class="job-card"><strong>${esc(j.title)}</strong><span>${esc(j.description)}</span><b class="recruit-status ${j.active!==false?'open':'closed'}">${j.active!==false?'RECRUTE':'NE RECRUTE PAS'}</b></div>`).join('')||'<div class="empty">Les postes seront bientôt renseignés.</div>';
  iconRefresh();
}
async function renderContact(){
  await getSettings(); applySettingsToUI(); const [contacts,staffContacts]=await Promise.all([getContacts(),getPublicStaffContacts()]);
  const staffRoles=new Set(staffContacts.map(c=>c.staff_role));
  const manual=contacts.filter(c=>{const l=String(c.label||'').toLowerCase();return !(staffRoles.has('patron')&&['patron','gérant','gerant'].includes(l)) && !(staffRoles.has('copatron')&&['co-patronne','co-patron','copatronne','cogérante','cogerante'].includes(l));});
  $('#contactsList').innerHTML=[...staffContacts,...manual].map(contactHTML).join('')||'<div class="empty">Contacts bientôt disponibles.</div>';
  iconRefresh();
}
async function renderPacks(){
  await getSettings(); const all=await getProducts(); demo.products=all;
  const packs=all.filter(p=>p.is_pack || String(p.category||'').toLowerCase().includes('pack') || String(p.name||'').toLowerCase().startsWith('pack')).sort((a,b)=>Number(Boolean(b.is_pack_of_month))-Number(Boolean(a.is_pack_of_month)));
  $('#packsGrid').innerHTML=packs.map(productHTML).join('')||'<div class="empty" style="grid-column:1/-1">Aucun pack n’est disponible pour le moment.</div>';
  updateCartCount(); iconRefresh();
}

async function getPackItems(packId){
  if(!hasSupabase)return demo.packItems.filter(x=>String(x.pack_id)===String(packId)).map(x=>({...x,products:demo.products.find(p=>String(p.id)===String(x.product_id))||null}));
  const {data,error}=await sb.from('pack_items').select('product_id,quantity,products(name,emoji,price)').eq('pack_id',packId).order('created_at');
  if(error){console.error(error);return []}return data||[];
}
window.showPackInfo=async id=>{
  const pack=(demo.products.length?demo.products:await getProducts()).find(p=>String(p.id)===String(id));if(!pack)return;
  const items=await getPackItems(id);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">${pack.is_pack_of_month?'PACK DU MOIS':'PACK LTD'}</span><h3>${esc(pack.name)}</h3><p class="page-intro">${esc(pack.description||'')}</p><div class="pack-content-list">${items.map(i=>`<div class="pack-content-row"><span>${esc(i.products?.emoji||'🛒')} ${esc(i.products?.name||'Article')}</span><strong>x${num(i.quantity)}</strong></div>`).join('')||'<div class="empty">Le contenu de ce pack sera bientôt détaillé.</div>'}</div><div class="total-line grand"><span>Prix du pack</span><strong>${money(pack.price)}</strong></div><div class="modal-actions"><button class="btn primary" onclick="closeModal();addToCart('${pack.id}')">Ajouter au panier</button></div>`);
};
function validPhone(phone){return phone && phone!=='À renseigner' && /\d/.test(phone)}
$('#callBusiness')?.addEventListener('click',()=>{if(validPhone(settings.phone))location.href=`tel:${settings.phone}`;else toast('Le numéro du LTD sera bientôt disponible.')});
$('#businessStatusButton').addEventListener('click',()=>toast(settings.business_open?'Le LTD accepte actuellement les commandes.':'Les commandes sont momentanément fermées.'));
document.addEventListener('click',e=>{const a=e.target.closest('[data-phone]');if(a && !validPhone(a.dataset.phone)){e.preventDefault();toast('Ce numéro sera bientôt renseigné.')}});

async function renderShop(){
  await getSettings(); const [all,promos]=await Promise.all([getProducts(),getPromotions()]); demo.products=all;
  const cats=['Tous','Populaires','Nouveautés',...new Set(all.map(p=>p.category).filter(Boolean))];
  $('#categoryChips').innerHTML=cats.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  const q=($('#productSearch').value||'').trim().toLowerCase();
  const list=all.filter(p=>{
    const cat=activeCategory==='Tous'||(activeCategory==='Populaires'&&p.popular)||(activeCategory==='Nouveautés'&&p.is_new)||p.category===activeCategory;
    const text=`${p.name} ${p.description||''} ${p.category||''}`.toLowerCase(); return cat&&text.includes(q);
  });
  $('#productGrid').innerHTML=list.map(productHTML).join('')||'<div class="empty" style="grid-column:1/-1">Aucun article ne correspond à votre recherche.</div>';
  const auto=promos.find(p=>p.auto_apply); $('#promoStrip').classList.toggle('hidden',!auto); if(auto)$('#promoStrip').innerHTML=`<strong>${esc(auto.name)}</strong> — ${promoDescription(auto)}`;
  applySettingsToUI(); updateCartCount(); iconRefresh();
}
function productHTML(p){
  const available=p.available!==false && (p.stock===null||p.stock===undefined||num(p.stock)>0);
  const badge=p.is_pack_of_month?'Pack du mois':(p.stock!==null&&p.stock!==undefined?`${num(p.stock)} dispo.`:(p.is_new?'Nouveau':p.popular?'Populaire':''));
  return `<article class="product-card ${p.is_pack?'pack-card':''} ${available?'':'unavailable'}">${p.is_pack_of_month?'<span class="pack-month-ribbon">PACK DU MOIS</span>':''}<div class="product-visual">${esc(p.emoji||'🛒')}${badge?`<span class="stock-badge">${esc(badge)}</span>`:''}</div><h4>${esc(p.name)}</h4><p>${esc(p.description||'')}</p><div class="product-price"><strong>${money(p.price)}</strong><span class="subtle">${esc(p.category||'Divers')}</span></div>${p.is_pack?`<button class="pack-info-btn" data-packinfo="${p.id}"><i data-lucide="info"></i> Voir le contenu</button>`:''}<div class="quick-add"><button class="qty-btn" data-qminus="${p.id}" ${available?'':'disabled'}>−</button><input class="qty-input" id="qty-${p.id}" type="number" min="1" max="999" value="1" inputmode="numeric" ${available?'':'disabled'}><button class="qty-btn" data-qplus="${p.id}" ${available?'':'disabled'}>+</button></div><button class="add-cart-wide" data-addqty="${p.id}" ${available?'':'disabled'}>${available?'Ajouter au panier':'Indisponible'}</button></article>`;
}
$('#productSearch').addEventListener('input',renderShop);
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-cat]');if(c){activeCategory=c.dataset.cat;renderShop();return}
  const m=e.target.closest('[data-qminus]');if(m){adjustCardQty(m.dataset.qminus,-1);return}
  const p=e.target.closest('[data-qplus]');if(p){adjustCardQty(p.dataset.qplus,1);return}
  const info=e.target.closest('[data-packinfo]');if(info){showPackInfo(info.dataset.packinfo);return}
  const a=e.target.closest('[data-addqty]');if(a){addToCart(a.dataset.addqty);return}
});
function adjustCardQty(id,d){const input=byId(`qty-${id}`);if(!input)return;input.value=Math.max(1,Math.min(999,num(input.value)+d))}
function addToCart(id){
  const p=demo.products.find(x=>String(x.id)===String(id));if(!p||p.available===false)return;
  const input=byId(`qty-${id}`);let qty=Math.max(1,Math.min(999,Math.floor(num(input?.value)||1))); if(p.stock!==null&&p.stock!==undefined)qty=Math.min(qty,num(p.stock));
  const row=demo.cart.find(x=>String(x.id)===String(id)); if(row)row.qty=Math.min((p.stock??999),row.qty+qty);else demo.cart.push({...p,qty});
  if(input)input.value=1; updateCartCount();toast(`${qty} × ${p.name} ajouté${qty>1?'s':''}`);
}
function updateCartCount(){ const count=demo.cart.reduce((a,b)=>a+b.qty,0); $('#cartCount') && ($('#cartCount').textContent=count); $('#homeCartCount') && ($('#homeCartCount').textContent=count); $('#bottomCartCount') && ($('#bottomCartCount').textContent=count); $('#packsCartCount') && ($('#packsCartCount').textContent=count); }
$('#cartButton')?.addEventListener('click',showCart);
$('#packsCartButton')?.addEventListener('click',showCart);
$('#homeCartShortcut')?.addEventListener('click',showCart);
$('#bottomCartButton')?.addEventListener('click',showCart);
$('#homeNewProductsLink')?.addEventListener('click',()=>{activeCategory='Nouveautés';nav('shop')});

function cartSubtotal(){return demo.cart.reduce((a,b)=>a+num(b.price)*num(b.qty),0)}
function activeAutoPromo(){return demo.promotions?.find(p=>p.active!==false&&p.auto_apply&&promotionTimeValid(p))||null}
function promotionTimeValid(p){const n=new Date();return(!p.starts_at||new Date(p.starts_at)<=n)&&(!p.ends_at||new Date(p.ends_at)>=n)}
function promoDescription(p){
  if(p.discount_type==='percent')return `${num(p.value)} % de réduction${num(p.min_subtotal)>0?` dès ${money(p.min_subtotal)}`:''}`;
  if(p.discount_type==='fixed')return `${money(p.value)} de réduction${num(p.min_subtotal)>0?` dès ${money(p.min_subtotal)}`:''}`;
  if(p.discount_type==='free_delivery')return 'Livraison offerte'; return 'Offre spéciale';
}
function computeDiscount(subtotal,mode,promo){
  if(!promo||num(subtotal)<num(promo.min_subtotal))return {discount:0,freeDelivery:false};
  if(promo.discount_type==='percent')return {discount:Math.min(subtotal,subtotal*num(promo.value)/100),freeDelivery:false};
  if(promo.discount_type==='fixed')return {discount:Math.min(subtotal,num(promo.value)),freeDelivery:false};
  if(promo.discount_type==='free_delivery')return {discount:0,freeDelivery:mode==='delivery'}; return {discount:0,freeDelivery:false};
}
async function showCart(){
  if(!demo.cart.length)return openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Votre panier</h3><div class="empty">Votre panier est vide.</div>`);
  await getSettings(); demo.promotions=await getPromotions(); if(!currentPromo)currentPromo=activeAutoPromo();
  currentOrderMode=settings.delivery_enabled?'delivery':'pickup';
  renderCartModal();
}
function renderCartModal(){
  const subtotal=cartSubtotal(), pts=num(demo.profile?.loyalty_points), eligible=pts>=num(settings.loyalty_reward_points);
  const promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo);
  const fee=currentOrderMode==='delivery'&&!promoCalc.freeDelivery?num(settings.delivery_fee):0;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Votre panier</h3>
    <div>${demo.cart.map(x=>`<div class="cart-row"><div class="cart-main"><strong>${esc(x.name)}</strong><span class="cart-price">${money(x.price)} l’unité • ${money(num(x.price)*num(x.qty))}</span><button class="remove-link" onclick="removeCartItem('${x.id}')">Supprimer</button></div><div class="cart-qty"><button onclick="changeQty('${x.id}',-1)">−</button><input value="${x.qty}" type="number" min="1" max="999" inputmode="numeric" onchange="setCartQty('${x.id}',this.value)"><button onclick="changeQty('${x.id}',1)">+</button></div></div>`).join('')}</div>
    <div class="delivery-choice">${settings.delivery_enabled?`<button class="choice-card ${currentOrderMode==='delivery'?'active':''}" onclick="setOrderMode('delivery')"><strong>Livraison</strong><span>${money(settings.delivery_fee)} • ${settings.delivery_eta_min}–${settings.delivery_eta_max} min</span></button>`:''}${settings.pickup_enabled?`<button class="choice-card ${currentOrderMode==='pickup'?'active':''}" onclick="setOrderMode('pickup')"><strong>Retrait au LTD</strong><span>Sans frais de livraison</span></button>`:''}</div>
    <div class="loyalty-box"><strong>${pts} / ${settings.loyalty_reward_points} points fidélité</strong><div>${eligible?'Vous pouvez utiliser votre livraison offerte.':`Encore ${Math.max(0,num(settings.loyalty_reward_points)-pts)} points avant votre prochaine livraison offerte.`}</div><div class="loyalty-progress"><span style="width:${Math.min(100,(pts/Math.max(1,num(settings.loyalty_reward_points)))*100)}%"></span></div></div>
    ${currentOrderMode==='delivery'?`<div class="form-group"><label>Lieu de livraison</label><input id="deliveryAddress" value="${esc(demo.profile?.favorite_address||'')}" placeholder="Ex : domicile, entreprise, parking…"></div>`:''}
    <div class="form-group"><label>Numéro de téléphone</label><input id="orderPhone" value="${esc(demo.profile?.phone||'')}" placeholder="Votre numéro"></div>
    <div class="form-group"><label>Précision pour l’équipe</label><textarea id="orderNote" placeholder="Ex : appelez-moi en arrivant, entrée arrière…"></textarea></div>
    ${currentOrderMode==='delivery'&&eligible&&!(currentPromo&&currentPromo.discount_type==='free_delivery')?`<label class="checkbox-row"><input type="checkbox" id="redeemPoints" onchange="refreshCartTotals()"> Utiliser ${settings.loyalty_reward_points} points pour offrir la livraison</label>`:''}
    <div class="promo-row"><input id="promoCode" placeholder="Code promo" value="${currentPromo?.code&&!currentPromo.auto_apply?esc(currentPromo.code):''}"><button onclick="applyPromoCode()">Appliquer</button></div><div id="promoMessage" class="subtle">${currentPromo?`Offre appliquée : ${esc(currentPromo.name)}`:''}</div>
    <div class="totals" id="cartTotals"></div>
    ${num(settings.min_order)>0?`<p class="subtle">Minimum de commande : ${money(settings.min_order)}</p>`:''}
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Continuer</button><button class="btn primary" id="checkoutBtn" onclick="checkout()" ${settings.business_open?'':'disabled'}>${settings.business_open?'Valider la commande':'Commandes fermées'}</button></div>`);
  refreshCartTotals();
}
window.setOrderMode=mode=>{currentOrderMode=mode;renderCartModal()};
window.changeQty=(id,d)=>{const r=demo.cart.find(x=>String(x.id)===String(id));if(!r)return;setCartQty(id,r.qty+d)};
window.setCartQty=(id,value)=>{const r=demo.cart.find(x=>String(x.id)===String(id));if(!r)return;let q=Math.floor(num(value));if(q<=0){removeCartItem(id);return}if(r.stock!==null&&r.stock!==undefined)q=Math.min(q,num(r.stock));r.qty=Math.min(999,q);updateCartCount();renderCartModal()};
window.removeCartItem=id=>{demo.cart=demo.cart.filter(x=>String(x.id)!==String(id));updateCartCount();if(demo.cart.length)renderCartModal();else showCart()};
window.refreshCartTotals=()=>{
  const subtotal=cartSubtotal(),promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo),redeem=Boolean($('#redeemPoints')?.checked);
  const fee=currentOrderMode==='delivery'&&!promoCalc.freeDelivery&&!redeem?num(settings.delivery_fee):0; const total=Math.max(0,subtotal-promoCalc.discount)+fee;
  if($('#cartTotals'))$('#cartTotals').innerHTML=`<div class="total-line"><span>Sous-total</span><strong>${money(subtotal)}</strong></div>${promoCalc.discount?`<div class="total-line"><span>Réduction</span><strong>− ${money(promoCalc.discount)}</strong></div>`:''}<div class="total-line"><span>${currentOrderMode==='delivery'?'Livraison':'Retrait'}</span><strong>${fee?money(fee):'Offert'}</strong></div><div class="total-line grand"><span>Total</span><strong>${money(total)}</strong></div>`;
};
window.applyPromoCode=async()=>{
  const code=($('#promoCode')?.value||'').trim().toUpperCase(); const promos=await getPromotions();
  if(!code){currentPromo=activeAutoPromo();renderCartModal();return}
  const p=promos.find(x=>String(x.code||'').toUpperCase()===code&&!x.auto_apply);if(!p){currentPromo=activeAutoPromo();$('#promoMessage').textContent='Code non reconnu ou expiré.';refreshCartTotals();return}
  if(cartSubtotal()<num(p.min_subtotal)){toast(`Cette offre nécessite ${money(p.min_subtotal)} de commande.`);return}
  currentPromo=p;renderCartModal();toast('Code promo appliqué.');
};

window.checkout=async()=>{
  if(!settings.business_open)return toast('Les commandes sont momentanément fermées.');
  if(!demo.profile)return showAuth('signup');
  const subtotal=cartSubtotal(); if(subtotal<num(settings.min_order))return toast(`Minimum de commande : ${money(settings.min_order)}.`);
  const phone=($('#orderPhone')?.value||demo.profile.phone||'').trim(); if(!phone)return toast('Indiquez un numéro de téléphone.');
  const address=currentOrderMode==='delivery'?($('#deliveryAddress')?.value||'').trim():settings.address; if(currentOrderMode==='delivery'&&!address)return toast('Indiquez un lieu de livraison.');
  const note=($('#orderNote')?.value||'').trim(), redeem=Boolean($('#redeemPoints')?.checked), promoCode=currentPromo?.code||null;
  const items=demo.cart.map(x=>({product_id:x.id,quantity:x.qty}));
  if(hasSupabase){
    const {data,error}=await sb.rpc('create_customer_order',{p_items:items,p_fulfillment:currentOrderMode,p_address:address,p_phone:phone,p_note:note,p_redeem_points:redeem,p_promo_code:promoCode});
    if(error){console.error(error);return toast(error.message||'La commande n’a pas pu être créée.')}
    await getCurrentProfile(); demo.cart=[];currentPromo=null;updateCartCount();closeModal();toast(`Commande ${data} envoyée.`);nav('orders');
  }else{
    const promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo); const fee=currentOrderMode==='delivery'&&!promoCalc.freeDelivery&&!redeem?num(settings.delivery_fee):0;
    if(redeem && num(demo.profile.loyalty_points)<num(settings.loyalty_reward_points))return toast('Points fidélité insuffisants.');
    if(redeem){demo.profile.loyalty_points-=num(settings.loyalty_reward_points);storageSet(LS.profile,demo.profile)}
    const o={id:uid('order'),public_code:`SS-${Math.random().toString(36).slice(2,7).toUpperCase()}`,user_id:demo.profile.id,customer_name:demo.profile.display_name,customer_phone:phone,fulfillment:currentOrderMode,delivery_address:address,note,subtotal,discount:promoCalc.discount,delivery_fee:fee,total:Math.max(0,subtotal-promoCalc.discount)+fee,status:'pending',used_loyalty_reward:redeem,loyalty_awarded:false,assigned_to:null,assigned_name:null,eta_min:settings.delivery_eta_min,eta_max:settings.delivery_eta_max,created_at:new Date().toISOString(),items:demo.cart.map(x=>({...x})),events:[{status:'pending',actor_name:demo.profile.display_name||'Client',created_at:new Date().toISOString()}]};
    demo.orders.unshift(o);storageSet(LS.orders,demo.orders);demo.cart=[];currentPromo=null;updateCartCount();closeModal();toast(`Commande ${o.public_code} envoyée.`);nav('orders');
  }
};

async function renderOrders(){
  if(!demo.profile){$('#ordersList').innerHTML=`<div class="empty">Connectez-vous pour retrouver vos commandes.<br><br><button class="btn primary" onclick="showAuth('login')">Se connecter</button></div>`;return}
  let orders=[];
  if(hasSupabase){const {data}=await sb.from('orders').select('*,order_items(*)').eq('user_id',demo.profile.id).order('created_at',{ascending:false});orders=data||[]}
  else orders=demo.orders.filter(o=>o.user_id===demo.profile.id);
  $('#ordersList').innerHTML=orders.map(o=>orderHTML(o,false)).join('')||'<div class="empty">Aucune commande pour le moment.</div>';iconRefresh();
}
$('#refreshOrders').addEventListener('click',renderOrders);
function statusLabel(s){return ({pending:'Commande reçue',accepted:'Confirmée',preparing:'En préparation',ready:'Prête',out_for_delivery:'Livreur en route',delivered:'Livrée',cancelled:'Annulée'})[s]||s}
function orderProgress(status){const seq=['pending','accepted','preparing','out_for_delivery','delivered'];if(status==='ready')return 3;return Math.max(0,seq.indexOf(status))}
function orderHTML(o,staff=false){
  const items=o.order_items||o.items||[], progress=orderProgress(o.status),code=o.public_code||`SS-${String(o.id).slice(-5).toUpperCase()}`;
  return `<article class="order-card"><div class="meta"><span class="order-code">#${esc(code)}</span><span>${formatDate(o.created_at)}</span></div><h4>${staff?`${esc(o.customer_name||'Client')} • `:''}${money(o.total)}</h4><p>${o.fulfillment==='pickup'?'Retrait au LTD':esc(o.delivery_address||'')}</p><div class="status-line"><span class="status ${esc(o.status)}">${statusLabel(o.status)}</span>${o.assigned_name?`<span class="subtle">Pris par ${esc(o.assigned_name)}</span>`:''}</div>${o.status!=='cancelled'?`<div class="timeline">${[0,1,2,3,4].map(i=>`<span class="timeline-step ${i<=progress?'done':''}"></span>`).join('')}</div>`:''}<div class="order-detail-grid"><div class="mini-info"><span>${o.fulfillment==='pickup'?'Retrait':'Estimation'}</span><strong>${o.fulfillment==='pickup'?'Dès que la commande est prête':`${o.eta_min||settings.delivery_eta_min}–${o.eta_max||settings.delivery_eta_max} min`}</strong></div><div class="mini-info"><span>Articles</span><strong>${items.reduce((a,x)=>a+num(x.quantity||x.qty),0)||'—'}</strong></div></div>${o.cancelled_reason?`<p style="margin-top:10px;color:#ffaaaa">Motif : ${esc(o.cancelled_reason)}</p>`:''}${staff?staffActions(o):`<div class="order-actions"><button onclick="showOrderDetail('${o.id}')">Voir le détail</button>${o.status==='delivered'?`<button class="primary-action" onclick="reorderOrder('${o.id}')">Recommander</button>`:''}</div>`}</article>`;
}
window.showOrderDetail=async id=>{
  let o,events=[];
  if(hasSupabase){
    const [or,ev]=await Promise.all([
      sb.from('orders').select('*,order_items(*)').eq('id',id).single(),
      sb.from('order_events').select('*').eq('order_id',id).order('created_at',{ascending:true})
    ]);
    o=or.data;events=ev.data||[];
  }else{o=demo.orders.find(x=>String(x.id)===String(id));events=o?.events||[]}
  if(!o)return;
  const items=o.order_items||o.items||[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Commande #${esc(o.public_code||String(o.id).slice(-5).toUpperCase())}</h3><span class="status ${esc(o.status)}">${statusLabel(o.status)}</span><div class="divider"></div>${items.map(i=>`<div class="total-line"><span>${num(i.quantity||i.qty)} × ${esc(i.product_name||i.name)}</span><strong>${money(num(i.line_total)||num(i.unit_price||i.price)*num(i.quantity||i.qty))}</strong></div>`).join('')}<div class="divider"></div><div class="total-line"><span>Sous-total</span><strong>${money(o.subtotal)}</strong></div>${num(o.discount)>0?`<div class="total-line"><span>Réduction</span><strong>− ${money(o.discount)}</strong></div>`:''}<div class="total-line"><span>Livraison</span><strong>${num(o.delivery_fee)?money(o.delivery_fee):'Offert'}</strong></div><div class="total-line grand"><span>Total</span><strong>${money(o.total)}</strong></div><div class="order-detail-grid"><div class="mini-info"><span>Téléphone</span><strong>${esc(o.customer_phone||'—')}</strong></div><div class="mini-info"><span>${o.fulfillment==='pickup'?'Retrait':'Lieu'}</span><strong>${esc(o.delivery_address||'—')}</strong></div></div>${o.note?`<div class="info-card" style="margin-top:12px"><div class="info-icon"><i data-lucide="message-square-text"></i></div><div><strong>Précision</strong><p>${esc(o.note)}</p></div></div>`:''}${events.length?`<div class="divider"></div><span class="eyebrow">HISTORIQUE</span><div class="stack" style="margin-top:9px">${events.map(e=>`<div class="mini-info"><span>${formatDate(e.created_at)}</span><strong>${statusLabel(e.status)}${e.actor_name?` • ${esc(e.actor_name)}`:''}</strong>${e.note?`<small class="subtle">${esc(e.note)}</small>`:''}</div>`).join('')}</div>`:''}${o.status==='delivered'&&!isStaff()?`<button class="btn primary" style="width:100%;margin-top:14px" onclick="closeModal();reorderOrder('${o.id}')">Recommander</button>`:''}`);
};
window.reorderOrder=async id=>{
  let items=[];
  if(hasSupabase){const{data}=await sb.from('order_items').select('*').eq('order_id',id);items=data||[]}
  else{const o=demo.orders.find(x=>String(x.id)===String(id));items=o?.items||[]}
  const products=await getProducts();demo.products=products;
  let added=0;
  for(const i of items){
    const pid=i.product_id||i.id;const p=products.find(x=>String(x.id)===String(pid));
    if(!p||p.available===false)continue;
    let q=Math.max(1,num(i.quantity||i.qty));if(p.stock!==null&&p.stock!==undefined)q=Math.min(q,num(p.stock));if(q<=0)continue;
    const row=demo.cart.find(x=>String(x.id)===String(p.id));row?row.qty+=q:demo.cart.push({...p,qty:q});added+=q;
  }
  updateCartCount();if(!added)return toast('Les articles de cette commande ne sont plus disponibles.');nav('shop');setTimeout(showCart,80);toast('Ancienne commande ajoutée au panier.');
};

function staffActions(o){
  const mine=String(o.assigned_to||'')===String(demo.profile?.id||'');
  if(['delivered','cancelled'].includes(o.status))return '';
  if(!o.assigned_to){
    const claim=can('orders_claim')?`<button class="primary-action" onclick="claimOrder('${o.id}')">Prendre la commande</button>`:'';
    const cancel=can('orders_manage')?`<button onclick="cancelOrderPrompt('${o.id}')">Refuser</button>`:'';
    return `<div class="order-actions">${claim}${cancel}<button onclick="showStaffOrder('${o.id}')">Détails</button></div>`;
  }
  if(!mine&&!isDirection())return `<div class="order-actions"><button disabled>Déjà prise par ${esc(o.assigned_name||'un collègue')}</button><button onclick="showStaffOrder('${o.id}')">Détails</button></div>`;
  const next={pending:'accepted',accepted:'preparing',preparing:'ready',ready:o.fulfillment==='pickup'?'delivered':'out_for_delivery',out_for_delivery:'delivered'}[o.status];
  return `<div class="order-actions">${next&&can('orders_manage')?`<button class="primary-action" onclick="setOrderStatus('${o.id}','${next}')">${next==='accepted'?'Confirmer':next==='preparing'?'Commencer la préparation':next==='ready'?'Marquer prête':next==='out_for_delivery'?'Départ livraison':'Terminer la commande'}</button>`:''}<button onclick="showStaffOrder('${o.id}')">Détails</button>${can('orders_manage')?`<button onclick="cancelOrderPrompt('${o.id}')">Annuler</button>`:''}</div>`;
}
async function renderStaff(filter='active'){
  staffFilter=filter;if(!isStaff()){ $('#staffOrders').innerHTML='<div class="empty">Accès réservé à l’équipe.</div>';return }
  const avatar=demo.profile?.avatar_url?`<div class="staff-avatar"><img src="${esc(demo.profile.avatar_url)}" alt=""></div>`:`<div class="staff-avatar">${esc((demo.profile?.display_name||'E').slice(0,1).toUpperCase())}</div>`;
  $('#staffProfileCard').innerHTML=`${avatar}<div class="staff-profile-copy"><strong>${esc(demo.profile?.display_name||'Employé')}</strong><span>${esc(roleLabel(detailedRole()||demo.profile?.role||'employee'))}</span><span>${demo.profile?.show_phone?'Numéro affiché dans les contacts':'Numéro privé'}</span></div><button onclick="editProfile()" title="Modifier mon profil"><i data-lucide="user-pen"></i></button>`;
  if(!can('orders_view')){$('#staffKpis').innerHTML='';$('#staffOrders').innerHTML='<div class="empty">Votre rôle n’a pas accès aux commandes. Vous pouvez quand même gérer votre fiche de profil depuis cet espace.</div>';iconRefresh();return}
  let orders=[];
  if(hasSupabase){let q=sb.from('orders').select('*').order('created_at',{ascending:false});if(filter==='active')q=q.not('status','in','(delivered,cancelled)');if(filter==='mine')q=q.eq('assigned_to',demo.profile.id).not('status','in','(delivered,cancelled)');const{data}=await q;orders=data||[]}
  else orders=demo.orders.filter(o=>filter==='all'||(filter==='mine'?String(o.assigned_to)===String(demo.profile.id)&&!['delivered','cancelled'].includes(o.status):!['delivered','cancelled'].includes(o.status)));
  const active=orders.filter(o=>!['delivered','cancelled'].includes(o.status)),mine=active.filter(o=>String(o.assigned_to)===String(demo.profile.id));
  $('#staffKpis').innerHTML=`<div class="kpi-card"><span>À traiter</span><strong>${active.length}</strong></div><div class="kpi-card"><span>À moi</span><strong>${mine.length}</strong></div><div class="kpi-card"><span>En route</span><strong>${active.filter(o=>o.status==='out_for_delivery').length}</strong></div>`;
  $('#staffOrders').innerHTML=orders.map(o=>orderHTML(o,true)).join('')||'<div class="empty">Aucune commande dans cette vue.</div>';iconRefresh();
}
$$('.staff-tab').forEach(b=>b.addEventListener('click',()=>{$$('.staff-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderStaff(b.dataset.filter)}));
$('#refreshStaff').addEventListener('click',()=>renderStaff(staffFilter));
window.claimOrder=async id=>{
  if(hasSupabase){const{error}=await sb.rpc('claim_order',{p_order_id:id});if(error)return toast(error.message||'Commande déjà prise.');}
  else{const o=demo.orders.find(x=>String(x.id)===String(id));if(!o)return;if(o.assigned_to&&String(o.assigned_to)!==String(demo.profile.id))return toast('Cette commande est déjà prise.');o.assigned_to=demo.profile.id;o.assigned_name=demo.profile.display_name;o.assigned_at=new Date().toISOString();if(o.status==='pending')o.status='accepted';o.events=o.events||[];o.events.push({status:o.status,actor_name:demo.profile.display_name||'Employé',created_at:new Date().toISOString()});storageSet(LS.orders,demo.orders)}
  toast('Commande attribuée.');renderStaff(staffFilter);
};
window.setOrderStatus=async(id,status)=>{
  if(hasSupabase){const{error}=await sb.rpc('set_order_status',{p_order_id:id,p_status:status,p_reason:null});if(error)return toast(error.message||'Modification impossible.');}
  else{
    const o=demo.orders.find(x=>String(x.id)===String(id));if(!o)return;o.status=status;o.events=o.events||[];o.events.push({status,actor_name:demo.profile?.display_name||'Équipe',created_at:new Date().toISOString()});
    if(status==='delivered'&&!o.loyalty_awarded){o.loyalty_awarded=true;o.delivered_at=new Date().toISOString();const owner=demo.profile?.id===o.user_id;if(owner){demo.profile.loyalty_points=num(demo.profile.loyalty_points)+num(settings.points_per_order);storageSet(LS.profile,demo.profile)}}storageSet(LS.orders,demo.orders);
  }
  toast(`Commande : ${statusLabel(status)}`);renderStaff(staffFilter);
};
window.cancelOrderPrompt=id=>openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Annuler la commande</h3><div class="form-group"><label>Motif</label><textarea id="cancelReason" placeholder="Ex : article indisponible, zone inaccessible…"></textarea></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Retour</button><button class="btn primary" onclick="confirmCancel('${id}')">Confirmer</button></div>`);
window.confirmCancel=async id=>{const reason=($('#cancelReason')?.value||'').trim();if(!reason)return toast('Indiquez un motif.');if(hasSupabase){const{error}=await sb.rpc('set_order_status',{p_order_id:id,p_status:'cancelled',p_reason:reason});if(error)return toast(error.message)}else{const o=demo.orders.find(x=>String(x.id)===String(id));if(o){o.status='cancelled';o.cancelled_reason=reason;o.events=o.events||[];o.events.push({status:'cancelled',actor_name:demo.profile?.display_name||'Équipe',created_at:new Date().toISOString()});storageSet(LS.orders,demo.orders)}}closeModal();toast('Commande annulée.');renderStaff(staffFilter)};
window.showStaffOrder=async id=>{closeModal();showOrderDetail(id)};

function showAuth(mode='login'){
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${mode==='login'?'Connexion':'Créer un compte'}</h3>${mode==='signup'?`<div class="form-group"><label>Prénom & nom</label><input id="authName" placeholder="Prénom Nom"></div><div class="form-group"><label>Téléphone</label><input id="authPhone" placeholder="Votre numéro"></div>`:''}<div class="form-group"><label>Email</label><input id="authEmail" type="email" placeholder="vous@exemple.com"></div><div class="form-group"><label>Mot de passe</label><input id="authPass" type="password" placeholder="••••••••"></div><div class="modal-actions"><button class="btn ghost" onclick="showAuth('${mode==='login'?'signup':'login'}')">${mode==='login'?'Créer un compte':'J’ai déjà un compte'}</button><button class="btn primary" onclick="submitAuth('${mode}')">${mode==='login'?'Se connecter':'Créer'}</button></div>`);
}
window.showAuth=showAuth;
window.submitAuth=async mode=>{
  const email=($('#authEmail')?.value||'').trim(),pass=$('#authPass')?.value||'';if(!email||!pass)return toast('Complétez les champs.');
  if(hasSupabase){
    if(mode==='signup'){
      const name=($('#authName')?.value||'').trim()||'Client',phone=($('#authPhone')?.value||'').trim();
      const {error}=await sb.auth.signUp({email,password:pass,options:{data:{display_name:name,phone}}});if(error)return toast(error.message);toast('Compte créé. Vérifiez votre email si demandé.');closeModal();await initAuth();
    }else{const{error}=await sb.auth.signInWithPassword({email,password:pass});if(error)return toast(error.message);closeModal();await initAuth();toast('Connexion réussie.');}
  }else{
    demo.user={id:'demo-user',email};demo.profile={id:'demo-user',display_name:($('#authName')?.value||email.split('@')[0]),phone:($('#authPhone')?.value||''),favorite_address:'',role:'customer',loyalty_points:0};storageSet(LS.profile,demo.profile);closeModal();await initAuth();toast('Compte créé.');
  }
};
function showEmployeeAccess(){
  if(isStaff()){nav('staff');return}
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">ESPACE EMPLOYÉS</span><h3>Connexion équipe</h3><p class="page-intro">Utilisez l’identifiant <strong>prénom.nom</strong> transmis par la direction.</p><div class="form-group"><label>Identifiant</label><input id="staffUsername" autocomplete="username" placeholder="prenom.nom"></div><div class="form-group"><label>Mot de passe</label><input id="staffAuthPass" type="password" autocomplete="current-password" placeholder="••••••••"></div><div class="modal-actions"><button class="btn primary" onclick="submitEmployeeAuth()">Se connecter</button></div><p class="subtle" style="margin-top:12px">Les comptes employés sont créés par la direction du LTD.</p>`);
}
window.showEmployeeAccess=showEmployeeAccess;
window.submitEmployeeAuth=async()=>{
  const username=normalizeStaffUsername($('#staffUsername')?.value||''),pass=$('#staffAuthPass')?.value||'';
  if(!username||!pass)return toast('Identifiant et mot de passe obligatoires.');
  try{
    if(hasSupabase){
      let {error}=await sb.auth.signInWithPassword({email:staffEmail(username),password:pass});
      if(error && DIRECTION_USERNAMES.has(username)){
        try{await invokeAdminUsers({action:'bootstrap_direction',username,password:pass})}catch(bootErr){throw bootErr}
        ({error}=await sb.auth.signInWithPassword({email:staffEmail(username),password:pass}));
      }
      if(error)throw error;
    }else{
      const isLuci=username==='luciana.angelmars',isBlake=username==='blake.mars';
      demo.user={id:'demo-staff',email:staffEmail(username)};
      demo.profile={id:'demo-staff',display_name:isLuci?'Luciana Angel Mars':isBlake?'Blake Mars':username,staff_username:username,phone:'',favorite_address:'',role:(isLuci||isBlake)?'admin':'employee',staff_role:isLuci?'copatron':isBlake?'patron':'livreur',loyalty_points:0,must_change_password:false};storageSet(LS.profile,demo.profile);
    }
    closeModal(true);await initAuth();isStaff()?nav('staff'):toast('Ce compte ne possède pas d’accès employé.');
  }catch(err){toast(err.message==='Invalid login credentials'?'Identifiant ou mot de passe incorrect.':(err.message||'Connexion impossible.'));}
};

function showPasswordChange(required=false){
  if(!demo.user)return;
  const title=required?'Nouveau mot de passe obligatoire':'Changer le mot de passe';
  openModal(`${required?'':`<button class="icon-btn close" onclick="closeModal()">×</button>`}<span class="eyebrow">SÉCURITÉ</span><h3>${title}</h3><p class="page-intro">${required?'Votre mot de passe actuel est temporaire. Choisissez-en un nouveau avant de continuer.':'Choisissez un nouveau mot de passe.'}</p><div class="form-group"><label>Nouveau mot de passe</label><input id="newPassword" type="password" autocomplete="new-password" placeholder="8 caractères minimum"></div><div class="form-group"><label>Confirmer</label><input id="confirmPassword" type="password" autocomplete="new-password" placeholder="Répétez le mot de passe"></div><div class="modal-actions">${required?`<button class="btn ghost" onclick="logoutFromPasswordPrompt()">Se déconnecter</button>`:''}<button class="btn primary" onclick="saveMyNewPassword(${required?'true':'false'})">Enregistrer</button></div>`,required);
}
window.showPasswordChange=showPasswordChange;
window.saveMyNewPassword=async required=>{
  const a=$('#newPassword')?.value||'',b=$('#confirmPassword')?.value||'';
  if(a.length<8)return toast('Le mot de passe doit contenir au moins 8 caractères.');
  if(a!==b)return toast('Les deux mots de passe ne correspondent pas.');
  try{
    if(hasSupabase){const{error}=await sb.auth.updateUser({password:a});if(error)throw error;if(isStaff()){const r=await sb.rpc('mark_password_changed');if(r.error)throw r.error}}
    if(demo.profile)demo.profile.must_change_password=false;
    modalLocked=false;closeModal(true);passwordPromptedFor=null;await initAuth();toast('Mot de passe modifié.');
  }catch(err){toast(err.message||'Impossible de modifier le mot de passe.');}
};
window.logoutFromPasswordPrompt=async()=>{modalLocked=false;if(hasSupabase)await sb.auth.signOut();demo.user=null;demo.profile=null;localStorage.removeItem(LS.profile);closeModal(true);await initAuth();};
$('#employeeAccessBtn')?.addEventListener('click',()=>isStaff()?nav('staff'):showEmployeeAccess());
$('#employeeFooterBtn')?.addEventListener('click',()=>isStaff()?nav('staff'):showEmployeeAccess());
$('#homeEmployeeAccess')?.addEventListener('click',()=>isStaff()?nav('staff'):showEmployeeAccess());
$('#accountBtn')?.addEventListener('click',showAccount);
function roleLabel(r){return STAFF_ROLES[r]||({customer:'Client',employee:'Employé',manager:'Responsable',admin:'Direction'})[r]||r}
async function showAccount(){
  if(!demo.profile)return showAuth('login');
  const identity=isStaff()&&demo.profile.staff_username?`<span>@${esc(demo.profile.staff_username)}</span>`:'';
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><div class="account-head"><div class="avatar">${esc((demo.profile.display_name||'C').slice(0,1).toUpperCase())}</div><div class="account-meta"><strong>${esc(demo.profile.display_name||'Mon compte')}</strong>${identity}<span>${esc(demo.profile.phone||'Téléphone non renseigné')}</span><span class="role-badge">${roleLabel(detailedRole()||demo.profile.role||'customer')}</span></div></div><div class="loyalty-box"><strong>${num(demo.profile.loyalty_points)} / ${settings.loyalty_reward_points} points</strong><div>${num(demo.profile.loyalty_points)>=num(settings.loyalty_reward_points)?'Votre prochaine livraison peut être offerte.':`${Math.max(0,num(settings.loyalty_reward_points)-num(demo.profile.loyalty_points))} points avant une livraison offerte.`}</div><div class="loyalty-progress"><span style="width:${Math.min(100,num(demo.profile.loyalty_points)/Math.max(1,num(settings.loyalty_reward_points))*100)}%"></span></div></div><div class="account-actions"><button class="btn ghost" onclick="editProfile()"><i data-lucide="user-pen"></i> Mes informations</button><button class="btn ghost" onclick="showPasswordChange(false)"><i data-lucide="lock-keyhole"></i> Changer mon mot de passe</button><button class="btn ghost" onclick="showLoyaltyHistory()"><i data-lucide="history"></i> Historique fidélité</button>${isStaff()?`<button class="btn ghost" onclick="closeModal();nav('staff')"><i data-lucide="clipboard-check"></i> Espace équipe</button><button class="btn ghost" onclick="enableNotifications()"><i data-lucide="bell-ring"></i> Activer les notifications</button>`:''}${canManageAnything()?`<button class="btn primary" onclick="closeModal();nav('admin')"><i data-lucide="layout-dashboard"></i> Administration</button>`:''}<button class="btn ghost danger" onclick="logout()"><i data-lucide="log-out"></i> Se déconnecter</button></div>`);
}
window.editProfile=()=>openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Mes informations</h3>${isStaff()?`<div class="profile-photo-preview">${demo.profile?.avatar_url?`<img src="${esc(demo.profile.avatar_url)}" alt="">`:`${esc((demo.profile?.display_name||'E').slice(0,1).toUpperCase())}`}</div><div class="form-group"><label>Photo de profil</label><input id="profileAvatar" type="file" accept="image/*"></div>`:''}<div class="form-group"><label>Prénom & nom</label><input id="profileName" value="${esc(demo.profile?.display_name||'')}"></div><div class="form-group"><label>Téléphone</label><input id="profilePhone" value="${esc(demo.profile?.phone||'')}"></div>${isStaff()?`<div class="form-group"><label>Petite présentation</label><input id="profileBio" maxlength="120" value="${esc(demo.profile?.profile_bio||'')}" placeholder="Ex : Responsable des ventes"></div><label class="checkbox-row"><input type="checkbox" id="profileShowPhone" ${demo.profile?.show_phone?'checked':''}> Afficher mon numéro dans les contacts du LTD</label>`:''}<div class="form-group"><label>Adresse favorite</label><input id="profileAddress" value="${esc(demo.profile?.favorite_address||'')}" placeholder="Lieu utilisé le plus souvent"></div><div class="modal-actions"><button class="btn primary" onclick="saveProfile()">Enregistrer</button></div>`);
async function uploadAvatar(file){
  if(!file)return demo.profile?.avatar_url||'';
  if(!hasSupabase){return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(file)})}
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();const path=`${demo.profile.id}/avatar-${Date.now()}.${ext}`;
  const {error}=await sb.storage.from('staff-avatars').upload(path,file,{upsert:true,contentType:file.type||undefined});if(error)throw error;
  return sb.storage.from('staff-avatars').getPublicUrl(path).data.publicUrl;
}
window.saveProfile=async()=>{
  try{
    const file=$('#profileAvatar')?.files?.[0]||null;const avatar=isStaff()?await uploadAvatar(file):(demo.profile?.avatar_url||'');
    const x={display_name:$('#profileName').value.trim(),phone:$('#profilePhone').value.trim(),favorite_address:$('#profileAddress').value.trim()};
    if(isStaff()){x.profile_bio=($('#profileBio')?.value||'').trim();x.show_phone=Boolean($('#profileShowPhone')?.checked);x.avatar_url=avatar}
    if(hasSupabase){const{error}=await sb.from('profiles').update(x).eq('id',demo.profile.id);if(error)throw error;await getCurrentProfile()}else{Object.assign(demo.profile,x);storageSet(LS.profile,demo.profile)}closeModal();renderContact();toast('Informations enregistrées.');
  }catch(err){toast(err.message||'Impossible d’enregistrer le profil.');}
};
window.showLoyaltyHistory=async()=>{
  let events=[];if(hasSupabase){const{data}=await sb.from('loyalty_events').select('*').eq('user_id',demo.profile.id).order('created_at',{ascending:false});events=data||[]}
  else events=[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Fidélité</h3><div class="loyalty-box"><strong>${num(demo.profile.loyalty_points)} points disponibles</strong><div>Une livraison est offerte tous les ${settings.loyalty_reward_points} points.</div></div>${events.length?events.map(e=>`<div class="total-line"><span>${esc(e.description||'Mouvement fidélité')}<br><small>${formatDate(e.created_at)}</small></span><strong>${num(e.points)>0?'+':''}${num(e.points)} pts</strong></div>`).join(''):'<div class="empty">L’historique apparaîtra ici après vos premières commandes livrées.</div>'}`);
};
window.logout=async()=>{if(hasSupabase)await sb.auth.signOut();demo.user=null;demo.profile=null;localStorage.removeItem(LS.profile);closeModal();await initAuth();toast('Déconnecté.');};
window.enableNotifications=async()=>{if(!('Notification'in window))return toast('Notifications non disponibles sur cet appareil.');const p=await Notification.requestPermission();toast(p==='granted'?'Notifications activées.':'Autorisation non accordée.');};

window.showApplication=jobId=>{
  const job=demo.jobs.find(j=>String(j.id)===String(jobId));
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${job?esc(job.title):'Candidature'}</h3><div class="form-group"><label>Prénom & nom</label><input id="applyName" value="${esc(demo.profile?.display_name||'')}"></div><div class="form-group"><label>Téléphone</label><input id="applyPhone" value="${esc(demo.profile?.phone||'')}"></div><div class="form-group"><label>Vos disponibilités / motivation</label><textarea id="applyMessage" placeholder="Présentez-vous en quelques lignes…"></textarea></div><div class="modal-actions"><button class="btn primary" onclick="submitApplication('${jobId}')">Envoyer</button></div>`);
};
window.submitApplication=async jobId=>{
  const x={job_id:jobId,applicant_name:$('#applyName').value.trim(),phone:$('#applyPhone').value.trim(),message:$('#applyMessage').value.trim(),status:'new'};if(!x.applicant_name||!x.phone)return toast('Nom et téléphone obligatoires.');
  if(hasSupabase){const{error}=await sb.from('applications').insert(x);if(error)return toast(error.message)}else{demo.applications.unshift({...x,id:uid('app'),created_at:new Date().toISOString()});storageSet(LS.applications,demo.applications)}closeModal();toast('Candidature envoyée.');
};

$('#partnerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const request={
    business_name:($('#partnerBusiness')?.value||'').trim(),
    contact_name:($('#partnerName')?.value||'').trim(),
    phone:($('#partnerPhone')?.value||'').trim(),
    partnership_type:$('#partnerType')?.value||'Autre',
    message:($('#partnerMessage')?.value||'').trim(),
    status:'new'
  };
  if(!request.business_name||!request.contact_name||!request.phone||!request.message)return toast('Complétez les champs obligatoires.');
  if(hasSupabase){
    const {error}=await sb.from('partnership_requests').insert(request);
    if(error)return toast(error.message);
  }else{
    demo.partnerships.unshift({...request,id:uid('partner'),created_at:new Date().toISOString()});storageSet(LS.partnerships,demo.partnerships);
  }
  e.target.reset(); toast('Votre demande de partenariat a bien été envoyée.');
});

async function renderAdmin(){
  if(!canManageAnything()){ $('#adminStats').innerHTML='';$('#adminActivity').innerHTML='<div class="empty">Votre rôle ne possède aucun accès d’administration.</div>';return }
  $$('#adminView [data-perm]').forEach(card=>card.classList.toggle('hidden-by-permission',!can(card.dataset.perm)));
  $$('#adminView .direction-only').forEach(card=>card.classList.toggle('hidden-by-permission',!isDirection()));
  let orders=[];
  if(can('stats_view')||isDirection()){
    if(hasSupabase){const{data}=await sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(100);orders=data||[]}else orders=demo.orders;
  }
  const delivered=orders.filter(o=>o.status==='delivered'),active=orders.filter(o=>!['delivered','cancelled'].includes(o.status));
  const revenue=delivered.reduce((a,o)=>a+num(o.total),0),fees=delivered.reduce((a,o)=>a+num(o.delivery_fee),0),avg=delivered.length?revenue/delivered.length:0;
  const customers=new Map(),products=new Map();for(const o of delivered){const key=o.customer_name||'Client';customers.set(key,(customers.get(key)||0)+num(o.total));for(const i of (o.order_items||o.items||[])){const name=i.product_name||i.name||'Article';products.set(name,(products.get(name)||0)+num(i.quantity||i.qty));}}
  const topCustomer=[...customers.entries()].sort((a,b)=>b[1]-a[1])[0],topProduct=[...products.entries()].sort((a,b)=>b[1]-a[1])[0];
  $('#adminStats').innerHTML=(can('stats_view')||isDirection())?`<div class="kpi-card"><span>CA livré</span><strong>${money(revenue)}</strong></div><div class="kpi-card"><span>Commandes</span><strong>${orders.length}</strong></div><div class="kpi-card"><span>En cours</span><strong>${active.length}</strong></div><div class="kpi-card"><span>Panier moyen</span><strong>${money(avg)}</strong></div><div class="kpi-card"><span>Livraisons encaissées</span><strong>${money(fees)}</strong></div><div class="kpi-card"><span>Clients servis</span><strong>${customers.size}</strong></div>`:'';
  $('#adminActivity').innerHTML=(can('stats_view')||isDirection())?`<div class="order-detail-grid"><div class="mini-info"><span>Article le + vendu</span><strong>${topProduct?`${esc(topProduct[0])} • ${topProduct[1]} unités`:'—'}</strong></div><div class="mini-info"><span>Client le + actif</span><strong>${topCustomer?`${esc(topCustomer[0])} • ${money(topCustomer[1])}`:'—'}</strong></div></div>${orders.slice(0,6).map(o=>orderHTML(o,true)).join('')||'<div class="empty">Aucune activité.</div>'}`:'<div class="empty">Les outils autorisés pour votre rôle sont disponibles au-dessus.</div>';
  iconRefresh();
}
$('#refreshAdmin').addEventListener('click',renderAdmin);
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-admin]');if(!a)return;
  const perm=a.dataset.perm;if(perm&&!can(perm))return toast('Votre rôle n’a pas cet accès.');
  ({announcements:adminAnnouncements,announcement:adminAnnouncement,product:()=>adminProduct(),products:adminProducts,packs:adminPacks,promotion:adminPromotion,recruitment:adminRecruitment,contacts:adminContacts,settings:adminSettings,team:adminTeam,permissions:adminPermissions,customers:adminCustomers,partnerships:adminPartnerships})[a.dataset.admin]?.();
});
async function adminAnnouncements(){
  const list=await getAnnouncements(true);demo.announcements=list;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Annonces</h3><div class="stack">${list.map(a=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="megaphone"></i></div><div><strong>${esc(a.title)}</strong><p>${esc(a.body)} • ${a.active!==false?'Visible':'Masquée'}</p></div><div class="catalog-actions"><button onclick="deleteAnnouncement('${a.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button></div></div>`).join('')||'<div class="empty">Aucune annonce.</div>'}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="adminAnnouncement()"><i data-lucide="plus"></i> Nouvelle annonce</button>`);iconRefresh();
}
function adminAnnouncement(){openModal(`<button class="icon-btn close" onclick="adminAnnouncements()">×</button><h3>Publier une annonce</h3><div class="form-group"><label>Titre</label><input id="annTitle" placeholder="Titre de l’annonce"></div><div class="form-group"><label>Sous-titre / texte</label><textarea id="annBody" placeholder="Texte affiché sous le titre"></textarea></div><div class="form-group"><label>Type</label><select id="annType"><option value="news">Actualité</option><option value="recruitment">Recrutement</option><option value="promotion">Promotion</option><option value="alert">Information importante</option></select></div><label class="checkbox-row"><input type="checkbox" id="annFeatured"> Mettre à la une / Nouveau</label><div class="modal-actions"><button class="btn primary" onclick="saveAnnouncement()">Publier</button></div>`)}
window.saveAnnouncement=async()=>{const x={title:$('#annTitle').value.trim(),body:$('#annBody').value.trim(),type:$('#annType').value,featured:$('#annFeatured').checked,active:true};if(!x.title||!x.body)return toast('Titre et sous-titre obligatoires.');if(hasSupabase){const{error}=await sb.from('announcements').insert(x);if(error)return toast(error.message)}else{demo.announcements.unshift({...x,id:uid('ann'),created_at:new Date().toISOString()});storageSet(LS.announcements,demo.announcements)}renderHome();toast('Annonce publiée.');adminAnnouncements();};
window.deleteAnnouncement=async id=>{if(!confirm('Supprimer cette annonce ?'))return;if(hasSupabase){const{error}=await sb.from('announcements').delete().eq('id',id);if(error)return toast(error.message)}else{demo.announcements=demo.announcements.filter(a=>String(a.id)!==String(id));storageSet(LS.announcements,demo.announcements)}renderHome();toast('Annonce supprimée.');adminAnnouncements();};
function adminProduct(product=null){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${product?'Modifier':'Ajouter'} un produit</h3><div class="form-grid"><div class="form-group"><label>Nom</label><input id="prodName" value="${esc(product?.name||'')}"></div><div class="form-group"><label>Prix</label><input id="prodPrice" type="number" min="0" step="0.01" value="${num(product?.price)}"></div></div><div class="form-group"><label>Description</label><input id="prodDesc" value="${esc(product?.description||'')}"></div><div class="form-grid"><div class="form-group"><label>Catégorie</label><input id="prodCat" value="${esc(product?.category||'Divers')}"></div><div class="form-group"><label>Emoji / icône</label><input id="prodEmoji" value="${esc(product?.emoji||'🛒')}"></div></div><div class="form-group"><label>Stock (laisser vide = illimité)</label><input id="prodStock" type="number" min="0" value="${product?.stock??''}"></div><div class="two-col"><label class="checkbox-row"><input type="checkbox" id="prodPopular" ${product?.popular?'checked':''}> Populaire</label><label class="checkbox-row"><input type="checkbox" id="prodNew" ${product?.is_new?'checked':''}> Nouveauté</label></div><label class="checkbox-row"><input type="checkbox" id="prodAvailable" ${product?.available!==false?'checked':''}> Disponible à la vente</label><div class="modal-actions"><button class="btn primary" onclick="saveProduct('${product?.id||''}')">Enregistrer</button></div>`)}
window.saveProduct=async id=>{const rawStock=$('#prodStock').value.trim();const x={name:$('#prodName').value.trim(),description:$('#prodDesc').value.trim(),price:num($('#prodPrice').value),category:$('#prodCat').value.trim()||'Divers',emoji:$('#prodEmoji').value.trim()||'🛒',stock:rawStock===''?null:Math.max(0,Math.floor(num(rawStock))),popular:$('#prodPopular').checked,is_new:$('#prodNew').checked,available:$('#prodAvailable').checked,active:true};if(!x.name)return toast('Nom obligatoire.');if(hasSupabase){const q=id?sb.from('products').update(x).eq('id',id):sb.from('products').insert(x);const{error}=await q;if(error)return toast(error.message)}else{if(id){const i=demo.products.findIndex(p=>String(p.id)===String(id));if(i>=0)demo.products[i]={...demo.products[i],...x}}else demo.products.push({...x,id:uid('p')});storageSet(LS.products,demo.products)}closeModal();renderShop();toast('Produit enregistré.')};
async function adminProducts(){const list=await getProducts(true);demo.products=list;openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Catalogue</h3><div class="stack">${list.map(p=>`<div class="catalog-row"><div class="catalog-icon">${esc(p.emoji||'🛒')}</div><div><strong>${esc(p.name)}</strong><p>${money(p.price)} • ${esc(p.category)} • ${p.available!==false?'Disponible':'Indisponible'}${p.stock!==null&&p.stock!==undefined?` • Stock ${p.stock}`:''}</p></div><div class="catalog-actions"><button onclick="editAdminProduct('${p.id}')"><i data-lucide="pencil"></i></button><button onclick="toggleProduct('${p.id}',${p.available!==false})"><i data-lucide="${p.available!==false?'eye-off':'eye'}"></i></button></div></div>`).join('')}</div>`)}
window.editAdminProduct=id=>{const p=demo.products.find(x=>String(x.id)===String(id));if(p)adminProduct(p)};
window.toggleProduct=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('products').update({available:!current}).eq('id',id);if(error)return toast(error.message)}else{const p=demo.products.find(x=>String(x.id)===String(id));if(p)p.available=!current;storageSet(LS.products,demo.products)}adminProducts();};
async function adminPacks(){
  const list=(await getProducts(true)).filter(p=>p.is_pack);demo.products=await getProducts(true);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Packs</h3><div class="stack">${list.map(p=>`<div class="catalog-row"><div class="catalog-icon">${esc(p.emoji||'📦')}</div><div><strong>${esc(p.name)}</strong><p>${money(p.price)}${p.is_pack_of_month?' • PACK DU MOIS':''}</p></div><div class="catalog-actions"><button onclick="editAdminPack('${p.id}')"><i data-lucide="pencil"></i></button></div></div>`).join('')||'<div class="empty">Aucun pack.</div>'}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="adminPack()"><i data-lucide="plus"></i> Nouveau pack</button>`);iconRefresh();
}
window.editAdminPack=async id=>{const all=await getProducts(true);demo.products=all;const p=all.find(x=>String(x.id)===String(id));if(p)adminPack(p)};
async function adminPack(pack=null){
  const all=await getProducts(true);demo.products=all;const base=all.filter(p=>!p.is_pack&&p.active!==false);let items=[];if(pack)items=await getPackItems(pack.id);const qtyMap=new Map(items.map(i=>[String(i.product_id),num(i.quantity)]));
  openModal(`<button class="icon-btn close" onclick="adminPacks()">×</button><h3>${pack?'Modifier':'Créer'} un pack</h3><div class="form-grid"><div class="form-group"><label>Nom</label><input id="packName" value="${esc(pack?.name||'')}"></div><div class="form-group"><label>Prix du pack</label><input id="packPrice" type="number" min="0" step="0.01" value="${num(pack?.price)}"></div></div><div class="form-group"><label>Description</label><input id="packDesc" value="${esc(pack?.description||'')}"></div><div class="form-group"><label>Emoji / icône</label><input id="packEmoji" value="${esc(pack?.emoji||'📦')}"></div><label class="checkbox-row"><input type="checkbox" id="packMonth" ${pack?.is_pack_of_month?'checked':''}> Définir comme Pack du mois</label><label class="checkbox-row"><input type="checkbox" id="packAvailable" ${pack?.available!==false?'checked':''}> Disponible à la vente</label><div class="divider"></div><span class="eyebrow">CONTENU DU PACK</span><div class="permission-grid">${base.map(p=>{const q=qtyMap.get(String(p.id))||0;return `<div class="permission-row"><div><strong>${esc(p.emoji||'🛒')} ${esc(p.name)}</strong><span>${money(p.price)}</span></div><div style="display:flex;align-items:center;gap:7px"><input type="checkbox" class="pack-item-check" data-product="${p.id}" ${q>0?'checked':''}><input class="form-control pack-item-qty" data-product="${p.id}" type="number" min="1" max="99" value="${q||1}" style="width:62px;padding:8px"></div></div>`}).join('')||'<div class="empty">Ajoutez d’abord des produits au catalogue.</div>'}</div><div class="modal-actions"><button class="btn primary" onclick="savePack('${pack?.id||''}')">Enregistrer le pack</button></div>`);iconRefresh();
}
window.savePack=async id=>{const x={name:$('#packName').value.trim(),description:$('#packDesc').value.trim(),price:num($('#packPrice').value),category:'Packs',emoji:$('#packEmoji').value.trim()||'📦',is_pack:true,is_pack_of_month:$('#packMonth').checked,available:$('#packAvailable').checked,active:true,stock:null};if(!x.name)return toast('Nom du pack obligatoire.');const items=$$('.pack-item-check:checked').map(c=>({product_id:c.dataset.product,quantity:Math.max(1,Math.floor(num($(`.pack-item-qty[data-product="${c.dataset.product}"]`)?.value)||1))}));if(!items.length)return toast('Ajoutez au moins un article au pack.');let packId=id;
  if(hasSupabase){if(x.is_pack_of_month)await sb.from('products').update({is_pack_of_month:false}).eq('is_pack',true);if(id){const{error}=await sb.from('products').update(x).eq('id',id);if(error)return toast(error.message)}else{const{data,error}=await sb.from('products').insert(x).select('id').single();if(error)return toast(error.message);packId=data.id}await sb.from('pack_items').delete().eq('pack_id',packId);const{error}=await sb.from('pack_items').insert(items.map(i=>({...i,pack_id:packId})));if(error)return toast(error.message)}else{if(x.is_pack_of_month)demo.products.forEach(p=>p.is_pack_of_month=false);if(id){const i=demo.products.findIndex(p=>String(p.id)===String(id));demo.products[i]={...demo.products[i],...x}}else{packId=uid('pack');demo.products.push({...x,id:packId})}demo.packItems=demo.packItems.filter(i=>String(i.pack_id)!==String(packId)).concat(items.map(i=>({...i,pack_id:packId,id:uid('pi')})));storageSet(LS.products,demo.products);storageSet(LS.packItems,demo.packItems)}toast('Pack enregistré.');renderHome();adminPacks();};

async function adminRecruitment(){const jobs=await getJobs(true);demo.jobs=jobs;openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Recrutement</h3><p class="page-intro">Activez uniquement les postes pour lesquels le LTD recrute actuellement.</p><div class="stack">${jobs.map(j=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="badge-user"></i></div><div><strong>${esc(j.title)}</strong><p>${esc(j.description)}</p></div><div class="catalog-actions"><button onclick="toggleJobRecruitment('${j.id}',${j.active!==false})" title="${j.active!==false?'Fermer':'Ouvrir'} le recrutement"><i data-lucide="${j.active!==false?'toggle-right':'toggle-left'}"></i></button></div></div>`).join('')}</div>`);iconRefresh();}
window.toggleJobRecruitment=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('jobs').update({active:!current}).eq('id',id);if(error)return toast(error.message)}else{const j=demo.jobs.find(x=>String(x.id)===String(id));if(j)j.active=!current;storageSet(LS.jobs,demo.jobs)}toast(!current?'Recrutement ouvert.':'Recrutement fermé.');adminRecruitment();};

async function adminPermissions(role='vendeur_novice'){
  if(!isDirection())return toast('Seuls le Gérant et la Cogérante peuvent modifier les permissions.');let enabled=[];
  if(hasSupabase){const{data,error}=await sb.from('role_permissions').select('permission_key,enabled').eq('staff_role',role);if(error)return toast(error.message);enabled=(data||[]).filter(x=>x.enabled).map(x=>x.permission_key)}else enabled=[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Permissions des rôles</h3><div class="form-group"><label>Rôle à configurer</label><select id="permissionRole">${Object.entries(STAFF_ROLES).filter(([k])=>!['patron','copatron'].includes(k)).map(([k,v])=>`<option value="${k}" ${k===role?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="permission-grid">${PERMISSION_DEFS.map(p=>`<label class="permission-row"><div><strong>${esc(p.label)}</strong><span>${esc(p.desc)}</span></div><input type="checkbox" class="perm-check" value="${p.key}" ${enabled.includes(p.key)?'checked':''}></label>`).join('')}</div><div class="modal-actions"><button class="btn primary" onclick="saveRolePermissions()">Enregistrer</button></div>`);$('#permissionRole').addEventListener('change',e=>adminPermissions(e.target.value));
}
window.saveRolePermissions=async()=>{const role=$('#permissionRole').value,perms=$$('.perm-check:checked').map(x=>x.value);if(hasSupabase){const{error}=await sb.rpc('admin_set_role_permissions',{p_staff_role:role,p_permissions:perms});if(error)return toast(error.message)}toast('Permissions enregistrées.');adminPermissions(role);};

async function adminPromotion(){
  const list=await getPromotions(true);demo.promotions=list;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Promotions</h3><div class="stack">${list.map(p=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="badge-percent"></i></div><div><strong>${esc(p.name)}</strong><p>${promoDescription(p)}${p.code?` • Code ${esc(p.code)}`:' • Automatique'} • ${p.active?'Active':'Inactive'}</p></div><div class="catalog-actions"><button onclick="togglePromotion('${p.id}',${p.active!==false})"><i data-lucide="${p.active!==false?'pause':'play'}"></i></button></div></div>`).join('')||'<div class="empty">Aucune promotion créée.</div>'}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="showPromotionForm()"><i data-lucide="plus"></i> Nouvelle promotion</button>`);iconRefresh();
}
window.showPromotionForm=()=>openModal(`<button class="icon-btn close" onclick="adminPromotion()">×</button><h3>Créer une promotion</h3><div class="form-group"><label>Nom de l’offre</label><input id="promoName" placeholder="Ex : Livraison du dimanche"></div><div class="form-grid"><div class="form-group"><label>Type</label><select id="promoType"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option><option value="free_delivery">Livraison offerte</option></select></div><div class="form-group"><label>Valeur</label><input id="promoValue" type="number" min="0" value="10"></div></div><div class="form-group"><label>Minimum de commande</label><input id="promoMin" type="number" min="0" value="0"></div><div class="form-group"><label>Code (vide si automatique)</label><input id="promoCodeAdmin" placeholder="Ex : SANDY10"></div><label class="checkbox-row"><input type="checkbox" id="promoAuto"> Appliquer automatiquement</label><div class="form-grid"><div class="form-group"><label>Début (facultatif)</label><input id="promoStart" type="datetime-local"></div><div class="form-group"><label>Fin (facultatif)</label><input id="promoEnd" type="datetime-local"></div></div><div class="modal-actions"><button class="btn primary" onclick="savePromotion()">Créer l’offre</button></div>`);
window.savePromotion=async()=>{const code=$('#promoCodeAdmin').value.trim().toUpperCase();const x={name:$('#promoName').value.trim(),discount_type:$('#promoType').value,value:num($('#promoValue').value),min_subtotal:num($('#promoMin').value),code:code||null,auto_apply:$('#promoAuto').checked,starts_at:$('#promoStart').value?new Date($('#promoStart').value).toISOString():null,ends_at:$('#promoEnd').value?new Date($('#promoEnd').value).toISOString():null,active:true};if(!x.name)return toast('Donnez un nom à l’offre.');if(x.auto_apply)x.code=null;if(hasSupabase){const{error}=await sb.from('promotions').insert(x);if(error)return toast(error.message)}else{demo.promotions.unshift({...x,id:uid('promo'),created_at:new Date().toISOString()});storageSet(LS.promotions,demo.promotions)}toast('Promotion créée.');adminPromotion();};
window.togglePromotion=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('promotions').update({active:!current}).eq('id',id);if(error)return toast(error.message)}else{const p=demo.promotions.find(x=>String(x.id)===String(id));if(p)p.active=!current;storageSet(LS.promotions,demo.promotions)}toast(current?'Promotion désactivée.':'Promotion activée.');adminPromotion();};
async function adminContacts(){const list=await getContacts();openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Contacts</h3><div class="stack">${list.map(c=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="phone"></i></div><div><strong>${esc(c.label)} — ${esc(c.name)}</strong><p>${esc(c.phone)}</p></div><div class="catalog-actions"><button onclick="editContact('${c.id}')"><i data-lucide="pencil"></i></button></div></div>`).join('')}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="editContact('')">Ajouter un contact</button>`);demo.contacts=list;iconRefresh()}
window.editContact=id=>{const c=demo.contacts.find(x=>String(x.id)===String(id));openModal(`<button class="icon-btn close" onclick="adminContacts()">×</button><h3>${c?'Modifier':'Ajouter'} un contact</h3><div class="form-group"><label>Fonction</label><input id="contactLabel" value="${esc(c?.label||'')}"></div><div class="form-group"><label>Nom</label><input id="contactName" value="${esc(c?.name||'')}"></div><div class="form-group"><label>Numéro</label><input id="contactPhone" value="${esc(c?.phone||'')}"></div><div class="form-group"><label>Ordre</label><input id="contactOrder" type="number" value="${num(c?.sort_order||1)}"></div><div class="modal-actions"><button class="btn primary" onclick="saveContact('${id}')">Enregistrer</button></div>`)};
window.saveContact=async id=>{const x={label:$('#contactLabel').value.trim(),name:$('#contactName').value.trim(),phone:$('#contactPhone').value.trim(),sort_order:num($('#contactOrder').value),active:true};if(!x.label||!x.name||!x.phone)return toast('Complétez les champs.');if(hasSupabase){const q=id?sb.from('contacts').update(x).eq('id',id):sb.from('contacts').insert(x);const{error}=await q;if(error)return toast(error.message)}else{if(id){const i=demo.contacts.findIndex(c=>String(c.id)===String(id));demo.contacts[i]={...demo.contacts[i],...x}}else demo.contacts.push({...x,id:uid('c')});storageSet(LS.contacts,demo.contacts)}closeModal();renderHome();toast('Contact enregistré.')};
function adminSettings(){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Paramètres</h3><label class="checkbox-row"><input type="checkbox" id="setOpen" ${settings.business_open?'checked':''}> Commandes ouvertes</label><div class="form-grid"><div class="form-group"><label>Frais livraison</label><input id="setFee" type="number" min="0" value="${num(settings.delivery_fee)}"></div><div class="form-group"><label>Minimum commande</label><input id="setMin" type="number" min="0" value="${num(settings.min_order)}"></div></div><div class="form-grid"><div class="form-group"><label>Délai min (min)</label><input id="setEtaMin" type="number" min="0" value="${num(settings.delivery_eta_min)}"></div><div class="form-group"><label>Délai max (min)</label><input id="setEtaMax" type="number" min="0" value="${num(settings.delivery_eta_max)}"></div></div><div class="form-grid"><div class="form-group"><label>Points / commande</label><input id="setPoints" type="number" min="0" value="${num(settings.points_per_order)}"></div><div class="form-group"><label>Seuil récompense</label><input id="setReward" type="number" min="1" value="${num(settings.loyalty_reward_points)}"></div></div><div class="form-group"><label>Adresse</label><input id="setAddress" value="${esc(settings.address)}"></div><div class="form-group"><label>Téléphone du LTD</label><input id="setPhone" value="${esc(settings.phone)}"></div><div class="form-group"><label>Horaires / information d’ouverture</label><input id="setHours" value="${esc(settings.hours_text)}"></div><div class="form-group"><label>Jour de recrutement</label><input id="setRecruit" value="${esc(settings.recruitment_day)}"></div><div class="two-col"><label class="checkbox-row"><input type="checkbox" id="setDelivery" ${settings.delivery_enabled?'checked':''}> Livraison</label><label class="checkbox-row"><input type="checkbox" id="setPickup" ${settings.pickup_enabled?'checked':''}> Retrait LTD</label></div><div class="modal-actions"><button class="btn primary" onclick="saveSettings()">Enregistrer</button></div>`)}
window.saveSettings=async()=>{const x={business_open:$('#setOpen').checked,delivery_fee:num($('#setFee').value),min_order:num($('#setMin').value),delivery_eta_min:num($('#setEtaMin').value),delivery_eta_max:num($('#setEtaMax').value),points_per_order:num($('#setPoints').value),loyalty_reward_points:num($('#setReward').value),address:$('#setAddress').value.trim(),phone:$('#setPhone').value.trim(),hours_text:$('#setHours').value.trim(),recruitment_day:$('#setRecruit').value.trim(),delivery_enabled:$('#setDelivery').checked,pickup_enabled:$('#setPickup').checked};if(hasSupabase){const{error}=await sb.from('site_settings').update(x).eq('id','main');if(error)return toast(error.message)}else{Object.assign(settings,x);storageSet(LS.settings,settings)}Object.assign(settings,x);closeModal();applySettingsToUI();toast('Paramètres enregistrés.')};
async function adminTeam(){
  let users=[];if(hasSupabase){const {data,error}=await sb.from('profiles').select('id,display_name,phone,role,staff_role,staff_username,avatar_url,show_phone,profile_bio,must_change_password').not('staff_role','is',null).order('display_name');if(error)return toast(error.message);users=data||[]}else users=demo.profile?.staff_role?[demo.profile]:[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Équipe & comptes</h3><div class="stack">${users.map(u=>`<div class="catalog-row"><div class="catalog-icon">${u.avatar_url?`<img src="${esc(u.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" alt="">`:'<i data-lucide="user-round"></i>'}</div><div><strong>${esc(u.display_name||'Sans nom')}</strong><p>${esc(roleLabel(u.staff_role||u.role))}${u.staff_username?` • @${esc(u.staff_username)}`:''} • ${u.show_phone?esc(u.phone||''):'numéro privé'}${u.must_change_password?' • mot de passe temporaire':''}</p></div><div class="catalog-actions">${isDirection()?`<button onclick="resetStaffPasswordPrompt('${u.id}','${esc(u.staff_username||'')}')" title="Réinitialiser le mot de passe"><i data-lucide="key-round"></i></button><button onclick="changeStaffRolePrompt('${u.id}','${u.staff_role||''}')" title="Modifier le rôle"><i data-lucide="shield"></i></button>`:''}</div></div>`).join('')||'<div class="empty">Aucun compte employé.</div>'}</div>${isDirection()?`<button class="btn primary" style="width:100%;margin-top:13px" onclick="showCreateStaffAccount()"><i data-lucide="user-round-plus"></i> Créer un compte employé</button>`:''}`);iconRefresh();
}
window.showCreateStaffAccount=()=>openModal(`<button class="icon-btn close" onclick="adminTeam()">×</button><h3>Créer un compte employé</h3><div class="form-grid"><div class="form-group"><label>Prénom</label><input id="newStaffFirst" placeholder="Prénom"></div><div class="form-group"><label>Nom</label><input id="newStaffLast" placeholder="Nom"></div></div><div class="form-group"><label>Identifiant</label><input id="newStaffUsername" placeholder="prenom.nom"><small>Format recommandé : prénom.nom</small></div><div class="form-grid"><div class="form-group"><label>Téléphone</label><input id="newStaffPhone" placeholder="Numéro"></div><div class="form-group"><label>Rôle</label><select id="newStaffRole">${EMPLOYEE_ROLE_ENTRIES.map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div></div><div class="form-group"><label>Mot de passe temporaire</label><div class="inline-input"><input id="newStaffPassword" value="${esc(randomTempPassword())}"><button class="btn mini" onclick="document.getElementById('newStaffPassword').value=randomTempPassword()" type="button"><i data-lucide="refresh-cw"></i></button></div></div><div class="modal-actions"><button class="btn primary" onclick="createStaffAccount()">Créer le compte</button></div>`);
window.randomTempPassword=randomTempPassword;
window.createStaffAccount=async()=>{
  const first=($('#newStaffFirst')?.value||'').trim(),last=($('#newStaffLast')?.value||'').trim(),phone=($('#newStaffPhone')?.value||'').trim(),role=$('#newStaffRole')?.value,password=$('#newStaffPassword')?.value||'';
  const username=normalizeStaffUsername(($('#newStaffUsername')?.value||'').trim()||makeUsername(first,last));
  if(!first||!last||!username||!username.includes('.'))return toast('Renseignez prénom, nom et un identifiant prénom.nom.');
  if(password.length<8)return toast('Le mot de passe temporaire doit contenir au moins 8 caractères.');
  try{
    if(hasSupabase)await invokeAdminUsers({action:'create_staff',username,password,display_name:`${first} ${last}`.trim(),phone,staff_role:role});
    else toast('Compte simulé créé.');
    openModal(`<button class="icon-btn close" onclick="adminTeam()">×</button><span class="eyebrow">COMPTE CRÉÉ</span><h3>${esc(first)} ${esc(last)}</h3><div class="access-code-box"><small>Identifiant</small><code>${esc(username)}</code></div><div class="access-code-box"><small>Mot de passe temporaire</small><code>${esc(password)}</code></div><p class="page-intro">À la première connexion, l’employé devra obligatoirement choisir un nouveau mot de passe.</p><button class="btn primary full" onclick="navigator.clipboard?.writeText('${esc(username)} / ${esc(password)}');toast('Identifiants copiés.')"><i data-lucide="copy"></i> Copier les identifiants</button>`);iconRefresh();
  }catch(err){toast(err.message||'Impossible de créer le compte.');}
};
window.resetStaffPasswordPrompt=(id,username)=>{const temp=randomTempPassword();openModal(`<button class="icon-btn close" onclick="adminTeam()">×</button><h3>Réinitialiser le mot de passe</h3><p class="page-intro">Le prochain mot de passe sera temporaire et devra être changé à la connexion.</p><div class="form-group"><label>Identifiant</label><input value="${esc(username)}" disabled></div><div class="form-group"><label>Nouveau mot de passe temporaire</label><input id="resetStaffPass" value="${esc(temp)}"></div><div class="modal-actions"><button class="btn primary" onclick="confirmStaffPasswordReset('${id}','${esc(username)}')">Réinitialiser</button></div>`)};
window.confirmStaffPasswordReset=async(id,username)=>{const password=$('#resetStaffPass')?.value||'';if(password.length<8)return toast('8 caractères minimum.');try{if(hasSupabase)await invokeAdminUsers({action:'reset_staff_password',user_id:id,password});openModal(`<button class="icon-btn close" onclick="adminTeam()">×</button><h3>Mot de passe réinitialisé</h3><div class="access-code-box"><small>${esc(username)}</small><code>${esc(password)}</code></div><p class="page-intro">Transmettez ce mot de passe à la personne concernée. Elle devra le modifier à sa prochaine connexion.</p>`)}catch(err){toast(err.message||'Réinitialisation impossible.')}};
window.changeStaffRolePrompt=(id,role)=>openModal(`<button class="icon-btn close" onclick="adminTeam()">×</button><h3>Modifier le rôle</h3><div class="form-group"><label>Rôle</label><select id="staffRoleSelect"><option value="">Retirer l’accès employé</option>${Object.entries(STAFF_ROLES).map(([k,v])=>`<option value="${k}" ${role===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="modal-actions"><button class="btn primary" onclick="saveStaffRole('${id}')">Enregistrer</button></div>`);
window.saveStaffRole=async id=>{const role=$('#staffRoleSelect').value||null;if(hasSupabase){const{error}=await sb.rpc('admin_set_staff_role',{p_user_id:id,p_staff_role:role});if(error)return toast(error.message)}else if(String(id)===String(demo.profile?.id)){demo.profile.staff_role=role;demo.profile.role=role?(['patron','copatron'].includes(role)?'admin':'employee'):'customer';storageSet(LS.profile,demo.profile)}toast('Rôle mis à jour.');adminTeam();};
window.adjustPointsPrompt=(id,current)=>openModal(`<button class="icon-btn close" onclick="adminCustomers()">×</button><h3>Points fidélité</h3><div class="loyalty-box"><strong>${current} points actuellement</strong><div>Nombre positif pour ajouter, négatif pour retirer.</div></div><div class="form-group"><label>Ajustement</label><input id="pointsDelta" type="number" value="10"></div><div class="form-group"><label>Motif</label><input id="pointsReason" placeholder="Ex : geste commercial"></div><div class="modal-actions"><button class="btn primary" onclick="savePointsAdjustment('${id}')">Valider</button></div>`);
window.savePointsAdjustment=async id=>{const delta=Math.trunc(num($('#pointsDelta').value)),reason=$('#pointsReason').value.trim();if(!delta)return toast('Indiquez un ajustement différent de 0.');if(!reason)return toast('Indiquez un motif.');if(hasSupabase){const{error}=await sb.rpc('admin_adjust_loyalty',{p_user_id:id,p_delta:delta,p_reason:reason});if(error)return toast(error.message)}else if(String(id)===String(demo.profile?.id)){demo.profile.loyalty_points=Math.max(0,num(demo.profile.loyalty_points)+delta);storageSet(LS.profile,demo.profile)}closeModal();toast('Points mis à jour.');adminCustomers();};
async function adminPartnerships(){
  let list=[];
  if(hasSupabase){const {data,error}=await sb.from('partnership_requests').select('*').order('created_at',{ascending:false}).limit(100);if(error)return toast(error.message);list=data||[]}
  else list=demo.partnerships;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Demandes de partenariat</h3><div class="stack">${list.map(r=>`<div class="customer-card"><div class="status-line"><strong>${esc(r.business_name)}</strong><span class="status ${r.status==='accepted'?'delivered':r.status==='rejected'?'cancelled':'pending'}">${({new:'Nouveau',reviewed:'À l’étude',accepted:'Accepté',rejected:'Refusé'})[r.status]||esc(r.status)}</span></div><p><strong>${esc(r.contact_name)}</strong> • ${esc(r.phone)} • ${esc(r.partnership_type)}</p><p>${esc(r.message||'')}</p><div class="order-actions"><button onclick="setPartnershipStatus('${r.id}','reviewed')">À l’étude</button><button class="primary-action" onclick="setPartnershipStatus('${r.id}','accepted')">Accepter</button><button onclick="setPartnershipStatus('${r.id}','rejected')">Refuser</button></div></div>`).join('')||'<div class="empty">Aucune demande de partenariat.</div>'}</div>`);iconRefresh();
}
window.setPartnershipStatus=async(id,status)=>{
  if(hasSupabase){const {error}=await sb.from('partnership_requests').update({status}).eq('id',id);if(error)return toast(error.message)}
  else{const row=demo.partnerships.find(x=>String(x.id)===String(id));if(row)row.status=status;storageSet(LS.partnerships,demo.partnerships)}
  toast('Statut mis à jour.');adminPartnerships();
};

async function adminCustomers(){
  let users=[];
  if(hasSupabase){const{data,error}=await sb.from('profiles').select('id,display_name,email,phone,role,staff_role,loyalty_points,created_at').is('staff_role',null).order('created_at',{ascending:false}).limit(100);if(error)return toast(error.message);users=data||[]}
  else users=demo.profile&&!demo.profile.staff_role?[demo.profile]:[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Comptes clients</h3><div class="stack">${users.map(u=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="user-round"></i></div><div><strong>${esc(u.display_name||'Sans nom')}</strong><p>${esc(u.email||'Email non renseigné')} • ${esc(u.phone||'Téléphone non renseigné')} • ${num(u.loyalty_points)} pts</p></div><div class="catalog-actions"><button onclick="adjustPointsPrompt('${u.id}',${num(u.loyalty_points)})" title="Ajuster les points"><i data-lucide="gift"></i></button>${u.email?`<button onclick="requestClientPasswordReset('${esc(u.email)}')" title="Envoyer une réinitialisation de mot de passe"><i data-lucide="mail-key"></i></button>`:''}</div></div>`).join('')||'<div class="empty">Aucun client.</div>'}</div><p class="subtle" style="margin-top:12px">Les clients choisissent eux-mêmes leur mot de passe lors de l’inscription. La direction peut leur envoyer un lien de réinitialisation par email.</p>`);iconRefresh();
}
window.requestClientPasswordReset=async email=>{if(!hasSupabase)return toast('Cette action nécessite Supabase.');try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;toast('Email de réinitialisation envoyé.')}catch(err){toast(err.message||'Envoi impossible.')}};

async function initAuth(){
  if(!hasSupabase)demo.profile=storageGet(LS.profile,null);else await getCurrentProfile();
  await loadMyPermissions();await getSettings();
  const staff=isStaff();$('#staffNav').classList.toggle('hidden',!staff);if(!staff&&$('#staffView').classList.contains('active'))nav('home');
  if(!canManageAnything()&&$('#adminView').classList.contains('active'))nav('home');
  applySettingsToUI();renderHome();initRealtime();
  if(demo.profile?.must_change_password && passwordPromptedFor!==demo.profile.id){passwordPromptedFor=demo.profile.id;setTimeout(()=>showPasswordChange(true),180)}
}

(async function init(){
  seedDemo();iconRefresh();await initAuth();demo.promotions=await getPromotions();demo.jobs=await getJobs();renderShop();
  if(hasSupabase)sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>showPasswordChange(false),200);setTimeout(initAuth,100)});
})();
