var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function (creep) {

        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;//false
            //creep.say('🔄 collect');
        }
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
            creep.memory.upgrading = true;
            //creep.say('⚡ upgrade');
        }
        if (creep.room.memory.stage < 2) {
            if (creep.memory.upgrading) {

                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
            //collect energy
            else {
                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES)];
                var closest_DPoint = creep.pos.findClosestByPath(dropPoints);
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

                // collect dropped energy while upgrading (upgrader died on controller)
                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY })];
                var closest_DPoint = creep.room.controller.pos.findClosestByRange(dropPoints);
                if (creep.store.getFreeCapacity() > 0 && closest_DPoint && creep.pos.getRangeTo(closest_DPoint) <= 6) {
                    if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                }
                else {
                    //check if link system is present -> use it
                    if (creep.room.memory.link_avail_ug) {
                        var link_controller = creep.room.controller.pos.findClosestByRange(creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } }));
                        if (creep.withdraw(link_controller, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(link_controller, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    // no link system -> go collect energy manually
                    } else {
                        //if storage is available -> target it. otherwise target both
                        if (creep.room.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_STORAGE); } }).length > 0) {// TODO maybe remove energy requirement
                            var csources = creep.room.find(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_STORAGE) && structure.store[RESOURCE_ENERGY] > 0;
                                }
                            });
                        } else {
                            var csources = creep.room.find(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_STORAGE) &&
                                        structure.store[RESOURCE_ENERGY] > 0;
                                }
                            });
                        }
                        var closestCSource = creep.pos.findClosestByPath(csources);

                        if (creep.withdraw(closestCSource, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(closestCSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                }
            }
        }
    }
};

module.exports = roleUpgrader;