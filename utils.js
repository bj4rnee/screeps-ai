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

function queueCreep(room, attributes, name, role) {
    var keypointer = Math.max.apply(0, Object.keys(room.memory.spawn_queue));
    // queue is empty
    if (!Number.isFinite(keypointer)) {
        keypointer = -1; // +1 will be added to kp, so first entry is 0
    }
    //room.memory.spawn_queue = { 0: [attributes, name, role] };
    room.memory.spawn_queue[(keypointer + 1)] = [attributes, name, role];
    return true;
}
