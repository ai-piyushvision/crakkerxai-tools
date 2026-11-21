import test from 'node:test';
import assert from 'node:assert/strict';
import {initBrowserGestureGuard} from '../src/browser-gesture-guard.js';

class FakeElement {
  constructor(isScroller=false){this.isScroller=isScroller;}
  closest(){return this.isScroller?{}:null;}
}
class FakeTarget {
  constructor(){this.listeners={};this.style={};}
  addEventListener(type,fn,options){(this.listeners[type]??=[]).push({fn,options});}
  dispatch(type,event){for(const item of this.listeners[type]||[])item.fn(event);}
}
const documentMock=new FakeTarget();
documentMock.documentElement=new FakeTarget();
documentMock.body=new FakeTarget();
const windowMock=new FakeTarget();
windowMock.innerWidth=1200;
globalThis.document=documentMock;
globalThis.window=windowMock;
globalThis.Element=FakeElement;

test('edge horizontal touch gesture is cancelled globally',()=>{
  initBrowserGestureGuard();
  documentMock.dispatch('touchstart',{
    touches:[{clientX:12,clientY:150}],target:new FakeElement()
  });
  let prevented=false,stopped=false;
  documentMock.dispatch('touchmove',{
    touches:[{clientX:52,clientY:154}],target:new FakeElement(),cancelable:true,
    preventDefault(){prevented=true;},stopPropagation(){stopped=true;}
  });
  assert.equal(prevented,true);
  assert.equal(stopped,true);
});

test('page-level horizontal wheel navigation is cancelled',()=>{
  let prevented=false,stopped=false;
  documentMock.dispatch('wheel',{
    deltaX:48,deltaY:2,target:new FakeElement(),cancelable:true,
    preventDefault(){prevented=true;},stopPropagation(){stopped=true;}
  });
  assert.equal(prevented,true);
  assert.equal(stopped,true);
});

test('horizontal file-table scrolling is not cancelled',()=>{
  let prevented=false;
  documentMock.dispatch('wheel',{
    deltaX:48,deltaY:2,target:new FakeElement(true),cancelable:true,
    preventDefault(){prevented=true;},stopPropagation(){}
  });
  assert.equal(prevented,false);
});
