// The ledger's admin page: an account's balance over the last 90 days as a small line chart and
// its recent transactions. The page itself holds nothing; every call needs the admin key, typed
// in and kept only in this tab.
export const ADMIN_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ledger admin</title>
<style>
:root{--bg:#f6f4ef;--fg:#1d1d1f;--mute:#6b6b70;--line:#2b6cb0;--grid:#ddd8cf;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececf0;--mute:#9a9aa2;--line:#7fb4ff;--grid:#33333a;--card:#1d1d21}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
main{max-width:860px;margin:0 auto}input,button{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--grid);background:var(--card);color:var(--fg)}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.card{background:var(--card);border-radius:12px;padding:14px;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 4px;border-bottom:1px solid var(--grid);text-align:left}td.n{text-align:right;font-variant-numeric:tabular-nums}
.mute{color:var(--mute)}svg{width:100%;height:auto;display:block}
</style></head><body><main>
<h1>Ledger</h1>
<div class="row"><input id="key" type="password" placeholder="admin key" autocomplete="off"><input id="id" placeholder="account (hh:..., npc:..., player)"><button id="go">Show</button><button id="list">Accounts</button><button id="settle">Settle now</button></div>
<div id="out"></div>
</main><script>
const $=(s)=>document.querySelector(s),out=$('#out');
const KIND=['','wage','bonus','sale','request','allowance','lunch','clothes','food','rent','bills','gift','theft','robbed','returned','hospital','purchase','tip','transfer','fine','pension','betrayed','found','other'];
const api=async(p,o={})=>{const r=await fetch('/admin/api/'+p,{...o,headers:{'x-admin-key':$('#key').value}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||r.status);return r.json();};
const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chart(daily){if(!daily.length)return'';const W=820,H=220,P=36,v=daily.map((d)=>d[1]),lo=Math.min(...v,0),hi=Math.max(...v,1),x=(i)=>P+i*(W-2*P)/Math.max(1,daily.length-1),y=(b)=>H-P-(b-lo)*(H-2*P)/Math.max(1,hi-lo);
const pts=daily.map((d,i)=>x(i).toFixed(1)+','+y(d[1]).toFixed(1)).join(' ');
return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="balance over time"><line x1="'+P+'" x2="'+(W-P)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="var(--grid)"/><polyline fill="none" stroke="var(--line)" stroke-width="2" points="'+pts+'"/><text x="'+P+'" y="16" fill="var(--mute)" font-size="12">'+hi+'</text><text x="'+P+'" y="'+(H-8)+'" fill="var(--mute)" font-size="12">'+lo+' (day '+daily[0][0]+' to '+daily[daily.length-1][0]+')</text></svg>';}
async function show(id){out.textContent='...';try{const A=await api('account/'+encodeURIComponent(id));const tx=(A.state?.tx||[]).slice().reverse();
out.innerHTML='<div class="card"><h2>'+esc(A.id)+'</h2><p>Balance <b>'+A.balance+'</b> credits on day '+A.day+'</p>'+chart(A.daily)+'</div><div class="card"><h3>Recent</h3><table><tr><th>Day</th><th>Kind</th><th>With</th><th class="n">Credits</th></tr>'+tx.map((t)=>'<tr><td>'+t[0]+'</td><td>'+esc(KIND[t[2]]||t[2])+(t[4]?' <span class="mute">(regular)</span>':'')+'</td><td>'+esc(t[3])+'</td><td class="n">'+t[1]+'</td></tr>').join('')+'</table></div>';}catch(e){out.textContent='Error: '+e.message;}}
$('#go').onclick=()=>show($('#id').value.trim());
$('#list').onclick=async()=>{try{const L=await api('accounts');out.innerHTML='<div class="card"><table><tr><th>Account</th><th class="n">Balance</th><th>Day</th></tr>'+L.map((a)=>'<tr><td><a href="#" data-id="'+esc(a.id)+'">'+esc(a.id)+'</a></td><td class="n">'+a.balance+'</td><td>'+a.day+'</td></tr>').join('')+'</table></div>';out.querySelectorAll('a').forEach((a)=>a.onclick=(e)=>{e.preventDefault();show(a.dataset.id);});}catch(e){out.textContent='Error: '+e.message;}};
$('#settle').onclick=async()=>{try{const r=await api('settle',{method:'POST'});out.textContent='Settled '+r.accounts+' accounts, '+r.events+' events.';}catch(e){out.textContent='Error: '+e.message;}};
</script></body></html>`;
