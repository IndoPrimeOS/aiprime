const axios = require("axios");
require("dotenv").config();

module.exports = async function (req, res) {
  try {
    const userMessage = req.body?.message || "Hello!";

    const response = await axios.post(
      "https://gate.joingonka.ai/v1/chat/completions",
      {
        model: "MiniMaxAI/MiniMax-M2.7",
        messages: [{ role: "user", content: userMessage }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GENKA_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.json({ error: error.message });
  }
};
