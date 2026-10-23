/* J-3912 Concept V1.2 — bancada integrada: FIC-A CAS/AUTO/MAN, somente ensino. */
(() => {
'use strict';
const el=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const sliderIds=['intInlet','intPressure','intSpL','intSpLA','intSpB','intSpFA','intBiasA','intBiasB','intManLv','intManSp','intManSpeed','intManMin'];
const configurationIds=['intModeL','intModeLA','intModeFA','intModeFB','intValveFailure','intFtLocation','intSelMode','intWhichFt','intQualA','intQualB'];
const known={pbA:60,tiA:15,pbB:300,tiB:20};
let model, clock=null;
const get=()=>Object.fromEntries([...sliderIds,...configurationIds].map(id=>[id,el(id)?.type==='range'?Number(el(id).value):el(id)?.value]));
const pushLog=s=>{if(!model)return;model.log.unshift({t:model.t,txt:s});model.log=model.log.slice(0,12)};
const scenarios={
 base:{intInlet:115,intPressure:20,intSpL:55,intSpLA:55,intSpB:75,intModeL:'auto',intModeLA:'auto',intModeFA:'cascade',intSpFA:115,intModeFB:'auto',intValveFailure:'normal',intFtLocation:'total',intSelMode:'auto',intWhichFt:'a',intQualA:'good',intQualB:'good',intBiasA:0,intBiasB:0},
 high:{intInlet:175}, low:{intInlet:40,intSpB:105},different:{intInlet:115,intSpL:49,intSpLA:64},restriction:{intPressure:85,intInlet:115},
 ftbad:{intQualA:'bad',intQualB:'good'},ftmanual:{intSelMode:'manual',intWhichFt:'a',intQualA:'bad',intQualB:'good'},
 valve:{intInlet:36,intSpB:120,intValveFailure:'closed'}
};
function computeHydraulic(){
 const p=get(),speed=model.speed,lv=model.lv,fv=model.fv;
 const hShut=366*Math.pow(speed/100,2);
 const hStatic=56+0.52*p.intPressure;
 const qDelivery=h=>12.5*(lv/100)*Math.sqrt(Math.max(0,h-hStatic));
 const qReturn=h=>5.7*(fv/100)*Math.sqrt(Math.max(0,h-38));
 let low=0,high=hShut;
 for(let i=0;i<33;i++){
  const middle=(low+high)/2;
  const qt=qDelivery(middle)+qReturn(middle);
  const estimatedHead=hShut-.0032*qt*qt;
  if(estimatedHead>middle)low=middle;else high=middle;
 }
 const h=(low+high)/2;
 return {qOut:qDelivery(h),qReturn:qReturn(h),head:h};
}
function resetModel(){
 model={t:0,running:true,level:55,lv:69,lvCmd:69,speed:88,speedCmd:88,fv:0,fvCmd:0,
  spFlow:115,activeSpA:115,ficAMode:get().intModeFA,qOut:0,qRec:0,head:0,pv:0,ftA:0,ftB:0,chosen:'',quality:'GOOD',
  licPrev:0,licaPrev:0,ficPrev:0,ficBPrev:0,history:[],log:[],lastRisk:'',lastSelection:'',lastBad:'',lastMode:''};
 const h=computeHydraulic();model.qOut=h.qOut;model.qRec=h.qReturn;model.head=h.head;
 model.spFlow=h.qOut+h.qReturn;
 model.activeSpA=get().intModeFA==='auto'?get().intSpFA:model.spFlow;
 model.pv=model.spFlow;model.ftA=model.pv;model.ftB=model.pv;
 pushLog('Modelo reiniciado: LICs AUTO, FIC-A '+(get().intModeFA==='cascade'?'CAS':'modo '+get().intModeFA.toUpperCase())+' e FIC-B AUTO quando selecionado.');
 render();
}
// Controladores incrementais PI com anti-windup simplificado: engenharia demonstrativa.
function piMove(oldVal,error,oldError,dt,kp,ti,min,max){
 const proportional=kp*(error-oldError);
 const integral=kp*(error/ti)*dt;
 const desired=oldVal+proportional+integral;
 if(desired>max && integral>0)return clamp(oldVal+proportional,min,max);
 if(desired<min && integral<0)return clamp(oldVal+proportional,min,max);
 return clamp(desired,min,max);
}
function update(dt){
 const p=get();
 const qMeasured=p.intFtLocation==='total'?model.qOut+model.qRec:model.qOut;
 model.ftA=Math.max(0,qMeasured*(1+p.intBiasA/100));
 model.ftB=Math.max(0,qMeasured*(1+p.intBiasB/100));
 let select;
 if(p.intSelMode==='manual')select=p.intWhichFt;
 else if(p.intQualA==='good')select='a';
 else if(p.intQualB==='good')select='b';
 else select='none';
 const good=select==='a'?p.intQualA==='good':select==='b'?p.intQualB==='good':false;
 if(select!==model.chosen || (good?'GOOD':'BAD')!==model.quality){
  if(model.t>0)pushLog(`SS-DUAL ${p.intSelMode.toUpperCase()}: ${select==='none'?'sem FT válido':`FT-${select.toUpperCase()} ${good?'GOOD':'BAD'}`}.`);
  model.chosen=select;model.quality=good?'GOOD':'BAD';
 }
 if(good){const target=select==='a'?model.ftA:model.ftB;model.pv+=(target-model.pv)*(1-Math.exp(-dt/1.0));}
 // LIC-39152 → LV-39152: a mesma medição LT que alimenta LIC-39152A.
 const levelError=model.level-p.intSpL;
 if(p.intModeL==='manual')model.lvCmd=p.intManLv;
 else model.lvCmd=piMove(model.lvCmd,levelError,model.licPrev,dt,2.0,58,6,100);
 model.licPrev=levelError;
 // LIC-39152A → SP do FIC-39164A: cascata.
 const levelErrorA=model.level-p.intSpLA;
 if(p.intModeLA==='manual')model.spFlow=p.intManSp;
 else model.spFlow=piMove(model.spFlow,levelErrorA,model.licaPrev,dt,4.4,90,20,235);
 model.licaPrev=levelErrorA;
 // CAS: SP remoto pelo LIC-39152A. AUTO: SP local. MAN: rotação comandada.
 if(p.intModeFA==='cascade')model.activeSpA=model.spFlow;
 else if(p.intModeFA==='auto')model.activeSpA=p.intSpFA;
 const ea=(model.activeSpA-model.pv)/280; const eb=(p.intSpB-model.pv)/280;
 // As duas malhas dependem do SS-DUAL GOOD; com BAD, congelamento é hipótese didática.
 if(p.intModeFA==='manual')model.speedCmd=p.intManSpeed;
 else if(good)model.speedCmd=piMove(model.speedCmd,ea,model.ficPrev,dt,10000/known.pbA,known.tiA,45,115);
 if(p.intModeFB==='manual')model.fvCmd=p.intManMin;
 else if(good)model.fvCmd=piMove(model.fvCmd,eb,model.ficBPrev,dt,10000/known.pbB,known.tiB,0,100);
 model.ficPrev=ea;model.ficBPrev=eb;
 const actualFV=p.intValveFailure==='closed'?0:p.intValveFailure==='open'?100:model.fvCmd;
 model.speed+=clamp(model.speedCmd-model.speed,-2.5*dt,2.5*dt);
 model.lv+=clamp(model.lvCmd-model.lv,-6*dt,6*dt);
 model.fv+=clamp(actualFV-model.fv,-5*dt,5*dt);
 const hydraulic=computeHydraulic();
 const w=1-Math.exp(-dt/1.5);
 model.qOut+=(hydraulic.qOut-model.qOut)*w;
 model.qRec+=(hydraulic.qReturn-model.qRec)*w;
 model.head=hydraulic.head;
 // Retorno do reciclo ao mesmo inventário é hipótese didática: somente saída líquida muda nível.
 model.level=clamp(model.level+(p.intInlet-model.qOut)*dt/3600/.14,0,100);
 model.t+=dt;
 if(model.t-(model.history.at(-1)?.t??-100)>=.9){
 model.history.push({t:model.t,level:model.level,spL:p.intSpL,spLA:p.intSpLA,spFlow:model.spFlow,spFicA:model.activeSpA,pv:model.pv,qOut:model.qOut,qRec:model.qRec,lv:model.lv,speed:model.speed,fv:model.fv});
 if(model.history.length>660)model.history.shift();
 }
 const limit=p.intSpB;
 const risk=(model.qOut+model.qRec)<limit-5?'below':(model.qOut+model.qRec)<limit+5?'close':'ok';
 if(risk!==model.lastRisk){if(model.t>8)pushLog(risk==='below'?'Vazão pelo rotor abaixo da referência de mínimo (didática).':risk==='close'?'Aproximação do limiar de vazão mínima.':'Vazão estimada acima da referência de mínimo.');model.lastRisk=risk;}
}
function plot(id,series,lo,hi){
 const canvas=el(id);if(!canvas||canvas.getBoundingClientRect().width<20)return;
 const width=canvas.clientWidth,height=canvas.clientHeight;const ratio=Math.min(2,window.devicePixelRatio||1);
 if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
 const pad={l:40,r:10,t:13,b:22},W=width-pad.l-pad.r,H=height-pad.t-pad.b;
 ctx.font='10px system-ui';
 for(let i=0;i<=4;i++){
   const yy=pad.t+H*(i/4);ctx.strokeStyle='#2a4d63';ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(width-pad.r,yy);ctx.stroke();ctx.fillStyle='#94b8c9';ctx.fillText(fmt(hi-(hi-lo)*i/4,0),3,yy+3);
 }
 const last=Math.max(110,model.t+5),first=Math.max(0,last-210);
 for(const [key,color] of series){
  ctx.strokeStyle=color;ctx.lineWidth=2.0;ctx.beginPath();let started=false;
  for(const row of model.history){if(row.t<first)continue;const x=pad.l+(row.t-first)/(last-first)*W,y=pad.t+H*(1-clamp((row[key]-lo)/(hi-lo),0,1));if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);}
  ctx.stroke();
 }
 ctx.fillStyle='#94b8c9';ctx.fillText(`t ${fmt(first,0)}—${fmt(last,0)} s`,pad.l+7,height-5);
}
function render(){
 if(!model)return;const p=get();
 for(const [id,unit] of [['intInlet','m³/h'],['intPressure','%'],['intSpL','%'],['intSpLA','%'],['intSpB','m³/h'],['intSpFA','m³/h'],['intBiasA','%'],['intBiasB','%'],['intManLv','%'],['intManSp','m³/h'],['intManSpeed','%'],['intManMin','%']]){
  const target=el(id+'Out');if(target)target.textContent=fmt(p[id],0)+' '+unit;
 }
 for(const [id,show] of [['intManLvGroup',p.intModeL==='manual'],['intManSpGroup',p.intModeLA==='manual'],['intManSpeedGroup',p.intModeFA==='manual'],['intSpFAGroup',p.intModeFA==='auto'],['intManMinGroup',p.intModeFB==='manual'],['intWhichBox',p.intSelMode==='manual']])el(id).hidden=!show;
 const qTotal=model.qOut+model.qRec;
 const sets={intLevelRead:fmt(model.level,1)+'%',intLvRead:fmt(model.lv,1)+'%',intSpFlowRead:p.intModeFA==='manual'?'— · MAN':fmt(model.activeSpA,1)+' m³/h',intSpFlowSource:p.intModeFA==='cascade'?'CAS · saída do LIC-39152A':p.intModeFA==='auto'?'AUTO · SP local do FIC-A':'MAN · controle de rotação manual',intRpmRead:fmt(model.speed,1)+'%',intQoutRead:fmt(model.qOut,1)+' m³/h',intQrRead:fmt(model.qRec,1)+' m³/h',intVesselNum:fmt(model.level,1)+'%',intCtlLv:fmt(model.lvCmd,1)+'%',intCtlSp:fmt(model.spFlow,1)+' m³/h',intLvTag:'ABERT. '+fmt(model.lv,0)+'%',intPumpTag:'ROTAÇÃO '+fmt(model.speed,0)+'%',intOutTag:'Q SAÍDA '+fmt(model.qOut,0),intFtValues:`A ${fmt(model.ftA,1)} · B ${fmt(model.ftB,1)}`,intSelectedFt:model.chosen==='none'?'AMBOS BAD':`FT-${model.chosen.toUpperCase()} · ${model.quality}`,intFicAValue:'MV '+fmt(model.speedCmd,1)+'%',intFicAMode:p.intModeFA==='cascade'?'CAS':p.intModeFA.toUpperCase(),intFicBValue:'MV '+fmt(model.fvCmd,1)+'%',intPumpQ:fmt(qTotal,1),intProcessQ:fmt(model.qOut,1),intRecycleQ:fmt(model.qRec,1),intFTaBadge:p.intQualA.toUpperCase(),intFTbBadge:p.intQualB.toUpperCase(),intPvBadge:fmt(model.pv,1)+' '+model.quality,intRunBadge:model.running?'● SIMULANDO · LT E SS-DUAL':'● PAUSADO'};
 for(const [id,val] of Object.entries(sets)){const e=el(id);if(e)e.textContent=val;}
 el('intLicMode').textContent=p.intModeL.toUpperCase();el('intLicAMode').textContent=p.intModeLA.toUpperCase();el('intCascadeLink').textContent=p.intModeFA==='cascade'?'SP remoto → FIC-39164A':'SP calculado · fora do FIC-A';
 el('intLiquid').style.height=clamp(model.level,0,100)+'%';el('intFTaBadge').classList.toggle('bad',p.intQualA==='bad');el('intFTbBadge').classList.toggle('bad',p.intQualB==='bad');el('intPvBadge').classList.toggle('bad',model.quality==='BAD');
 const tooLow=qTotal<p.intSpB-5;
 const msg=[];
 const lerr=model.level-p.intSpL,laerr=model.level-p.intSpLA;
 if(lerr>1)msg.push('LIC-39152 identifica nível acima do seu SP → tendência de <b>abrir LV</b>.');else if(lerr<-1)msg.push('LIC-39152 identifica nível abaixo do SP → tendência de <b>fechar LV</b>.');else msg.push('LIC-39152: nível próximo de sua referência.');
 if(p.intModeFA==='cascade'){if(laerr>1)msg.push('CAS: LIC-39152A tende a <b>elevar o SP ativo do FIC-A</b>.');else if(laerr<-1)msg.push('CAS: LIC-39152A tende a <b>reduzir o SP ativo do FIC-A</b>.');}
 else if(p.intModeFA==='auto')msg.push('AUTO FIC-A: vazão regulada pelo <b>SP local</b>; o SP calculado pelo LIC-39152A fica desacoplado.');
 else msg.push('MAN FIC-A: rotação ajustada diretamente; PID de vazão não corrige a MV.');
 if(tooLow)msg.push('<strong>Baixa vazão total no modelo:</strong> FIC-B procura abrir FV, salvo falha ou modo MAN.');
 if(model.level<22||model.level>83)msg.push('<strong>Atenção:</strong> nível fora da faixa de estudo; não representa alarme real da E-3901.');
 if(Math.abs(p.intSpL-p.intSpLA)>3)msg.push('SPs dos LICs são distintos; <b>duas malhas integrais podem solicitar correções diferentes</b>.');
 if(model.quality==='BAD')msg.push('<strong>PV BAD:</strong> modelo mantém MVs dos FICs em AUTO; comportamento real do SDCD exige verificação.');
 if(p.intValveFailure!=='normal')msg.push('Falha simulada: FV '+(p.intValveFailure==='closed'?'travada fechada':'travada aberta')+'. MV do FIC-B não é posição real.');
 if(p.intFtLocation==='process')msg.push('FT simulado após derivação: PV acompanha saída líquida, não a vazão total pelo rotor.');
 if(p.intSelMode==='auto' && p.intQualA==='good' && p.intQualB==='good')msg.push('SS-DUAL com dois sinais GOOD: prioridade A é hipótese didática, não lógica confirmada.');
 el('intDiagnosis').innerHTML=msg.slice(0,6).map(txt=>'<p>• '+txt+'</p>').join('');
 el('intEvents').innerHTML=model.log.map(x=>`<div class="int-event"><time>t+${fmt(x.t,0)}s</time>${x.txt}</div>`).join('');
 el('intPumpIcon').style.animationDuration=clamp(2.4*85/Math.max(model.speed,5),.75,6)+'s';
 el('intPumpIcon').style.animationPlayState=model.running?'running':'paused';
 const flowline=el('intProcess').querySelector('.int-flow-line');flowline.style.animationDuration=clamp(180/Math.max(model.qOut,5),.5,12)+'s';flowline.style.animationPlayState=model.running?'running':'paused';
 el('intPause').textContent=model.running?'❚❚ Pausar':'▶ Continuar';
 if(el('integrado').classList.contains('active')){
  plot('intLevelChart',[['level','#5abcf5'],['spL','#eab260'],['spLA','#64d4ad']],0,100);
  plot('intFlowChart',[['pv','#5abcf5'],['qOut','#66d6b2'],['qRec','#eab260'],['spFicA','#d39eff']],0,240);
  plot('intMvChart',[['lv','#5abcf5'],['speed','#66d6b2'],['fv','#eab260']],0,120);
 }
}
const explanations={
 intLic:['LIC-39152 · válvula de nível','Recebe a PV do LT-39152 e, em AUTO, atua sobre a LV-39152. Na hipótese de LV na descarga, abrir a válvula reduz a resistência hidráulica e tende a aumentar a vazão de retirada do mesmo circuito. Sua sintonia real e seu SP não foram fornecidos.'],
 intCascade:['LIC-39152A · cascata de nível','Recebe o mesmo LT-39152 e permanece em AUTO na condição operacional confirmada. Sua saída é a referência do FIC-39164A, que regula a vazão ajustando a rotação das bombas J-3912A/B. É uma cascata de nível → vazão.'],
 intLv:['LV-39152 · mesmo caminho hidráulico','A LV-39152 é a válvula que controla o nível de borra do fundo da E-3901. Ela e a rotação alteram a MESMA vazão de retirada; não existem duas saídas independentes. Posição exata, característica e limites devem ser conferidos.'],
 intPump:['J-3912A/B · variação de velocidade','A rotação desloca a curva da bomba. O ponto de operação depende conjuntamente da altura fornecida, restrição da LV e demais perdas de carga. Maior rotação não significa automaticamente vazão proporcional, pois a curva do sistema também importa.'],
 intStorage:['Armazenagem · único circuito de borra','Toda a retirada de borra considerada aqui segue o mesmo circuito em direção à armazenagem. Q saída representa a retirada líquida do inventário; se o reciclo retornar ao mesmo volume, não é outra saída líquida independente.'],
 intFt:['FT-39164A / FT-39164B · redundância','São DUAS medições de vazão fornecidas ao SS-DUAL. Ambas podem estar GOOD, uma pode ficar BAD e a seleção poderá transferir em AUTO. Um erro analógico ainda classificado GOOD pode escapar dos diagnósticos. A posição do FT no circuito real não foi confirmada.'],
 intSelector:['FS-39164A · SS-DUAL','No modo AUTO seleciona sinal em condições de qualidade; quando o FT ativo passa a BAD, outro FT GOOD assume, conforme sua descrição operacional. No MAN, o operador determina o canal. A prioridade com os dois sinais GOOD é apenas um padrão de simulação.'],
 intFic:['FIC-39164A · PB 60, I 15 · CAS / AUTO / MAN','Recebe PV do SS-DUAL. Em CAS, SP remoto vem do LIC-39152A. Em AUTO, o operador define o SP local de vazão e a saída do LIC-A não governa a referência do FIC. Em MAN, o operador comanda a rotação, sem ação do PID. A simulação rastreia o SP nas trocas CAS/AUTO para reduzir degraus didaticamente; não reproduz o algoritmo do CENTUM. PI: Kp=100/60≈1,667 e integral 15 provisoriamente em segundos.'],
 intMin:['FIC-39164B · PB 300, I 20','Recebe PV selecionada do SS-DUAL e comanda FV-39164. Em vazão baixa, o controlador procura aumentar circulação pela bomba abrindo o retorno, caso o FT meça essa vazão. A simulação usa Kp=100/300=0,333 e integral 20 assumido provisoriamente em segundos.']
};
function showExplain(id){const v=explanations[id];if(!v)return;el('intInfoTitle').textContent=v[0];el('intInfoText').textContent=v[1];el('intInfoModal').showModal();}
function setScenario(name){const vals={...scenarios.base,...scenarios[name]};for(const [id,value] of Object.entries(vals))if(el(id))el(id).value=value;
 resetModel();pushLog('Ensaio aplicado: '+({base:'Condição inicial',high:'Aumento de alimentação',low:'Redução de entrada',different:'SPs de nível diferentes',restriction:'Resistência de descarga',ftbad:'FT-A BAD: seleção de FT-B',ftmanual:'MAN do SS-DUAL com canal BAD',valve:'FV travada fechada'}[name]||name));render();}
function applyFicAModeTransition(nextMode,oldMode){
 if(!model || nextMode===oldMode)return;
 if(nextMode==='auto'){
  // Ao entrar em AUTO, partida no SP atualmente usado (CAS) ou na PV (MAN).
  const target=oldMode==='manual'?model.pv:model.activeSpA;
  el('intSpFA').value=clamp(Math.round(target),25,220);
 }
 if(nextMode==='cascade'){
  // Rastreamento didático do SP remoto para limitar degrau na transferência.
  model.spFlow=clamp(model.activeSpA,20,235);
  model.licaPrev=model.level-Number(el('intSpLA').value);
 }
 if(oldMode==='manual' && nextMode!=='manual')model.speedCmd=model.speed;
 const target=nextMode==='cascade'?model.spFlow:nextMode==='auto'?Number(el('intSpFA').value):model.activeSpA;
 model.activeSpA=target;
 model.ficPrev=(target-model.pv)/280;
 pushLog(`FIC-39164A: ${oldMode.toUpperCase()} → ${nextMode.toUpperCase()}. ${nextMode==='cascade'?'SP remoto do LIC-39152A':nextMode==='auto'?'SP local de vazão':'rotação manual'}.`);
}
function initialize(){if(!el('integrado'))return;
 for(const id of [...sliderIds,...configurationIds])el(id)?.addEventListener(id.startsWith('intBias')||el(id).type==='range'?'input':'change',()=>{
  if(id==='intModeFA'){applyFicAModeTransition(el('intModeFA').value,model.ficAMode);model.ficAMode=el('intModeFA').value;}
  else if(id==='intSpFA' && model && el('intModeFA').value==='auto')model.activeSpA=Number(el('intSpFA').value);
  else if(model && configurationIds.includes(id))pushLog('Alteração: '+id.replace('int','')+' → '+el(id).value);
  render();
 });
 document.querySelectorAll('[data-int-preset]').forEach(button=>button.addEventListener('click',()=>{setScenario(button.dataset.intPreset);if(!el('integrado').classList.contains('active')&&typeof changeView==='function')changeView('integrado');}));
 const dialog=document.createElement('dialog');dialog.id='intInfoModal';dialog.className='int-dialog';dialog.innerHTML='<div><h2 id="intInfoTitle"></h2><p id="intInfoText"></p><button id="intInfoClose" class="primary">Fechar</button></div>';document.body.appendChild(dialog);
 el('intInfoClose').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 document.querySelectorAll('#integrado [data-explain]').forEach(e=>{e.setAttribute('tabindex','0');e.setAttribute('role','button');e.setAttribute('aria-label','Entenda melhor: '+e.textContent.trim());e.addEventListener('click',()=>showExplain(e.dataset.explain));e.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();showExplain(e.dataset.explain);}})});
 el('intPause').addEventListener('click',()=>{model.running=!model.running;render()});
 el('intStep').addEventListener('click',()=>{for(let i=0;i<75;i++)update(.2);render();pushLog('Avanço manual de 15 s simulado.');render()});
 el('intReset').addEventListener('click',resetModel);
 el('intTempo').addEventListener('change',render);
 resetModel();
 let last=performance.now();
 function frame(now){
  // Simulação somente quando a página da bancada está visível.
  const active=el('integrado').classList.contains('active') && !document.hidden;
  if(active && model.running){
   const delta=Math.min(.32,(now-last)/1000);let remaining=delta*Number(el('intTempo').value);
   while(remaining>.000001){const step=Math.min(.23,remaining);update(step);remaining-=step;}
   render();
  } else if(active){render();}
  last=now;clock=requestAnimationFrame(frame);
 }
 clock=requestAnimationFrame(frame);
 window.addEventListener('resize',()=>{if(el('integrado')?.classList.contains('active'))render()});
}
document.addEventListener('DOMContentLoaded',initialize);
})();
