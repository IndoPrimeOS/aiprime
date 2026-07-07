import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log("--- Memulai fungsi IprimeAI ---");
  
  try {
    // 1. Cek Header
    const userApiKey = req.headers['x-api-key'];
    if (!userApiKey) {
      error("Error: x-api-key header tidak ditemukan.");
      return res.json({ success: false, message: "API Key tidak ditemukan" }, 403);
    }
    log("API Key diterima.");

    // 2. Inisialisasi Appwrite
    const client = new Client()
      .setEndpoint('https://sgp.cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const database = new Databases(client);
    log("Koneksi Appwrite diinisialisasi.");

    // 3. Cek Database
    const dbId = process.env.DATABASE_ID;
    const colId = process.env.COLLECTION_ID;
    log(`Mengakses DB: ${dbId}, Collection: ${colId}`);

    const response = await database.listDocuments(dbId, colId, [
      Query.equal('apiKey', userApiKey)
    ]);
    
    log(`Query selesai. Dokumen ditemukan: ${response.total}`);
    if (response.total === 0) {
      error("Error: API Key tidak terdaftar di database.");
      return res.json({ success: false, message: "API Key tidak terdaftar" }, 403);
    }

    const user = response.documents[0];
    log(`User teridentifikasi: ${user.name}. Sisa kuota: ${user.quota}`);

    // 4. Cek Kuota
    if (user.quota <= 0) {
      error("Error: Kuota habis.");
      return res.json({ success: false, message: "Kuota Anda habis" }, 403);
    }

    // 5. Panggil AI
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    log("Menghubungi AI...");

    const aiResponse = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [
          { role: 'system', content: 'Kamu adalah IprimeAI, asisten cerdas dari Iprime Studio. Aturan: Gunakan pesan pembuka: "Halo! Selamat datang! Saya IprimeAI asisten cerdas, Senang bertemu dengan Anda! Ada yang bisa saya bantu hari ini?". Jangan gunakan simbol bintang (*) sama sekali. Jawab dengan ramah dalam Bahasa Indonesia.' },
          { role: 'user', content: body.message || "Halo" }
        ]
      })
    });

    const data = await aiResponse.json();
    let aiContent = data.choices[0].message.content.replace(/\*/g, '').trim();

    // 6. Update Kuota
    await database.updateDocument(dbId, colId, user.$id, { quota: user.quota - 1 });
    log("Kuota berhasil dikurangi.");

    return res.json({
      developer: "Iprime Studio",
      ai_name: "IprimeAI",
      user: user.name,
      pesan: aiContent,
      sisa_kuota: user.quota - 1
    });

  } catch (err) {
    error(`CRITICAL ERROR: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};
