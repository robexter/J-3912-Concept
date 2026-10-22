/* J-3912 Concept — modelo didático sem parâmetros de planta */
'use strict';
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const fmt=(x,n=1)=>Number(x).toLocaleString('pt-BR',{minimumFractionDigits:n,maximumFractionDigits:n});
const controls=['demand','restriction','suction','spa','spb','manualA','manualB'];
const presets={
 nominal:{demand:150,restriction:0,suction:85,spa:145,spb:80,modeA:'auto',modeB:'auto',manualA:88,manualB:30,valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 demanddrop:{demand:55,restriction:0,suction:85,spa:100,spb:80,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 lowflow:{demand:38,restriction:65,suction:85,spa:150,spb:80,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 valveclosed:{demand:35,restriction:55,suction:85,spa:125,spb:80,modeA:'auto',modeB:'auto',valveFault:'closed',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 valveopen:{demand:120,restriction:0,suction:85,spa:145,spb:80,modeA:'auto',modeB:'auto',valveFault:'open',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 setpoint:{demand:115,restriction:0,suction:85,spa:55,spb:95,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'independent'},
 aftertee:{demand:48,restriction:25,suction:85,spa:100,spb:80,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'normal',ftLocation:'process',strategy:'independent'},
 frozen:{demand:55,restriction:25,suction:85,spa:130,spb:80,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'frozen',ftLocation:'total',strategy:'priority'},
 suctionlow:{demand:115,restriction:0,suction:13,spa:145,spb:80,modeA:'auto',modeB:'auto',valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'priority'},
 manual:{demand:35,restriction:45,suction:85,spa:145,spb:80,modeA:'manual',modeB:'manual',manualA:58,manualB:0,valveFault:'normal',ftFault:'normal',ftLocation:'total',strategy:'priority'}
};
const state={running:true,t:0,speed:88,speedCmd:88,valve:0,valveCmd:0,qa:0,qr:0,pv:0,ftHeld:0,tempExcess:0,head:0,prevEA:0,prevEB:0,events:[],hist:[],lastState:'',lastActionA:'',lastActionB:'',lastTime:0,ftFreezeInitialized:false};
const read=()=>({demand:+$('demand').value,restriction:+$('restriction').value,suction:+$('suction').value,spa:+$('spa').value,spb:+$('spb').value,manualA:+$('manualA').value,manualB:+$('manualB').value,modeA:$('modeA').value,modeB:$('modeB').value,valveFault:$('valveFault').value,ftFault:$('ftFault').value,ftLocation:$('ftLocation').value,strategy:$('strategy').value});
function hydraulics(p){
  const factor=(.72+.28*p.suction/100);
  const H0=400*Math.pow(state.speed/100,2)*factor;
  const KP=(220/Math.pow(p.demand,2))*(1+p.restriction/25);
  const qrAt=h=>4.65*(state.valve/100)*Math.sqrt(Math.max(0,h-35));
  const qpAt=h=>Math.sqrt(Math.max(0,(h-70)/KP));
  let lo=0,hi=H0;
  for(let i=0;i<29;i++){
    const mid=(lo+hi)/2;
    const q=qrAt(mid)+qpAt(mid);
    if(H0-.007*q*q>mid)lo=mid;else hi=mid;
  }
  const h=(lo+hi)/2;
  return {head:h,qa:qpAt(h),qr:qrAt(h)};
}
function logEvent(message){state.events.unshift({time:state.t,message});state.events=state.events.slice(0,24);renderEvents()}
function renderEvents(){if(!$('eventlog'))return;$('eventlog').innerHTML=state.events.length?state.events.map(x=>`<div class="logrow"><span class="logtime">t+${fmt(x.time,0)}s</span>${escapeHTML(x.message)}</div>`).join(''):'<div class="logrow">Nenhum evento registrado.</div>'}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function takeReading(p){const raw=p.ftLocation==='total'?state.qa+state.qr:state.qa;if(p.ftFault==='frozen'){if(!state.ftFreezeInitialized){state.ftHeld=state.pv;state.ftFreezeInitialized=true}return state.ftHeld;}state.ftFreezeInitialized=false;return raw;}
function tick(dt){
 const p=read();const pv=state.pv;
 const spEffective=p.strategy==='priority'?Math.max(p.spa,p.spb+4):p.spa;
 if(p.modeA==='manual'){state.speedCmd=p.manualA;state.prevEA=spEffective-pv}
 else {
  const error=spEffective-pv;
  const d=error-state.prevEA;
  const want=state.speedCmd+0.19*d+.030*error*dt;
  if((want>=43&&want<=115)||(want<43&&error>0)||(want>115&&error<0))state.speedCmd=clamp(want,43,115);
  else state.speedCmd=clamp(want,43,115);
  state.prevEA=error;
 }
 if(p.modeB==='manual'){state.valveCmd=p.manualB;state.prevEB=p.spb-pv}
 else {
  const error=p.spb-pv;
  let want=state.valveCmd+1.06*(error-state.prevEB)+.12*error*dt;
  state.valveCmd=clamp(want,0,100);
  state.prevEB=error;
 }
 state.speed+=clamp(state.speedCmd-state.speed,-2.8*dt,2.8*dt);
 const commandedValve=p.valveFault==='closed'?0:p.valveFault==='open'?100:state.valveCmd;
 state.valve+=clamp(commandedValve-state.valve,-10*dt,10*dt);
 const h=hydraulics(p);
 const relax=1-Math.exp(-dt/1.9);
 state.qa+=(h.qa-state.qa)*relax;state.qr+=(h.qr-state.qr)*relax;state.head=h.head;
 const pvRaw=takeReading(p);
 state.pv+=(pvRaw-state.pv)*(1-Math.exp(-dt/.85));
 if(p.ftFault==='frozen')state.pv=state.ftHeld;
 const q=state.qa+state.qr;
 const hypotheticalDelta=clamp(150/(q+8)*(state.speed/100)**2-.55,0,17);
 state.tempExcess+=(hypotheticalDelta-state.tempExcess)*(1-Math.exp(-dt/8));
 state.t+=dt;
 if(state.t-state.lastTime>=.68){state.lastTime=state.t;state.hist.push({t:state.t,pv:state.pv,spa:p.spa,spb:p.spb,total:q,speed:state.speed,valve:state.valve});if(state.hist.length>220)state.hist.shift()}
 detectChanges(p);
}
function detectChanges(p){
 const q=state.qa+state.qr;const safety=q<p.spb-5?'Baixa vazão abaixo do SP-B':q<p.spb+4?'Próximo ao limiar de mínimo':'Vazão acima do mínimo';
 if(safety!==state.lastState){if(state.t>3)logEvent(safety);state.lastState=safety}
}
function resetPlant(){
 Object.assign(state,{running:true,t:0,speed:88,speedCmd:88,valve:0,valveCmd:0,qa:0,qr:0,pv:0,ftHeld:0,tempExcess:0,head:0,prevEA:0,prevEB:0,events:[],hist:[],lastState:'',lastTime:0,ftFreezeInitialized:false});
 const h=hydraulics(read());state.qa=h.qa;state.qr=h.qr;state.pv=read().ftLocation==='total'?h.qa+h.qr:h.qa;state.head=h.head;state.prevEA=read().spa-state.pv;state.prevEB=read().spb-state.pv;
 logEvent('Simulação reiniciada; parâmetros demonstrativos.');render();$('toggleRun').textContent='❚❚ Pausar';updateRunBadge();
}
function setPreset(name,reset=true){if(!presets[name])return;for(const [k,v] of Object.entries(presets[name])){if($(k))$(k).value=v}refreshControls();if(reset)resetPlant();if(name==='frozen'){state.ftHeld=140;state.pv=140;state.ftFreezeInitialized=true;}logEvent('Condição aplicada: '+({nominal:'operação estável',demanddrop:'redução de demanda',lowflow:'restrição severa',valveclosed:'falha fechada da válvula de mínimo',valveopen:'falha aberta da válvula',setpoint:'setpoints conflitantes',aftertee:'FT medindo somente envio ao processo',frozen:'FT com sinal congelado',suctionlow:'sucção degradada',manual:'controles em manual'}[name]||name));}
function refreshControls(){for(const id of controls){const el=$(id),out=$(id+'Out');if(!el||!out)continue;out.textContent=fmt(el.value,0)+(id==='spa'||id==='spb'||id==='demand'?' m³/h':'%')}
 $('manualAGroup').classList.toggle('hidden',$('modeA').value!=='manual');$('manualBGroup').classList.toggle('hidden',$('modeB').value!=='manual');
}
function updateRunBadge(){$('runStatus').innerHTML=`<i class="status-dot" style="background:${state.running?'#57c98d':'#f5ae60'}"></i><span>${state.running?'SIMULAÇÃO EM EXECUÇÃO':'SIMULAÇÃO PAUSADA'}</span>`;document.querySelectorAll('.moving').forEach(x=>x.classList.toggle('paused',!state.running))}
function trendDraw(id,series,min,max){const canvas=$(id);if(!canvas||!canvas.offsetWidth)return;const ratio=Math.min(2,window.devicePixelRatio||1),width=canvas.clientWidth,height=canvas.clientHeight;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const c=canvas.getContext('2d');c.scale(ratio,ratio);c.clearRect(0,0,width,height);const L=45,R=13,T=13,B=24;const w=width-L-R,h=height-T-B;
 c.font='11px Segoe UI,Arial';c.lineWidth=1;
 for(let i=0;i<5;i++){let y=T+i*h/4;c.strokeStyle='#29455b';c.beginPath();c.moveTo(L,y);c.lineTo(width-R,y);c.stroke();c.fillStyle='#8ca9b9';c.fillText(fmt(max-i*(max-min)/4,0),3,y+4)}
 const his=state.hist;const tmin=Math.max(0,state.t-125),tmax=tmin+Math.max(45,Math.min(125,state.t+5-tmin));
 for(let i=0;i<5;i++){let x=L+i*w/4;c.fillStyle='#8ca9b9';c.fillText(fmt(tmin+i*(tmax-tmin)/4,0)+'s',x-6,height-5)}
 for(const [key,color] of series){if(his.length<2)continue;c.beginPath();let started=false;for(const p of his){if(p.t<tmin-1)continue;const x=L+w*(p.t-tmin)/(tmax-tmin),y=T+h*(1-clamp((p[key]-min)/(max-min),0,1));if(!started){c.moveTo(x,y);started=true}else c.lineTo(x,y)}c.strokeStyle=color;c.lineWidth=2.2;c.stroke()}
}
function render(){const p=read(),q=state.qa+state.qr,low=q<p.spb-5,near=q<p.spb+4,ftDistortion=p.ftLocation==='process',crossed=p.spa<p.spb,fault=p.valveFault!=='normal',stale=p.ftFault==='frozen';
 for(const [id,n] of [['mPv',state.pv],['mTotal',q],['mProcess',state.qa],['mRecirc',state.qr],['mSpeed',state.speed],['mValve',state.valve]])$(id).textContent=fmt(n,1);
 $('cpvA').textContent=fmt(state.pv);$('cpvB').textContent=fmt(state.pv);$('cspA').textContent=fmt(p.spa,0);$('cspB').textContent=fmt(p.spb,0);$('cmvA').textContent=fmt(state.speedCmd,1)+'%';$('cmvB').textContent=fmt(state.valveCmd,1)+'%';$('barA').style.width=clamp(state.speedCmd/115*100,0,100)+'%';$('barB').style.width=state.valveCmd+'%';$('statusA').textContent=p.modeA.toUpperCase();$('statusB').textContent=p.modeB.toUpperCase();
 const ea=(p.strategy==='priority'?Math.max(p.spa,p.spb+4):p.spa)-state.pv,eb=p.spb-state.pv;
 $('actionA').textContent=p.modeA==='manual'?'MAN: saída mantida conforme comando de rotação.':ea>5?'PV abaixo da referência → solicitação de aceleração.':ea<-5?'PV acima da referência → solicitação de desaceleração.':'Erro próximo de zero → ajuste fino de rotação.';
 $('actionB').textContent=p.modeB==='manual'?'MAN: saída da válvula mantida no valor do operador.':eb>4?'PV inferior ao SP-B → solicitação de abertura.':eb<-4?'PV superior ao SP-B → tendência de fechamento.':'Próximo do SP-B → modulação de mínimo.';
 const label=$('protectionLabel');label.textContent=low?'BAIXA VAZÃO':near?'PRÓXIMO DO MÍNIMO':'ACIMA DO MÍNIMO';label.className='status '+(low?'danger':near?'warn':'');
 const alerts=[];
 if(low)alerts.push('Vazão estimada através do rotor <b>abaixo do limiar didático SP-B</b>; risco hidráulico crescente se a condição persistir.');else if(near)alerts.push('Vazão próxima da referência de mínimo. Avalie tendência, resposta do reciclo e margem disponível.');else alerts.push('Vazão total simulada acima do SP-B: condição compatível com a referência didática de mínimo.');
 if(p.strategy==='priority'&&crossed)alerts.push('O SP-A é inferior ao SP-B. Na opção de prioridade, a referência efetiva de velocidade é elevada para '+fmt(Math.max(p.spa,p.spb+4),0)+' m³/h. Essa seleção é <b>hipotética</b>.');
 if(p.strategy==='independent'&&crossed)alerts.push('SP-A &lt; SP-B com dois PIDs independentes: <b>metas simultâneas incompatíveis para uma única PV</b>; observar saturação e interação.');
 if(ftDistortion)alerts.push('FT situado depois da derivação: a PV mede somente o processo. Abrir o reciclo não garante recuperar esta PV nem proteger o rotor.');
 if(p.valveFault==='closed')alerts.push('A válvula foi simulada travada FECHADA: a MV do FIC-B pode crescer, mas a abertura física permanece em 0%.');
 if(p.valveFault==='open')alerts.push('A válvula está travada ABERTA: há recirculação mesmo quando a PV supera o SP-B; avaliar perdas e envio ao processo.');
 if(stale)alerts.push('FT congelado: PV, atuação dos PIDs e tendências de controle podem deixar de refletir a vazão real.');
 if(p.suction<28)alerts.push('Condição de sucção degradada: abrir mínimo não corrige necessariamente NPSH inadequado e cavitação na sucção.');
 if(state.speed>113&&Math.abs(ea)>10)alerts.push('Rotação próxima do limite do modelo, sem atendimento integral da referência do FIC-A.');
 if(state.tempExcess>4)alerts.push('Indicador térmico ilustrativo elevado: pouca renovação de líquido pode aumentar a temperatura interna.');
 $('diagnosis').innerHTML=alerts.map((x,i)=>`<p>${i?'• ':'➜ '}${x}</p>`).join('');
 $('diagramSpeed').textContent='Rotação: '+fmt(state.speed,0)+'%';$('diagramTotal').textContent=fmt(q,1)+' m³/h';$('diagramProc').textContent=fmt(state.qa,1)+' m³/h';$('diagramRecycle').textContent='Reciclo: '+fmt(state.qr,1)+' m³/h';$('diagA').textContent='MV rotação: '+fmt(state.speedCmd,1)+'%';$('diagB').textContent='MV mínimo: '+fmt(state.valveCmd,1)+'%';
 const ftX=ftDistortion?715:430;$('ftBox').setAttribute('x',ftX-41);$('ftLine').setAttribute('x1',ftX);$('ftLine').setAttribute('x2',ftX);$('ftName').setAttribute('x',ftX);$('ftBox').setAttribute('stroke',stale?'#fa848f':'#73c2ee');document.querySelector('#plantSvg [data-topic=ft] text:last-of-type').setAttribute('x',ftX);
 $('rotor').style.transformOrigin='301px 213px';$('rotor').style.transform=`rotate(${(state.t*state.speed*2.2)%360}deg)`;
 $('movingMain').style.animationDuration=clamp(7/(Math.max(state.qa,5)/22),.3,7)+'s';$('movingRec').style.animationDuration=clamp(5/(Math.max(state.qr,2)/15),.3,8)+'s';$('movingRec').classList.toggle('off',state.qr<2);$('movingRec').style.opacity=state.qr<2?.08:clamp(.25+state.qr/100,.25,1);
 trendDraw('flowTrend',[['pv','#59baf4'],['spa','#78dbbd'],['spb','#eab161'],['total','#ad85f4']],0,240);trendDraw('mvTrend',[['speed','#56b6f2'],['valve','#efa450']],0,120);
 if($('fundamentos').classList.contains('active'))curveDraw();
}
let frameHandle=0;
function loop(){if(state.running){const steps=+($('timeScale').value||1)*.18;tick(steps);render()}frameHandle=setTimeout(loop,180)}
function curveDraw(){const cEl=$('curveChart');if(!cEl||!cEl.clientWidth)return;const W=cEl.clientWidth,H=220,ratio=Math.min(window.devicePixelRatio||1,2);cEl.height=H*ratio;cEl.width=W*ratio;const c=cEl.getContext('2d');c.scale(ratio,ratio);c.clearRect(0,0,W,H);const pad={l:44,r:15,t:15,b:27};const ww=W-pad.l-pad.r,hh=H-pad.t-pad.b;const xy=(q,h)=>[pad.l+ww*q/230,pad.t+hh*(1-h/520)];
 c.strokeStyle='#315064';c.lineWidth=1;c.beginPath();c.moveTo(pad.l,pad.t);c.lineTo(pad.l,H-pad.b);c.lineTo(W-pad.r,H-pad.b);c.stroke();c.fillStyle='#b8cedc';c.font='11px Segoe UI';c.fillText('H',10,17);c.fillText('Q →',W-40,H-5);
 for(const [factor,col] of [[1,'#75bbf4'],[.83,'#6ddab6']]){c.beginPath();for(let q=0;q<=225;q+=3){let h=400*factor*factor-.007*q*q;let [x,y]=xy(q,h);q===0?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=col;c.lineWidth=2.5;c.stroke()}
 c.beginPath();for(let q=0;q<=225;q+=3){let h=70+.013*q*q;let [x,y]=xy(q,h);q===0?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle='#efb565';c.stroke();c.fillStyle='#b8cedc';c.fillText('Curva sistema',W*.55,25);
}
const topics={
ft:['Transmissor FT — uma única PV',`<p>Um transmissor converte a vazão medida em um sinal de instrumentação. Segundo a descrição fornecida, esse sinal é <b>bifurcado</b> para FIC-39164A e FIC-39164B.</p><p>Se os blocos recebem o mesmo valor escalonado, <b>PV-A = PV-B</b>. Os dois SPs podem ser diferentes sem que haja dois fluxos medidos.</p><p>Posição da tomada: <b>antes do ramal de reciclo</b> mede vazão total; <b>depois</b>, pode medir apenas a vazão de processo. Isso muda a resposta da malha de mínimo. Filtros, unidades e cálculos também precisam ser conferidos.</p>`],
fica:['FIC-39164A — controle de rotação',`<p>Recebe a PV do FT e compara com o SP-A. A saída MV-A é interpretada neste material como demanda de ajuste de velocidade da J-3912.</p><p>Quando a vazão está abaixo da referência, o controlador pode solicitar aceleração; acima, desaceleração. A rotação modifica a curva H×Q da bomba e o ponto operacional.</p><p>Velocidade mínima/máxima, taxa de variação, permissivos e ação do controlador não foram comprovados. A indicação MAN na captura significa ausência de correção PID automática.</p>`],
ficb:['FIC-39164B — fluxo mínimo',`<p>Recebe a mesma PV, mas trabalha com SP-B. Sua MV-B é interpretada como comando de posicionamento da válvula de recirculação.</p><p>Quando FT mede o fluxo através do rotor, abrir o reciclo pode aumentar essa medição e proteger contra operação com vazão muito baixa. Um caminho aberto requer diferencial de pressão, fluido disponível e destino adequado.</p><p>Se o FT só mede a corrente enviada ao processo, abrir o reciclo pode não elevar a PV: não se pode presumir a mesma proteção sem lógica adicional.</p>`],
valvula:['Válvula de fluxo mínimo',`<p>Cria uma trajetória externa de circulação para manter vazão pelo rotor quando o consumidor exige pouca vazão. Não deve ser confundida com a recirculação interna indesejada no impulsor.</p><p>Se ficar travada fechada, a bomba pode manter pouca circulação apesar do comando de abertura. Se ficar travada aberta, a vazão de processo pode cair e ocorrer perdas energéticas e aquecimento no retorno.</p><p>É necessário conferir característica da válvula, posição de falha, fim de curso, retorno, diferencial e risco de cavitação/erosão.</p>`],
bomba:['J-3912 — transporte de líquido',`<p>A bomba centrífuga transfere energia mecânica ao líquido. Opera na interseção entre sua curva característica de altura manométrica e a curva hidráulica do circuito.</p><p>Em baixa vazão podem ocorrer separação do escoamento, recirculação interna, pulsação, aquecimento e esforços que comprometem selos e mancais. A velocidade variável não garante, sozinha, vazão mínima.</p><p>O número apresentado no simulador é <b>porcentagem de rotação nominal didática</b>, não rpm reais da J-3912.</p>`]
};
function showTopic(key){if(!topics[key])return;$('topicTitle').textContent=topics[key][0];$('topicBody').innerHTML=topics[key][1];$('topicDrawer').hidden=false;$('closeDrawer').focus({preventScroll:true})}
const scenarioDefs=[
 {title:'1. Queda de demanda do processo',preset:'demanddrop',desc:'A restrição do consumidor aumenta e a vazão exigida diminui. A rotação tenta ajustar a entrega enquanto o fluxo mínimo deve impedir circulação inadequada.',question:'Em quais condições a recirculação passa a contribuir para a proteção?',hint:'Analise Q total, PV do FT, SP-B e posição efetiva da válvula, não somente a MV do FIC-B.'},
 {title:'2. Restrição severa na descarga',preset:'lowflow',desc:'A curva do sistema torna-se mais resistente. Mesmo com aceleração, a bomba pode encontrar seu limite de capacidade.',question:'Por que a MV-A no máximo não implica recuperação da vazão do processo?',hint:'A curva da bomba e a curva do sistema determinam o ponto de operação. Verifique a saturação do acionamento.'},
 {title:'3. Recirculação travada fechada',preset:'valveclosed',desc:'O FIC-B aumenta sua saída quando necessário, porém o atuador fica na posição fechada.',question:'Por que comandar abertura não prova que existe proteção hidráulica?',hint:'Compare MV-B e abertura real. Confirme a vazão que efetivamente atravessa o rotor.'},
 {title:'4. Recirculação travada aberta',preset:'valveopen',desc:'O retorno permanece aberto mesmo quando a vazão está acima da referência de mínimo.',question:'Que desvantagens de processo e de energia podem ocorrer?',hint:'Observe a divisão da vazão, a condição de entrega e a dissipação no retorno.'},
 {title:'5. Referências simultâneas conflitantes',preset:'setpoint',desc:'Os dois PIDs recebem a mesma PV, mas SP-A está abaixo de SP-B. A opção carregada utiliza controladores independentes.',question:'É possível atingir de forma estável os dois SPs diferentes para uma PV única?',hint:'Não existe uma PV que valha simultaneamente 55 e 95 m³/h. Compare esta condição com a opção Prioridade do mínimo.'},
 {title:'6. FT a jusante do desvio de reciclo',preset:'aftertee',desc:'A mesma leitura passa a representar somente a vazão para o processo; o controlador B ainda tenta proteger a bomba pelo valor medido.',question:'Por que a abertura do reciclo pode piorar a resposta do FIC-B?',hint:'Q processo não equivale a Q da bomba. A derivação pode competir hidraulicamente pelo fluido.'},
 {title:'7. Falha comum do transmissor',preset:'frozen',desc:'O FT permanece indicando um valor antigo após mudança hidráulica. Ambas as malhas passam a utilizar informação obsoleta.',question:'Qual consequência de compartilhar um único sensor para controle e proteção?',hint:'O sinal comum é um ponto de falha comum. Avalie as variáveis independentes disponíveis na instalação.'},
 {title:'8. Sucção com condições inadequadas',preset:'suctionlow',desc:'A margem de sucção se deteriora. O controle de velocidade pode solicitar aceleração para tentar recuperar a PV.',question:'O mínimo aberto elimina o risco de cavitação por NPSH insuficiente?',hint:'Não. As causas de cavitação podem estar na sucção e dependem de pressão, temperatura e pressão de vapor.'},
 {title:'9. Controladores em manual',preset:'manual',desc:'Comandos de velocidade e recirculação são definidos manualmente, mesmo diante de queda na vazão de processo.',question:'Qual informação confirma que a proteção realmente está disponível?',hint:'Em MAN a saída não é corrigida pelo PID. É necessária avaliação da vazão real e da configuração de proteção existente.'}
];
function renderScenarios(){const host=$('scenarioList');host.innerHTML=scenarioDefs.map((s,i)=>`<article class="scenario-card"><div class="eyebrow">Cenário ${String(i+1).padStart(2,'0')}</div><h2>${escapeHTML(s.title)}</h2><p>${escapeHTML(s.desc)}</p><div class="scenario-aim"><b>Diagnóstico CIC:</b> ${escapeHTML(s.question)}</div><div class="buttons"><button class="primary" data-open-preset="${s.preset}">▶ Simular condição</button><button class="subtle" data-hint="${i}">💡 Entenda a resposta</button></div><div class="answer-explain hidden" id="hint-${i}">${escapeHTML(s.hint)}</div></article>`).join('');host.querySelectorAll('[data-open-preset]').forEach(btn=>btn.addEventListener('click',()=>{setPreset(btn.dataset.openPreset);changeView('simulador');toast('Cenário carregado. Observe a resposta e os gráficos.')}));host.querySelectorAll('[data-hint]').forEach(btn=>btn.addEventListener('click',()=>{$('hint-'+btn.dataset.hint).classList.toggle('hidden')}))}
const questionBank=[
 {q:'Os dois FICs da J-3912 recebem um mesmo sinal de FT, mas seus SPs diferem. Qual interpretação é correta?',a:['Compartilham a PV; cada um compara com sua referência.','Medem vazões distintas porque possuem SPs diferentes.','Recebem pressões diferentes convertidas em vazão.','Compartilham a MV; a vazão não precisa ser medida.'],correct:0,why:'Setpoints diferentes não implicam medições físicas diferentes. Uma mesma PV pode ser comparada a duas referências distintas.'},
 {q:'Em uma bomba centrífuga, a vazão cai muito e a pressão de descarga permanece elevada. Qual avaliação é pertinente?',a:['A pressão elevada não comprova vazão hidráulica segura.','A pressão elevada elimina a recirculação interna.','A pressão elevada assegura resfriamento do rotor.','A pressão elevada confirma operação no ponto BEP.'],correct:0,why:'Uma bomba pode produzir altura elevada perto do shutoff e ter vazão insuficiente através do rotor.'},
 {q:'Qual é a finalidade principal da recirculação externa por válvula de mínimo?',a:['Aumentar a vazão através da bomba em baixa demanda.','Eliminar as perdas de energia no circuito de descarga.','Reduzir automaticamente a pressão de vapor do fluido.','Garantir pressão de sucção em qualquer condição.'],correct:0,why:'O desvio fornece um caminho hidráulico para preservar a vazão interna; não corrige todas as demais causas de falha.'},
 {q:'Uma linha de mínimo retorna 60 m³/h enquanto o processo recebe 40 m³/h. Desprezando outros ramos, quanto passa pela bomba?',a:['100 m³/h, pela conservação da massa.','60 m³/h, pois só o retorno é medido.','40 m³/h, pois somente o processo conta.','20 m³/h, pela diferença entre os ramos.'],correct:0,why:'A vazão no rotor é a soma das vazões enviadas ao processo e à recirculação externa.'},
 {q:'O FIC-B ordena abertura elevada, mas a válvula está travada fechada. Qual é a conclusão apropriada?',a:['A MV elevada não assegura circulação pelo retorno.','A MV elevada comprova a abertura hidráulica real.','A MV elevada reduz diretamente a rotação da bomba.','A MV elevada transforma o retorno em medidor de vazão.'],correct:0,why:'MV é comando. A posição real, o diferencial e o escoamento devem ser considerados.'},
 {q:'Qual fenômeno está associado à vazão muito baixa através de um rotor centrífugo?',a:['Recirculação interna e possível instabilidade hidráulica.','Eliminação de vórtices por redução de velocidade.','Aumento obrigatório do rendimento hidráulico global.','Desaparecimento dos esforços radiais sobre o rotor.'],correct:0,why:'Em baixa vazão, separação do escoamento, recirculação interna e cargas hidráulicas desfavoráveis podem ocorrer.'},
 {q:'O FT está depois da derivação de reciclo, medindo apenas o processo. Qual consequência possível ao abrir a válvula?',a:['A PV pode não subir, apesar do aumento de reciclo.','A PV sempre passa a medir a vazão total da bomba.','A PV torna-se igual à abertura percentual da válvula.','A PV sempre aumenta proporcionalmente ao retorno.'],correct:0,why:'Abrir o desvio altera a divisão de fluxo. A corrente para o processo não representa necessariamente a passagem pelo rotor.'},
 {q:'Os SPs de dois PIDs independentes são 60 e 90 m³/h para a mesma PV. O que se pode afirmar?',a:['As duas metas exatas não podem valer simultaneamente.','As metas serão ambas atendidas se a válvula abrir.','As duas PVs serão diferentes por definição de controle.','As metas são equivalentes porque o FT é compartilhado.'],correct:0,why:'Uma variável medida única não pode assumir dois valores distintos no mesmo instante; é preciso definir coordenação e prioridades.'},
 {q:'Qual relação corresponde à lei de afinidade ideal para altura e rotação, mantendo similaridade?',a:['A altura varia aproximadamente com o quadrado de N.','A altura varia aproximadamente com o cubo de N.','A altura permanece constante quando N varia.','A altura varia inversamente com o quadrado de N.'],correct:0,why:'Para um mesmo rotor e pontos hidraulicamente semelhantes, H₂/H₁ ≈ (N₂/N₁)².'},
 {q:'A válvula de mínimo está excessivamente aberta durante demanda normal. Qual efeito pode ocorrer?',a:['Maior reciclo, perdas energéticas e menor envio útil.','Fim das perdas de carga na linha de retorno.','Aumento garantido do NPSH disponível na sucção.','Desaparecimento da dissipação térmica na válvula.'],correct:0,why:'Reciclo excessivo não é gratuito; pode consumir capacidade, energia e aquecer o circuito de retorno.'},
 {q:'O FT único congela sua leitura. Qual é a vulnerabilidade de compartilhar a PV nas duas malhas?',a:['Ambos podem atuar com uma medição obsoleta.','O segundo FIC passa a ter sensor independente.','O SP-B substitui a medição ausente de processo.','A saída manual garante proteção de forma automática.'],correct:0,why:'Sensor único introduz falha comum para funções que dependem daquela PV.'},
 {q:'Qual descrição distingue vazão mínima térmica de vazão mínima estável?',a:['Uma limita aquecimento; a outra limita instabilidade hidráulica.','Uma limita altura; a outra determina diâmetro de tubulação.','Uma controla pressão; a outra controla densidade do fluido.','Ambas representam obrigatoriamente o mesmo valor em rpm.'],correct:0,why:'Uma bomba pode atingir condição hidráulica inadequada sem que a temperatura já esteja elevada.'},
 {q:'O controle de velocidade acelera, mas a vazão não recupera. Qual explicação física é possível?',a:['A curva do sistema e os limites da bomba restringem a vazão.','Toda aceleração necessariamente aumenta a PV ao SP pedido.','O ganho do PID elimina as limitações de altura manométrica.','A vazão independe da resistência hidráulica de descarga.'],correct:0,why:'O ponto de operação depende das curvas do equipamento e do circuito, além dos limites de acionamento.'},
 {q:'A J-3912 apresenta condição inadequada de sucção. Por que a válvula de mínimo não basta?',a:['NPSH insuficiente pode persistir mesmo com reciclo aberto.','O reciclo garante margem de NPSH em qualquer temperatura.','A válvula de mínimo modifica a pressão de vapor do líquido.','O reciclo impede qualquer cavitação dentro do rotor.'],correct:0,why:'A recirculação não substitui controle de pressão de sucção, temperatura, inventário e requisitos de NPSH.'}
];
let quizQuestions=[],quizIndex=0,score=0,answered=false;
function randomize(arr){let copy=arr.slice();for(let i=copy.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function restartQuiz(){quizQuestions=randomize(questionBank.map(q=>({...q,order:randomize(q.a.map((_,i)=>i))})));quizIndex=0;score=0;answered=false;renderQuiz()}
function renderQuiz(){if(quizIndex>=quizQuestions.length){$('quizProgress').textContent='Avaliação concluída';$('quizScoreLine').textContent='Você pode reiniciar para embaralhar a ordem das perguntas e alternativas.';$('quizHost').innerHTML=`<div class="result"><h2>Resultado do treinamento</h2><strong>${score}/${quizQuestions.length}</strong><p>${score===quizQuestions.length?'Todos os conceitos foram interpretados corretamente.':'Revise as justificativas e teste novamente os cenários no simulador.'}</p><button class="primary" id="resultAgain">↺ Nova avaliação</button></div>`;$('resultAgain').onclick=restartQuiz;return}
 const item=quizQuestions[quizIndex];$('quizProgress').textContent=`Questão ${quizIndex+1} de ${quizQuestions.length}`;$('quizScoreLine').textContent=`${score} resposta(s) correta(s) até aqui.`;answered=false;$('quizHost').innerHTML=`<div class="quiz-box"><div class="quiz-counter">DESAFIO ${String(quizIndex+1).padStart(2,'0')} · CONTROLE E HIDRÁULICA</div><h2>${escapeHTML(item.q)}</h2><div class="choices">${item.order.map((ix,pos)=>`<button class="choice" data-answer="${ix}"><span>${'ABCD'[pos]}</span><div>${escapeHTML(item.a[ix])}</div></button>`).join('')}</div><div class="answer-explain hidden" id="answerExplain"></div><div class="quiz-nav"><button id="nextQuiz" class="primary hidden">${quizIndex===quizQuestions.length-1?'Ver resultado':'Próxima questão →'}</button></div></div>`;
 $('quizHost').querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{if(answered)return;answered=true;const selected=+b.dataset.answer;const ok=selected===item.correct;if(ok)score++;for(const btn of $('quizHost').querySelectorAll('[data-answer]')){btn.disabled=true;if(+btn.dataset.answer===item.correct)btn.classList.add('correct');else if(+btn.dataset.answer===selected)btn.classList.add('wrong')};$('answerExplain').textContent=(ok?'Correto. ':'Reveja. ')+item.why;$('answerExplain').classList.remove('hidden');$('nextQuiz').classList.remove('hidden');$('quizScoreLine').textContent=`${score} acerto(s) em ${quizIndex+1} resposta(s).`;}));$('nextQuiz').onclick=()=>{quizIndex++;renderQuiz()};
}
const checklist=[
'Tag e localização física do FT compartilhado; confirmar antes ou depois do T de reciclo.',
'Unidades, escalas, processamento de PV e filtros dos dois FICs no Centum VP.',
'SP-A e SP-B reais e suas condições de alteração operacional.',
'Sentido de ação direta/reversa de cada controlador e sinais de comando MV.',
'Confirmar que FIC-39164A altera a rotação da J-3912; limites do acionamento.',
'Confirmar que FIC-39164B comanda a válvula de mínimo; tags, curso e característica.',
'Existência de seletor, override, faixa neutra, anti-windup ou lógica de habilitação.',
'Intertravamentos, alarmes e condição de falha para FT, velocidade e válvula.',
'Curvas Q×H, potência, NPSH e regiões permitidas para a faixa de rotação.',
'Vazão mínima térmica e vazão mínima estável fornecidas pelo fabricante.',
'Ponto de retorno do reciclo, risco térmico e efeitos da perda de diferencial.',
'Feedback de abertura real, variáveis independentes de diagnóstico e testes autorizados.',
'Especificar a atuação esperada em MAN/AUTO e nas transferências entre modos.',
'Comparar com histórico de processo e procedimento de operação aprovado.'
];
function buildChecklist(){const host=$('checklist');host.innerHTML=checklist.map((x,i)=>`<label class="check-item"><input type="checkbox" id="ck${i}"><span>${escapeHTML(x)}</span></label>`).join('')}
function changeView(name,replace=false){if(!$(name)||!document.querySelector(`[data-view="${name}"]`))return;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===name));document.querySelectorAll('.tabbar [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));if(!replace&&location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);window.scrollTo({top:0,behavior:'instant'});if(name==='simulador')render();if(name==='fundamentos')curveDraw()}
let toastTimeout;function toast(str){const el=$('toast');el.textContent=str;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),3500)}
let installPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').textContent='＋ Instalar App'});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Aplicativo instalado com sucesso.');$('installBtn').textContent='✓ App instalado'});
async function installApp(){if(installPrompt){installPrompt.prompt();const res=await installPrompt.userChoice;installPrompt=null;if(res.outcome!=='accepted')toast('Instalação cancelada; o aplicativo continua no navegador.');return}toast('Para instalar: use o menu do navegador → Instalar app / Adicionar à tela inicial. Use HTTPS (ex.: GitHub Pages).')}
async function swUpdate(){if('serviceWorker' in navigator){try{const reg=await navigator.serviceWorker.getRegistration();if(!reg){toast('Sem Service Worker ativo neste endereço.');return}await reg.update();if(reg.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});toast('Atualização disponível. Recarregando…')}else toast('Busca de atualização realizada. Se necessário, atualize a página.')}catch(e){toast('Não foi possível consultar a atualização: '+e.message)}}else{toast('Este navegador não oferece Service Worker. Recarregue pelo navegador.')}}
function init(){
 document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.view)));
 document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.go)));
 for(const id of controls)$(id).addEventListener('input',()=>refreshControls());
 ['modeA','modeB','strategy','ftLocation','valveFault','ftFault'].forEach(id=>$(id).addEventListener('change',()=>{refreshControls();if(id==='ftFault')state.ftFreezeInitialized=false;logEvent('Configuração alterada: '+$(id).options[$(id).selectedIndex].text)}));
 document.querySelectorAll('[data-preset]').forEach(x=>x.addEventListener('click',()=>setPreset(x.dataset.preset)));
 document.querySelectorAll('[data-topic]').forEach(x=>{x.addEventListener('click',()=>showTopic(x.dataset.topic));if(x.tagName.toLowerCase()==='g'){x.setAttribute('role','button');x.setAttribute('tabindex','0');x.setAttribute('aria-label','Explicação: '+(topics[x.dataset.topic]?.[0]||x.dataset.topic));x.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTopic(x.dataset.topic)}})}});
 $('closeDrawer').onclick=()=>{$('topicDrawer').hidden=true};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('topicDrawer').hidden=true});
 $('toggleRun').onclick=()=>{state.running=!state.running;$('toggleRun').textContent=state.running?'❚❚ Pausar':'▶ Continuar';updateRunBadge()};
 $('stepRun').onclick=()=>{const was=state.running;state.running=false;for(let i=0;i<70;i++)tick(10/70);render();logEvent('Avanço manual de 10 s simulado.');state.running=was;updateRunBadge()};
 $('resetRun').onclick=()=>resetPlant();$('clearTrend').onclick=()=>{state.hist=[];render();toast('Histórico do simulador limpo.')};
 $('affinityN').oninput=()=>{const f=+$('affinityN').value/100;$('affinityNOut').textContent=fmt(f*100,0)+'%';$('aQ').textContent=fmt(f*100,0)+'%';$('aH').textContent=fmt(f*f*100,1)+'%';$('aP').textContent=fmt(f*f*f*100,1)+'%'};$('affinityN').oninput();
 $('restartQuiz').onclick=restartQuiz;$('resetChecklist').onclick=()=>document.querySelectorAll('#checklist input').forEach(x=>x.checked=false);
 $('installBtn').onclick=installApp;$('updateBtn').onclick=swUpdate;
 refreshControls();renderScenarios();buildChecklist();restartQuiz();resetPlant();changeView((location.hash||'#panorama').slice(1),true);render();loop();
 window.addEventListener('resize',()=>{render();curveDraw()});window.addEventListener('hashchange',()=>changeView((location.hash||'#panorama').slice(1),true));
 if('serviceWorker' in navigator && location.protocol.startsWith('http')){
   navigator.serviceWorker.register('./sw.js').catch(()=>{});
   let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing){refreshing=true;window.location.reload()}});
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)navigator.serviceWorker.getRegistration().then(r=>r?.update()).catch(()=>{})});
 }
}
window.addEventListener('DOMContentLoaded',init);
