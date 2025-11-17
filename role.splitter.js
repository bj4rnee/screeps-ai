// the splitter collects energy from a central storage and distributes it to [spawn, extension, tower, link, terminal]
// priority                                                                   1      1          2      3     4
var roleSplitter = {

    /** @param {Creep} creep **/
    run: function (creep, struct) {
        // no energy -> collect
        if (creep.store[RESOURCE_ENERGY] <= 0) {
            creep.memory.collecting = true;
        }
        // full energy -> split
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.collecting = false;
        }

        const storage = creep.room.storage; // simpler than .find
        const terminal = creep.room.terminal;
        const ids = creep.room.memory.struct_ids;
        const main_spawn_id = Memory.rooms[creep.room.name].struct_ids.main_spawn_id;


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
                // storage is empty -> idle
                else {
                    creep.moveTo(Game.getObjectById(main_spawn_id), { visualizePathStyle: { stroke: '#ffffff' } });
                    creep.memory.collecting = false;
                }
            }
        }

        // split logic
        else {
            // target definitions
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
            var link_targets = [];
            const link_base = ids.link_base_id ? Game.getObjectById(ids.link_base_id) : null;
            if (link_base && link_base.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && link_base.store[RESOURCE_ENERGY] <= (link_base.store.getCapacity(RESOURCE_ENERGY) * 0.85)) {
                link_targets.push(link_base);
            }

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
                            creep.moveTo(Game.getObjectById(main_spawn_id), { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                }
            }
        }
    }
};

module.exports = roleSplitter;
