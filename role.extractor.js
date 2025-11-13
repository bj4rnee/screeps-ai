var roleExtractor = {

    /** @param {Creep} creep **/
    run: function (creep) {

        if (creep.memory.extracting && creep.carryCapacity == _.sum(creep.carry)) {
            creep.memory.extracting = false;
        }
        if (!creep.memory.extracting && 0 == _.sum(creep.carry)) {
            creep.memory.extracting = true;
        }

        // extract
        if (creep.memory.extracting) {
            var target;

            if (creep.memory.depositID) {
                target = Game.getObjectById(creep.memory.depositID);
            } else {
                var targets = creep.room.find(FIND_MINERALS);
                target = targets[0];
                creep.memory.depositID = target.id;
                creep.memory.mineralType = target.mineralType;
            }
            var closest_container_by_source = target.pos.findClosestByRange(creep.room.find(FIND_STRUCTURES, { filter: (structure) => { return (structure.structureType == STRUCTURE_CONTAINER); } }));
            // don't harvest when container is full (so no minerals get wasted)
            if (closest_container_by_source.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.harvest(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest_container_by_source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
            // container is full -> idle on deposit
            else {
                creep.moveTo(closest_container_by_source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};

module.exports = roleExtractor;