var nearestEnergy = {

    /** @param {Creep} creep **/
    run: function (creep) {
        // Storing sources to memory by ID and finding closest 
        var availableSources = creep.room.memory.sources;
        var serializedSources = []
        var i = 0;
        var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        for (let everySource in availableSources) {
            serializedSources.push(Game.getObjectById(availableSources[i]))
            var i = i + 1;
        }
        var closestSource = creep.pos.findClosestByPath(serializedSources);
        return closestSource;
    }
};

module.exports = nearestEnergy;