const mongoose = require('mongoose');
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

// MongoDB Session Schema
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    keyId: { type: String, required: true },
    data: { type: String, required: true }
}, { versionKey: false });

sessionSchema.index({ sessionId: 1, keyId: 1 }, { unique: true });
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

/**
 * Super Ultra-Fast MongoDB Multi-Device Auth Engine (Zero Data-Loss)
 */
async function useMongoAuthState(sessionId) {
    // RAM Cache එකක් මඟින් DB latency එක Signal keys වලට බලපෑම වළක්වයි
    const localCache = new Map();

    const writeData = async (data, id) => {
        try {
            localCache.set(id, data);
            const serialized = JSON.stringify(data, BufferJSON.replacer);
            await SessionModel.updateOne(
                { sessionId, keyId: id },
                { $set: { data: serialized } },
                { upsert: true }
            );
        } catch (err) {
            console.error(`[AUTH WRITE ERR] Key: ${id}:`, err.message);
        }
    };

    const readData = async (id) => {
        try {
            if (localCache.has(id)) {
                return localCache.get(id);
            }
            const doc = await SessionModel.findOne({ sessionId, keyId: id }).lean();
            if (doc && doc.data) {
                const parsed = JSON.parse(doc.data, BufferJSON.reviver);
                localCache.set(id, parsed);
                return parsed;
            }
            return null;
        } catch (err) {
            console.error(`[AUTH READ ERR] Key: ${id}:`, err.message);
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            localCache.delete(id);
            await SessionModel.deleteOne({ sessionId, keyId: id });
        } catch (err) {
            console.error(`[AUTH REMOVE ERR] Key: ${id}:`, err.message);
        }
    };

    const credsData = await readData('creds');
    const creds = credsData || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const bulkOps = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;

                            if (value) {
                                localCache.set(key, value);
                                const serialized = JSON.stringify(value, BufferJSON.replacer);
                                bulkOps.push({
                                    updateOne: {
                                        filter: { sessionId, keyId: key },
                                        update: { $set: { data: serialized } },
                                        upsert: true
                                    }
                                });
                            } else {
                                localCache.delete(key);
                                bulkOps.push({
                                    deleteOne: {
                                        filter: { sessionId, keyId: key }
                                    }
                                });
                            }
                        }
                    }

                    if (bulkOps.length > 0) {
                        try {
                            await SessionModel.bulkWrite(bulkOps, { ordered: false });
                        } catch (bulkErr) {
                            console.error('[AUTH BULK WRITE ERR]:', bulkErr.message);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: async () => {
            try {
                localCache.clear();
                await SessionModel.deleteMany({ sessionId });
            } catch (err) {
                console.error("[AUTH CLEAR ERR]:", err.message);
            }
        }
    };
}

module.exports = { useMongoAuthState, SessionModel };
