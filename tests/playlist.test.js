import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapSpxUpdate} from '../graphics/ticker/src/spx-data.js';
import {validatePatch,createDataStore} from '../graphics/ticker/src/data.js';
import {TickerRenderer} from '../graphics/ticker/src/renderer.js';

const story=(id,text=id)=>({id,category:'TCG',topic:'Updates',subtopic:text});
test('SPX story lists preserve identity, take native precedence and reject invalid updates atomically',()=>{
  const items=[story('a','Literal <b>story</b>'),story('b')];
  assert.deepEqual(mapSpxUpdate({f14:JSON.stringify(items),f1:JSON.stringify({tickerItems:[story('other')]})}).patch.tickerItems,items);
  const escaped=JSON.stringify(items).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  assert.deepEqual(mapSpxUpdate({f14:escaped}).patch.tickerItems,items,'classic SPX Play can escape saved JSON once');
  const store=createDataStore({tickerItems:items});
  for(const invalid of ['{}','broken',JSON.stringify([story('same'),story('same')]),JSON.stringify([{subtopic:''}])])assert.throws(()=>store.patch('overrides',mapSpxUpdate({f14:invalid}).patch));
  assert.deepEqual(store.get().tickerItems,items);
  assert.deepEqual(mapSpxUpdate({f14:'[]'}).patch.tickerItems,[]);
  assert.throws(()=>validatePatch({tickerItems:Array.from({length:201},(_,i)=>story(String(i)))}));
});
test('live playlist edits preserve visible stories, offset, transforms and header timing while replacing the unseen tail',()=>{
  const children=[],track={children,style:{transform:'translateX(-90px)'},get lastElementChild(){return children.at(-1);}};
  for(const [index,entry]of [story('a'),story('b'),story('c')].entries())children.push({entry,offsetLeft:index*170,remove(){children.splice(children.indexOf(this),1);}});
  const elements=Object.fromEntries(['logo','bg','date','location','status','round','remaining','right'].map(id=>[id,{classList:{toggle(){}}}]));
  const renderer={track,viewport:{clientWidth:250},offset:-90,paused:false,headerKey:'existing header',headerTimer:45,timing:{delayMs:180},root:{style:{setProperty(){}}},$:id=>elements[id],fitRound(){},data:{tickerItems:[story('a'),story('b'),story('c')]}};
  TickerRenderer.prototype.apply.call(renderer,{tickerItems:[story('x'),story('b','Edited B'),story('c','Edited C')],topicEntryDelayMs:180,headerTransitionMs:180});
  assert.equal(children.length,2);assert.equal(children[1].entry.subtopic,'b','visible text remains untouched');assert.equal(renderer.nextIndex,2,'continue after the visible Story ID');assert.equal(renderer.offset,-90);assert.equal(track.style.transform,'translateX(-90px)');assert.equal(renderer.headerTimer,45);assert.equal(renderer.headerKey,'existing header');assert.equal(renderer.paused,false);
  TickerRenderer.prototype.apply.call(renderer,{tickerItems:[],topicEntryDelayMs:180,headerTransitionMs:180});assert.equal(children.length,2,'an empty playlist drains visible text naturally');assert.equal(renderer.items.length,0);
});

test('the first SPX playlist replaces hidden bootstrap stories and headers before Play',()=>{
  const children=[{entry:story('sample'),offsetLeft:0}],track={children,style:{transform:'translateX(-90px)'},replaceChildren(){children.length=0;},get firstElementChild(){return children[0];}};
  const elements=Object.fromEntries(['logo','bg','date','location','status','round','remaining','right','category','topic','topic-inner'].map(id=>[id,{textContent:'SAMPLE',classList:{toggle(){},remove(){}}}]));
  const headers=[],resets=[];
  const renderer={hasShown:false,track,offset:-90,nextIndex:1,headerKey:'sample',headerTimer:null,timing:{reset:item=>resets.push(item)},root:{style:{setProperty(){}}},$:id=>elements[id],fitRound(){},fillTrack(){if(this.items.length)children.push({entry:this.items[this.nextIndex++]});},setHeader(item,instant){headers.push({item,instant});this.headerKey=item.id;},seedPositions(){this.seeded=true;},data:{tickerItems:[story('sample')]}};
  const fresh=story('mapped','Mapped Orlando story');
  TickerRenderer.prototype.apply.call(renderer,{tickerItems:[fresh],topicEntryDelayMs:180,headerTransitionMs:180});
  assert.deepEqual(children.map(node=>node.entry),[fresh]);
  assert.equal(renderer.offset,0);assert.equal(track.style.transform,'translateX(0px)');
  assert.deepEqual(headers,[{item:fresh,instant:true}]);assert.deepEqual(resets,[null,fresh]);assert.equal(renderer.seeded,true);
  TickerRenderer.prototype.apply.call(renderer,{tickerItems:[],topicEntryDelayMs:180,headerTransitionMs:180});
  assert.equal(children.length,0);assert.equal(elements.category.textContent,'');assert.equal(elements.topic.textContent,'');assert.equal(renderer.headerKey,null);
});
