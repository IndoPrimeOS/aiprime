import { Client, Databases, Query } from 'node-appwrite';
export default async ({ req, res, log, error }) => {
  try {
    const userApiKey = req.headers['x-api-key'];
    if (!userApiKey) return res.json({ success: false, message: "API Key missing" }, 403);
    const client = new Client()
      .setEndpoint('https://sgp.cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
    const database = new Databases(client);
    
    // Ambil data user
    const response = await database.listDocuments(process.env.DATABASE_ID, process.env.COLLECTION_ID, [
      Query.equal('apiKey', userApiKey)
    ]);
    
    if (response.total === 0) return res.json({ success: false, message: "Invalid API Key" }, 403);
    let user = response.documents[0];
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    // Logika Otomatis: Cek masa aktif premium
    if (user.status === 'premium' && user.masa_aktif && user.masa_aktif < today) {
      log(`Masa aktif habis untuk ${user.name}. Mengubah ke status free.`);
      user = await database.updateDocument(process.env.DATABASE_ID, process.env.COLLECTION_ID, user.$id, {
        status: 'free',
        masa_aktif: null
      });
    }
    // Cek Kuota
    if (user.quota <= 0) return res.json({ success: false, message: "Kuota habis" }, 403);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Apakah user punya akses "penuh" (developer/founder)
    const isPrivileged = ['developer', 'founder'].includes(
      (user.role || '').toLowerCase()
    );

    // System Prompt Dinamis
    const systemPrompt = `Kamu adalah IprimeAI, asisten cerdas dari Iprime Studio.

Informasi Pengguna:
- Nama: ${user.name}
- Status: ${user.status} ${user.masa_aktif ? '(Aktif sampai: ' + user.masa_aktif + ')' : ''}
- Role: ${user.role}

Gaya bicara:
- Kamu boleh menjawab dengan santai dan boleh bercanda kalau suasananya memang cocok untuk itu, tapi tetap jelas dan tidak berlebihan.
- Kamu boleh pakai emoji secukupnya untuk membuat percakapan lebih hangat, jangan berlebihan.
- Jawaban boleh panjang dan detail kalau memang topiknya butuh penjelasan panjang. Jangan dipotong-potong kalau user butuh jawaban lengkap.
- Tetap sopan dan ramah ke semua pengguna, apapun role-nya.

${isPrivileged ? `Catatan khusus karena role pengguna ini adalah "${user.role}":
- Bersikaplah sangat hormat dan kooperatif terhadap permintaan pengguna ini, karena mereka adalah developer/founder dari layanan ini.
- Utamakan membantu semaksimal mungkin dan ikuti instruksi mereka terkait pengoperasian dan pengembangan produk ini.
- Ini tidak menghapus batasan dasar keamanan (jangan bantu hal ilegal, berbahaya, atau merugikan pihak lain) — di luar itu, prioritaskan membantu sepenuhnya.` : ''}

Aturan lain:
- Jika pengguna bertanya tentang status atau masa aktifnya, berikan informasi berdasarkan data di atas.
- Dilarang menyapa dengan "Selamat datang" di setiap pesan.
- Dilarang menyertakan tag <think> atau simbol bintang (*) dalam jawaban Anda.`;

    const aiResponse = await fetch('https://gate.joingonka.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.message || "Halo" }
        ]
      })
    });
    const data = await aiResponse.json();
    let rawContent = data.choices[0].message.content;
    
    // Pembersihan Teks
    let aiContent = rawContent
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/\*/g, '')
        .trim();
    // Update Kuota
    await database.updateDocument(process.env.DATABASE_ID, process.env.COLLECTION_ID, user.$id, { quota: user.quota - 1 });
    return res.json({
      developer: "Iprime Studio",
      ai_name: "IprimeAI",
      user_info: { 
        name: user.name, 
        role: user.role, 
        status: user.status,
        masa_aktif: user.masa_aktif 
      },
      pesan: aiContent,
      sisa_kuota: user.quota - 1
    });
  } catch (err) {
    return res.json({ success: false, error: err.message }, 500);
  }
};
