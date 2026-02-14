import { describe, it, after, before } from 'node:test'
import * as assert from 'node:assert/strict'
import { TaskTemplatesStore, makeTemplateId } from './taskTemplates.mjs'
import * as fs from 'node:fs/promises'
import path from 'node:path'

describe('TaskTemplatesStore', () => {
  let testFile
  let counter = 0

  before(async () => {
    // Create unique test file for each test run
    counter = Math.random()
    testFile = `.test-templates-${counter}.json`
  })

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
  })

  describe('template creation', async () => {
    it('should create a new template', async () => {
      const store = new TaskTemplatesStore(testFile)
      const template = await store.createTemplate({
        name: 'New Feature',
        description: 'Standard workflow for new feature implementation',
        tasks: [
          { title: 'Design mockup', role: 'designer', estimatedHours: 4 },
          { title: 'Implement backend', role: 'backend-dev', estimatedHours: 8 },
        ]
      })

      assert.ok(template.id)
      assert.equal(template.name, 'New Feature')
      assert.equal(template.description, 'Standard workflow for new feature implementation')
      assert.equal(template.tasks.length, 2)
      assert.equal(template.tasks[0].title, 'Design mockup')
      assert.equal(template.tasks[0].role, 'designer')
      assert.ok(template.createdAt)
    })

    it('should throw error if name is missing', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      try {
        await store.createTemplate({
          description: 'No name',
          tasks: [{ title: 'Task', role: 'dev' }]
        })
        assert.fail('Should have thrown error')
      } catch (e) {
        assert.match(e.message, /must have name/)
      }
    })

    it('should throw error if tasks is missing', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      try {
        await store.createTemplate({
          name: 'No tasks template'
        })
        assert.fail('Should have thrown error')
      } catch (e) {
        assert.match(e.message, /must have.*tasks array/)
      }
    })

    it('should generate unique template IDs', async () => {
      const id1 = makeTemplateId()
      const id2 = makeTemplateId()
      assert.notEqual(id1, id2)
    })
  })

  describe('template retrieval', async () => {
    it('should retrieve all templates', async () => {
      const testFile2 = `.test-templates-retrieval-${Math.random()}.json`
      const store = new TaskTemplatesStore(testFile2)
      
      await store.createTemplate({
        name: 'Template 1',
        tasks: [{ title: 'Task 1', role: 'dev' }]
      })
      
      await store.createTemplate({
        name: 'Template 2',
        tasks: [{ title: 'Task 2', role: 'designer' }]
      })

      const all = await store.getAll()
      assert.equal(all.length, 2)
      assert.equal(all[0].name, 'Template 1')
      assert.equal(all[1].name, 'Template 2')

      try {
        await fs.unlink(testFile2)
      } catch (e) {
        // ignore
      }
    })

    it('should retrieve template by ID', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const created = await store.createTemplate({
        name: 'Search Template',
        tasks: [{ title: 'Task', role: 'dev' }]
      })

      const found = await store.getTemplate(created.id)
      assert.ok(found)
      assert.equal(found.id, created.id)
      assert.equal(found.name, 'Search Template')
    })

    it('should return null for non-existent template', async () => {
      const store = new TaskTemplatesStore(testFile)
      const found = await store.getTemplate('non-existent-id')
      assert.equal(found, null)
    })
  })

  describe('template updates', async () => {
    it('should update template', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const template = await store.createTemplate({
        name: 'Original Name',
        description: 'Original description',
        tasks: [{ title: 'Task', role: 'dev' }]
      })

      // Add a small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1))

      const updated = await store.updateTemplate(template.id, {
        name: 'Updated Name',
        description: 'Updated description'
      })

      assert.equal(updated.name, 'Updated Name')
      assert.equal(updated.description, 'Updated description')
      assert.ok(updated.updatedAt >= template.createdAt)
    })

    it('should return null when updating non-existent template', async () => {
      const store = new TaskTemplatesStore(testFile)
      const result = await store.updateTemplate('non-existent', { name: 'New' })
      assert.equal(result, null)
    })
  })

  describe('template deletion', async () => {
    it('should delete template', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const template = await store.createTemplate({
        name: 'To Delete',
        tasks: [{ title: 'Task', role: 'dev' }]
      })

      const deleted = await store.deleteTemplate(template.id)
      assert.equal(deleted, true)

      const found = await store.getTemplate(template.id)
      assert.equal(found, null)
    })

    it('should return false when deleting non-existent template', async () => {
      const store = new TaskTemplatesStore(testFile)
      const result = await store.deleteTemplate('non-existent')
      assert.equal(result, false)
    })
  })

  describe('template validation', async () => {
    it('should validate valid template', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const valid = {
        id: 'test-1',
        name: 'Valid Template',
        tasks: [
          { title: 'Task 1', role: 'dev' },
          { title: 'Task 2', role: 'designer' }
        ]
      }

      assert.equal(store.validateTemplate(valid), true)
    })

    it('should reject invalid template - missing id', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const invalid = {
        name: 'No ID',
        tasks: [{ title: 'Task', role: 'dev' }]
      }

      assert.equal(store.validateTemplate(invalid), false)
    })

    it('should reject invalid template - missing name', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const invalid = {
        id: 'test-1',
        tasks: [{ title: 'Task', role: 'dev' }]
      }

      assert.equal(store.validateTemplate(invalid), false)
    })

    it('should reject invalid template - missing tasks array', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const invalid = {
        id: 'test-1',
        name: 'No Tasks'
      }

      assert.equal(store.validateTemplate(invalid), false)
    })

    it('should reject invalid template - task missing title', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const invalid = {
        id: 'test-1',
        name: 'Invalid Task',
        tasks: [{ role: 'dev' }]
      }

      assert.equal(store.validateTemplate(invalid), false)
    })

    it('should reject invalid template - task missing role', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const invalid = {
        id: 'test-1',
        name: 'Invalid Task',
        tasks: [{ title: 'Task' }]
      }

      assert.equal(store.validateTemplate(invalid), false)
    })
  })

  describe('template persistence', async () => {
    it('should persist templates to file', async () => {
      const store1 = new TaskTemplatesStore(testFile)
      
      const template = await store1.createTemplate({
        name: 'Persistent Template',
        tasks: [{ title: 'Task', role: 'dev' }]
      })

      // Create new store instance
      const store2 = new TaskTemplatesStore(testFile)
      await store2.load()

      const found = await store2.getTemplate(template.id)
      assert.ok(found)
      assert.equal(found.name, 'Persistent Template')
    })
  })

  describe('template task dependencies', async () => {
    it('should support task dependencies', async () => {
      const store = new TaskTemplatesStore(testFile)
      
      const template = await store.createTemplate({
        name: 'With Dependencies',
        tasks: [
          { title: 'Design mockup', role: 'designer', estimatedHours: 4 },
          { title: 'Implement backend', role: 'backend-dev', estimatedHours: 8, dependsOn: ['Design mockup'] },
          { title: 'Implement frontend', role: 'frontend-dev', estimatedHours: 8, dependsOn: ['Implement backend'] },
        ]
      })

      assert.equal(template.tasks[1].dependsOn.length, 1)
      assert.equal(template.tasks[1].dependsOn[0], 'Design mockup')
      assert.equal(template.tasks[2].dependsOn.length, 1)
      assert.equal(template.tasks[2].dependsOn[0], 'Implement backend')
    })
  })
})
