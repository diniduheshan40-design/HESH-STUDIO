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
            await SessionModel.findOneAndUpdate(
                { sessionId, id },
                { data: JSON.stringify(data, BufferJSON.replacer) },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (err) {
            console.error(`[AUTH WRITE ERR] ${id}:`, err.message);
        }
    };

    const readData = async (id) => {
        try {
            const doc = await SessionModel.findOne({ sessionId, id }).lean();
            if (doc && doc.data) {
                return JSON.parse(doc.data, BufferJSON.reviver);
            }
            return null;
        } catch (err) {
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await SessionModel.deleteOne({ sessionId, id });
        } catch (err) {}
    };

    const creds = (await readData('creds')) || initAuthCreds();

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
            try {
                await SessionModel.deleteMany({ sessionId });
            } catch (err) {}
        }
    };
}

module.exports = { useMongoAuthState, SessionModel };
