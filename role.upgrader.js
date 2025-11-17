var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function (creep, struct) {

        // first new room claiming bootstrap
        if (creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return; // wait until we reach target room
        }

        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;

        }
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
            creep.memory.upgrading = true;
        }

        const ids = creep.room.memory.struct_ids;
        const link_ctrl = ids.link_controller_id ? Game.getObjectById(ids.link_controller_id) : null;
        const storage = creep.room.storage;

        // stage 1 behavior
        if (creep.room.memory.stage < 2) {
            if (creep.memory.upgrading) {

                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
            //collect energy
            else {
                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES)];
                var closest_DPoint = creep.pos.findClosestByRange(dropPoints);
                if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                }
            }
            // stage 2+ behavior
        } else {
            if (creep.memory.upgrading) {

                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }

            }
            // stage 2 should collect energy from storages or containers OR _link_ if available
            else {
                //check if link system is present -> use it
                if (creep.room.memory.link_avail_ug && link_ctrl) {
                    if (creep.withdraw(link_ctrl, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(link_ctrl, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                    return;
                }

                // no link system -> go collect energy manually
                // get dropped energy while upgrading (upgrader died on controller)
                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY })];
                var closest_DPoint = creep.room.controller.pos.findClosestByRange(dropPoints);
                if (creep.store.getFreeCapacity() > 0 && closest_DPoint && creep.pos.getRangeTo(closest_DPoint) <= 3) {
                    if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                }
                //if storage is available -> target it. otherwise target containers
                else {
                    let sources = [];

                    // 1 prefer storage
                    if (storage && storage.store[RESOURCE_ENERGY] > 0) {
                        sources.push(storage);
                    } else {
                        // 2 otherwise containers
                        for (const c of struct.containers) {
                            if (c.store[RESOURCE_ENERGY] > 0) sources.push(c);
                        }
                    }

                    if (sources.length === 0) return; // nothing to take

                    const target = creep.pos.findClosestByRange(sources);
                    if (!target) return;

                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            }
        }
    }
};

module.exports = roleUpgrader;