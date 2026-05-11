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
  const h0=String(rows[0]?.[0]||''); const am=h0.match(/\d{6,}/);if(am)r.accountNumber=am[0];const cm=h0.match(/(AED|USD)/);if(cm)r.currency=cm[1]
  const dates=[]
  for(let i=3;i<rows.length;i++){
    const row=rows[i]; if(!row?.[1]) continue
    const date=parseDate(String(row[1])); if(!date) continue
    const amt=parseAmount(row[4]); if(amt===0) continue
    const amount=String(row[7]||'').toLowerCase()==='credit'?amt:-amt
    dates.push(date)
    r.transactions.push({date,description:cleanStr(row[3]||row[2]),amount,currency:cleanStr(row[5])||r.currency,reference:'',balance:parseAmount(row[6])})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1];r.closingBalance=r.transactions[0]?.balance||0}
  return r
}
export function parseENBDCreditCard(rows) {
  const r={accountNumber:null,currency:'AED',openingBalance:0,closingBalance:0,period:null,transactions:[],bankName:'ENBD',accountType:'credit_card'}
  const h0=String(rows[0]?.[0]||''); const cm=h0.match(/\d{6}[*]+\d{4}/);if(cm)r.accountNumber=cm[0]
  const dates=[]
  for(let i=3;i<rows.length;i++){
    const row=rows[i]; if(!row?.[1]) continue
    const date=parseDate(String(row[1])); if(!date) continue
    const amt=parseAmount(row[3]); if(amt===0) continue
    const amount=String(row[5]||'').toLowerCase()==='credit'?amt:-amt
    dates.push(date)
    r.transactions.push({date,description:cleanStr(row[2]),amount,currency:cleanStr(row[4])||'AED',reference:''})
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
    const f=parseCSVLine(line); if(f.length<3) continue
    const date=parseDate(f[0]); if(!date) continue
    const amount=parseAmount(f[f.length-1]); if(amount===0) continue
    dates.push(date)
    r.transactions.push({date,description:cleanStr(f.slice(1,f.length-1).join(' ').replace(/\s+/g,' ')),amount,currency:'AED',reference:''})
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
    const amount=parseAmount(f[f.length-2]); const balance=parseAmount(f[f.length-1]); if(amount===0) continue
    dates.push(date)
    r.transactions.push({date,description:cleanStr(f.slice(1,f.length-2).join(' ').replace(/\s+/g,' ')),amount,currency:'AED',reference:'',balance})
  }
  if(dates.length>0){const s=[...dates].sort();r.period=s[0]+' to '+s[s.length-1];r.closingBalance=r.transactions[0]?.balance||null}
  return r
}
export function parseHSBC(csvText) {
  const first=parseCSVLine(csvLines(csvText)[0]||'')
  const last=first[first.length-1]
  return (first.length>=4&&!parseDate(last)&&parseAmount(last)!==0)?parseHSBCCurrent(csvText):parseHSBCCredit(csvText)
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
    r.transactions.push({date,description:cleanStr(iDesc>=0?f[iDesc]:''+(notes?' - '+notes:'')),amount,currency:r.currency,reference:iRef>=0?cleanStr(f[iRef]):'',balance})
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
  const lines=csvLines(csvText)
  const dates=[]; let firstOpening=null, lastClosing=null
  for(const line of lines){
    const f=parseCSVLine(line); if(f.length<3) continue
    const first=f[0].trim()
    if(first==='opening_balance'){if(firstOpening===null)firstOpening=parseAmount(f[2]);continue}
    if(first==='closing_balance'){lastClosing=parseAmount(f[2]);continue}
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

export function detectBank(text) {
  const u=String(text).toUpperCase().slice(0,500)
  if(u.includes('ADCB')||u.includes('ABU DHABI COMMERCIAL')) return 'ADCB'
  if(u.includes('EMIRATES NBD')||u.includes('101XXXXXXXX')||u.includes('432114')) return 'ENBD'
  if(u.includes('HSBC')) return 'HSBC'
  if(u.includes('WIO')||u.includes('6692353112')||u.includes('AE090860')||u.includes('OPENING_BALANCE')) return 'Wio'
  return null
}

export function parseStatement(csvText,bankOverride=null) {
  const bank=bankOverride??detectBank(csvText)
  const parser=PARSERS[bank]
  if(!parser) return {error:'No parser for: '+(bank||'unknown')+'. Supported: ADCB, ENBD, HSBC, Wio.'}
  return parser(csvText)
}

export function parseStatementRows(rows,bankOverride=null) {
  const bank=bankOverride??detectBank(String(rows[0]?.[0]||''))
  if(bank==='ENBD') return parseENBD(rows)
  return {error:'No row-based parser for: '+(bank||'unknown')}
}
