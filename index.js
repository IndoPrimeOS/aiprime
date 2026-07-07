import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log }) => {
  const startTime = Date.now();
  const userApiKey = req.headers['x-api-key'];

  // Inisialisasi Appwrite
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const database = new Databases(client);

  try {
    // 1. Cek User di Database menggunakan Variable (Aman dari GitHub)
    const response = await database.listDocuments(
      process.env.DATABASE_ID,
      process.env.COLLECTION_ID,
      [Query.equal('apiKey', userApiKey)]
    );

    if (response.total === 0) {
      return res.json({ success: false, message: "API Key tidak terdaftar." }, 403);
    }

    const user = response.documents[0];

    // 2. Cek Limit Kuota
    if (user.quota <= 0) {
      return res.json({ success: false, message: "Kuota Anda habis. Silakan hubungi admin." }, 403);
    }

    // 3. Panggil AI
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const aiResponse = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [
          { 
            role: 'system', 
            content: 'Kamu adalah IprimeAI, asisten cerdas dari Iprime Studio. Aturan: 1. Jika pengguna memanggilmu dengan nama apapun, tetaplah merespons dengan ramah sebagai IprimeAI tanpa mengoreksi nama. 2. Gunakan pesan pembuka: "Halo! Selamat datang! Saya IprimeAI asisten cerdas, Senang bertemu dengan Anda! Ada yang bisa saya bantu hari ini? Jangan ragu untuk bertanya apa saja, saya siap membantu Anda. 😊". 3. Jika ditanya lokasi, jawab bahwa kamu diciptakan di Indonesia dan berada di zona waktu WIB (GMT+7). 4. Jangan gunakan simbol bintang (*) sama sekali. 5. Jawab dengan ramah dalam Bahasa Indonesia.' 
          },
          { role: 'user', content: body.message || "Halo" }
        ]
      })
    });

    const data = await aiResponse.json();
    let aiContent = data.choices[0].message.content
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/\*/g, '')
      .trim();

    // 4. Kurangi Kuota di Database
    await database.updateDocument(
      process.env.DATABASE_ID,
      process.env.COLLECTION_ID,
      user.$id,
      { quota: user.quota - 1 }
    );

    return res.send(JSON.stringify({
      developer: "Iprime Studio",
      ai_name: "IprimeAI",
      user: user.name,
      pesan: aiContent,
      sisa_kuota: user.quota - 1,
      durasi_respon: `${Date.now() - startTime}ms`
    }, null, 2), 200, { 'Content-Type': 'application/json' });

  } catch (err) {
    return res.json({ success: false, error: err.message }, 500);
  }
};
