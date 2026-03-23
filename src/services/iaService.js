const clasificarGasto = async (descripcion) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [
        {
          role: 'user',
          content: `Clasifica este gasto en UNA sola categoría (responde solo la categoría, sin explicación):
Categorías posibles: Alimentación, Transporte, Salud, Entretenimiento, Educación, Hogar, Otros
Gasto: "${descripcion}"`
        }
      ]
    })
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
};

module.exports = { clasificarGasto };