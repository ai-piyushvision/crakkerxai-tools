import {PLANS} from './plans.mjs';
function planCard(p){
 const el=document.createElement('article');
 el.className=`membership-card ${p.id==='plus'?'featured':''}`;
 const limit=p.batch===null?'Unlimited files per batch*':`${p.batch} files per batch`;
 const daily=p.daily===null?'Unlimited conversions*':`${p.daily} conversions / day`;
 const lead=p.price===0?'Always free':'One-time 30-day pass';
 // Card content uses only local compile-time price data.
 el.innerHTML=`${p.id==='plus'?'<span class="recommended">Most popular</span>':''}<div class="membership-card-title">${p.label}</div>
 <div class="membership-price">₹${p.price}<span>${p.price===0?' / free':' / 30 days'}</span></div><p class="membership-caption">${lead}</p>
 <ul class="membership-features"><li>${limit}</li><li>${daily}</li><li>Up to ${p.maxMB} MB input per task</li><li>${p.ads?'Ads supported':'Ad-free for signed-in active members'}</li><li>All 8 PDF & image tools</li></ul>
 <a class="${p.id==='plus'?'primary-btn':'outlined-btn'} membership-cta" href="${p.price===0?'../#tools':`../account/?plan=${p.id}`}">${p.price===0?'Use free tools':'Choose '+p.label}</a>`;
 return el;
}
export function initPricing(){
 const grid=document.getElementById('plan-cards');if(!grid)return;
 grid.replaceChildren(...Object.values(PLANS).map(planCard));
}
