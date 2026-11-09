/** Customer prices in INR for a non-recurring 30-day access pass. */
export const PLANS = Object.freeze({
  free:   {id:'free',   label:'Free',   price:0,   batch:5,  daily:10,   maxMB:50,   ads:true},
  normal: {id:'normal', label:'Normal', price:79,  batch:15, daily:50,   maxMB:150,  ads:false},
  plus:   {id:'plus',   label:'Plus',   price:149, batch:40, daily:200,  maxMB:300,  ads:false},
  pro:    {id:'pro',    label:'Pro',    price:299, batch:100,daily:1000, maxMB:750,  ads:false},
  ultra:  {id:'ultra',  label:'Ultra',  price:599, batch:null,daily:null, maxMB:1024, ads:false},
});
export const PAID_PLAN_IDS = Object.freeze(['normal','plus','pro','ultra']);
export function getPlan(id){return PLANS[id] || PLANS.free;}
export function amountPaise(id){return PAID_PLAN_IDS.includes(id)?PLANS[id].price*100:null;}
