export default async ({ req, res, log, error, env }) => {
  log("Fungsi dimulai...");

  // 1. Pastikan objek env ada
  if (!env) {
    error("Objek 'env' tidak tersedia di runtime!");
    return res.json({ error: "Environment configuration missing" }, 500);
  }

  // 2. Akses API Key dari env
  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    error("AI_API_KEY tidak ditemukan di variabel lingkungan!");
    return res.json({ error: "API Key missing" }, 500);
  }

  // 3. Proses request
  try {
    let userMessage = "Hello!";
    if (req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      userMessage = body.message || "Hello!";
    }

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
    error("Error saat fetch: " + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
