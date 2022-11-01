var roleBuilder = {

    /** @param {Creep} creep **/
    run: function (creep) {

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
                var sources = creep.room.find(FIND_SOURCES_ACTIVE);
                var closestSource = creep.pos.findClosestByPath(sources);
                if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[0], { visualizePathStyle: { stroke: '#ffaa00' } });
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