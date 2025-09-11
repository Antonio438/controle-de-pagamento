// CÓDIGO FINAL E CORRETO PARA O server.js
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

// --- CORREÇÃO 1: Usar a porta do Render e o HOST correto ---
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0'; // ESSENCIAL para funcionar online

// --- CORREÇÃO 2: Apontar para o diretório raiz, onde seus arquivos estão ---
const PUBLIC_DIR = __dirname;
// -----------------------------------------------------------------------

const DB_FILE = path.join(__dirname, 'database.json');

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rotas da API (precisam vir antes dos arquivos estáticos)
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.status(200).json(data);
});

app.post('/api/data', (req, res) => {
    const newData = req.body;
    if (newData && typeof newData === 'object') {
        writeDB(newData);
        res.status(200).json({ message: 'Dados salvos com sucesso.' });
    } else {
        res.status(400).json({ message: 'Formato de dados inválido.' });
    }
});

// Servidor de Arquivos Estáticos
app.use(express.static(PUBLIC_DIR));

// Rota de Fallback (precisa ser a última)
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Iniciar o Servidor
app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

// Função de leitura do DB "à prova de falhas"
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
        console.error('Erro ao fazer parse do JSON do banco de dados:', error);
        return { processes: [], payments: [], users: [], activities: [] };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erro ao escrever no arquivo de banco de dados:', error);
    }
};
