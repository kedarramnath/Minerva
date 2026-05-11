// src/hooks/useDriveFolderSync.js
// OFFLINE-FIRST VAULT SYNC
//
// Strategy:
//   - Document metadata saved permanently to localStorage via Zustand.
//   - Vault works fully offline after first sync.
//   - Vault button = merge new files only, never clears existing docs.
//   - On every sync, ALL existing docs get tags re-applied (retag on rule changes).
//   - Token expiry handled gracefully — Vault still works, sync skipped with warning.
//
// FOLDER IDs:
//   Minerva Financials : 1NhDBqwjZN-DsrjhwWF25LdSnQGGET6jT
//   Documents          : 1nhPr-Hh_5ASXflJOYRkizmgNTHlAlIXO

import { useCallback, useRef } from 'react'
import { useMinervaStore }     from '../state/store.js'

const DOCS_FOLDER_ID = '1nhPr-Hh_5ASXflJOYRkizmgNTHlAlIXO'
const FOLDER_MIME    = 'application/vnd.google-apps.folder'

// ─── Folder tags map ──────────────────────────────────────────────────────────
const FOLDER_TAGS = {
  'uae':                          ['UAE'],
  'india':                        ['India'],
  'usa':                          ['USA'],
  'family_documents_kr':          ['Family','Kedar','Amma','Appa','Ramnath','Mala',"Kedar's Parents",'India','Identity'],
  'family_documents_aj':          ['Family','Anisha','Anu','Gurung','Rohan','Joshi',"Anisha's Family",'India','Identity'],
  'education':                    ['Education','Anisha','Degree'],
  'main identity docs - minerva': ['Kedar','Anisha','Yuvaan','Identity','UAE'],
  'ikarma properties llc':        ['Ikarma','USA','Houston','Warehouse','Corporate'],
  'ikarma ventures pte ltd':      ['Ikarma','Singapore','Corporate'],
  'infinity holdings llc':        ['Infinity','USA','Corporate'],
  'the kyck limited':             ['KYCK','UAE','Corporate'],
  'vista trading fzco':           ['Vista','UAE','Corporate'],
  'dubai':                        ['Dubai','UAE','Villa','Property'],
  '1707 windy meadow':            ['Houston','SFH','USA','Property','Rental'],
  '6626 supply row':              ['Houston','Warehouse','USA','Property','Ikarma'],
  'statements':                   ['Statement','2026'],
  'chase':                        ['Chase','USA','Banking','Statement'],
  'amex':                         ['Amex','USA','Banking','Statement'],
  'amazon cc':                    ['Amazon','USA','Banking','Statement'],
  'ibkr':                         ['IBKR','Investment','USA','Statement'],
  'adcb':                         ['ADCB','UAE','Banking','Statement'],
  'hsbc':                         ['HSBC','Banking','Statement'],
  'wio':                          ['Wio','UAE','Banking','Statement'],
  'hdfc':                         ['HDFC','India','Banking','Statement'],
}

// ─── Smart tagger (exported so Documents UI can also use it) ──────────────────
export function smartTagsFromTitle(title) {
  const t    = (title ?? '').toLowerCase()
  const tags = []

  // People
  if (t.includes('kedar'))                                    tags.push('Kedar')
  if (t.includes('anisha'))                                   tags.push('Anisha')
  if (t.includes('yuvi') || t.includes('yuvaan'))            tags.push('Yuvaan')
  if (t.includes('ramnath') || t.includes('appa'))           tags.push('Appa','Ramnath',"Kedar's Parents")
  if (t.includes('mala') || t.includes('amma'))              tags.push('Amma','Mala',"Kedar's Parents")
  if (t.includes('anu') || t.includes('gurung'))             tags.push('Anu','Gurung',"Anisha's Family")
  if (t.includes('rohan') || t.includes('joshi'))            tags.push('Rohan','Joshi',"Anisha's Family")

  // Document types
  if (t.includes('passport'))                                 tags.push('Passport','Identity')
  if (t.includes('emirates id') || t.includes(' eid'))       tags.push('Emirates ID','Identity','UAE')
  if (t.includes('visa'))                                     tags.push('Visa','Identity')
  if (t.includes('aadhaar') || t.includes('aadhar'))         tags.push('Aadhaar','Identity','India')
  if (t.includes('pan card') || t.includes('pan.'))          tags.push('PAN','Identity','India')
  if (t.includes('birth cert'))                               tags.push('Birth Certificate','Identity')
  if (t.includes('marriage cert'))                            tags.push('Marriage Certificate','Identity')
  if (t.includes('degree') || t.includes('diploma'))         tags.push('Education','Degree')
  if (t.includes('statement'))                                tags.push('Statement')
  if (t.includes('agreement'))                                tags.push('Agreement','Legal')
  if (t.includes('mortgage'))                                 tags.push('Mortgage','Property')
  if (t.includes('sblc') || t.includes('lien'))              tags.push('SBLC','Legal','FCNR')
  if (t.includes('valuation'))                                tags.push('Valuation','Property')
  if (t.includes('insurance'))                                tags.push('Insurance','Legal')
  if (t.includes('title deed') || t.includes('oqood'))       tags.push('Title Deed','Property')
  if (t.includes('possession'))                               tags.push('Possession','Property')
  if (t.includes('shareholders'))                             tags.push('Shareholders','Corporate')

  // Banks
  if (t.includes('adcb'))                                     tags.push('ADCB','UAE','Banking')
  if (t.includes('hsbc'))                                     tags.push('HSBC','Banking')
  if (t.includes('wio'))                                      tags.push('Wio','UAE','Banking')
  if (t.includes('enbd') || t.includes('emirates nbd'))      tags.push('ENBD','UAE','Banking')
  if (t.includes('hdfc'))                                     tags.push('HDFC','India','Banking')
  if (t.includes('axis bank') || t.includes('axis nro'))     tags.push('Axis Bank','India','Banking')
  if (t.includes('sbi'))                                      tags.push('SBI','India','Banking')
  if (t.includes('chase'))                                    tags.push('Chase','USA','Banking')
  if (t.includes('amex') || t.includes('american express'))  tags.push('Amex','USA','Banking')
  if (t.includes('amazon'))                                   tags.push('Amazon','USA','Banking')
  if (t.includes('m&t') || t.includes('m and t'))            tags.push('M&T Bank','USA','Banking')
  if (t.includes('dbs'))                                      tags.push('DBS','Singapore','Banking')
  if (t.includes('ibkr') || t.includes('interactive broker'))tags.push('IBKR','Investment','USA')
  if (t.includes('airwallex'))                                tags.push('Airwallex','Singapore','Banking')

  // Investments
  if (t.includes('fcnr'))                                     tags.push('FCNR','Investment','India')
  if (t.includes('dews'))                                     tags.push('DEWS','Investment','UAE')
  if (t.includes('realty mogul') || t.includes('reit'))      tags.push('Realty Mogul','Investment','USA')
  if (t.includes('portfolio'))                                tags.push('Investment','Portfolio')
  if (t.includes('franklin'))                                 tags.push('Franklin','Investment','ADCB')
  if (t.includes('blackrock'))                                tags.push('BlackRock','Investment','ADCB')

  // Properties
  if (t.includes('villa') || t.includes('villa centro'))     tags.push('Dubai Villa','UAE','Property')
  if (t.includes('windy meadow'))                             tags.push('Houston SFH','USA','Property')
  if (t.includes('supply row'))                               tags.push('Houston Warehouse','USA','Property')
  if (t.includes('matunga') || t.includes('corner of five')) tags.push('Mumbai','India','Property')
  if (t.includes('waters edge') || t.includes('pimple'))     tags.push('Pune','India','Property')
  if (t.includes('darjeeling'))                               tags.push('Darjeeling','India','Property')
  if (t.includes('bhor') || t.includes('rajghar'))           tags.push('Bhor','India','Property')

  // Corporate
  if (t.includes('ikarma'))                                   tags.push('Ikarma','Corporate')
  if (t.includes('kyck'))                                     tags.push('KYCK','Corporate','UAE')
  if (t.includes('infinity'))                                 tags.push('Infinity','Corporate','USA')
  if (t.includes('vista trading'))                            tags.push('Vista','Corporate','UAE')
  if (t.includes('montfort'))                                 tags.push('Montfort','Corporate','UAE')

  // Year + month
  const yr = title?.match(/20\d{2}/)
  if (yr) tags.push(yr[0])
  ;['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].forEach(m => {
    if (t.includes(m)) tags.push(m[0].toUpperCase() + m.slice(1))
  })

  return [...new Set(tags)]
}

// ─── Drive API ────────────────────────────────────────────────────────────────

async function listFolder(folderId, token) {
  const q      = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,createdTime)')
  const res    = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Drive ${res.status}`)
  return (await res.json()).files ?? []
}

async function scanFolder(folderId, token, parentTags = [], depth = 0) {
  if (depth > 5) return []
  const items   = await listFolder(folderId, token)
  const results = []
  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      const ft     = FOLDER_TAGS[item.name.toLowerCase().trim()] ?? []
      const merged = [...new Set([...parentTags, ...ft])]
      results.push(...await scanFolder(item.id, token, merged, depth + 1))
    } else {
      const titleTags = smartTagsFromTitle(item.name)
      results.push({
        driveId:   item.id,
        title:     item.name,
        tags:      [...new Set([...parentTags, ...titleTags])],
        driveUrl:  item.webViewLink,
        dateAdded: item.createdTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      })
    }
  }
  return results
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useDriveFolderSync() {
  const setSyncStatus = useMinervaStore(s => s.setSyncStatus)
  const isRunningRef  = useRef(false)

  const syncDocuments = useCallback(async () => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    try {
      // ── Token check — graceful degradation ───────────────────────────────────
      const stored = localStorage.getItem('minerva_drive_token')
      if (!stored) {
        console.log('[Minerva] Vault: working offline (not signed in)')
        setSyncStatus('idle')
        isRunningRef.current = false
        return
      }
      const { access_token: token, expires_at } = JSON.parse(stored)
      if (!token || Date.now() > expires_at) {
        console.log('[Minerva] Vault: working offline (token expired — tap Connect Drive to sync new files)')
        setSyncStatus('idle')
        isRunningRef.current = false
        return
      }

      setSyncStatus('syncing')
      console.log('[Minerva] Vault: syncing from Drive…')

      // ── Scan Drive ───────────────────────────────────────────────────────────
      const driveFiles = await scanFolder(DOCS_FOLDER_ID, token)
      console.log(`[Minerva] Vault: found ${driveFiles.length} files`)

      // ── Merge into store ──────────────────────────────────────────────────────
      const currentDocs = useMinervaStore.getState().documents
      const byDriveId   = new Map(currentDocs.filter(d => d.driveId).map(d => [d.driveId, d]))
      const byDriveUrl  = new Map(currentDocs.filter(d => d.driveUrl).map(d => [d.driveUrl, d]))

      let added = 0, retagged = 0
      const updatedDocs = [...currentDocs]

      for (const file of driveFiles) {
        const existing = byDriveId.get(file.driveId) ?? byDriveUrl.get(file.driveUrl)

        if (existing) {
          // Retag: merge new auto-tags with any custom tags user added manually
          const customTags = (existing.tags ?? []).filter(t => !file.tags.includes(t))
          const merged     = [...new Set([...file.tags, ...customTags])]
          const idx        = updatedDocs.findIndex(d => d.id === existing.id)
          if (idx >= 0) {
            updatedDocs[idx] = { ...existing, tags: merged, driveId: file.driveId }
            retagged++
          }
        } else {
          // New file
          updatedDocs.push({
            id:              `doc_${file.driveId}`,
            title:           file.title,
            tags:            file.tags,
            driveUrl:        file.driveUrl,
            driveId:         file.driveId,
            dateAdded:       file.dateAdded,
            linked_doc_uids: [],
            pinned:          false,
          })
          added++
        }
      }

      useMinervaStore.setState({ documents: updatedDocs })
      console.log(`[Minerva] Vault: ${added} new, ${retagged} retagged`)
      setSyncStatus('idle')

    } catch (err) {
      console.error('[Minerva] Vault sync error:', err)
      setSyncStatus('error')
    } finally {
      isRunningRef.current = false
    }
  }, [setSyncStatus])

  return { syncDocuments }
}
