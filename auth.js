const mongoose = require('mongoose');
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    keyId: { type: String, required: true },
    data: { type: String, required: true }
}, { versionKey: false });

sessionSchema.index({ sessionId: 1, keyId: 1 }, { unique: true });
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

// In-Memory Fast Cache for Zero Query Lag
const memoryCache = new Map();

async function useMongoAuthState(sessionId) {
    const getCacheKey = (id) => `${sessionId}:${id}`;

    const writeData = async (data, id) => {
        const cacheKey = getCacheKey(id);
        memoryCache.set(cacheKey, data);

        const serialized = JSON.stringify(data, BufferJSON.replacer);
        await SessionModel.updateOne(
            { sessionId, keyId: id },
            { $set: { data: serialized } },
            { upsert: true }
        ).catch(() => {});
    };

    const readData = async (id) => {
        const cacheKey = getCacheKey(id);
        if (memoryCache.has(cacheKey)) {
            return memoryCache.get(cacheKey);
        }

        try {
            const doc = await SessionModel.findOne({ sessionId, keyId: id }).lean();
            if (doc && doc.data) {
                const parsed = JSON.parse(doc.data, BufferJSON.reviver);
                memoryCache.set(cacheKey, parsed);
                return parsed;
            }
            return null;
        } catch {
            return null;
        }
    };

    const removeData = async (id) => {
        const cacheKey = getCacheKey(id);
        memoryCache.delete(cacheKey);
        await SessionModel.deleteOne({ sessionId, keyId: id }).catch(() => {});
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
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: async () => {
            for (const key of memoryCache.keys()) {
                if (key.startsWith(`${sessionId}:`)) memoryCache.delete(key);
            }
            await SessionModel.deleteMany({ sessionId }).catch(() => {});
        }
    };
}

module.exports = { useMongoAuthState, SessionModel };
