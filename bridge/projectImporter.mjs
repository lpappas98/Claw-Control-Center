/**
 * Project Importer - Handle GitHub repo imports and file uploads
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const execAsync = promisify(exec)

/**
 * Import a project from GitHub or uploaded files
 * 
 * @param {Object} options
 * @param {string} options.name - Project name
 * @param {string} [options.description] - Project description
 * @param {string} [options.gitUrl] - GitHub repository URL
 * @param {Array} [options.files] - Uploaded files [{path, content}]
 * @returns {Promise<{projectPath: string, analysis: Object}>}
 */
export async function importProject({ name, description, gitUrl, files, existingPath }) {
  // If files are already extracted to a path, use it directly
  const projectPath = existingPath || path.join(os.tmpdir(), `import-${Date.now()}-${name.replace(/[^a-z0-9]/gi, '-')}`)
  const shouldCleanup = !existingPath

  try {
    // Import from GitHub
    if (gitUrl) {
      await cloneGitRepo(gitUrl, projectPath)
    } 
    // Import from uploaded files (if not already extracted)
    else if (files && Array.isArray(files) && !existingPath) {
      await createFilesFromUpload(files, projectPath)
    }
    // If existingPath provided, files are already there
    else if (!existingPath) {
      throw new Error('Either gitUrl, files, or existingPath must be provided')
    }

    // Analyze the project structure
    const analysis = await analyzeProject(projectPath, { name, description })

    return {
      projectPath,
      analysis
    }

  } catch (error) {
    // Only cleanup if we created the directory
    if (shouldCleanup) {
      try {
        await fs.rm(projectPath, { recursive: true, force: true })
      } catch {}
    }
    throw error
  }
}

/**
 * Clone a git repository
 */
async function cloneGitRepo(gitUrl, targetPath) {
  console.log(`[Importer] Cloning ${gitUrl} to ${targetPath}`)

  // Validate GitHub URL
  if (!gitUrl.includes('github.com')) {
    throw new Error('Only GitHub repositories are supported')
  }

  try {
    const { stdout, stderr } = await execAsync(
      `git clone --depth 1 "${gitUrl}" "${targetPath}"`,
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    )

    if (stderr && stderr.includes('fatal')) {
      throw new Error(`Git clone failed: ${stderr}`)
    }

    console.log(`[Importer] Clone successful`)
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Git clone timed out - repository may be too large')
    }
    throw new Error(`Failed to clone repository: ${error.message}`)
  }
}

/**
 * Create files from uploaded content
 */
async function createFilesFromUpload(files, targetPath) {
  console.log(`[Importer] Creating ${files.length} files in ${targetPath}`)

  await fs.mkdir(targetPath, { recursive: true })

  for (const file of files) {
    if (!file.path || !file.content) continue

    const filePath = path.join(targetPath, file.path)
    const dir = path.dirname(filePath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, file.content, 'utf8')
  }

  console.log(`[Importer] Files created successfully`)
}

/**
 * Analyze project structure and extract metadata
 */
async function analyzeProject(projectPath, context) {
  console.log(`[Importer] Analyzing project at ${projectPath}`)

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
    // Read directory structure
    const files = await walkDirectory(projectPath)

    // Detect tech stack from files
    analysis.techStack = detectTechStack(files)
    analysis.tags = [...analysis.techStack, 'imported']

    // Extract features from README if exists
    const readmePath = files.find(f => /readme\.md$/i.test(f))
    if (readmePath) {
      const readmeContent = await fs.readFile(path.join(projectPath, readmePath), 'utf8')
      analysis.features = extractFeaturesFromReadme(readmeContent)
      
      // Update summary from README if not provided
      if (!analysis.summary) {
        analysis.summary = extractSummaryFromReadme(readmeContent)
      }
    }

    // Generate default features if none found
    if (analysis.features.length === 0) {
      analysis.features = generateDefaultFeatures(files, analysis.techStack)
    }

    // Generate suggested tasks
    analysis.suggestedTasks = generateSuggestedTasks(analysis.features, files)

    // Estimate complexity
    analysis.complexity = estimateComplexity(files)
    analysis.estimatedSize = estimateSize(files)

    console.log(`[Importer] Analysis complete: ${analysis.features.length} features, ${analysis.techStack.length} technologies`)

  } catch (error) {
    console.warn(`[Importer] Analysis failed: ${error.message}`)
    // Return minimal analysis on error
    analysis.features = [{ title: 'Project Setup', summary: 'Initial project structure', status: 'planned', priority: 'p1' }]
    analysis.suggestedTasks = [{ title: 'Review project structure', description: 'Analyze imported files and plan implementation', priority: 'p1' }]
  }

  return analysis
}

/**
 * Walk directory and return file paths
 */
async function walkDirectory(dir, baseDir = dir, maxFiles = 500) {
  const files = []

  async function walk(currentDir) {
    if (files.length >= maxFiles) return

    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      if (files.length >= maxFiles) break

      // Skip hidden files, node_modules, .git, etc
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') {
        continue
      }

      const fullPath = path.join(currentDir, entry.name)
      const relativePath = path.relative(baseDir, fullPath)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        files.push(relativePath)
      }
    }
  }

  await walk(dir)
  return files
}

/**
 * Detect tech stack from file extensions
 */
function detectTechStack(files) {
  const stack = new Set()

  const patterns = {
    'React': /\.(jsx|tsx)$/,
    'TypeScript': /\.tsx?$/,
    'JavaScript': /\.jsx?$/,
    'Python': /\.py$/,
    'Node.js': /package\.json$/,
    'Go': /\.go$/,
    'Rust': /\.rs$/,
    'Java': /\.java$/,
    'Docker': /Dockerfile$/,
    'Kubernetes': /\.ya?ml$/,
  }

  for (const file of files) {
    for (const [tech, pattern] of Object.entries(patterns)) {
      if (pattern.test(file)) {
        stack.add(tech)
      }
    }
  }

  return Array.from(stack).slice(0, 10)
}

/**
 * Extract features from README content
 */
function extractFeaturesFromReadme(content) {
  const features = []
  const lines = content.split('\n')
  
  // Find feature sections (### headers with emoji or "Feature" keyword)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Match ### headers that look like features (emoji or keywords)
    const featureHeaderMatch = line.match(/^###\s+([🔐🗺️📍✈️🤝👤🎯🏠].*|.*(?:Feature|System|Management|Integration|Planning|Dashboard|Authentication|Profile|Settings).*)/)
    
    if (featureHeaderMatch) {
      let title = featureHeaderMatch[1].trim()
      // Remove emoji and clean title
      title = title.replace(/^[🔐🗺️📍✈️🤝👤🎯🏠]\s*/, '')
      title = title.replace(/^\*\*(.+?)\*\*:?$/, '$1')
      
      // Extract description from following lines until next header
      let summary = ''
      const descLines = []
      
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        const nextLine = lines[j].trim()
        
        // Stop at next header
        if (nextLine.match(/^#{1,4}\s/)) break
        
        // Collect non-empty, non-list lines as description
        if (nextLine && !nextLine.match(/^[-*]\s/) && !nextLine.match(/^`{3}/)) {
          descLines.push(nextLine)
        }
        
        // Stop after collecting some description
        if (descLines.length >= 2) break
      }
      
      summary = descLines.join(' ').substring(0, 200)
      
      features.push({
        title: title.trim(),
        summary: summary || `${title} functionality`,
        status: 'planned',
        priority: 'p2'
      })
      
      // Limit features
      if (features.length >= 15) break
    }
  }

  return features.slice(0, 15)
}

/**
 * Extract summary from README
 */
function extractSummaryFromReadme(content) {
  const lines = content.split('\n').filter(l => l.trim())
  
  // Skip title (first line starting with #)
  let startIndex = 0
  if (lines[0].startsWith('#')) {
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
 * Generate default features from files
 */
function generateDefaultFeatures(files, techStack) {
  const features = []

  // Extract features from folder structure
  const topLevelDirs = new Set()
  for (const file of files) {
    const parts = file.split('/')
    if (parts.length > 1 && !parts[0].startsWith('.')) {
      topLevelDirs.add(parts[0])
    }
  }

  // Map common folder names to features
  const folderFeatureMap = {
    'src': { title: 'Source Code', summary: 'Core application source code', priority: 'p1' },
    'components': { title: 'UI Components', summary: 'Reusable UI components', priority: 'p1' },
    'pages': { title: 'Pages/Routes', summary: 'Application pages and routing', priority: 'p1' },
    'api': { title: 'API Layer', summary: 'API endpoints and services', priority: 'p1' },
    'services': { title: 'Services', summary: 'Business logic and services', priority: 'p1' },
    'auth': { title: 'Authentication', summary: 'User authentication and authorization', priority: 'p1' },
    'database': { title: 'Database', summary: 'Database schema and queries', priority: 'p1' },
    'db': { title: 'Database', summary: 'Database layer', priority: 'p1' },
    'models': { title: 'Data Models', summary: 'Data models and schemas', priority: 'p2' },
    'utils': { title: 'Utilities', summary: 'Utility functions and helpers', priority: 'p2' },
    'lib': { title: 'Libraries', summary: 'Shared libraries and tools', priority: 'p2' },
    'config': { title: 'Configuration', summary: 'App configuration', priority: 'p2' },
    'tests': { title: 'Testing', summary: 'Test suites', priority: 'p2' },
    'docs': { title: 'Documentation', summary: 'Project documentation', priority: 'p2' },
  }

  // Create features from folders
  for (const dir of Array.from(topLevelDirs).slice(0, 8)) {
    const mapped = folderFeatureMap[dir.toLowerCase()]
    if (mapped) {
      features.push({
        title: mapped.title,
        summary: mapped.summary,
        status: 'planned',
        priority: mapped.priority
      })
    } else if (!['node_modules', 'dist', 'build', '.git'].includes(dir)) {
      features.push({
        title: dir.charAt(0).toUpperCase() + dir.slice(1),
        summary: `${dir} module`,
        status: 'planned',
        priority: 'p2'
      })
    }
  }

  // Add tech-stack specific features if none found
  if (features.length === 0) {
    features.push({
      title: 'Project Setup',
      summary: 'Initial project configuration and dependencies',
      status: 'planned',
      priority: 'p1'
    })

    if (techStack.includes('React') || techStack.includes('TypeScript')) {
      features.push({
        title: 'Frontend Development',
        summary: 'Build and configure frontend components',
        status: 'planned',
        priority: 'p1'
      })
    }

    if (techStack.includes('Node.js')) {
      features.push({
        title: 'Backend API',
        summary: 'Develop backend services and API endpoints',
        status: 'planned',
        priority: 'p1'
      })
    }
  }

  return features.slice(0, 15)
}

/**
 * Generate suggested tasks
 */
function generateSuggestedTasks(features, files) {
  const tasks = []

  // Task for each feature
  for (const feature of features.slice(0, 5)) {
    tasks.push({
      title: `Implement: ${feature.title}`,
      description: feature.summary || `Work on ${feature.title}`,
      priority: feature.priority || 'p2'
    })
  }

  // Add testing task
  tasks.push({
    title: 'Write tests',
    description: 'Add unit and integration tests',
    priority: 'p2'
  })

  // Add documentation task
  tasks.push({
    title: 'Update documentation',
    description: 'Document API and usage',
    priority: 'p2'
  })

  return tasks.slice(0, 10)
}

/**
 * Estimate project complexity
 */
function estimateComplexity(files) {
  const count = files.length

  if (count < 10) return 'simple'
  if (count < 50) return 'medium'
  return 'complex'
}

/**
 * Estimate project size
 */
function estimateSize(files) {
  const count = files.length

  if (count < 20) return 'small'
  if (count < 100) return 'medium'
  return 'large'
}
