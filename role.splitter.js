// the splitter collects energy from a central storage and distributes it to [spawn, extension, tower, link]
// priority                                                                   1      1          2      3
var roleSplitter = {

    /** @param {Creep} creep **/
    run: function (creep) {
        // no energy -> collect
        if (creep.store[RESOURCE_ENERGY] <= 0) {
            creep.memory.collecting = true;
        }
        // full energy -> split
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.collecting = false;
        }

        // collect logic
        if (creep.memory.collecting && creep.store.getFreeCapacity() > 0) {


            var storage = [...creep.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_STORAGE })];

            var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY })];
            var closest_DPoint = creep.pos.findClosestByRange(dropPoints);

            // if theres dropped energy near source (carriers died)
            if (creep.pos.getRangeTo(closest_DPoint) <= 6) {
                if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                }
            } else {
                if (storage[0].store.energy > 0) {
                    if (creep.withdraw(storage[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage[0], { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                }
                // storgae is empty -> idle
                else { 
                    console.log("[ERROR] cannot split, no energy in storage");
                    creep.moveTo(creep.pos.findClosestByRange(creep.room.find(FIND_MY_SPAWNS)), { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }

        // split logic
        else {
            // target definitions
            var prio_targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            var defense_targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_TOWER) && (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) && (structure.structureType == STRUCTURE_TOWER ? (structure.store[RESOURCE_ENERGY] <= (structure.energyCapacity * 0.85)) : true);
                }
            });
            var link_targets = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_LINK) && (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) && (s.structureType == STRUCTURE_LINK ? (s.store[RESOURCE_ENERGY] <= (s.energyCapacity * 0.85)) : true);
                }
            });
            // NOTE link_targets becomes a singular target object at this point
            link_targets = creep.room.find(FIND_MY_SPAWNS)[0].pos.findInRange(link_targets, 6);


            if (prio_targets.length > 0) {
                var t = creep.pos.findClosestByPath(prio_targets);
                if (creep.transfer(t, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(t, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }

            // no priority target -> fill tower and storage
            else {
                if (defense_targets.length > 0) {
                    var closest_dft = creep.pos.findClosestByPath(defense_targets);
                    if (creep.transfer(closest_dft, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest_dft, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                } else {

                    if (link_targets) {
                        if (creep.transfer(link_targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(link_targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                    else { // absolutely no target -> idle
                        creep.memory.collecting = true;
                        console.log(creep.room.find(FIND_MY_SPAWNS)[0]);
                        creep.moveTo(creep.room.find(FIND_MY_SPAWNS)[0], { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
        }
    }
};

module.exports = roleSplitter;
