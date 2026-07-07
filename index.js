export default async ({ req, res, log, error }) => {
  // Masukkan kunci Anda langsung di sini untuk testing saja
  const apiKey = "jg-207376f9eea872657e34996ffbeba0d9e679c3044cc81ecb5d44d960b6bdf308";
  
  log("Fungsi berjalan (hardcoded key)...");

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
    log("Response dari AI diterima.");
    return res.json({ success: true, ai_response: data });

  } catch (err) {
    error("Fatal error: " + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
