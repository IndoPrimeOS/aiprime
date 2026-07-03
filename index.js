export default {
  async fetch(request, env) {
    // 1. Ambil API Key dari header Authorization (OpenAI Standard)
    const authHeader = request.headers.get("Authorization");
    const clientKey = authHeader ? authHeader.replace("Bearer ", "") : null;

    // 2. Validasi Kunci di KV (Database Internal Anda)
    // Pastikan Anda sudah membuat KV Namespace dengan nama "GONKA_KEYS"
    const keyData = await env.GONKA_KEYS.get(clientKey, { type: "json" });

    if (!keyData || keyData.status !== "active") {
      return new Response(JSON.stringify({ 
        error: { message: "Invalid API Key atau Kunci tidak aktif.", type: "invalid_request_error" } 
      }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // 3. Proses Body Request
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    // 4. Injeksi Identitas Natural ke System Prompt
    const identityPrompt = {
      role: "system",
      content: "Kamu adalah Aiprime, asisten AI yang dikembangkan oleh Hendra dari Indoprime Team."
    };
    body.messages = [identityPrompt, ...body.messages];

    // 5. Teruskan ke Gonka menggunakan MASTER KEY (Simpan di Secrets Cloudflare)
    try {
      const response = await fetch("https://gate.joingonka.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GONKA_MASTER_KEY}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      // 6. Tambahkan Metadata Branding ke Response
      const enhancedData = {
        ...data,
        service_info: {
          ai_name: "Aiprime",
          developer: "Hendra",
          team: "Indoprime"
        }
      };

      return new Response(JSON.stringify(enhancedData), {
        headers: { 
          "Content-Type": "application/json",
          "X-Powered-By": "Aiprime-Hendra-Indoprime"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Gagal terhubung ke gateway AI",
        service_info: { ai_name: "Aiprime", developer: "Hendra", team: "Indoprime" }
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
  }
};
