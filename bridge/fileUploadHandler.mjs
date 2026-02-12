/**
 * File Upload Handler - Process uploaded files and ZIP archives
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'
import AdmZip from 'adm-zip'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_FILES = 1000
const MAX_ZIP_SIZE = 100 * 1024 * 1024 // 100MB

/**
 * Validate that uploaded content is a project
 */
export function validateProject(files) {
  const filenames = files.map(f => f.originalname || f.filename || f.name)
  
  // Check for common project indicators
  const hasPackageJson = filenames.some(f => f.endsWith('package.json'))
  const hasReadme = filenames.some(f => /readme\.md$/i.test(f))
  const hasSourceCode = filenames.some(f => /\.(js|ts|jsx|tsx|py|go|rs|java|c|cpp)$/i.test(f))
  
  if (!hasPackageJson && !hasReadme && !hasSourceCode) {
    throw new Error('Upload does not appear to be a valid project. Expected package.json, README.md, or source code files.')
  }
  
  return true
}

/**
 * Extract a ZIP file to a temporary directory
 */
export async function extractZipToTemp(zipBuffer, projectName) {
  const tempDir = path.join(os.tmpdir(), `upload-${Date.now()}-${projectName.replace(/[^a-z0-9]/gi, '-')}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  try {
    console.log(`[FileUpload] Extracting ZIP to ${tempDir}`)
    
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()
    
    if (entries.length > MAX_FILES) {
      throw new Error(`ZIP contains too many files (${entries.length}). Maximum allowed: ${MAX_FILES}`)
    }
    
    let totalSize = 0
    const extractedFiles = []
    
    for (const entry of entries) {
      // Skip directories and hidden files
      if (entry.isDirectory) continue
      if (entry.entryName.split(path.sep).some(part => part.startsWith('.'))) {
        continue
      }
      
      // Skip common bloat directories
      const skipDirs = ['node_modules', '__pycache__', '.git', 'vendor', 'build', 'dist']
      if (skipDirs.some(dir => entry.entryName.includes(`${dir}/`))) {
        continue
      }
      
      totalSize += entry.header.size
      if (totalSize > MAX_ZIP_SIZE) {
        throw new Error(`Extracted size exceeds maximum (${MAX_ZIP_SIZE / 1024 / 1024}MB)`)
      }
      
      // Extract file
      const targetPath = path.join(tempDir, entry.entryName)
      const dir = path.dirname(targetPath)
      
      await fs.mkdir(dir, { recursive: true })
      
      try {
        const content = entry.getData()
        await fs.writeFile(targetPath, content)
        extractedFiles.push({
          path: entry.entryName,
          originalname: entry.entryName,
          size: entry.header.size
        })
      } catch (err) {
        console.warn(`[FileUpload] Failed to extract ${entry.entryName}: ${err.message}`)
      }
    }
    
    console.log(`[FileUpload] Extracted ${extractedFiles.length} files from ZIP`)
    
    // Validate extracted project
    validateProject(extractedFiles)
    
    return {
      tempDir,
      files: extractedFiles
    }
    
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
    throw error
  }
}

/**
 * Process uploaded files and save to temp directory
 */
export async function processUploadedFiles(files, projectName) {
  const tempDir = path.join(os.tmpdir(), `upload-${Date.now()}-${projectName.replace(/[^a-z0-9]/gi, '-')}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  try {
    console.log(`[FileUpload] Processing ${files.length} uploaded files`)
    
    if (files.length > MAX_FILES) {
      throw new Error(`Too many files (${files.length}). Maximum allowed: ${MAX_FILES}`)
    }
    
    let totalSize = 0
    const processedFiles = []
    
    for (const file of files) {
      // Skip hidden files and bloat directories
      const filename = file.originalname || file.filename
      if (filename.split(path.sep).some(part => part.startsWith('.'))) {
        continue
      }
      
      const skipDirs = ['node_modules', '__pycache__', '.git', 'vendor', 'build', 'dist']
      if (skipDirs.some(dir => filename.includes(`${dir}/`))) {
        continue
      }
      
      totalSize += file.size
      if (totalSize > MAX_FILE_SIZE) {
        throw new Error(`Total file size exceeds maximum (${MAX_FILE_SIZE / 1024 / 1024}MB)`)
      }
      
      // Save file to temp directory
      const targetPath = path.join(tempDir, filename)
      const dir = path.dirname(targetPath)
      
      await fs.mkdir(dir, { recursive: true })
      
      // Read from buffer or path
      let content
      if (file.buffer) {
        content = file.buffer
      } else if (file.path) {
        content = await fs.readFile(file.path)
      } else {
        console.warn(`[FileUpload] Skipping file without buffer or path: ${filename}`)
        continue
      }
      
      await fs.writeFile(targetPath, content)
      processedFiles.push({
        path: filename,
        originalname: filename,
        size: file.size
      })
    }
    
    console.log(`[FileUpload] Processed ${processedFiles.length} files`)
    
    // Validate uploaded project
    validateProject(processedFiles)
    
    return {
      tempDir,
      files: processedFiles
    }
    
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
    throw error
  }
}

/**
 * Convert uploaded files to the format expected by projectImporter
 */
export async function convertFilesToImportFormat(tempDir, files) {
  const importFiles = []
  
  for (const file of files) {
    const filePath = path.join(tempDir, file.path)
    
    if (!existsSync(filePath)) {
      console.warn(`[FileUpload] File not found: ${filePath}`)
      continue
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8')
      importFiles.push({
        path: file.path,
        content
      })
    } catch (err) {
      // Try binary read if UTF-8 fails
      try {
        const buffer = await fs.readFile(filePath)
        importFiles.push({
          path: file.path,
          content: buffer.toString('base64')
        })
      } catch {
        console.warn(`[FileUpload] Failed to read file: ${file.path}`)
      }
    }
  }
  
  return importFiles
}

/**
 * Cleanup temporary directory
 */
export async function cleanupTemp(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
    console.log(`[FileUpload] Cleaned up temp directory: ${tempDir}`)
  } catch (err) {
    console.warn(`[FileUpload] Failed to cleanup temp directory: ${err.message}`)
  }
}
