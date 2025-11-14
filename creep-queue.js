/** init room memory for spawning if needed */
function initRoomMemory(room, force = false) {
    if (!room.memory.spawn_queue || force) {
        room.memory.spawn_queue = [];
    }
}

/** add a creep to rooms spawn queue
 * @param {Room} room
 * @param {Array} body
 * @param {String} name
 * @param {String} role
 * @param {String|null} spawnId - specific spawn ID, or null for any
 * @param {Array|null} directions - array of exit directions (e.g. [TOP, TOP_LEFT])
 * @param {Boolean} priority - insert at front if true
 * @returns {Boolean}
 */
function queueCreep(room, body, name, role, memory = null, spawnId = null, directions = null, priority = false) {
    const entry = { body, name, role, spawnId, directions, memory: memory || {} };
    if (priority) {
        room.memory.spawn_queue.unshift(entry);
    } else {
        room.memory.spawn_queue.push(entry);
    }
    return true;
}

/** Attempt to spawn the next creep(s) from queue
 * @param {Room} room
 * @param {Boolean} dryRun - Check only, don't spawn
 * @param {Boolean} force - Remove even if spawn fails
 * @returns {Boolean} - True if at least one spawned
 */
function dequeueCreep(room, dryRun = false, force = false) {
    if (room.memory.spawn_queue.length === 0) return false;

    // track which spawns spawned this tick
    let spawned = {};
    // copy queue to avoid mutation issues during iteration
    const queue = [...room.memory.spawn_queue];
    room.memory.spawn_queue = []; // Reset and re-add unprocessed

    // get available spawns
    let availSpawns = room.find(FIND_MY_SPAWNS).filter(s => !s.spawning);

    for (let entry of queue) {
        const { body, name, role, spawnId, directions, memory } = entry;


        // prefer specified spawnId if available
        let targetSpawn = spawnId ? availSpawns.find(s => s.id === spawnId) : null;

        // skip this spawn if already spawned something this tick
        if (targetSpawn && spawned[targetSpawn.name]) {
            if (force) continue;
            room.memory.spawn_queue.push(entry);
            continue;

        }
        if (!targetSpawn && spawnId) {
            // specified spawn unavailable, skip or force remove
            if (force) continue;
            room.memory.spawn_queue.push(entry); // skip -> re-queue
            continue;
        }
        if (!targetSpawn) {
            // fallback to any available that hasn't spawned yet
            const freeSpawn = availSpawns.find(s => !spawned[s.name]);
            if (!freeSpawn) {
                room.memory.spawn_queue.push(entry);
                continue;
            }
            targetSpawn = freeSpawn;
        }

        // merge custom creep memory
        const creepMemory = Object.assign({ role }, memory || {});

        const options = {
            memory: creepMemory,
            directions: directions || undefined,
            dryRun: true // always dry-run first to check energy
        };

        // dry
        const dryResult = targetSpawn.spawnCreep(body, name, options);
        if (dryResult !== OK) {
            if (force) continue; // remove anyway
            room.memory.spawn_queue.push(entry); // re-queue
            continue;
        }

        if (dryRun) {
            // if dryRun mode, don't actually spawn, but mark as "would spawn"
            spawned[targetSpawn.name] = true;
            continue;
        }

        // actual spawn
        options.dryRun = false;
        const result = targetSpawn.spawnCreep(body, name, options);

        if (result === OK) {
            console.log(`Spawned ${role}: ${name} at ${targetSpawn.name}`);
            spawned[targetSpawn.name] = true;
        } else {
            const shouldRequeue = (
                result === ERR_NOT_ENOUGH_ENERGY ||
                result === ERR_BUSY
            );

            if (shouldRequeue && !force) {
                room.memory.spawn_queue.push(entry); // re-queue
            }

            // log error and drop creep
            if (result !== ERR_NOT_ENOUGH_ENERGY && result !== ERR_BUSY) {
                console.log(`[ERROR] Unable to spawn ${name} (${role}): ${result}`);
            }
        }
    }

    return Object.values(spawned).some(v => v);
}

module.exports = {
    queueCreep,
    dequeueCreep,
    initRoomMemory,
}
