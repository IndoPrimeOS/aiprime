export default async ({ req, res, log, error }) => {
  const startTime = Date.now();
  const apiKey = process.env.AI_API_KEY;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userMessage = body.message || "Halo";

    const response = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [
          { 
            role: 'system', 
            content: 'Nama kamu adalah Aiprime, asisten cerdas yang dikembangkan oleh Iprime Studio. Kamu harus selalu menjawab pertanyaan dalam Bahasa Indonesia dengan ramah dan membantu.' 
          },
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    // Membersihkan teks jika AI menyertakan tag <think>
    let aiContent = data.choices[0].message.content;
    aiContent = aiContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    return res.json({
      developer: "Iprime Studio",
      ai_name: "Aiprime",
      pesan: aiContent,
      durasi_respon: `${duration}ms`
    });

  } catch (err) {
    return res.json({ 
      developer: "Iprime Studio",
      success: false, 
      error: err.message 
    }, 500);
  }
};
