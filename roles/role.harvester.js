var roleHarvester = {

    /** @param {Creep} creep **/
    run: function (creep) {

        // first new room claiming bootstrap
        if (creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return; // wait until we reach target room
        }

        if (creep.store[RESOURCE_ENERGY] <= 0) {
            creep.memory.harvesting = true;
        }
        // full energy -> transfer
        if (creep.store.getFreeCapacity() <= 0) {
            creep.memory.harvesting = false;
        }

        //creep in all stages are always harvesting (and never carrying)
        creep.memory.harvesting = true;

        // no energy -> harvest from assigned source
        var targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER); // TODO check if freecapacity restraint is needed
            }
        });
        var target = creep.pos.findClosestByPath(targets);
        if (creep.memory.harvesting && creep.memory.sourceID) {
            //var source = creep.room.find(creep.memory.sourceID);
            var assigned_source = Game.getObjectById(creep.memory.sourceID);
            if (creep.harvest(assigned_source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(assigned_source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            var closest_container_by_source = assigned_source.pos.findClosestByRange(targets);
            //always call move so that creep stands on container
            if (closest_container_by_source) {
                creep.moveTo(closest_container_by_source, { visualizePathStyle: { stroke: '#cc00ff' } });
            }
        }
        // transfer
        else {
            if (targets.length > 0) {
                // always call move so that creep stands on container
                creep.moveTo(target, { visualizePathStyle: { stroke: '#cc00ff' } });
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
            // no target -> do nothing
            else {
                creep.memory.harvesting = true;
            }
        }

    }
};

module.exports = roleHarvester;