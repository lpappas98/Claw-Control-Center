/**
 * Project Importer V2 - Deep README + Code Analysis
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const execAsync = promisify(exec)

/**
 * Import a project from GitHub or uploaded files with deep analysis
 */
export async function importProject({ name, description, gitUrl, files, existingPath }) {
  const projectPath = existingPath || path.join(os.tmpdir(), `import-${Date.now()}-${name.replace(/[^a-z0-9]/gi, '-')}`)
  const shouldCleanup = !existingPath

  try {
    console.log(`[ImporterV2] Starting import: ${name}`)
    
    // Step 1: Get the code (clone or extract)
    if (gitUrl) {
      await cloneRepository(gitUrl, projectPath)
    } else if (files && files.length > 0) {
      await createFilesFromUpload(files, projectPath)
    } else if (!existingPath) {
      throw new Error('No source provided - need gitUrl, files, or existingPath')
    }

    // Step 2: Deep analysis
    console.log(`[ImporterV2] 🔍 Running deep analysis...`)
    const analysis = await analyzeProjectDeep(projectPath, { name, description })
    
    console.log(`[ImporterV2] ✅ Import complete!`)
    console.log(`  - Features: ${countAllNodes(analysis.features)}`)
    console.log(`  - Tasks: ${analysis.suggestedTasks.length}`)
    console.log(`  - Tech Stack: ${analysis.techStack.join(', ')}`)

    return { projectPath, analysis, shouldCleanup }

  } catch (error) {
    console.error(`[ImporterV2] Import failed:`, error)
    if (shouldCleanup) {
      try {
        await fs.rm(projectPath, { recursive: true, force: true })
      } catch {}
    }
    throw error
  }
}

/**
 * Clone GitHub repository
 */
async function cloneRepository(gitUrl, targetPath) {
  console.log(`[ImporterV2] Cloning ${gitUrl}...`)
  
  const sanitizedUrl = gitUrl.replace(/\.git$/, '').trim()
  const timeout = 60000 // 60 seconds

  try {
    await execAsync(
      `git clone --depth 1 "${sanitizedUrl}" "${targetPath}"`,
      { timeout, maxBuffer: 10 * 1024 * 1024 }
    )
    console.log(`[ImporterV2] ✅ Clone complete`)
  } catch (error) {
    if (error.killed) {
      throw new Error('Git clone timed out - repository may be too large')
    }
    throw new Error(`Failed to clone repository: ${error.message}`)
  }
}

/**
 * Create files from uploaded content
 */
async function createFilesFromUpload(files, targetPath) {
  console.log(`[ImporterV2] Creating ${files.length} files...`)

  await fs.mkdir(targetPath, { recursive: true })

  for (const file of files) {
    if (!file.path || !file.content) continue

    const filePath = path.join(targetPath, file.path)
    const dir = path.dirname(filePath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, file.content, 'utf8')
  }

  console.log(`[ImporterV2] ✅ Files created`)
}

/**
 * Deep analysis: README + Code Structure
 */
async function analyzeProjectDeep(projectPath, context) {
  console.log(`[ImporterV2] 📊 Analyzing project structure...`)

  const analysis = {
    summary: context.description || '',
    techStack: [],
    complexity: 'medium',
    estimatedSize: 'medium',
    features: [],
    suggestedTasks: [],
    tags: []
  }

  try {
    // Scan filesystem
    const files = await walkDirectory(projectPath)
    analysis.techStack = detectTechStack(files)
    analysis.tags = [...analysis.techStack, 'imported']

    // Find and read README
    const readme = await findAndReadReadme(projectPath, files)
    if (readme && !analysis.summary) {
      analysis.summary = extractSummaryFromReadme(readme)
    }

    // Deep analysis
    console.log(`[ImporterV2] 🔍 Running deep analyzer...`)
    const { analyzeRepositoryDeep } = await import('./deepCodeAnalyzer.mjs')
    const deepResult = await analyzeRepositoryDeep(projectPath, readme || '')
    
    analysis.features = deepResult.features || []
    analysis.suggestedTasks = deepResult.tasks || []
    
    console.log(`[ImporterV2] ✅ Deep analysis: ${countAllNodes(analysis.features)} nodes`)

    // Fallback if deep analysis failed
    if (analysis.features.length === 0) {
      console.log(`[ImporterV2] ⚠️ No features found, using fallback`)
      analysis.features = generateFallbackFeatures(files, analysis.techStack)
    }

    // Estimate size
    analysis.complexity = estimateComplexity(files)
    analysis.estimatedSize = estimateSize(files)

  } catch (error) {
    console.error(`[ImporterV2] Analysis error:`, error)
    // Return minimal structure on error
    analysis.features = [{
      id: 'feat-1',
      title: context.name || 'Project',
      summary: 'Imported project',
      status: 'planned',
      priority: 'p1',
      children: []
    }]
  }

  return analysis
}

/**
 * Walk directory tree
 */
async function walkDirectory(dir, baseDir = dir, maxDepth = 8) {
  const files = []
  
  async function walk(currentDir, depth = 0) {
    if (depth > maxDepth || files.length > 5000) return

    const basename = path.basename(currentDir)
    if (['.git', 'node_modules', 'build', 'dist', '.dart_tool', 'vendor'].includes(basename)) {
      return
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        const relativePath = path.relative(baseDir, fullPath)

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1)
        } else if (entry.isFile()) {
          files.push(relativePath)
        }
      }
    } catch {}
  }

  await walk(dir)
  return files
}

/**
 * Find and read README
 */
async function findAndReadReadme(projectPath, files = []) {
  const readmePattern = /^readme\.md$/i
  
  if (files.length === 0) {
    files = await walkDirectory(projectPath)
  }
  
  const readmePath = files.find(f => readmePattern.test(path.basename(f)))
  
  if (readmePath) {
    try {
      const content = await fs.readFile(path.join(projectPath, readmePath), 'utf8')
      return content
    } catch {}
  }
  
  return null
}

/**
 * Extract summary from README
 */
function extractSummaryFromReadme(content) {
  const lines = content.split('\n').filter(l => l.trim())
  let startIndex = 0
  
  // Skip title
  if (lines[0]?.startsWith('#')) {
    startIndex = 1
  }

  // Get first paragraph
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && !line.startsWith('#') && !line.startsWith('!')) {
      return line.substring(0, 500)
    }
  }

  return ''
}

/**
 * Detect tech stack from file extensions
 */
function detectTechStack(files) {
  const stack = new Set()
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const basename = path.basename(file).toLowerCase()
    
    // Languages
    if (ext === '.dart') stack.add('Dart')
    if (ext === '.ts' || ext === '.tsx') stack.add('TypeScript')
    if (ext === '.js' || ext === '.jsx') stack.add('JavaScript')
    if (ext === '.py') stack.add('Python')
    if (ext === '.java') stack.add('Java')
    if (ext === '.swift') stack.add('Swift')
    if (ext === '.kt') stack.add('Kotlin')
    if (ext === '.go') stack.add('Go')
    if (ext === '.rs') stack.add('Rust')
    
    // Frameworks
    if (basename === 'pubspec.yaml') stack.add('Flutter')
    if (basename === 'package.json') stack.add('Node.js')
    if (basename === 'requirements.txt') stack.add('Python')
    if (basename === 'cargo.toml') stack.add('Rust')
    if (basename === 'go.mod') stack.add('Go')
    if (basename === 'pom.xml' || basename === 'build.gradle') stack.add('Java')
    
    // Tools
    if (basename === 'dockerfile') stack.add('Docker')
    if (basename.includes('kubernetes') || ext === '.yaml') stack.add('Kubernetes')
    if (basename.includes('firebase')) stack.add('Firebase')
  }
  
  return Array.from(stack)
}

/**
 * Generate fallback features from folder structure
 */
function generateFallbackFeatures(files, techStack) {
  const topDirs = new Set()
  
  for (const file of files) {
    const parts = file.split(path.sep)
    if (parts.length > 1 && !parts[0].startsWith('.')) {
      topDirs.add(parts[0])
    }
  }

  const features = []
  let id = 1

  for (const dir of Array.from(topDirs).slice(0, 10)) {
    features.push({
      id: `feat-${id++}`,
      title: dir.charAt(0).toUpperCase() + dir.slice(1),
      summary: `${dir} module`,
      status: 'planned',
      priority: 'p2',
      children: []
    })
  }

  if (features.length === 0) {
    features.push({
      id: 'feat-1',
      title: 'Project Setup',
      summary: 'Initial project structure',
      status: 'planned',
      priority: 'p1',
      children: []
    })
  }

  return features
}

/**
 * Estimate complexity
 */
function estimateComplexity(files) {
  if (files.length > 500) return 'complex'
  if (files.length > 100) return 'medium'
  return 'simple'
}

/**
 * Estimate size
 */
function estimateSize(files) {
  if (files.length > 500) return 'large'
  if (files.length > 100) return 'medium'
  return 'small'
}

/**
 * Count all nodes recursively
 */
function countAllNodes(tree) {
  let count = 0
  function traverse(nodes) {
    if (!Array.isArray(nodes)) return
    count += nodes.length
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  traverse(tree)
  return count
}
