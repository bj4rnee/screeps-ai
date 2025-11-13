/** manage room stage and related memory flags
 * @param {*} room - room object
 * @param {*} struct - all structures room
 */
function manageStage(room, struct) {

    let controllerLevel = room.controller.level;
    // RCL 0-2
    if (controllerLevel < 3) {
        room.memory.stage = 1;
    }
    // RCL 3 and 2 containers
    if (controllerLevel == 3 && struct.containers.length >= 2) {
        room.memory.stage = 2;
    }
    // RCL 4-5 and storage
    if (controllerLevel > 3 && controllerLevel < 6 && struct.storage) {
        room.memory.stage = 3;
    }
    // RCL 6-7 and terminal + extractor
    if (controllerLevel > 5 && controllerLevel < 8 && struct.terminal && struct.extractor) {
        room.memory.stage = 4;
    }
    // RCL 8 and nuker + factory
    if (controllerLevel > 7 && struct.nuker && struct.factory) {
        room.memory.stage = 4;
    }

    // if a link system is available for upgraders to use (contr lvl 5+ only)
    room.memory.link_avail_ug = (struct.links.length >= 2) ? true : false; 

    // store mineral type in room memory
    if (!room.memory.mineralType) {
        if (room.find(FIND_MINERALS).length >= 1) {
            room.memory.mineralType = room.find(FIND_MINERALS)[0].mineralType;
        } else { room.memory.mineralType = "none"; }
    }

    // check if under attack
    if (room.find(FIND_HOSTILE_CREEPS).length > 0) {
        room.memory.attacked = true;
    }
    else {
        room.memory.attacked = false;

    }

    // energy full flag for towers
    if (room.energyAvailable < (room.energyCapacityAvailable - ((struct.spawns.length - 1) * 300))) {
        room.memory.energyfull = false;
    } else {
        room.memory.energyfull = true;
    }

    // tower wall repair flag
    if (room.storage && room.storage.store[RESOURCE_ENERGY] >= room.storage.store.getCapacity() * 0.75) {
        room.memory.tower_repair_walls = false;
    } else {
        room.memory.tower_repair_walls = false;
    }

    // initialization check 
    // also implemented a little safeguard here, if room has less than 2 creeps it is considered to be in danger
    // therefore we need to bootstrap it with stage 1
    const roomCreeps = _.filter(Game.creeps, c => c.room.name == room.name);
    if (roomCreeps.length < 2) {
        room.memory.stage = 1;
    }
    if (roomCreeps.length < 1) {
        room.memory.init = true;
    } else {
        room.memory.init = undefined;
    }
}

module.exports = {
    manageStage,
}
