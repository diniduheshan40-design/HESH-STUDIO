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
 * MongoDB Multi-Device Auth Engine (Zero Data-Loss)
 */
async function useMongoAuthState(sessionId) {
    // MongoDB එකට save කිරීම
    const writeData = async (data, id) => {
        try {
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

    // MongoDB එකෙන් read කිරීම
    const readData = async (id) => {
        try {
            const doc = await SessionModel.findOne({ sessionId, keyId: id }).lean();
            if (doc && doc.data) {
                return JSON.parse(doc.data, BufferJSON.reviver);
            }
            return null;
        } catch (err) {
            console.error(`[AUTH READ ERR] Key: ${id}:`, err.message);
            return null;
        }
    };

    // Data remove කිරීම
    const removeData = async (id) => {
        try {
            await SessionModel.deleteOne({ sessionId, keyId: id });
        } catch (err) {
            console.error(`[AUTH REMOVE ERR] Key: ${id}:`, err.message);
        }
    };

    // Creds load කිරීම හෝ අලුතින් init කිරීම
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
            try {
                await SessionModel.deleteMany({ sessionId });
            } catch (err) {
                console.error("[AUTH CLEAR ERR]:", err.message);
            }
        }
    };
}

module.exports = { useMongoAuthState, SessionModel };
