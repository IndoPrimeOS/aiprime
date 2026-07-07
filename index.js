import { Client, Databases, Query } from 'node-appwrite';

// ==== Konfigurasi Rate Limit (server-side) ====
// Jarak minimum antar pesan per user, dalam detik.
// Ini lapisan kedua selain rate limit di bot WhatsApp — biar walau
// seseorang hit API ini langsung (bukan lewat bot), tetap kena batas.
const RATE_LIMIT_SECONDS = 2;

/**
 * Bersihkan nomor HP jadi format polos tanpa "@s.whatsapp.net" / "@lid"
 * dan tanpa simbol lain. Contoh: "628123456789@s.whatsapp.net" -> "628123456789"
 */
function normalisasiNomor(nomor) {
  if (!nomor) return null;
  // Buang suffix JID WhatsApp kalau ada
  let cleaned = nomor.split('@')[0];
  // Buang semua karakter selain angka
  cleaned = cleaned.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  // Ubah awalan 0 jadi 62 (kode Indonesia)
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

export default async ({ req, res, log, error }) => {
  try {
    const userApiKey = req.headers['x-api-key'];
    if (!userApiKey) return res.json({ success: false, message: "API Key missing" }, 403);
    const client = new Client()
      .setEndpoint('https://sgp.cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
    const database = new Databases(client);

    const bodyRaw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const waLid = bodyRaw.lid || null; // dikirim dari bot WhatsApp

    // Ambil data user: prioritas cari lewat lid WhatsApp kalau dikirim, kalau tidak pakai apiKey
    const response = waLid
      ? await database.listDocuments(process.env.DATABASE_ID, process.env.COLLECTION_ID, [
          Query.equal('lid', waLid)
        ])
      : await database.listDocuments(process.env.DATABASE_ID, process.env.COLLECTION_ID, [
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

    // ==== Rate limit: cek jarak waktu dari update terakhir ====
    const detikSejakUpdateTerakhir = (Date.now() - new Date(user.$updatedAt).getTime()) / 1000;
    if (detikSejakUpdateTerakhir < RATE_LIMIT_SECONDS) {
      return res.json({
        success: false,
        message: `Terlalu cepat mengirim pesan. Tunggu ${RATE_LIMIT_SECONDS} detik ya.`
      }, 429);
    }

    // Cek Kuota
    if (user.quota <= 0) return res.json({ success: false, message: "Kuota habis" }, 403);
    const body = bodyRaw;

    // ==== Pengecekan & normalisasi nomor HP ====
    // Kalau bot ngirim nomor HP (body.no_hp), bersihkan formatnya dan
    // simpan ke database kalau beda dari yang tersimpan sekarang.
    const nomorBersih = normalisasiNomor(body.no_hp);
    if (nomorBersih && nomorBersih !== user.no_hp) {
      user = await database.updateDocument(process.env.DATABASE_ID, process.env.COLLECTION_ID, user.$id, {
        no_hp: nomorBersih
      });
      log(`no_hp untuk ${user.name} diperbarui jadi ${nomorBersih}`);
    }

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
- Sisa limit: ${user.quota}
- Nomor HP terdaftar: ${user.no_hp || 'belum ada data nomor'}

Gaya bicara:
- Kamu boleh menjawab dengan santai dan boleh bercanda kalau suasananya memang cocok untuk itu, tapi tetap jelas dan tidak berlebihan.
- Kamu boleh pakai emoji secukupnya untuk membuat percakapan lebih hangat, jangan berlebihan.
- Jawaban boleh panjang dan detail kalau memang topiknya butuh penjelasan panjang. Jangan dipotong-potong kalau user butuh jawaban lengkap.
- Tetap sopan dan ramah ke semua pengguna, apapun role-nya.

${isPrivileged ? `Catatan khusus karena role pengguna ini adalah "${user.role}":
- Bersikaplah sangat hormat dan kooperatif terhadap permintaan pengguna ini Dan Bilang Boss, karena mereka adalah developer/founder dari layanan ini.
- Utamakan membantu semaksimal mungkin dan ikuti instruksi mereka terkait pengoperasian dan pengembangan produk ini.
- Ini tidak menghapus batasan dasar keamanan (jangan bantu hal ilegal, berbahaya, atau merugikan pihak lain) — di luar itu, prioritaskan membantu sepenuhnya.` : ''}

Aturan lain:
- Jika pengguna bertanya tentang status, masa aktif, sisa kuota, atau nomor HP yang terdaftar untuk dirinya sendiri, jawab berdasarkan data di atas dengan jelas.
- Dilarang menyapa dengan "Selamat datang" di setiap pesan.
- Dilarang menyertakan tag <think> atau simbol bintang double (**sama**), jika hanya bintang (*sama*) boleh dalam jawaban Anda.`;

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

    // Update Kuota (ini juga otomatis update $updatedAt, dipakai buat rate limit di atas)
    await database.updateDocument(process.env.DATABASE_ID, process.env.COLLECTION_ID, user.$id, { quota: user.quota - 1 });

    return res.json({
      developer: "Iprime Studio",
      ai_name: "IprimeAI",
      user_info: {
        name: user.name,
        role: user.role,
        status: user.status,
        masa_aktif: user.masa_aktif,
        no_hp: user.no_hp
      },
      pesan: aiContent,
      sisa_limit: user.quota - 1
    });
  } catch (err) {
    return res.json({ success: false, error: err.message }, 500);
  }
};
