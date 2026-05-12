// src/utils/statementParsers.js
// All UAE bank parsers: ADCB (CSV), ENBD (XLSX), HSBC (CSV), Wio Current (CSV), Wio Credit (CSV)

function parseAmount(str) {
  if (!str && str !== 0) return 0
  return parseFloat(String(str).replace(/,/g,'').replace(/"/g,'').replace(/\s/g,'')) || 0
}
function parseDate(str) {
  if (!str) return null
  const s = String(str).trim()
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return dmy[3]+'-'+dmy[2].padStart(2,'0')+'-'+dmy[1].padStart(2,'0')
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10)
  return null
}
function cleanStr(str) { return String(str||'').replace(/"/g,'').trim() }
function parseCSVLine(line) {
  const fields=[]; let cur='', inQ=false
  for (const ch of (line+',')) {
    if (ch==='"') inQ=!inQ
    else if (ch===',' && !inQ) { fields.push(cur.trim()); cur='' }
    else cur+=ch
  }
  return fields
}
function csvLines(text) { return text.split('\n').map(l=>l.trim()).filter(Boolean) }

// ── ADCB CSV ──────────────────────────────────────────────────────────────────
export function parseADCB(csvText) {
  const r={accountNumber:null,currency:'AED',openingBalance:0,closingBalance:0,period:null,transactions:[],bankName:'ADCB',accountType:'current'}
  const lines=csvLines(csvText); let start=-1
  for (let i=0;i<Math.min(15,lines.length);i++) {
    const l=lines[i]
    if(l.includes('Account Number')){const m=l.match(/(\d{10,})/);if(m)r.accountNumber=m[1];const c=l.match(/(AED|USD|INR|SGD)/);if(c)r.currency=c[1]}
    if(l.includes('Statement Period')){const ds=l.match(/(\d{2}\/\d{2}\/\d{4})/g);if(ds?.length>=2)r.period=parseDate(ds[0])+' to '+parseDate(ds[1])}
    if(l.includes('Opening Balance')){const m=l.match(/([-\d,\.]+)/);if(m)r.openingBalance=parseAmount(m[1])}
    if(l.includes('Closing Balance')){const m=l.match(/([-\d,\.]+)/);if(m)r.closingBalance=parseAmount(m[1])}
    if(l.includes('Posting Date')&&l.includes('Description')){start=i+1;break}
  }
  if(start===-1) return {...r,error:'Could not find transaction data'}
  for(let i=start;i<lines.length;i++){
    const f=parseCSVLine(lines[i]); if(f.length<6) continue
    const date=parseDate(f[0]); if(!date) continue
    const amount=parseAmount(f[5])>0?parseAmount(f[5]):-parseAmount(f[4]); if(amount===0) continue
    r.transactions.push({date,description:cleanStr(f[3]),amount,currency:r.currency,reference:cleanStr(f[2])})
  }
  return r
}

// ── ENBD XLSX rows ────────────────────────────────────────────────────────────
export function parseENBDCurrent(rows) {
  const r={accountNumber:null,currency:'AED',openingBalance:null,closingBalance:null,period:null,transactions:[],bankName:'ENBD',accountType:'current'}
  const h0=String(rows[0]?.[0]||''); const am=h0.match(/\d{6,}/); if(am) r.accountNumber=am[0]
  r.currency='AED'
  // Row 4+ = data. Columns: Date(0), Details(1), Description(2), Amount(3), Currency(4), Balance(5), DC(6)
  const dates=[]
  for(let i=4;i<rows.length;i++){
    const row=rows[i]; if(!row?.[0]) continue
    const rawDate=String(row[0]||'').trim()
    let date=null
    if(rawDate){ const d=new Date(rawDate); if(!isNaN(d)) date=d.toISOString().slice(0,10) }
    if(!date) continue
    const amt=parseAmount(row[3]); if(amt===0) continue
    const dc=String(row[6]||'').toLowerCase()
    const amount=dc==='credit'?amt:-amt
    const txnCur=cleanStr(row[4])||'AED'
    const bal=parseAmount(row[5])
    const desc=cleanStr(row[2]||row[1])
    dates.push(date)
    r.transactions.push({date,description:desc,amount,currency:txnCur,reference:'',balance:bal})
  }
  if(dates.length>0){
    const s=[...dates].sort()
    r.period=s[0]+' to '+s[s.length-1]
    r.closingBalance=r.transactions[0]?.balance??null
    const oldest=r.transactions[r.transactions.length-1]
    if(oldest && oldest.currency==='AED') r.openingBalance=oldest.balance-oldest.amount
  }
  return r
}
export function parseENBDCreditCard(rows) {
  const r={accountNumber:null,currency:'AED',openingBalance:0,closingBalance:0,period:null,transactions:[],bankName:'ENBD',accountType:'credit_card'}
  const h0=String(rows[0]?.[0]||''); const cm=h0.match(/\d{6}[*]+\d{4}/);if(cm)r.accountNumber=cm[0]
  // Row 0=card header, Row 1-2=empty, Row 3=column headers, Row 4+=data
  // Columns: Date(0), Details(1), Amount(2), Currency(3), Debit/Credit(4), Status(5)
  const dates=[]
  for(let i=4;i<rows.length;i++){
    const row=rows[i]; if(!row?.[0]) continue
    // Handle both 'May 11, 2026' (full) and 'Apr 28, 2026' (abbreviated)
    const rawDate = String(row[0]||'').trim()
    let date = null
    if (rawDate) {
      const d = new Date(rawDate)
      if (!isNaN(d)) date = d.toISOString().slice(0,10)
    }
    if (!date) continue
    const amt=parseAmount(row[2]); if(amt===0) continue
    const dc=String(row[4]||'').toLowerCase()
    const amount=dc==='credit'?amt:-amt
    dates.push(date)
    r.transactions.push({date,description:cleanStr(row[1]),amount,currency:cleanStr(row[3])||'AED',reference:''})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1]}
  return r
}
export function parseENBD(rows) {
  return String(rows[0]?.[0]||'').toLowerCase().includes('card')?parseENBDCreditCard(rows):parseENBDCurrent(rows)
}

// ── HSBC CSV ──────────────────────────────────────────────────────────────────
export function parseHSBCCredit(csvText) {
  const r={accountNumber:'HSBC-CC',currency:'AED',openingBalance:null,closingBalance:null,period:null,transactions:[],bankName:'HSBC',accountType:'credit_card'}
  const dates=[]
  for(const line of csvLines(csvText)){
    const f=parseCSVLine(line); if(f.length<2) continue
    const date=parseDate(f[0]); if(!date) continue
    // Last field is amount (can be negative like -36.00 or positive like 174.44)
    const amtStr = f[f.length-1]
    const amount = parseAmount(amtStr)
    if(amount===0) continue
    // Everything between date and amount is description
    const desc = f.length > 2 ? f.slice(1,f.length-1).join(' ').replace(/\s+/g,' ') : ''
    dates.push(date)
    r.transactions.push({date,description:cleanStr(desc),amount,currency:'AED',reference:''})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1]}
  return r
}
export function parseHSBCCurrent(csvText) {
  const r={accountNumber:'HSBC-Current',currency:'AED',openingBalance:null,closingBalance:null,period:null,transactions:[],bankName:'HSBC',accountType:'current'}
  const dates=[]
  for(const line of csvLines(csvText)){
    const f=parseCSVLine(line); if(f.length<3) continue
    const date=parseDate(f[0]); if(!date) continue
    // Field layout: date, description..., amount, balance
    // Amount is second-to-last, balance is last
    const balance = parseAmount(f[f.length-1])
    const amount  = parseAmount(f[f.length-2])
    if(amount===0 && balance===0) continue
    const desc = f.slice(1, f.length-2).join(' ').replace(/\s+/g,' ')
    dates.push(date)
    r.transactions.push({date,description:cleanStr(desc),amount,currency:'AED',reference:'',balance})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1];r.closingBalance=r.transactions[0]?.balance||null}
  return r
}
export function parseHSBC(csvText) {
  // HSBC Current has 4 fields: date, description, amount, balance
  // HSBC Credit has 3 fields: date, description, amount (no balance column)
  // Use parseCSVLine to handle quoted fields correctly
  const first = parseCSVLine(csvLines(csvText)[0] || '')
  // If 4+ fields and last field looks like a running balance (positive number)
  const last = first[first.length - 1]
  const lastNum = parseAmount(last)
  const isCurrent = first.length >= 4 && lastNum > 0 && !parseDate(last)
  return isCurrent ? parseHSBCCurrent(csvText) : parseHSBCCredit(csvText)
}

// ── Wio Current CSV ───────────────────────────────────────────────────────────
export function parseWioCurrent(csvText) {
  const r={accountNumber:null,currency:'AED',openingBalance:null,closingBalance:null,period:null,transactions:[],bankName:'Wio',accountType:'current'}
  const lines=csvLines(csvText); if(lines.length<2) return r
  const headers=parseCSVLine(lines[0]).map(h=>h.toLowerCase().trim())
  const col=(n)=>headers.indexOf(n)
  const iAcc=col('account number'),iCur=col('account currency'),iDate=col('date')
  const iDesc=col('description'),iAmt=col('amount'),iBal=col('balance')
  const iNotes=col('notes'),iRef=col('ref. number')
  // Wio CSV has 14 columns, all properly quoted — parseCSVLine handles this correctly
  const dates=[]
  for(let i=1;i<lines.length;i++){
    const f=parseCSVLine(lines[i])
    if(!r.accountNumber&&iAcc>=0) r.accountNumber=cleanStr(f[iAcc])
    if(iCur>=0) r.currency=cleanStr(f[iCur])||'AED'
    const date=iDate>=0?f[iDate]?.slice(0,10):null; if(!date) continue
    const amount=iAmt>=0?parseAmount(f[iAmt]):0; if(amount===0) continue
    const balance=iBal>=0?parseAmount(f[iBal]):0
    const notes=iNotes>=0?cleanStr(f[iNotes]):''
    dates.push(date)
    const baseDesc = iDesc>=0 ? cleanStr(f[iDesc]) : ''
    const fullDesc  = baseDesc + (notes && notes !== 'N/A' ? ' — ' + notes : '')
    r.transactions.push({date,description:fullDesc,amount,currency:r.currency,reference:iRef>=0?cleanStr(f[iRef]):'',balance})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1];r.closingBalance=r.transactions[r.transactions.length-1]?.balance||null}
  return r
}

// ── Wio Credit Card CSV ───────────────────────────────────────────────────────
// Multi-month file. No header row.
// opening_balance,YYYY-MM,amount,AED
// YYYY-MM-DD,description,amount,AED,debit|credit
// closing_balance,YYYY-MM,amount,AED
export function parseWioCredit(csvText) {
  const r={accountNumber:'wio-cc-kedar',currency:'AED',openingBalance:null,closingBalance:null,period:null,transactions:[],bankName:'Wio',accountType:'credit_card'}
  // File uses space as delimiter between records within lines — split by date pattern
  const text = csvText.replace(/\r/g,'')
  const records = text.split(/(?=\d{4}-\d{2}-\d{2},)|(?=opening_balance,)|(?=closing_balance,)/).map(s=>s.trim()).filter(Boolean)
  const dates=[]; let firstOpening=null, lastClosing=null
  for(const rec of records){
    const f=parseCSVLine(rec); if(f.length<3) continue
    const first=f[0].trim()
    if(first==='opening_balance'){if(firstOpening===null)firstOpening=parseAmount(f[2]);continue}
    if(first==='closing_balance'){lastClosing=parseAmount((f[2]||'').split(/\s/)[0]);continue}
    const date=first.match(/^\d{4}-\d{2}-\d{2}/)?first.slice(0,10):null; if(!date) continue
    const amt=parseAmount(f[2]); if(amt===0) continue
    const amount=(f[4]||'').trim().toLowerCase()==='credit'?amt:-amt
    dates.push(date)
    r.transactions.push({date,description:cleanStr(f[1]),amount,currency:'AED',reference:''})
  }
  r.openingBalance=firstOpening??0
  r.closingBalance=lastClosing??0
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1]}
  return r
}

// ── Wio auto-detect ───────────────────────────────────────────────────────────
export function parseWio(csvText) {
  const first=(csvLines(csvText)[0]||'').toLowerCase()
  return first.startsWith('account name')||first.startsWith('account number')
    ?parseWioCurrent(csvText):parseWioCredit(csvText)
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const PARSERS={ADCB:parseADCB,ENBD:parseENBD,HSBC:parseHSBC,Wio:parseWio}

export const ACCOUNT_NUMBER_MAP={
  '13091504920001':'adcb-consolidated-kedar',
  '13091504920003':'adcb-investment-kedar',
  '13091504910001':'adcb-usd-savings',
  '432114******3375':'enbd-cc-kedar',
  '101XXXXXXXX01':'enbd-current-kedar',
  'HSBC-Current':'hsbc-current-kedar',
  'HSBC-CC':'hsbc-cc-kedar',
  '6692353112':'wio-current-kedar',
  'wio-cc-kedar':'wio-cc-kedar',
}

export function detectBank(text, filename) {
  const fn = (filename || '').toUpperCase()

  // Filename always wins — most reliable
  if (fn.includes('HSBC'))                                    return 'HSBC'
  if (fn.includes('WIO'))                                     return 'Wio'
  if (fn.includes('ADCB'))                                    return 'ADCB'
  if (fn.includes('NBD') || fn.includes('ENBD'))              return 'ENBD'
  if (fn.includes('TRANSACTION') || fn.includes('TRANS'))     return 'ENBD'

  // Content-based — only check first 200 chars to avoid false matches in descriptions
  const u = String(text).toUpperCase().slice(0, 200)
  if (u.includes('ADCB') || u.includes('13091504') || u.includes('POSTING DATE')) return 'ADCB'
  if (u.includes('EMIRATES NBD') || u.includes('101XXXXXXXX') || u.includes('432114')) return 'ENBD'
  if (u.includes('HSBC'))                                     return 'HSBC'
  // Wio: only match on account number or IBAN, not on "Wio Bank" in descriptions
  if (u.includes('6692353112') || u.includes('AE090860') || u.includes('ACCOUNT NAME,ACCOUNT TYPE')) return 'Wio'

  // Pattern: starts with opening_balance = Wio Credit
  if (text.trim().startsWith('opening_balance,'))             return 'Wio'
  // Pattern: DD/MM/YYYY, description, amount = HSBC (no header)
  if (/^\d{2}\/\d{2}\/\d{4},/.test(text.trim()))          return 'HSBC'

  return null
}

export function parseStatement(csvText, bankOverride=null, filename='') {
  const bank = bankOverride ?? detectBank(csvText, filename)
  const parser = PARSERS[bank]
  if (!parser) return { error: 'No parser for: ' + (bank || 'unknown') + '. Supported: ADCB, ENBD, HSBC, Wio.' }
  return parser(csvText)
}

export function parseStatementRows(rows, bankOverride=null, filename='') {
  const bank = bankOverride ?? detectBank(String(rows[0]?.[0] || ''), filename)
  if (bank === 'ENBD') return parseENBD(rows)
  return { error: 'No row-based parser for: ' + (bank || 'unknown') }
}
