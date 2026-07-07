export default async ({ req, res, log, error, env }) => {
  // Mengambil dari env yang dikonfigurasi di dashboard Appwrite
  const apiKey = env.AI_API_KEY; 

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userMessage = body.message || "Hello!";

    const response = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
    error("Error: " + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
