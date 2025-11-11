var roleBuilder = {

    /** @param {Creep} creep **/
    run: function (creep) {

        // first new room claiming bootstrap
        if (creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return; // wait until we reach target room
        }

        if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;//false
            //creep.say('🔄 collect');
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
            //creep.say('🚧 build');
        }
        if (creep.room.memory.stage < 2) {
            if (creep.memory.building) {
                var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (targets.length) {
                    if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#00ff0d' } });
                    }
                }
                else {
                    // no construction -> repair
                    var repair_target = _.filter(creep.room.find(FIND_STRUCTURES), (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL);
                    if (repair_target.length == 0) {
                        repair_target = _.filter(creep.room.find(FIND_STRUCTURES), (s) => s.hits < s.hitsMax).sort(function (a, b) { return +a.hits - +b.hits }); //&& s.structureType != STRUCTURE_WALL);
                    }
                    if (creep.repair(repair_target[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(repair_target[0], { visualizePathStyle: { stroke: '#00ff0d' } });
                    }
                }
            }
            else {
                // try to pick up dropped energy first
                const dropPoints = creep.room.find(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50 });

                if (dropPoints.length > 0) {
                    const closestDrop = creep.pos.findClosestByPath(dropPoints);
                    if (closestDrop) {
                        if (creep.pickup(closestDrop) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(closestDrop, { visualizePathStyle: { stroke: '#0095ff' } });
                        }
                        return; // stop here; don’t try to harvest this tick
                    }
                }

                // if no dropped energy found, harvest directly from source
                const sources = creep.room.find(FIND_SOURCES_ACTIVE);
                if (sources.length > 0) {
                    const closestSource = creep.pos.findClosestByPath(sources);
                    if (closestSource) {
                        if (creep.harvest(closestSource) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(closestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                }
            }
            // stage 2+ behavior
        } else {
            if (creep.memory.building) {
                var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (targets.length) {
                    if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#00ff0d' } });
                    }
                }
                else {
                    // no construction -> repair
                    // remember stage 2 has a tower to repair
                    // TODO fill tower when idle
                    repair_target = _.filter(creep.room.find(FIND_STRUCTURES), (s) => s.hits < s.hitsMax).sort(function (a, b) { return +a.hits - +b.hits }); //&& s.structureType != STRUCTURE_WALL);
                    if (creep.repair(repair_target[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(repair_target[0], { visualizePathStyle: { stroke: '#00ff0d' } });
                    }
                }
            }
            // stage 2 should collect energy from storages or containers
            else {
                //if storage is available -> target it. otherwise target both
                if (creep.room.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_STORAGE); } }).length > 0) {//&& structure.store[RESOURCE_ENERGY] > 0
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
};

module.exports = roleBuilder;