// =================================================================
//      CÓDIGO AJUSTADO PARA FUNCIONAR NA VERCEL (api/index.js)
// =================================================================
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

// --- 1. CONFIGURAÇÕES ESSENCIAIS PARA A VERCEL ---
// Caminho para o arquivo de banco de dados na VERCEL.
// IMPORTANTE: Apenas a pasta /tmp é gravável, mas os dados são TEMPORÁRIOS.
const DB_FILE = path.join('/tmp', 'database.json');


// --- 2. MIDDLEWARES (Configurações do Express) ---
// Habilita o CORS para permitir que a API seja chamada do seu front-end na Vercel
app.use(cors());
// Habilita o Express para entender requisições com corpo em JSON
app.use(express.json({ limit: '50mb' }));


// --- 3. ROTAS DA API ---
// Rota para LER os dados do banco de dados
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.status(200).json(data);
});

// Rota para SALVAR os dados no banco de dados
app.post('/api/data', (req, res) => {
    const newData = req.body;
    if (newData && typeof newData === 'object') {
        writeDB(newData);
        res.status(200).json({ message: 'Dados salvos com sucesso (temporariamente).' });
    } else {
        res.status(400).json({ message: 'Formato de dados inválido.' });
    }
});


// --- 4. EXPORTAÇÃO PARA A VERCEL ---
// Em vez de app.listen, exportamos o app para que a Vercel possa executá-lo.
module.exports = app;


// --- 5. FUNÇÕES AUXILIARES (À Prova de Falhas) ---
// Função para ler o banco de dados
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        return { processes: [], payments: [], users: [], activities: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    if (data.trim() === '') {
        return { processes: [], payments: [], users: [], activities: [] };
    }
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao fazer parse do JSON:', error);
        return { processes: [], payments: [], users: [], activities: [] };
    }
};

// Função para escrever no banco de dados
const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erro ao escrever no arquivo:', error);
    }
};
