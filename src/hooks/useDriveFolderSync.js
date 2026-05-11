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
// Key: folder name (lowercase, trimmed). Value: { category, tags }
const FOLDER_META = {
  // Identity subfolders
  'uae':                         { category: 'identity',  tags: ['UAE'] },
  'india':                       { category: 'identity',  tags: ['India'] },
  'usa':                         { category: 'identity',  tags: ['USA'] },
  'family_documents_aj':         { category: 'identity',  tags: ['Anisha', 'Family'] },
  'family_documents_kr':         { category: 'identity',  tags: ['Kedar', 'Family'] },
  'education':                   { category: 'identity',  tags: ['Education', 'Anisha'] },
  'main identity docs - minerva':{ category: 'identity',  tags: ['Kedar', 'Anisha'] },

  // Corporate subfolders
  'ikarma properties llc':       { category: 'corporate', tags: ['Ikarma', 'USA', 'Houston'] },
  'ikarma ventures pte ltd':     { category: 'corporate', tags: ['Ikarma', 'Singapore'] },
  'infinity holdings llc':       { category: 'corporate', tags: ['Infinity', 'USA'] },
  'the kyck limited':            { category: 'corporate', tags: ['KYCK', 'UAE'] },
  'vista trading fzco':          { category: 'corporate', tags: ['Vista', 'UAE'] },

  // Real estate subfolders
  'dubai':                       { category: 'property',  tags: ['Dubai', 'UAE'] },
  '1707 windy meadow':           { category: 'property',  tags: ['Houston', 'SFH', 'USA'] },
  '6626 supply row':             { category: 'property',  tags: ['Houston', 'Warehouse', 'USA'] },

  // Top-level fallbacks
  'identity':                    { category: 'identity',  tags: [] },
  'corporate':                   { category: 'corporate', tags: [] },
  'real estate':                 { category: 'property',  tags: [] },
  'documents':                   { category: 'other',     tags: [] },
  'statements':                  { category: 'statement', tags: [] },
}

function getFolderMeta(folderName) {
  const key = folderName.toLowerCase().trim()
  return FOLDER_META[key] ?? { category: 'other', tags: [folderName] }
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
