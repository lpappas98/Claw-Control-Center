import { mockAdapter } from './src/adapters/mockAdapter.ts';

async function testProjectsAdapter() {
  console.log('🧪 Testing Projects adapter contract...\n');

  const adapter = mockAdapter;

  try {
    // Test listProjects
    console.log('1. Testing listProjects()...');
    const projects = await adapter.listProjects();
    console.log(`   ✓ Returns ${projects.length} projects`);
    if (projects.length > 0) {
      const p = projects[0];
      console.log(`   ✓ Sample project: id=${p.id}, name=${p.name}, status=${p.status}, priority=${p.priority}`);
      console.log(`   ✓ Has timestamps: createdAt=${p.createdAt.slice(0, 10)}, updatedAt=${p.updatedAt.slice(0, 10)}`);
    }

    // Test getProject
    if (projects.length > 0) {
      console.log('\n2. Testing getProject()...');
      const proj = await adapter.getProject(projects[0].id);
      console.log(`   ✓ Retrieved project: ${proj.name}`);
    }

    // Test createProject
    console.log('\n3. Testing createProject()...');
    const newProj = await adapter.createProject({
      name: 'Test Project',
      description: 'A test project',
      status: 'active',
      priority: 'P0',
    });
    console.log(`   ✓ Created project: id=${newProj.id}, name=${newProj.name}`);

    // Test updateProject
    console.log('\n4. Testing updateProject()...');
    const updated = await adapter.updateProject({
      id: newProj.id,
      name: 'Updated Test Project',
      status: 'paused',
    });
    console.log(`   ✓ Updated project: name="${updated.name}", status="${updated.status}"`);

    // Test deleteProject
    console.log('\n5. Testing deleteProject()...');
    const deleted = await adapter.deleteProject(newProj.id);
    console.log(`   ✓ Deleted project: ok=${deleted.ok}`);

    console.log('\n✅ All Projects adapter methods working correctly!\n');
  } catch (err) {
    console.error('\n❌ Error testing adapter:', err.message);
    process.exit(1);
  }
}

testProjectsAdapter();
