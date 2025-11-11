// the splitter collects energy from a central storage and distributes it to [spawn, extension, tower, link, terminal]
// priority                                                                   1      1          2      3     4
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

        var storage = creep.room.storage; // simpler than .find

        // collect logic
        if (creep.memory.collecting && creep.store.getFreeCapacity() > 0) {

            var dropPoints = [...creep.room.find(FIND_DROPPED_RESOURCES, { filter: (r) => r.resourceType == RESOURCE_ENERGY && r.amount >= 100 })];
            var closest_DPoint = creep.pos.findClosestByRange(dropPoints);

            // if theres dropped energy near source (carriers died)
            if (creep.pos.getRangeTo(closest_DPoint) <= 6) {
                if (creep.pickup(closest_DPoint, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest_DPoint, { visualizePathStyle: { stroke: '#0095ff' } });
                }
            } else {
                if (storage && storage.store.energy > 0) {
                    if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, { visualizePathStyle: { stroke: '#0095ff' } });
                    }
                }
                // storgae is empty -> idle
                else {
                    //console.log("[ERROR] cannot split, no energy in storage");
                    creep.moveTo(creep.pos.findClosestByRange(creep.room.find(FIND_MY_SPAWNS)), { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }

        // split logic
        else {
            // target definitions

            var main_spawn_id = Memory.rooms[creep.room.name].mainSpawnId;

            if (!main_spawn_id) {
                // fallback: pick the first available spawn in the room
                var fallback = creep.room.find(FIND_MY_SPAWNS)[0];
                if (!fallback) return;
                main_spawn_id = fallback.id;
            }

            var prio_targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION || (structure.structureType === STRUCTURE_SPAWN && structure.id === main_spawn_id)) &&
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
            var terminal = creep.room.terminal;


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

                    if (link_targets.length > 0) {
                        if (creep.transfer(link_targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(link_targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                    else {
                        if (terminal && terminal.store[RESOURCE_ENERGY] <= 250000 && storage && storage.store[RESOURCE_ENERGY] >= 250000) {
                            if (creep.transfer(terminal, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(terminal, { visualizePathStyle: { stroke: '#ffffff' } });
                            }
                        }
                        else { // absolutely no target -> idle
                            creep.memory.collecting = true;
                            creep.moveTo(creep.room.find(FIND_MY_SPAWNS)[0], { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                }
            }
        }
    }
};

module.exports = roleSplitter;
