const C = window.LTD_CONFIG || {};

// V8.2.1 — corrige automatiquement l'ancienne URL Supabase mal configurée.
// L'URL doit être la racine du projet, sans /rest/v1/.
if (C.SUPABASE_URL) {
  const rawUrl = String(C.SUPABASE_URL).trim().replace(/\/+$/, '');
  if (rawUrl.includes('phoneappltdss-1.supabase.co') || rawUrl.includes('/rest/v1')) {
    C.SUPABASE_URL = 'https://mlelowyvwvlrunhnivzf.supabase.co';
  } else {
    C.SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
  }
}

const hasSupabase = Boolean(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
const requireSharedDb = C.REQUIRE_SHARED_DATABASE !== false;
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
    delivery_enabled: true, announcement_banner: '', order_delay_minutes: 1440, large_order_item_threshold: 100
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
  packItems: JSON.parse(localStorage.getItem(LS.packItems) || '[]'), permissions: [],
  favoriteIds: new Set(), loyaltyRewards: [], staffNotifications: [], onDutyStatus: null
};
let settings = {...defaults.settings};
let activeCategory = 'Tous';
let currentPromo = null;
let currentRewardId = null;
let promoCountdownTimer = null;
let currentOrderMode = 'delivery';
let guestOrderDraft = null;
let staffFilter = 'active';
let realtimeChannel = null;
let modalLocked = false;
let passwordPromptedFor = null;
let adminHistoryOrders=[];
let adminHistoryExpanded=false;
let reviewStaffCache=[];
let currentReviewRating=5;
let currentReviewSatisfaction='tres_satisfait';

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
  {key:'business_status_manage',label:'Ouvrir / fermer le LTD',desc:'Changer rapidement le statut ouvert ou fermé depuis l’accueil employé.'},
  {key:'stats_view',label:'Voir les statistiques',desc:'Afficher le chiffre d’affaires et les statistiques.'}
];
const MANAGEMENT_PERMS = new Set(['catalog_manage','packs_manage','announcements_manage','promotions_manage','recruitment_manage','contacts_manage','team_manage','customers_manage','partnerships_manage','settings_manage','stats_view']);
let myPermissions = new Set();
const detailedRole = () => demo.profile?.staff_role || null;
const isStaff = () => Boolean(detailedRole()) || ['employee','manager','admin'].includes(demo.profile?.role);
const isDirection = () => ['patron','copatron'].includes(detailedRole()) || ['manager','admin'].includes(demo.profile?.role);
const can = permission => isDirection() || myPermissions.has(permission);
const canManageAnything = () => isDirection() || [...MANAGEMENT_PERMS].some(p=>myPermissions.has(p));

// Mode "Voir comme" : aperçu visuel uniquement. Il ne change jamais le vrai compte ni les droits serveur.
const PREVIEW_ROLES_ALLOWED = new Set(['patron','copatron','responsable_pompiste','responsable_vente']);
let previewRole = null;
let previewPermissions = new Set();
const canUseRolePreview = () => PREVIEW_ROLES_ALLOWED.has(detailedRole());
const isPreviewMode = () => Boolean(previewRole);
const uiIsStaff = () => isPreviewMode() ? previewRole !== 'customer' : isStaff();
const uiDetailedRole = () => isPreviewMode() ? (previewRole === 'customer' ? null : previewRole) : detailedRole();
const uiCan = permission => {
  if(!isPreviewMode()) return can(permission);
  if(previewRole === 'customer') return false;
  if(['patron','copatron'].includes(previewRole)) return true;
  return previewPermissions.has(permission);
};
const uiCanManageAnything = () => {
  if(!isPreviewMode()) return canManageAnything();
  if(previewRole === 'customer') return false;
  if(['patron','copatron'].includes(previewRole)) return true;
  return [...MANAGEMENT_PERMS].some(p=>previewPermissions.has(p));
};
const blockPreviewMutation = () => { if(isPreviewMode()){ toast('Mode aperçu : quittez "Voir comme" pour effectuer cette action.'); return true; } return false; };
const iconRefresh = () => window.lucide && lucide.createIcons();
const THEME_KEY='ltd-theme';
function applyTheme(theme){
  const selected=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=selected;
  localStorage.setItem(THEME_KEY,selected);
  const btn=$('#themeToggle');
  if(btn){btn.innerHTML=`<i data-lucide="${selected==='dark'?'sun':'moon'}"></i>`;btn.title=selected==='dark'?'Passer en mode clair':'Passer en mode sombre';}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected==='dark'?'#0d0b08':'#f7f1e6');
  iconRefresh();
}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light');}
window.toggleTheme=toggleTheme;


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
  if(!hasSupabase) throw new Error('La base centrale Supabase n’est pas configurée dans config.js.');
  const {data,error}=await sb.functions.invoke('admin-users',{body});
  if(error){
    let detail='';
    try{
      if(error?.context && typeof error.context.json==='function'){
        const payload=await error.context.clone().json();
        detail=payload?.error||payload?.message||'';
      }
    }catch{}
    if(!detail) detail=error?.message||'';
    throw new Error(detail||'Fonction de gestion des comptes indisponible. Vérifiez le déploiement de admin-users dans Supabase.');
  }
  if(data?.error) throw new Error(data.error);
  return data;
}
async function invokeDiscordOrders(body){
  if(!hasSupabase)return null;
  try{
    const {data,error}=await sb.functions.invoke('discord-orders',{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }catch(err){
    console.warn('[Discord orders]',err);
    return null;
  }
}


function requireCentralDatabase(action='cette action'){
  if(hasSupabase)return true;
  const message=`Impossible d’utiliser ${action} : le site n’est pas connecté à la base centrale Supabase.`;
  if(requireSharedDb){
    openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">BASE CENTRALE REQUISE</span><h3>Connexion Supabase manquante</h3><p class="page-intro">${esc(message)}</p><div class="notice warning"><i data-lucide="cloud-off"></i><div><strong>Les comptes locaux ont été désactivés.</strong><span>Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans config.js pour que les comptes soient enregistrés et visibles par tout le monde.</span></div></div>`);iconRefresh();
  }else toast(message);
  return false;
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
      vendeur_novice:['orders_view','orders_claim','business_status_manage'],vendeur_intermediaire:['orders_view','orders_claim','orders_manage','business_status_manage'],vendeur_experimente:['orders_view','orders_claim','orders_manage','business_status_manage'],
      pompiste_novice:['business_status_manage'],pompiste_intermediaire:['business_status_manage'],pompiste_experimente:['business_status_manage'],livreur:['orders_view','orders_claim','orders_manage','business_status_manage'],
      chef_equipe:['orders_view','orders_claim','orders_manage','stats_view','business_status_manage'],responsable_pompiste:['orders_view','team_manage','business_status_manage'],responsable_vente:['orders_view','orders_claim','orders_manage','catalog_manage','packs_manage','announcements_manage','recruitment_manage','stats_view','business_status_manage']
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
async function getPublicStaffRoster(){
  if(!hasSupabase){
    if(!demo.profile?.staff_role)return [];
    return [{id:demo.profile.id,name:demo.profile.display_name,phone:demo.profile.show_phone?demo.profile.phone:'',label:STAFF_ROLES[demo.profile.staff_role]||'Employé',avatar_url:demo.profile.avatar_url||'',bio:demo.profile.profile_bio||'',staff_role:demo.profile.staff_role}];
  }
  const {data,error}=await sb.rpc('get_public_staff_roster');
  if(error){console.error(error);return []}
  return data||[];
}

async function getDirectionStaffContacts(){
  if(!hasSupabase){
    if(!isStaff())return [];
    return [{id:'direction-local',name:'Direction LTD',phone:'',label:'Direction',avatar_url:'',bio:'',staff_role:'patron'}];
  }
  const {data,error}=await sb.rpc('get_direction_staff_contacts');
  if(error){console.error(error);return []}
  return data||[];
}

async function getReviewStaff(){
  if(!hasSupabase){
    return demo.profile?.staff_role?[{id:demo.profile.id,name:demo.profile.display_name,avatar_url:demo.profile.avatar_url||'',staff_role:demo.profile.staff_role}]:[];
  }
  const {data,error}=await sb.rpc('get_review_staff');
  if(error){console.error(error);return []}
  return data||[];
}

async function getStaffNotifications(limit=50){
  if(!isStaff()||!hasSupabase)return [];
  const {data,error}=await sb.rpc('get_staff_notifications',{p_limit:limit});
  if(error){console.error(error);return []}
  demo.staffNotifications=data||[];
  return demo.staffNotifications;
}
async function getDeliveryRanking(){
  if(!isStaff()||!hasSupabase)return [];
  const {data,error}=await sb.rpc('get_delivery_ranking');
  if(error){console.error(error);return []}
  return data||[];
}
async function getMyStaffStats(){
  if(!isStaff()||!hasSupabase)return null;
  const {data,error}=await sb.rpc('get_my_staff_stats');
  if(error){console.error(error);return null}
  return Array.isArray(data)?data[0]||null:data||null;
}
function notificationIcon(type){
  return ({new_order:'package-plus',large_order:'package-search',order_delay:'alarm-clock',review:'star',application:'badge-user',partnership:'handshake'})[type]||'bell';
}
function renderNotificationBadges(list=demo.staffNotifications||[]){
  const unread=list.filter(n=>!n.is_read).length;
  for(const id of ['#staffNotificationBadge','#staffHomeNotificationBadge']){
    const el=$(id);if(!el)continue;el.textContent=unread>99?'99+':String(unread);el.classList.toggle('hidden',unread===0);
  }
}
function renderStaffRanking(rows){
  const el=$('#staffDeliveryRanking');if(!el)return;
  const ranked=(rows||[]).filter(r=>num(r.delivered_orders)>0).slice(0,5);
  if(!ranked.length){el.innerHTML='<div class="empty compact">Le classement apparaîtra après les premières livraisons.</div>';return}
  el.innerHTML=ranked.map((r,i)=>{
    const avatar=r.avatar_url?`<img src="${esc(r.avatar_url)}" alt="">`:esc((r.display_name||'?').slice(0,1).toUpperCase());
    return `<article class="staff-ranking-card rank-${i+1}"><div class="staff-rank-number">${i+1}</div><div class="staff-rank-avatar">${avatar}</div><div class="staff-rank-copy"><strong>${esc(r.display_name)}</strong><span>${num(r.delivered_orders)} livraison${num(r.delivered_orders)>1?'s':''} • ⭐ ${num(r.avg_rating).toFixed(1)}/5</span><small>${num(r.satisfaction_rate)} % satisfaits</small></div></article>`;
  }).join('');
}
function renderStaffDelayAlert(list){
  const el=$('#staffDelayAlert');if(!el)return;
  const delayed=(list||[]).filter(n=>n.type==='order_delay');
  el.classList.toggle('hidden',!delayed.length);
  if(!delayed.length){el.innerHTML='';return}
  el.innerHTML=`<i data-lucide="alarm-clock"></i><div><strong>${delayed.length} commande${delayed.length>1?'s':''} en retard</strong><span>${delayed[0]?.body||'Une commande nécessite votre attention.'}</span></div><button onclick="showStaffNotificationCenter()">Voir</button>`;
}
window.showStaffNotificationCenter=async()=>{
  if(!isStaff())return;
  const list=await getStaffNotifications(50);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><div class="notification-center-head"><div><span class="eyebrow">ESPACE INTERNE</span><h3>Centre de notifications</h3></div><button class="btn mini" onclick="markAllStaffNotificationsRead()">Tout marquer lu</button></div><div class="stack notification-center-list">${list.map(n=>`<article class="staff-notification-card ${esc(n.severity)} ${n.is_read?'read':'unread'}"><div class="notification-icon"><i data-lucide="${notificationIcon(n.type)}"></i></div><div><div class="notification-card-top"><strong>${esc(n.title)}</strong><span>${formatDate(n.created_at)}</span></div><p>${esc(n.body)}</p>${n.order_id?`<button class="notification-order-link" onclick="closeModal();showStaffOrder('${n.order_id}')">Ouvrir la commande</button>`:''}</div></article>`).join('')||'<div class="empty">Aucune notification importante.</div>'}</div>`);
  iconRefresh();
};
window.markAllStaffNotificationsRead=async()=>{
  if(!isStaff()||!hasSupabase)return;
  const ids=(demo.staffNotifications||[]).filter(n=>!n.is_read).map(n=>n.id);
  if(!ids.length)return toast('Tout est déjà lu.');
  const {error}=await sb.rpc('mark_staff_notifications_read',{p_ids:ids});
  if(error)return toast(error.message||'Impossible de marquer les notifications.');
  demo.staffNotifications.forEach(n=>n.is_read=true);renderNotificationBadges();showStaffNotificationCenter();
};

async function getSettings(){
  if(!hasSupabase) return settings;
  const {data,error}=await sb.from('site_settings').select('*').eq('id','main').maybeSingle();
  if(!error && data) settings={...defaults.settings,...data};
  return settings;
}
async function getProducts(includeInactive=false){
  const now=Date.now();
  const timeVisible=p=>!p.available_from||new Date(p.available_from).getTime()<=now
    ? (!p.available_until||new Date(p.available_until).getTime()>=now)
    : false;
  if(!hasSupabase){
    const list=includeInactive?demo.products:demo.products.filter(p=>p.active!==false&&timeVisible(p));
    return list;
  }
  let q=sb.from('products').select('*').order('category').order('name');
  if(!includeInactive)q=q.eq('active',true);
  const {data,error}=await q;
  if(error){console.error(error);return []}
  const list=data||[];
  return includeInactive?list:list.filter(timeVisible);
}
async function getPopularProducts(limit=6){
  if(!hasSupabase){
    const counts=new Map();
    for(const o of demo.orders.filter(o=>o.status==='delivered')){
      for(const i of (o.items||o.order_items||[])){
        const id=String(i.product_id||i.id||'');
        if(!id)continue;
        counts.set(id,(counts.get(id)||0)+num(i.quantity||i.qty));
      }
    }
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([product_id,sold_quantity])=>({product_id,sold_quantity,order_count:0}));
  }
  const {data,error}=await sb.rpc('get_popular_products',{p_limit:limit});
  if(error){console.error(error);return []}
  return data||[];
}
async function getFavoriteIds(){
  if(!demo.profile||isStaff())return new Set();
  if(!hasSupabase)return demo.favoriteIds instanceof Set?demo.favoriteIds:new Set();
  const {data,error}=await sb.from('product_favorites').select('product_id').eq('user_id',demo.profile.id);
  if(error){console.error(error);return new Set()}
  return new Set((data||[]).map(x=>String(x.product_id)));
}
async function getLoyaltyRewards(includeInactive=false){
  if(!demo.profile||isStaff())return [];
  if(!hasSupabase)return demo.loyaltyRewards||[];
  let q=sb.from('loyalty_rewards').select('*').order('points_required').order('sort_order');
  if(!includeInactive)q=q.eq('active',true);
  const {data,error}=await q;
  if(error){console.error(error);return []}
  return data||[];
}
function rewardDescription(r){
  if(!r)return '';
  if(r.reward_type==='free_delivery')return 'Livraison offerte';
  if(r.reward_type==='fixed_discount')return `${money(r.reward_value)} de réduction`;
  if(r.reward_type==='percent_discount')return `${num(r.reward_value)} % de réduction`;
  return r.label||'Récompense';
}
async function renderLiveService(){
  const card=$('#liveServiceCard'),title=$('#liveServiceTitle'),textEl=$('#liveServiceText');
  if(!card||!title||!textEl)return;
  try{
    const result=await invokeDiscordOrders({action:'on_duty'});
    demo.onDutyStatus=result||null;
    card.classList.toggle('active',Boolean(result?.active));
    card.classList.toggle('unavailable',result?.available===false);
    if(result?.available===false){
      title.textContent='Statut en service indisponible';
      textEl.textContent='Le LTD reste joignable selon ses horaires.';
    }else if(result?.active){
      title.textContent='Livraisons disponibles';
      textEl.textContent=`${num(result.count)} employé${num(result.count)>1?'s':''} actuellement en service.`;
    }else{
      title.textContent='Aucun employé en service';
      textEl.textContent='Les livraisons reprendront dès qu’un membre de l’équipe sera en service.';
    }
  }catch(err){
    card.classList.add('unavailable');
    title.textContent='Service en direct indisponible';
    textEl.textContent='Réessayez un peu plus tard.';
  }
}
function formatCountdown(ms){
  const total=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function startPromoCountdown(){
  if(promoCountdownTimer){clearInterval(promoCountdownTimer);promoCountdownTimer=null}
  const tick=()=>{
    const nodes=$('[data-promo-end]');
    if(!nodes.length){if(promoCountdownTimer)clearInterval(promoCountdownTimer);promoCountdownTimer=null;return}
    const now=Date.now();
    let expired=false;
    nodes.forEach(node=>{
      const left=new Date(node.dataset.promoEnd).getTime()-now;
      const banner=node.closest('.premium-promo-banner,.promo-strip');
      if(left<=0){expired=true;return}
      node.textContent=`Se termine dans ${formatCountdown(left)}`;
      banner?.classList.toggle('promo-urgent',left<=30*60*1000);
    });
    if(expired)renderPromoBanner();
  };
  tick();
  promoCountdownTimer=setInterval(tick,1000);
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
  if(name==='contact'&&!uiIsStaff())name='reviews';
  if(name==='reviews'&&uiIsStaff())name='contact';
  if(name==='admin'&&!uiCanManageAnything())return toast('Ce rôle n’a pas accès à l’administration.');
  if(name==='employees'&&!isDirection())return toast('La liste des employés est réservée à la direction.');
  if(name==='partnerships'&&!isDirection())return toast('Les demandes de partenariat sont réservées à la direction.');
  $$('.view').forEach(v=>v.classList.remove('active'));const target=$(`#${name}View`);target?.classList.remove('active');void target?.offsetWidth;target?.classList.add('active');
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='home')renderHome();if(name==='shop')renderShop();if(name==='packs')renderPacks();if(name==='orders')renderOrders();if(name==='reviews')renderReviews();if(name==='news')renderNews();if(name==='recruitment')renderRecruitment();if(name==='contact')renderContact();if(name==='admin')renderAdmin();if(name==='employees')renderEmployeesList();if(name==='partnerships')renderPartnershipsPage();window.scrollTo({top:0,behavior:'smooth'});
}
window.nav=nav;
document.addEventListener('click',e=>{const n=e.target.closest('[data-nav]');if(n)nav(n.dataset.nav)});

// V8.2 — routeur de boutons robuste (compatible navigateur mobile / NUI / cache Render).
// Les boutons essentiels n'utilisent plus de onclick inline : un seul listener global les gère.
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-ltd-action]');
  if(!btn)return;
  e.preventDefault();
  const action=btn.dataset.ltdAction;
  try{
    if(action==='create-staff'){
      if(!isDirection())return toast('Accès réservé à la direction.');
      if(typeof window.showCreateStaffAccount!=='function')throw new Error('Le formulaire de création de compte n’est pas chargé. Rechargez la page.');
      return window.showCreateStaffAccount();
    }
    if(action==='change-password'){
      if(!demo.profile)return toast('Connectez-vous d’abord à votre compte.');
      if(typeof window.showPasswordChange!=='function')throw new Error('Le changement de mot de passe n’est pas chargé. Rechargez la page.');
      return window.showPasswordChange(false);
    }
    if(action==='role-preview'){
      if(typeof window.showRolePreviewPicker!=='function')throw new Error('Le mode Voir comme n’est pas chargé. Rechargez la page.');
      return window.showRolePreviewPicker();
    }
    if(action==='refresh-employees'){
      btn.disabled=true;
      await renderEmployeesList();
      btn.disabled=false;
      return;
    }
  }catch(err){
    btn.disabled=false;
    console.error('[LTD action]',action,err);
    toast(err?.message||'Cette action n’a pas pu être ouverte.');
  }
});
$('#employeeListSearch')?.addEventListener('input',renderEmployeeListRows);
$('#partnershipAdminSearch')?.addEventListener('input',renderPartnershipsPage);
$('#themeToggle')?.addEventListener('click',toggleTheme);
$('#refreshEmployees')?.addEventListener('click',renderEmployeesList);

function updateRoleNavigation(){
  const btn=$('#roleLastNav');if(!btn)return;
  const staff=uiIsStaff();
  btn.dataset.nav=staff?'contact':'reviews';
  btn.innerHTML=staff?'<i data-lucide="users-round"></i><span>Direction</span>':'<i data-lucide="star"></i><span>Avis</span>';
  iconRefresh();
}

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

async function renderPopularPodium(){
  const target=$('#popularPodium');if(!target)return;
  const rows=await getPopularProducts(3);
  if(!rows.length){
    target.innerHTML='<div class="popular-podium-empty"><i data-lucide="trophy"></i><strong>Le podium ouvrira avec les premières vraies ventes.</strong><span>Les 3 produits les plus commandés apparaîtront automatiquement ici.</span></div>';
    iconRefresh();return;
  }
  const products=demo.products.length?demo.products:await getProducts();
  const ranked=rows.map((row,index)=>{
    const product=products.find(p=>String(p.id)===String(row.product_id));
    return product?{...product,rank:index+1,sold_quantity:num(row.sold_quantity)}:null;
  }).filter(Boolean);
  const display=[ranked.find(x=>x.rank===2),ranked.find(x=>x.rank===1),ranked.find(x=>x.rank===3)].filter(Boolean);
  target.innerHTML=display.map(p=>`<button class="podium-card podium-rank-${p.rank}" onclick="openCatalogProduct('${p.id}')">
    <div class="podium-crown">${p.rank===1?'<i data-lucide="crown"></i>':''}</div>
    <div class="podium-product-visual">${esc(p.emoji||'🛒')}</div>
    <div class="podium-rank-badge">#${p.rank}</div>
    <strong>${esc(p.name)}</strong>
    <span>${p.sold_quantity} unité${p.sold_quantity>1?'s':''} commandée${p.sold_quantity>1?'s':''}</span>
    <div class="podium-base"><b>${p.rank}</b></div>
  </button>`).join('');
  iconRefresh();
}

async function renderHome(){
  await getSettings(); applySettingsToUI();
  const [anns,contacts,products]=await Promise.all([getAnnouncements(),getContacts(),getProducts()]);
  demo.products=products;
  await Promise.all([renderPromoBanner(),renderPopularPodium(),renderLiveService()]);
  $('#homeAnnouncements').innerHTML=anns.slice(0,3).map(announcementHTML).join('')||'<div class="empty">Aucune nouveauté pour le moment.</div>';
  const packMonth=products.find(p=>p.is_pack && p.is_pack_of_month && p.available!==false);
  $('#homeMonthProducts').innerHTML=packMonth?homeProductHTML(packMonth):'<div class="empty wide-empty">Aucun pack du mois n’est sélectionné pour le moment.</div>';
  const featuredMonth=products.find(p=>p.is_product_of_month && p.available!==false && !p.is_pack);
  $('#homeNewProducts').innerHTML=featuredMonth?homeProductHTML(featuredMonth):'<div class="empty wide-empty">Aucun produit du mois n’est sélectionné pour le moment.</div>';
  if($('#packMonthKicker')) $('#packMonthKicker').textContent=packMonth?'PACK DU MOIS':'PACKS & OFFRES';
  if($('#packMonthDesc')) $('#packMonthDesc').textContent=packMonth?`${packMonth.name} — ${packMonth.description||'Découvrez la sélection du mois.'}`:'Des sélections prêtes à commander pour vos besoins du quotidien, vos équipes et vos événements.';
  if($('#contactsList')) $('#contactsList').innerHTML=contacts.map(contactHTML).join('')||'<div class="empty">Contacts bientôt disponibles.</div>';
  document.body.classList.toggle('staff-mode',uiIsStaff());
  updateRoleNavigation();
  $('#staffHomeDashboard')?.classList.toggle('hidden',!uiIsStaff());
  $('#staffNotificationButton')?.classList.toggle('hidden',!uiIsStaff());
  updatePreviewBanner();
  if(uiIsStaff()) await renderStaffHome();
  updateCartCount();
  iconRefresh();
}
function homeProductHTML(p){
  return `<button class="home-product-card" onclick="openCatalogProduct('${p.id}')"><div class="home-product-visual">${esc(p.emoji||'🛒')}${p.is_new?'<span>Nouveau</span>':''}</div><strong>${esc(p.name)}</strong><small>${money(p.price)}</small></button>`;
}
function staffRosterHTML(member){
  const avatar=member.avatar_url?`<img src="${esc(member.avatar_url)}" alt="">`:esc((member.name||'?').slice(0,1).toUpperCase());
  const phone=validPhone(member.phone)?`<a href="tel:${esc(member.phone)}">${esc(member.phone)}</a>`:'<span>Numéro privé</span>';
  return `<article class="home-staff-card"><div class="home-staff-avatar">${avatar}</div><div><small>${esc(member.label||'Employé')}</small><strong>${esc(member.name||'Employé')}</strong>${member.bio?`<p>${esc(member.bio)}</p>`:''}${phone}</div></article>`;
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
async function renderReviews(){
  if(isPreviewMode()&&previewRole==='customer'){
    $('#reviewsList').innerHTML='<div class="empty"><strong>Aperçu client</strong><br><br>Les clients retrouvent ici leurs livraisons terminées et peuvent noter jusqu’à deux employés.</div>';return;
  }
  if(!demo.profile){
    $('#reviewsList').innerHTML='<div class="empty">Connectez-vous pour laisser un avis après une livraison.<br><br><button class="btn primary" onclick="showAuth(\'login\')">Se connecter</button></div>';return;
  }
  if(isStaff())return nav('contact');

  let orders=[],reviews=[],staff=[];
  if(hasSupabase){
    const [or,rv,st]=await Promise.all([
      sb.from('orders').select('id,public_code,created_at,delivered_at,total,assigned_name').eq('user_id',demo.profile.id).eq('status','delivered').eq('fulfillment','delivery').order('delivered_at',{ascending:false}),
      sb.from('delivery_reviews').select('*').eq('reviewer_id',demo.profile.id).order('created_at',{ascending:false}),
      getReviewStaff()
    ]);
    orders=or.data||[];reviews=rv.data||[];staff=st||[];
  }else{
    orders=demo.orders.filter(o=>o.user_id===demo.profile.id&&o.status==='delivered'&&o.fulfillment==='delivery');
    reviews=storageGet('ltd_delivery_reviews',[]);
    staff=await getReviewStaff();
  }
  reviewStaffCache=staff;
  const reviewByOrder=new Map(reviews.map(r=>[String(r.order_id),r]));
  const staffById=new Map(staff.map(s=>[String(s.id),s.name]));
  $('#reviewsList').innerHTML=orders.map(o=>{
    const r=reviewByOrder.get(String(o.id));
    if(r){
      const names=[r.employee_1_id,r.employee_2_id].filter(Boolean).map(id=>staffById.get(String(id))||'Employé LTD');
      return `<article class="review-order-card reviewed"><div class="review-order-top"><div><span class="order-code">#${esc(o.public_code||String(o.id).slice(-6).toUpperCase())}</span><strong>Merci pour votre avis</strong></div><span class="review-stars-static">${'★'.repeat(num(r.rating))}${'☆'.repeat(5-num(r.rating))}</span></div><p>${esc(names.join(' & '))}</p><div class="review-satisfaction-result">${esc(satisfactionLabel(r.satisfaction))}</div></article>`;
    }
    return `<article class="review-order-card"><div class="review-order-top"><div><span class="order-code">#${esc(o.public_code||String(o.id).slice(-6).toUpperCase())}</span><strong>Livraison du ${new Date(o.delivered_at||o.created_at).toLocaleDateString('fr-FR')}</strong></div><span>${money(o.total)}</span></div><p>${o.assigned_name?`Commande prise en charge par ${esc(o.assigned_name)}.`:'Votre commande a été livrée.'}</p><button class="btn primary full" onclick="openDeliveryReview('${o.id}','${esc(o.public_code||'')}')"><i data-lucide="star"></i> Laisser un avis</button></article>`;
  }).join('')||'<div class="empty"><strong>Aucune livraison à noter.</strong><br><br>Après votre prochaine commande livrée, elle apparaîtra ici.</div>';
  iconRefresh();
}

window.openDeliveryReview=async(orderId,code)=>{
  if(!demo.profile||isStaff())return;
  if(!reviewStaffCache.length)reviewStaffCache=await getReviewStaff();
  currentReviewRating=5;
  currentReviewSatisfaction='tres_satisfait';
  const staff=reviewStaffCache;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">AVIS LIVRAISON</span><h3>${code?'Commande #'+esc(code):'Votre livraison'}</h3><p class="page-intro">Qui vous a livré ? Sélectionnez une ou deux personnes, puis attribuez votre note.</p>
    <div class="review-employee-grid">${staff.map(s=>`<label class="review-employee-card"><input type="checkbox" class="review-employee-check" value="${s.id}" onchange="limitReviewEmployees(this)"><span class="review-avatar">${s.avatar_url?`<img src="${esc(s.avatar_url)}" alt="">`:esc(String(s.name||'?').slice(0,1).toUpperCase())}</span><span><strong>${esc(s.name)}</strong><small>${esc(roleLabel(s.staff_role||'employee'))}</small></span><i data-lucide="check"></i></label>`).join('')||'<div class="empty">Aucun employé disponible.</div>'}</div>
    <div class="review-selected-count" id="reviewSelectedCount">0 / 2 sélectionné</div>
    <div class="review-rating"><span class="field-label">Votre note</span><div class="review-stars">${[1,2,3,4,5].map(n=>`<button type="button" class="active" data-rating="${n}" onclick="setReviewRating(${n})">★</button>`).join('')}</div><strong id="reviewRatingLabel">5 / 5</strong></div>
    <div class="review-satisfaction"><span class="field-label">Votre satisfaction</span><div class="review-satisfaction-grid">
      <button type="button" class="active" data-satisfaction="tres_satisfait" onclick="setReviewSatisfaction('tres_satisfait')">Très satisfait</button>
      <button type="button" data-satisfaction="satisfait" onclick="setReviewSatisfaction('satisfait')">Satisfait</button>
      <button type="button" data-satisfaction="moyennement_satisfait" onclick="setReviewSatisfaction('moyennement_satisfait')">Moyennement satisfait</button>
      <button type="button" data-satisfaction="insatisfait" onclick="setReviewSatisfaction('insatisfait')">Insatisfait</button>
    </div></div>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn primary" onclick="submitDeliveryReview('${orderId}')">Envoyer mon avis</button></div>`);
  iconRefresh();
};

window.limitReviewEmployees=el=>{
  const checked=$$('.review-employee-check:checked');
  if(checked.length>2){el.checked=false;toast('Vous pouvez sélectionner maximum deux personnes.');}
  const count=$$('.review-employee-check:checked').length;
  if($('#reviewSelectedCount'))$('#reviewSelectedCount').textContent=`${count} / 2 sélectionné${count>1?'s':''}`;
};

window.setReviewRating=n=>{
  currentReviewRating=Math.max(1,Math.min(5,num(n)));
  $$('.review-stars button').forEach(b=>b.classList.toggle('active',num(b.dataset.rating)<=currentReviewRating));
  if($('#reviewRatingLabel'))$('#reviewRatingLabel').textContent=`${currentReviewRating} / 5`;
};
window.setReviewSatisfaction=value=>{
  if(!['tres_satisfait','satisfait','moyennement_satisfait','insatisfait'].includes(value))return;
  currentReviewSatisfaction=value;
  $$('.review-satisfaction-grid button').forEach(b=>b.classList.toggle('active',b.dataset.satisfaction===value));
};

window.submitDeliveryReview=async orderId=>{
  const selected=$$('.review-employee-check:checked').map(x=>x.value);
  if(selected.length<1||selected.length>2)return toast('Sélectionnez une ou deux personnes.');
  const row={order_id:orderId,reviewer_id:demo.profile.id,employee_1_id:selected[0],employee_2_id:selected[1]||null,rating:currentReviewRating,satisfaction:currentReviewSatisfaction,comment:null};
  if(hasSupabase){
    const {error}=await sb.from('delivery_reviews').insert(row);
    if(error){
      if(String(error.code)==='23505')return toast('Vous avez déjà laissé un avis pour cette commande.');
      return toast(error.message||'Impossible d’envoyer votre avis.');
    }
  }else{
    const list=storageGet('ltd_delivery_reviews',[]);
    if(list.some(r=>String(r.order_id)===String(orderId)))return toast('Vous avez déjà laissé un avis pour cette commande.');
    list.push({...row,id:uid('review'),created_at:new Date().toISOString()});storageSet('ltd_delivery_reviews',list);
  }
  closeModal();toast('Merci pour votre avis !');renderReviews();
};

async function renderContact(){
  if(!uiIsStaff())return nav('reviews');
  await getSettings();applySettingsToUI();
  const direction=await getDirectionStaffContacts();
  $('#contactsList').innerHTML=direction.map(contactHTML).join('')||'<div class="empty">Équipe de direction bientôt disponible.</div>';
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
  const canShowContents=pack.show_pack_contents!==false;
  const items=canShowContents?await getPackItems(id):[];
  const contentBlock=canShowContents
    ? `<div class="pack-content-list">${items.map(i=>`<div class="pack-content-row"><span>${esc(i.products?.emoji||'🛒')} ${esc(i.products?.name||'Article')}</span><strong>x${num(i.quantity)}</strong></div>`).join('')||'<div class="empty">Aucun détail de contenu n’a été renseigné.</div>'}</div>`
    : '';
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">${pack.is_pack_of_month?'PACK DU MOIS':'PACK LTD'}</span><h3>${esc(pack.name)}</h3><p class="page-intro">${esc(pack.description||'Aucune description.')}</p>${contentBlock}<div class="total-line grand"><span>Prix du pack</span><strong>${money(pack.price)}</strong></div><div class="modal-actions"><button class="btn primary" onclick="closeModal();addToCart('${pack.id}')">Ajouter au panier</button></div>`);
};
function validPhone(phone){return phone && phone!=='À renseigner' && /\d/.test(phone)}
$('#callBusiness')?.addEventListener('click',()=>{if(validPhone(settings.phone))location.href=`tel:${settings.phone}`;else toast('Le numéro du LTD sera bientôt disponible.')});
$('#businessStatusButton').addEventListener('click',()=>toast(settings.business_open?'Le LTD accepte actuellement les commandes.':'Les commandes sont momentanément fermées.'));
document.addEventListener('click',e=>{const a=e.target.closest('[data-phone]');if(a && !validPhone(a.dataset.phone)){e.preventDefault();toast('Ce numéro sera bientôt renseigné.')}});

async function renderShop(){
  await getSettings();
  const [all,promos,popularRows,favorites]=await Promise.all([getProducts(),getPromotions(),getPopularProducts(3),getFavoriteIds()]);
  demo.favoriteIds=favorites;
  const popularMap=new Map(popularRows.map((row,index)=>[String(row.product_id),{rank:index+1,qty:num(row.sold_quantity)}]));
  demo.products=all.map(p=>{
    const pop=popularMap.get(String(p.id));
    return {...p,popular:Boolean(pop),popular_rank:pop?.rank||null,popular_quantity:pop?.qty||0};
  });
  const cats=['Tous',...(demo.profile&&!isStaff()?['Favoris']:[]),'Populaires','Nouveauté','Packs'];
  if(activeCategory==='Favoris'&&(!demo.profile||isStaff()))activeCategory='Tous';
  $('#categoryChips').innerHTML=cats.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  renderShopProducts();
  await renderPromoBanner();
  applySettingsToUI();updateCartCount();iconRefresh();
}
function renderShopProducts(){
  const input=$('#productSearch');
  const q=String(input?.value||'').trim().toLocaleLowerCase('fr-FR');
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR');
  const nq=normalize(q);
  const list=(demo.products||[]).filter(p=>{
    if(p.available===false)return false;
    if(p.stock!==null&&p.stock!==undefined&&num(p.stock)<=0)return false;
    const cat=activeCategory==='Tous'||(activeCategory==='Favoris'&&demo.favoriteIds?.has(String(p.id)))||(activeCategory==='Populaires'&&p.popular)||(activeCategory==='Nouveauté'&&p.is_new)||(activeCategory==='Packs'&&p.is_pack);
    if(!cat)return false;
    const text=normalize(`${p.name} ${p.description||''} ${p.category||''}`);
    return !nq||text.includes(nq);
  });
  $('#productGrid').innerHTML=list.map(productHTML).join('')||'<div class="empty" style="grid-column:1/-1">Aucun article ne correspond à votre recherche.</div>';
  iconRefresh();
}
function productHTML(p){
  const available=p.available!==false && (p.stock===null||p.stock===undefined||num(p.stock)>0);
  const favorite=Boolean(demo.favoriteIds?.has(String(p.id)));
  const limited=Boolean(p.is_limited_edition);
  const ends=p.available_until?new Date(p.available_until):null;
  const badge=p.is_product_of_month?'Produit du mois':(p.is_pack_of_month?'Pack du mois':(p.stock!==null&&p.stock!==undefined?`${num(p.stock)} dispo.`:(p.is_new?'Nouveau':p.popular?'Populaire':'')));
  return `<article class="product-card ${p.is_product_of_month?'product-of-month':''} ${p.is_pack?'pack-card':''} ${p.popular?'auto-popular-product':''} ${limited?'limited-product':''} ${available?'':'unavailable'}">
    ${p.popular&&!p.is_pack?`<span class="popular-ribbon">POPULAIRE #${p.popular_rank}</span>`:''}
    ${limited?`<span class="limited-ribbon">ÉDITION LIMITÉE</span>`:''}
    ${demo.profile&&!isStaff()?`<button class="favorite-toggle ${favorite?'active':''}" data-favorite="${p.id}" title="${favorite?'Retirer des favoris':'Ajouter aux favoris'}"><i data-lucide="heart"></i></button>`:''}
    ${p.is_product_of_month?'<span class="product-month-ribbon">PRODUIT DU MOIS</span>':''}${p.is_pack_of_month?'<span class="pack-month-ribbon">PACK DU MOIS</span>':''}
    <div class="product-visual">${esc(p.emoji||'🛒')}${badge?`<span class="stock-badge">${esc(badge)}</span>`:''}</div>
    <h4>${esc(p.name)}</h4>
    ${p.description?`<p class="product-description">${esc(p.description)}</p>`:'<p class="product-description empty-description">Aucune description.</p>'}
    ${limited&&ends?`<div class="limited-until"><i data-lucide="clock-3"></i> Jusqu’au ${ends.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>`:''}
    <div class="product-price"><strong>${money(p.price)}</strong><span class="subtle">${esc(p.category||'Divers')}</span></div>
    ${p.is_pack?`<button class="pack-info-btn" data-packinfo="${p.id}"><i data-lucide="info"></i> Voir le contenu</button>`:''}
    <div class="quick-add"><button class="qty-btn" data-qminus="${p.id}" ${available?'':'disabled'}>−</button><input class="qty-input" id="qty-${p.id}" type="number" min="1" max="999" value="1" inputmode="numeric" ${available?'':'disabled'}><button class="qty-btn" data-qplus="${p.id}" ${available?'':'disabled'}>+</button></div>
    <button class="add-cart-wide" data-addqty="${p.id}" ${available?'':'disabled'}>${available?'Ajouter au panier':'Indisponible'}</button>
  </article>`;
}
$('#productSearch')?.addEventListener('input',renderShopProducts);
document.addEventListener('click',e=>{
  const fav=e.target.closest('[data-favorite]');if(fav){e.preventDefault();e.stopPropagation();toggleFavorite(fav.dataset.favorite);return}
  const c=e.target.closest('[data-cat]');if(c){activeCategory=c.dataset.cat;renderShopProducts();$$('[data-cat]').forEach(x=>x.classList.toggle('active',x.dataset.cat===activeCategory));return}
  const m=e.target.closest('[data-qminus]');if(m){adjustCardQty(m.dataset.qminus,-1);return}
  const p=e.target.closest('[data-qplus]');if(p){adjustCardQty(p.dataset.qplus,1);return}
  const info=e.target.closest('[data-packinfo]');if(info){showPackInfo(info.dataset.packinfo);return}
  const a=e.target.closest('[data-addqty]');if(a){addToCart(a.dataset.addqty);return}
});
window.toggleFavorite=async id=>{
  if(!demo.profile||isStaff())return toast('Connectez-vous avec un compte client pour utiliser les favoris.');
  const key=String(id),exists=demo.favoriteIds?.has(key);
  if(hasSupabase){
    if(exists){
      const {error}=await sb.from('product_favorites').delete().eq('user_id',demo.profile.id).eq('product_id',id);
      if(error)return toast(error.message||'Impossible de modifier les favoris.');
      demo.favoriteIds.delete(key);
    }else{
      const {error}=await sb.from('product_favorites').insert({user_id:demo.profile.id,product_id:id});
      if(error)return toast(error.message||'Impossible de modifier les favoris.');
      demo.favoriteIds.add(key);
    }
  }
  renderShopProducts();
  toast(exists?'Retiré des favoris.':'Ajouté aux favoris.');
};
function adjustCardQty(id,d){const input=byId(`qty-${id}`);if(!input)return;input.value=Math.max(1,Math.min(999,num(input.value)+d))}
function addToCart(id){
  const p=demo.products.find(x=>String(x.id)===String(id));if(!p||p.available===false)return;
  const input=byId(`qty-${id}`);let qty=Math.max(1,Math.min(999,Math.floor(num(input?.value)||1))); if(p.stock!==null&&p.stock!==undefined)qty=Math.min(qty,num(p.stock));
  const row=demo.cart.find(x=>String(x.id)===String(id)); if(row)row.qty=Math.min((p.stock??999),row.qty+qty);else demo.cart.push({...p,qty});
  if(input)input.value=1; updateCartCount();toast(`${qty} × ${p.name} ajouté${qty>1?'s':''}`);
}
function updateCartCount(){
  const count=demo.cart.reduce((a,b)=>a+b.qty,0);
  ['#cartCount','#homeCartCount','#bottomCartCount','#packsCartCount'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    const changed=el.textContent!==String(count);
    el.textContent=count;
    if(changed){el.classList.remove('cart-bump');void el.offsetWidth;el.classList.add('cart-bump');}
  });
}
$('#cartButton')?.addEventListener('click',showCart);
$('#packsCartButton')?.addEventListener('click',showCart);
$('#homeCartShortcut')?.addEventListener('click',showCart);
$('#bottomCartButton')?.addEventListener('click',showCart);
$('#homeNewProductsLink')?.addEventListener('click',()=>{activeCategory='Nouveauté';nav('shop')});

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
  await getSettings();
  const [promos,rewards]=await Promise.all([
    getPromotions(),
    demo.profile&&!isStaff()?getLoyaltyRewards():Promise.resolve([])
  ]);
  demo.promotions=promos;
  demo.loyaltyRewards=rewards;
  if(!currentPromo)currentPromo=activeAutoPromo();
  if(currentRewardId&&!rewards.some(r=>String(r.id)===String(currentRewardId)))currentRewardId=null;
  currentOrderMode=settings.delivery_enabled?'delivery':'pickup';
  renderCartModal();
}
function selectedLoyaltyReward(){
  return (demo.loyaltyRewards||[]).find(r=>String(r.id)===String(currentRewardId))||null;
}
function applyRewardPreview(subtotal,discount,fee,reward){
  let rewardDiscount=0,nextFee=fee;
  if(!reward)return {rewardDiscount,nextFee};
  if(reward.reward_type==='free_delivery')nextFee=0;
  if(reward.reward_type==='fixed_discount')rewardDiscount=Math.min(Math.max(0,subtotal-discount),num(reward.reward_value));
  if(reward.reward_type==='percent_discount')rewardDiscount=Math.min(Math.max(0,subtotal-discount),subtotal*num(reward.reward_value)/100);
  return {rewardDiscount,nextFee};
}
function loyaltyRewardsHTML(points){
  if(!demo.profile||isStaff())return '';
  const rewards=demo.loyaltyRewards||[];
  if(!rewards.length)return '<div class="loyalty-rewards-empty">Aucune récompense configurée pour le moment.</div>';
  return `<div class="loyalty-reward-picker"><div class="loyalty-reward-head"><div><small>RÉCOMPENSES FIDÉLITÉ</small><strong>${points} points disponibles</strong></div>${currentRewardId?'<button onclick="selectLoyaltyReward(\'\')">Ne pas utiliser</button>':''}</div><div class="loyalty-reward-options">${rewards.map(r=>{
    const enough=points>=num(r.points_required);
    const compatible=!(r.reward_type==='free_delivery'&&currentOrderMode!=='delivery');
    const active=String(currentRewardId)===String(r.id);
    return `<button type="button" class="loyalty-reward-option ${active?'active':''}" onclick="selectLoyaltyReward('${r.id}')" ${enough&&compatible?'':'disabled'}><span><b>${num(r.points_required)} pts</b><strong>${esc(r.label)}</strong><small>${esc(rewardDescription(r))}</small></span><i data-lucide="${active?'circle-check-big':enough&&compatible?'gift':'lock-keyhole'}"></i></button>`;
  }).join('')}</div></div>`;
}
function renderCartModal(){
  const subtotal=cartSubtotal(),pts=num(demo.profile?.loyalty_points);
  const promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Votre panier</h3>
    <div>${demo.cart.map(x=>`<div class="cart-row"><div class="cart-main"><strong>${esc(x.name)}</strong><span class="cart-price">${money(x.price)} l’unité • ${money(num(x.price)*num(x.qty))}</span><button class="remove-link" onclick="removeCartItem('${x.id}')">Supprimer</button></div><div class="cart-qty"><button onclick="changeQty('${x.id}',-1)">−</button><input value="${x.qty}" type="number" min="1" max="999" inputmode="numeric" onchange="setCartQty('${x.id}',this.value)"><button onclick="changeQty('${x.id}',1)">+</button></div></div>`).join('')}</div>
    <div class="delivery-choice">${settings.delivery_enabled?`<button class="choice-card ${currentOrderMode==='delivery'?'active':''}" onclick="setOrderMode('delivery')"><strong>Livraison</strong><span>${money(settings.delivery_fee)} • ${settings.delivery_eta_min}–${settings.delivery_eta_max} min</span></button>`:''}${settings.pickup_enabled?`<button class="choice-card ${currentOrderMode==='pickup'?'active':''}" onclick="setOrderMode('pickup')"><strong>Retrait au LTD</strong><span>Sans frais de livraison</span></button>`:''}</div>
    ${loyaltyRewardsHTML(pts)}
    ${!demo.profile?`<div class="form-group"><label>Prénom & nom</label><input id="orderGuestName" autocomplete="off" placeholder="Votre nom"></div>`:''}
    ${currentOrderMode==='delivery'?`<div class="form-group"><label>Lieu de livraison</label><input id="deliveryAddress" value="${esc(demo.profile?.favorite_address||'')}" placeholder="Ex : domicile, entreprise, parking…"></div>`:''}
    <div class="form-group"><label>Numéro de téléphone</label><input id="orderPhone" value="${esc(demo.profile?.phone||'')}" placeholder="Votre numéro"></div>
    <div class="form-group"><label>Précision pour l’équipe</label><textarea id="orderNote" placeholder="Ex : appelez-moi en arrivant, entrée arrière…"></textarea></div>
    <div class="promo-row"><input id="promoCode" placeholder="Code promo" value="${currentPromo?.code&&!currentPromo.auto_apply?esc(currentPromo.code):''}"><button onclick="applyPromoCode()">Appliquer</button></div><div id="promoMessage" class="subtle">${currentPromo?`Offre appliquée : ${esc(currentPromo.name)}`:''}</div>
    <div class="totals" id="cartTotals"></div>
    ${num(settings.min_order)>0?`<p class="subtle">Minimum de commande : ${money(settings.min_order)}</p>`:''}
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Continuer</button><button class="btn primary" id="checkoutBtn" onclick="checkout()" ${settings.business_open?'':'disabled'}>${settings.business_open?'Valider la commande':'Commandes fermées'}</button></div>`);
  refreshCartTotals();
  iconRefresh();
}
window.selectLoyaltyReward=id=>{
  if(!demo.profile||isStaff())return;
  if(!id){currentRewardId=null;renderCartModal();return}
  const reward=(demo.loyaltyRewards||[]).find(r=>String(r.id)===String(id));
  if(!reward)return;
  if(num(demo.profile.loyalty_points)<num(reward.points_required))return toast('Points fidélité insuffisants.');
  if(reward.reward_type==='free_delivery'&&currentOrderMode!=='delivery')return toast('Cette récompense concerne la livraison.');
  currentRewardId=id;renderCartModal();
};
window.setOrderMode=mode=>{
  currentOrderMode=mode;
  const reward=selectedLoyaltyReward();
  if(reward?.reward_type==='free_delivery'&&mode!=='delivery')currentRewardId=null;
  renderCartModal();
};
window.changeQty=(id,d)=>{const r=demo.cart.find(x=>String(x.id)===String(id));if(!r)return;setCartQty(id,r.qty+d)};
window.setCartQty=(id,value)=>{const r=demo.cart.find(x=>String(x.id)===String(id));if(!r)return;let q=Math.floor(num(value));if(q<=0){removeCartItem(id);return}if(r.stock!==null&&r.stock!==undefined)q=Math.min(q,num(r.stock));r.qty=Math.min(999,q);updateCartCount();renderCartModal()};
window.removeCartItem=id=>{demo.cart=demo.cart.filter(x=>String(x.id)!==String(id));updateCartCount();if(demo.cart.length)renderCartModal();else showCart()};
window.refreshCartTotals=()=>{
  const subtotal=cartSubtotal(),promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo),reward=selectedLoyaltyReward();
  let fee=currentOrderMode==='delivery'&&!promoCalc.freeDelivery?num(settings.delivery_fee):0;
  const effect=applyRewardPreview(subtotal,promoCalc.discount,fee,reward);
  fee=effect.nextFee;
  const discount=Math.min(subtotal,promoCalc.discount+effect.rewardDiscount);
  const total=Math.max(0,subtotal-discount)+fee;
  if($('#cartTotals'))$('#cartTotals').innerHTML=`<div class="total-line"><span>Sous-total</span><strong>${money(subtotal)}</strong></div>${promoCalc.discount?`<div class="total-line"><span>Promotion</span><strong>− ${money(promoCalc.discount)}</strong></div>`:''}${effect.rewardDiscount?`<div class="total-line reward-total"><span>Récompense fidélité</span><strong>− ${money(effect.rewardDiscount)}</strong></div>`:''}<div class="total-line"><span>${currentOrderMode==='delivery'?'Livraison':'Retrait'}</span><strong>${fee?money(fee):'Offert'}</strong></div><div class="total-line grand"><span>Total</span><strong>${money(total)}</strong></div>`;
};
window.applyPromoCode=async()=>{
  const code=($('#promoCode')?.value||'').trim().toUpperCase();const promos=await getPromotions();
  if(!code){currentPromo=activeAutoPromo();renderCartModal();return}
  const p=promos.find(x=>String(x.code||'').toUpperCase()===code&&!x.auto_apply);
  if(!p){currentPromo=activeAutoPromo();$('#promoMessage').textContent='Code non reconnu ou expiré.';refreshCartTotals();return}
  if(cartSubtotal()<num(p.min_subtotal)){toast(`Cette offre nécessite ${money(p.min_subtotal)} de commande.`);return}
  currentPromo=p;renderCartModal();toast('Code promo appliqué.');
};

window.showGuestChoice=()=>{
  openModal(`<button class="icon-btn close" onclick="renderCartModal()">×</button><span class="eyebrow">FINALISER LA COMMANDE</span><h3>Comment voulez-vous continuer ?</h3><p class="page-intro">Vous pouvez continuer sans compte, mais cette commande ne vous donnera aucun point de fidélité.</p><div class="guest-choice-grid"><button class="guest-choice-card primary-choice" onclick="showAuth('login')"><i data-lucide="log-in"></i><div><strong>Se connecter</strong><span>Profiter de votre compte et de vos points fidélité.</span></div></button><button class="guest-choice-card" onclick="submitGuestOrder()"><i data-lucide="shopping-bag"></i><div><strong>Continuer sans compte</strong><span>Envoyer directement la commande avec les informations déjà renseignées.</span></div></button></div><div class="modal-actions"><button class="btn ghost" onclick="renderCartModal()">Retour au panier</button></div>`);
  iconRefresh();
};

window.submitGuestOrder=async()=>{
  const draft=guestOrderDraft||{};
  const name=String(draft.name||'').trim(),phone=String(draft.phone||'').trim();
  const address=currentOrderMode==='delivery'?String(draft.address||'').trim():settings.address;
  const note=String(draft.note||'').trim();
  if(!name)return toast('Indiquez votre prénom et nom.');
  if(!phone)return toast('Indiquez un numéro de téléphone.');
  if(currentOrderMode==='delivery'&&!address)return toast('Indiquez un lieu de livraison.');
  const items=demo.cart.map(x=>({product_id:x.id,quantity:x.qty}));
  const promoCode=currentPromo?.code||null;
  if(hasSupabase){
    const {data,error}=await sb.rpc('create_guest_order',{p_items:items,p_fulfillment:currentOrderMode,p_address:address,p_phone:phone,p_customer_name:name,p_note:note,p_promo_code:promoCode});
    if(error){console.error(error);return toast(error.message||'La commande n’a pas pu être créée.')}
    await invokeDiscordOrders({action:'created',public_code:data});
    demo.cart=[];currentPromo=null;currentRewardId=null;guestOrderDraft=null;updateCartCount();
    openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">COMMANDE ENVOYÉE</span><h3>#${esc(data)}</h3><p class="page-intro">Votre commande a bien été transmise au LTD. Gardez ce numéro si besoin.</p><div class="notice"><i data-lucide="badge-check"></i><div><strong>Sans compte</strong><span>Aucun point fidélité n’est ajouté sur cette commande.</span></div></div><div class="modal-actions"><button class="btn primary" onclick="closeModal();nav('home')">Terminer</button></div>`);
    iconRefresh();
  }else toast('La base centrale est nécessaire pour envoyer une commande.');
};

window.checkout=async()=>{
  if(!settings.business_open)return toast('Les commandes sont momentanément fermées.');
  const subtotal=cartSubtotal();if(subtotal<num(settings.min_order))return toast(`Minimum de commande : ${money(settings.min_order)}.`);
  if(!demo.profile){
    const name=($('#orderGuestName')?.value||'').trim();
    const phone=($('#orderPhone')?.value||'').trim();
    const address=currentOrderMode==='delivery'?($('#deliveryAddress')?.value||'').trim():settings.address;
    const note=($('#orderNote')?.value||'').trim();
    if(!name)return toast('Indiquez votre prénom et nom.');
    if(!phone)return toast('Indiquez un numéro de téléphone.');
    if(currentOrderMode==='delivery'&&!address)return toast('Indiquez un lieu de livraison.');
    guestOrderDraft={name,phone,address,note};
    return showGuestChoice();
  }
  const phone=($('#orderPhone')?.value||demo.profile.phone||'').trim();
  if(!phone)return toast('Indiquez un numéro de téléphone.');
  const address=currentOrderMode==='delivery'?($('#deliveryAddress')?.value||'').trim():settings.address;
  if(currentOrderMode==='delivery'&&!address)return toast('Indiquez un lieu de livraison.');
  const note=($('#orderNote')?.value||'').trim(),promoCode=currentPromo?.code||null;
  const items=demo.cart.map(x=>({product_id:x.id,quantity:x.qty}));
  if(hasSupabase){
    const {data,error}=await sb.rpc('create_customer_order_v2',{p_items:items,p_fulfillment:currentOrderMode,p_address:address,p_phone:phone,p_note:note,p_reward_id:currentRewardId||null,p_promo_code:promoCode});
    if(error){console.error(error);return toast(error.message||'La commande n’a pas pu être créée.')}
    await invokeDiscordOrders({action:'created',public_code:data});
    await getCurrentProfile();demo.cart=[];currentPromo=null;currentRewardId=null;updateCartCount();closeModal();toast(`Commande ${data} envoyée.`);nav('orders');
  }else{
    const promoCalc=computeDiscount(subtotal,currentOrderMode,currentPromo),reward=selectedLoyaltyReward();
    let fee=currentOrderMode==='delivery'&&!promoCalc.freeDelivery?num(settings.delivery_fee):0;
    const effect=applyRewardPreview(subtotal,promoCalc.discount,fee,reward);fee=effect.nextFee;
    const discount=Math.min(subtotal,promoCalc.discount+effect.rewardDiscount);
    if(reward)demo.profile.loyalty_points=Math.max(0,num(demo.profile.loyalty_points)-num(reward.points_required));
    storageSet(LS.profile,demo.profile);
    const totalUnits=demo.cart.reduce((a,x)=>a+num(x.qty),0);
    const o={id:uid('order'),public_code:`SS-${Math.random().toString(36).slice(2,7).toUpperCase()}`,user_id:demo.profile.id,customer_name:demo.profile.display_name,customer_phone:phone,fulfillment:currentOrderMode,delivery_address:address,note,subtotal,discount,delivery_fee:fee,total:Math.max(0,subtotal-discount)+fee,status:'pending',used_loyalty_reward:Boolean(reward),loyalty_points_spent:num(reward?.points_required),loyalty_reward_label:reward?.label||null,loyalty_awarded:false,assigned_to:null,assigned_name:null,eta_min:settings.delivery_eta_min,eta_max:settings.delivery_eta_max,total_units:totalUnits,is_large_order:totalUnits>=num(settings.large_order_item_threshold),created_at:new Date().toISOString(),items:demo.cart.map(x=>({...x})),events:[{status:'pending',actor_name:demo.profile.display_name||'Client',created_at:new Date().toISOString()}]};
    demo.orders.unshift(o);storageSet(LS.orders,demo.orders);demo.cart=[];currentPromo=null;currentRewardId=null;updateCartCount();closeModal();toast(`Commande ${o.public_code} envoyée.`);nav('orders');
  }
};


function loyaltyLevel(points){
  if(points>=300)return {name:'BLACK',icon:'crown'};
  if(points>=150)return {name:'OR',icon:'gem'};
  if(points>=50)return {name:'SABLE',icon:'sparkles'};
  return {name:'MEMBRE',icon:'badge'};
}
function renderLoyaltyCard(){
  const el=$('#loyaltyVisualCard');if(!el)return;
  if(!demo.profile||isStaff()){el.classList.add('hidden');return}
  const pts=num(demo.profile.loyalty_points),rewards=(demo.loyaltyRewards||[]).filter(r=>r.active!==false).sort((a,b)=>num(a.points_required)-num(b.points_required));
  const next=rewards.find(r=>num(r.points_required)>pts)||rewards[rewards.length-1]||null;
  const target=next?Math.max(1,num(next.points_required)):100;
  const level=loyaltyLevel(pts),progress=Math.min(100,pts/target*100);
  const unlocked=rewards.filter(r=>pts>=num(r.points_required));
  el.classList.remove('hidden');
  el.innerHTML=`<div class="loyalty-card-top"><div><small>LTD SANDY SHORES</small><strong>CARTE FIDÉLITÉ</strong></div><i data-lucide="${level.icon}"></i></div>
    <div class="loyalty-card-name">${esc(demo.profile.display_name||'Client LTD')}</div>
    <div class="loyalty-card-bottom"><div><small>POINTS</small><strong>${pts}</strong></div><div><small>NIVEAU</small><strong>${level.name}</strong></div></div>
    <div class="loyalty-card-progress"><span style="width:${progress}%"></span></div>
    <small class="loyalty-card-next">${unlocked.length?`${unlocked.length} récompense${unlocked.length>1?'s':''} disponible${unlocked.length>1?'s':''}`:(next?`${Math.max(0,num(next.points_required)-pts)} points avant « ${esc(next.label)} »`:'Vos récompenses apparaîtront ici.')}</small>`;
  iconRefresh();
}
function orderEventTime(events,status){
  const event=(events||[]).find(e=>e.status===status);
  return event?new Date(event.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
}
function clientOrderTimeline(o,events=[]){
  if(o.status==='cancelled')return `<div class="tracking-cancelled"><i data-lucide="circle-x"></i><div><strong>Commande annulée</strong><span>${esc(o.cancelled_reason||'')}</span></div></div>`;
  const delivery=o.fulfillment!=='pickup';
  const steps=delivery
    ? [['pending','Commande reçue','receipt-text'],['accepted',o.assigned_name?`Prise par ${o.assigned_name}`:'Prise en charge','user-check'],['preparing','Préparation','cooking-pot'],['out_for_delivery','En route','bike'],['delivered','Livrée','badge-check']]
    : [['pending','Commande reçue','receipt-text'],['accepted',o.assigned_name?`Prise par ${o.assigned_name}`:'Prise en charge','user-check'],['preparing','Préparation','cooking-pot'],['ready','Prête au retrait','package-check'],['delivered','Récupérée','badge-check']];
  const seq=steps.map(x=>x[0]),current=seq.includes(o.status)?seq.indexOf(o.status):(o.status==='ready'&&delivery?2:0);
  const avatar=o.assigned_name?String(o.assigned_name).split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase():'';
  return `<div class="premium-tracking">
    ${o.assigned_name?`<div class="tracking-driver"><div class="tracking-avatar">${avatar}</div><div><small>PRISE EN CHARGE PAR</small><strong>${esc(o.assigned_name)}</strong></div></div>`:''}
    <div class="tracking-steps">${steps.map((step,i)=>`<div class="tracking-step ${i<=current?'done':''} ${i===current?'current':''}">
      <div class="tracking-dot"><i data-lucide="${step[2]}"></i></div>
      <div class="tracking-copy"><strong>${esc(step[1])}</strong><span>${orderEventTime(events,step[0])|| (i===0?new Date(o.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')}</span></div>
    </div>`).join('')}</div>
  </div>`;
}
function clientOrderHTML(o,events=[]){
  const items=o.order_items||o.items||[],code=o.public_code||`SS-${String(o.id).slice(-5).toUpperCase()}`;
  return `<article class="order-card premium-order-card"><div class="meta"><span class="order-code">#${esc(code)}</span><span>${formatDate(o.created_at)}</span></div>
    <div class="premium-order-head"><div><h4>${money(o.total)}</h4><p>${o.fulfillment==='pickup'?'Retrait au LTD':esc(o.delivery_address||'')}</p></div><span class="status ${esc(o.status)}">${statusLabel(o.status)}</span></div>
    ${clientOrderTimeline(o,events)}
    <div class="order-detail-grid"><div class="mini-info"><span>Articles</span><strong>${items.reduce((a,x)=>a+num(x.quantity||x.qty),0)||'—'}</strong></div><div class="mini-info"><span>${o.fulfillment==='pickup'?'Retrait':'Estimation'}</span><strong>${o.fulfillment==='pickup'?'Dès que prête':`${o.eta_min||settings.delivery_eta_min}–${o.eta_max||settings.delivery_eta_max} min`}</strong></div></div>
    <div class="order-actions"><button onclick="showOrderDetail('${o.id}')">Détails</button>${o.status==='delivered'?`<button class="primary-action reorder-premium" onclick="reorderOrder('${o.id}')"><i data-lucide="rotate-ccw"></i> Recommander en 1 clic</button>`:''}</div>
  </article>`;
}
async function renderPromoBanner(){
  const home=$('#homePromoBanner'),shop=$('#promoStrip');
  if(!home&&!shop)return;
  const promos=await getPromotions();
  const now=Date.now();
  const active=promos.find(p=>p.active!==false&&p.banner_enabled!==false&&(!p.starts_at||new Date(p.starts_at).getTime()<=now)&&(!p.ends_at||new Date(p.ends_at).getTime()>=now));
  if(!active){
    home?.classList.add('hidden');shop?.classList.add('hidden');
    if(promoCountdownTimer){clearInterval(promoCountdownTimer);promoCountdownTimer=null}
    return;
  }
  let product=null;
  if(active.product_id){
    const products=demo.products.length?demo.products:await getProducts();
    product=products.find(p=>String(p.id)===String(active.product_id));
  }
  const fallback=active.banner_text||`${active.name}${active.code?` • Code ${active.code}`:''}`;
  const countdown=active.ends_at?`<span class="promo-countdown" data-promo-end="${esc(active.ends_at)}"></span>`:'';
  const html=`<div class="promo-banner-icon">${product?esc(product.emoji||'🏷️'):'🏷️'}</div><div class="promo-banner-copy"><small>OFFRE FLASH</small><strong>${esc(fallback)}</strong>${product?`<span>${esc(product.name)} • ${money(product.price)}</span>`:''}${countdown}</div>${active.code?`<button onclick="navigator.clipboard?.writeText('${esc(active.code)}');toast('Code copié !')">COPIER ${esc(active.code)}</button>`:''}`;
  if(home){home.innerHTML=html;home.classList.remove('hidden')}
  if(shop){shop.innerHTML=html;shop.classList.remove('hidden')}
  startPromoCountdown();
  iconRefresh();
}

async function renderOrders(){
  if(isPreviewMode() && previewRole==='customer'){
    $('#ordersList').innerHTML=`<div class="empty"><strong>Aperçu client</strong><br><br>Un client connecté retrouvera ici ses commandes et leur suivi.</div>`;return;
  }
  if(!demo.profile){$('#loyaltyVisualCard')?.classList.add('hidden');$('#ordersList').innerHTML=`<div class="empty">Connectez-vous pour retrouver vos commandes.<br><br><button class="btn primary" onclick="showAuth('login')">Se connecter</button></div>`;return}
  demo.loyaltyRewards=await getLoyaltyRewards();
  renderLoyaltyCard();
  let orders=[],events=[];
  if(hasSupabase){
    const {data}=await sb.from('orders').select('*,order_items(*)').eq('user_id',demo.profile.id).order('created_at',{ascending:false});
    orders=data||[];
    const ids=orders.map(o=>o.id);
    if(ids.length){const ev=await sb.from('order_events').select('*').in('order_id',ids).order('created_at',{ascending:true});events=ev.data||[]}
  }else{orders=demo.orders.filter(o=>o.user_id===demo.profile.id);events=orders.flatMap(o=>(o.events||[]).map(e=>({...e,order_id:o.id})))}
  const byOrder=new Map();for(const e of events){const arr=byOrder.get(String(e.order_id))||[];arr.push(e);byOrder.set(String(e.order_id),arr)}
  $('#ordersList').innerHTML=orders.map(o=>clientOrderHTML(o,byOrder.get(String(o.id))||[])).join('')||'<div class="empty">Aucune commande pour le moment.</div>';iconRefresh();
}
$('#refreshOrders').addEventListener('click',renderOrders);
$('#refreshReviews')?.addEventListener('click',renderReviews);
function statusLabel(s){return ({pending:'Commande reçue',accepted:'Confirmée',preparing:'En préparation',ready:'Prête',out_for_delivery:'Livreur en route',delivered:'Livrée',cancelled:'Annulée'})[s]||s}
function orderProgress(status){const seq=['pending','accepted','preparing','out_for_delivery','delivered'];if(status==='ready')return 3;return Math.max(0,seq.indexOf(status))}
function orderHTML(o,staff=false){
  const items=o.order_items||o.items||[],progress=orderProgress(o.status),code=o.public_code||`SS-${String(o.id).slice(-5).toUpperCase()}`;
  const ops=`${o.is_large_order?'<span class="operational-badge large"><i data-lucide="boxes"></i> GROSSE COMMANDE</span>':''}${o._delayed?'<span class="operational-badge delayed"><i data-lucide="alarm-clock"></i> EN RETARD</span>':''}`;
  return `<article class="order-card ${o.is_large_order?'large-order-card':''} ${o._delayed?'delayed-order-card':''}"><div class="meta"><span class="order-code">#${esc(code)}</span><span>${formatDate(o.created_at)}</span></div>${ops?`<div class="operational-badges">${ops}</div>`:''}<h4>${staff?`${esc(o.customer_name||'Client')} • `:''}${money(o.total)}</h4><p>${o.fulfillment==='pickup'?'Retrait au LTD':esc(o.delivery_address||'')}</p><div class="status-line"><span class="status ${esc(o.status)}">${statusLabel(o.status)}</span>${o.assigned_name?`<span class="subtle">Pris par ${esc(o.assigned_name)}</span>`:''}</div>${o.status!=='cancelled'?`<div class="timeline">${[0,1,2,3,4].map(i=>`<span class="timeline-step ${i<=progress?'done':''}"></span>`).join('')}</div>`:''}<div class="order-detail-grid"><div class="mini-info"><span>${o.fulfillment==='pickup'?'Retrait':'Estimation'}</span><strong>${o.fulfillment==='pickup'?'Dès que la commande est prête':`${o.eta_min||settings.delivery_eta_min}–${o.eta_max||settings.delivery_eta_max} min`}</strong></div><div class="mini-info"><span>Articles</span><strong>${num(o.total_units)||items.reduce((a,x)=>a+num(x.quantity||x.qty),0)||'—'}</strong></div></div>${o.cancelled_reason?`<p style="margin-top:10px;color:#ffaaaa">Motif : ${esc(o.cancelled_reason)}</p>`:''}${staff?staffActions(o):`<div class="order-actions"><button onclick="showOrderDetail('${o.id}')">Voir le détail</button>${o.status==='delivered'?`<button class="primary-action" onclick="reorderOrder('${o.id}')">Recommander</button>`:''}</div>`}</article>`;
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
  if(isPreviewMode()) return `<div class="order-actions"><button disabled>Aperçu uniquement</button><button onclick="showStaffOrder('${o.id}')">Détails</button></div>`;
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
async function renderStaffHome(){
  if(!uiIsStaff()||!$('#staffHomeDashboard'))return;
  const preview=isPreviewMode();
  $('#staffHomeGreeting').textContent=preview?'Aperçu de l’espace employé':`Bonjour ${String(demo.profile?.display_name||'').split(' ')[0]||''}`.trim();
  $('#staffHomeRole').textContent=roleLabel(uiDetailedRole()||demo.profile?.role||'employee')+(preview?' • aperçu':'');
  const open=Boolean(settings.business_open);
  $('#staffBusinessStatus').textContent=open?'Ouvert':'Fermé';
  const toggle=$('#staffBusinessToggle');
  if(toggle){
    toggle.classList.toggle('closed',!open);
    toggle.disabled=preview||!uiCan('business_status_manage');
    toggle.innerHTML=`<i data-lucide="power"></i><span>${open?'Fermer le LTD':'Ouvrir le LTD'}</span>`;
    toggle.title=preview?'Mode aperçu : modification désactivée':(uiCan('business_status_manage')?'Changer le statut du LTD':'Ce rôle n’a pas cette permission');
  }
  $('#staffAdminShortcut')?.classList.toggle('hidden',!uiCanManageAnything());
  $('#staffHomeOrdersWrap')?.classList.toggle('hidden',!uiCan('orders_view'));

  let notifications=[],ranking=[],orders=[];
  if(!preview&&isStaff()){
    [notifications,ranking]=await Promise.all([getStaffNotifications(50),getDeliveryRanking()]);
    renderNotificationBadges(notifications);renderStaffDelayAlert(notifications);renderStaffRanking(ranking);
  }else{
    renderNotificationBadges([]);renderStaffDelayAlert([]);renderStaffRanking([]);
  }

  if(uiCan('orders_view')){
    if(hasSupabase){
      const {data,error}=await sb.from('orders').select('*').not('status','in','(delivered,cancelled)').order('created_at',{ascending:false}).limit(25);
      if(!error)orders=data||[];
    }else orders=demo.orders.filter(o=>!['delivered','cancelled'].includes(o.status));
    const delayedIds=new Set(notifications.filter(n=>n.type==='order_delay'&&n.order_id).map(n=>String(n.order_id)));
    orders=orders.map(o=>({...o,_delayed:delayedIds.has(String(o.id))}));
    $('#staffHomeOrders').innerHTML=orders.map(o=>orderHTML(o,true)).join('')||'<div class="empty">Aucune commande à traiter.</div>';
  }
  iconRefresh();
}
window.toggleBusinessStatus=async()=>{
  if(blockPreviewMutation())return;
  if(!isStaff())return showEmployeeAccess();
  if(!can('business_status_manage'))return toast('Votre rôle n’a pas l’autorisation de changer le statut.');
  const next=!Boolean(settings.business_open);
  try{
    if(hasSupabase){const{error}=await sb.rpc('set_business_status',{p_open:next});if(error)throw error}
    else{settings.business_open=next;storageSet(LS.settings,settings)}
    settings.business_open=next;applySettingsToUI();await renderStaffHome();toast(next?'LTD ouvert.':'LTD fermé.');
  }catch(err){toast(err.message||'Modification impossible.');}
};

window.claimOrder=async id=>{
  if(blockPreviewMutation())return;
  if(hasSupabase){const{error}=await sb.rpc('claim_order',{p_order_id:id});if(error)return toast(error.message||'Commande déjà prise.');}
  else{const o=demo.orders.find(x=>String(x.id)===String(id));if(!o)return;if(o.assigned_to&&String(o.assigned_to)!==String(demo.profile.id))return toast('Cette commande est déjà prise.');o.assigned_to=demo.profile.id;o.assigned_name=demo.profile.display_name;o.assigned_at=new Date().toISOString();if(o.status==='pending')o.status='accepted';o.events=o.events||[];o.events.push({status:o.status,actor_name:demo.profile.display_name||'Employé',created_at:new Date().toISOString()});storageSet(LS.orders,demo.orders)}
  if(hasSupabase)await invokeDiscordOrders({action:'claimed',order_id:id});
  toast('Commande attribuée.');renderStaffHome();
};
window.setOrderStatus=async(id,status)=>{
  if(blockPreviewMutation())return;
  if(hasSupabase){const{error}=await sb.rpc('set_order_status',{p_order_id:id,p_status:status,p_reason:null});if(error)return toast(error.message||'Modification impossible.');}
  else{
    const o=demo.orders.find(x=>String(x.id)===String(id));if(!o)return;o.status=status;o.events=o.events||[];o.events.push({status,actor_name:demo.profile?.display_name||'Équipe',created_at:new Date().toISOString()});
    if(status==='delivered'&&!o.loyalty_awarded){o.loyalty_awarded=true;o.delivered_at=new Date().toISOString();const owner=demo.profile?.id===o.user_id;if(owner){demo.profile.loyalty_points=num(demo.profile.loyalty_points)+num(settings.points_per_order);storageSet(LS.profile,demo.profile)}}storageSet(LS.orders,demo.orders);
  }
  if(hasSupabase)await invokeDiscordOrders({action:'status',order_id:id});
  toast(`Commande : ${statusLabel(status)}`);renderStaffHome();
};
window.cancelOrderPrompt=id=>openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Annuler la commande</h3><p class="page-intro">Un motif est obligatoire et sera conservé dans l’historique de la commande.</p><div class="form-group"><label>Motif</label><select id="cancelReasonPreset"><option value="">Choisir un motif…</option><option>Client absent / injoignable</option><option>Article indisponible</option><option>Zone inaccessible</option><option>Erreur dans la commande</option><option>Demande du client</option><option value="Autre">Autre</option></select></div><div class="form-group"><label>Précision (facultatif sauf “Autre”)</label><textarea id="cancelReasonDetail" placeholder="Ajoutez une précision si nécessaire…"></textarea></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Retour</button><button class="btn primary" onclick="confirmCancel('${id}')">Confirmer l’annulation</button></div>`);
window.confirmCancel=async id=>{
  if(blockPreviewMutation())return;
  const preset=($('#cancelReasonPreset')?.value||'').trim(),detail=($('#cancelReasonDetail')?.value||'').trim();
  if(!preset)return toast('Choisissez un motif d’annulation.');
  if(preset==='Autre'&&!detail)return toast('Précisez le motif.');
  const reason=detail?`${preset} — ${detail}`:preset;
  if(hasSupabase){const{error}=await sb.rpc('set_order_status',{p_order_id:id,p_status:'cancelled',p_reason:reason});if(error)return toast(error.message)}
  else{const o=demo.orders.find(x=>String(x.id)===String(id));if(o){o.status='cancelled';o.cancelled_reason=reason;o.events=o.events||[];o.events.push({status:'cancelled',actor_name:demo.profile?.display_name||'Équipe',created_at:new Date().toISOString()});storageSet(LS.orders,demo.orders)}}
  if(hasSupabase)await invokeDiscordOrders({action:'status',order_id:id});
  closeModal();toast('Commande annulée.');renderStaffHome();
};
window.showStaffOrder=async id=>{closeModal();showOrderDetail(id)};

function showAuth(mode='login'){
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">COMPTE CLIENT</span><h3>${mode==='login'?'Connexion':'Créer un compte'}</h3>${mode==='signup'?`<div class="form-group"><label>Prénom & nom</label><input id="authName" autocomplete="off" placeholder="Prénom Nom"></div><div class="form-group"><label>Téléphone</label><input id="authPhone" autocomplete="off" placeholder="Votre numéro"></div>`:''}<div class="form-group"><label>Identifiant</label><input id="authUsername" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ex : jett"></div><div class="form-group"><label>Mot de passe</label><input id="authPass" type="password" autocomplete="new-password" placeholder="••••••••"></div><div class="modal-actions"><button class="btn ghost" onclick="showAuth('${mode==='login'?'signup':'login'}')">${mode==='login'?'Créer un compte':'J’ai déjà un compte'}</button><button class="btn primary" onclick="submitAuth('${mode}')">${mode==='login'?'Se connecter':'Créer mon compte'}</button></div><p class="subtle" style="margin-top:12px">Aucun email ni vérification par mail n’est nécessaire.</p>`);
}
window.showAuth=showAuth;
window.submitAuth=async mode=>{
  const username=normalizeStaffUsername($('#authUsername')?.value||''),pass=$('#authPass')?.value||'';
  if(!username||!pass)return toast('Identifiant et mot de passe obligatoires.');
  if(!hasSupabase)return requireCentralDatabase(mode==='signup'?'la création de compte':'la connexion');
  try{
    const payload=mode==='signup'
      ? {action:'create_client',username,password:pass,display_name:($('#authName')?.value||'').trim(),phone:($('#authPhone')?.value||'').trim()}
      : {action:'login_client',username,password:pass};
    if(mode==='signup'&&!payload.display_name)return toast('Prénom et nom obligatoires.');
    const result=await invokeAdminUsers(payload);
    if(!result?.session?.access_token||!result?.session?.refresh_token)throw new Error('Session introuvable.');
    const {error}=await sb.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
    if(error)throw error;
    closeModal();await initAuth();toast(mode==='signup'?'Compte créé et connecté.':'Connexion réussie.');
  }catch(err){toast(err?.message||'Connexion impossible.');}
};
function showEmployeeAccess(){
  if(isStaff()){nav('home');return}
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
        try{
          await invokeAdminUsers({action:'bootstrap_direction',username,password:pass});
          ({error}=await sb.auth.signInWithPassword({email:staffEmail(username),password:pass}));
        }catch(bootErr){
          const msg=String(bootErr?.message||'').toLowerCase();
          const alreadyActivated=msg.includes('déjà')||msg.includes('already')||msg.includes('activé')||msg.includes('used')||msg.includes('utilisé');
          if(!alreadyActivated)throw bootErr;
          // Le compte existe déjà : on conserve simplement l'erreur de connexion initiale.
        }
      }
      if(error)throw error;
    }else{
      requireCentralDatabase('la connexion employé');
      return;
    }
    closeModal(true);await initAuth();isStaff()?nav('home'):toast('Ce compte ne possède pas d’accès employé.');
  }catch(err){toast(err.message==='Invalid login credentials'?'Identifiant ou mot de passe incorrect.':(err.message||'Connexion impossible.'));}
};

function showPasswordChange(required=false){
  if(!demo.user)return;
  const title=required?'Nouveau mot de passe obligatoire':'Changer le mot de passe';
  openModal(`${required?'':`<button class="icon-btn close" onclick="closeModal()">×</button>`}<span class="eyebrow">SÉCURITÉ</span><h3>${title}</h3><p class="page-intro">${required?'Votre mot de passe actuel est temporaire. Choisissez-en un nouveau avant de continuer.':'Choisissez un nouveau mot de passe.'}</p><div class="form-group"><label>Nouveau mot de passe</label><input id="newPassword" type="password" autocomplete="new-password" placeholder="8 caractères minimum"></div><div class="form-group"><label>Confirmer</label><input id="confirmPassword" type="password" autocomplete="new-password" placeholder="Répétez le mot de passe"></div><div class="modal-actions">${required?`<button class="btn ghost" onclick="logoutFromPasswordPrompt()">Se déconnecter</button>`:''}<button class="btn primary" onclick="saveMyNewPassword(${required?'true':'false'})">Enregistrer</button></div>`,required);
}
window.showPasswordChange=showPasswordChange;
window.LTD_BUILD='9.0.0';
console.info('[LTD Sandy Shores] build',window.LTD_BUILD);
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
$('#employeeAccessBtn')?.addEventListener('click',()=>isStaff()?nav('home'):showEmployeeAccess());
$('#employeeFooterBtn')?.addEventListener('click',()=>isStaff()?showAccount():showEmployeeAccess());
$('#accountBtn')?.addEventListener('click',showAccount);
$('#staffBusinessToggle')?.addEventListener('click',toggleBusinessStatus);
$('#staffHomeRefresh')?.addEventListener('click',()=>renderStaffHome());
$('#staffHomeProfileBtn')?.addEventListener('click',()=>editProfile());
$('#staffAccountShortcut')?.addEventListener('click',()=>showAccount());
$('#staffNotificationButton')?.addEventListener('click',()=>showStaffNotificationCenter());
$('#staffNotificationShortcut')?.addEventListener('click',()=>showStaffNotificationCenter());
$('#staffAdminShortcut')?.addEventListener('click',()=>canManageAnything()?nav('admin'):toast('Aucun accès administration.'));
$('#staffOrdersShortcut')?.addEventListener('click',()=>{if(!can('orders_view'))return toast('Votre rôle n’a pas accès aux commandes.');document.getElementById('staffHomeOrdersWrap')?.scrollIntoView({behavior:'smooth'});});
function satisfactionLabel(v){
  return ({tres_satisfait:'Très satisfait',satisfait:'Satisfait',moyennement_satisfait:'Moyennement satisfait',insatisfait:'Insatisfait'})[v]||'Satisfait';
}
function roleLabel(r){return STAFF_ROLES[r]||({customer:'Client',employee:'Employé',manager:'Responsable',admin:'Direction'})[r]||r}
async function showAccount(){
  if(!demo.profile)return showAuth('login');
  const identity=isStaff()&&demo.profile.staff_username?`<span>@${esc(demo.profile.staff_username)}</span>`:(demo.profile?.client_username?`<span>@${esc(demo.profile.client_username)}</span>`:'');
  if(isStaff()){
    const stats=await getMyStaffStats();
    const avatar=demo.profile.avatar_url?`<img src="${esc(demo.profile.avatar_url)}" alt="">`:esc((demo.profile.display_name||'E').slice(0,1).toUpperCase());
    openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><section class="staff-profile-hero"><div class="staff-profile-avatar">${avatar}</div><div><span class="eyebrow">PROFIL EMPLOYÉ</span><h3>${esc(demo.profile.display_name||'Employé')}</h3>${identity}<span class="role-badge">${esc(roleLabel(detailedRole()||demo.profile.role||'employee'))}</span></div></section>
      <div class="staff-profile-stats"><div><small>LIVRAISONS</small><strong>${num(stats?.delivered_orders)}</strong></div><div><small>NOTE</small><strong>⭐ ${num(stats?.avg_rating).toFixed(1)}</strong></div><div><small>SATISFACTION</small><strong>${num(stats?.satisfaction_rate)} %</strong></div><div><small>CLASSEMENT</small><strong>${num(stats?.ranking)?'#'+num(stats?.ranking):'—'}</strong></div></div>
      ${demo.profile.profile_bio?`<div class="staff-profile-bio">${esc(demo.profile.profile_bio)}</div>`:''}
      <div class="account-actions"><button class="btn ghost" onclick="editProfile()"><i data-lucide="user-pen"></i> Modifier mon profil</button><button class="btn ghost" type="button" data-ltd-action="change-password"><i data-lucide="lock-keyhole"></i> Changer mon mot de passe</button><button class="btn ghost" onclick="showStaffNotificationCenter()"><i data-lucide="bell-ring"></i> Centre de notifications</button>${canManageAnything()?`<button class="btn primary" onclick="closeModal();nav('admin')"><i data-lucide="layout-dashboard"></i> Administration</button>`:''}${canUseRolePreview()?`<button class="btn ghost" type="button" data-ltd-action="role-preview"><i data-lucide="scan-eye"></i> Voir comme…</button>`:''}<button class="btn ghost danger" onclick="logout()"><i data-lucide="log-out"></i> Se déconnecter</button></div>`);
    iconRefresh();return;
  }
  demo.loyaltyRewards=await getLoyaltyRewards();
  const next=(demo.loyaltyRewards||[]).find(r=>num(r.points_required)>num(demo.profile.loyalty_points));
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><div class="account-head"><div class="avatar">${esc((demo.profile.display_name||'C').slice(0,1).toUpperCase())}</div><div class="account-meta"><strong>${esc(demo.profile.display_name||'Mon compte')}</strong>${identity}<span>${esc(demo.profile.phone||'Téléphone non renseigné')}</span><span class="role-badge">Client</span></div></div><div class="loyalty-box"><strong>${num(demo.profile.loyalty_points)} points fidélité</strong><div>${next?`${Math.max(0,num(next.points_required)-num(demo.profile.loyalty_points))} points avant « ${esc(next.label)} »`:'Vous avez accès à vos récompenses fidélité.'}</div></div><div class="account-actions"><button class="btn ghost" onclick="editProfile()"><i data-lucide="user-pen"></i> Mes informations</button><button class="btn ghost" type="button" data-ltd-action="change-password"><i data-lucide="lock-keyhole"></i> Changer mon mot de passe</button><button class="btn ghost" onclick="showLoyaltyHistory()"><i data-lucide="history"></i> Historique fidélité</button><button class="btn ghost danger" onclick="logout()"><i data-lucide="log-out"></i> Se déconnecter</button></div>`);
  iconRefresh();
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
  let events=[];const rewards=await getLoyaltyRewards();
  if(hasSupabase){const{data}=await sb.from('loyalty_events').select('*').eq('user_id',demo.profile.id).order('created_at',{ascending:false});events=data||[]}
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Fidélité</h3><div class="loyalty-box"><strong>${num(demo.profile.loyalty_points)} points disponibles</strong><div>${rewards.length?`${rewards.length} récompense${rewards.length>1?'s':''} active${rewards.length>1?'s':''} actuellement.`:'Les récompenses seront bientôt disponibles.'}</div></div>${rewards.length?`<div class="loyalty-history-rewards">${rewards.map(r=>`<div class="mini-info"><span>${num(r.points_required)} points</span><strong>${esc(r.label)}</strong><small>${esc(rewardDescription(r))}</small></div>`).join('')}</div><div class="divider"></div>`:''}${events.length?events.map(e=>`<div class="total-line"><span>${esc(e.description||'Mouvement fidélité')}<br><small>${formatDate(e.created_at)}</small></span><strong>${num(e.points)>0?'+':''}${num(e.points)} pts</strong></div>`).join(''):'<div class="empty">L’historique apparaîtra ici après vos premières commandes livrées.</div>'}`);
  iconRefresh();
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

function adminHistoryMatches(order){
  const q=($('#adminHistorySearch')?.value||'').trim().toLowerCase();
  const date=($('#adminHistoryDate')?.value||'').trim();
  const time=($('#adminHistoryTime')?.value||'').trim();
  const d=new Date(order.created_at);
  const localDate=Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const localTime=Number.isNaN(d.getTime())?'':`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const text=`${order.public_code||''} ${order.customer_name||''} ${order.customer_phone||''} ${order.delivery_address||''} ${statusLabel(order.status)}`.toLowerCase();
  return (!q||text.includes(q))&&(!date||localDate===date)&&(!time||localTime.startsWith(time));
}
function adminHistoryCompact(order){
  const code=order.public_code||`SS-${String(order.id).slice(-5).toUpperCase()}`;
  return `<details class="admin-history-item">
    <summary class="admin-history-summary">
      <div><strong>#${esc(code)} • ${esc(order.customer_name||'Client')}</strong><span>${statusLabel(order.status)} • ${money(order.total)}</span></div>
      <div class="admin-history-meta"><span>${formatDate(order.created_at)}</span><i data-lucide="chevron-down"></i></div>
    </summary>
    <div class="admin-history-body">${orderHTML(order,true)}</div>
  </details>`;
}
window.renderAdminHistory=()=>{
  const target=$('#adminHistoryList');if(!target)return;
  const filtered=(adminHistoryOrders||[]).filter(adminHistoryMatches);
  const visible=adminHistoryExpanded?filtered:filtered.slice(0,3);
  target.innerHTML=visible.map(adminHistoryCompact).join('')||'<div class="empty">Aucune commande trouvée.</div>';
  const btn=$('#adminHistoryToggle');
  if(btn){
    btn.classList.toggle('hidden',filtered.length<=3);
    btn.textContent=adminHistoryExpanded?'Voir moins':'Voir plus';
  }
  iconRefresh();
};
window.toggleAdminHistory=()=>{adminHistoryExpanded=!adminHistoryExpanded;renderAdminHistory();};
window.resetAdminHistoryFilters=()=>{
  if($('#adminHistorySearch'))$('#adminHistorySearch').value='';
  if($('#adminHistoryDate'))$('#adminHistoryDate').value='';
  if($('#adminHistoryTime'))$('#adminHistoryTime').value='';
  adminHistoryExpanded=false;renderAdminHistory();
};

async function renderAdmin(){
  if(!uiCanManageAnything()){ $('#adminStats').innerHTML='';$('#adminActivity').innerHTML='<div class="empty">Ce rôle ne possède aucun accès d’administration.</div>';return }
  $$('#adminView [data-perm]').forEach(card=>card.classList.toggle('hidden-by-permission',!uiCan(card.dataset.perm)));
  $$('#adminView .direction-only').forEach(card=>card.classList.toggle('hidden-by-permission',isPreviewMode() || !isDirection()));
  $('#rolePreviewAdminCard')?.classList.toggle('hidden-by-permission',isPreviewMode() || !canUseRolePreview());
  let orders=[];
  if(uiCan('stats_view')||(!isPreviewMode()&&isDirection())){
    if(hasSupabase){const{data}=await sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(100);orders=data||[]}else orders=demo.orders;
  }
  const active=orders.filter(o=>!['delivered','cancelled'].includes(o.status));
  let allStats={delivered_revenue:0,delivered_orders:0,average_basket:0,delivery_fees:0,customers_served:0,units_sold:0,top_product_name:'—',top_product_quantity:0};
  if(uiCan('stats_view')||(!isPreviewMode()&&isDirection())){
    if(hasSupabase){
      const {data,error}=await sb.rpc('get_direction_sales_stats');
      if(!error&&Array.isArray(data)&&data[0])allStats={...allStats,...data[0]};
    }else{
      const delivered=demo.orders.filter(o=>o.status==='delivered');
      const productCounts=new Map();
      for(const o of delivered)for(const i of (o.items||o.order_items||[])){const name=i.product_name||i.name||'Article';productCounts.set(name,(productCounts.get(name)||0)+num(i.quantity||i.qty));}
      const top=[...productCounts.entries()].sort((a,b)=>b[1]-a[1])[0];
      allStats={delivered_revenue:delivered.reduce((a,o)=>a+num(o.total),0),delivered_orders:delivered.length,average_basket:delivered.length?delivered.reduce((a,o)=>a+num(o.total),0)/delivered.length:0,delivery_fees:delivered.reduce((a,o)=>a+num(o.delivery_fee),0),customers_served:new Set(delivered.map(o=>o.user_id||o.customer_name)).size,units_sold:[...productCounts.values()].reduce((a,b)=>a+b,0),top_product_name:top?.[0]||'—',top_product_quantity:top?.[1]||0};
    }
  }
  $('#adminStats').innerHTML=(uiCan('stats_view')||(!isPreviewMode()&&isDirection()))?`<div class="kpi-card"><span>CA livré total</span><strong>${money(allStats.delivered_revenue)}</strong></div><div class="kpi-card"><span>Commandes livrées</span><strong>${num(allStats.delivered_orders)}</strong></div><div class="kpi-card"><span>En cours</span><strong>${active.length}</strong></div><div class="kpi-card"><span>Panier moyen</span><strong>${money(allStats.average_basket)}</strong></div><div class="kpi-card"><span>Livraisons encaissées</span><strong>${money(allStats.delivery_fees)}</strong></div><div class="kpi-card"><span>Articles vendus</span><strong>${num(allStats.units_sold)}</strong></div>`:'';
  adminHistoryOrders=orders;
  $('#adminActivity').innerHTML=(uiCan('stats_view')||(!isPreviewMode()&&isDirection()))?`<div class="order-detail-grid"><div class="mini-info"><span>Produit le + commandé</span><strong>${esc(allStats.top_product_name||'—')} • ${num(allStats.top_product_quantity)} unités</strong></div><div class="mini-info"><span>Clients servis</span><strong>${num(allStats.customers_served)}</strong></div></div>
  <div class="admin-history-head"><div><span class="eyebrow">HISTORIQUE</span><h3>Commandes récentes</h3></div><button class="icon-btn" onclick="resetAdminHistoryFilters()" title="Réinitialiser"><i data-lucide="rotate-ccw"></i></button></div>
  <div class="admin-history-tools">
    <div class="search-wrap"><i data-lucide="search"></i><input id="adminHistorySearch" placeholder="Code, client, adresse…" oninput="renderAdminHistory()"></div>
    <div class="admin-history-date-row"><div class="form-group"><label>Date</label><input id="adminHistoryDate" type="date" onchange="renderAdminHistory()"></div><div class="form-group"><label>Heure</label><input id="adminHistoryTime" type="time" onchange="renderAdminHistory()"></div></div>
  </div>
  <div id="adminHistoryList"></div>
  <button class="btn ghost hidden" id="adminHistoryToggle" style="width:100%;margin-top:10px" onclick="toggleAdminHistory()">Voir plus</button>`:'<div class="empty">Les outils autorisés pour votre rôle sont disponibles au-dessus.</div>';
  if(uiCan('stats_view')||(!isPreviewMode()&&isDirection()))renderAdminHistory();
  iconRefresh();
}
$('#refreshAdmin').addEventListener('click',renderAdmin);
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-admin]');if(!a)return;
  const perm=a.dataset.perm;if(perm&&!uiCan(perm))return toast('Ce rôle n’a pas cet accès.');
  if(isPreviewMode())return toast('Mode aperçu : les outils sont visibles mais les modifications sont désactivées.');
  ({announcements:adminAnnouncements,announcement:adminAnnouncement,product:()=>adminProduct(),products:adminProducts,productmonth:adminProductOfMonth,packs:adminPacks,promotion:adminPromotion,recruitment:adminRecruitment,contacts:adminContacts,settings:adminSettings,accounts:adminAccounts,team:adminAccounts,permissions:adminPermissions,customers:adminAccounts,partnerships:adminPartnerships,reviews:adminReviews,loyalty:adminLoyaltyRewards})[a.dataset.admin]?.();
});
async function adminAnnouncements(){
  const list=await getAnnouncements(true);demo.announcements=list;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Annonces</h3><div class="stack">${list.map(a=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="megaphone"></i></div><div><strong>${esc(a.title)}</strong><p>${esc(a.body)} • ${a.active!==false?'Visible':'Masquée'}</p></div><div class="catalog-actions"><button onclick="deleteAnnouncement('${a.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button></div></div>`).join('')||'<div class="empty">Aucune annonce.</div>'}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="adminAnnouncement()"><i data-lucide="plus"></i> Nouvelle annonce</button>`);iconRefresh();
}
function adminAnnouncement(){openModal(`<button class="icon-btn close" onclick="adminAnnouncements()">×</button><h3>Publier une annonce</h3><div class="form-group"><label>Titre</label><input id="annTitle" placeholder="Titre de l’annonce"></div><div class="form-group"><label>Sous-titre / texte</label><textarea id="annBody" placeholder="Texte affiché sous le titre"></textarea></div><div class="form-group"><label>Type</label><select id="annType"><option value="news">Actualité</option><option value="recruitment">Recrutement</option><option value="promotion">Promotion</option><option value="alert">Information importante</option></select></div><label class="checkbox-row"><input type="checkbox" id="annFeatured"> Mettre à la une / Nouveau</label><div class="modal-actions"><button class="btn primary" onclick="saveAnnouncement()">Publier</button></div>`)}
window.saveAnnouncement=async()=>{const x={title:$('#annTitle').value.trim(),body:$('#annBody').value.trim(),type:$('#annType').value,featured:$('#annFeatured').checked,active:true};if(!x.title||!x.body)return toast('Titre et sous-titre obligatoires.');if(hasSupabase){const{error}=await sb.from('announcements').insert(x);if(error)return toast(error.message)}else{demo.announcements.unshift({...x,id:uid('ann'),created_at:new Date().toISOString()});storageSet(LS.announcements,demo.announcements)}renderHome();toast('Annonce publiée.');adminAnnouncements();};
window.deleteAnnouncement=async id=>{if(!confirm('Supprimer cette annonce ?'))return;if(hasSupabase){const{error}=await sb.from('announcements').delete().eq('id',id);if(error)return toast(error.message)}else{demo.announcements=demo.announcements.filter(a=>String(a.id)!==String(id));storageSet(LS.announcements,demo.announcements)}renderHome();toast('Annonce supprimée.');adminAnnouncements();};
function localDateTimeValue(value){
  if(!value)return '';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
  const off=d.getTimezoneOffset()*60000;
  return new Date(d.getTime()-off).toISOString().slice(0,16);
}
function adminProduct(product=null){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>${product?'Modifier':'Ajouter'} un produit</h3>
<div class="form-grid"><div class="form-group"><label>Nom</label><input id="prodName" value="${esc(product?.name||'')}"></div><div class="form-group"><label>Prix</label><input id="prodPrice" type="number" min="0" step="0.01" value="${num(product?.price)}"></div></div>
<div class="form-group"><label>Description</label><input id="prodDesc" value="${esc(product?.description||'')}"></div>
<div class="form-grid"><div class="form-group"><label>Catégorie</label><select id="prodCat">${['Outillage','Autres','Agriculture','Boissons','Document','Divers'].map(cat=>`<option value="${cat}" ${String(product?.category||'Divers')===cat?'selected':''}>${cat}</option>`).join('')}</select></div><div class="form-group"><label>Emoji / icône</label><input id="prodEmoji" value="${esc(product?.emoji||'🛒')}"></div></div>
<div class="form-group"><label>Stock (laisser vide = illimité)</label><input id="prodStock" type="number" min="0" value="${product?.stock??''}"></div>
<div class="two-col"><div class="notice compact"><i data-lucide="trending-up"></i><div><strong>Popularité automatique</strong><span>Calculée selon les produits réellement commandés.</span></div></div><label class="checkbox-row"><input type="checkbox" id="prodNew" ${product?.is_new?'checked':''}> Nouveauté</label></div>
<label class="checkbox-row"><input type="checkbox" id="prodMonth" ${product?.is_product_of_month?'checked':''}> Produit du mois</label>
<label class="checkbox-row"><input type="checkbox" id="prodLimited" ${product?.is_limited_edition?'checked':''}> Édition limitée / produit temporaire</label>
<div class="form-grid"><div class="form-group"><label>Disponible à partir du</label><input id="prodAvailableFrom" type="datetime-local" value="${localDateTimeValue(product?.available_from)}"></div><div class="form-group"><label>Disponible jusqu’au</label><input id="prodAvailableUntil" type="datetime-local" value="${localDateTimeValue(product?.available_until)}"></div></div>
<p class="subtle">Avant la date de début et après la date de fin, le produit disparaît automatiquement du catalogue et ne peut plus être commandé.</p>
<label class="checkbox-row"><input type="checkbox" id="prodAvailable" ${product?.available!==false?'checked':''}> Disponible à la vente</label>
<div class="modal-actions"><button class="btn primary" onclick="saveProduct('${product?.id||''}')">Enregistrer</button></div>`);iconRefresh();}
window.saveProduct=async id=>{
  const rawStock=$('#prodStock').value.trim();
  const from=$('#prodAvailableFrom')?.value?new Date($('#prodAvailableFrom').value).toISOString():null;
  const until=$('#prodAvailableUntil')?.value?new Date($('#prodAvailableUntil').value).toISOString():null;
  if(from&&until&&new Date(until)<=new Date(from))return toast('La date de fin doit être après la date de début.');
  const x={name:$('#prodName').value.trim(),description:$('#prodDesc').value.trim(),price:num($('#prodPrice').value),category:$('#prodCat').value.trim()||'Divers',emoji:$('#prodEmoji').value.trim()||'🛒',stock:rawStock===''?null:Math.max(0,Math.floor(num(rawStock))),popular:false,is_new:$('#prodNew').checked,is_product_of_month:$('#prodMonth').checked,is_limited_edition:Boolean($('#prodLimited')?.checked),available_from:from,available_until:until,available:$('#prodAvailable').checked,active:true};
  if(!x.name)return toast('Nom obligatoire.');
  if(hasSupabase){
    if(x.is_product_of_month){
      const{error:clearError}=await sb.from('products').update({is_product_of_month:false}).eq('is_pack',false);
      if(clearError)return toast(clearError.message);
    }
    const q=id?sb.from('products').update(x).eq('id',id):sb.from('products').insert(x);
    const{error}=await q;if(error)return toast(error.message);
  }else{
    if(x.is_product_of_month)demo.products.forEach(p=>{if(!p.is_pack)p.is_product_of_month=false});
    if(id){const i=demo.products.findIndex(p=>String(p.id)===String(id));if(i>=0)demo.products[i]={...demo.products[i],...x}}else demo.products.push({...x,id:uid('p')});
    storageSet(LS.products,demo.products);
  }
  closeModal();await renderHome();renderShop();toast('Produit enregistré.');
};
async function adminProducts(){
  const list=await getProducts(true);demo.products=list;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Catalogue</h3><button class="btn primary full" style="margin-bottom:12px" onclick="adminProduct()"><i data-lucide="package-plus"></i> Ajouter un produit</button><div class="search-wrap admin-search"><i data-lucide="search"></i><input id="adminProductSearch" placeholder="Rechercher un produit…"></div><div id="adminProductList" class="stack"></div>`);
  const input=$('#adminProductSearch');if(input)input.addEventListener('input',renderAdminProductRows);
  renderAdminProductRows();iconRefresh();
}
function renderAdminProductRows(){
  const target=$('#adminProductList');if(!target)return;
  const q=($('#adminProductSearch')?.value||'').trim().toLowerCase();
  const list=(demo.products||[]).filter(p=>!q||`${p.name} ${p.category||''} ${p.description||''}`.toLowerCase().includes(q));
  target.innerHTML=list.map(p=>`<div class="catalog-row"><div class="catalog-icon">${esc(p.emoji||'🛒')}</div><div><strong>${esc(p.name)}${p.is_product_of_month?' • ⭐ PRODUIT DU MOIS':''}${p.is_limited_edition?' • ⏳ ÉDITION LIMITÉE':''}</strong><p>${money(p.price)} • ${esc(p.category)} • ${p.available!==false?'Disponible':'Indisponible'}${p.stock!==null&&p.stock!==undefined?` • Stock ${p.stock}`:''}${p.available_until?` • Fin ${new Date(p.available_until).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:''}</p></div><div class="catalog-actions"><button onclick="editAdminProduct('${p.id}')"><i data-lucide="pencil"></i></button><button onclick="toggleProduct('${p.id}',${p.available!==false})"><i data-lucide="${p.available!==false?'eye-off':'eye'}"></i></button></div></div>`).join('')||'<div class="empty">Aucun produit trouvé.</div>';
  iconRefresh();
}
let monthProductAdminList=[];
async function adminProductOfMonth(){
  monthProductAdminList=(await getProducts(true)).filter(p=>!p.is_pack&&p.active!==false);
  demo.products=await getProducts(true);
  const current=monthProductAdminList.find(p=>p.is_product_of_month);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">MISE EN AVANT</span><h3>Produit du mois</h3><p class="page-intro">Recherchez un produit, sélectionnez-le puis validez.</p><div class="search-wrap admin-search"><i data-lucide="search"></i><input id="monthProductSearch" placeholder="Rechercher un produit…"></div><input type="hidden" id="monthProductSelect" value="${current?.id||''}"><div id="monthProductResults" class="month-product-results"></div><div class="modal-actions"><button class="btn primary" onclick="saveProductOfMonth()">Valider le produit du mois</button></div>`);
  $('#monthProductSearch')?.addEventListener('input',renderMonthProductResults);
  renderMonthProductResults();iconRefresh();
}
function renderMonthProductResults(){
  const target=$('#monthProductResults');if(!target)return;
  const q=($('#monthProductSearch')?.value||'').trim().toLowerCase();
  const selected=$('#monthProductSelect')?.value||'';
  const list=monthProductAdminList.filter(p=>!q||`${p.name} ${p.category||''}`.toLowerCase().includes(q));
  target.innerHTML=list.map(p=>`<button type="button" class="month-product-choice ${String(selected)===String(p.id)?'selected':''}" onclick="selectMonthProduct('${p.id}')"><span class="catalog-icon">${esc(p.emoji||'🛒')}</span><span><strong>${esc(p.name)}</strong><small>${money(p.price)} • ${esc(p.category||'Divers')}</small></span><i data-lucide="${String(selected)===String(p.id)?'circle-check-big':'circle'}"></i></button>`).join('')||'<div class="empty">Aucun produit trouvé.</div>';
  iconRefresh();
}
window.selectMonthProduct=id=>{const input=$('#monthProductSelect');if(input)input.value=id;renderMonthProductResults();};
window.saveProductOfMonth=async()=>{
  const id=$('#monthProductSelect')?.value||'';
  if(!id)return toast('Choisissez un produit avant de valider.');
  if(hasSupabase){
    const{error:clearError}=await sb.from('products').update({is_product_of_month:false}).eq('is_pack',false);
    if(clearError)return toast(clearError.message);
    const{error}=await sb.from('products').update({is_product_of_month:true}).eq('id',id);if(error)return toast(error.message);
  }else{
    demo.products.forEach(p=>{if(!p.is_pack)p.is_product_of_month=String(p.id)===String(id)});
    storageSet(LS.products,demo.products);
  }
  toast('Produit du mois modifié.');
  await renderHome();
  adminProductOfMonth();
};
window.editAdminProduct=id=>{const p=demo.products.find(x=>String(x.id)===String(id));if(p)adminProduct(p)};
window.toggleProduct=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('products').update({available:!current}).eq('id',id);if(error)return toast(error.message)}else{const p=demo.products.find(x=>String(x.id)===String(id));if(p)p.available=!current;storageSet(LS.products,demo.products)}adminProducts();};
async function adminPacks(){
  const list=(await getProducts(true)).filter(p=>p.is_pack);demo.products=await getProducts(true);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Packs</h3><button class="btn primary full" style="margin-bottom:12px" onclick="adminPack()"><i data-lucide="plus"></i> Nouveau pack</button><div class="search-wrap admin-search"><i data-lucide="search"></i><input id="adminPackSearch" placeholder="Rechercher un pack…"></div><div id="adminPackList" class="stack"></div>`);
  const draw=()=>{const q=($('#adminPackSearch')?.value||'').trim().toLowerCase();const rows=list.filter(p=>!q||p.name.toLowerCase().includes(q));$('#adminPackList').innerHTML=rows.map(p=>`<div class="catalog-row"><div class="catalog-icon">${esc(p.emoji||'📦')}</div><div><strong>${esc(p.name)}</strong><p>${money(p.price)}${p.is_pack_of_month?' • PACK DU MOIS':''}</p></div><div class="catalog-actions"><button onclick="editAdminPack('${p.id}')" title="Modifier"><i data-lucide="pencil"></i></button><button onclick="openPackSettings('${p.id}')" title="Réglages"><i data-lucide="settings-2"></i></button></div></div>`).join('')||'<div class="empty">Aucun pack trouvé.</div>';iconRefresh();};
  $('#adminPackSearch')?.addEventListener('input',draw);draw();iconRefresh();
}
window.editAdminPack=async id=>{const all=await getProducts(true);demo.products=all;const p=all.find(x=>String(x.id)===String(id));if(p)adminPack(p)};
window.openPackSettings=async id=>{
  const all=await getProducts(true);demo.products=all;
  const p=all.find(x=>String(x.id)===String(id)&&x.is_pack);if(!p)return;
  openModal(`<button class="icon-btn close" onclick="adminPacks()">×</button><span class="eyebrow">RÉGLAGES DU PACK</span><h3>${esc(p.name)}</h3>
    <div class="pack-settings-grid">
      <button class="pack-setting-card ${p.is_pack_of_month?'active':''}" onclick="setPackMonth('${p.id}',${p.is_pack_of_month?'true':'false'})">
        <i data-lucide="star"></i><div><strong>${p.is_pack_of_month?'Retirer du Pack du mois':'Mettre en Pack du mois'}</strong><span>${p.is_pack_of_month?'Ce pack est actuellement mis en avant.':'Met ce pack en avant sur l’accueil.'}</span></div>
      </button>
      <button class="pack-setting-card ${p.available!==false?'active':''}" onclick="setPackAvailability('${p.id}',${p.available!==false?'true':'false'})">
        <i data-lucide="${p.available!==false?'eye':'eye-off'}"></i><div><strong>${p.available!==false?'Rendre indisponible':'Rendre disponible'}</strong><span>${p.available!==false?'Les clients peuvent actuellement le commander.':'Le pack est actuellement masqué à la vente.'}</span></div>
      </button>
      <button class="pack-setting-card ${p.show_pack_contents!==false?'active':''}" onclick="setPackContentVisibility('${p.id}',${p.show_pack_contents!==false?'true':'false'})">
        <i data-lucide="${p.show_pack_contents!==false?'list-tree':'list-x'}"></i><div><strong>${p.show_pack_contents!==false?'Masquer le contenu':'Afficher le contenu'}</strong><span>${p.show_pack_contents!==false?'Les clients voient le détail des articles.':'Les clients ne voient pas le détail des articles.'}</span></div>
      </button>
      <button class="pack-setting-card" onclick="editAdminPack('${p.id}')">
        <i data-lucide="pencil"></i><div><strong>Modifier le pack</strong><span>Nom, prix, description, emoji et contenu.</span></div>
      </button>
    </div>`);
  iconRefresh();
};
window.setPackMonth=async(id,current)=>{
  if(hasSupabase){
    if(!current){const{error:clear}=await sb.from('products').update({is_pack_of_month:false}).eq('is_pack',true);if(clear)return toast(clear.message)}
    const{error}=await sb.from('products').update({is_pack_of_month:!current}).eq('id',id);if(error)return toast(error.message);
  }else{
    demo.products.forEach(p=>{if(p.is_pack)p.is_pack_of_month=false});
    const p=demo.products.find(x=>String(x.id)===String(id));if(p)p.is_pack_of_month=!current;
    storageSet(LS.products,demo.products);
  }
  toast(!current?'Pack du mois activé.':'Pack du mois retiré.');await renderHome();openPackSettings(id);
};
window.setPackAvailability=async(id,current)=>{
  if(hasSupabase){const{error}=await sb.from('products').update({available:!current}).eq('id',id);if(error)return toast(error.message)}
  else{const p=demo.products.find(x=>String(x.id)===String(id));if(p)p.available=!current;storageSet(LS.products,demo.products)}
  toast(!current?'Pack disponible.':'Pack indisponible.');openPackSettings(id);
};
window.setPackContentVisibility=async(id,current)=>{
  if(hasSupabase){const{error}=await sb.from('products').update({show_pack_contents:!current}).eq('id',id);if(error)return toast(error.message)}
  else{const p=demo.products.find(x=>String(x.id)===String(id));if(p)p.show_pack_contents=!current;storageSet(LS.products,demo.products)}
  toast(!current?'Contenu du pack visible.':'Contenu du pack masqué.');openPackSettings(id);
};

async function adminPack(pack=null){
  const all=await getProducts(true);demo.products=all;
  const base=all.filter(p=>!p.is_pack&&p.active!==false);
  let items=[];if(pack)items=await getPackItems(pack.id);
  const qtyMap=new Map(items.map(i=>[String(i.product_id),num(i.quantity)]));
  openModal(`<button class="icon-btn close" onclick="adminPacks()">×</button><h3>${pack?'Modifier':'Créer'} un pack</h3>
    <div class="form-grid">
      <div class="form-group"><label>Nom</label><input id="packName" value="${esc(pack?.name||'')}"></div>
      <div class="form-group"><label>Prix du pack</label><input id="packPrice" type="number" min="0" step="0.01" value="${num(pack?.price)}"></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="packDesc" placeholder="Description visible par les clients…">${esc(pack?.description||'')}</textarea></div>
    <div class="form-group"><label>Emoji / icône</label><input id="packEmoji" value="${esc(pack?.emoji||'📦')}"></div>
    <label class="checkbox-row"><input type="checkbox" id="packMonth" ${pack?.is_pack_of_month?'checked':''}> Définir comme Pack du mois</label>
    <label class="checkbox-row"><input type="checkbox" id="packAvailable" ${pack?.available!==false?'checked':''}> Disponible à la vente</label>
    <label class="checkbox-row"><input type="checkbox" id="packShowContents" ${pack?.show_pack_contents!==false?'checked':''}> Afficher le contenu du pack aux clients</label>
    <div class="divider"></div>
    <button type="button" class="pack-collapse-toggle" id="packItemsToggle" onclick="togglePackItemsEditor()">
      <span><span class="eyebrow">CONTENU DU PACK</span><strong>Choisir les produits</strong></span>
      <i data-lucide="chevron-down"></i>
    </button>
    <div id="packItemsEditor" class="pack-items-editor collapsed">
      <div class="search-wrap admin-search" style="margin-top:10px"><i data-lucide="search"></i><input id="packItemSearch" placeholder="Rechercher un article à ajouter…"></div>
      <div class="permission-grid" id="packItemList">${base.map(p=>{const q=qtyMap.get(String(p.id))||0;return `<div class="permission-row pack-item-row" data-search="${esc((p.name+' '+(p.category||'')).toLowerCase())}"><div><strong>${esc(p.emoji||'🛒')} ${esc(p.name)}</strong><span>${money(p.price)}</span></div><div style="display:flex;align-items:center;gap:7px"><input type="checkbox" class="pack-item-check" data-product="${p.id}" ${q>0?'checked':''}><input class="form-control pack-item-qty" data-product="${p.id}" type="number" min="1" max="99" value="${q||1}" style="width:62px;padding:8px"></div></div>`}).join('')||'<div class="empty">Ajoutez d’abord des produits au catalogue.</div>'}</div>
    </div>
    <div class="modal-actions"><button class="btn primary" onclick="savePack('${pack?.id||''}')">Enregistrer le pack</button></div>`);
  $('#packItemSearch')?.addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('.pack-item-row').forEach(row=>row.classList.toggle('hidden',q&&!String(row.dataset.search||'').includes(q)))});
  iconRefresh();
}
window.togglePackItemsEditor=()=>{
  const box=$('#packItemsEditor'),btn=$('#packItemsToggle');
  if(!box||!btn)return;
  box.classList.toggle('collapsed');
  const open=!box.classList.contains('collapsed');
  btn.classList.toggle('open',open);
  btn.querySelector('svg')?.setAttribute('data-lucide',open?'chevron-up':'chevron-down');
  iconRefresh();
};
window.savePack=async id=>{
  const x={
    name:$('#packName').value.trim(),
    description:$('#packDesc').value.trim(),
    price:num($('#packPrice').value),
    category:'Packs',
    emoji:$('#packEmoji').value.trim()||'📦',
    is_pack:true,
    is_pack_of_month:$('#packMonth').checked,
    available:$('#packAvailable').checked,
    show_pack_contents:$('#packShowContents').checked,
    active:true,
    stock:null
  };
  if(!x.name)return toast('Nom du pack obligatoire.');
  const items=$$('.pack-item-check:checked').map(ch=>({product_id:ch.dataset.product,quantity:Math.max(1,Math.floor(num($(`.pack-item-qty[data-product="${ch.dataset.product}"]`)?.value)||1))}));
  let packId=id;
  if(hasSupabase){
    if(x.is_pack_of_month)await sb.from('products').update({is_pack_of_month:false}).eq('is_pack',true);
    if(id){const{error}=await sb.from('products').update(x).eq('id',id);if(error)return toast(error.message)}
    else{const{data,error}=await sb.from('products').insert(x).select('id').single();if(error)return toast(error.message);packId=data.id}
    await sb.from('pack_items').delete().eq('pack_id',packId);
    if(items.length){const{error}=await sb.from('pack_items').insert(items.map(i=>({...i,pack_id:packId})));if(error)return toast(error.message)}
  }else{
    if(x.is_pack_of_month)demo.products.forEach(p=>p.is_pack_of_month=false);
    if(id){const i=demo.products.findIndex(p=>String(p.id)===String(id));demo.products[i]={...demo.products[i],...x}}
    else{packId=uid('pack');demo.products.push({...x,id:packId})}
    demo.packItems=demo.packItems.filter(i=>String(i.pack_id)!==String(packId)).concat(items.map(i=>({...i,pack_id:packId,id:uid('pi')})));
    storageSet(LS.products,demo.products);storageSet(LS.packItems,demo.packItems)
  }
  toast('Pack enregistré.');renderHome();adminPacks();
};

async function adminRecruitment(){const jobs=await getJobs(true);demo.jobs=jobs;openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Recrutement</h3><p class="page-intro">Activez uniquement les postes pour lesquels le LTD recrute actuellement.</p><div class="stack">${jobs.map(j=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="badge-user"></i></div><div><strong>${esc(j.title)}</strong><p>${esc(j.description)}</p></div><div class="catalog-actions"><button onclick="toggleJobRecruitment('${j.id}',${j.active!==false})" title="${j.active!==false?'Fermer':'Ouvrir'} le recrutement"><i data-lucide="${j.active!==false?'toggle-right':'toggle-left'}"></i></button></div></div>`).join('')}</div>`);iconRefresh();}
window.toggleJobRecruitment=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('jobs').update({active:!current}).eq('id',id);if(error)return toast(error.message)}else{const j=demo.jobs.find(x=>String(x.id)===String(id));if(j)j.active=!current;storageSet(LS.jobs,demo.jobs)}toast(!current?'Recrutement ouvert.':'Recrutement fermé.');adminRecruitment();};

async function adminPermissions(role='vendeur_novice'){
  if(!isDirection())return toast('Seuls le Gérant et la Cogérante peuvent modifier les permissions.');let enabled=[];
  if(hasSupabase){const{data,error}=await sb.from('role_permissions').select('permission_key,enabled').eq('staff_role',role);if(error)return toast(error.message);enabled=(data||[]).filter(x=>x.enabled).map(x=>x.permission_key)}else enabled=[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Permissions des rôles</h3><div class="form-group"><label>Rôle à configurer</label><select id="permissionRole">${Object.entries(STAFF_ROLES).filter(([k])=>!['patron','copatron'].includes(k)).map(([k,v])=>`<option value="${k}" ${k===role?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="permission-grid">${PERMISSION_DEFS.map(p=>`<label class="permission-row"><div><strong>${esc(p.label)}</strong><span>${esc(p.desc)}</span></div><input type="checkbox" class="perm-check" value="${p.key}" ${enabled.includes(p.key)?'checked':''}></label>`).join('')}</div><div class="modal-actions"><button class="btn primary" onclick="saveRolePermissions()">Enregistrer</button></div>`);$('#permissionRole').addEventListener('change',e=>adminPermissions(e.target.value));
}
window.saveRolePermissions=async()=>{const role=$('#permissionRole').value,perms=$$('.perm-check:checked').map(x=>x.value);if(hasSupabase){const{error}=await sb.rpc('admin_set_role_permissions',{p_staff_role:role,p_permissions:perms});if(error)return toast(error.message)}toast('Permissions enregistrées.');adminPermissions(role);};


async function adminReviews(){
  if(!isDirection())return toast('Accès réservé à la direction.');
  let list=[];
  if(hasSupabase){
    const {data,error}=await sb.rpc('get_direction_reviews');
    if(error)return toast(error.message||'Impossible de charger les avis.');
    list=data||[];
  }else{
    list=storageGet('ltd_delivery_reviews',[]);
  }
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">DIRECTION</span><h3>Avis clients</h3><p class="page-intro">Consultez les notes laissées après les livraisons et supprimez les avis abusifs ou troll.</p>
    <div class="stack direction-reviews-list">${list.map(r=>{
      const names=[r.employee_1_name,r.employee_2_name].filter(Boolean).join(' & ')||'Employé LTD';
      return `<article class="direction-review-card"><div class="direction-review-top"><div><span class="order-code">#${esc(r.public_code||'COMMANDE')}</span><strong>${esc(r.customer_name||'Client')}</strong></div><button class="icon-btn danger" onclick="deleteDirectionReview('${r.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button></div><div class="direction-review-stars">${'★'.repeat(num(r.rating))}${'☆'.repeat(5-num(r.rating))}</div><div class="direction-review-satisfaction">${esc(satisfactionLabel(r.satisfaction))}</div><p>${esc(names)}</p><small>${new Date(r.created_at).toLocaleString('fr-FR')}</small></article>`;
    }).join('')||'<div class="empty">Aucun avis pour le moment.</div>'}</div>`);
  iconRefresh();
}
window.deleteDirectionReview=async id=>{
  if(!isDirection())return toast('Accès réservé à la direction.');
  if(!confirm('Supprimer cet avis ?'))return;
  if(hasSupabase){
    const {error}=await sb.from('delivery_reviews').delete().eq('id',id);
    if(error)return toast(error.message||'Suppression impossible.');
  }else{
    const list=storageGet('ltd_delivery_reviews',[]).filter(r=>String(r.id)!==String(id));
    storageSet('ltd_delivery_reviews',list);
  }
  toast('Avis supprimé.');adminReviews();
};

async function adminLoyaltyRewards(){
  if(!isDirection())return toast('Accès réservé à la direction.');
  const {data,error}=await sb.from('loyalty_rewards').select('*').order('points_required').order('sort_order');
  if(error)return toast(error.message||'Impossible de charger les récompenses.');
  demo.loyaltyRewards=data||[];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">DIRECTION</span><h3>Récompenses fidélité</h3><p class="page-intro">Créez autant de paliers que vous voulez : 50 points, 100 points, 200 points… et choisissez exactement l’avantage associé.</p><div class="stack">${demo.loyaltyRewards.map(r=>`<div class="catalog-row loyalty-admin-row"><div class="catalog-icon"><i data-lucide="gift"></i></div><div><strong>${num(r.points_required)} pts — ${esc(r.label)}</strong><p>${esc(rewardDescription(r))} • ${r.active?'Active':'Inactive'}</p></div><div class="catalog-actions"><button onclick="showLoyaltyRewardForm('${r.id}')" title="Modifier"><i data-lucide="pencil"></i></button><button onclick="toggleLoyaltyReward('${r.id}',${r.active!==false})" title="${r.active?'Désactiver':'Activer'}"><i data-lucide="${r.active?'pause':'play'}"></i></button><button onclick="deleteLoyaltyReward('${r.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button></div></div>`).join('')||'<div class="empty">Aucune récompense configurée.</div>'}</div><button class="btn primary full" style="margin-top:12px" onclick="showLoyaltyRewardForm('')"><i data-lucide="plus"></i> Ajouter un palier</button>`);
  iconRefresh();
}
window.showLoyaltyRewardForm=id=>{
  const r=(demo.loyaltyRewards||[]).find(x=>String(x.id)===String(id));
  openModal(`<button class="icon-btn close" onclick="adminLoyaltyRewards()">×</button><h3>${r?'Modifier':'Créer'} une récompense</h3><div class="form-grid"><div class="form-group"><label>Points nécessaires</label><input id="loyaltyRewardPoints" type="number" min="1" value="${num(r?.points_required||50)}"></div><div class="form-group"><label>Type</label><select id="loyaltyRewardType"><option value="fixed_discount" ${r?.reward_type==='fixed_discount'?'selected':''}>Réduction en $</option><option value="percent_discount" ${r?.reward_type==='percent_discount'?'selected':''}>Réduction en %</option><option value="free_delivery" ${r?.reward_type==='free_delivery'?'selected':''}>Livraison offerte</option></select></div></div><div class="form-group"><label>Nom affiché</label><input id="loyaltyRewardLabel" value="${esc(r?.label||'')}" placeholder="Ex : 50 $ de réduction"></div><div class="form-group"><label>Valeur de la récompense</label><input id="loyaltyRewardValue" type="number" min="0" step="0.01" value="${num(r?.reward_value||0)}"><small>Pour une livraison offerte, laissez 0.</small></div><div class="modal-actions"><button class="btn primary" onclick="saveLoyaltyReward('${id||''}')">Enregistrer</button></div>`);
};
window.saveLoyaltyReward=async id=>{
  if(!isDirection())return;
  const x={points_required:Math.max(1,Math.floor(num($('#loyaltyRewardPoints').value))),reward_type:$('#loyaltyRewardType').value,label:$('#loyaltyRewardLabel').value.trim(),reward_value:num($('#loyaltyRewardValue').value),active:true};
  if(!x.label)return toast('Donnez un nom à la récompense.');
  if(x.reward_type==='free_delivery')x.reward_value=0;
  const q=id?sb.from('loyalty_rewards').update(x).eq('id',id):sb.from('loyalty_rewards').insert(x);
  const {error}=await q;if(error)return toast(error.message);
  toast('Récompense enregistrée.');adminLoyaltyRewards();
};
window.toggleLoyaltyReward=async(id,current)=>{
  if(!isDirection())return;
  const {error}=await sb.from('loyalty_rewards').update({active:!current,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return toast(error.message);adminLoyaltyRewards();
};
window.deleteLoyaltyReward=async id=>{
  if(!isDirection())return;
  if(!confirm('Supprimer définitivement cette récompense ?'))return;
  const {error}=await sb.from('loyalty_rewards').delete().eq('id',id);
  if(error)return toast(error.message);toast('Récompense supprimée.');adminLoyaltyRewards();
};

async function adminPromotion(){
  const list=await getPromotions(true);demo.promotions=list;
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Promotions</h3><div class="stack">${list.map(p=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="badge-percent"></i></div><div><strong>${esc(p.name)}</strong><p>${promoDescription(p)}${p.code?` • Code ${esc(p.code)}`:' • Automatique'} • ${p.active?'Active':'Inactive'}</p></div><div class="catalog-actions"><button onclick="togglePromotion('${p.id}',${p.active!==false})" title="${p.active!==false?'Désactiver':'Activer'}"><i data-lucide="${p.active!==false?'pause':'play'}"></i></button><button onclick="deletePromotion('${p.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button></div></div>`).join('')||'<div class="empty">Aucune promotion créée.</div>'}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="showPromotionForm()"><i data-lucide="plus"></i> Nouvelle promotion</button>`);iconRefresh();
}
window.showPromotionForm=async()=>{
  const products=(await getProducts(true)).filter(p=>!p.is_pack&&p.active!==false);
  openModal(`<button class="icon-btn close" onclick="adminPromotion()">×</button><h3>Créer une promotion</h3>
  <div class="form-group"><label>Nom de l’offre</label><input id="promoName" placeholder="Ex : Offre Sandy"></div>
  <div class="form-grid"><div class="form-group"><label>Type</label><select id="promoType"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option><option value="free_delivery">Livraison offerte</option></select></div><div class="form-group"><label>Valeur</label><input id="promoValue" type="number" min="0" value="10"></div></div>
  <div class="form-group"><label>Article mis en avant (facultatif)</label><select id="promoProduct"><option value="">Aucun article</option>${products.map(p=>`<option value="${p.id}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select></div>
  <div class="form-group"><label>Texte de la bannière</label><input id="promoBannerText" placeholder="Ex : -20 % sur la grosse perceuse aujourd’hui !"></div>
  <div class="form-group"><label>Minimum de commande</label><input id="promoMin" type="number" min="0" value="0"></div>
  <div class="form-group"><label>Code (vide si automatique)</label><input id="promoCodeAdmin" placeholder="Ex : SANDY10"></div>
  <label class="checkbox-row"><input type="checkbox" id="promoAuto"> Appliquer automatiquement</label>
  <label class="checkbox-row"><input type="checkbox" id="promoBanner" checked> Afficher dans la bannière du site</label>
  <div class="form-grid"><div class="form-group"><label>Début</label><input id="promoStart" type="datetime-local"></div><div class="form-group"><label>Fin</label><input id="promoEnd" type="datetime-local"></div></div>
  <div class="modal-actions"><button class="btn primary" onclick="savePromotion()">Créer l’offre</button></div>`);
};
window.savePromotion=async()=>{
  const code=$('#promoCodeAdmin').value.trim().toUpperCase();
  const x={name:$('#promoName').value.trim(),discount_type:$('#promoType').value,value:num($('#promoValue').value),min_subtotal:num($('#promoMin').value),code:code||null,auto_apply:$('#promoAuto').checked,starts_at:$('#promoStart').value?new Date($('#promoStart').value).toISOString():null,ends_at:$('#promoEnd').value?new Date($('#promoEnd').value).toISOString():null,active:true,product_id:$('#promoProduct').value||null,banner_text:$('#promoBannerText').value.trim()||null,banner_enabled:$('#promoBanner').checked};
  if(!x.name)return toast('Donnez un nom à l’offre.');if(x.auto_apply)x.code=null;
  if(hasSupabase){const{error}=await sb.from('promotions').insert(x);if(error)return toast(error.message)}
  else{demo.promotions.unshift({...x,id:uid('promo'),created_at:new Date().toISOString()});storageSet(LS.promotions,demo.promotions)}
  toast('Promotion créée.');await renderPromoBanner();adminPromotion();
};
window.togglePromotion=async(id,current)=>{if(hasSupabase){const{error}=await sb.from('promotions').update({active:!current}).eq('id',id);if(error)return toast(error.message)}else{const p=demo.promotions.find(x=>String(x.id)===String(id));if(p)p.active=!current;storageSet(LS.promotions,demo.promotions)}toast(current?'Promotion désactivée.':'Promotion activée.');adminPromotion();};
window.deletePromotion=async id=>{
  if(!confirm('Supprimer définitivement cette promotion ?'))return;
  if(hasSupabase){
    const {error}=await sb.from('promotions').delete().eq('id',id);
    if(error)return toast(error.message||'Suppression impossible.');
  }else{
    demo.promotions=demo.promotions.filter(p=>String(p.id)!==String(id));
    storageSet(LS.promotions,demo.promotions);
  }
  demo.promotions=demo.promotions.filter(p=>String(p.id)!==String(id));
  await renderPromoBanner();
  toast('Promotion supprimée.');
  adminPromotion();
};
async function adminContacts(){const list=await getContacts();openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Contacts</h3><div class="stack">${list.map(c=>`<div class="catalog-row"><div class="catalog-icon"><i data-lucide="phone"></i></div><div><strong>${esc(c.label)} — ${esc(c.name)}</strong><p>${esc(c.phone)}</p></div><div class="catalog-actions"><button onclick="editContact('${c.id}')"><i data-lucide="pencil"></i></button></div></div>`).join('')}</div><button class="btn primary" style="width:100%;margin-top:13px" onclick="editContact('')">Ajouter un contact</button>`);demo.contacts=list;iconRefresh()}
window.editContact=id=>{const c=demo.contacts.find(x=>String(x.id)===String(id));openModal(`<button class="icon-btn close" onclick="adminContacts()">×</button><h3>${c?'Modifier':'Ajouter'} un contact</h3><div class="form-group"><label>Fonction</label><input id="contactLabel" value="${esc(c?.label||'')}"></div><div class="form-group"><label>Nom</label><input id="contactName" value="${esc(c?.name||'')}"></div><div class="form-group"><label>Numéro</label><input id="contactPhone" value="${esc(c?.phone||'')}"></div><div class="form-group"><label>Ordre</label><input id="contactOrder" type="number" value="${num(c?.sort_order||1)}"></div><div class="modal-actions"><button class="btn primary" onclick="saveContact('${id}')">Enregistrer</button></div>`)};
window.saveContact=async id=>{const x={label:$('#contactLabel').value.trim(),name:$('#contactName').value.trim(),phone:$('#contactPhone').value.trim(),sort_order:num($('#contactOrder').value),active:true};if(!x.label||!x.name||!x.phone)return toast('Complétez les champs.');if(hasSupabase){const q=id?sb.from('contacts').update(x).eq('id',id):sb.from('contacts').insert(x);const{error}=await q;if(error)return toast(error.message)}else{if(id){const i=demo.contacts.findIndex(c=>String(c.id)===String(id));demo.contacts[i]={...demo.contacts[i],...x}}else demo.contacts.push({...x,id:uid('c')});storageSet(LS.contacts,demo.contacts)}closeModal();renderHome();toast('Contact enregistré.')};
function adminSettings(){openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Paramètres</h3><label class="checkbox-row"><input type="checkbox" id="setOpen" ${settings.business_open?'checked':''}> Commandes ouvertes</label>
<div class="form-grid"><div class="form-group"><label>Frais livraison</label><input id="setFee" type="number" min="0" value="${num(settings.delivery_fee)}"></div><div class="form-group"><label>Minimum commande</label><input id="setMin" type="number" min="0" value="${num(settings.min_order)}"></div></div>
<div class="form-grid"><div class="form-group"><label>Délai min (min)</label><input id="setEtaMin" type="number" min="0" value="${num(settings.delivery_eta_min)}"></div><div class="form-group"><label>Délai max (min)</label><input id="setEtaMax" type="number" min="0" value="${num(settings.delivery_eta_max)}"></div></div>
<div class="form-grid"><div class="form-group"><label>Points gagnés / commande livrée</label><input id="setPoints" type="number" min="0" value="${num(settings.points_per_order)}"></div><div class="form-group"><label>Grosse commande à partir de</label><input id="setLargeOrder" type="number" min="1" value="${num(settings.large_order_item_threshold||100)}"><small>Nombre total d’articles.</small></div></div>
<div class="form-group"><label>Alerte commande en retard après</label><input id="setDelayMinutes" type="number" min="1" value="${num(settings.order_delay_minutes||1440)}"><small>En minutes. 1440 = 24 heures sans changement.</small></div>
<div class="notice compact"><i data-lucide="gift"></i><div><strong>Récompenses fidélité avancées</strong><span>Les paliers 50 / 100 / etc. se gèrent depuis « Récompenses fidélité » dans l’administration.</span></div></div>
<div class="form-group"><label>Adresse</label><input id="setAddress" value="${esc(settings.address)}"></div><div class="form-group"><label>Téléphone du LTD</label><input id="setPhone" value="${esc(settings.phone)}"></div><div class="form-group"><label>Horaires / information d’ouverture</label><input id="setHours" value="${esc(settings.hours_text)}"></div><div class="form-group"><label>Jour de recrutement</label><input id="setRecruit" value="${esc(settings.recruitment_day)}"></div>
<div class="two-col"><label class="checkbox-row"><input type="checkbox" id="setDelivery" ${settings.delivery_enabled?'checked':''}> Livraison</label><label class="checkbox-row"><input type="checkbox" id="setPickup" ${settings.pickup_enabled?'checked':''}> Retrait LTD</label></div>
<div class="divider"></div><span class="eyebrow">DISCORD — COMMANDES & SERVICE EN DIRECT</span><div class="form-group"><label>ID du salon commandes</label><input id="setDiscordChannel" value="${esc(settings.discord_orders_channel_id||'')}" placeholder="Ex : 123456789012345678"></div><div class="form-group"><label>ID du rôle En service</label><input id="setDiscordRole" value="${esc(settings.discord_on_duty_role_id||'')}" placeholder="Ex : 123456789012345678"></div><p class="subtle">Le rôle « En service » sert aussi au statut en direct affiché aux clients.</p>
<div class="modal-actions"><button class="btn primary" onclick="saveSettings()">Enregistrer</button></div>`);iconRefresh();}
window.saveSettings=async()=>{
  const x={business_open:$('#setOpen').checked,delivery_fee:num($('#setFee').value),min_order:num($('#setMin').value),delivery_eta_min:num($('#setEtaMin').value),delivery_eta_max:num($('#setEtaMax').value),points_per_order:num($('#setPoints').value),order_delay_minutes:Math.max(1,Math.floor(num($('#setDelayMinutes').value))),large_order_item_threshold:Math.max(1,Math.floor(num($('#setLargeOrder').value))),address:$('#setAddress').value.trim(),phone:$('#setPhone').value.trim(),hours_text:$('#setHours').value.trim(),recruitment_day:$('#setRecruit').value.trim(),delivery_enabled:$('#setDelivery').checked,pickup_enabled:$('#setPickup').checked,discord_orders_channel_id:$('#setDiscordChannel').value.trim(),discord_on_duty_role_id:$('#setDiscordRole').value.trim()};
  if(hasSupabase){const{error}=await sb.from('site_settings').update(x).eq('id','main');if(error)return toast(error.message)}
  else{Object.assign(settings,x);storageSet(LS.settings,settings)}
  Object.assign(settings,x);closeModal();applySettingsToUI();renderLiveService();toast('Paramètres enregistrés.');
};
let adminAccountsCache=[];
let employeeListCache=[];
async function renderEmployeesList(){
  if(!isDirection())return toast('Accès réservé à la direction.');
  const target=$('#employeeList'),status=$('#employeeListStatus');
  if(target)target.innerHTML='<div class="empty">Chargement des employés…</div>';
  if(status)status.textContent='Synchronisation avec Supabase…';
  try{
    if(!requireCentralDatabase('la liste des employés'))return;
    const result=await invokeAdminUsers({action:'list_staff'});
    employeeListCache=result.employees||[];
    adminAccountsCache=[...employeeListCache,...adminAccountsCache.filter(x=>!x.staff_role)];
    renderEmployeeListRows();
    if(status)status.textContent=`${employeeListCache.length} compte${employeeListCache.length>1?'s':''} employé${employeeListCache.length>1?'s':''} enregistré${employeeListCache.length>1?'s':''}`;
  }catch(err){
    if(target)target.innerHTML=`<div class="empty">${esc(err.message||'Impossible de charger les employés.')}</div>`;
    if(status)status.textContent='';
  }
  iconRefresh();
}
function renderEmployeeListRows(){
  const target=$('#employeeList');if(!target)return;
  const q=($('#employeeListSearch')?.value||'').trim().toLowerCase();
  const rows=employeeListCache.filter(u=>!q||[u.display_name,u.staff_username,u.phone,roleLabel(u.staff_role)].some(v=>String(v||'').toLowerCase().includes(q)));
  target.innerHTML=rows.map(u=>{
    const direction=['patron','copatron'].includes(u.staff_role);
    const avatar=u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:'<i data-lucide="user-round"></i>';
    return `<div class="catalog-row account-row"><div class="catalog-icon">${avatar}</div><div><strong>${esc(u.display_name||'Sans nom')}</strong><p>${esc(roleLabel(u.staff_role))} • @${esc(u.staff_username||'identifiant-manquant')}${u.phone?` • ${esc(u.phone)}`:''}${u.must_change_password?' • mot de passe temporaire':''}</p></div><div class="catalog-actions"><button onclick="editManagedAccount('${u.id}')" title="Modifier"><i data-lucide="pencil"></i></button><button onclick="resetStaffPasswordPrompt('${u.id}','${esc(u.staff_username||'')}')" title="Réinitialiser le mot de passe"><i data-lucide="key-round"></i></button>${!direction?`<button onclick="deleteEmployeeFromList('${u.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button>`:''}</div></div>`;
  }).join('')||'<div class="empty">Aucun employé trouvé.</div>';
  iconRefresh();
}
window.deleteEmployeeFromList=async id=>{
  const u=employeeListCache.find(x=>String(x.id)===String(id));if(!u)return;
  if(!confirm(`Supprimer définitivement le compte de ${u.display_name||'cet employé'} ?`))return;
  try{await invokeAdminUsers({action:'delete_account',user_id:id});toast('Compte supprimé.');await renderEmployeesList();}catch(err){toast(err.message||'Suppression impossible.');}
};
async function adminAccounts(initialFilter='all'){
  if(!isDirection())return toast('Accès réservé à la direction.');
  try{
    if(hasSupabase){
      const result=await invokeAdminUsers({action:'list_accounts'});
      adminAccountsCache=result.accounts||[];
    }else{
      adminAccountsCache=demo.profile?[{...demo.profile,email:demo.user?.email||'',is_staff:Boolean(demo.profile.staff_role)}]:[];
    }
  }catch(err){return toast(err.message||'Impossible de charger les comptes.');}
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Comptes</h3><p class="page-intro">Tous les comptes clients et employés connectés au LTD sont centralisés ici.</p><div class="account-panel-toolbar"><button class="account-filter active" data-account-filter="all" onclick="filterAccountPanel('all')">Tous</button><button class="account-filter" data-account-filter="staff" onclick="filterAccountPanel('staff')">Employés</button><button class="account-filter" data-account-filter="clients" onclick="filterAccountPanel('clients')">Clients</button></div><div class="search-wrap account-search"><i data-lucide="search"></i><input id="accountSearch" placeholder="Rechercher un nom, identifiant ou email…"></div><div id="accountPanelList" class="stack"></div><button class="btn primary full" style="margin-top:13px" onclick="showCreateStaffAccount()"><i data-lucide="user-round-plus"></i> Créer un compte employé</button>`);
  $('#accountSearch')?.addEventListener('input',()=>filterAccountPanel(currentAccountFilter));
  filterAccountPanel(initialFilter);
  iconRefresh();
}
let currentAccountFilter='all';
window.filterAccountPanel=(filter='all')=>{
  currentAccountFilter=filter;
  $$('.account-filter').forEach(b=>b.classList.toggle('active',b.dataset.accountFilter===filter));
  const q=($('#accountSearch')?.value||'').trim().toLowerCase();
  const rows=adminAccountsCache.filter(u=>{
    const staff=Boolean(u.staff_role||u.is_staff);
    if(filter==='staff'&&!staff)return false;
    if(filter==='clients'&&staff)return false;
    if(!q)return true;
    return [u.display_name,u.staff_username,u.email,u.phone,roleLabel(u.staff_role||u.role||'customer')].some(v=>String(v||'').toLowerCase().includes(q));
  });
  const target=$('#accountPanelList');if(!target)return;
  target.innerHTML=rows.map(accountPanelCard).join('')||'<div class="empty">Aucun compte dans cette catégorie.</div>';
  iconRefresh();
};
function accountPanelCard(u){
  const staff=Boolean(u.staff_role||u.is_staff);
  const direction=['patron','copatron'].includes(u.staff_role);
  const avatar=u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:'<i data-lucide="user-round"></i>';
  const identity=staff?(u.staff_username?`@${esc(u.staff_username)}`:'Identifiant à compléter'):(u.email||'Email non renseigné');
  return `<div class="catalog-row account-row"><div class="catalog-icon">${avatar}</div><div><strong>${esc(u.display_name||'Sans nom')}</strong><p>${esc(roleLabel(u.staff_role||u.role||'customer'))} • ${identity}${u.phone?` • ${esc(u.phone)}`:''}${u.must_change_password?' • mot de passe temporaire':''}</p></div><div class="catalog-actions"><button onclick="editManagedAccount('${u.id}')" title="Modifier"><i data-lucide="pencil"></i></button>${staff?`<button onclick="resetStaffPasswordPrompt('${u.id}','${esc(u.staff_username||'')}')" title="Réinitialiser le mot de passe"><i data-lucide="key-round"></i></button>`:(u.email?`<button onclick="requestClientPasswordReset('${esc(u.email)}')" title="Envoyer un lien de réinitialisation"><i data-lucide="mail-key"></i></button>`:'')}${!direction?`<button onclick="deleteManagedAccount('${u.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button>`:''}</div></div>`;
}
window.editManagedAccount=id=>{
  const u=adminAccountsCache.find(x=>String(x.id)===String(id));if(!u)return;
  const staff=Boolean(u.staff_role||u.is_staff),direction=['patron','copatron'].includes(u.staff_role);
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><h3>Modifier le compte</h3><div class="form-group"><label>Prénom & nom</label><input id="managedName" value="${esc(u.display_name||'')}"></div><div class="form-group"><label>Téléphone</label><input id="managedPhone" value="${esc(u.phone||'')}"></div>${staff?`<div class="form-group"><label>Identifiant</label><input value="${esc(u.staff_username||'')}" disabled><small>L’identifiant est généré automatiquement à la création.</small></div><div class="form-group"><label>Rôle</label><select id="managedRole" ${direction?'disabled':''}>${Object.entries(STAFF_ROLES).map(([k,v])=>`<option value="${k}" ${u.staff_role===k?'selected':''}>${esc(v)}</option>`).join('')}</select>${direction?'<small>Les deux comptes direction restent Gérant / Cogérante.</small>':''}</div><label class="checkbox-row"><input id="managedShowPhone" type="checkbox" ${u.show_phone?'checked':''}> Afficher le numéro dans les contacts publics</label>`:`<div class="loyalty-box"><strong>${num(u.loyalty_points)} points fidélité</strong><div>Les points se gèrent séparément pour garder un historique.</div></div>`}<div class="modal-actions">${!staff?`<button class="btn ghost" onclick="adjustPointsPrompt('${u.id}',${num(u.loyalty_points)})"><i data-lucide="gift"></i> Fidélité</button>`:''}<button class="btn primary" onclick="saveManagedAccount('${u.id}',${staff?'true':'false'},${direction?'true':'false'})">Enregistrer</button></div>`);
  iconRefresh();
};
window.saveManagedAccount=async(id,staff,direction)=>{
  const display_name=($('#managedName')?.value||'').trim(),phone=($('#managedPhone')?.value||'').trim();
  if(!display_name)return toast('Le nom est obligatoire.');
  const body={action:'update_account',user_id:id,display_name,phone};
  if(staff){body.staff_role=direction?(adminAccountsCache.find(x=>String(x.id)===String(id))?.staff_role||null):($('#managedRole')?.value||null);body.show_phone=Boolean($('#managedShowPhone')?.checked)}
  try{if(hasSupabase)await invokeAdminUsers(body);toast('Compte modifié.');closeModal();renderHome();if(staff&&$('#employeesView')?.classList.contains('active'))await renderEmployeesList();else adminAccounts(staff?'staff':'clients');}catch(err){toast(err.message||'Modification impossible.');}
};
window.deleteManagedAccount=async id=>{
  const u=adminAccountsCache.find(x=>String(x.id)===String(id));if(!u)return;
  if(!confirm(`Supprimer définitivement le compte de ${u.display_name||'cet utilisateur'} ?`))return;
  try{if(hasSupabase)await invokeAdminUsers({action:'delete_account',user_id:id});adminAccounts(currentAccountFilter);toast('Compte supprimé.');}catch(err){toast(err.message||'Suppression impossible.');}
};
window.showCreateStaffAccount=()=>openModal(`<button class="icon-btn close" onclick="adminAccounts('staff')">×</button><h3>Créer un compte employé</h3><p class="page-intro">Renseignez seulement le prénom et le nom : l’identifiant <strong>prénom.nom</strong> est généré automatiquement.</p><div class="form-grid"><div class="form-group"><label>Prénom</label><input id="newStaffFirst" placeholder="Prénom"></div><div class="form-group"><label>Nom</label><input id="newStaffLast" placeholder="Nom"></div></div><div class="form-grid"><div class="form-group"><label>Téléphone</label><input id="newStaffPhone" placeholder="Numéro"></div><div class="form-group"><label>Rôle</label><select id="newStaffRole">${EMPLOYEE_ROLE_ENTRIES.map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div></div><div class="form-group"><label>Mot de passe temporaire</label><div class="inline-input"><input id="newStaffPassword" value="${esc(randomTempPassword())}"><button class="btn mini" onclick="document.getElementById('newStaffPassword').value=randomTempPassword()" type="button"><i data-lucide="refresh-cw"></i></button></div></div><div class="modal-actions"><button class="btn primary" onclick="createStaffAccount()">Créer le compte</button></div>`);
window.randomTempPassword=randomTempPassword;
window.createStaffAccount=async()=>{
  if(!requireCentralDatabase('la création de comptes employés'))return;
  const first=($('#newStaffFirst')?.value||'').trim(),last=($('#newStaffLast')?.value||'').trim(),phone=($('#newStaffPhone')?.value||'').trim(),role=$('#newStaffRole')?.value,password=$('#newStaffPassword')?.value||'';
  const username=makeUsername(first,last);
  if(!first||!last||!username||!username.includes('.'))return toast('Renseignez le prénom et le nom.');
  if(password.length<8)return toast('Le mot de passe temporaire doit contenir au moins 8 caractères.');
  try{
    const created=await invokeAdminUsers({action:'create_staff',username,password,display_name:`${first} ${last}`.trim(),phone,staff_role:role});
    const verified=await invokeAdminUsers({action:'get_account',user_id:created.user_id});
    if(!verified?.account?.id)throw new Error('Le compte a été créé mais sa vérification a échoué. Rechargez le panel Comptes.');
    adminAccountsCache=[verified.account,...adminAccountsCache.filter(x=>String(x.id)!==String(verified.account.id))];
    openModal(`<button class="icon-btn close" onclick="adminAccounts('staff')">×</button><span class="eyebrow">COMPTE ENREGISTRÉ</span><h3>${esc(first)} ${esc(last)}</h3><div class="notice success"><i data-lucide="cloud-check"></i><div><strong>Enregistré dans Supabase</strong><span>Ce compte est maintenant disponible sur tous les appareils connectés au site.</span></div></div><div class="access-code-box"><small>Identifiant généré</small><code>${esc(username)}</code></div><div class="access-code-box"><small>Mot de passe temporaire</small><code>${esc(password)}</code></div><p class="page-intro">À la première connexion, l’employé devra obligatoirement choisir un nouveau mot de passe.</p><div class="modal-actions"><button class="btn ghost" onclick="navigator.clipboard?.writeText('${esc(username)} / ${esc(password)}');toast('Identifiants copiés.')"><i data-lucide="copy"></i> Copier</button><button class="btn primary" onclick="closeModal();nav('employees')">Voir dans Liste employés</button></div>`);iconRefresh();
  }catch(err){toast(err.message||'Impossible de créer le compte.');}
};
window.resetStaffPasswordPrompt=(id,username)=>{const temp=randomTempPassword();openModal(`<button class="icon-btn close" onclick="adminAccounts('staff')">×</button><h3>Réinitialiser le mot de passe</h3><p class="page-intro">Le prochain mot de passe sera temporaire et devra être changé à la connexion.</p><div class="form-group"><label>Identifiant</label><input value="${esc(username)}" disabled></div><div class="form-group"><label>Nouveau mot de passe temporaire</label><input id="resetStaffPass" value="${esc(temp)}"></div><div class="modal-actions"><button class="btn primary" onclick="confirmStaffPasswordReset('${id}','${esc(username)}')">Réinitialiser</button></div>`)};
window.confirmStaffPasswordReset=async(id,username)=>{const password=$('#resetStaffPass')?.value||'';if(password.length<8)return toast('8 caractères minimum.');try{if(hasSupabase)await invokeAdminUsers({action:'reset_staff_password',user_id:id,password});openModal(`<button class="icon-btn close" onclick="adminAccounts('staff')">×</button><h3>Mot de passe réinitialisé</h3><div class="access-code-box"><small>${esc(username)}</small><code>${esc(password)}</code></div><p class="page-intro">Transmettez ce mot de passe à la personne concernée. Elle devra le modifier à sa prochaine connexion.</p>`)}catch(err){toast(err.message||'Réinitialisation impossible.')}};
async function adminTeam(){return adminAccounts('staff')}
async function adminCustomers(){return adminAccounts('clients')}

window.adjustPointsPrompt=(id,current)=>openModal(`<button class="icon-btn close" onclick="adminCustomers()">×</button><h3>Points fidélité</h3><div class="loyalty-box"><strong>${current} points actuellement</strong><div>Nombre positif pour ajouter, négatif pour retirer.</div></div><div class="form-group"><label>Ajustement</label><input id="pointsDelta" type="number" value="10"></div><div class="form-group"><label>Motif</label><input id="pointsReason" placeholder="Ex : geste commercial"></div><div class="modal-actions"><button class="btn primary" onclick="savePointsAdjustment('${id}')">Valider</button></div>`);
window.savePointsAdjustment=async id=>{const delta=Math.trunc(num($('#pointsDelta').value)),reason=$('#pointsReason').value.trim();if(!delta)return toast('Indiquez un ajustement différent de 0.');if(!reason)return toast('Indiquez un motif.');if(hasSupabase){const{error}=await sb.rpc('admin_adjust_loyalty',{p_user_id:id,p_delta:delta,p_reason:reason});if(error)return toast(error.message)}else if(String(id)===String(demo.profile?.id)){demo.profile.loyalty_points=Math.max(0,num(demo.profile.loyalty_points)+delta);storageSet(LS.profile,demo.profile)}closeModal();toast('Points mis à jour.');adminCustomers();};
async function getPartnershipRequests(){
  if(hasSupabase){const {data,error}=await sb.from('partnership_requests').select('*').order('created_at',{ascending:false}).limit(100);if(error){toast(error.message);return []}return data||[]}
  return demo.partnerships||[];
}
async function renderPartnershipsPage(){
  if(!isDirection())return nav('admin');
  const list=await getPartnershipRequests();
  const target=$('#partnershipRequestsList');if(!target)return;
  const q=($('#partnershipAdminSearch')?.value||'').trim().toLowerCase();
  const filtered=list.filter(r=>!q||`${r.business_name} ${r.contact_name} ${r.phone} ${r.partnership_type} ${r.message||''}`.toLowerCase().includes(q));
  target.innerHTML=filtered.map(r=>`<div class="partnership-admin-card"><div class="status-line"><div><span class="eyebrow">DEMANDE DE PARTENARIAT</span><h3>${esc(r.business_name)}</h3></div><span class="status ${r.status==='accepted'?'delivered':r.status==='rejected'?'cancelled':'pending'}">${({new:'Nouveau',reviewed:'À l’étude',accepted:'Accepté',rejected:'Refusé'})[r.status]||esc(r.status)}</span></div><div class="partnership-meta"><span><i data-lucide="user-round"></i> ${esc(r.contact_name)}</span><span><i data-lucide="phone"></i> ${esc(r.phone)}</span><span><i data-lucide="handshake"></i> ${esc(r.partnership_type)}</span></div><p>${esc(r.message||'')}</p><div class="order-actions"><button onclick="setPartnershipStatus('${r.id}','reviewed')">À l’étude</button><button class="primary-action" onclick="setPartnershipStatus('${r.id}','accepted')">Accepter</button><button onclick="setPartnershipStatus('${r.id}','rejected')">Refuser</button></div></div>`).join('')||'<div class="empty">Aucune demande de partenariat.</div>';
  iconRefresh();
}
async function adminPartnerships(){nav('partnerships');}
window.setPartnershipStatus=async(id,status)=>{
  if(hasSupabase){const {error}=await sb.from('partnership_requests').update({status}).eq('id',id);if(error)return toast(error.message)}
  else{const row=demo.partnerships.find(x=>String(x.id)===String(id));if(row)row.status=status;storageSet(LS.partnerships,demo.partnerships)}
  toast('Statut mis à jour.');renderPartnershipsPage();
};

window.requestClientPasswordReset=async email=>{if(!hasSupabase)return toast('Cette action nécessite Supabase.');try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;toast('Email de réinitialisation envoyé.')}catch(err){toast(err.message||'Envoi impossible.')}};

let realtimeRefreshTimer=null;
function scheduleRealtimeRefresh(table){
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(async()=>{
    if(['site_settings','products','announcements','contacts','jobs','profiles'].includes(table)) await renderHome();
    if(table==='site_settings'){await getSettings();applySettingsToUI();if(uiIsStaff())await renderStaffHome();}
    if(table==='products'&&$('#shopView')?.classList.contains('active'))await renderShop();
    if(table==='announcements'&&$('#newsView')?.classList.contains('active'))await renderNews();
    if(table==='jobs'&&$('#recruitmentView')?.classList.contains('active'))await renderRecruitment();
    if(table==='contacts'&&$('#contactView')?.classList.contains('active'))await renderContact();
    if(table==='partnership_requests'&&$('#partnershipsView')?.classList.contains('active'))await renderPartnershipsPage();
    if(table==='orders'){
      if(uiIsStaff())await renderStaffHome();
      if($('#ordersView')?.classList.contains('active'))await renderOrders();
      if($('#adminView')?.classList.contains('active'))await renderAdmin();
    }
  },120);
}

async function loadPreviewPermissions(role){
  previewPermissions=new Set();
  if(!role || role==='customer' || ['patron','copatron'].includes(role))return;
  if(!hasSupabase)return;
  const {data,error}=await sb.rpc('get_preview_role_permissions',{p_staff_role:role});
  if(error)throw error;
  previewPermissions=new Set((data||[]).map(x=>x.permission_key));
}
function updatePreviewBanner(){
  const banner=$('#rolePreviewBanner');
  if(!banner)return;
  if(!isPreviewMode()){banner.classList.add('hidden');return;}
  banner.classList.remove('hidden');
  const label=previewRole==='customer'?'Client':roleLabel(previewRole);
  $('#rolePreviewLabel').textContent=`Aperçu : ${label}`;
}
window.showRolePreviewPicker=()=>{
  if(!canUseRolePreview())return toast('Ce compte ne peut pas utiliser le mode aperçu.');
  const options=[['customer','Client'],...EMPLOYEE_ROLE_ENTRIES];
  openModal(`<button class="icon-btn close" onclick="closeModal()">×</button><span class="eyebrow">VOIR COMME</span><h3>Choisir une vue</h3><p class="page-intro">Ce mode modifie uniquement l’affichage. Votre vrai compte et vos droits restent inchangés.</p><div class="preview-role-grid">${options.map(([k,v])=>`<button class="preview-role-card" onclick="activateRolePreview('${k}')"><i data-lucide="${k==='customer'?'user-round':'badge-check'}"></i><span>${esc(v)}</span></button>`).join('')}</div>`);iconRefresh();
};
window.activateRolePreview=async role=>{
  if(!canUseRolePreview())return toast('Accès refusé.');
  try{await loadPreviewPermissions(role);previewRole=role;closeModal(true);nav('home');toast(`Mode aperçu : ${role==='customer'?'Client':roleLabel(role)}`);}catch(err){toast(err.message||'Impossible de charger cet aperçu.');}
};
window.exitRolePreview=()=>{previewRole=null;previewPermissions=new Set();updatePreviewBanner();nav('home');toast('Retour à votre vue réelle.');};

function initRealtime(){
  if(!hasSupabase)return;
  if(realtimeChannel){try{sb.removeChannel(realtimeChannel)}catch{}realtimeChannel=null}
  let ch=sb.channel('ltd-sandy-live-v8');
  ['orders','site_settings','products','announcements','contacts','jobs','profiles','promotions','partnership_requests','delivery_reviews'].forEach(table=>{
    ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>scheduleRealtimeRefresh(table));
  });
  realtimeChannel=ch.subscribe();
}

async function initAuth(){
  if(!hasSupabase)demo.profile=null;else await getCurrentProfile();
  await loadMyPermissions();await getSettings();
  if(previewRole&&!canUseRolePreview()){previewRole=null;previewPermissions=new Set();}
  if(!uiCanManageAnything()&&$('#adminView').classList.contains('active'))nav('home');
  applySettingsToUI();await renderHome();initRealtime();
  if(demo.profile?.must_change_password && passwordPromptedFor!==demo.profile.id){passwordPromptedFor=demo.profile.id;setTimeout(()=>showPasswordChange(true),180)}
}

(async function init(){
  applyTheme(localStorage.getItem(THEME_KEY)||'dark');
  seedDemo();iconRefresh();
  if(!hasSupabase && requireSharedDb){document.body.classList.add('database-offline');}
  await initAuth();demo.promotions=await getPromotions();demo.jobs=await getJobs();renderShop();
  if(hasSupabase)sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>showPasswordChange(false),200);setTimeout(initAuth,100)});
})();
