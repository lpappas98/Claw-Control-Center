/**
 * Deep Code Analyzer
 * Performs comprehensive analysis of codebase + README to generate rich feature tree
 */

import fs from 'fs/promises'
import path from 'path'

/**
 * Analyze repository deeply
 */
export async function analyzeRepositoryDeep(repoPath, readme) {
  console.log('🔍 Starting deep analysis...')
  
  // 1. Parse README for feature hierarchy
  const readmeFeatures = await parseReadmeHierarchy(readme)
  console.log(`📖 Extracted ${readmeFeatures.length} features from README`)
  
  // Debug: log feature structure
  for (const f of readmeFeatures) {
    const itemCount = f.subFeatures.reduce((sum, sub) => sum + sub.items.length, 0)
    console.log(`  - ${f.title}: ${f.subFeatures.length} sub-features, ${itemCount} items`)
  }
  
  // 2. Scan codebase for structure
  const codeStructure = await scanCodebase(repoPath)
  console.log(`💻 Found ${codeStructure.files.length} code files`)
  
  // 3. Map README features to code
  const mappedFeatures = mapFeaturesToCode(readmeFeatures, codeStructure)
  console.log(`🔗 Mapped features to code`)
  
  // 4. Build hierarchical tree
  const tree = buildFeatureTree(mappedFeatures, codeStructure)
  console.log(`🌲 Built tree with ${countNodes(tree)} total nodes`)
  
  // 5. Extract suggested tasks
  const tasks = extractTasks(readme, codeStructure)
  
  return {
    features: tree,
    codeStructure,
    tasks,
    stats: {
      totalFiles: codeStructure.files.length,
      totalFeatures: countNodes(tree),
      codeLines: codeStructure.totalLines
    }
  }
}

/**
 * Parse README into hierarchical features
 */
async function parseReadmeHierarchy(content) {
  const lines = content.split('\n')
  const features = []

  let inFeaturesSection = false
  let currentFeature = null
  let currentSection = null
  let currentIndent = 0

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trimEnd()

    // Enter features section
    if (/^##\s+(core\s+features|features|capabilities)/i.test(line)) {
      inFeaturesSection = true
      continue
    }

    // Exit at next H2 after entering
    if (inFeaturesSection && /^##\s+/.test(line) && !/^##\s+(core\s+features|features|capabilities)/i.test(line)) {
      break
    }

    if (!inFeaturesSection) continue

    // ### Feature headers (H3-based format)
    const h3Match = line.match(/^###\s+(.+)/)
    if (h3Match) {
      if (currentFeature) features.push(currentFeature)

      let title = h3Match[1].trim()
      title = title.replace(/^\p{Extended_Pictographic}+\s*/u, '')
      title = title.split(' - ')[0].trim()
      title = title.replace(/^\*\*(.+?)\*\*:?$/, '$1')
      title = title.replace(/\s+\*\*.*$/, '').trim()

      const description = extractDescription(lines, i + 1)

      currentFeature = {
        title,
        description,
        subFeatures: [],
        codeFiles: []
      }

      currentFeature.subFeatures.push({
        title: 'Details',
        description: '',
        items: []
      })
      currentSection = currentFeature.subFeatures[0]
      currentIndent = 0
      continue
    }

    // #### Sub-headers
    const h4Match = line.match(/^####\s+(.+)/)
    if (h4Match && currentFeature) {
      const subTitle = h4Match[1].replace(/^\*\*(.+?)\*\*:?$/, '$1').trim()
      const subDesc = extractDescription(lines, i + 1)

      currentFeature.subFeatures.push({
        title: subTitle,
        description: subDesc,
        items: []
      })
      currentSection = currentFeature.subFeatures[currentFeature.subFeatures.length - 1]
      currentIndent = 0
      continue
    }

    // Top-level bold bullets become features (common README pattern: - **Feature Name**: desc)
    const topBoldBullet = line.match(/^[-*]\s+\*\*(.+?)\*\*:?\s*(.*)/)
    if (topBoldBullet && !currentFeature) {
      // This is a top-level feature bullet
      if (currentFeature) features.push(currentFeature)

      const title = topBoldBullet[1].trim()
      const description = (topBoldBullet[2] || '').trim()

      currentFeature = {
        title,
        description,
        subFeatures: [],
        codeFiles: []
      }

      currentFeature.subFeatures.push({
        title: 'Details',
        description: '',
        items: []
      })
      currentSection = currentFeature.subFeatures[0]
      currentIndent = 0
      continue
    }

    // Nested bullets under features (indented)
    const indent = line.match(/^(\s*)[-*]\s/)
    if (indent && currentFeature) {
      const indentLevel = indent[1].length
      
      // Only capture bullets that are more indented than the feature line
      if (indentLevel > currentIndent) {
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)/)
        if (bulletMatch) {
          const text = bulletMatch[1].trim()
          const colonIdx = text.indexOf(':')
          
          if (colonIdx > 0 && colonIdx < 80) {
            currentSection.items.push({
              title: text.slice(0, colonIdx).trim(),
              description: text.slice(colonIdx + 1).trim()
            })
          } else {
            currentSection.items.push({
              title: text,
              description: ''
            })
          }
        }
      } else if (indentLevel === 0 && topBoldBullet) {
        // New top-level bullet = new feature
        if (currentFeature) features.push(currentFeature)

        const title = topBoldBullet[1].trim()
        const description = (topBoldBullet[2] || '').trim()

        currentFeature = {
          title,
          description,
          subFeatures: [],
          codeFiles: []
        }

        currentFeature.subFeatures.push({
          title: 'Details',
          description: '',
          items: []
        })
        currentSection = currentFeature.subFeatures[0]
        currentIndent = 0
      }
    }
  }

  if (currentFeature) features.push(currentFeature)
  return features
}

/**
 * Extract description following a header
 */
function extractDescription(lines, startIdx) {
  const descLines = []
  
  for (let i = startIdx; i < lines.length && i < startIdx + 10; i++) {
    const line = lines[i].trim()
    
    // Stop at next header
    if (line.match(/^#{1,4}\s/)) break
    
    // Collect paragraph text (not lists or code blocks)
    if (line && !line.match(/^[-*]\s/) && !line.match(/^`{3}/) && !line.match(/^!\[/)) {
      descLines.push(line)
    }
    
    // Stop after first paragraph
    if (descLines.length > 0 && !line) break
  }
  
  return descLines.join(' ').substring(0, 300)
}

/**
 * Scan codebase structure
 */
async function scanCodebase(repoPath) {
  const structure = {
    files: [],
    directories: [],
    totalLines: 0,
    byType: {}
  }
  
  try {
    await scanDirectory(repoPath, repoPath, structure)
  } catch (err) {
    console.error('Error scanning codebase:', err)
  }
  
  return structure
}

/**
 * Recursively scan directory
 */
async function scanDirectory(basePath, currentPath, structure, depth = 0) {
  if (depth > 6) return // Limit recursion depth
  
  // Skip common ignore patterns
  const dirname = path.basename(currentPath)
  if (['.git', 'node_modules', 'build', 'dist', '.dart_tool', 'ios', 'android', 'web'].includes(dirname)) {
    return
  }
  
  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)
      
      if (entry.isDirectory()) {
        structure.directories.push(relativePath)
        await scanDirectory(basePath, fullPath, structure, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        
        // Analyze source files
        if (['.dart', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.swift', '.kt'].includes(ext)) {
          const fileInfo = await analyzeFile(fullPath, relativePath, ext)
          structure.files.push(fileInfo)
          structure.totalLines += fileInfo.lines
          
          structure.byType[ext] = (structure.byType[ext] || 0) + 1
        }
      }
    }
  } catch (err) {
    // Skip permission errors
  }
}

/**
 * Analyze individual file
 */
async function analyzeFile(fullPath, relativePath, ext) {
  const info = {
    path: relativePath,
    name: path.basename(relativePath),
    ext,
    lines: 0,
    classes: [],
    functions: [],
    imports: []
  }
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8')
    info.lines = content.split('\n').length
    
    // Extract classes (Dart, JS, TS, Java, etc.)
    const classMatches = content.matchAll(/class\s+(\w+)/g)
    for (const match of classMatches) {
      info.classes.push(match[1])
    }
    
    // Extract functions (simplified)
    const functionMatches = content.matchAll(/(?:function|def|func)\s+(\w+)/g)
    for (const match of functionMatches) {
      info.functions.push(match[1])
    }
    
    // Extract imports
    const importMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g)
    for (const match of importMatches) {
      info.imports.push(match[1])
    }
  } catch (err) {
    // Skip files that can't be read
  }
  
  return info
}

/**
 * Map README features to code files
 */
function mapFeaturesToCode(features, codeStructure) {
  return features.map(feature => {
    // Find code files related to this feature
    const relatedFiles = findRelatedFiles(feature, codeStructure.files)
    
    return {
      ...feature,
      codeFiles: relatedFiles,
      subFeatures: feature.subFeatures.map(sub => ({
        ...sub,
        codeFiles: findRelatedFiles(sub, codeStructure.files)
      }))
    }
  })
}

/**
 * Find code files related to a feature by name matching
 */
function findRelatedFiles(feature, allFiles) {
  const keywords = extractKeywords(feature.title)
  const related = []
  
  for (const file of allFiles) {
    const fileName = file.name.toLowerCase()
    const filePath = file.path.toLowerCase()
    
    // Check if any keyword matches
    for (const keyword of keywords) {
      if (fileName.includes(keyword) || filePath.includes(keyword)) {
        related.push(file.path)
        break
      }
    }
  }
  
  return related
}

/**
 * Extract searchable keywords from feature title
 */
function extractKeywords(title) {
  const keywords = []
  const words = title.toLowerCase().split(/\s+/)
  
  for (const word of words) {
    // Remove common words
    if (['the', 'and', 'or', 'with', 'for', 'to', 'a', 'an', '&'].includes(word)) continue
    
    // Add full word
    keywords.push(word)
    
    // Add word without suffixes
    keywords.push(word.replace(/s$/, ''))
    keywords.push(word.replace(/ing$/, ''))
  }
  
  return [...new Set(keywords)]
}

/**
 * Build hierarchical tree structure
 */
function buildFeatureTree(features, codeStructure) {
  const tree = []
  
  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    
    const node = {
      id: `feat-${i + 1}`,
      title: feature.title,
      summary: feature.description || `${feature.title} functionality`,
      status: 'planned',
      priority: i < 3 ? 'p1' : 'p2',
      codeFiles: feature.codeFiles,
      children: []
    }
    
    // Add sub-features as children
    for (let j = 0; j < feature.subFeatures.length; j++) {
      const sub = feature.subFeatures[j]
      
      // Skip implicit "Details" section - convert items directly to children
      if (sub.title === 'Details' && sub.items.length > 0) {
        // Convert items directly to child nodes
        for (let k = 0; k < sub.items.length; k++) {
          const item = sub.items[k]
          
          node.children.push({
            id: `feat-${i + 1}-${k + 1}`,
            title: item.title,
            summary: item.description || '',
            status: 'planned',
            priority: 'p2',
            children: []
          })
        }
      } else if (sub.items.length > 0) {
        // Real sub-feature with items
        const subNode = {
          id: `feat-${i + 1}-${j + 1}`,
          title: sub.title,
          summary: sub.description || `${sub.title} component`,
          status: 'planned',
          priority: 'p2',
          codeFiles: sub.codeFiles,
          children: []
        }
        
        // Add items as leaf nodes
        for (let k = 0; k < sub.items.length; k++) {
          const item = sub.items[k]
          
          subNode.children.push({
            id: `feat-${i + 1}-${j + 1}-${k + 1}`,
            title: item.title,
            summary: item.description || '',
            status: 'planned',
            priority: 'p3',
            children: []
          })
        }
        
        node.children.push(subNode)
      }
    }
    
    tree.push(node)
  }
  
  return tree
}

/**
 * Extract tasks from README and code
 */
function extractTasks(readme, codeStructure) {
  const tasks = []
  
  // Find TODO comments in code
  for (const file of codeStructure.files) {
    // This would require reading files again - skip for now
  }
  
  // Find tasks in README (lines with [ ])
  const todoPattern = /[-*]\s+\[\s?\]\s+(.+)/g
  const matches = readme.matchAll(todoPattern)
  
  for (const match of matches) {
    tasks.push({
      title: match[1].trim(),
      description: '',
      priority: 'p2'
    })
  }
  
  return tasks.slice(0, 20)
}

/**
 * Count total nodes in tree
 */
function countNodes(tree) {
  let count = 0
  
  function traverse(nodes) {
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
