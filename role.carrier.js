// the carrier collects energy from ASSIGNED!!! containers! and storages! and transfers it to [spawn, extension, tower, (link)]
BASE_MINERALS = ["H", "O", "U", "K", "L", "Z", "X"];
var roleCarrier = {

    /** @param {Creep} creep **/
    run: function (creep) {
        // no energy -> collect
        if (creep.store[RESOURCE_ENERGY] <= 0) {
            creep.memory.collecting = true;
        }
        // full energy -> transfer
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.collecting = false;
        }
        if (creep.room.memory.stage < 2) {
            if (creep.memory.collecting && creep.store.getFreeCapacity() > 0 && creep.memory.sourceID) {
                var assigned_source = Game.getObjectById(creep.memory.sourceID);
                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES)];
                var closest_DPoint = assigned_source.pos.findClosestByRange(dropPoints);
                if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                }

            }
            // transfer logic
            else {
                var prio_targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });

                if (prio_targets.length > 0) {
                    if (creep.transfer(prio_targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(prio_targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                    // no target -> idle
                } else {
                    creep.memory.collecting = true;
                    creep.moveTo(Game.spawns['spawn0'], { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
        // stage 2+ logic
        else {
            // collect logic
            if (creep.memory.collecting && creep.store.getFreeCapacity() > 0 && creep.memory.containerID) {
                var assigned_csource = Game.getObjectById(creep.memory.containerID);

                var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY })];
                var closest_DPoint = assigned_csource.pos.findClosestByRange(dropPoints);

                var csources = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_STORAGE) && //TODO STRUCTURE_STORAGE could become dangerous in this place!!
                            structure.store[RESOURCE_ENERGY] > 0;
                    }
                });
                var closest_csource = creep.pos.findClosestByPath(csources);

                // if theres dropped energy near source (carriers died)
                if (creep.pos.getRangeTo(closest_DPoint) <= 6) {
                    if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                } else {
                    //check contents of container -> if mineral is found, take it
                    if(!creep.memory.mineralType && Object.keys(assigned_csource.store).some(item => BASE_MINERALS.includes(item))){
                    var m_target = creep.room.find(FIND_MINERALS)[0];
                    creep.memory.mineralType = m_target.mineralType;
                    }
                    var res_to_wd = creep.memory.mineralType ? creep.memory.mineralType : RESOURCE_ENERGY;
                    if (creep.withdraw(assigned_csource, res_to_wd) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(assigned_csource, { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                }
            }
            // transfer logic
            else {

                // important: if theres splitters, we just need to fill the central storage
                var storage = [...creep.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_STORAGE })];
  
                if (_.filter(Game.creeps, (creep) => creep.memory.role == 'splitter').length > 0 && storage[0].store.getFreeCapacity() > 0) {
                    if (creep.transfer(storage[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage[0], { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }

                // no splitters available -> carrier must distribute
                else {
                    var prio_targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                        }
                    });

                    if (prio_targets.length > 0) {
                        if (creep.transfer(prio_targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(prio_targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                    // no priority target -> fill tower and storage
                    else {
                        var defense_targets = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_TOWER) && (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) && (structure.structureType == STRUCTURE_TOWER ? (structure.store[RESOURCE_ENERGY] <= (structure.energyCapacity * 0.85)) : true);
                            }
                        });
                        var all_targets = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_LINK || structure.structureType == STRUCTURE_TOWER || structure.structureType == STRUCTURE_STORAGE) &&
                                    (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) && (structure.structureType == STRUCTURE_TOWER ? (structure.store[RESOURCE_ENERGY] <= (structure.energyCapacity * 0.85)) : true);
                            }
                        });

                        if (defense_targets.length > 0) {
                            var closest_dft = creep.pos.findClosestByPath(defense_targets);
                            if (creep.transfer(closest_dft, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(closest_dft, { visualizePathStyle: { stroke: '#ffffff' } });
                            }
                        } else {

                            if (all_targets.length > 0) {
                                if (creep.transfer(all_targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(all_targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                                }
                            }
                            else { // absolutely no target -> idle
                                creep.memory.collecting = true;
                                creep.moveTo(creep.pos.findClosestByRange(creep.room.find(FIND_MY_SPAWNS)), { visualizePathStyle: { stroke: '#ffffff' } });
                            }
                        }
                    }
                }
            }
        }
    }
};

module.exports = roleCarrier;