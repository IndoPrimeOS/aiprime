import { Client } from 'node-appwrite';

export default async ({ req, res, log, error, env }) => {
  // Ambil pesan dari body request
  let userMessage = 'Hello!';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    userMessage = body.message || 'Hello!';
  } catch (e) {
    error('Invalid JSON body');
  }

  try {
    const response = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();
    return res.json({ success: true, ai_response: data });

  } catch (err) {
    error('Error: ' + err.message);
    return res.json({ success: false, error: 'Failed to fetch AI' }, 500);
  }
};
