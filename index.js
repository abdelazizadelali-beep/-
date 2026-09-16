import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object) {
        try {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const message = value?.messages?.[0];

            if (message && message.text) {
                const recipientNumber = message.from;
                const userMessage = message.text.body;

                const geminiResponse = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5pro:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        contents: [
                            {
                                parts: [{ text: userMessage }]
                            }
                        ]
                    }
                );

                const botReply = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that.";

                await axios.post(
                    `https://graph.facebook.com/v19.0/me/messages`,
                    {
                        messaging_product: 'whatsapp',
                        to: recipientNumber,
                        text: { body: botReply },
                    },
                    {
                        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
                    }
                );
            }
        } catch (error) {
            console.error('Error processing message:', error.response?.data || error.message);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
