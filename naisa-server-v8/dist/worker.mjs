import {DurableObject} from 'cloudflare:workers';

function NaisaCore(){
const PROTOCOL='team-design-v8-finale',ROLES=['pm','design','structure','comms'],BUDGET=150,PM_CLICKS=15,KW_BASE=3,PICK_MS=20000,READ_MS=45000,LOCK_MS=3600;
const G0=9.80665e-3,STAGE_ISP=450,BUS={mass:380,power:60};
// Educational example: minimum thrust acceleration in space, not a surface-launch payload rating.
const MIN_ACCEL=1,BUDGET_BONUS=10;
// Ni-SAR1114: 궤도 단계 1분 뒤 도움 투표(20초). 도움을 받으면 팀 점수 −10, 설계로 돌아가면 기계·추진 담당 −15
const ORBIT_HELP_MS=60000,VOTE_MS=20000,HELP_PENALTY=10,REDESIGN_PENALTY=15,PM_REDESIGN_PENALTY=5;   // PM: 키워드 전달·설계안 확정 책임
// 모듈 9종. cost: 공유 예산, mass: kg, power: 소비 전력 W. 나머지는 성능 값과 비행 사건·조종 화면으로 넘기는 값
const MODULES={
 engine:{owner:'design',label:'Engine',options:[
  {id:'heavy',name:'High-thrust engine',cost:20,mass:200,isp:315,thrustN:4800,land:.75,thrust:3,dv:6},
  {id:'light',name:'Light long-life engine',cost:14,mass:85,isp:328,thrustN:2600,land:1.4,thrust:1,dv:4}]},
 tank:{owner:'design',label:'Propellant tank',options:[
  {id:'small',name:'Small tank',cost:8,mass:60,prop:900,fuel:2},
  {id:'medium',name:'Standard tank',cost:13,mass:100,prop:1200,fuel:3},
  {id:'large',name:'Extended tank',cost:17,mass:150,prop:1800,fuel:4}]},
 stage:{owner:'design',label:'Upper stage · airframe',options:[
  {id:'s',name:'Small stage · light frame',cost:14,mass:120,stProp:5000,stDry:600,integrity:2},
  {id:'m',name:'Medium stage · reinforced frame',cost:22,mass:190,stProp:7500,stDry:850,integrity:3},
  {id:'l',name:'Large stage · heavy frame',cost:28,mass:260,stProp:11000,stDry:1200,integrity:4}]},
 sampler:{owner:'structure',label:'Sampling · analysis',options:[
  {id:'scoop',name:'Surface scoop arm',cost:8,mass:40,power:30},
  {id:'drill',name:'1 m rotary-percussive drill',cost:18,mass:120,power:90},
  {id:'lab',name:'Heating gas analyzer',cost:20,mass:90,power:110}]},
 storage:{owner:'structure',label:'Sample storage',options:[
  {id:'box',name:'Sealed storage',cost:5,mass:20,power:0},
  {id:'cryo',name:'Frozen storage',cost:16,mass:70,power:60},
  {id:'vac',name:'Vacuum storage',cost:13,mass:60,power:20}]},
 shield:{owner:'structure',label:'Protection',options:[
  {id:'basic',name:'Insulating shield',cost:8,mass:45,protection:1,shieldMax:60},
  {id:'thermal',name:'Reinforced heat shield',cost:16,mass:90,protection:3,shieldMax:85,aero:true},
  {id:'cold',name:'Thermal & radiation shield',cost:22,mass:130,protection:4,shieldMax:100}]},
 antenna:{owner:'comms',label:'Comms module',options:[
  {id:'low',name:'Low-gain antenna',cost:8,mass:28,power:20,com:1,kw:0},
  {id:'high',name:'High-gain antenna',cost:17,mass:55,power:45,com:3,kw:1},
  {id:'relay',name:'Comms relay',cost:24,mass:82,power:70,com:4,kw:2}]},
 power:{owner:'comms',label:'Power',options:[
  {id:'solar',name:'Lightweight solar array',cost:16,mass:90,gen:420,sun:true,pw:32},
  {id:'bigsolar',name:'Large solar array',cost:22,mass:150,gen:700,sun:true,pw:52},
  {id:'rtg',name:'Radioisotope generator',cost:28,mass:210,gen:480,sun:false,pw:60}]},
 nav:{owner:'comms',label:'Navigation',options:[
  {id:'basic',name:'Basic nav',cost:6,mass:15,power:20,capAU:0.03,tcmDv:.08,tcm:.5,range:.5,clarity:.45,predict:170},
  {id:'radar',name:'Precision radar nav',cost:14,mass:40,power:45,capAU:0.03,tcmDv:.04,tcm:.25,range:.75,clarity:.75,predict:270},
  {id:'auto',name:'Autonomous radar nav',cost:20,mass:65,power:80,capAU:0.03,tcmDv:.02,tcm:.1,range:1,clarity:1,predict:400}]}
};
const ORDER=Object.keys(MODULES);
const KEYWORDS=['Ice','Rock','Atmosphere','Subsurface','Depth','Surface','Gas','Composition','Preservation','Frozen','Vacuum','Polar','Cold','Darkness','Dust','Radiation','Heat','Entry','Landing','Impact','Orbit','Fuel','Efficiency','Lightweight','Power','Comms','Data','Precision','Long-term','Return','Thrust','Sunlight','Relay','Shielding'];
const K=w=>KEYWORDS.indexOf(w);
// 임무: 화성 얼음 채취 하나. sun: 임무지 햇빛 비율, hp/ha: 포획 궤도 고도(km), fit: 선택지별 적합도, w: 가중치, core/help: 도움이 되는 키워드
const MISSIONS={
 ice:{name:'Mars ice sampling',sun:0.4,hp:300,ha:25000,tofMax:300,cap:(a,e)=>({k:1,ops:0.3*(e?e.land:1)}),
  fit:{engine:{heavy:100,eff:90,light:70},tank:{small:45,medium:100,large:85},stage:{s:70,m:100,l:80},sampler:{scoop:25,drill:100,lab:50},storage:{box:15,cryo:100,vac:55},shield:{basic:35,thermal:100,cold:85},antenna:{low:30,high:85,relay:100},power:{solar:25,bigsolar:75,rtg:100},nav:{basic:60,radar:100,auto:90}},
  w:{storage:3,sampler:3,power:2,shield:2,antenna:2},core:['Subsurface','Depth','Frozen','Polar','Entry','Cold','Preservation'].map(K),help:['Ice','Landing','Power','Comms','Darkness','Thrust','Sunlight','Relay','Shielding','Efficiency'].map(K)}
};
// 기존 비행 사건(팀원 구현 유지)
const EVENTS=[
 {id:'power-drop',title:'A solar storm is cutting power output',owner:'comms',description:'With less power than usual, it is hard to run the comms gear and the spacecraft at the same time.',clue:'The spacecraft is crossing a zone of high solar activity. Check your power margin.',actions:[{id:'safe-mode',needs:{power:35},team:20,delta:{power:-4},success:'Cut power use and kept communications alive.'},{id:'full-power',needs:{power:52,integrity:2},team:30,delta:{power:-12},success:'The power margin kept the equipment running.'}]},
 {id:'course-correction',title:'The Mars arrival orbit needs a correction',owner:'design',description:'A navigation error was found. Use fuel and engine performance to correct the course.',clue:'A large course change is expected just before arrival. Save fuel.',actions:[{id:'burn',needs:{deltaV:5,fuel:3},team:30,delta:{fuel:-1},success:'The planned burn corrected the Mars approach orbit.'},{id:'coast',needs:{fuel:2},team:12,delta:{integrity:-1},success:'Fuel was saved, but some structural margin was used up.'}]},
 {id:'landing-site',title:'Large boulders spotted at the planned landing site',owner:'pm',description:'New orbiter photos show many large boulders at the planned landing site. Weigh the science goal against a safe landing.',clue:'NASA moved the Phoenix lander to a safer site after orbiter photos revealed boulders. Check the radar range and the fuel margin.',actions:[{id:'keep-site',needs:{navigation:100},team:30,delta:{},success:'Autonomous navigation steered around the boulders and landed right on the ice.'},{id:'divert-site',needs:{fuel:2},team:18,delta:{fuel:-1},success:'The lander diverted to the safer backup site, a little farther from the ice.'}]},
 {id:'dust-entry',title:'Dust storm and heat load detected',owner:'structure',description:'A dust storm sits on the entry path. Consider shielding and structural strength.',clue:'Dust activity is strong at the landing site. Protection matters.',actions:[{id:'protected-entry',needs:{protection:3,integrity:3},team:30,delta:{integrity:-1},success:'The reinforced structure withstood the heat and dust.'},{id:'fast-entry',needs:{protection:1,integrity:2},team:18,delta:{integrity:-2},success:'The entry was fast, but the structure took damage.'}]}
];
const EMPTY=()=>({players:[],phase:'lobby',roomCode:'',mission:null,helped:false,redesigns:0,lastVote:null,brief:null,keywords:[],kwDraft:[],kwSlots:KW_BASE,kwDeadline:null,design:{},ready:[],warnings:{},pmClicks:PM_CLICKS,lastWarn:null,resources:{},orbit:null,handoff:null,timing:{},stamp:{},phaseAt:0,
 stageScores:{},roleScores:{},weightedResult:null,eventIndex:0,event:null,eventResults:[],briefedEvents:[],designCredited:{},teamScore:0,contributions:{},leaderboard:[],result:null});
const opt=(k,id)=>MODULES[k].options.find(x=>x.id===id)||null,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),r2=x=>Math.round(x*100)/100;
// 설계 계산: 예산·질량·전력·Δv(로켓 방정식)·임무 적합도와 다음 단계로 넘길 값
function metrics(design,mid){
 const M=MISSIONS[mid]||MISSIONS.ice,g=k=>opt(k,design[k]);let cost=0,dry=BUS.mass,use=BUS.power,n=0,fs=0,fw=0;
 for(const k of ORDER){const x=g(k),w=M.w[k]||1;fw+=w;if(!x)continue;n++;cost+=x.cost;dry+=x.mass;use+=x.power||0;fs+=w*M.fit[k][x.id]}
 const eng=g('engine'),tank=g('tank'),st=g('stage'),pw=g('power'),nav=g('nav'),sh=g('shield'),ant=g('antenna');
 const prop=tank?tank.prop:0,wet=dry+prop,dvSc=eng&&tank?eng.isp*G0*Math.log(wet/dry):0,dvStage=st?STAGE_ISP*G0*Math.log((st.stProp+st.stDry+wet)/(st.stDry+wet)):0;
 const genNom=pw?pw.gen:0,gen=pw?Math.round(pw.gen*(pw.sun?M.sun:1)):0,limit=eng?Math.floor(eng.thrustN/MIN_ACCEL):0,overMass=!!eng&&wet>limit,powerShort=!!pw&&gen<use,cap=M.cap(!!(sh&&sh.aero),eng);
 return{chosen:n,cost,budget:BUDGET,budgetBonus:n===ORDER.length&&cost<=BUDGET?BUDGET_BONUS:0,thrustN:eng?eng.thrustN:0,minAccel:MIN_ACCEL,dry:Math.round(dry),prop,wet:Math.round(wet),limit,dvSc:r2(dvSc),dvStage:r2(dvStage),gen,genNom,use,overMass,powerShort,fit:Math.round(fs/fw),
  // 팀원의 비행 사건이 쓰는 값(이름 유지)
  mass:Math.round(wet),massLimit:limit,power:pw?Math.round(pw.pw*Math.min(1,gen/Math.max(1,use))):0,communications:ant?ant.com:0,deltaV:eng?eng.dv:0,fuel:tank?tank.fuel:0,integrity:st?Math.max(0,st.integrity-(overMass?1:0)):0,protection:sh?sh.protection:0,navigation:nav?Math.round(nav.range*100):0,
  // 궤도 단계가 쓰는 값
  orbit:{dvStage:r2(dvStage),dvSc:r2(dvSc),cap:nav?nav.capAU:0.03,tcm:nav?nav.tcmDv:.08,tcmFrac:nav?nav.tcm:.5,predict:nav?nav.predict:170,hp:M.hp,ha:M.ha,k:cap.k,ops:cap.ops,tofMax:M.tofMax},
  // 조종 화면으로 넘기는 값
  cockpit:{thrust:eng?eng.thrust:0,fuel:tank?tank.fuel:0,shieldMax:sh?sh.shieldMax:0,radarRange:nav?nav.range:0,radarClarity:nav?r2(nav.clarity*(ant&&ant.com>=3?1:.85)):0,comm:ant?ant.com:0}};
}
const slotsOf=d=>{const a=opt('antenna',d.antenna);return KW_BASE+(a?a.kw:0)};
function fillKeywords(s){const want=s.kwSlots,cur=s.keywords.slice(0,want);for(const i of s.kwDraft)if(cur.length<want&&!cur.includes(i))cur.push(i);
 const pool=KEYWORDS.map((_,i)=>i).filter(i=>!cur.includes(i));let auto=0;while(cur.length<want&&pool.length){cur.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);auto++}
 s.keywords=cur;s.kwDraft=[];s.kwDeadline=null;return auto}
function tap(s,id,now){const t=s.timing[id]||(s.timing[id]={n:0,ms:0}),from=s.stamp[id]||s.phaseAt||now;t.n++;t.ms+=Math.max(0,now-from);s.stamp[id]=now}
function creditKeywords(s){const pm=s.players.find(p=>p.role==='pm'),M=MISSIONS[s.mission];if(!pm||!M)return;let pts=0;for(const i of s.keywords)pts+=M.core.includes(i)?2:M.help.includes(i)?1:0;s.kwPoints=pts}
function toDesign(s,now){s.phase='design';s.phaseAt=now;s.stamp={};s.brief=null;s.resources=metrics(s.design,s.mission)}
function join(s,name){const p={id:(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():'p'+Math.random().toString(36).slice(2),name:String(name||'Explorer').trim().slice(0,16)||'Explorer',role:null};s.players.push(p);return p}
function leave(s,id){if(!s.players.some(p=>p.id===id))return{changed:false};s.players=s.players.filter(p=>p.id!==id);s.ready=s.ready.filter(x=>x!==id);
 const interrupted=!['lobby','results'].includes(s.phase);
 if(interrupted||s.players.length===0){const keep={leaderboard:s.leaderboard||[],players:s.players,roomCode:s.roomCode};Object.assign(s,EMPTY(),keep);for(const p of s.players)p.role=p.role}
 return{changed:true,interrupted}}
function startFlight(s,now){s.phase='flight';s.phaseAt=now;s.eventIndex=0;s.event=EVENTS[0];s.eventTotal=EVENTS.length;s.eventResults=[];s.briefedEvents=[];s.teamScore=0;s.resources=metrics(s.design,s.mission);
 s.handoff={mission:s.mission,missionName:MISSIONS[s.mission].name,keywords:s.keywords.map(i=>KEYWORDS[i]),design:{...s.design},cockpit:s.resources.cockpit,trajectory:s.orbit&&s.orbit.locked,fit:s.resources.fit,risks:{overMass:s.resources.overMass,powerShort:s.resources.powerShort}}}
// 시간이 지나서 일어나는 일(서버 알람이나 로컬 타이머가 부른다)
// 투표 결과: 3표가 나오거나 모두 투표하거나 시간이 끝나면 정한다. 동점이면 PM의 표, 그래도 안 정해지면 계속
function resolveVote(s,now){const v=s.orbit.vote,c={help:0,redesign:0,continue:0};for(const x of Object.values(v.votes))c[x]++;const max=Math.max(c.help,c.redesign,c.continue),top=Object.keys(c).filter(k=>c[k]===max&&max>0);
 const pm=s.players.find(p=>p.role==='pm'),pv=pm&&v.votes[pm.id],choice=top.length===1?top[0]:top.includes(pv)?pv:'continue';s.lastVote={choice,counts:c,none:max===0,at:now,round:v.round};
 if(choice==='help'){s.helped=true;s.orbit.helped=true;s.orbit.vote=null;s.orbit.helpAt=null}
 else if(choice==='continue'){s.orbit.vote=null;s.orbit.helpAt=now+ORBIT_HELP_MS}
 else{s.redesigns++;const d=s.players.find(p=>p.role==='design');if(d)s.contributions[d.id]=(s.contributions[d.id]||0)-REDESIGN_PENALTY;s.phase='design';s.phaseAt=now;s.stamp={};s.ready=[];s.orbit=null}}
function tick(s,now){let ch=false;
 if(s.phase==='brief'&&s.brief&&now>=s.brief.deadline){if(s.brief.stage==='read'){s.brief={stage:'pick',deadline:now+PICK_MS};s.phaseAt=now;s.stamp={}}else{s.kwAuto=(s.kwAuto||0)+fillKeywords(s);creditKeywords(s);toDesign(s,now)}ch=true}
 if(s.phase==='design'&&s.kwDeadline&&now>=s.kwDeadline){s.kwAuto=(s.kwAuto||0)+fillKeywords(s);creditKeywords(s);ch=true}
 if(s.phase==='orbit'&&s.orbit&&s.orbit.locked&&now>=s.orbit.deadline){startFlight(s,now);ch=true}
 if(s.phase==='orbit'&&s.orbit&&!s.orbit.locked&&!s.orbit.vote&&s.orbit.helpAt&&now>=s.orbit.helpAt){s.orbit.round++;s.orbit.vote={deadline:now+VOTE_MS,votes:{},round:s.orbit.round};s.stamp={};ch=true}
 if(s.phase==='orbit'&&s.orbit&&s.orbit.vote&&now>=s.orbit.vote.deadline){resolveVote(s,now);ch=true}
 return ch}
function alarm(s){const a=[];if(s.phase==='brief'&&s.brief)a.push(s.brief.deadline);if(s.phase==='design'&&s.kwDeadline)a.push(s.kwDeadline);if(s.phase==='orbit'&&s.orbit&&s.orbit.locked)a.push(s.orbit.deadline);else if(s.phase==='orbit'&&s.orbit&&s.orbit.vote)a.push(s.orbit.vote.deadline);else if(s.phase==='orbit'&&s.orbit&&s.orbit.helpAt)a.push(s.orbit.helpAt);return a.length?Math.min(...a):null}
const validIds=(ids,max)=>Array.isArray(ids)&&ids.length<=max&&ids.every(i=>Number.isInteger(i)&&i>=0&&i<KEYWORDS.length)&&new Set(ids).size===ids.length;
// 메시지 처리. 반환: {err} | {relay} | {changed:true}

const SCORE_WEIGHTS={design:45,orbit:20,sun:10,mars:20,return:5};
function missionRating(s){
 const m=metrics(s.design,s.mission),L=s.orbit&&s.orbit.locked,rec=s.stageScores||{},ev=s.eventResults||[];
 const os=L?50+25*clamp((m.orbit.dvSc-L.need)/Math.max(.1,m.orbit.dvSc*.3),0,1)+25*clamp((m.orbit.tofMax-L.tof)/100,0,1):0;
 const D=clamp(m.fit*.8+(m.overMass?0:5)+(m.powerShort?0:10)+(m.cost<=BUDGET?5:0),0,100);
 const O=clamp(os*.4+ev.reduce((a,x)=>a+x.points,0)/Math.max(1,EVENTS.length*30)*60-(s.helped?10:0),0,100);
 const raw={design:D,orbit:O,sun:rec.sun?.score||0,mars:rec.mars?.score||0,return:(rec.trash?.score||0)*.4+(rec.land?.score||0)*.6};
 const stars=n=>Math.min(5,Math.max(1,Math.floor(n/20)+1));
 const rows=Object.keys(SCORE_WEIGHTS).map(k=>({key:k,weight:SCORE_WEIGHTS[k],raw:raw[k],points:raw[k]*SCORE_WEIGHTS[k]/100,stars:stars(raw[k])}));
 const total=Math.round(rows.reduce((a,x)=>a+x.points,0)*100)/100;
 const crew=s.players.map(p=>{let reasons=[],vals=[];
  const keys=ORDER.filter(k=>MODULES[k].owner===p.role);
  for(const k of keys){const x=opt(k,s.design[k]),f=x?MISSIONS[s.mission].fit[k][x.id]:0;vals.push([f,45/Math.max(1,keys.length)]);reasons.push(`${MODULES[k].label}: ${x?x.name:'not selected'} — mission fit ${f}/100.`)}
  if(p.role==='pm'){const M=MISSIONS[s.mission],kw=s.keywords||[],v=clamp(kw.reduce((a,k)=>a+(M.core.includes(k)?1:M.help.includes(k)?.5:0),0)/Math.max(1,kw.length)*100,0,100);vals.push([v,45]);reasons.push(`Mission keywords: ${kw.map(k=>KEYWORDS[k]).join(', ')}. Relevant keywords ${Math.round(v)}%.`)}
  const e=ev.find((_,i)=>EVENTS[i].owner===p.role);if(e){const i=ev.indexOf(e),max=Math.max(...EVENTS[i].actions.map(a=>a.team));vals.push([e.points/max*100,20]);reasons.push(`${e.event}: ${e.success} (${e.points}/${max}).`)}
  if(p.role==='pm'){const v=(s.briefedEvents||[]).length/EVENTS.length*100;vals.push([v,20]);reasons.push(`Control notes delivered: ${(s.briefedEvents||[]).length}/${EVENTS.length}.`)}
  if(L&&L.by===p.id)reasons.push('Confirmed the valid orbit. Orbit quality is evaluated as a team outcome.');
  const RS=(s.roleScores||{}).mars||{};vals.push([rec.sun?.score||0,10]);reasons.push(`MARSBOUND crew flight: ${Math.round(rec.sun?.score||0)}/100.`);if(RS[p.role]!==undefined){vals.push([RS[p.role],20]);reasons.push(`Mars ice recovery · your own role job: ${Math.round(RS[p.role])}/100.`)}else{vals.push([0,20]);reasons.push('Mars ice recovery · no role result recorded.')}if(p.role==='comms'||p.role==='pm'){const ob=rec.trash&&rec.trash.obs==='success';vals.push([ob?100:0,12]);reasons.push(`EARTHBOUND observation: ${ob?'correct count · +1 bonus star for the team':'count not correct'}.`)}else{vals.push([rec.trash?.score||0,12]);reasons.push(`EARTHBOUND flight: ${Math.round(rec.trash?.score||0)}/100.`)}vals.push([rec.land?.score||0,p.role==='structure'?15:5]);reasons.push(`Earth landing${p.role==='structure'?' (you flew it)':''}: ${Math.round(rec.land?.score||0)}/100.`);if(p.role==='pm'&&s.helped)reasons.push('Ni-SAR1114 helped find the orbit: the team rating lost 10 points.');
  const personal=vals.length?vals.reduce((a,[v,w])=>a+v*w,0)/vals.reduce((a,[v,w])=>a+w,0):0;
  return{id:p.id,name:p.name,role:p.role,score:Math.round(personal*100)/100,stars:stars(personal),reasons};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const best=crew.length?crew[0].score:0,mvps=best>0?crew.filter(p=>p.score===best):[];
 const obsBonus=!!(rec.trash&&rec.trash.obs==='success');return{rows,total,obsBonus,helped:!!s.helped,stars:Math.min(5,stars(total)+(obsBonus?1:0)),crew,mvps,complete:['sun','mars','trash','land'].every(k=>rec[k]),records:rec};
}
function recordStage(s,key,d,now){
 let score=0,reason='Skipped / no completion result';
 if(key==='sun'||key==='trash'){if(d&&d.arrived){score=d.rescued?40:key==='sun'?(d.attempt>1?80:100):(d.observation==='success'?100:80);reason=`Arrived${d.rescued?' with Ni-SAR1114 emergency fuel (−60)':''}; attempt ${d.attempt||1}${key==='trash'?'; observation '+(d.observation||'not recorded'):''}`;}else if(d)reason='Did not arrive';}
 if(key==='mars'&&d){const count=Number.isFinite(d.collected)?clamp(Math.floor(d.collected),0,3):(d.completed?3:0);score=count/3*100;reason=`${count}/3 ice samples recovered. Time and avoidance are not logged.`;}
 if(key==='land'&&d){const retry=(d.attempt||1)>1;score=d.success?(retry?60:100):0;reason=d.success?(retry?'Safe splashdown on the second try (retry −40)':'Safe ocean splashdown on the first try'):'Landing failed';}
 s.stageScores=s.stageScores||{};s.stageScores[key]={score,reason,at:now,obs:(d&&d.observation)||null,attempt:(d&&d.attempt)||null};
 s.weightedResult=missionRating(s);
}

function handle(s,id,msg,now){
 const p=s.players.find(x=>x.id===id);if(!p)return{};const E=m=>({err:m}),OK={changed:true},t=msg.type;
 // flight games (MARSBOUND · EARTHBOUND · landing): relay only, never stored
 if(t==='sat_net'){const d=msg.data;if(s.phase!=='results'||!d||typeof d.ch!=='string'||typeof d.body!=='string'||d.body.length>3000||!/^(sun|trash|land)$/.test(d.ch))return{};return{relay:{type:'peer',from:id,kind:'sat_net',data:{ch:d.ch,body:d.body}}}}
 if(t==='role_score'){if(s.phase!=='results'||msg.stage!=='mars')return{};const v=Number(msg.value);if(!Number.isFinite(v))return E('Invalid role result.');s.roleScores=s.roleScores||{};(s.roleScores.mars=s.roleScores.mars||{})[p.role]=clamp(Math.round(v),0,100);s.weightedResult=missionRating(s);return OK}
 if(t==='stage_score'){
 if(s.phase!=='results'||!['sun','mars','trash','land'].includes(msg.stage))return E('Invalid scoring stage.');
 const auth={sun:'structure',mars:'structure',trash:'structure',land:'structure'};
 if(p.role!==auth[msg.stage])return E('Only the Pilot can submit the shared stage result.');
 const d=msg.data;if(d!==null&&(!d||typeof d!=='object'||JSON.stringify(d).length>1200))return E('Invalid stage evidence.');
 if(d&&((d.arrived!==undefined&&typeof d.arrived!=='boolean')||(d.success!==undefined&&typeof d.success!=='boolean')||(d.completed!==undefined&&typeof d.completed!=='boolean')))return E('Invalid evidence values.');
 recordStage(s,msg.stage,d,now);return OK;
 }
 // crew sync for the mini-game chain: everyone waits at the same gate, a skip moves the whole crew
 if(t==='chain'||t==='chain_skip'){if(!['design','orbit','results'].includes(s.phase))return E('The crew can only sync during the mission.');const k=String(msg.stage||'').slice(0,48);if(!k)return E('Unknown stage.');
  s.chain=s.chain||{ready:{},skip:{}};if(t==='chain'){const r=s.chain.ready[k]=s.chain.ready[k]||{};r[id]=now}else if(!s.chain.skip[k])s.chain.skip[k]={by:p.role,at:now};return OK}
 if(t==='mars_state'){if(s.phase!=='results'||JSON.stringify(msg.data||null).length>700)return{};return{relay:{type:'peer',from:id,kind:'mars_state',data:msg.data}}}
 if(t==='cursor'||t==='orbit_try'){if(s.phase!=='orbit'||JSON.stringify(msg.data||null).length>400)return{};return{relay:{type:'peer',from:id,kind:t,data:msg.data}}}
 if(t==='select_role'){if(s.phase!=='lobby'||p.role)return E('Roles can only be chosen once, in the lobby.');if(!ROLES.includes(msg.role))return E('Unknown role.');if(s.players.some(x=>x.role===msg.role))return E('Another player already took this role.');p.role=msg.role;return OK}
 if(t==='start'){if(s.phase!=='lobby')return E('This room has already started.');if(s.players.length!==4||s.players.some(x=>!x.role))return E('All four players must pick a role before starting.');
  const ids=Object.keys(MISSIONS),keep={players:s.players,leaderboard:s.leaderboard,roomCode:s.roomCode};Object.assign(s,EMPTY(),keep);
  s.mission=ids.includes(msg.mission)?msg.mission:ids[Math.floor(Math.random()*ids.length)];s.phase='brief';s.phaseAt=now;s.brief={stage:'read',deadline:now+READ_MS};return OK}
 if(t==='pm_begin'){if(s.phase!=='brief'||p.role!=='pm'||s.brief.stage!=='read')return E('Keyword selection cannot start right now.');s.brief={stage:'pick',deadline:now+PICK_MS};s.phaseAt=now;s.stamp={};return OK}
 if(t==='pm_draft'||t==='pm_keywords'){const picking=(s.phase==='brief'&&s.brief.stage==='pick')||(s.phase==='design'&&s.kwDeadline);if(p.role!=='pm'||!picking)return E('Keywords cannot be picked right now.');
  const free=s.kwSlots-s.keywords.length;if(!validIds(msg.ids,free)||msg.ids.some(i=>s.keywords.includes(i)))return E('Invalid keyword selection.');s.kwDraft=msg.ids.slice();
  if(t==='pm_keywords'){if(msg.ids.length!==free)return E(`Pick ${free} keywords to confirm.`);tap(s,id,now);fillKeywords(s);creditKeywords(s);if(s.phase==='brief')toDesign(s,now)}return OK}
 if(t==='set_module'){if(s.phase!=='design')return E('This is not the design phase.');const m=MODULES[msg.key];if(!m||m.owner!==p.role)return E('Only the assigned role can change this module.');if(!opt(msg.key,msg.value))return E('Invalid module.');
  const next={...s.design,[msg.key]:msg.value};
  s.design=next;s.ready=[];s.resources=metrics(s.design,s.mission);tap(s,id,now);const ck=id+':'+msg.key;if(!s.designCredited[ck]){s.designCredited[ck]=true;s.contributions[id]=(s.contributions[id]||0)+2}
  if(msg.key==='antenna'){s.kwSlots=slotsOf(s.design);if(s.keywords.length>s.kwSlots){s.keywords.length=s.kwSlots;s.kwDeadline=null;s.kwDraft=[];creditKeywords(s)}else if(s.keywords.length<s.kwSlots){if(!s.kwDeadline)s.kwDeadline=now+PICK_MS;s.stamp[(s.players.find(x=>x.role==='pm')||{}).id]=now}else s.kwDeadline=null}
  return OK}
 if(t==='pm_warn'){if(s.phase!=='design'||p.role!=='pm')return E('Only the Mission Coordinator can send warnings during design.');if(!MODULES[msg.key])return E('Unknown module.');if(s.pmClicks<=0)return E('All warnings have been used.');
  s.pmClicks--;s.warnings[msg.key]=(s.warnings[msg.key]||0)+1;s.lastWarn={key:msg.key,seq:PM_CLICKS-s.pmClicks};return OK}
 if(t==='ready'||t==='unready'){if(s.phase!=='design')return E('This is not the design phase.');if(t==='unready')return OK;if(p.role!=='pm')return E('The Mission Coordinator confirms the design.');
  if(ORDER.some(k=>!s.design[k]))return E('Choose all 9 modules to confirm.');if(s.kwDeadline)return E('Pick the extra keyword first.');if(metrics(s.design,s.mission).overMass)return E('The mass is over the engine’s thrust limit. Choose a stronger engine or a lighter build.');
  tap(s,id,now);s.ready=[id];s.phase='orbit';s.phaseAt=now;s.stamp={};s.resources=metrics(s.design,s.mission);s.orbit={locked:null,deadline:null,helpAt:now+ORBIT_HELP_MS,vote:null,round:0,helped:false};return OK}
 if(t==='orbit_redesign'){if(s.phase!=='orbit'||!s.orbit||s.orbit.locked)return E('You cannot return to design right now.');if(p.role!=='pm')return E('The Mission Coordinator decides whether to return to design.');
  const blame=(Array.isArray(msg.blame)?msg.blame:[]).filter(r=>ROLES.includes(r)),targets=blame.length?[...new Set(blame)]:['design'];
  s.lastVote={choice:'redesign',counts:{help:0,redesign:1,continue:0},none:false,at:now,round:(s.orbit.round||0),byPm:true,blame:targets};s.redesigns++;
  for(const r of targets){const q=s.players.find(x=>x.role===r);if(q)s.contributions[q.id]=(s.contributions[q.id]||0)-REDESIGN_PENALTY}
  if(!targets.includes('pm'))s.contributions[id]=(s.contributions[id]||0)-PM_REDESIGN_PENALTY;
  tap(s,id,now);s.phase='design';s.phaseAt=now;s.stamp={};s.ready=[];s.orbit=null;return OK}
 if(t==='orbit_vote'){const v=s.orbit&&s.orbit.vote;if(s.phase!=='orbit'||!v)return E('No vote is running right now.');if(!['help','redesign','continue'].includes(msg.choice))return E('Unknown choice.');
  v.votes[id]=msg.choice;tap(s,id,now);const n=Object.values(v.votes).filter(x=>x===msg.choice).length;if(n>=3||Object.keys(v.votes).length>=s.players.length)resolveVote(s,now);return OK}
 if(t==='orbit_lock'){if(s.phase!=='orbit'||s.orbit.locked)return E('The orbit cannot be locked right now.');const o=s.resources.orbit,d=msg.data||{},num=['day','theta','dv','phi','tof','dvTcm','dvMoi','vinfArr','need','dmin'];
  if(num.some(k=>typeof d[k]!=='number'||!isFinite(d[k]))||d.day<0||d.day>182||Math.abs(d.theta)>90||d.dv>o.dvStage+.005||d.need>o.dvSc+.005||d.tof>o.tofMax+1)return E('This orbit does not meet the requirements.');
  const L={};for(const k of num)L[k]=Math.round(d[k]*1000)/1000;L.helped=!!s.orbit.helped;L.by=id;L.name=p.name;L.role=p.role;L.at=now;s.orbit={...s.orbit,locked:L,deadline:now+LOCK_MS,vote:null};tap(s,id,now);s.contributions[id]=(s.contributions[id]||0)+10;return OK}
 if(t==='event_action'&&msg.eventIndex!==s.eventIndex)return E('The event changed. Check the screen, then choose.');
 if(t==='event_action'&&msg.action==='pm_brief'){if(s.phase!=='flight'||p.role!=='pm')return E('Only the Mission Coordinator can log control notes during flight.');if(s.briefedEvents.includes(s.eventIndex))return E('The control note was already sent.');s.briefedEvents.push(s.eventIndex);s.contributions[id]=(s.contributions[id]||0)+5;return OK}
 if(t==='event_action'){if(s.phase!=='flight'||!s.event)return E('No flight event in progress.');const ev=EVENTS[s.eventIndex];if(p.role!==ev.owner)return E(`The ${({pm:'Mission Coordinator',design:'Spacecraft Engineer',structure:'Pilot',comms:'Avionics Engineer'})[ev.owner]||ev.owner} chooses for this event.`);if(s.eventResults[s.eventIndex])return E('The response is already locked in.');
  const a=ev.actions.find(x=>x.id===msg.action);if(!a)return E('That response is not available.');const m=s.resources,ok=Object.entries(a.needs).every(([k,v])=>(m[k]||0)>=v),pts=ok?a.team:Math.max(5,Math.floor(a.team*.35));
  for(const[k,d]of Object.entries(a.delta))m[k]=Math.max(0,(m[k]||0)+d);s.teamScore+=pts;s.contributions[id]=(s.contributions[id]||0)+pts;tap(s,id,now);
  s.eventResults[s.eventIndex]={event:ev.title,owner:p.name,success:ok?a.success:'Low resource margin limited the effect of the response.',points:pts,eligible:ok};s.eventIndex++;
  if(s.eventIndex>=EVENTS.length)finish(s,now);else{s.event=EVENTS[s.eventIndex];s.stamp={}}return OK}
 if(t==='return_lobby'){if(s.phase!=='results')return E('A new mission can only start from the results screen.');const keep={players:s.players,leaderboard:s.leaderboard,roomCode:s.roomCode};Object.assign(s,EMPTY(),keep);for(const x of s.players)x.role=null;return OK}
 return{}}
function finish(s,now){const m=s.resources,L=s.orbit&&s.orbit.locked,ev=s.eventResults.reduce((a,x)=>a+x.points,0),o=m.orbit||{};
 const orbitScore=L?Math.round(50+25*clamp((o.dvSc-L.need)/Math.max(.1,o.dvSc*.3),0,1)+25*clamp((o.tofMax-L.tof)/100,0,1)):0,cons=(m.overMass?0:5)+(m.powerShort?0:5);
 const pm=s.players.find(p=>p.role==='pm');if(pm)s.contributions[pm.id]=(s.contributions[pm.id]||0)+(s.kwPoints||0)*2;
 const baseScore=clamp(Math.round(ev/(EVENTS.length*30)*50)+Math.round(m.fit*.25)+Math.round(orbitScore*.15)+cons-(s.helped?HELP_PENALTY:0),0,100),budgetBonus=m.cost<=BUDGET?BUDGET_BONUS:0,teamScore=baseScore+budgetBonus,sorted=[...s.players].sort((a,b)=>(s.contributions[b.id]||0)-(s.contributions[a.id]||0));
 const avg=s.players.map(p=>({name:p.name,role:p.role,n:(s.timing[p.id]||{}).n||0,avg:(s.timing[p.id]||{}).n?Math.round(s.timing[p.id].ms/s.timing[p.id].n/100)/10:null})).filter(x=>x.n>0).sort((a,b)=>a.avg-b.avg);
 const outcome=teamScore>=70&&m.integrity>0?'success':'partial',mvp=sorted[0]?{name:sorted[0].name,points:s.contributions[sorted[0].id]||0}:null;
 s.weightedResult=missionRating(s);s.teamScore=teamScore;s.phase='results';s.event=null;
 s.result={outcome,teamScore,baseScore,budgetBonus,mvp,awards:{fastest:avg[0]||null,slowest:avg.length>1?avg[avg.length-1]:null},
  summary:outcome==='success'?`${MISSIONS[s.mission].name} mission accomplished. Keywords, design, orbit and event responses built this result together.`:'Part of the mission goal was met. Look back at how keywords shaped the design and where the budget went.',
  breakdown:[{label:'Flight event response',points:Math.round(ev/(EVENTS.length*30)*50)},{label:`Mission-fit design (fit ${m.fit})`,points:Math.round(m.fit*.25)},{label:'Orbit (fuel margin · flight time)',points:Math.round(orbitScore*.15)},{label:'Mass · power limits',points:cons},{label:`Bonus for budget ${BUDGET} or less`,points:budgetBonus}],
  debrief:[`Mission: ${MISSIONS[s.mission].name} · Control keywords: ${s.keywords.map(i=>KEYWORDS[i]).join(', ')}${s.kwAuto?` (random ${s.kwAuto}, time ran out)`:''}`,
   ...ORDER.map(k=>{const x=opt(k,s.design[k]),f=MISSIONS[s.mission].fit[k][x.id];return`${MODULES[k].label}: ${x.name} · mission fit ${f}${f>=100?' (best choice)':f<50?' (does not fit the mission)':''}`}),
   L?`Orbit: departure Δv ${L.dv} km/s, flight ${Math.round(L.tof)} days, correction ${L.dvTcm} km/s, Mars capture ${L.dvMoi} km/s · ${L.name} locked`:'No orbit recorded',
   ...s.eventResults.map(x=>`${x.event} · ${x.success}`)]};
 s.leaderboard=[{room:s.roomCode||'Team',mission:MISSIONS[s.mission].name,score:teamScore,at:now},...(s.leaderboard||[])].sort((a,b)=>b.score-a.score).slice(0,10)}
// 플레이어별로 보여 줄 상태. PM이 아닌 사람에게는 임무지 실제 전력·관제 메모·고르는 중인 키워드를 숨긴다
function view(s,id,now){const o=JSON.parse(JSON.stringify(s)),p=s.players.find(x=>x.id===id),pm=p&&p.role==='pm';o.serverTime=now;delete o.stamp;delete o.designCredited;
 if(!pm){if(o.event)o.event.clue='';o.kwDraft=[];if(['brief','design'].includes(o.phase)&&o.resources&&o.resources.chosen!=null){o.resources.gen=o.resources.genNom;o.resources.powerShort=o.resources.genNom<o.resources.use&&o.resources.genNom>0}}
 if(o.phase!=='results'&&o.resources){delete o.resources.fit}if(o.phase!=='results'&&o.handoff)delete o.handoff.fit;delete o.kwPoints;
 if(o.orbit&&o.orbit.vote){const v=o.orbit.vote;v.mine=v.votes[id]||null;v.count={help:0,redesign:0,continue:0};v.who={};for(const[k,c]of Object.entries(v.votes)){v.count[c]++;const q=s.players.find(x=>x.id===k);if(q)v.who[q.role]=c}delete v.votes}
 return o}
return{missionRating,recordStage,PROTOCOL,ORBIT_HELP_MS,VOTE_MS,HELP_PENALTY,REDESIGN_PENALTY,PM_REDESIGN_PENALTY,ROLES,BUDGET,BUDGET_BONUS,MIN_ACCEL,PM_CLICKS,KW_BASE,PICK_MS,READ_MS,LOCK_MS,MODULES,ORDER,KEYWORDS,MISSIONS,EVENTS,EMPTY,metrics,join,leave,handle,tick,alarm,view};
}
/* Cloudflare Worker + Durable Object: NaisaCore() above holds every room rule; this part only handles connections, storage, relays and alarms. */
const CORE=NaisaCore();
export default {async fetch(request,env){const url=new URL(request.url);
 if(url.pathname==='/')return new Response('NAISA team MVP worker online');
 if(url.pathname==='/status')return Response.json({game:'NAISA Team MVP',protocol:CORE.PROTOCOL,clientFlow:'design-orbit-v1',maxPlayersPerRoom:4});
 if(url.pathname!=='/ws')return new Response('Not found',{status:404});
 if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
 const room=(url.searchParams.get('room')||'').toUpperCase();if(!/^[A-Z0-9_-]{1,24}$/.test(room))return new Response('Invalid room',{status:400});
 return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(room)).fetch(request)}};
export class GameRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.state=CORE.EMPTY();this.loading=null}
 async init(){if(!this.loading)this.loading=(async()=>{const saved=await this.ctx.storage.get('game');this.state=saved&&saved.protocol===CORE.PROTOCOL?saved:CORE.EMPTY();this.state.protocol=CORE.PROTOCOL;
  this.state.leaderboard=await this.ctx.storage.get('leaderboard')||this.state.leaderboard||[];const live=new Set(this.sockets().map(ws=>this.playerId(ws)));
  for(const p of this.state.players.filter(p=>!live.has(p.id)))CORE.leave(this.state,p.id)})();await this.loading}
 sockets(){return this.ctx.getWebSockets().filter(s=>s.readyState===1)}
 playerId(ws){return ws.deserializeAttachment()?.playerId||null}
 send(ws,msg){try{ws.send(JSON.stringify(msg))}catch{}}
 async broadcast(){this.state.protocol=CORE.PROTOCOL;await this.ctx.storage.put('game',this.state);if(this.state.phase==='results')await this.ctx.storage.put('leaderboard',this.state.leaderboard||[]);
  const now=Date.now();for(const ws of this.sockets())this.send(ws,{type:'snapshot',state:CORE.view(this.state,this.playerId(ws),now)});
  const at=CORE.alarm(this.state);if(at)await this.ctx.storage.setAlarm(Math.max(at,now+50));else await this.ctx.storage.deleteAlarm()}
 async alarm(){await this.init();if(CORE.tick(this.state,Date.now()))await this.broadcast();else{const at=CORE.alarm(this.state);if(at)await this.ctx.storage.setAlarm(Math.max(at,Date.now()+50))}}
 async rejectJoin(message){const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);this.send(pair[1],{type:'error',message});pair[1].close(1008,'Join rejected');return new Response(null,{status:101,webSocket:pair[0]})}
 async fetch(request){await this.init();
  if(this.state.phase!=='lobby')return this.rejectJoin('This room has already started a mission. Enter another code, or wait until the team returns to the lobby.');
  if(this.sockets().length>=4)return this.rejectJoin('This room already has 4 players. Please enter another code.');
  const url=new URL(request.url);this.state.roomCode=(url.searchParams.get('room')||'').toUpperCase();
  const pair=new WebSocketPair(),player=CORE.join(this.state,url.searchParams.get('name'));this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({playerId:player.id});
  this.send(pair[1],{type:'welcome',protocol:CORE.PROTOCOL,playerId:player.id});await this.broadcast();return new Response(null,{status:101,webSocket:pair[0]})}
 async webSocketMessage(ws,raw){await this.init();if(typeof raw!=='string'||raw.length>4096)return this.send(ws,{type:'error',message:'The message is too large.'});
  let msg;try{msg=JSON.parse(raw)}catch{return}if(!msg||typeof msg!=='object'||Array.isArray(msg))return;const id=this.playerId(ws);if(!id)return;
  if(msg.type==='hello'){this.send(ws,{type:'welcome',protocol:CORE.PROTOCOL,playerId:id});this.send(ws,{type:'snapshot',state:CORE.view(this.state,id,Date.now())});return}
  const now=Date.now(),ticked=CORE.tick(this.state,now),r=CORE.handle(this.state,id,msg,now);
  if(r.err)this.send(ws,{type:'error',message:r.err});
  if(r.relay)for(const other of this.sockets())if(other!==ws)this.send(other,r.relay); // relayed only, never stored
  if(r.changed||ticked)await this.broadcast()}
 async webSocketClose(ws){await this.init();const r=CORE.leave(this.state,this.playerId(ws));if(!r.changed)return;
  if(r.interrupted)for(const s of this.sockets())this.send(s,{type:'notice',message:'A teammate lost connection, so the room returned to the lobby. Start again when all four are back.'});
  await this.broadcast();try{ws.close(1000,'closed')}catch{}}
 async webSocketError(ws){try{ws.close()}catch{}await this.webSocketClose(ws)}
}

