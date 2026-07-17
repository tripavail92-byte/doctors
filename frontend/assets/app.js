/* Health OS — shared app shell. Each screen sets <body data-page data-nav data-title data-sub data-edition data-role [data-shell="none"]>
   and contains only its inner content. This script injects the icon sprite + sidebar + topbar around it. */
(function(){
  var SPRITE = '<svg id="ic-sprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+
  sym('i-dash','<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>')+
  sym('i-leads','<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.4 3-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><path d="M17 8.5h4M19 6.5v4"/>')+
  sym('i-cal','<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>')+
  sym('i-clock','<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')+
  sym('i-user','<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-3.6 3.4-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/>')+
  sym('i-users','<circle cx="8.5" cy="8.5" r="3"/><path d="M2.5 19c.6-3 2.8-4.6 6-4.6"/><circle cx="16" cy="9.5" r="2.6"/><path d="M13 19c.5-2.8 2.6-4.3 5.3-4.3S22.5 16 23 19"/>')+
  sym('i-note','<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M8.5 11h7M8.5 15h5"/>')+
  sym('i-plan','<path d="M12 3.5l8 4.2-8 4.2-8-4.2z"/><path d="M4 12l8 4.2 8-4.2M4 16l8 4.2 8-4.2"/>')+
  sym('i-invoice','<path d="M5.5 3.5h13v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.1 1.4-2.2-1.4-2 1.3z"/><path d="M9 8h6M9 12h6"/>')+
  sym('i-cash','<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>')+
  sym('i-pie','<path d="M12 3.5A8.5 8.5 0 1 0 20.5 12H12z"/><path d="M12 3.5V12h8.5"/>')+
  sym('i-wallet','<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M16.5 14.5h1.5"/>')+
  sym('i-box','<path d="M12 3.5l8 4v9l-8 4-8-4v-9z"/><path d="M4 7.5l8 4 8-4M12 11.5V20"/>')+
  sym('i-mega','<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l7 4V4.5l-7 4H5.5A1.5 1.5 0 0 0 4 10z"/><path d="M18 9a3.5 3.5 0 0 1 0 6"/>')+
  sym('i-bars','<path d="M4 20V11M9.3 20V5M14.6 20v-6M20 20V8" stroke-linecap="round"/>')+
  sym('i-flask','<path d="M9 3.5h6M10 3.5v6l-4.6 8A1.5 1.5 0 0 0 6.8 20h10.4a1.5 1.5 0 0 0 1.4-2.5L14 9.5v-6"/><path d="M8 14h8"/>')+
  sym('i-pill','<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.7 8.7l6.6 6.6"/>')+
  sym('i-scan','<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7.5 12h9"/>')+
  sym('i-video','<rect x="3" y="6.5" width="12.5" height="11" rx="2"/><path d="M15.5 10l5-2.5v9L15.5 14z"/>')+
  sym('i-building','<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10 20.5v-3h4v3"/>')+
  sym('i-badge','<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16.5c.5-1.8 2-2.6 4-2.6s3.5.8 4 2.6"/>')+
  sym('i-gear','<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7l2 1.2M17.8 15.8l2 1.2M4.2 17l2-1.2M17.8 8.2l2-1.2M2.8 12h2.4M18.8 12h2.4"/>')+
  sym('i-bell','<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 2 6H4.5c.5-.5 2-2 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>')+
  sym('i-search','<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>')+
  sym('i-plus','<path d="M12 5v14M5 12h14" stroke-linecap="round"/>')+
  sym('i-check','<path d="M5 12.5l4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/>')+
  sym('i-x','<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>')+
  sym('i-warn','<path d="M12 4l8.5 15h-17z"/><path d="M12 10v4M12 17h.01" stroke-linecap="round"/>')+
  sym('i-tag','<path d="M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4h7l7.5 7.5a1.5 1.5 0 0 1 0 2.1l-5.4 5.4a1.5 1.5 0 0 1-2.1 0z"/><circle cx="9" cy="9" r="1.3"/>')+
  sym('i-shield','<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>')+
  sym('i-heart','<path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.7 12 20 12 20z"/>')+
  sym('i-chevron','<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>')+
  sym('i-edit','<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>')+
  sym('i-filter','<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>')+
  sym('i-download','<path d="M12 4v11M7 11l5 5 5-5M5 20h14" stroke-linecap="round" stroke-linejoin="round"/>')+
  sym('i-star','<path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 15.8 7.3 18.3l.9-5.1L4.5 9.5l5.2-.8z"/>')+
  sym('i-phone','<path d="M6 3.5h4l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v4a2 2 0 0 1-2 2C11.5 20.8 4.2 13.5 4 6a2 2 0 0 1 2-2.5z"/>')+
  sym('i-mail','<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>')+
  sym('i-menu','<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/>')+
  sym('i-logout','<path d="M14 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7M17 12H10M15 9l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>')+
  sym('i-steth','<path d="M6 4.5v4a4 4 0 0 0 8 0v-4M6 4.5H4.5M14 4.5h1.5M10 16.5v1a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="12" r="2"/>')+
  sym('i-globe','<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17"/>')+
  '</defs></svg>';

  function sym(id, inner){ return '<symbol id="'+id+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">'+inner+'</symbol>'; }
  function ic(id){ return '<svg class="ic"><use href="#'+id+'"/></svg>'; }

  var NAV = [
    ['Overview',[['Dashboard','dashboard','i-dash']]],
    ['Sales & Front Desk',[['Leads & CRM','crm-leads','i-leads','23'],['Appointments','appt-calendar','i-cal','18'],['Queue','queue','i-clock'],['Patients','patients','i-user']]],
    ['Clinical',[['Consultations','consult','i-note'],['Treatment Plans','treatment-plan','i-plan']]],
    ['Finance',[['Billing & Payments','billing-invoices','i-invoice'],['Revenue Share','revshare-earnings','i-pie'],['Payroll','payroll','i-wallet']]],
    ['Operations',[['Inventory','inventory','i-box','4'],['Marketing','marketing-campaigns','i-mega'],['Reports','reports','i-bars']]],
    ['Verticals',[['Lab (LIS)','lab-orders','i-flask'],['Pharmacy','pharmacy-pos','i-pill'],['Imaging','imaging-orders','i-scan'],['Telehealth','telehealth','i-video'],['Hospital','hosp-beds','i-building']]],
    ['System',[['Staff & Roles','admin-users','i-badge'],['Settings','settings','i-gear']]]
  ];

  function sidebar(active, ds){
    var ed = ds.edition ? ds.edition.charAt(0).toUpperCase()+ds.edition.slice(1) : 'Clinic';
    var h = '<aside class="sidebar"><div class="brand"><div class="mark">'+ic('i-plus')+'</div><div><div class="name">Health OS</div><div class="sub">'+ed+' Edition</div></div></div>';
    NAV.forEach(function(g){ h+='<div class="nav-group"><h4>'+g[0]+'</h4><nav class="nav">';
      g[1].forEach(function(it){ var on=it[1]===active?' active':''; var cnt=it[3]?'<span class="count'+(it[3]==='4'||it[3]==='23'?' hot':'')+'">'+it[3]+'</span>':'';
        h+='<a href="'+it[1]+'.html" data-page="'+it[1]+'"'+(on?' class="active"':'')+'>'+ic(it[2])+it[0]+cnt+'</a>'; });
      h+='</nav></div>'; });
    h+='<div class="sidebar-foot">Powered by <b style="color:#fff">Summit Systems</b><br>contact@summitsystems.com</div></aside>';
    return h;
  }
  function topbar(ds){
    var title=ds.title||'Health OS'; var sub=ds.sub||'';
    var who=ds.role==='doctor'?['Dr. Bilal Ahmed','Doctor']:ds.role==='reception'?['Sadia Khan','Reception']:['Dr. Sana Ahmed','Owner · Admin'];
    return '<header class="topbar"><div class="title"><h1>'+title+'</h1>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+
      '<div class="search">'+ic('i-search')+'<input placeholder="Search patients, appointments, invoices…"></div>'+
      '<div class="top-actions"><select class="ed-switch" title="Demo — switch edition theme"><option value="clinic">Clinic</option><option value="specialty">Specialty</option><option value="lab">Lab</option><option value="pharmacy">Pharmacy</option><option value="hospital">Hospital</option><option value="enterprise">Enterprise</option></select><button class="iconbtn">'+ic('i-bell')+'<span class="badge">5</span></button>'+
      '<div class="me"><div class="av-sm">'+initials(who[0])+'</div><div class="who"><b>'+who[0]+'</b><br><span>'+who[1]+'</span></div></div></div></header>';
  }
  function initials(n){ return n.replace('Dr. ','').split(' ').map(function(w){return w[0];}).slice(0,2).join(''); }

  document.addEventListener('DOMContentLoaded', function(){
    var b=document.body, ds=b.dataset;
    b.insertAdjacentHTML('afterbegin', SPRITE);
    if(ds.edition) b.classList.add('ed-'+ds.edition);
    if(ds.shell!=='none'){
      var sprite=document.getElementById('ic-sprite');
      var content=document.createElement('div'); content.className='content';
      Array.from(b.childNodes).forEach(function(n){ if(n!==sprite) content.appendChild(n); });
      var app=document.createElement('div'); app.className='app';
      app.innerHTML=sidebar(ds.nav||ds.page, ds)+'<div class="main">'+topbar(ds)+'</div>';
      app.querySelector('.main').appendChild(content);
      b.appendChild(app);
    }
    wire();
  });

  function toast(msg){
    var c=document.getElementById('hos-toasts'); if(!c){ c=document.createElement('div'); c.id='hos-toasts'; document.body.appendChild(c); }
    var t=document.createElement('div'); t.className='toast'; t.innerHTML=ic('i-check')+'<span>'+msg+'</span>'; c.appendChild(t);
    setTimeout(function(){ t.classList.add('show'); },10);
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); },300); },2500);
  }
  function wire(){
    document.querySelectorAll('.tabs').forEach(function(t){ t.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(e){ e.preventDefault(); t.querySelectorAll('a').forEach(function(x){x.classList.remove('on');}); a.classList.add('on'); }); }); });
    document.querySelectorAll('.segmented').forEach(function(s){ s.querySelectorAll('button').forEach(function(btn){ btn.addEventListener('click',function(){ s.querySelectorAll('button').forEach(function(x){x.classList.remove('on');}); btn.classList.add('on'); }); }); });
    document.querySelectorAll('.switch').forEach(function(sw){ sw.addEventListener('click',function(){ sw.classList.toggle('on'); }); });
    document.querySelectorAll('[data-close]').forEach(function(x){ x.addEventListener('click',function(){ var m=x.closest('.modal-wrap'); if(m) m.classList.add('hide'); }); });
    // edition switcher (live theme flip)
    document.querySelectorAll('.ed-switch').forEach(function(sel){
      var cur=(document.body.className.match(/ed-([a-z]+)/)||[])[1]||'clinic'; sel.value=cur;
      sel.addEventListener('change',function(){
        ['specialty','lab','pharmacy','hospital','enterprise'].forEach(function(c){ document.body.classList.remove('ed-'+c); });
        if(sel.value!=='clinic') document.body.classList.add('ed-'+sel.value);
        var sub=document.querySelector('.brand .sub'); if(sub) sub.textContent=sel.value.charAt(0).toUpperCase()+sel.value.slice(1)+' Edition';
        toast(sel.options[sel.selectedIndex].text+' edition');
      });
    });
    // action-button feedback (only <button> with .btn, not tabs/segmented/close)
    document.querySelectorAll('button.btn').forEach(function(b){
      if(b.hasAttribute('data-close')||b.closest('.segmented')||b.dataset.wired) return; b.dataset.wired='1';
      b.addEventListener('click',function(){
        var t=(b.textContent||'').trim().toLowerCase(), msg='Done', fade=false;
        if(/approv/.test(t)){msg='Approved';fade=true;} else if(/deny|declin|reject/.test(t)){msg='Declined';fade=true;}
        else if(/save|update/.test(t))msg='Saved'; else if(/pay|payment|sale|charge/.test(t))msg='Payment recorded';
        else if(/send/.test(t))msg='Sent on WhatsApp'; else if(/book|confirm/.test(t))msg='Booked';
        else if(/release/.test(t))msg='Released'; else if(/verif/.test(t)){msg='Verified';fade=true;}
        else if(/dispens/.test(t)){msg='Dispensed';fade=true;} else if(/complete|mark|check.?in|give|triage|call/.test(t)){msg='Done';fade=true;}
        else if(/create|add|new|admit|onboard|issue|receive|launch|assign|remind|offer|reorder/.test(t))msg='Created';
        else if(/export|download|print/.test(t))msg='Exported'; else if(/cancel|discard|snooze/.test(t))msg='Cancelled';
        toast(msg);
        if(fade){ var row=b.closest('tr')||b.closest('.alert')||b.closest('.leadcard'); if(row){ row.style.transition='opacity .3s,transform .3s'; row.style.opacity='0'; row.style.transform='translateX(10px)'; setTimeout(function(){ row.remove(); },320); } }
      });
    });
    // live search filters the first table on the page
    document.querySelectorAll('.topbar .search input, .toolbar input[type=text], .filters input[type=text]').forEach(function(inp){
      if(inp.dataset.wired) return; inp.dataset.wired='1';
      inp.addEventListener('input',function(){
        var q=inp.value.toLowerCase(); var scope=inp.closest('.content')||document; var tbl=scope.querySelector('table.table'); if(!tbl) return;
        tbl.querySelectorAll('tbody tr').forEach(function(tr){ tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'; });
      });
    });
    // specialty picker cards
    document.querySelectorAll('.spec').forEach(function(c){ if(c.dataset.wired) return; c.dataset.wired='1';
      c.addEventListener('click',function(){ c.classList.toggle('sel'); var n=document.querySelectorAll('.spec.sel').length; var b=document.getElementById('cont'); if(b) b.textContent = n>1 ? ('Continue — set up my polyclinic ('+n+')') : 'Continue — set up my clinic'; }); });
  }
  window.HOSicon = ic; // helper if needed
  window.HOS = { NAV:NAV, sidebar:sidebar, topbar:topbar, initials:initials, wire:wire, ic:ic };
})();
