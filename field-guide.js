import {photos} from './field-photos.js?v=gallery29';

import {previews} from './photo-previews.js';

const report=['Отчёт Кусто','https://www.nationalgeographic.com/history/article/jacques-cousteau-underwater-living'];
const history=['Архив Общества Кусто','https://www.cousteau.org/know/inventions/conshelf/'];
const film=['Ангар в съёмке экспедиции','https://www.youtube.com/watch?v=8t-mLmNdsbE'];
const cabinPhoto=['Экипаж хижины у телефона',report[1]+'#:~:text=In%20Deep%20Cabin%27s%20living%20quarters'];
const notes={
  'village-crew':{
    title:'Семеро под водой',
    paragraphs:[
      'В 1963 году в подводной деревне жили семь океанавтов. Пятеро провели месяц в «Морской звезде» на глубине десяти метров. Ещё двое на неделю поселились в отдельной хижине у склона рифа, на глубине около тридцати метров.',
      'В «Морской звезде» готовил повар Пьер Гильбер. Над своей койкой он развесил фотографии родных и друзей. К обеду все пятеро собирались за столом в центральном зале. Продукты и пресную воду доставляли с судна «Розальдо».'
    ],images:['film-salon','film-starfish-bunks','film-cabin-bunks'],sources:[report,history]
  },
  'village-day':{
    title:'Один день под водой',
    paragraphs:[
      'Летом 1963 года у рифа Шааб-Руми жили семь океанавтов. Пятеро провели месяц в «Морской звезде». Два спальных крыла вмещали восемь человек. В каждом стояло по две двухъярусные койки. Ещё двое прожили неделю в глубоководной хижине. Там у каждого была своя койка.',
      'Перед выходом в море океанавт запускал на пульте часы напротив своей фамилии. Каждый день команда проводила по нескольку часов у рифа. Собирали живые образцы для биолога, чистили купол ангара и корпуса жилых крыльев от водорослей. Дома по очереди несли вахту у пульта и делили работу по хозяйству.',
      'Ели вместе в центральном зале. Готовил один из пятерых, повар Пьер Гильбер. За тем же столом в свободное время играли в шахматы. А иногда и после ужина снова надевали ласты, чтобы посмотреть, кто выходит к рифу в темноте.'
    ],images:['film-starfish-bunks','film-swimmers','film-salon'],sources:[report,history]
  },
  'starfish-beds':{
    title:'Месяц в «Морской звезде»',
    paragraphs:[
      'Летом 1963 года пятеро океанавтов прожили здесь месяц на глубине около десяти метров. Два крыла дома занимали спальни. В каждой стояли четыре койки в два яруса. Обедали вместе за столом в центральном зале.',
      'Однажды Симона Кусто спустилась к экипажу на ужин. Двое хозяев освободили для неё спальню и перебрались к товарищам. Симона осталась в подводном доме на пять дней.'
    ],images:['film-starfish-bunks','film-salon'],sources:[report,history]
  },
  'cabin-beds':{
    title:'Неделя на двоих',
    paragraphs:[
      'Раймон Кьенци и Андре Портелатин провели неделю в хижине на глубине около тридцати метров. Наверху помещались две койки и маленькая кухня. Отсюда по телефону они связывались с «Морской звездой».',
      'Кьенци вёл дневник. В первый вечер они легли в половине восьмого, но из-за жары и сырости почти не спали. На третью ночь Кьенци несколько раз выбирался в море, чтобы остыть. При свете фонаря он увидел двух акул, которые кружили возле дома.'
    ],images:['film-cabin-bunks','film-panel'],sources:[report]
  },
  salon:{
    title:'«Морская звезда»',
    paragraphs:[
      'Летом 1963 года пятеро океанавтов прожили здесь месяц на глубине около десяти метров. Команда Кусто проверяла, можно ли устроить на морском дне постоянное рабочее место. После выхода к рифу водолаз возвращался домой под тем же давлением. Длительную декомпрессию проходили в конце экспедиции.',
      'Биолог Раймон Весьер мог наблюдать животных рядом с домом и сразу заносить образцы в лабораторию. У спинорогов, например, команда видела, как рыба обдувает отложенную в песок икру струями воды. Такие наблюдения требовали времени у одного и того же участка рифа.'
    ],images:['film-starfish-night','film-salon','film-lab','station'],sources:[history,report]
  },
  garage:{
    title:'Ангар «Дениз»',
    paragraphs:[
      'На Шааб-Руми команда Кусто устроила первую подводную базу для исследовательского аппарата. Утром «Дениз» уходила от рифа в глубокую воду, а после рейса пилот заводил её под купол снизу.',
      'Прямо над бассейном висел трос лебёдки. Он позволял поднять блюдце из воды и осмотреть его здесь же, на глубине. Вокруг бассейна оставался узкий кольцевой настил для экипажа.'
    ],images:['film-hangar-under','film-hangar','garage'],sources:[film,report]
  },
  winch:{
    title:'Лебёдка над бассейном',
    paragraphs:[
      'Когда «Дениз» оказывалась под куполом, к аппарату крепили подъёмный трос. Электрическая лебёдка выбирала трос и поднимала корпус над водой. С кольцевого настила механики могли добраться до аппарата, осмотреть корпус и зарядить аккумуляторы.',
      'Перед выходом трос отпускали. Блюдце снова оказывалось на плаву и уходило в море через тот же открытый проём.'
    ],images:['film-hoist','denise'],sources:[report,film]
  },
  reef:{
    title:'Подводная деревня',
    paragraphs:[
      'У суданского рифа Шааб-Руми под водой устроили целое поселение. На мелкой площадке стояли «Морская звезда» и ангар для блюдца, а ниже по склону закрепили двухместную хижину.',
      'В домах поддерживали давление окружающей воды. Благодаря этому нижние люки можно было держать открытыми. Между домом, ангаром и местом работы океанавты плавали с аквалангами.'
    ],images:['film-starfish-wide','film-barracuda','film-village','village'],sources:[history]
  },
  cabin:{
    title:'Глубоководная хижина',
    paragraphs:[
      'Примерно на тридцати метрах Раймон Кьенци и Андре Портелатин прожили неделю вдвоём. Внизу они оставляли снаряжение, наверху спали, ели и вели журнал. Испытатели выясняли, сможет ли такой дом стать отправной точкой для работы глубже по склону.',
      'В хижине циркулировала смесь воздуха с гелием. Она была легче обычного сжатого воздуха, и на глубине дышать ею было проще. Гелий так менял тембр голосов, что по телефону обитателей сразу узнавали. В «Морской звезде» дежурный слышал их доклады и видел жилой ярус на телеэкране.'
    ],images:['film-hut-slope','film-cabin','cabin'],sources:[cabinPhoto,report]
  },
  atmosphere:{
    title:'Воздух и связь с базой',
    paragraphs:[
      'Уровень воды в открытом нижнем люке зависел от давления в хижине. Однажды ночью вода стала подниматься внутрь. Позже выяснилось, что гелий уходил через ввод телевизионного кабеля.',
      'Показания газоанализаторов обеих станций поступали на пульт «Морской звезды». Наверху у океанавтов были телефон и переговорное устройство, а изображение с камеры шло на пульт «Морской звезды». Когда хижина начала сползать по рифу во время монтажа, именно по телефону успели вызвать помощь.'
    ],images:['film-panel'],sources:[cabinPhoto,report]
  },
  canyon:{
    title:'Исследования на рифе',
    paragraphs:[
      'Океанавты возвращались к одним и тем же кораллам днём и ночью, чтобы увидеть, где рыбы кормятся и где ночуют. На рифе ставили цветные щиты и наблюдали, привлекают ли разные цвета разных обитателей.',
      'Для съёмки планктона океанавт проводил в воде тонкой шёлковой сеткой. Улов переносили в прозрачную камеру размером со спичечный коробок. Кинокамера снимала движения крошечных живых животных с увеличением.'
    ],images:['film-reef-dive','film-reef','film-reef-column','film-shoal','reef'],sources:[report]
  },
  ships:{
    title:'Исследовательское судно «Калипсо»',
    paragraphs:[
      'До встречи с Кусто деревянное судно служило тральщиком, а затем перевозило пассажиров у Мальты. В 1950 году Кусто начал переоборудовать его для экспедиций. В носу появилась подводная наблюдательная камера с восемью иллюминаторами. Оттуда можно было снимать море прямо на ходу.',
      'Во время «Кон-Шельф II» «Калипсо» поддерживала связь с берегом. Её палубный кран пригодился, когда глубоководная хижина сорвалась с креплений. Повседневное снабжение подводных домов обеспечивало второе судно, «Розальдо». В этой реконструкции на его стоянке стоит «Калипсо». От её борта шланги спускаются к «Морской звезде».'
    ],images:['ships'],sources:[['История «Калипсо»','https://www.cousteau.org/know/vessels/calypso/'],report]
  },
  denise:{
    title:'Ныряющее блюдце «Дениз»',
    paragraphs:[
      'Двухместный аппарат SP-350 прозвали блюдцем за приплюснутый круглый корпус. На рифе пилот и наблюдатель могли отправиться в рейс прямо из подводного ангара. Через иллюминаторы они рассматривали склон на глубинах, куда океанавты из деревни не могли доплыть с аквалангом.'
    ],images:['film-denise-front','film-denise-village','film-denise','denise'],sources:[history,film]
  },
  shark:{
    title:'Акулы у подводной деревни',
    paragraphs:[
      'В Красном море обитают серая рифовая и белоперая рифовая акулы. В прогулке у склона встречается серая. Белоперую легко узнать по светлым кончикам плавников. Днём её можно увидеть отдыхающей под коралловым уступом.',
      'У лестницы «Морской звезды» пловцов прикрывала клетка из стальных прутьев. На маршрутах стояли и отдельные клетки-убежища. Водолазы брали с собой специальные палки, которыми можно было удержать приблизившуюся акулу на расстоянии.'
    ],images:['grey','film-hatch-cage','film-swimmers','film-cage','white'],sources:[report,['Флоридский музей','https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/grey-reef-shark/']]
  }
};
function link(label,href){
  const a=document.createElement('a');
  a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;
}
const filmCredit='Кадр из фильма Жака-Ива Кусто «Мир без солнца» (1964)';
function photoUrl(key){
  return photos[key].asset ?? ('assets/field-guide/'+key+'.webp');
}
// Embedded miniatures can paint even when the full-size file is still in flight.
export function loadCardPhoto(img,url){
  const frame=document.createElement('span');
  frame.className='card-photo-frame';
  if(previews[url])frame.style.backgroundImage='url("data:image/webp;base64,'+previews[url]+'")';
  if(img.parentNode)img.replaceWith(frame);
  frame.append(img);
  img.decoding='async';
  img.src=url;
  img.decode().then(()=>img.classList.add('ready'),()=>{
    // Keep the miniature visible if the network fails.
    if(img.naturalWidth)img.classList.add('ready');
  });
  return frame;
}
export function fieldPhoto(key){
  const pic=photos[key],figure=document.createElement('figure'),img=new Image();
  img.alt=pic.caption;
  const caption=document.createElement('figcaption');
  caption.textContent=pic.film?filmCredit:pic.caption;
  figure.append(loadCardPhoto(img,photoUrl(key)),caption);
  return figure;
}
export function photoGallery(keys){
  const gallery=document.createElement('div');gallery.className='field-gallery';
  if(keys.length===1){gallery.append(fieldPhoto(keys[0]));return gallery;}

  const track=document.createElement('div');
  track.className='gallery-track';
  track.tabIndex=0;
  track.setAttribute('role','region');
  track.setAttribute('aria-label','Фотографии');
  for(const key of keys)track.append(fieldPhoto(key));

  const controls=document.createElement('div'),page=document.createElement('span');
  controls.className='gallery-controls';
  page.setAttribute('aria-live','polite');
  const current=()=>track.clientWidth ? Math.round(track.scrollLeft/track.clientWidth) : 0;
  let destination=null;
  const syncPage=()=>{
    const index=current();
    const label=(index+1)+' / '+keys.length;
    if(page.textContent!==label)page.textContent=label;
    if(destination!==null && Math.abs(track.scrollLeft-destination*track.clientWidth)<1)destination=null;
  };
  const turn=direction=>{
    const from=destination??current();
    const next=(from+direction+keys.length)%keys.length;
    const animate=Math.abs(next-from)===1 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    destination=next;
    track.scrollTo({left:next*track.clientWidth,behavior:animate?'smooth':'auto'});
    syncPage();
  };
  function arrow(direction,label){
    const button=document.createElement('button');
    button.type='button';
    button.setAttribute('aria-label',label);
    button.onclick=()=>turn(direction);
    return button;
  }
  track.addEventListener('scroll',syncPage,{passive:true});
  for(const event of ['pointerdown','wheel']){
    track.addEventListener(event,()=>{destination=null;},{passive:true});
  }
  track.addEventListener('keydown',event=>{
    if(event.key!=='ArrowLeft' && event.key!=='ArrowRight')return;
    event.preventDefault();turn(event.key==='ArrowLeft'?-1:1);
  });
  syncPage();
  controls.append(arrow(-1,'Предыдущее изображение'),page,arrow(1,'Следующее изображение'));
  gallery.append(track,controls);
  return gallery;
}

// Prime the first photo of the nearby landmarks once the game has finished loading.
export function warmNearbyPhotos(){
  if(navigator.connection?.saveData)return;
  const urls=['salon','garage','reef'].map(id=>photoUrl(notes[id].images[0]));
  const loadNext=()=>{
    if(!urls.length)return;
    const img=new Image();
    img.fetchPriority='low';
    img.onload=img.onerror=loadNext;
    img.src=urls.shift();
  };
  if(window.requestIdleCallback)window.requestIdleCallback(loadNext);
  else window.setTimeout(loadNext,600);
}

function credits(note){
  const details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Источники и иллюстрации';details.append(summary);
  const sources=document.createElement('nav');sources.setAttribute('aria-label','Источники текста');
  for(const [title,url] of note.sources)sources.append(link(title,url));
  details.append(sources);
  const items=document.createElement('ul');
  for(const key of note.images){
    const pic=photos[key],item=document.createElement('li');
    item.append(pic.caption+' — ');
    if(pic.film)item.append(filmCredit+(pic.time?' · '+pic.time:''));
    else item.append(link(pic.author,pic.page),', ',link(pic.license==='Public domain'?'общественное достояние':pic.license,pic.terms),' (уменьшено).');
    items.append(item);
  }
  details.append(items);return details;
}
export function renderFieldNote(dialog,id){
  const note=notes[id],body=dialog.querySelector('.field-body');
  dialog.querySelector('h2').textContent=note.title;
  body.replaceChildren(photoGallery(note.images));
  for(const text of note.paragraphs){
    const p=document.createElement('p');p.textContent=text;body.append(p);
  }
  body.append(credits(note));dialog.scrollTop=0;
}
