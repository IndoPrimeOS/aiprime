export default async ({ req, res, log }) => {
  const startTime = Date.now();
  const userApiKey = req.headers['x-api-key'];

  // 1. Proses Daftar API Key dari ENV
  const keyPairs = (process.env.ALLOWED_API_KEYS || "").split(",");
  const userMap = {};
  keyPairs.forEach(pair => {
    const [key, name] = pair.split(":");
    if (key && name) userMap[key.trim()] = name.trim();
  });

  // 2. Validasi API Key
  const userName = userMap[userApiKey];
  if (!userName) {
    return res.json({ 
      developer: "Iprime Studio", 
      success: false, 
      message: "API Key tidak valid." 
    }, 403);
  }

  log(`Request diterima dari User: ${userName}`);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userMessage = body.message || "Halo";
    const isStreaming = body.stream === true;

    // 3. Panggilan ke API GoNKA
    const response = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        stream: isStreaming,
        messages: [
          { 
            role: 'system', 
            content: 'Nama kamu adalah IprimeAI, asisten cerdas yang diciptakan di Indonesia oleh Iprime Studio. Waktu kamu adalah WIB (GMT+7). Selalu jawab dengan ramah, gunakan Bahasa Indonesia yang bersih, dan jangan gunakan simbol bintang (*) dalam teks jawabanmu.' 
          },
          { role: 'user', content: userMessage }
        ]
      })
    });

    // 4. Handle Streaming vs Normal
    if (isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    } else {
      const data = await response.json();
      
      // Hapus tag <think> dan hapus SEMUA simbol bintang agar teks bersih
      let aiContent = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/\*/g, '') 
        .trim();

      // 5. Respon Pretty JSON
      const finalResponse = {
        developer: "Iprime Studio",
        ai_name: "IprimeAI",
        user: userName,
        lokasi: "Indonesia (WIB / GMT+7)",
        pesan: aiContent,
        durasi_respon: `${Date.now() - startTime}ms`
      };

      return res.send(JSON.stringify(finalResponse, null, 2), 200, { 'Content-Type': 'application/json' });
    }
  } catch (err) {
    return res.json({ 
      developer: "Iprime Studio",
      success: false, 
      error: err.message 
    }, 500);
  }
};
