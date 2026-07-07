export default async ({ req, res, log, error }) => {
  log("Fungsi dimulai...");

  // Mengakses variabel lingkungan melalui process.env
  // Ini adalah cara standar Node.js yang lebih stabil daripada parameter 'env'
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    error("Fatal: AI_API_KEY tidak ditemukan di environment variables!");
    return res.json({ 
      success: false, 
      message: "Konfigurasi server salah: API Key tidak terdeteksi." 
    }, 500);
  }

  try {
    // Parsing body request dengan aman
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userMessage = body.message || "Hello!";
    
    log("Memproses pesan: " + userMessage);

    // Memanggil API AI
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

    if (!response.ok) {
      const errorText = await response.text();
      error("API AI merespon error: " + errorText);
      return res.json({ success: false, message: "Error dari API AI", details: errorText }, 500);
    }

    const data = await response.json();
    log("Respon AI berhasil diterima.");
    
    return res.json({ 
      success: true, 
      ai_response: data 
    });

  } catch (err) {
    error("Internal Error: " + err.message);
    return res.json({ success: false, message: "Terjadi kesalahan sistem", error: err.message }, 500);
  }
};
