export default async ({ req, res, log, error, env }) => {
  log("--- Proses Fungsi Dimulai ---");

  // 1. Validasi Environment Variable
  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    error("Fatal Error: AI_API_KEY tidak ditemukan di Environment Variables!");
    return res.json({ error: "Server Configuration Error" }, 500);
  }

  // 2. Parsing Input dengan aman
  let userMessage = "Hello!";
  try {
    if (req.body) {
      // Menangani request baik dalam format string maupun object
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      userMessage = body.message || "Hello!";
      log("Pesan diterima dari user: " + userMessage);
    }
  } catch (e) {
    log("Catatan: Input body bukan JSON valid, menggunakan pesan default.");
  }

  // 3. Eksekusi Request ke API GoNKA
  try {
    log("Menghubungkan ke API GoNKA...");
    
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

    // Cek apakah response dari API AI berhasil
    if (!response.ok) {
      const errorText = await response.text();
      error("API AI merespon dengan error: " + errorText);
      return res.json({ success: false, message: "API AI mengembalikan error", details: errorText }, response.status);
    }

    const data = await response.json();
    log("API AI berhasil memberikan respon.");
    
    return res.json({ 
      success: true, 
      ai_response: data 
    });

  } catch (err) {
    error("Fatal Error saat fetch API: " + err.message);
    return res.json({ success: false, message: "Internal System Error", error: err.message }, 500);
  }
};
