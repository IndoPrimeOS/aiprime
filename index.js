export default async ({ req, res, error, env }) => {
  // 1. Parsing body dengan aman
  let userMessage = 'Hello!';
  try {
    if (req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      userMessage = body.message || 'Hello!';
    }
  } catch (e) {
    // Jika body bukan JSON, kita lanjut saja dengan default
  }

  // 2. Cek apakah API Key sudah ada di environment
  if (!env.AI_API_KEY) {
    return res.json({ success: false, message: "AI_API_KEY tidak ditemukan di environment variables." }, 500);
  }

  try {
    // 3. Panggil API AI
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
    error('Error saat fetch AI: ' + err.message);
    return res.json({ success: false, message: 'Gagal memanggil API AI' }, 500);
  }
};
