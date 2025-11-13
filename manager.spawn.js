const { queueCreep, dequeueCreep, initRoomMemory } = require('creep-queue');

/** generate a UUID for creep names
 * @param {*} roomName string
 * @returns string UUID
 */
function genUUID(roomName) {
    var d = new Date().getTime(); // Timestamp
    var d2 = 0;
    // replace 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' for RFC4122 v4 UUID
    return roomName + '-xxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16; // random number between 0 and 16
        if (d > 0) { // Use timestamp until depleted
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else { // Use microseconds since page-load if supported
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/** find the next unassigned source for role
 * @param {*} room
 * @param {*} role
 * @param {*} sources - list of sources in room
 * @returns source | null
 */
function nextUnassignedSource(room, role, sources) {
    if (!sources || sources.length === 0) return null;
    const creeps = _.filter(Game.creeps, c => c.memory.role === role && c.room.name === room.name && !c.memory.targetRoom);
    const queued = room.memory.spawn_queue.filter(e => e.role === role && (!e.memory || !e.memory.targetRoom));
    for (let source of sources) {
        var assignedLive = creeps.some(h => h.memory.sourceID === source.id);
        var assignedQueued = queued.some(e => e.memory && e.memory.sourceID === source.id);
        if (role === 'extractor') { // check for depositID instead
            assignedLive = creeps.some(h => h.memory.depositID === source.id);
            assignedQueued = queued.some(e => e.memory && e.memory.depositID === source.id);
        }
        if (!assignedLive && !assignedQueued) {
            return source;
        }
    }
    return null;
}

/** find the next unassigned container for role
 * @param {Room} room
 * @param {string} role
 * @param {StructureContainer[]} containers - list of containers in the room
 * @returns {StructureContainer | null}
 */
function nextUnassignedContainer(room, role, containers) {
    if (!containers || containers.length === 0) return null;

    const creeps = _.filter(Game.creeps, c => c.memory.role === role && c.room.name === room.name && !c.memory.targetRoom);
    const queued = room.memory.spawn_queue.filter(e => e.role === role && (!e.memory || !e.memory.targetRoom));

    for (let container of containers) {
        const assignedLive = creeps.some(c => c.memory.containerID === container.id);
        const assignedQueued = queued.some(e => e.memory && e.memory.containerID === container.id);
        if (!assignedLive && !assignedQueued) {
            return container;
        }
    }
    return null;
}

/** get optimal spawnId for a role (nearest to predicted target)
 * @param {*} room
 * @param {*} spawns
 * @param {*} role
 * @param {*} sources
 * @returns spawnId | null
 */
function getSpawnIdForRole(room, spawns, role, sources = null) {
    if (spawns.length <= 1) return null;

    let targetPos;
    if (role === 'harvester' || role === 'extractor') {
        const nextSource = nextUnassignedSource(room, role, sources);
        if (nextSource) targetPos = nextSource.pos;
    } else if (role === 'upgrader') {
        targetPos = room.controller.pos;
    }
    // TODO: add more

    if (targetPos) {
        const closestSpawn = targetPos.findClosestByPath(spawns);
        return closestSpawn ? closestSpawn.id : null;
    }
    return null;
}

/** manage spawning: queue if needed, then dequeue. Called once per tick per room.
 * @param {Room} room
 * @param {Number} stage - room stage integer
 */
function manageSpawns(room, struct) {
    const stage = room.memory.stage || 1;
    initRoomMemory(room);

    // helper to count live + queued for a role
    function countRole(role) {
        const live = _.filter(Game.creeps, c => c.memory.role === role && c.room.name === room.name && !c.memory.targetRoom).length;
        const queued = room.memory.spawn_queue.filter(e => e.role === role && !e.memory.targetRoom).length;
        return live + queued;
    }

    // this is basically test code
    switch (stage) {
        case 1:
            if (countRole('harvester') < struct.e_sources.length) {
                const newName = 'H-' + genUUID(room.name);
                const body = [WORK, WORK, MOVE];
                const memory = { sourceID: nextUnassignedSource(room, 'harvester', struct.e_sources).id || null };
                const spawnId = getSpawnIdForRole(room, struct.spawns, 'harvester', struct.e_sources);
                queueCreep(room, body, newName, 'harvester', memory, spawnId, null, true); // compute directions like so: [findPath(nearestSpawn.pos, source.pos).path.pop().direction]
            }
            if (countRole('carrier') < struct.e_sources.length && !room.memory.init) {
                const newName = 'C-' + genUUID(room.name);
                const body = [MOVE, MOVE, CARRY, CARRY];
                const memory = { sourceID: nextUnassignedSource(room, 'carrier', struct.e_sources).id || null };
                queueCreep(room, body, newName, 'carrier', memory);
            }
            if (countRole('upgrader') < 1 && !room.memory.init) {
                const newName = 'U-' + genUUID(room.name);
                const body = [WORK, CARRY, CARRY, MOVE, MOVE];
                queueCreep(room, body, newName, 'upgrader');
            }
            if (countRole('builder') < 2 && struct.construction_sites.length > 0 && !room.memory.init) {
                const newName = 'B-' + genUUID(room.name);
                const body = [WORK, CARRY, CARRY, MOVE, MOVE];
                queueCreep(room, body, newName, 'builder');
            }
            break;
        case 2:
            // energy save mode -> prioritise harvesters and carriers
            var nb = 1;
            var nu = 1;
            if (room.memory.energyfull) var nu = 2;
            if (room.memory.attacked) { nu = 1; nb = 0; }
            if (struct.construction_sites.length <= 0) nb = 0;

            if (countRole('harvester') < struct.e_sources.length) {
                const newName = 'H-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, WORK, WORK, MOVE];
                const memory = { sourceID: nextUnassignedSource(room, 'harvester', struct.e_sources).id || null };
                const spawnId = getSpawnIdForRole(room, struct.spawns, 'harvester', struct.e_sources);
                queueCreep(room, body, newName, 'harvester', memory, spawnId, null, true);
            }
            if (countRole('builder') < nb) {
                const newName = 'B-' + genUUID(room.name);
                const body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
                queueCreep(room, body, newName, 'builder');
            }
            if (countRole('upgrader') < nu) {
                const newName = 'U-' + genUUID(room.name);
                const body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'upgrader');
            }
            if (countRole('carrier') < struct.e_sources.length) {
                const newName = 'C-' + genUUID(room.name);
                const body = [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];
                const memory = { containerID: nextUnassignedContainer(room, 'carrier', struct.containers_by_source).id || null };
                queueCreep(room, body, newName, 'carrier', memory);
            }
            break;
        case 3:
            var nb = 1;
            var nu = 1;
            var nd = 0;
            var ns = 1;
            if (room.memory.energyfull) { var nu = 3; }
            if (room.memory.link_avail_ug) nu = 1;
            if (room.memory.attacked) { nd = 1; nu = 1; nb = 0; }
            if (struct.construction_sites.length <= 0) nb = 0;

            if (countRole('harvester') < struct.e_sources.length) {
                const newName = 'H-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE];
                const memory = { sourceID: nextUnassignedSource(room, 'harvester', struct.e_sources).id || null };
                const spawnId = getSpawnIdForRole(room, struct.spawns, 'harvester', struct.e_sources);
                queueCreep(room, body, newName, 'harvester', memory, spawnId, null, true);
            }
            if (countRole('builder') < nb) {
                const newName = 'B-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'builder');
            }
            if (countRole('upgrader') < nu) {
                const newName = 'U-' + genUUID(room.name);
                const body = room.memory.link_avail_ug ? [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY] : [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'upgrader', {}, getSpawnIdForRole(room, struct.spawns, 'upgrader'));
            }
            if (countRole('defender') < nd) {
                const newName = 'D-' + genUUID(room.name);
                const body = [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'defender');
            }
            if (countRole('carrier') < struct.e_sources.length) {
                const newName = 'C-' + genUUID(room.name);
                const body = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY];
                const memory = { containerID: nextUnassignedContainer(room, 'carrier', struct.containers_by_source).id || null };
                queueCreep(room, body, newName, 'carrier', memory);
            }
            if (countRole('splitter') < ns) {
                const newName = 'S-' + genUUID(room.name);
                const body = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY];
                queueCreep(room, body, newName, 'splitter');
            }
            break;
        case 4:
            var nb = 0;
            var nu = 1;
            var nd = 0;
            var ns = 1;
            if (room.memory.energyfull) { var nb = 1; var nu = 3; }
            if (room.memory.link_avail_ug) nu = 1;
            if (room.memory.attacked) { nd = 1; nu = 1; nb = 0; }
            if (struct.construction_sites.length <= 0) nb = 0;

            if (countRole('harvester') < struct.e_sources.length) {
                const newName = 'H-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE];
                const memory = { sourceID: nextUnassignedSource(room, 'harvester', struct.e_sources).id || null };
                const spawnId = getSpawnIdForRole(room, struct.spawns, 'harvester', struct.e_sources);
                queueCreep(room, body, newName, 'harvester', memory, spawnId, null, true);
            }
            if (countRole('builder') < nb) {
                const newName = 'B-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'builder');
            }
            if (countRole('upgrader') < nu) {
                const newName = 'U-' + genUUID(room.name);
                const body = room.memory.link_avail_ug ? [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY] : [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'upgrader', {}, getSpawnIdForRole(room, struct.spawns, 'upgrader'));
            }
            if (countRole('defender') < nd) {
                const newName = 'D-' + genUUID(room.name);
                const body = [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE];
                queueCreep(room, body, newName, 'defender');
            }
            if (countRole('carrier') < struct.e_sources.length + struct.m_sources.length) { // every e_source + dedicated mineral carrier
                const newName = 'C-' + genUUID(room.name);
                const body = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY];
                const memory = { containerID: nextUnassignedContainer(room, 'carrier', struct.containers).id || null };
                queueCreep(room, body, newName, 'carrier', memory);
            }
            if (countRole('splitter') < ns) {
                const newName = 'S-' + genUUID(room.name);
                const body = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY];
                queueCreep(room, body, newName, 'splitter');
            }
            if (countRole('extractor') < struct.m_sources.length) {
                const newName = 'E-' + genUUID(room.name);
                const body = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE];
                const memory = { depositID: nextUnassignedSource(room, 'extractor', struct.m_sources).id || null };
                queueCreep(room, body, newName, 'extractor', memory, {}, getSpawnIdForRole(room, struct.spawns, 'extractor', struct.m_sources));
            }
            break;
        case 5:
            console.log("[ERROR] not implemented yet");
            break;
        default:
            console.log("[ERROR] could not detect game's stage");
            break;
    }

    // After queuing, attempt to spawn
    dequeueCreep(room);

    // visualize spawning
    for (let spawn of struct.spawns) {
        if (!spawn.spawning) continue;
        const spawningCreep = Game.creeps[spawn.spawning.name];

        const remaining = spawn.spawning.remainingTime;
        const total = spawn.spawning.needTime;
        const ratio = (1 - (remaining / total));
        const percent = Math.floor(ratio * 100);

        let color;
        if (ratio < 0.5) {
            // 0-50%: red -> yellow
            const t = ratio / 0.5;
            const r = 255;
            const g = Math.floor(170 * t);
            const b = 0;
            color = `rgb(${r},${g},${b})`;
        } else {
            // 50-100%: yellow -> green
            const t = (ratio - 0.5) / 0.5;
            const r = Math.floor(255 * (1 - t));
            const g = 170 + Math.floor(85 * t);
            const b = 0;
            color = `rgb(${r},${g},${b})`;
        }
        const posX = spawn.pos.x + 1;
        const posY = spawn.pos.y;

        spawn.room.visual.text(
            `♻️ ${spawningCreep.memory.role}`,
            posX,
            posY,
            {
                align: 'left',
                opacity: 1.0,
                color: '#ffffff',
                font: '0.8 monospace'
            }
        );

        // Creep name below
        spawn.room.visual.text(
            spawningCreep.name,
            posX,
            posY + 0.6,
            {
                align: 'left',
                opacity: 1.0,
                color: '#999999',
                font: '0.7 monospace'
            }
        );

        const barWidth = 4;
        const filledWidth = ratio * barWidth;
        const barY = posY + 1.1;
        spawn.room.visual.line(
            { x: posX, y: barY },
            { x: posX + filledWidth, y: barY },
            { color, width: 0.15, opacity: 1.0 }
        );

        spawn.room.visual.line(
            { x: posX + filledWidth, y: barY },
            { x: posX + barWidth, y: barY },
            { color: '#333333', width: 0.15, opacity: 0.7, lineStyle: 'dotted' }
        );

        spawn.room.visual.text(
            `${percent}%`,
            posX + barWidth + 0.2,
            barY + 0.05,
            {
                align: 'left',
                opacity: 1.0,
                color,
                font: '0.7 monospace'
            }
        );
    }
}

module.exports = {
    manageSpawns,
    genUUID,
}
