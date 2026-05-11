// src/hooks/useDriveFolderSync.js
// Scans the Minerva Financials / Documents folder structure on Google Drive
// and populates the Vault with all files found, preserving folder → category mapping.
//
// ROOT FOLDER ID: 1NhDBqwjZN-DsrjhwWF25LdSnQGGET6jT (Minerva Financials)
//
// FOLDER → CATEGORY MAPPING:
//   Documents/Identity/**        → 'identity'
//   Documents/Corporate/**       → 'corporate'
//   Documents/Real Estate/**     → 'property'
//   Statements/**                → 'statement'
//
// SUBFOLDER → TAGS:
//   Identity/UAE                 → ['UAE']
//   Identity/India               → ['India']
//   Identity/USA                 → ['USA']
//   Identity/Family_Documents_AJ → ['Anisha', 'Family']
//   Identity/Family_Documents_KR → ['Kedar', 'Family']
//   Identity/Education           → ['Education']
//   Identity/Main Identity Docs  → ['Kedar', 'Anisha']
//   Corporate/Ikarma Properties  → ['Ikarma', 'USA', 'Houston']
//   Corporate/Ikarma Ventures    → ['Ikarma', 'Singapore']
//   Corporate/Infinity Holdings  → ['Infinity', 'USA']
//   Corporate/The Kyck Limited   → ['KYCK', 'UAE']
//   Corporate/Vista Trading      → ['Vista', 'UAE']
//   Real Estate/Dubai            → ['Dubai', 'UAE']
//   Real Estate/USA/1707 Windy   → ['Houston', 'SFH', 'USA']
//   Real Estate/USA/6626 Supply  → ['Houston', 'Warehouse', 'USA']

import { useCallback, useRef } from 'react'
import { useMinervaStore }     from '../state/store.js'

const ROOT_FOLDER_ID  = '1NhDBqwjZN-DsrjhwWF25LdSnQGGET6jT'
const FOLDER_MIME     = 'application/vnd.google-apps.folder'

// ─── Folder → category + tags map ────────────────────────────────────────────
const FOLDER_META = {
  // ── Identity — UAE ─────────────────────────────────────────────────────────
  'uae':                          { category: 'identity',  tags: ['UAE', '2026'] },
  'india':                        { category: 'identity',  tags: ['India'] },
  'usa':                          { category: 'identity',  tags: ['USA'] },

  // ── Identity — Family KR (Kedar's parents: Ramnath + Mala) ────────────────
  'family_documents_kr':          { category: 'identity',  tags: ['Family', 'Kedar', 'Amma', 'Appa', 'Ramnath', 'Mala', 'Kedar\'s Parents', 'India', 'Identity'] },

  // ── Identity — Family AJ (Anisha's family: Anu Gurung + Rohan Joshi) ──────
  'family_documents_aj':          { category: 'identity',  tags: ['Family', 'Anisha', 'Anu', 'Gurung', 'Rohan', 'Joshi', 'Anisha\'s Family', 'India', 'Identity'] },

  // ── Identity — Education ───────────────────────────────────────────────────
  'education':                    { category: 'identity',  tags: ['Education', 'Anisha', 'Degree'] },

  // ── Identity — Main docs (Kedar, Anisha, Yuvi) ────────────────────────────
  'main identity docs - minerva': { category: 'identity',  tags: ['Kedar', 'Anisha', 'Yuvaan', 'Identity', 'UAE'] },

  // ── Corporate ──────────────────────────────────────────────────────────────
  'ikarma properties llc':        { category: 'corporate', tags: ['Ikarma', 'USA', 'Houston', 'Warehouse', 'Corporate'] },
  'ikarma ventures pte ltd':      { category: 'corporate', tags: ['Ikarma', 'Singapore', 'Corporate'] },
  'infinity holdings llc':        { category: 'corporate', tags: ['Infinity', 'USA', 'Corporate'] },
  'the kyck limited':             { category: 'corporate', tags: ['KYCK', 'UAE', 'Corporate'] },
  'vista trading fzco':           { category: 'corporate', tags: ['Vista', 'UAE', 'Corporate'] },

  // ── Real Estate ────────────────────────────────────────────────────────────
  'dubai':                        { category: 'property',  tags: ['Dubai', 'UAE', 'Villa', 'Property'] },
  '1707 windy meadow':            { category: 'property',  tags: ['Houston', 'SFH', 'USA', 'Property', 'Rental'] },
  '6626 supply row':              { category: 'property',  tags: ['Houston', 'Warehouse', 'USA', 'Property', 'Ikarma'] },

  // ── Top-level fallbacks ────────────────────────────────────────────────────
  'identity':                     { category: 'identity',  tags: ['Identity'] },
  'corporate':                    { category: 'corporate', tags: ['Corporate'] },
  'real estate':                  { category: 'property',  tags: ['Property'] },
  'documents':                    { category: 'other',     tags: [] },
  'statements':                   { category: 'statement', tags: ['2026'] },
}

// ─── Document-level smart tagger ─────────────────────────────────────────────
// Adds additional tags based on the document filename itself
function smartTagsFromTitle(title) {
  const t = (title ?? '').toLowerCase()
  const tags = []

  // People — Kedar household
  if (t.includes('kedar') || t.includes('ramnath'))          tags.push('Kedar')
  if (t.includes('anisha') || t.includes('joshi'))           tags.push('Anisha')
  if (t.includes('yuvi') || t.includes('yuvaan'))            tags.push('Yuvaan')

  // People — Extended KR family
  if (t.includes('ramnath') || t.includes('appa') || t.includes('mala') || t.includes('amma'))
                                                              tags.push('Amma', 'Appa', 'Ramnath', 'Mala')

  // People — Extended AJ family
  if (t.includes('anu') || t.includes('gurung'))             tags.push('Anu', 'Gurung')
  if (t.includes('rohan'))                                   tags.push('Rohan', 'Joshi')

  // Document types
  if (t.includes('passport'))                                tags.push('Passport', 'Identity')
  if (t.includes('emirates id') || t.includes('eid'))       tags.push('Emirates ID', 'Identity', 'UAE')
  if (t.includes('visa'))                                    tags.push('Visa', 'Identity')
  if (t.includes('aadhaar') || t.includes('aadhar'))        tags.push('Aadhaar', 'Identity', 'India')
  if (t.includes('pan'))                                     tags.push('PAN', 'Identity', 'India')
  if (t.includes('birth cert'))                              tags.push('Birth Certificate', 'Identity')
  if (t.includes('marriage'))                                tags.push('Marriage Certificate', 'Identity')
  if (t.includes('degree') || t.includes('diploma'))        tags.push('Education', 'Degree')

  // Banks / institutions
  if (t.includes('adcb'))                                    tags.push('ADCB', 'UAE', 'Banking')
  if (t.includes('hsbc'))                                    tags.push('HSBC', 'Banking')
  if (t.includes('wio'))                                     tags.push('Wio', 'UAE', 'Banking')
  if (t.includes('enbd') || t.includes('emirates nbd'))     tags.push('ENBD', 'UAE', 'Banking')
  if (t.includes('hdfc'))                                    tags.push('HDFC', 'India', 'Banking')
  if (t.includes('axis'))                                    tags.push('Axis Bank', 'India', 'Banking')
  if (t.includes('sbi'))                                     tags.push('SBI', 'India', 'Banking')
  if (t.includes('chase'))                                   tags.push('Chase', 'USA', 'Banking')
  if (t.includes('amex') || t.includes('american express')) tags.push('Amex', 'USA', 'Banking')
  if (t.includes('amazon'))                                  tags.push('Amazon', 'USA', 'Banking')
  if (t.includes('m&t') || t.includes('m and t'))           tags.push('M&T Bank', 'USA', 'Banking')
  if (t.includes('dbs'))                                     tags.push('DBS', 'Singapore', 'Banking')
  if (t.includes('ibkr') || t.includes('interactive'))      tags.push('IBKR', 'Investment', 'USA')

  // Investments
  if (t.includes('fcnr'))                                    tags.push('FCNR', 'Investment', 'India')
  if (t.includes('sblc') || t.includes('lien'))             tags.push('SBLC', 'Legal', 'FCNR')
  if (t.includes('dews'))                                    tags.push('DEWS', 'Investment', 'UAE')
  if (t.includes('realty mogul') || t.includes('reit'))     tags.push('Realty Mogul', 'Investment', 'USA')
  if (t.includes('portfolio'))                               tags.push('Investment', 'Portfolio')

  // Property
  if (t.includes('villa') || t.includes('the villa'))       tags.push('Dubai Villa', 'UAE', 'Property')
  if (t.includes('mortgage'))                                tags.push('Mortgage', 'Property')
  if (t.includes('windy meadow'))                            tags.push('Houston SFH', 'USA', 'Property')
  if (t.includes('supply row'))                              tags.push('Houston Warehouse', 'USA', 'Property')
  if (t.includes('matunga') || t.includes('corner of five'))tags.push('Mumbai', 'India', 'Property')
  if (t.includes('waters edge') || t.includes('pimple'))    tags.push('Pune', 'India', 'Property')
  if (t.includes('darjeeling'))                              tags.push('Darjeeling', 'India', 'Property')
  if (t.includes('bhor') || t.includes('rajghar'))          tags.push('Bhor', 'India', 'Property')

  // Year tags from filename
  const yearMatch = title?.match(/20\d{2}/)
  if (yearMatch) tags.push(yearMatch[0])

  // Month tags
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  months.forEach(m => { if (t.includes(m)) tags.push(m.charAt(0).toUpperCase() + m.slice(1)) })

  return [...new Set(tags)]
}

function getFolderMeta(folderName) {
  const key = folderName.toLowerCase().trim()
  return FOLDER_META[key] ?? { category: 'other', tags: [] }
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function driveRequest(path, token) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  return res.json()
}

async function listFolder(folderId, token) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,createdTime,modifiedTime)')
  const data = await driveRequest(`files?q=${q}&fields=${fields}&pageSize=100`, token)
  return data.files ?? []
}

// ─── Recursive folder scanner ─────────────────────────────────────────────────
// Walks the folder tree, collecting all non-folder files with metadata

async function scanFolder(folderId, token, parentMeta = { category: 'other', tags: [] }, depth = 0) {
  if (depth > 4) return []  // safety guard

  const items = await listFolder(folderId, token)
  const results = []

  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      // It's a subfolder — determine its meta and recurse
      const meta = getFolderMeta(item.name)
      // Inherit parent tags, add subfolder tags
      const mergedMeta = {
        category: meta.category !== 'other' ? meta.category : parentMeta.category,
        tags: [...new Set([...parentMeta.tags, ...meta.tags])],
        folderName: item.name,
      }
      const subResults = await scanFolder(item.id, token, mergedMeta, depth + 1)
      results.push(...subResults)
    } else {
      // It's a file — add to results with inherited metadata
      results.push({
        driveId:   item.id,
        title:     item.name,
        category:  parentMeta.category,
        tags:      parentMeta.tags,
        driveUrl:  item.webViewLink,
        dateAdded: item.createdTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        folder:    parentMeta.folderName ?? '',
      })
    }
  }

  return results
}

// ─── Find Documents subfolder inside root ─────────────────────────────────────

async function findDocumentsFolder(token) {
  const items = await listFolder(ROOT_FOLDER_ID, token)
  const docsFolder = items.find(i => i.mimeType === FOLDER_MIME && i.name === 'Documents')
  return docsFolder?.id ?? null
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useDriveFolderSync() {
  const documents       = useMinervaStore(s => s.documents)
  const addDocument     = useMinervaStore(s => s.addDocument)
  const setSyncStatus   = useMinervaStore(s => s.setSyncStatus)
  const isRunningRef    = useRef(false)

  const syncDocuments = useCallback(async () => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    try {
      setSyncStatus('syncing')

      // Get token from localStorage (set by useDriveSync redirect flow)
      const stored = localStorage.getItem('minerva_drive_token')
      if (!stored) {
        console.warn('[Minerva] Not signed in to Drive — tap Connect Drive first')
        setSyncStatus('idle')
        return
      }
      const { access_token: token, expires_at } = JSON.parse(stored)
      if (!token || Date.now() > expires_at) {
        console.warn('[Minerva] Drive token expired — please sign in again')
        setSyncStatus('idle')
        return
      }

      console.log('[Minerva] Scanning Drive Documents folder…')

      // Documents folder ID (hardcoded for reliability)
      const docsFolderId = '1nhPr-Hh_5ASXflJOYRkizmgNTHlAlIXO'
      console.log('[Minerva] Using Documents folder:', docsFolderId)

      // Scan all files recursively
      const files = await scanFolder(docsFolderId, token, { category: 'other', tags: [] })
      console.log(`[Minerva] Found ${files.length} files in Drive Documents`)

      // Build set of existing Drive IDs to avoid duplicates
      const existingDriveIds = new Set(
        documents
          .filter(d => d.driveId)
          .map(d => d.driveId)
      )
      const existingUrls = new Set(
        documents
          .filter(d => d.driveUrl)
          .map(d => d.driveUrl)
      )

      // Add only new files
      let added = 0
      for (const file of files) {
        if (existingDriveIds.has(file.driveId)) continue
        if (existingUrls.has(file.driveUrl)) continue

        addDocument({
          title:          file.title,
          category:       file.category,
          tags:           file.tags,
          driveUrl:       file.driveUrl,
          driveId:        file.driveId,
          linked_doc_uids: [],
          dateAdded:      file.dateAdded,
        })
        added++
      }

      console.log(`[Minerva] Vault sync complete — ${added} new documents added`)
      setSyncStatus('idle')

    } catch (err) {
      console.error('[Minerva] Drive folder sync failed:', err)
      setSyncStatus('error')
    } finally {
      isRunningRef.current = false
    }
  }, [documents, addDocument, setSyncStatus])

  return { syncDocuments }
}
