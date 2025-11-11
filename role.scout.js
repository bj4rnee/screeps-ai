var roleScout = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // if scout has no target flag assigned, pick one
        if (!creep.memory.targetFlag || !creep.memory.targetRoom) {
            const flags = Object.values(Game.flags).filter(f => f.name.toLowerCase().includes('scout'));
            if (flags.length > 0) {
                // pick the least-scouted flag (one with no assigned scout)
                const unassignedFlag = flags.find(f =>
                    !_.some(Game.creeps, c =>
                        c.memory.role === 'scout' && c.memory.targetFlag === f.name
                    )
                );
                if (unassignedFlag) {
                    creep.memory.targetFlag = unassignedFlag.name;
                    creep.memory.targetRoom = unassignedFlag.pos.roomName;
                }
            }
        }

        // if no target just idle at home room center
        if (!creep.memory.targetFlag) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), { visualizePathStyle: { stroke: '#555555' } });
            return;
        }

        const flag = Game.flags[creep.memory.targetFlag];
        if (!flag) {
            // target flag deleted, reset memory
            delete creep.memory.targetFlag;
            delete creep.memory.targetRoom;
            return;
        }

        // move to target flag room
        if (creep.room.name !== flag.pos.roomName) {
            creep.moveTo(flag, { visualizePathStyle: { stroke: '#00ffff' } });
        } else {
            // in target room: hang around flag position
            creep.moveTo(flag.pos, { visualizePathStyle: { stroke: '#00ff00' } });
        }
    }
};

module.exports = roleScout;