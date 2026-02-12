"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate = exports.deleteAgentProfile = exports.updateAgentProfile = exports.createAgentProfile = exports.listAgentProfiles = exports.logActivity = exports.getProjects = exports.updateTask = exports.createTask = exports.getTasks = exports.disconnect = exports.heartbeat = exports.connect = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// ─────────────────────────────────────────────────────────────
// CORS Helper
// ─────────────────────────────────────────────────────────────
function corsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Instance-Id');
}
function handleCors(req, res) {
    corsHeaders(res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}
async function validateInstance(instanceId) {
    if (!instanceId)
        return null;
    // Find which user this instance belongs to
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
        const connectionDoc = await userDoc.ref.collection('connection').doc('current').get();
        if (connectionDoc.exists) {
            const data = connectionDoc.data();
            if (data.instanceId === instanceId) {
                return { userId: userDoc.id, connection: data };
            }
        }
    }
    return null;
}
// ─────────────────────────────────────────────────────────────
// Connection Endpoints
// ─────────────────────────────────────────────────────────────
/**
 * POST /connect
 * Validate connection token and create connection
 */
exports.connect = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { token, instanceName, metadata } = req.body;
        if (!token || !instanceName) {
            res.status(400).json({ error: 'Missing token or instanceName' });
            return;
        }
        // Find and validate the token
        const tokenDoc = await db.collection('connectionTokens').doc(token).get();
        if (!tokenDoc.exists) {
            res.status(404).json({ error: 'Invalid connection code' });
            return;
        }
        const tokenData = tokenDoc.data();
        if (tokenData.used) {
            res.status(400).json({ error: 'Connection code already used' });
            return;
        }
        const expiresAt = tokenData.expiresAt.toDate();
        if (expiresAt < new Date()) {
            res.status(400).json({ error: 'Connection code expired' });
            return;
        }
        const userId = tokenData.userId;
        const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date().toISOString();
        // Check if user already has a connection (one per user)
        const existingConnection = await db
            .collection('users')
            .doc(userId)
            .collection('connection')
            .doc('current')
            .get();
        if (existingConnection.exists) {
            res.status(400).json({ error: 'User already has a connected instance. Disconnect first.' });
            return;
        }
        // Create the connection
        const connection = {
            instanceId,
            instanceName,
            connectedAt: now,
            lastHeartbeat: now,
            status: 'active',
            metadata: metadata || {},
        };
        await db
            .collection('users')
            .doc(userId)
            .collection('connection')
            .doc('current')
            .set(connection);
        // Mark token as used
        await tokenDoc.ref.update({
            used: true,
            usedAt: now,
            instanceId,
        });
        res.status(200).json({
            success: true,
            instanceId,
            userId,
        });
    }
    catch (error) {
        console.error('Connect error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /heartbeat
 * Update instance heartbeat and status
 */
exports.heartbeat = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const { status, currentTask } = req.body;
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const now = new Date().toISOString();
        const update = {
            lastHeartbeat: now,
            status: status || 'active',
        };
        if (currentTask !== undefined) {
            update.currentTask = currentTask;
        }
        await db
            .collection('users')
            .doc(auth.userId)
            .collection('connection')
            .doc('current')
            .update(update);
        res.status(200).json({ success: true, lastHeartbeat: now });
    }
    catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /disconnect
 * Remove instance connection
 */
exports.disconnect = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or already disconnected instance' });
            return;
        }
        await db
            .collection('users')
            .doc(auth.userId)
            .collection('connection')
            .doc('current')
            .delete();
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ─────────────────────────────────────────────────────────────
// Tasks Endpoints
// ─────────────────────────────────────────────────────────────
/**
 * GET /tasks
 * Get all tasks for the connected user
 */
exports.getTasks = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const tasksSnap = await db
            .collection('users')
            .doc(auth.userId)
            .collection('tasks')
            .orderBy('updatedAt', 'desc')
            .get();
        const tasks = tasksSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.status(200).json({ tasks });
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /tasks
 * Create a new task
 */
exports.createTask = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const { title, lane, priority, owner, problem, scope, acceptanceCriteria } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Missing title' });
            return;
        }
        const now = new Date().toISOString();
        const taskId = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const task = {
            id: taskId,
            title,
            lane: lane || 'proposed',
            priority: priority || 'P2',
            owner: owner || null,
            problem: problem || null,
            scope: scope || null,
            acceptanceCriteria: acceptanceCriteria || [],
            createdAt: now,
            updatedAt: now,
            statusHistory: [{ at: now, to: lane || 'proposed', note: 'created' }],
        };
        await db
            .collection('users')
            .doc(auth.userId)
            .collection('tasks')
            .doc(taskId)
            .set(task);
        res.status(201).json({ task });
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * PATCH /updateTask
 * Update an existing task
 */
exports.updateTask = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'PATCH' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const _a = req.body, { taskId } = _a, updates = __rest(_a, ["taskId"]);
        if (!taskId) {
            res.status(400).json({ error: 'Missing taskId' });
            return;
        }
        const taskRef = db
            .collection('users')
            .doc(auth.userId)
            .collection('tasks')
            .doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const now = new Date().toISOString();
        const taskData = taskDoc.data();
        // Track lane changes in status history
        if (updates.lane && updates.lane !== taskData.lane) {
            const history = taskData.statusHistory || [];
            history.push({
                at: now,
                from: taskData.lane,
                to: updates.lane,
                note: updates.note || null,
            });
            updates.statusHistory = history;
        }
        updates.updatedAt = now;
        delete updates.note; // Don't persist the note field directly
        await taskRef.update(updates);
        const updatedDoc = await taskRef.get();
        const task = Object.assign({ id: updatedDoc.id }, updatedDoc.data());
        res.status(200).json({ task });
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ─────────────────────────────────────────────────────────────
// Projects Endpoints
// ─────────────────────────────────────────────────────────────
/**
 * GET /projects
 * Get all projects for the connected user
 */
exports.getProjects = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const projectsSnap = await db
            .collection('users')
            .doc(auth.userId)
            .collection('pmProjects')
            .orderBy('updatedAt', 'desc')
            .get();
        const projects = projectsSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.status(200).json({ projects });
    }
    catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ─────────────────────────────────────────────────────────────
// Activity Endpoints
// ─────────────────────────────────────────────────────────────
/**
 * POST /activity
 * Log an activity event
 */
exports.logActivity = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const { level, source, message, meta } = req.body;
        const now = new Date().toISOString();
        const activityId = `activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const activity = {
            id: activityId,
            at: now,
            level: level || 'info',
            source: source || auth.connection.instanceName,
            message: message || '',
            meta: meta || {},
        };
        await db
            .collection('users')
            .doc(auth.userId)
            .collection('activity')
            .doc(activityId)
            .set(activity);
        res.status(201).json({ activity });
    }
    catch (error) {
        console.error('Log activity error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ─────────────────────────────────────────────────────────────
// Agent Profiles Endpoints
// ─────────────────────────────────────────────────────────────
/**
 * GET /agentProfiles
 * Get all agent profiles for the connected user
 */
exports.listAgentProfiles = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const profilesSnap = await db
            .collection('users')
            .doc(auth.userId)
            .collection('agentProfiles')
            .orderBy('updatedAt', 'desc')
            .get();
        const profiles = profilesSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.status(200).json({ profiles });
    }
    catch (error) {
        console.error('List agent profiles error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * POST /agentProfiles
 * Create a new agent profile
 */
exports.createAgentProfile = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const { name, role, emoji, systemPrompt, description } = req.body;
        if (!name || !role) {
            res.status(400).json({ error: 'Missing required fields: name and role' });
            return;
        }
        const now = new Date().toISOString();
        const profileId = `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const profile = {
            id: profileId,
            name,
            role,
            emoji: emoji || '🤖',
            systemPrompt: systemPrompt || null,
            description: description || null,
            createdAt: now,
            updatedAt: now,
        };
        await db
            .collection('users')
            .doc(auth.userId)
            .collection('agentProfiles')
            .doc(profileId)
            .set(profile);
        res.status(201).json({ profile });
    }
    catch (error) {
        console.error('Create agent profile error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * PATCH /updateAgentProfile
 * Update an existing agent profile
 */
exports.updateAgentProfile = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'PATCH' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const _a = req.body, { profileId } = _a, updates = __rest(_a, ["profileId"]);
        if (!profileId) {
            res.status(400).json({ error: 'Missing profileId' });
            return;
        }
        const profileRef = db
            .collection('users')
            .doc(auth.userId)
            .collection('agentProfiles')
            .doc(profileId);
        const profileDoc = await profileRef.get();
        if (!profileDoc.exists) {
            res.status(404).json({ error: 'Agent profile not found' });
            return;
        }
        const now = new Date().toISOString();
        updates.updatedAt = now;
        await profileRef.update(updates);
        const updatedDoc = await profileRef.get();
        const profile = Object.assign({ id: updatedDoc.id }, updatedDoc.data());
        res.status(200).json({ profile });
    }
    catch (error) {
        console.error('Update agent profile error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * DELETE /deleteAgentProfile
 * Delete an agent profile
 */
exports.deleteAgentProfile = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'DELETE' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const instanceId = req.headers['x-instance-id'];
        const auth = await validateInstance(instanceId);
        if (!auth) {
            res.status(401).json({ error: 'Invalid or disconnected instance' });
            return;
        }
        const { profileId } = req.body;
        if (!profileId) {
            res.status(400).json({ error: 'Missing profileId' });
            return;
        }
        const profileRef = db
            .collection('users')
            .doc(auth.userId)
            .collection('agentProfiles')
            .doc(profileId);
        const profileDoc = await profileRef.get();
        if (!profileDoc.exists) {
            res.status(404).json({ error: 'Agent profile not found' });
            return;
        }
        await profileRef.delete();
        res.status(200).json({ ok: true });
    }
    catch (error) {
        console.error('Delete agent profile error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ─────────────────────────────────────────────────────────────
// Migration Helper (one-time use)
// ─────────────────────────────────────────────────────────────
/**
 * POST /migrate
 * Migrate legacy data to Firestore
 */
exports.migrate = functions.https.onRequest(async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { userId, tasks, activity } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'Missing userId' });
            return;
        }
        const results = { tasks: 0, activity: 0 };
        if (tasks && Array.isArray(tasks)) {
            const batch = db.batch();
            for (const task of tasks) {
                const ref = db.collection('users').doc(userId).collection('tasks').doc(task.id);
                batch.set(ref, task);
                results.tasks++;
            }
            await batch.commit();
        }
        if (activity && Array.isArray(activity)) {
            // Batch in chunks of 500 (Firestore limit)
            for (let i = 0; i < activity.length; i += 500) {
                const batch = db.batch();
                const chunk = activity.slice(i, i + 500);
                for (const event of chunk) {
                    const ref = db.collection('users').doc(userId).collection('activity').doc(event.id);
                    batch.set(ref, event);
                    results.activity++;
                }
                await batch.commit();
            }
        }
        res.status(200).json({ success: true, migrated: results });
    }
    catch (error) {
        console.error('Migrate error:', error);
        res.status(500).json({ error: String(error) });
    }
});
//# sourceMappingURL=index.js.map