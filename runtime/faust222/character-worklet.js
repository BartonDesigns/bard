/* Bard Character 222 AudioWorklet host. MIT. The DSP is compiled Faust WASM. */
class BardCharacter222Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.closed = false;
    this.failed = false;
    this.quiet = 0;
    const { module, meta, values } = options.processorOptions;
    const wasm = new WebAssembly.Instance(module, { env: {
      _powf: Math.pow, _sinf: Math.sin, _tanf: Math.tan, _tanhf: Math.tanh
    } });
    this.api = wasm.exports;
    this.meta = meta;
    const block = 2048;
    this.inPtr = (meta.size+15)&~15;
    this.outPtr = this.inPtr+8;
    const start = this.outPtr+8;
    const required = start+4*block*4;
    if (this.api.memory.buffer.byteLength < required) {
      this.api.memory.grow(Math.ceil((required-this.api.memory.buffer.byteLength)/65536));
    }
    const ptrs = new Int32Array(this.api.memory.buffer);
    this.ins=[]; this.outs=[];
    for (let c=0;c<2;c++) {
      const ip=start+c*block*4, op=start+(c+2)*block*4;
      ptrs[(this.inPtr>>2)+c]=ip;
      ptrs[(this.outPtr>>2)+c]=op;
      this.ins.push(new Float32Array(this.api.memory.buffer,ip,block));
      this.outs.push(new Float32Array(this.api.memory.buffer,op,block));
    }
    this.controls={};
    const visit=items=>items.forEach(item=>item.items?visit(item.items):this.controls[item.label]=item);
    visit(meta.ui);
    this.api.init(0,sampleRate);
    this.set(values || {});
    // Settle smoothed controls in silence before the dry/wet crossfade.
    for(let k=0;k<4;k++) this.api.compute(0,2048,this.inPtr,this.outPtr);
    this.port.onmessage=event=>{
      if(event.data.type==='dispose'){ this.closed=true; return; }
      if(event.data.type==='params') this.set(event.data.values);
    };
    this.port.postMessage({type:'ready',compiler:meta.version});
  }
  set(values) {
    for (const [name,value] of Object.entries(values || {})) {
      const spec=this.controls[name];
      if (spec && Number.isFinite(value)) this.api.setParamValue(0,spec.index,Math.min(spec.max,Math.max(spec.min,value)));
    }
  }
  process(inputs,outputs) {
    if(this.closed) return false;
    const output=outputs[0], input=inputs[0];
    if(!output || !output.length) return true;
    const frames=output[0].length;
    if(this.failed || frames>2048){output.forEach(ch=>ch.fill(0));return true;}
    try {
      let peak=0;
      for(let c=0;c<2;c++) {
        const source=input && (input[c] || input[0]);
        if(source) {
          this.ins[c].set(source);
          for(let n=0;n<frames;n++) peak=Math.max(peak,Math.abs(source[n]));
        } else this.ins[c].fill(0,0,frames);
      }
      this.quiet=peak<1e-9?this.quiet+frames:0;
      if(this.quiet>8192){output.forEach(ch=>ch.fill(0));return true;}
      this.api.compute(0,frames,this.inPtr,this.outPtr);
      for(let c=0;c<output.length;c++) {
        const source=this.outs[Math.min(c,1)];
        for(let n=0;n<frames;n++) {
          const value=source[n];
          if(!Number.isFinite(value))throw Error('Non-finite DSP output');
          output[c][n]=value;
        }
      }
    } catch(error) {
      this.failed=true; output.forEach(ch=>ch.fill(0));
      this.port.postMessage({type:'failed',message:String(error && error.message || error)});
    }
    return true;
  }
}
registerProcessor('bard-character-222',BardCharacter222Processor);
