const mongoose = require('mongoose');
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    id: { type: String, required: true },
    data: { type: String, required: true }
}, { versionKey: false, timestamps: true });

sessionSchema.index({ sessionId: 1, id: 1 }, { unique: true });
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);

async function useMongoAuthState(sessionId) {
    const writeData = async (data, id) => {
        try {
            await SessionModel.updateOne(
                { sessionId, id },
                { $set: { data: JSON.stringify(data, BufferJSON.replacer) } },
                { upsert: true }
            );
        } catch (e) {
            console.error(`[AUTH WRITE ERR] ${sessionId}/${id}:`, e.message);
        }
    };

    const readData = async (id) => {
        try {
            const doc = await SessionModel.findOne({ sessionId, id }).lean();
            return doc?.data ? JSON.parse(doc.data, BufferJSON.reviver) : null;
        } catch (e) {
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await SessionModel.deleteOne({ sessionId, id });
        } catch (e) {}
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const val = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(val ? writeData(val, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: async () => {
            try {
                await SessionModel.deleteMany({ sessionId });
                console.log(`[AUTH] Cleared: ${sessionId}`);
            } catch (e) {}
        }
    };
}

module.exports = { useMongoAuthState, SessionModel };
