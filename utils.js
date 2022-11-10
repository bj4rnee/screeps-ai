var nearestEnergy = {

    /** @param {Creep} creep **/
    run: function (creep) {
        // Storing sources to memory by ID and finding closest 
        var availableSources = creep.room.memory.sources;
        var serializedSources = []
        var i = 0;
        var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        for (let everySource in availableSources) {
            serializedSources.push(Game.getObjectById(availableSources[i]))
            var i = i + 1;
        }
        var closestSource = creep.pos.findClosestByPath(serializedSources);
        return closestSource;
    }
};

module.exports = nearestEnergy;

function ifoq(room, attributes, name, role) {
    var keypointer = Math.max.apply(0, Object.keys(room.memory.spawn_queue));

    // if queue doesn't contain elements
    if (!Number.isFinite(keypointer)) {
        room.memory.spawn_queue[0] = [attributes, name, role];
        return true;
    }

    // we must shift the queue
    for (let i = keypointer; keypointer >= 0; keypointer--) {
        room.memory.spawn_queue[i + 1] = room.memory.spawn_queue[i];
    }
    room.memory.spawn_queue[0] = [attributes, name, role];
    return true;
}

/** Add a creep to the rooms spawn queue
 * 
 * @param {*} room Room object
 * @param {*} attributes An array describing the new creep’s body
 * @param {*} name Name of new creep
 * @param {*} role Role of new creep
 * @param {*} skip true if creep should be placed in front of queue
 * @returns true
 */
function queueCreep(room, attributes, name, role, skip = false) {
    if (skip) {
        return ifoq(room, attributes, name, role);
    }
    var keypointer = Math.max.apply(0, Object.keys(room.memory.spawn_queue));
    // queue is empty
    if (!Number.isFinite(keypointer)) {
        keypointer = -1; // +1 will be added to kp, so first entry is 0
    }
    //room.memory.spawn_queue = { 0: [attributes, name, role] };
    room.memory.spawn_queue[(keypointer + 1)] = [attributes, name, role];
    return true;
}

/** Spawn the first creep from rooms queue
 * 
 * @param {*} room Room object
 * @param {*} dryRun true if the operation should only check if it is possible
 * @param {*} force true if creep should be removed from queue even if operation failed
 * @returns true if successful
 */
function dequeueCreep(room, dryRun = false, force = false) {
    var keypointer = Math.max.apply(0, Object.keys(room.memory.spawn_queue));
    // queue is empty
    if (!Number.isFinite(keypointer)) {
        return false;
    }
    // list of spawns that are not currently spawnign a creep
    var avail_spawns = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_SPAWN && !s.spawning });
    let c = room.memory.spawn_queue[keypointer];
    let res = avail_spawns[0].spawnCreep(c[0], c[1], { memory: { role: c[2] }, dryRun: dryRun });
    if (res === OK) {
        delete room.memory.spawn_queue[keypointer];
        return true;
    } else {
        //could not spawn creep -> probably busy or not enough energy
        if (force) {
            delete room.memory.spawn_queue[keypointer];
        }
    }
    return false;
}

module.exports = {
    dequeueCreep: dequeueCreep,
    queueCreep: queueCreep
}