import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('all broadcast templates declare valid, unique control sections and a slot default',async()=>{
 for(const relative of ['ticker/ticker.html','lower-third/lower-third.html','match-status/shuffling.html','match-status/siding.html']){
  const html=await readFile(new URL('../graphics/'+relative,import.meta.url),'utf8');
  const script=html.match(/window\.SPXGCTemplateDefinition\s*=\s*(\{[\s\S]*?\});/)[1];
  const definition=vm.runInNewContext('('+script+')');
  const fields=new Set(definition.DataFields.map(f=>f.field)),seen=new Set();
  assert.ok(definition.ycsSlot);assert.ok(definition.editorSections.length);
  for(const section of definition.editorSections)for(const field of section.fields){assert.ok(fields.has(field),relative+' unknown '+field);assert.ok(!seen.has(field),relative+' duplicate '+field);seen.add(field);}
  assert.equal(seen.size,fields.size,relative+' missing controls');
 }
});
