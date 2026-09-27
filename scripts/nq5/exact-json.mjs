// Numeric facts retain their original JSON lexemes; Number is never used for amounts.
export function parseExactJson(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  let i = 0
  const ws = () => { while (i < text.length && /[\t\n\r ]/.test(text[i])) i++ }
  const string = () => {
    const start = i++
    while (i < text.length) { if (text[i++] === '"') return JSON.parse(text.slice(start, i)); if (text[i - 1] === '\\') i++ }
    throw new Error('Invalid exact JSON string.')
  }
  const value = (depth = 0) => {
    if (depth > 128) throw new Error('Exact JSON nesting bound exceeded.')
    ws()
    if (text[i] === '"') return string()
    if (text[i] === '{') {
      i++; ws(); const object = {}
      if (text[i] === '}') { i++; return object }
      for (;;) {
        ws(); if (text[i] !== '"') throw new Error('Invalid exact JSON key.')
        const key = string(); if (Object.hasOwn(object, key)) throw new Error('Duplicate exact JSON key.')
        ws(); if (text[i++] !== ':') throw new Error('Invalid exact JSON separator.')
        Object.defineProperty(object, key, { value: value(depth + 1), enumerable: true, writable: true, configurable: true }); ws()
        if (text[i] === '}') { i++; return object }
        if (text[i++] !== ',') throw new Error('Invalid exact JSON object.')
      }
    }
    if (text[i] === '[') {
      i++; ws(); const array = []
      if (text[i] === ']') { i++; return array }
      for (;;) { array.push(value(depth + 1)); ws(); if (text[i] === ']') { i++; return array }; if (text[i++] !== ',') throw new Error('Invalid exact JSON array.') }
    }
    for (const [word, result] of [['true', true], ['false', false], ['null', null]]) if (text.slice(i).startsWith(word)) { i += word.length; return result }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))
    if (!match) throw new Error('Invalid exact JSON value.')
    i += match[0].length; return match[0]
  }
  const result = value(); ws(); if (i !== text.length) throw new Error('Trailing exact JSON data.'); return result
}

export function decimalLexeme(value) {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) throw new Error('Exact decimal lexeme required.')
  const [mantissa, exponentText = '0'] = value.toLowerCase().split('e')
  const exponent = Number(exponentText)
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000) throw new Error('Decimal exponent bound exceeded.')
  const negative = mantissa.startsWith('-'), unsigned = negative ? mantissa.slice(1) : mantissa
  const [whole, fraction = ''] = unsigned.split('.'), digits = whole + fraction, position = whole.length + exponent
  const expanded = position <= 0 ? `0.${'0'.repeat(-position)}${digits}` : position >= digits.length ? digits + '0'.repeat(position - digits.length) : `${digits.slice(0, position)}.${digits.slice(position)}`
  const normalized = expanded.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return negative && /[1-9]/.test(normalized) ? `-${normalized}` : normalized
}
