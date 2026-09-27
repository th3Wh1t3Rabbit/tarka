const names=new Set(['x-request-id','x-nansen-credits-cost','x-nansen-credits-used','x-nansen-credits-remaining','retry-after','x-nansen-ratelimit-scope',...['ratelimit-','x-ratelimit-'].flatMap(p=>['limit','remaining','reset'].map(s=>p+s)),...['second','minute','credit-fails','credit-fails-minute'].flatMap(s=>['limit','remaining','reset'].map(p=>'x-ratelimit-'+p+'-'+s))])
export function captureSafeHeaders(input,credential=''){
  const output={}
  for(const [name,value]of Object.entries(input)){
    if(!names.has(name))continue
    if(typeof value!=='string'||value.length>128||(credential&&value.includes(credential)))throw new Error('R1_UNSAFE_AUDIT_HEADER')
    const valid=name==='x-request-id'?/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value):name==='x-nansen-ratelimit-scope'?/^[a-z][a-z_-]{0,63}$/.test(value):name==='retry-after'?/^\d+(?:\.\d+)?$/.test(value)||/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d\d (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d\d:\d\d:\d\d GMT$/.test(value):/^\d{1,16}$/.test(value)
    if(!valid)throw new Error('R1_UNSAFE_AUDIT_HEADER')
    output[name]=value
  }
  return output
}
