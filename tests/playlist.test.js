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
